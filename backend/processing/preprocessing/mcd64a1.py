"""NASA MODIS Terra+Aqua Burned Area Monthly L3 Global 500m (MCD64A1.061) Decoder.

Official NASA Product Specification:
- Short Name: MCD64A1 (Version 061)
- NASA CMR Concept ID: C2565786756-LPCLOUD
- DOI: 10.5067/MODIS/MCD64A1.061

Science Data Sets (SDS):
1. Burn_Date (INT16):
   - 1..366: Ordinal day of burn (1 = Jan 1)
   - 0: Unburned land
   - -1: Unmapped due to insufficient data (clouds/missing)
   - -2: Water (internal water mask)
2. Uncertainty (UINT8):
   - Estimated uncertainty in day of burn (days, 1..100; 0 = unburned/unmapped)
3. QA (UINT8 bitmask):
   - Bit 0: Land/water flag (0 = water, 1 = land)
   - Bit 1: Valid data flag (0 = insufficient valid data, 1 = sufficient valid data)
   - Bit 2: Shortened mapping period (0 = not shortened, 1 = shortened)
   - Bit 3: Grid cell relabeled during contextual relabeling (0 = no, 1 = yes)
   - Bit 4: Spare bit (0)
   - Bits 5..7: Special condition code (0..7):
       0 = None
       1 = Agricultural burn cell
       2 = Too few training observations
       3 = Spectral bounds saturated
4. First_Day (INT16): First reliable mapping day of year (1..366; <0 = unmapped/water)
5. Last_Day (INT16): Last reliable mapping day of year (1..366; <0 = unmapped/water)
"""

from __future__ import annotations

from typing import Any, Dict, Optional
import numpy as np


def decode_burn_date(burn_date: np.ndarray) -> Dict[str, np.ndarray]:
    """Decode MCD64A1 Burn_Date layer into semantic boolean masks."""
    bd = np.asarray(burn_date, dtype=np.int16)
    burned = (bd >= 1) & (bd <= 366)
    unburned_land = bd == 0
    unmapped = bd == -1
    water = bd == -2
    valid_observation = burned | unburned_land
    return {
        "burned_mask": burned,
        "unburned_land_mask": unburned_land,
        "unmapped_mask": unmapped,
        "water_mask": water,
        "valid_mask": valid_observation,
        "burn_doy": np.where(burned, bd, 0).astype(np.int16),
    }


def decode_qa_bitmask(qa: np.ndarray) -> Dict[str, np.ndarray]:
    """Decode MCD64A1 8-bit unsigned integer QA bitfield per Collection 6.1 User Guide."""
    q = np.asarray(qa, dtype=np.uint8)
    is_land = (q & 0b00000001) != 0
    is_valid_data = (q & 0b00000010) != 0
    shortened_period = (q & 0b00000100) != 0
    contextual_relabeled = (q & 0b00001000) != 0
    special_condition = (q >> 5) & 0b00000111
    high_quality_land = is_land & is_valid_data & (~shortened_period)
    return {
        "is_land": is_land,
        "is_valid_data": is_valid_data,
        "shortened_mapping_period": shortened_period,
        "contextual_relabeled": contextual_relabeled,
        "special_condition_code": special_condition,
        "high_quality_land_mask": high_quality_land,
    }


def summarize_mcd64a1_layers(
    burn_date: np.ndarray,
    uncertainty: Optional[np.ndarray] = None,
    qa: Optional[np.ndarray] = None,
    first_day: Optional[np.ndarray] = None,
    last_day: Optional[np.ndarray] = None,
    pixel_area_m2: float = 400.0,
) -> Dict[str, Any]:
    """Summarize MCD64A1 burned area, QA validity, and burn-date uncertainty on a target grid."""
    bd_decoded = decode_burn_date(burn_date)
    burned = bd_decoded["burned_mask"]
    valid = bd_decoded["valid_mask"]
    total_pixels = int(burn_date.size)
    burned_pixels = int(np.count_nonzero(burned))
    valid_pixels = int(np.count_nonzero(valid))
    unmapped_pixels = int(np.count_nonzero(bd_decoded["unmapped_mask"]))
    water_pixels = int(np.count_nonzero(bd_decoded["water_mask"]))

    burned_area_km2 = float(burned_pixels * pixel_area_m2 / 1e6)
    burned_area_ha = float(burned_pixels * pixel_area_m2 / 1e4)
    valid_area_km2 = float(valid_pixels * pixel_area_m2 / 1e6)

    summary: Dict[str, Any] = {
        "product": "MCD64A1.061",
        "concept_id": "C2565786756-LPCLOUD",
        "doi": "10.5067/MODIS/MCD64A1.061",
        "native_resolution_m": 500.0,
        "grid_pixel_area_m2": float(pixel_area_m2),
        "total_pixels": total_pixels,
        "valid_pixels": valid_pixels,
        "burned_pixels": burned_pixels,
        "unmapped_pixels": unmapped_pixels,
        "water_pixels": water_pixels,
        "burned_fraction_of_valid": float(burned_pixels / max(valid_pixels, 1)),
        "burned_area_km2": round(burned_area_km2, 4),
        "burned_area_ha": round(burned_area_ha, 2),
        "valid_area_km2": round(valid_area_km2, 4),
    }

    if burned_pixels > 0:
        b_doys = burn_date[burned]
        summary["burn_doy_min"] = int(np.min(b_doys))
        summary["burn_doy_max"] = int(np.max(b_doys))
        summary["burn_doy_median"] = float(np.median(b_doys))
    else:
        summary["burn_doy_min"] = None
        summary["burn_doy_max"] = None
        summary["burn_doy_median"] = None

    if uncertainty is not None:
        unc = np.asarray(uncertainty, dtype=np.float32)
        if burned_pixels > 0:
            burned_unc = unc[burned]
            valid_unc = burned_unc[np.isfinite(burned_unc) & (burned_unc > 0) & (burned_unc <= 100)]
            if valid_unc.size > 0:
                summary["uncertainty_days_mean"] = round(float(np.mean(valid_unc)), 3)
                summary["uncertainty_days_median"] = round(float(np.median(valid_unc)), 3)
                summary["uncertainty_days_max"] = round(float(np.max(valid_unc)), 3)
            else:
                summary["uncertainty_days_mean"] = None
                summary["uncertainty_days_median"] = None
                summary["uncertainty_days_max"] = None

    if qa is not None:
        qa_decoded = decode_qa_bitmask(qa)
        hq_land = qa_decoded["high_quality_land_mask"]
        hq_burned = burned & hq_land
        hq_burned_pixels = int(np.count_nonzero(hq_burned))
        summary["qa_summary"] = {
            "land_fraction": round(float(np.mean(qa_decoded["is_land"])), 4),
            "valid_data_fraction": round(float(np.mean(qa_decoded["is_valid_data"])), 4),
            "shortened_mapping_period_fraction": round(float(np.mean(qa_decoded["shortened_mapping_period"])), 4),
            "high_quality_land_fraction": round(float(np.mean(hq_land)), 4),
            "contextual_relabeled_burned_fraction": round(
                float(np.mean(qa_decoded["contextual_relabeled"][burned])) if burned_pixels > 0 else 0.0,
                4,
            ),
            "qa_filtered_burned_pixels": hq_burned_pixels,
            "qa_filtered_burned_area_km2": round(float(hq_burned_pixels * pixel_area_m2 / 1e6), 4),
        }

    if first_day is not None and last_day is not None:
        fd = np.asarray(first_day, dtype=np.int16)
        ld = np.asarray(last_day, dtype=np.int16)
        valid_fd = fd[fd > 0]
        valid_ld = ld[ld > 0]
        summary["mapping_window"] = {
            "first_day_min": int(np.min(valid_fd)) if valid_fd.size > 0 else None,
            "last_day_max": int(np.max(valid_ld)) if valid_ld.size > 0 else None,
        }

    return summary
