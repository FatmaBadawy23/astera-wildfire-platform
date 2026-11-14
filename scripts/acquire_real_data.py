"""Acquire real, open wildfire pre/post data from Microsoft Planetary Computer.

What this script does
---------------------
For each verified event in ``backend/processing/acquisition/event_specs.py``:

1. Builds a 20 m UTM analysis grid centred on the MCD64A1 burn-scar centroid.
2. Selects Sentinel-1 RTC granules on the same relative orbit and pass for each
   requested date, reading only the AOI window.
3. Selects low-cloud Sentinel-2 L2A acquisitions for pre/post NBR.
4. Reads MCD64A1 ``Burn_Date`` and builds a burn mask for the event window.
5. Writes aligned arrays, a provenance manifest with STAC item IDs and checksums, and
   QA previews.

No full granules are downloaded and no credentials are used. NISAR is deliberately not
requested here: NISAR science data requires Earthdata Login and is handled separately.

Usage
-----
    python scripts/acquire_real_data.py --event all
    python scripts/acquire_real_data.py --event CA_BUG_2026 --force
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds
from shapely.geometry import box, shape

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.processing.acquisition.event_specs import EVENTS, EVENTS_BY_ID, EventSpec
from backend.processing.acquisition.planetary_computer import (
    asset_href,
    item_datetime,
    sign_href,
    stac_search,
)
from backend.processing.preprocessing.grid import (
    build_local_grid,
    grid_metadata,
    read_mcd_burn_date_to_grid,
    read_to_grid,
    valid_fraction,
    write_geotiff,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("acquire-real")

S1_COLLECTION = "sentinel-1-rtc"
S2_COLLECTION = "sentinel-2-l2a"
MCD_COLLECTION = "modis-64A1-061"


def sha256_array(array: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(array).tobytes()).hexdigest()


def geographic_bbox(grid) -> Tuple[float, float, float, float]:
    return tuple(transform_bounds(grid.crs, "EPSG:4326", *grid.bounds))


def _aoi_for(event: EventSpec):
    return box(
        event.center_lon - 0.35,
        event.center_lat - 0.35,
        event.center_lon + 0.35,
        event.center_lat + 0.35,
    )


def _coverage(item: Dict[str, Any], aoi) -> float:
    geometry = item.get("geometry")
    if not geometry:
        return 0.0
    try:
        return float(shape(geometry).intersection(aoi).area / aoi.area)
    except Exception:
        return 0.0


def select_s1_item(
    items: List[Dict[str, Any]],
    target_date: str,
    relative_orbit: int,
    orbit_pass: str,
    aoi,
) -> Optional[Dict[str, Any]]:
    candidates = [
        item
        for item in items
        if item_datetime(item)[:10] == target_date
        and item.get("properties", {}).get("sat:relative_orbit") == relative_orbit
        and item.get("properties", {}).get("sat:orbit_state") == orbit_pass
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda item: _coverage(item, aoi))


def select_s2_item(
    items: List[Dict[str, Any]],
    target_date: str,
    aoi,
    grid,
) -> Optional[Dict[str, Any]]:
    """Pick the Sentinel-2 item with the most usable (cloud-free) data over the AOI.

    Scene-wide cloud cover and footprint geometry are not sufficient: a tile can have a
    low cloud percentage and still be half-filled with no-data at a swath edge. We read
    the 20 m SCL band for the handful of candidates and score on the fraction of usable
    classes (vegetation/bare/water/unclassified).
    """
    candidates = [item for item in items if item_datetime(item)[:10] == target_date]
    if not candidates:
        return None
    scored = []
    for item in candidates[:8]:
        try:
            scl = read_to_grid(
                asset_href(item, "SCL"),
                grid,
                resampling=Resampling.nearest,
                dtype="uint8",
                collection=S2_COLLECTION,
            )
            valid = float(np.isin(scl, (4, 5, 6, 7)).mean())
        except Exception as exc:
            logger.debug("SCL read failed for %s: %s", item.get("id"), exc)
            valid = 0.0
        scored.append(
            (
                valid,
                _coverage(item, aoi),
                -float(item.get("properties", {}).get("eo:cloud_cover", 100.0)),
                item,
            )
        )
    return max(scored, key=lambda entry: (entry[0], entry[1], entry[2]))[3]


def _reflectance_scale(item: Dict[str, Any], asset_key: str) -> Tuple[float, float]:
    """Return (scale, offset) for a Sentinel-2 asset.

    Planetary Computer publishes L2A values as integer reflectance * 10000. The BOA
    offset (-1000) is applied when the asset metadata states it.
    """
    bands = item.get("assets", {}).get(asset_key, {}).get("raster:bands", [])
    if bands:
        band = bands[0]
        scale = float(band.get("scale", 0.0001))
        offset = float(band.get("offset", 0.0))
        return scale, offset
    return 1.0 / 10000.0, 0.0


def acquire_event(event: EventSpec, out_root: Path, half_size_m: float, force: bool) -> Dict[str, Any]:
    event_dir = out_root / event.event_id
    stack_path = event_dir / "stack.npz"
    if stack_path.exists() and not force:
        logger.info("%s already acquired (use --force to refresh)", event.event_id)
        with open(event_dir / "metadata.json", "r", encoding="utf-8") as handle:
            return json.load(handle)

    event_dir.mkdir(parents=True, exist_ok=True)
    grid = build_local_grid(event.center_lon, event.center_lat, half_size_m=half_size_m, res_m=20.0)
    bbox_geo = geographic_bbox(grid)
    aoi = _aoi_for(event)
    logger.info("%s grid %s %dx%d bounds=%s", event.event_id, grid.crs, grid.width, grid.height, grid.bounds)

    arrays: Dict[str, np.ndarray] = {}
    record: Dict[str, Any] = {
        "event": event.to_dict(),
        "grid": grid_metadata(grid),
        "sensor": "Sentinel-1 RTC (C-band) + Sentinel-2 L2A + MCD64A1",
        "data_origin": "CROSS_SENSOR_PROTOTYPE",
        "is_nisar": False,
        "acquired_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "s1": [],
        "s2": [],
        "mcd64a1": [],
        "qc": {},
    }

    # ---------------- Sentinel-1 RTC ----------------
    s1_dates = sorted({request.date for request in event.s1_dates})
    search_start = (date.fromisoformat(s1_dates[0]) - timedelta(days=2)).isoformat()
    search_end = (date.fromisoformat(s1_dates[-1]) + timedelta(days=2)).isoformat()
    s1_items = stac_search(S1_COLLECTION, bbox_geo, f"{search_start}/{search_end}", limit=200)
    logger.info("%s S1 candidates: %d", event.event_id, len(s1_items))

    for request in event.s1_dates:
        item = select_s1_item(s1_items, request.date, event.s1_relative_orbit, event.s1_pass, aoi)
        if item is None:
            record["qc"].setdefault("missing", []).append(f"S1 {request.role} {request.date}")
            logger.warning("%s missing S1 %s %s", event.event_id, request.role, request.date)
            continue
        for pol in ("vv", "vh"):
            href = asset_href(item, pol)
            array = read_to_grid(
                href, grid, resampling=Resampling.average, dtype="float32", collection=S1_COLLECTION
            )
            # RTC fill values are <= 0; treat them as missing rather than -inf dB.
            array = np.where(array > 0, array, np.nan).astype(np.float32)
            key = f"s1_{request.role}_{pol}"
            arrays[key] = array
        record["s1"].append(
            {
                "role": request.role,
                "requested_date": request.date,
                "item_id": item.get("id"),
                "datetime": item_datetime(item),
                "relative_orbit": item["properties"].get("sat:relative_orbit"),
                "orbit_state": item["properties"].get("sat:orbit_state"),
                "platform": item["properties"].get("platform"),
                "assets": {pol: asset_href(item, pol) for pol in ("vv", "vh")},
                "valid_fraction_vh": valid_fraction(arrays[f"s1_{request.role}_vh"]),
                "checksums": {
                    "vv": sha256_array(arrays[f"s1_{request.role}_vv"]),
                    "vh": sha256_array(arrays[f"s1_{request.role}_vh"]),
                },
            }
        )
        logger.info(
            "%s S1 %s %s %s valid VH=%.2f",
            event.event_id,
            request.role,
            request.date,
            item.get("id", "")[:32],
            record["s1"][-1]["valid_fraction_vh"],
        )

    # ---------------- Sentinel-2 L2A ----------------
    s2_dates = sorted({request.date for request in event.s2_dates})
    s2_start = (date.fromisoformat(s2_dates[0]) - timedelta(days=2)).isoformat()
    s2_end = (date.fromisoformat(s2_dates[-1]) + timedelta(days=2)).isoformat()
    s2_items = stac_search(
        S2_COLLECTION,
        bbox_geo,
        f"{s2_start}/{s2_end}",
        limit=200,
        query={"eo:cloud_cover": {"lt": 40}},
    )
    logger.info("%s S2 candidates: %d", event.event_id, len(s2_items))

    for request in event.s2_dates:
        item = select_s2_item(s2_items, request.date, aoi, grid)
        if item is None:
            record["qc"].setdefault("missing", []).append(f"S2 {request.role} {request.date}")
            logger.warning("%s missing S2 %s %s", event.event_id, request.role, request.date)
            continue
        for asset_key, resampling, dtype in (
            ("B04", Resampling.bilinear, "float32"),
            ("B08", Resampling.bilinear, "float32"),
            ("B12", Resampling.bilinear, "float32"),
            ("SCL", Resampling.nearest, "uint8"),
        ):
            scale, offset = _reflectance_scale(item, asset_key)
            if asset_key == "SCL":
                scale, offset = 1.0, 0.0
            array = read_to_grid(
                asset_href(item, asset_key),
                grid,
                resampling=resampling,
                dtype=dtype,
                scale=scale,
                collection=S2_COLLECTION,
            )
            if asset_key != "SCL":
                array = np.where(array > 0, array + offset, np.nan).astype(np.float32)
            arrays[f"s2_{request.role}_{asset_key}"] = array
        record["s2"].append(
            {
                "role": request.role,
                "requested_date": request.date,
                "item_id": item.get("id"),
                "datetime": item_datetime(item),
                "cloud_cover_scene": item["properties"].get("eo:cloud_cover"),
                "scl_valid_fraction": float(
                    np.isin(arrays[f"s2_{request.role}_SCL"], (4, 5, 6, 7)).mean()
                ),
                "assets": {key: asset_href(item, key) for key in ("B04", "B08", "B12", "SCL")},
                "checksums": {
                    "B08": sha256_array(arrays[f"s2_{request.role}_B08"]),
                    "SCL": sha256_array(arrays[f"s2_{request.role}_SCL"]),
                },
            }
        )
        logger.info(
            "%s S2 %s %s %s cloud=%.1f%%",
            event.event_id,
            request.role,
            request.date,
            item.get("id", "")[:32],
            float(item["properties"].get("eo:cloud_cover", -1)),
        )

    # ---------------- MCD64A1 ----------------
    burn_date_total = np.zeros((grid.height, grid.width), dtype=np.int16)
    for item_id in event.mcd_items:
        items = stac_search(MCD_COLLECTION, bbox_geo, "2026-01-01/2026-12-31", limit=10, ids=[item_id])
        if not items:
            record["qc"].setdefault("missing", []).append(f"MCD {item_id}")
            continue
        item = items[0]
        href = item["assets"]["Burn_Date"]["href"]
        burn_mask, burn_date = read_mcd_burn_date_to_grid(
            href, grid, event.mcd_burn_start_doy, event.mcd_burn_end_doy
        )
        burn_date_total = np.maximum(burn_date_total, burn_date.astype(np.int16))
        record["mcd64a1"].append(
            {
                "item_id": item.get("id"),
                "asset": href,
                "burn_start_doy": event.mcd_burn_start_doy,
                "burn_end_doy": event.mcd_burn_end_doy,
                "burned_pixels": int(burn_mask.sum()),
                "burned_fraction": float(burn_mask.mean()),
                "checksum": sha256_array(burn_mask),
            }
        )
        arrays[f"mcd_burn_mask_{item_id}"] = burn_mask
        logger.info("%s MCD %s burned=%.3f", event.event_id, item_id, float(burn_mask.mean()))

    arrays["mcd_burn_date"] = burn_date_total
    combined_mask = np.zeros((grid.height, grid.width), dtype=np.uint8)
    for key, value in arrays.items():
        if key.startswith("mcd_burn_mask_"):
            combined_mask = np.maximum(combined_mask, value)
    arrays["mcd_burn_mask"] = combined_mask
    record["qc"]["mcd_burn_fraction"] = float(combined_mask.mean())

    # ---------------- QA previews ----------------
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        pre_vh = arrays.get("s1_pre_vh")
        post_vh = arrays.get("s1_post_vh")
        if pre_vh is not None and post_vh is not None:
            pre_db = 10 * np.log10(np.maximum(pre_vh, 1e-6))
            post_db = 10 * np.log10(np.maximum(post_vh, 1e-6))
            axes[0].imshow(pre_db, cmap="gray", vmin=-25, vmax=0)
            axes[0].set_title("S1 VH pre (dB)")
            axes[1].imshow(post_db, cmap="gray", vmin=-25, vmax=0)
            axes[1].set_title("S1 VH post (dB)")
            axes[2].imshow(post_db - pre_db, cmap="RdBu", vmin=-6, vmax=6)
            axes[2].set_title("VH log-ratio (dB)")
        for ax in axes:
            ax.axis("off")
        fig.tight_layout()
        fig.savefig(event_dir / "qa_s1.png", dpi=110)
        plt.close(fig)

        fig, axes = plt.subplots(1, 2, figsize=(11, 5))
        axes[0].imshow(combined_mask, cmap="inferno", vmin=0, vmax=1)
        axes[0].set_title("MCD64A1 burn mask (event window)")
        if "s2_pre_B08" in arrays and "s2_post_B08" in arrays:
            nbr_pre = (arrays["s2_pre_B08"] - arrays["s2_pre_B12"]) / (
                arrays["s2_pre_B08"] + arrays["s2_pre_B12"] + 1e-6
            )
            nbr_post = (arrays["s2_post_B08"] - arrays["s2_post_B12"]) / (
                arrays["s2_post_B08"] + arrays["s2_post_B12"] + 1e-6
            )
            axes[1].imshow(nbr_pre - nbr_post, cmap="RdBu", vmin=-0.5, vmax=0.5)
            axes[1].set_title("Sentinel-2 dNBR (reference)")
        for ax in axes:
            ax.axis("off")
        fig.tight_layout()
        fig.savefig(event_dir / "qa_labels.png", dpi=110)
        plt.close(fig)
    except Exception as exc:  # previews are optional
        logger.warning("%s QA preview failed: %s", event.event_id, exc)

    # ---------------- save ----------------
    np.savez_compressed(stack_path, **arrays)
    record["arrays"] = sorted(arrays)
    record["stack_sha256"] = hashlib.sha256(stack_path.read_bytes()).hexdigest()
    record["stack_bytes"] = stack_path.stat().st_size
    with open(event_dir / "metadata.json", "w", encoding="utf-8") as handle:
        json.dump(record, handle, indent=2)
    logger.info("%s saved %s (%.1f MB)", event.event_id, stack_path, stack_path.stat().st_size / 1e6)
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event", default="all", help="Event ID or 'all'")
    parser.add_argument("--out", default=str(PROJECT_ROOT / "data" / "real"))
    parser.add_argument("--half-size", type=float, default=8000.0, help="AOI half-size in metres")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    out_root = Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)
    if args.event == "all":
        events = EVENTS
    elif args.event in EVENTS_BY_ID:
        events = [EVENTS_BY_ID[args.event]]
    else:
        parser.error(f"Unknown event {args.event}. Known: {', '.join(EVENTS_BY_ID)}")
        return 2

    manifest_path = out_root / "acquisition_manifest.json"
    if manifest_path.exists():
        with open(manifest_path, "r", encoding="utf-8") as handle:
            manifest = json.load(handle)
        manifest.setdefault("events", {})
        manifest.setdefault("failures", {})
        manifest["updated_at_utc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    else:
        manifest = {
            "created_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "data_origin": "CROSS_SENSOR_PROTOTYPE",
            "is_nisar": False,
            "sensors": ["sentinel-1-rtc", "sentinel-2-l2a", "modis-64A1-061"],
            "events": {},
            "failures": {},
        }
    for event in events:
        manifest["failures"].pop(event.event_id, None)
        try:
            manifest["events"][event.event_id] = acquire_event(event, out_root, args.half_size, args.force)
        except Exception as exc:
            logger.exception("Failed to acquire %s", event.event_id)
            manifest["failures"][event.event_id] = str(exc)

    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
    logger.info("Wrote %s", manifest_path)
    return 1 if manifest["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
