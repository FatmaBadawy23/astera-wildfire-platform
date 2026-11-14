"""Real Satellite Raster Upload, Validation, and Before/After Co-Registration Service.

Inspects uploaded GeoTIFF (.tif/.tiff) and NumPy (.npz) files with rasterio and numpy,
validates radiometric and spatial metadata, rejects ordinary ungeoreferenced RGB
images (PNG/JPEG) for SAR model inference with explicit scientific diagnostics,
and validates/co-registers Before vs. After image pairs onto a common UTM grid.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import re
import shutil
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from rasterio.enums import ColorInterp, Resampling
from rasterio.transform import Affine
from rasterio.warp import reproject, transform_bounds

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
UPLOADS_DIR = PROJECT_ROOT / "outputs" / "uploads"
PAIRS_DIR = PROJECT_ROOT / "outputs" / "upload_pairs"
SAMPLE_UPLOADS_DIR = PROJECT_ROOT / "outputs" / "sample_uploads"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
PAIRS_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".tif", ".tiff", ".npz", ".png", ".jpg", ".jpeg"}
RGB_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
MAX_UPLOAD_BYTES = 250 * 1024 * 1024  # 250 MB


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _to_db_auto(arr: np.ndarray) -> Tuple[np.ndarray, str]:
    """Convert SAR array to dB if in linear power, or preserve if already in dB.

    Returns (db_array, radiometric_scale_detected).
    """
    finite = arr[np.isfinite(arr)]
    if finite.size == 0:
        return arr.astype(np.float32), "empty"
    median_val = float(np.median(finite))
    min_val = float(np.min(finite))
    max_val = float(np.max(finite))
    # Linear SAR gamma0/sigma0 power has positive values typically in (0.0001, 2.0)
    # whereas dB values for land are negative, typically in (-35.0, +5.0)
    if min_val >= 0.0 and median_val > 0.0 and median_val < 5.0 and max_val <= 50.0:
        out = np.full(arr.shape, np.nan, dtype=np.float32)
        pos = np.isfinite(arr) & (arr > 0)
        out[pos] = 10.0 * np.log10(arr[pos].astype(np.float64)).astype(np.float32)
        return out, "linear_power_converted_to_db"
    return arr.astype(np.float32), "decibels_db"


def _render_preview_png(arr_2d: np.ndarray, out_path: Path, cmap: str = "viridis") -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    finite = np.isfinite(arr_2d)
    rgba = np.zeros((*arr_2d.shape, 4), dtype=np.float32)
    if finite.any():
        vals = arr_2d[finite]
        vmin = float(np.percentile(vals, 2))
        vmax = float(np.percentile(vals, 98))
        if abs(vmax - vmin) < 1e-6:
            vmin, vmax = float(np.min(vals)) - 1.0, float(np.max(vals)) + 1.0
        norm = np.clip((arr_2d - vmin) / max(vmax - vmin, 1e-6), 0.0, 1.0)
        norm = np.where(finite, norm, 0.0)
        mapped = matplotlib.colormaps[cmap](norm)
        rgba[finite, :3] = mapped[finite, :3]
        rgba[finite, 3] = 0.92
    plt.imsave(out_path, rgba)


_SAR_MODEL_REJECTION_REASONS = {
    "unet": "Requires 5-channel calibrated SAR dB input [vv_pre_db, vh_pre_db, vv_post_db, vh_post_db, delta_vh_db].",
    "lightgbm": "Requires 10-feature calibrated dual-pol SAR dB input.",
    "log_ratio": "Requires calibrated pre-fire and post-fire SAR backscatter (VH or VV).",
    "cusum": "Requires >= 3 co-registered multi-temporal SAR VH dB scenes.",
}


def _normalize_iso_day(raw_value: Optional[str]) -> Optional[str]:
    """Extract YYYY-MM-DD from an ISO datetime string, compact YYYYMMDD, or filename fragment."""
    if not raw_value:
        return None
    text = str(raw_value).strip()
    m_iso = re.search(r"(\d{4})[-_](\d{2})[-_](\d{2})", text)
    if m_iso:
        y, mo, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        if 1990 <= y <= 2100 and 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}"
    m_compact = re.search(r"(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)", text)
    if m_compact:
        y, mo, d = int(m_compact.group(1)), int(m_compact.group(2)), int(m_compact.group(3))
        if 1990 <= y <= 2100 and 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}"
    return None


def _extract_date_from_metadata(tags: Dict[str, str], filename: str) -> Optional[str]:
    for key in ("ACQUISITION_DATETIME", "SENSING_TIME", "START_TIME", "DATE", "TIFFTAG_DATETIME"):
        val = tags.get(key)
        if val:
            day = _normalize_iso_day(val)
            return val if ("T" in str(val) and day) else (day or str(val))
    return _normalize_iso_day(filename)


def _compute_wgs84_overlap_pct(b1: Optional[List[float]], b2: Optional[List[float]]) -> float:
    if not b1 or not b2 or len(b1) < 4 or len(b2) < 4:
        return 0.0
    ix_w = max(b1[0], b2[0])
    ix_s = max(b1[1], b2[1])
    ix_e = min(b1[2], b2[2])
    ix_n = min(b1[3], b2[3])
    if ix_e <= ix_w or ix_n <= ix_s:
        return 0.0
    inter_area = (ix_e - ix_w) * (ix_n - ix_s)
    area1 = max((b1[2] - b1[0]) * (b1[3] - b1[1]), 1e-12)
    area2 = max((b2[2] - b2[0]) * (b2[3] - b2[1]), 1e-12)
    return round(float(inter_area / min(area1, area2)) * 100.0, 2)


def _build_rejected_rgb_record(
    *,
    upload_id: str,
    filename: str,
    role: str,
    file_format: str,
    size_bytes: int,
    sha256_hex: str,
    width: int,
    height: int,
    channels: int,
    scientific_explanation: str,
    warnings: List[str],
    crs: Optional[str] = None,
    bounds: Optional[List[float]] = None,
    bounds_wgs84: Optional[List[float]] = None,
    dtypes: Optional[List[str]] = None,
    acquisition_date: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "upload_id": upload_id,
        "filename": filename,
        "role": role,
        "file_format": file_format,
        "file_size_bytes": size_bytes,
        "sha256": sha256_hex,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "is_valid": False,
        "valid_for_sar_inference": False,
        "validation_status": "REJECTED_NON_GEOSPATIAL_RGB",
        "error_code": "UNSUPPORTED_OPTICAL_RGB_FOR_SAR_MODEL",
        "scientific_explanation": scientific_explanation,
        "acquisition_date": acquisition_date,
        "crs": crs,
        "bounds": bounds,
        "bounds_wgs84": bounds_wgs84,
        "width": width,
        "height": height,
        "band_count": channels,
        "bands": [f"RGB_Channel_{i + 1}" for i in range(channels)],
        "dtypes": dtypes,
        "polarizations": [],
        "resolution_m": None,
        "nodata": None,
        "valid_pixel_percentage": 0.0,
        "compatible_models": [],
        "incompatible_models_reasons": dict(_SAR_MODEL_REJECTION_REASONS),
        "warnings": warnings,
        "preview_url": None,
    }


class UploadValidationService:
    """Inspects, validates, and co-registers uploaded satellite rasters."""

    def __init__(self) -> None:
        self._ensure_sample_geotiffs()

    _SAMPLE_CATALOG_SPECS = [
        ("CA_BUG_2026", "Park Fire (Held-Out TEST)", "2024-07-12T02:00:08Z", "2024-08-05T02:00:07Z"),
        ("CA_DOME_2026", "Borel Fire (Validation VAL)", "2024-07-17T02:00:00Z", "2024-08-22T02:00:00Z"),
        ("CA_GANN_2026", "Lake Fire (Training TRAIN)", "2024-07-04T02:00:00Z", "2024-08-09T02:00:00Z"),
    ]

    def _ensure_sample_geotiffs(self) -> None:
        """Create real georeferenced 2-band (VV+VH) pre/post sample GeoTIFFs from prepared NPZ datasets."""
        for ev_id, _, pre_iso, post_iso in self._SAMPLE_CATALOG_SPECS:
            pre_dual = SAMPLE_UPLOADS_DIR / f"{ev_id}_sentinel1_pre_dualpol_vv_vh_db.tif"
            post_dual = SAMPLE_UPLOADS_DIR / f"{ev_id}_sentinel1_post_dualpol_vv_vh_db.tif"
            if pre_dual.exists() and post_dual.exists():
                continue

            try:
                npz_path = (
                    PROJECT_ROOT
                    / "data"
                    / "acquisitions"
                    / "run_20261114_025000_phase_g"
                    / "dataset"
                    / "prepared"
                    / f"{ev_id}.npz"
                )
                ref_tif = (
                    PROJECT_ROOT
                    / "outputs"
                    / "runs"
                    / "run_20261114_025000_phase_g"
                    / "geospatial"
                    / ev_id
                    / "pre_fire_vh_db.tif"
                )
                if not npz_path.exists() or not ref_tif.exists():
                    continue

                with rasterio.open(ref_tif) as src:
                    crs = src.crs
                    transform = src.transform
                    height, width = src.height, src.width

                with np.load(npz_path) as data:
                    pre_vv_db, _ = _to_db_auto(data["pre_vv"])
                    pre_vh_db, _ = _to_db_auto(data["pre_vh"])
                    post_vv_db, _ = _to_db_auto(data["post_vv"])
                    post_vh_db, _ = _to_db_auto(data["post_vh"])
                    valid = data["valid"] > 0

                nodata_val = -9999.0
                for out_p, vv_arr, vh_arr, tag_role, acq_date in [
                    (pre_dual, pre_vv_db, pre_vh_db, "pre_fire", pre_iso),
                    (post_dual, post_vv_db, post_vh_db, "post_fire", post_iso),
                ]:
                    vv_clean = np.where(valid & np.isfinite(vv_arr), vv_arr, nodata_val).astype(np.float32)
                    vh_clean = np.where(valid & np.isfinite(vh_arr), vh_arr, nodata_val).astype(np.float32)
                    profile = {
                        "driver": "GTiff",
                        "height": height,
                        "width": width,
                        "count": 2,
                        "dtype": "float32",
                        "crs": crs,
                        "transform": transform,
                        "nodata": nodata_val,
                        "compress": "deflate",
                    }
                    with rasterio.open(out_p, "w", **profile) as dst:
                        dst.write(vv_clean, 1)
                        dst.write(vh_clean, 2)
                        dst.set_band_description(1, "VV_dB")
                        dst.set_band_description(2, "VH_dB")
                        dst.update_tags(
                            SENSOR="Sentinel-1 RTC C-band",
                            ROLE=tag_role,
                            ACQUISITION_DATETIME=acq_date,
                            EVENT_ID=ev_id,
                            POLARIZATIONS="VV,VH",
                            UNITS="dB",
                        )
            except Exception as exc:
                logger.warning("Could not generate sample dual-pol GeoTIFFs for %s: %s", ev_id, exc)

    def _read_geotiff_footprint(self, path: Path) -> Dict[str, Any]:
        with rasterio.open(path) as src:
            w, s, e, n = (0.0, 0.0, 0.0, 0.0)
            bounds_wgs84 = None
            if src.crs:
                w, s, e, n = transform_bounds(src.crs, "EPSG:4326", *src.bounds, densify_pts=21)
                bounds_wgs84 = [round(float(w), 6), round(float(s), 6), round(float(e), 6), round(float(n), 6)]
            return {
                "crs": str(src.crs) if src.crs else None,
                "bounds_wgs84": bounds_wgs84,
                "width": src.width,
                "height": src.height,
                "band_count": src.count,
            }

    def list_sample_files(self) -> List[Dict[str, Any]]:
        """Return real georeferenced Sentinel-1 GeoTIFF files available on disk for quick testing."""
        self._ensure_sample_geotiffs()
        samples: List[Dict[str, Any]] = []
        for ev_id, name, pre_iso, post_iso in self._SAMPLE_CATALOG_SPECS:
            pre_dual = SAMPLE_UPLOADS_DIR / f"{ev_id}_sentinel1_pre_dualpol_vv_vh_db.tif"
            post_dual = SAMPLE_UPLOADS_DIR / f"{ev_id}_sentinel1_post_dualpol_vv_vh_db.tif"
            if pre_dual.exists() and post_dual.exists():
                samples.append(
                    {
                        "sample_id": f"{ev_id}_DUALPOL",
                        "title": f"{ev_id} ({name}) — Sentinel-1 Dual-Pol (VV+VH) Pre/Post GeoTIFF Pair",
                        "event_id": ev_id,
                        "sensor": "Sentinel-1 C-band RTC (20 m)",
                        "bands": ["VV_dB", "VH_dB"],
                        "compatible_models": ["unet", "lightgbm", "log_ratio", "cusum"],
                        "pre_file": str(pre_dual.relative_to(PROJECT_ROOT)).replace("\\", "/"),
                        "post_file": str(post_dual.relative_to(PROJECT_ROOT)).replace("\\", "/"),
                        "pre_date": pre_iso[:10],
                        "post_date": post_iso[:10],
                    }
                )
        for ev_id, name, pre_iso, post_iso in self._SAMPLE_CATALOG_SPECS:
            geo_dir = PROJECT_ROOT / "outputs" / "runs" / "run_20261114_025000_phase_g" / "geospatial" / ev_id
            pre_vh = geo_dir / "pre_fire_vh_db.tif"
            post_vh = geo_dir / "post_fire_vh_db.tif"
            if pre_vh.exists() and post_vh.exists():
                samples.append(
                    {
                        "sample_id": f"{ev_id}_VH_SINGLE",
                        "title": f"{ev_id} ({name}) — Sentinel-1 Single-Band VH Pre/Post GeoTIFF Pair",
                        "event_id": ev_id,
                        "sensor": "Sentinel-1 C-band RTC (20 m)",
                        "bands": ["VH_dB"],
                        "compatible_models": ["log_ratio", "unet", "lightgbm"],
                        "pre_file": str(pre_vh.relative_to(PROJECT_ROOT)).replace("\\", "/"),
                        "post_file": str(post_vh.relative_to(PROJECT_ROOT)).replace("\\", "/"),
                        "pre_date": pre_iso[:10],
                        "post_date": post_iso[:10],
                    }
                )
        return samples

    def validate_and_store_upload(
        self,
        filename: str,
        content: bytes,
        role: str = "single",
        sensor_hint: Optional[str] = None,
        acquisition_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Validate an uploaded file, store it under outputs/uploads/{upload_id}, and return metadata."""
        if not filename:
            raise ValueError("Uploaded file must have a filename.")
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file extension '{ext}'. Allowed formats: .tif, .tiff (GeoTIFF), .npz (SAR stack)."
            )
        if len(content) == 0:
            raise ValueError("Uploaded file is empty (0 bytes).")
        if len(content) > MAX_UPLOAD_BYTES:
            raise ValueError(f"Uploaded file exceeds maximum size of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")

        upload_id = f"upl_{uuid.uuid4().hex[:10]}"
        upload_dir = UPLOADS_DIR / upload_id
        upload_dir.mkdir(parents=True, exist_ok=True)

        safe_name = Path(filename).name
        saved_path = upload_dir / safe_name
        saved_path.write_bytes(content)
        sha256_hex = _sha256_bytes(content)

        # Case 1: Ordinary RGB image (.png / .jpg / .jpeg) -> inspect and explicitly reject for SAR models
        if ext in RGB_IMAGE_EXTENSIONS:
            return self._inspect_rgb_image(upload_id, safe_name, saved_path, len(content), sha256_hex, role)

        # Case 2: Prepared NumPy stack (.npz)
        if ext == ".npz":
            return self._inspect_npz_stack(
                upload_id, safe_name, saved_path, len(content), sha256_hex, role, sensor_hint, acquisition_date
            )

        # Case 3: GeoTIFF (.tif / .tiff)
        return self._inspect_geotiff(
            upload_id, safe_name, saved_path, len(content), sha256_hex, role, sensor_hint, acquisition_date
        )

    def register_local_sample_file(
        self,
        rel_path: str,
        role: str = "pre",
        acquisition_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Register an existing repository GeoTIFF sample as an upload record without duplicating large files."""
        cand = (PROJECT_ROOT / rel_path).resolve()
        if not cand.exists() or not str(cand).startswith(str(PROJECT_ROOT.resolve())):
            raise FileNotFoundError(f"Sample raster not found inside repository: {rel_path}")
        content = cand.read_bytes()
        return self.validate_and_store_upload(
            cand.name,
            content,
            role=role,
            acquisition_date=acquisition_date,
        )

    def _inspect_rgb_image(
        self,
        upload_id: str,
        filename: str,
        saved_path: Path,
        size_bytes: int,
        sha256_hex: str,
        role: str,
    ) -> Dict[str, Any]:
        width, height, channels = 0, 0, 0
        try:
            img = plt.imread(saved_path)
            if img.ndim == 2:
                height, width = img.shape
                channels = 1
            elif img.ndim == 3:
                height, width, channels = img.shape
        except Exception as exc:
            raise ValueError(f"Corrupted or unreadable image file '{filename}': {exc}") from exc

        record = _build_rejected_rgb_record(
            upload_id=upload_id,
            filename=filename,
            role=role,
            file_format="RGB_DISPLAY_IMAGE",
            size_bytes=size_bytes,
            sha256_hex=sha256_hex,
            width=width,
            height=height,
            channels=channels,
            scientific_explanation=(
                "Ordinary 3-band 8-bit RGB images (PNG/JPEG) contain uncalibrated display color values (0–255) "
                "without radar polarizations (VV/VH), calibrated backscatter (gamma0/sigma0 in dB), or a "
                "Coordinate Reference System (CRS). The trained UNet_ResNet34 (5-channel SAR dB) and "
                "LightGBM_Pixel_Spatial (10-feature SAR dB) models require calibrated georeferenced SAR GeoTIFF "
                "(.tif/.tiff) or multi-band SAR (.npz) inputs."
            ),
            warnings=[
                "No Coordinate Reference System (CRS) or affine geotransform present.",
                "RGB optical channels cannot be substituted for microwave C-band/L-band SAR polarizations.",
            ],
        )
        (saved_path.parent / "metadata.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
        return record

    def _inspect_npz_stack(
        self,
        upload_id: str,
        filename: str,
        saved_path: Path,
        size_bytes: int,
        sha256_hex: str,
        role: str,
        sensor_hint: Optional[str],
        acquisition_date: Optional[str],
    ) -> Dict[str, Any]:
        try:
            with np.load(saved_path, allow_pickle=False) as data:
                keys = list(data.files)
                has_paired_sar = all(k in keys for k in ("pre_vv", "pre_vh", "post_vv", "post_vh"))
                if not has_paired_sar:
                    raise ValueError(
                        f"NPZ archive must contain paired SAR arrays ('pre_vv', 'pre_vh', 'post_vv', 'post_vh'); found {keys}"
                    )
                pre_vh = data["pre_vh"]
                post_vh = data["post_vh"]
                valid = data["valid"] > 0 if "valid" in keys else np.isfinite(pre_vh) & np.isfinite(post_vh)
                height, width = pre_vh.shape
                pre_vh_db, scale_detected = _to_db_auto(pre_vh)
                post_vh_db, _ = _to_db_auto(post_vh)
                delta_vh_db = post_vh_db - pre_vh_db
                temporal_count = sum(1 for k in keys if k.startswith("temporal_") and k.endswith("_vh"))
        except Exception as exc:
            raise ValueError(f"Invalid or unreadable .npz SAR stack '{filename}': {exc}") from exc

        preview_path = saved_path.parent / "preview.png"
        _render_preview_png(np.where(valid, post_vh_db, np.nan), preview_path, cmap="viridis")

        compatible_models = ["unet", "lightgbm", "log_ratio"]
        if temporal_count >= 3:
            compatible_models.append("cusum")

        valid_pct = round(float(np.mean(valid)) * 100.0, 2)
        record = {
            "upload_id": upload_id,
            "filename": filename,
            "role": "stacked_pair",
            "file_format": "NPZ_SAR_STACK",
            "file_size_bytes": size_bytes,
            "sha256": sha256_hex,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "is_valid": True,
            "valid_for_sar_inference": True,
            "validation_status": "VALID_PAIRED_SAR_NPZ_STACK",
            "error_code": None,
            "scientific_explanation": (
                f"Valid co-registered multi-band SAR stack ({width}x{height}) containing pre_vv, pre_vh, post_vv, post_vh "
                f"({scale_detected}). Ready for UNet_ResNet34, LightGBM_Pixel_Spatial, and Log_Ratio_Baseline."
            ),
            "sensor": sensor_hint or "Sentinel-1 C-band RTC (20 m)",
            "acquisition_date": acquisition_date,
            "crs": "EPSG:32610",
            "bounds": None,
            "bounds_wgs84": None,
            "width": width,
            "height": height,
            "band_count": 4,
            "bands": ["pre_vv", "pre_vh", "post_vv", "post_vh"],
            "polarizations": ["VV", "VH"],
            "radiometric_scale": scale_detected,
            "resolution_m": 20.0,
            "nodata": None,
            "valid_pixel_percentage": valid_pct,
            "band_statistics": [
                {
                    "band": "pre_vh_db",
                    "mean": round(float(np.nanmean(pre_vh_db[valid])), 3) if np.any(valid) else 0.0,
                    "std": round(float(np.nanstd(pre_vh_db[valid])), 3) if np.any(valid) else 0.0,
                },
                {
                    "band": "post_vh_db",
                    "mean": round(float(np.nanmean(post_vh_db[valid])), 3) if np.any(valid) else 0.0,
                    "std": round(float(np.nanstd(post_vh_db[valid])), 3) if np.any(valid) else 0.0,
                },
                {
                    "band": "delta_vh_db",
                    "mean": round(float(np.nanmean(delta_vh_db[valid])), 3) if np.any(valid) else 0.0,
                    "std": round(float(np.nanstd(delta_vh_db[valid])), 3) if np.any(valid) else 0.0,
                },
            ],
            "compatible_models": compatible_models,
            "warnings": [],
            "preview_url": f"/api/analysis/uploads/{upload_id}/preview.png",
            "local_path": str(saved_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        }
        (saved_path.parent / "metadata.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
        return record

    def _inspect_geotiff(
        self,
        upload_id: str,
        filename: str,
        saved_path: Path,
        size_bytes: int,
        sha256_hex: str,
        role: str,
        sensor_hint: Optional[str],
        acquisition_date: Optional[str],
    ) -> Dict[str, Any]:
        try:
            with rasterio.open(saved_path) as src:
                crs_str = str(src.crs) if src.crs else None
                width, height = src.width, src.height
                count = src.count
                dtypes = [str(dt) for dt in src.dtypes]
                nodata = src.nodata
                transform = list(src.transform)[:6]
                bounds = [float(src.bounds.left), float(src.bounds.bottom), float(src.bounds.right), float(src.bounds.top)]
                res_x = abs(float(src.transform.a))
                res_y = abs(float(src.transform.e))
                descriptions = [src.descriptions[i] or f"Band_{i+1}" for i in range(count)]
                tags = dict(src.tags())
                color_interp = list(src.colorinterp) if hasattr(src, "colorinterp") else []
                is_geographic = bool(src.crs and src.crs.is_geographic)

                bounds_wgs84 = None
                if src.crs:
                    try:
                        w, s, e, n = transform_bounds(src.crs, "EPSG:4326", *src.bounds, densify_pts=21)
                        bounds_wgs84 = [round(float(w), 6), round(float(s), 6), round(float(e), 6), round(float(n), 6)]
                    except Exception:
                        bounds_wgs84 = None

                if is_geographic or (res_x > 0 and res_x < 0.05 and crs_str and "4326" in crs_str):
                    lat_deg = 0.5 * (bounds_wgs84[1] + bounds_wgs84[3]) if bounds_wgs84 else 0.0
                    m_per_deg_lat = 111132.92
                    m_per_deg_lon = max(111412.84 * math.cos(math.radians(lat_deg)), 1.0)
                    res_m = round(math.sqrt(max(res_x * m_per_deg_lon, 1e-6) * max(res_y * m_per_deg_lat, 1e-6)), 2)
                else:
                    res_m = round(math.sqrt(max(res_x * res_y, 1e-12)), 2) if res_x > 0 else None

                band_arrays: List[np.ndarray] = []
                band_stats: List[Dict[str, Any]] = []
                for b_idx in range(1, count + 1):
                    raw = src.read(b_idx).astype(np.float32)
                    if nodata is not None:
                        if math.isnan(float(nodata)):
                            valid_b = np.isfinite(raw)
                        else:
                            valid_b = np.isfinite(raw) & (np.abs(raw - float(nodata)) > 1e-5)
                    else:
                        valid_b = np.isfinite(raw) & (raw != -9999.0)
                    clean = np.where(valid_b, raw, np.nan)
                    band_arrays.append(clean)
                    vals = clean[valid_b]
                    band_stats.append(
                        {
                            "band_index": b_idx,
                            "description": descriptions[b_idx - 1],
                            "dtype": dtypes[b_idx - 1],
                            "valid_pixels": int(np.count_nonzero(valid_b)),
                            "valid_percentage": round(float(np.mean(valid_b)) * 100.0, 2),
                            "min": round(float(np.min(vals)), 4) if vals.size else None,
                            "max": round(float(np.max(vals)), 4) if vals.size else None,
                            "mean": round(float(np.mean(vals)), 4) if vals.size else None,
                            "std": round(float(np.std(vals)), 4) if vals.size else None,
                        }
                    )
        except Exception as exc:
            raise ValueError(f"Corrupted or unreadable GeoTIFF file '{filename}': {exc}") from exc

        name_lower = filename.lower()
        desc_joined = " ".join(descriptions).upper()
        tags_pol = tags.get("POLARIZATIONS", "").upper()
        sar_tokens = ("vv", "vh", "hh", "hv", "gamma0", "sigma0", "sar", "rtc", "_db")
        has_sar_token = any(tok in name_lower or tok in desc_joined.lower() for tok in sar_tokens) or bool(tags_pol)
        has_rgb_interp = len(color_interp) >= 3 and (
            ColorInterp.red in color_interp[:3]
            and ColorInterp.green in color_interp[:3]
            and ColorInterp.blue in color_interp[:3]
        )
        is_optical_rgb_tif = (
            count in (3, 4)
            and all(dt == "uint8" for dt in dtypes[:3])
            and (has_rgb_interp or not has_sar_token)
        )
        extracted_date = acquisition_date or _extract_date_from_metadata(tags, filename)

        if is_optical_rgb_tif:
            record = _build_rejected_rgb_record(
                upload_id=upload_id,
                filename=filename,
                role=role,
                file_format="OPTICAL_RGB_GEOTIFF",
                size_bytes=size_bytes,
                sha256_hex=sha256_hex,
                width=width,
                height=height,
                channels=count,
                crs=crs_str,
                bounds=bounds,
                bounds_wgs84=bounds_wgs84,
                dtypes=dtypes,
                acquisition_date=extracted_date,
                scientific_explanation=(
                    f"Uploaded GeoTIFF '{filename}' is a {count}-band uint8 optical RGB raster without calibrated "
                    "SAR radar polarizations (VV/VH) or backscatter (dB / gamma0). Optical RGB bands cannot be "
                    "fed into SAR models (UNet_ResNet34, LightGBM_Pixel_Spatial, Log_Ratio_Baseline, CUSUM_Temporal)."
                ),
                warnings=[
                    f"Detected {count}-band uint8 RGB optical raster ({', '.join(descriptions)}).",
                    "Sentinel-1/NISAR SAR GeoTIFF (float32 dB or calibrated linear gamma0/sigma0) is required.",
                ],
            )
            (saved_path.parent / "metadata.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
            return record

        # Determine overall valid pixel mask across bands
        valid_mask = np.ones((height, width), dtype=bool)
        for arr in band_arrays:
            valid_mask &= np.isfinite(arr)
        valid_pct = round(float(np.mean(valid_mask)) * 100.0, 2)

        # Detect polarizations and radiometric scale
        _, scale_detected = _to_db_auto(band_arrays[0])

        if count >= 4:
            polarizations = ["VV", "VH"]
            compatible_models = ["unet", "lightgbm", "log_ratio"]
            inferred_role = "stacked_pair"
        elif count == 2 or ("VV" in desc_joined and "VH" in desc_joined) or ("VV" in tags_pol and "VH" in tags_pol):
            polarizations = ["VV", "VH"]
            compatible_models = ["unet", "lightgbm", "log_ratio"]
            inferred_role = role
        elif "vh" in name_lower or "vh" in desc_joined.lower():
            polarizations = ["VH"]
            compatible_models = ["log_ratio", "unet", "lightgbm"]
            inferred_role = role
        elif "vv" in name_lower or "vv" in desc_joined.lower():
            polarizations = ["VV"]
            compatible_models = ["log_ratio"]
            inferred_role = role
        else:
            polarizations = ["SAR_BAND_1"] if count == 1 else [f"BAND_{i+1}" for i in range(count)]
            compatible_models = ["log_ratio"] if count == 1 else ["unet", "lightgbm", "log_ratio"]
            inferred_role = role

        # Check if this GeoTIFF matches one of our known catalog events (e.g. CA_BUG_2026)
        matched_event_id = tags.get("EVENT_ID")
        if not matched_event_id:
            for cand_ev in ("CA_BUG_2026", "CA_DOME_2026", "CA_GANN_2026", "CA_TIMBER_2026"):
                if cand_ev.lower() in name_lower:
                    matched_event_id = cand_ev
                    break

        warnings: List[str] = []
        if crs_str is None:
            warnings.append("GeoTIFF does not declare an EPSG/WKT Coordinate Reference System (CRS).")
        if valid_pct < 10.0:
            warnings.append(f"Low valid pixel coverage ({valid_pct}% valid non-NoData pixels).")
        if count == 1 and not matched_event_id:
            warnings.append(
                "Single-band SAR GeoTIFF uploaded: directly supports Log_Ratio_Baseline; "
                "UNet_ResNet34 and LightGBM_Pixel_Spatial require dual-polarization (VV + VH) or a known event stack."
            )
        if band_stats and band_stats[0].get("std") == 0.0:
            warnings.append("Raster variance is 0.0 across valid pixels (uniform/constant signal).")

        preview_band = band_arrays[-1] if count >= 2 else band_arrays[0]
        preview_path = saved_path.parent / "preview.png"
        _render_preview_png(preview_band, preview_path, cmap="viridis")

        is_valid = crs_str is not None and valid_pct > 0.0 and width >= 16 and height >= 16
        record = {
            "upload_id": upload_id,
            "filename": filename,
            "role": inferred_role,
            "file_format": "GEOTIFF",
            "file_size_bytes": size_bytes,
            "sha256": sha256_hex,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "is_valid": is_valid,
            "valid_for_sar_inference": is_valid,
            "validation_status": "VALID_GEOTIFF" if is_valid else "INVALID_GEOTIFF_METADATA",
            "error_code": None if is_valid else "MISSING_CRS_OR_EMPTY_RASTER",
            "scientific_explanation": (
                f"Georeferenced GeoTIFF ({width}×{height} px, {count} band{'s' if count > 1 else ''}, "
                f"CRS={crs_str}, resolution={res_m} m, {valid_pct}% valid pixels, scale={scale_detected})."
            ),
            "sensor": sensor_hint or tags.get("SENSOR", "Sentinel-1 C-band RTC"),
            "acquisition_date": extracted_date,
            "matched_event_id": matched_event_id,
            "crs": crs_str,
            "transform": transform,
            "bounds": bounds,
            "bounds_wgs84": bounds_wgs84,
            "width": width,
            "height": height,
            "band_count": count,
            "bands": descriptions,
            "dtypes": dtypes,
            "polarizations": polarizations,
            "radiometric_scale": scale_detected,
            "resolution_m": res_m,
            "nodata": nodata,
            "valid_pixel_percentage": valid_pct,
            "band_statistics": band_stats,
            "compatible_models": compatible_models,
            "warnings": warnings,
            "preview_url": f"/api/analysis/uploads/{upload_id}/preview.png",
            "local_path": str(saved_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        }
        (saved_path.parent / "metadata.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
        return record

    def get_upload_metadata(self, upload_id: str) -> Dict[str, Any]:
        meta_path = UPLOADS_DIR / upload_id / "metadata.json"
        if not meta_path.exists():
            raise KeyError(f"Upload ID '{upload_id}' not found.")
        return json.loads(meta_path.read_text(encoding="utf-8"))

    def list_uploads(self, limit: int = 30) -> List[Dict[str, Any]]:
        records: List[Dict[str, Any]] = []
        for meta_file in sorted(UPLOADS_DIR.glob("upl_*/metadata.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                records.append(json.loads(meta_file.read_text(encoding="utf-8")))
                if len(records) >= limit:
                    break
            except Exception:
                continue
        return records

    def get_upload_preview_path(self, upload_id: str) -> Path:
        preview_path = UPLOADS_DIR / upload_id / "preview.png"
        if not preview_path.exists():
            raise FileNotFoundError(f"Preview PNG not found for upload '{upload_id}'.")
        return preview_path

    def list_compatible_references(
        self,
        upload_id: Optional[str] = None,
        role_needed: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List real repository reference GeoTIFFs ranked by geographic overlap & polarization match."""
        samples = self.list_sample_files()
        upload_meta: Optional[Dict[str, Any]] = None
        if upload_id:
            upload_meta = self.get_upload_metadata(upload_id)

        target_role = (role_needed or "").strip().lower()
        if not target_role and upload_meta:
            up_role = str(upload_meta.get("role", "")).lower()
            target_role = "post" if up_role in ("pre", "pre_fire") else "pre"
        if target_role not in ("pre", "post"):
            target_role = "post"

        candidates: List[Dict[str, Any]] = []
        up_bounds = upload_meta.get("bounds_wgs84") if upload_meta else None
        up_crs = upload_meta.get("crs") if upload_meta else None
        up_date = _normalize_iso_day(upload_meta.get("acquisition_date")) if upload_meta else None
        up_bands = upload_meta.get("band_count", 1) if upload_meta else 1

        for s in samples:
            rel_file = s["post_file"] if target_role == "post" else s["pre_file"]
            ref_date = s.get("post_date") if target_role == "post" else s.get("pre_date")
            abs_file = PROJECT_ROOT / rel_file
            if not abs_file.exists():
                continue

            fp = self._read_geotiff_footprint(abs_file)
            overlap_pct = _compute_wgs84_overlap_pct(up_bounds, fp.get("bounds_wgs84")) if upload_meta else 100.0
            crs_match = (up_crs == fp.get("crs")) if (upload_meta and up_crs) else True

            cand_day = _normalize_iso_day(ref_date)
            date_order_valid = True
            if up_date and cand_day:
                if target_role == "post":
                    date_order_valid = up_date < cand_day
                else:
                    date_order_valid = cand_day < up_date

            is_dual = fp.get("band_count", 1) >= 2 and (not upload_meta or up_bands >= 2)
            recommended = bool((not upload_meta or overlap_pct >= 25.0) and date_order_valid)
            note = (
                f"Real {s['sensor']} acquisition ({fp.get('width')}x{fp.get('height')}, {len(s['bands'])} band(s))"
            )
            if upload_meta:
                if overlap_pct >= 25.0:
                    note = f"{overlap_pct:.1f}% spatial overlap with uploaded raster; " + (
                        "CRS matches" if crs_match else "auto-coregistration available"
                    )
                else:
                    note = f"Separate region ({overlap_pct:.1f}% spatial overlap — <25% minimum required for pairing)."

            candidates.append(
                {
                    "sample_id": s["sample_id"],
                    "title": s["title"],
                    "event_id": s["event_id"],
                    "role_provided": target_role,
                    "file_path": rel_file,
                    "sensor": s["sensor"],
                    "bands": s["bands"],
                    "polarizations": ["VV", "VH"] if fp.get("band_count", 1) >= 2 else ["VH"],
                    "acquisition_date": ref_date,
                    "crs": fp.get("crs"),
                    "bounds_wgs84": fp.get("bounds_wgs84"),
                    "width": fp.get("width"),
                    "height": fp.get("height"),
                    "overlap_percent": overlap_pct,
                    "crs_match": crs_match,
                    "date_order_valid": date_order_valid,
                    "dual_polarization_match": is_dual,
                    "recommended": recommended,
                    "compatibility_note": note,
                }
            )

        candidates.sort(
            key=lambda c: (
                1 if c["recommended"] else 0,
                round(float(c["overlap_percent"]), 2),
                1 if c["dual_polarization_match"] else 0,
            ),
            reverse=True,
        )
        return candidates

    def validate_and_align_pair(
        self,
        pre_upload_id: str,
        post_upload_id: str,
        auto_coregister: bool = True,
        pre_date: Optional[str] = None,
        post_date: Optional[str] = None,
        area_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Validate a Before vs. After upload pair and co-register onto a common grid if needed."""
        pre_meta = self.get_upload_metadata(pre_upload_id)
        post_meta = self.get_upload_metadata(post_upload_id)

        reasons: List[str] = []
        warnings: List[str] = []

        if not pre_meta.get("valid_for_sar_inference"):
            reasons.append(f"Pre-fire image '{pre_meta['filename']}' is not a valid georeferenced SAR raster.")
        if not post_meta.get("valid_for_sar_inference"):
            reasons.append(f"Post-fire image '{post_meta['filename']}' is not a valid georeferenced SAR raster.")

        if reasons:
            return {
                "pair_id": f"pair_{uuid.uuid4().hex[:10]}",
                "pre_upload_id": pre_upload_id,
                "post_upload_id": post_upload_id,
                "compatible": False,
                "status": "UNSUITABLE",
                "reasons": reasons,
                "warnings": warnings,
                "compatible_models": [],
            }

        pre_crs = pre_meta.get("crs")
        post_crs = post_meta.get("crs")
        crs_match = pre_crs == post_crs and pre_crs is not None

        # Compute spatial overlap in WGS84
        overlap_pct = 100.0
        b1 = pre_meta.get("bounds_wgs84")
        b2 = post_meta.get("bounds_wgs84")
        if b1 and b2:
            overlap_pct = _compute_wgs84_overlap_pct(b1, b2)
            if overlap_pct <= 0.0:
                reasons.append("NO_SPATIAL_OVERLAP: Pre-fire and Post-fire bounding boxes do not intersect.")
            elif overlap_pct < 25.0:
                reasons.append(f"INSUFFICIENT_OVERLAP: Spatial overlap is only {overlap_pct:.1f}% (< 25% required).")

        dims_match = (pre_meta["width"] == post_meta["width"]) and (pre_meta["height"] == post_meta["height"])
        transform_match = pre_meta.get("transform") == post_meta.get("transform")
        res_match = pre_meta.get("resolution_m") == post_meta.get("resolution_m")

        # Polarization compatibility check between Pre and Post
        pre_bands = int(pre_meta.get("band_count") or 1)
        post_bands = int(post_meta.get("band_count") or 1)
        if pre_bands != post_bands:
            warnings.append(
                f"Polarization count differs (Pre: {pre_bands} band(s), Post: {post_bands} band(s)); "
                "using common VH/single-band change channels unless matched to a catalog dual-pol stack."
            )

        # Temporal ordering check if both dates are known (prefers confirmed dates over embedded tags)
        resolved_pre_date = (pre_date or pre_meta.get("acquisition_date") or "").strip() or None
        resolved_post_date = (post_date or post_meta.get("acquisition_date") or "").strip() or None
        pre_day = _normalize_iso_day(resolved_pre_date)
        post_day = _normalize_iso_day(resolved_post_date)
        date_order_valid = True
        if pre_day and post_day and pre_day >= post_day:
            date_order_valid = False
            reasons.append(
                f"DATE_ORDER_INVALID: Pre-fire acquisition date ({pre_day}) must be strictly earlier than Post-fire acquisition date ({post_day})."
            )

        pair_id = f"pair_{uuid.uuid4().hex[:10]}"
        pair_dir = PAIRS_DIR / pair_id
        pair_dir.mkdir(parents=True, exist_ok=True)

        co_registered = False
        aligned_post_path = PROJECT_ROOT / post_meta["local_path"]

        if not reasons and (not crs_match or not dims_match or not transform_match):
            if auto_coregister and pre_meta["file_format"] == "GEOTIFF" and post_meta["file_format"] == "GEOTIFF":
                aligned_post_file = pair_dir / f"coregistered_{post_meta['filename']}"
                self._coregister_geotiff(
                    PROJECT_ROOT / pre_meta["local_path"],
                    PROJECT_ROOT / post_meta["local_path"],
                    aligned_post_file,
                )
                aligned_post_path = aligned_post_file
                co_registered = True
                warnings.append(
                    "Post-fire raster was automatically reprojected and co-registered onto the Pre-fire reference UTM grid."
                )
            else:
                reasons.append("GRID_MISMATCH: Rasters have different CRS, resolution, or dimensions and auto_coregister=False.")

        has_dual_pol = (
            (pre_bands >= 2 and post_bands >= 2)
            or bool(pre_meta.get("matched_event_id") and pre_meta.get("matched_event_id") == post_meta.get("matched_event_id"))
        )
        compatible_models = ["unet", "lightgbm", "log_ratio"] if has_dual_pol else ["log_ratio"]
        if has_dual_pol and (pre_meta.get("matched_event_id") or post_meta.get("matched_event_id")):
            compatible_models.append("cusum")

        compatible = len(reasons) == 0
        pair_record = {
            "pair_id": pair_id,
            "pre_upload_id": pre_upload_id,
            "post_upload_id": post_upload_id,
            "pre_filename": pre_meta["filename"],
            "post_filename": post_meta["filename"],
            "pre_date": resolved_pre_date,
            "post_date": resolved_post_date,
            "area_name": (area_name or "").strip() or None,
            "compatible": compatible,
            "status": "SUITABLE" if compatible else "UNSUITABLE",
            "checks": {
                "crs_match": crs_match,
                "pre_crs": pre_crs,
                "post_crs": post_crs,
                "spatial_overlap_percent": overlap_pct,
                "dimensions_match": dims_match,
                "transform_match": transform_match,
                "resolution_match": res_match,
                "date_order_valid": date_order_valid,
                "co_registered": co_registered,
                "dual_polarization_available": has_dual_pol,
            },
            "target_grid": {
                "crs": pre_crs,
                "width": pre_meta["width"],
                "height": pre_meta["height"],
                "resolution_m": pre_meta["resolution_m"],
                "bounds": pre_meta["bounds"],
                "bounds_wgs84": pre_meta["bounds_wgs84"],
                "transform": pre_meta.get("transform"),
            },
            "pre_local_path": pre_meta["local_path"],
            "post_local_path": str(aligned_post_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "matched_event_id": pre_meta.get("matched_event_id") or post_meta.get("matched_event_id"),
            "compatible_models": compatible_models if compatible else [],
            "reasons": reasons,
            "warnings": warnings,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
        }
        (pair_dir / "pair_metadata.json").write_text(json.dumps(pair_record, indent=2), encoding="utf-8")
        return pair_record

    def get_pair_metadata(self, pair_id: str) -> Dict[str, Any]:
        meta_path = PAIRS_DIR / pair_id / "pair_metadata.json"
        if not meta_path.exists():
            raise KeyError(f"Pair ID '{pair_id}' not found.")
        return json.loads(meta_path.read_text(encoding="utf-8"))

    def _coregister_geotiff(self, ref_path: Path, src_path: Path, dst_path: Path) -> None:
        with rasterio.open(ref_path) as ref_ds, rasterio.open(src_path) as src_ds:
            profile = ref_ds.profile.copy()
            profile.update(
                count=src_ds.count,
                dtype="float32",
                nodata=-9999.0,
                compress="deflate",
            )
            with rasterio.open(dst_path, "w", **profile) as dst_ds:
                for b_idx in range(1, src_ds.count + 1):
                    dst_arr = np.full((ref_ds.height, ref_ds.width), -9999.0, dtype=np.float32)
                    reproject(
                        source=rasterio.band(src_ds, b_idx),
                        destination=dst_arr,
                        src_transform=src_ds.transform,
                        src_crs=src_ds.crs,
                        src_nodata=src_ds.nodata,
                        dst_transform=ref_ds.transform,
                        dst_crs=ref_ds.crs,
                        dst_nodata=-9999.0,
                        resampling=Resampling.bilinear,
                    )
                    dst_ds.write(dst_arr, b_idx)
                    if src_ds.descriptions[b_idx - 1]:
                        dst_ds.set_band_description(b_idx, src_ds.descriptions[b_idx - 1])
