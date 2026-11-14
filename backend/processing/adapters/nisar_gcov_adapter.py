"""NISAR Level-2 Geocoded Polarimetric Covariance (GCOV) HDF5 Adapter.

Follows official NASA/JPL NISAR product specifications (JPL D-102271):
- Grids: /science/LSAR/GCOV/grids/frequencyA and /science/LSAR/GCOV/grids/frequencyB
- Identification: /science/LSAR/GCOV/identification or /science/LSAR/identification
- Diagonal covariance terms (real float32 RTC gamma-0 power):
  HHHH, HVHV, VVVV, VHVH, RHRH, RVRV (plus legacy aliases HH, HV, VV, VH)
- Off-diagonal covariance terms (complex64):
  HHHV, HHVH, HHVV, HVVH, HVVV, VHVH_complex
- Ancillary layers:
  rtcGammaToSigmaFactor (float32, sigma0 = gamma0 * rtcGammaToSigmaFactor)
  numberOfLooks (float32, effective number of looks)
  mask (uint8: 0 = invalid/shadow/layover, 1..254 = valid subswath ensemble code, 255 = fill/outside swath)

STRICT SCIENTIFIC INTEGRITY RULES:
- Never fabricates fallback timestamps (e.g. '2026-01-01T00:00:00Z') when zeroDopplerStartTime is missing.
- Never fabricates fallback CRS (e.g. 'EPSG:4326') when projection metadata is missing.
- Never mutates adapter instance state across calls when inspecting frequencyA vs frequencyB.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import h5py
import numpy as np

from backend.processing.adapters.base import (
    BaseSARAdapter,
    Polarization,
    ProductType,
    RasterLayer,
    SARScene,
    SensorType,
    ValidationReport,
)

logger = logging.getLogger(__name__)

# NISAR-INTEGRATION: HDF5 hierarchy paths per JPL D-102271
DEFAULT_GRID_PATH = "/science/LSAR/GCOV/grids/frequencyA"
ALT_GRID_PATH = "/science/LSAR/GCOV/grids/frequencyB"
CANDIDATE_METADATA_PATHS = (
    "/science/LSAR/GCOV/identification",
    "/science/LSAR/identification",
)

# Real-valued diagonal covariance terms (RTC gamma-0 linear power)
DIAGONAL_POL_TERMS = (
    "HHHH",
    "HVHV",
    "VVVV",
    "VHVH",
    "RHRH",
    "RVRV",
    "HH",
    "HV",
    "VV",
    "VH",
)

# Complex-valued off-diagonal covariance terms
OFF_DIAGONAL_COVARIANCE_TERMS = (
    "HHHV",
    "HHVH",
    "HHVV",
    "HVVH",
    "HVVV",
    "VVVH",
    "RHRV",
)

POL_SHORT_TO_DIAG = {
    "HH": "HHHH",
    "HV": "HVHV",
    "VV": "VVVV",
    "VH": "VHVH",
    "RH": "RHRH",
    "RV": "RVRV",
}


def decode_nisar_mask(mask_array: np.ndarray) -> Dict[str, np.ndarray]:
    """Decode NISAR GCOV uint8 mask dataset per JPL D-102271 specification.

    Bit/value semantics:
    - 0: Invalid pixel (radar shadow, layover, or radiometric invalid)
    - 1..254: Valid pixel; integer encodes the subswath / adaptive multi-looking ensemble ID
    - 255: Fill / no-data outside imaged swath
    """
    mask_u8 = np.asarray(mask_array, dtype=np.uint8)
    invalid_radar = mask_u8 == 0
    fill_outside = mask_u8 == 255
    valid_subswath = (mask_u8 >= 1) & (mask_u8 < 255)
    return {
        "valid_mask": valid_subswath,
        "invalid_radar_mask": invalid_radar,
        "fill_mask": fill_outside,
        "subswath_id": np.where(valid_subswath, mask_u8, 0).astype(np.uint8),
    }


def gamma0_to_sigma0(gamma0: np.ndarray, rtc_gamma_to_sigma_factor: np.ndarray) -> np.ndarray:
    """Convert NISAR GCOV RTC gamma-0 linear backscatter to ellipsoid sigma-0.

    Per NISAR GCOV specification:
        sigma0 = gamma0 * rtcGammaToSigmaFactor
    Invalid or non-positive factors produce NaN.
    """
    g0 = np.asarray(gamma0, dtype=np.float32)
    factor = np.asarray(rtc_gamma_to_sigma_factor, dtype=np.float32)
    if g0.shape != factor.shape:
        raise ValueError(
            f"Shape mismatch between gamma0 {g0.shape} and rtcGammaToSigmaFactor {factor.shape}"
        )
    valid = np.isfinite(g0) & np.isfinite(factor) & (factor > 0.0)
    out = np.full(g0.shape, np.nan, dtype=np.float32)
    out[valid] = g0[valid] * factor[valid]
    return out


class NISAR_GCOV_Adapter(BaseSARAdapter):
    """Adapter for reading and validating NISAR Level-2 GCOV HDF5 files."""

    def __init__(self, grid_path: str = DEFAULT_GRID_PATH):
        self.grid_path = grid_path

    def _resolve_grid_path(
        self, h5: h5py.File, frequency: Optional[str] = None
    ) -> str:
        """Resolve target HDF5 grid path without mutating self.grid_path."""
        if frequency is not None:
            freq_clean = frequency.strip().upper()
            if freq_clean in ("A", "FREQUENCYA"):
                candidate = DEFAULT_GRID_PATH
            elif freq_clean in ("B", "FREQUENCYB"):
                candidate = ALT_GRID_PATH
            else:
                raise ValueError(f"Unsupported NISAR frequency selector: {frequency}")
            if candidate not in h5:
                raise KeyError(f"Requested frequency grid {candidate} not found in HDF5.")
            return candidate

        if self.grid_path in h5:
            return self.grid_path
        if ALT_GRID_PATH in h5:
            return ALT_GRID_PATH
        raise KeyError(
            f"Neither {self.grid_path} nor {ALT_GRID_PATH} found in HDF5."
        )

    @staticmethod
    def _resolve_metadata_group(h5: h5py.File) -> Optional[h5py.Group]:
        for path in CANDIDATE_METADATA_PATHS:
            if path in h5:
                return h5[path]
        return None

    @staticmethod
    def _decode_h5_scalar(val: Any) -> Any:
        if isinstance(val, np.ndarray) and val.ndim == 0:
            val = val.item()
        if isinstance(val, (bytes, np.bytes_)):
            return val.decode("utf-8")
        return val

    @classmethod
    def _discover_terms(cls, grid_grp: h5py.Group) -> Tuple[List[str], List[str], List[str]]:
        """Discover listed polarizations, real diagonal datasets, and complex off-diagonal datasets."""
        listed_pols: List[str] = []
        if "listOfPolarizations" in grid_grp:
            raw_pols = grid_grp["listOfPolarizations"][()]
            listed_pols = [
                p.decode("utf-8") if isinstance(p, (bytes, np.bytes_)) else str(p)
                for p in raw_pols
            ]

        listed_cov: List[str] = []
        if "listOfCovarianceTerms" in grid_grp:
            raw_cov = grid_grp["listOfCovarianceTerms"][()]
            listed_cov = [
                c.decode("utf-8") if isinstance(c, (bytes, np.bytes_)) else str(c)
                for c in raw_cov
            ]

        # Build candidate names in deterministic order
        candidates: List[str] = []
        for p in listed_pols:
            if p in grid_grp and p not in candidates:
                candidates.append(p)
            mapped = POL_SHORT_TO_DIAG.get(p)
            if mapped and mapped in grid_grp and mapped not in candidates:
                candidates.append(mapped)
        for c in listed_cov:
            if c in grid_grp and c not in candidates:
                candidates.append(c)
        for name in DIAGONAL_POL_TERMS + OFF_DIAGONAL_COVARIANCE_TERMS:
            if name in grid_grp and name not in candidates:
                candidates.append(name)

        diagonal_terms: List[str] = []
        off_diagonal_terms: List[str] = []
        for name in candidates:
            ds = grid_grp[name]
            if np.issubdtype(ds.dtype, np.complexfloating) or name in OFF_DIAGONAL_COVARIANCE_TERMS:
                off_diagonal_terms.append(name)
            else:
                diagonal_terms.append(name)

        return listed_pols, diagonal_terms, off_diagonal_terms

    @classmethod
    def _extract_epsg(cls, grid_grp: h5py.Group) -> Optional[int]:
        """Extract EPSG code strictly from projection dataset or attribute. Never fabricates 4326."""
        if "projection" not in grid_grp:
            return None
        proj_ds = grid_grp["projection"]
        if "epsg_code" in proj_ds.attrs:
            try:
                return int(proj_ds.attrs["epsg_code"])
            except (TypeError, ValueError):
                return None
        try:
            raw_val = cls._decode_h5_scalar(proj_ds[()])
            epsg_int = int(raw_val)
            if epsg_int > 0:
                return epsg_int
        except (TypeError, ValueError):
            return None
        return None

    @classmethod
    def _extract_acquisition_time(cls, h5: h5py.File) -> Optional[str]:
        """Extract zeroDopplerStartTime strictly from identification metadata. Never fabricates a date."""
        id_grp = cls._resolve_metadata_group(h5)
        if id_grp is None or "zeroDopplerStartTime" not in id_grp:
            return None
        raw = cls._decode_h5_scalar(id_grp["zeroDopplerStartTime"][()])
        if raw is None:
            return None
        text = str(raw).strip()
        return text if text else None

    def inspect(
        self, file_path: Path, frequency: Optional[str] = None
    ) -> Dict[str, Any]:
        """Inspect product metadata without reading full raster arrays."""
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        info: Dict[str, Any] = {
            "file_name": file_path.name,
            "format": "HDF5",
            "sensor": SensorType.NISAR_L.value,
            "product_type": ProductType.GCOV.value,
        }

        with h5py.File(file_path, "r") as h5:
            resolved_grid_path = self._resolve_grid_path(h5, frequency=frequency)
            info["grid_path"] = resolved_grid_path
            info["available_frequencies"] = [
                freq
                for freq, p in (("frequencyA", DEFAULT_GRID_PATH), ("frequencyB", ALT_GRID_PATH))
                if p in h5
            ]

            grid_grp = h5[resolved_grid_path]
            listed_pols, diag_terms, off_diag_terms = self._discover_terms(grid_grp)
            info["listed_polarizations"] = listed_pols
            info["polarizations"] = diag_terms + off_diag_terms
            info["diagonal_polarizations"] = diag_terms
            info["off_diagonal_terms"] = off_diag_terms

            # Inspect spatial coordinates
            if "xCoordinates" in grid_grp and "yCoordinates" in grid_grp:
                x_coords = grid_grp["xCoordinates"]
                y_coords = grid_grp["yCoordinates"]
                info["dimensions"] = (len(y_coords), len(x_coords))
                if len(x_coords) > 0 and len(y_coords) > 0:
                    info["x_range"] = (float(x_coords[0]), float(x_coords[-1]))
                    info["y_range"] = (float(y_coords[0]), float(y_coords[-1]))
                if len(x_coords) > 1:
                    info["pixel_spacing_x"] = float(abs(x_coords[1] - x_coords[0]))
                if len(y_coords) > 1:
                    info["pixel_spacing_y"] = float(abs(y_coords[1] - y_coords[0]))

            epsg = self._extract_epsg(grid_grp)
            info["crs"] = f"EPSG:{epsg}" if epsg is not None else None

            # Ancillary layers
            info["has_rtc_factor"] = "rtcGammaToSigmaFactor" in grid_grp
            info["has_number_of_looks"] = "numberOfLooks" in grid_grp
            info["has_mask"] = "mask" in grid_grp

            acq_time = self._extract_acquisition_time(h5)
            info["acquisition_time"] = acq_time

            # Identification metadata
            id_grp = self._resolve_metadata_group(h5)
            if id_grp is not None:
                for k in [
                    "trackNumber",
                    "frameNumber",
                    "orbitPassDirection",
                    "boundingPolygon",
                    "compositeReleaseId",
                    "productVersion",
                    "is_synthetic",
                ]:
                    if k in id_grp:
                        info[k] = self._decode_h5_scalar(id_grp[k][()])

        return info

    def validate(
        self, file_path: Path, frequency: Optional[str] = None
    ) -> ValidationReport:
        """Validate that the file conforms to NISAR GCOV specifications and has valid data."""
        file_path = Path(file_path)
        errors: List[str] = []
        warnings: List[str] = []
        quality_flags: Dict[str, Any] = {}

        if not file_path.exists():
            return ValidationReport(is_valid=False, errors=[f"File not found: {file_path}"])

        try:
            with h5py.File(file_path, "r") as h5:
                try:
                    resolved_grid_path = self._resolve_grid_path(h5, frequency=frequency)
                except (KeyError, ValueError) as e:
                    errors.append(f"Missing mandatory HDF5 group: {e}")
                    return ValidationReport(is_valid=False, errors=errors)

                grid = h5[resolved_grid_path]
                quality_flags["grid_path"] = resolved_grid_path

                # Check projection / CRS (strictly required)
                epsg = self._extract_epsg(grid)
                if epsg is None:
                    errors.append(
                        "Missing mandatory projection dataset or epsg_code attribute in GCOV grid"
                    )
                else:
                    quality_flags["epsg_code"] = epsg

                # Check acquisition time (strictly required)
                acq_time = self._extract_acquisition_time(h5)
                if acq_time is None:
                    errors.append(
                        "Missing mandatory identification dataset: zeroDopplerStartTime"
                    )
                else:
                    quality_flags["acquisition_time"] = acq_time

                # Check coordinates
                expected_shape: Optional[Tuple[int, int]] = None
                if "xCoordinates" not in grid or "yCoordinates" not in grid:
                    errors.append(
                        "Missing spatial coordinate datasets (xCoordinates/yCoordinates)"
                    )
                else:
                    x_coords = grid["xCoordinates"][:]
                    y_coords = grid["yCoordinates"][:]
                    x_len = len(x_coords)
                    y_len = len(y_coords)
                    if x_len == 0 or y_len == 0:
                        errors.append("Coordinate arrays are empty")
                    else:
                        expected_shape = (y_len, x_len)
                        quality_flags["grid_shape"] = expected_shape
                        if x_len > 1 and not np.all(np.diff(x_coords) > 0):
                            errors.append("xCoordinates must be strictly increasing")
                        if y_len > 1 and not (
                            np.all(np.diff(y_coords) < 0) or np.all(np.diff(y_coords) > 0)
                        ):
                            errors.append("yCoordinates must be strictly monotonic")

                # Check polarizations & covariance terms
                _, diag_pols, off_diag_pols = self._discover_terms(grid)
                all_pols = diag_pols + off_diag_pols
                if not all_pols:
                    errors.append("No polarimetric backscatter datasets found in grid group")
                else:
                    quality_flags["available_polarizations"] = all_pols
                    quality_flags["diagonal_polarizations"] = diag_pols
                    quality_flags["off_diagonal_terms"] = off_diag_pols

                # Check dataset shapes against coordinate dimensions
                if expected_shape is not None:
                    for term in all_pols:
                        if grid[term].shape != expected_shape:
                            errors.append(
                                f"Dataset '{term}' shape {grid[term].shape} does not match coordinate grid {expected_shape}"
                            )
                    for anc in ("mask", "rtcGammaToSigmaFactor", "numberOfLooks"):
                        if anc in grid and grid[anc].shape != expected_shape:
                            errors.append(
                                f"Ancillary dataset '{anc}' shape {grid[anc].shape} does not match coordinate grid {expected_shape}"
                            )

                # Check sample values in the first available diagonal polarization
                if diag_pols and not errors:
                    sample_ds = grid[diag_pols[0]]
                    h, w = sample_ds.shape
                    r0, r1 = max(0, h // 4), max(1, (3 * h) // 4)
                    c0, c1 = max(0, w // 4), max(1, (3 * w) // 4)
                    step = max(1, min(h, w) // 16)
                    sl = sample_ds[r0:r1:step, c0:c1:step]
                    valid_ratio = float(np.count_nonzero(np.isfinite(sl)) / max(sl.size, 1))
                    quality_flags["sample_finite_ratio"] = valid_ratio
                    if valid_ratio < 0.05:
                        warnings.append("Sample region has low ratio of finite values (<5%)")

                # Quality mask check
                if "mask" in grid and not errors:
                    quality_flags["has_validity_mask"] = True
                    mask_arr = grid["mask"][:]
                    decoded = decode_nisar_mask(mask_arr)
                    valid_mask_ratio = float(np.mean(decoded["valid_mask"]))
                    quality_flags["valid_subswath_ratio"] = valid_mask_ratio
                    quality_flags["fill_ratio"] = float(np.mean(decoded["fill_mask"]))
                    quality_flags["invalid_radar_ratio"] = float(
                        np.mean(decoded["invalid_radar_mask"])
                    )
                elif "mask" not in grid:
                    warnings.append("No validity mask layer present in GCOV product")

        except Exception as e:
            errors.append(f"Failed to read HDF5 structure: {str(e)}")

        return ValidationReport(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            quality_flags=quality_flags,
        )

    def load(
        self,
        file_path: Path,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        polarizations: Optional[List[str]] = None,
        frequency: Optional[str] = None,
        convert_to_sigma0: bool = False,
    ) -> SARScene:
        """Load GCOV data into a SARScene instance.

        Args:
            file_path: Path to NISAR L2 GCOV HDF5 file.
            bbox: Optional (min_x, min_y, max_x, max_y) in scene CRS for windowed slicing.
            polarizations: Optional list of polarization/covariance terms to load. If None,
                dynamically loads all available terms discovered in the grid group.
            frequency: Optional 'frequencyA' or 'frequencyB' selector.
            convert_to_sigma0: If True, converts diagonal gamma-0 backscatter layers to sigma-0
                using `rtcGammaToSigmaFactor` (raises ValueError if factor layer is absent).
        """
        file_path = Path(file_path)
        report = self.validate(file_path, frequency=frequency)
        if not report.is_valid:
            raise ValueError(f"Invalid NISAR GCOV file: {report.errors}")

        with h5py.File(file_path, "r") as h5:
            resolved_grid_path = self._resolve_grid_path(h5, frequency=frequency)
            grid = h5[resolved_grid_path]

            x_coords = grid["xCoordinates"][:]
            y_coords = grid["yCoordinates"][:]

            dx = float(abs(x_coords[1] - x_coords[0])) if len(x_coords) > 1 else 20.0
            dy = float(abs(y_coords[1] - y_coords[0])) if len(y_coords) > 1 else 20.0

            # Windowed indices
            if bbox is not None:
                min_x, min_y, max_x, max_y = bbox
                col_idx = np.where((x_coords >= min_x) & (x_coords <= max_x))[0]
                row_idx = np.where((y_coords >= min_y) & (y_coords <= max_y))[0]
                if len(col_idx) == 0 or len(row_idx) == 0:
                    raise ValueError(f"Requested bbox {bbox} outside scene coordinates.")
                c_start, c_end = int(col_idx[0]), int(col_idx[-1]) + 1
                r_start, r_end = int(row_idx[0]), int(row_idx[-1]) + 1
            else:
                c_start, c_end = 0, len(x_coords)
                r_start, r_end = 0, len(y_coords)

            sub_x = x_coords[c_start:c_end]
            sub_y = y_coords[r_start:r_end]

            # Affine geotransform: (top_left_x, pixel_width, 0, top_left_y, 0, -pixel_height)
            top_left_x = float(sub_x[0] - dx / 2.0)
            top_left_y = float(sub_y[0] + dy / 2.0)
            transform = (top_left_x, dx, 0.0, top_left_y, 0.0, -dy)

            epsg = self._extract_epsg(grid)
            if epsg is None:
                raise ValueError("Missing projection EPSG code in NISAR GCOV grid.")
            crs_str = f"EPSG:{epsg}"

            acq_time = self._extract_acquisition_time(h5)
            if acq_time is None:
                raise ValueError("Missing zeroDopplerStartTime in NISAR GCOV identification.")

            layers: Dict[str, RasterLayer] = {}

            # Load RTC factor first if present or needed for sigma0 conversion
            rtc_data: Optional[np.ndarray] = None
            if "rtcGammaToSigmaFactor" in grid:
                rtc_data = grid["rtcGammaToSigmaFactor"][
                    r_start:r_end, c_start:c_end
                ].astype(np.float32)
                layers["rtc_factor"] = RasterLayer(
                    name="rtcGammaToSigmaFactor",
                    data=rtc_data,
                    unit="dimensionless",
                    description="Gamma-0 to Sigma-0 conversion factor",
                )
            elif convert_to_sigma0:
                raise ValueError(
                    "convert_to_sigma0=True requested, but rtcGammaToSigmaFactor is missing from GCOV grid."
                )

            # Determine polarization/covariance list dynamically
            _, diag_pols, off_diag_pols = self._discover_terms(grid)
            discovered_all = diag_pols + off_diag_pols
            if polarizations is not None:
                target_pols: List[str] = []
                for req in polarizations:
                    if req in grid and req not in target_pols:
                        target_pols.append(req)
                    elif POL_SHORT_TO_DIAG.get(req) in grid:
                        mapped = POL_SHORT_TO_DIAG[req]
                        if mapped not in target_pols:
                            target_pols.append(mapped)
            else:
                target_pols = discovered_all

            for pol_name in target_pols:
                if pol_name not in grid:
                    continue
                ds = grid[pol_name]
                if np.issubdtype(ds.dtype, np.complexfloating) or pol_name in OFF_DIAGONAL_COVARIANCE_TERMS:
                    raw_complex = ds[r_start:r_end, c_start:c_end].astype(np.complex64)
                    layers[pol_name] = RasterLayer(
                        name=pol_name,
                        data=raw_complex,
                        nodata=np.nan,
                        unit="complex_linear_power",
                        description=f"Complex off-diagonal polarimetric covariance ({pol_name})",
                    )
                else:
                    raw_data = ds[r_start:r_end, c_start:c_end].astype(np.float32)
                    if convert_to_sigma0 and rtc_data is not None:
                        raw_data = gamma0_to_sigma0(raw_data, rtc_data)
                        desc = f"Ellipsoid Sigma-0 backscatter power ({pol_name})"
                    else:
                        desc = f"RTC Gamma-0 backscatter power ({pol_name})"
                    layers[pol_name] = RasterLayer(
                        name=pol_name,
                        data=raw_data,
                        nodata=np.nan,
                        unit="linear_power",
                        description=desc,
                    )

            # Load and decode mask if present
            if "mask" in grid:
                mask_data = grid["mask"][r_start:r_end, c_start:c_end].astype(np.uint8)
                layers["mask"] = RasterLayer(
                    name="mask",
                    data=mask_data,
                    unit="mask",
                    description="NISAR GCOV mask (0=invalid, 1..254=valid subswath ID, 255=fill)",
                )
                decoded_mask = decode_nisar_mask(mask_data)
                layers["valid_mask"] = RasterLayer(
                    name="valid_mask",
                    data=decoded_mask["valid_mask"].astype(np.uint8),
                    unit="mask",
                    description="Decoded binary validity mask (1=valid subswath, 0=invalid/fill)",
                )

            # Load numberOfLooks if present
            if "numberOfLooks" in grid:
                looks_data = grid["numberOfLooks"][r_start:r_end, c_start:c_end].astype(
                    np.float32
                )
                layers["numberOfLooks"] = RasterLayer(
                    name="numberOfLooks",
                    data=looks_data,
                    nodata=np.nan,
                    unit="dimensionless",
                    description="Effective number of looks (ENL)",
                )

            is_synth = False
            id_grp = self._resolve_metadata_group(h5)
            scene_meta: Dict[str, Any] = {"grid_path": resolved_grid_path}
            if id_grp is not None:
                if "is_synthetic" in id_grp:
                    is_synth = bool(int(self._decode_h5_scalar(id_grp["is_synthetic"][()])))
                for k in (
                    "trackNumber",
                    "frameNumber",
                    "orbitPassDirection",
                    "compositeReleaseId",
                    "productVersion",
                ):
                    if k in id_grp:
                        scene_meta[k] = self._decode_h5_scalar(id_grp[k][()])

            bounds = (
                float(sub_x.min() - dx / 2.0),
                float(sub_y.min() - dy / 2.0),
                float(sub_x.max() + dx / 2.0),
                float(sub_y.max() + dy / 2.0),
            )

            return SARScene(
                scene_id=file_path.stem,
                sensor=SensorType.NISAR_L,
                product_type=ProductType.GCOV,
                acquisition_time=acq_time,
                crs=crs_str,
                transform=transform,
                bounds=bounds,
                pixel_spacing=(dx, dy),
                layers=layers,
                metadata=scene_meta,
                is_synthetic=is_synth,
                data_origin="SYNTHETIC_MOCK_DATA" if is_synth else "NASA_NISAR_GCOV",
                validation_report=report,
            )
