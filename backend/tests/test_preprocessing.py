"""Unit tests for preprocessing, radiometry, speckle filtering, MCD64A1, FIRMS, and area estimation."""

import numpy as np
import pytest

from backend.processing.acquisition.asf_client import parse_nisar_granule_id
from backend.processing.acquisition.firms_client import (
    ActiveFirePoint,
    FIRMSClient,
    format_firms_utc_timestamp,
    normalize_firms_confidence,
)
from backend.processing.change_detection.before_after import (
    compute_geospatial_burned_area,
)
from backend.processing.preprocessing.filters import lee_filter
from backend.processing.preprocessing.log_ratio import compute_log_ratio
from backend.processing.preprocessing.mcd64a1 import (
    decode_burn_date,
    decode_qa_bitmask,
    summarize_mcd64a1_layers,
)
from backend.processing.preprocessing.radiometry import (
    apply_scaler,
    fit_scaler,
    linear_to_db,
)


def test_linear_to_db():
    p = np.array([1.0, 0.1, 0.01, 1e-7], dtype=np.float32)
    db = linear_to_db(p)
    assert np.isclose(db[0], 0.0, atol=1e-3)
    assert np.isclose(db[1], -10.0, atol=1e-3)
    assert np.isclose(db[2], -20.0, atol=1e-3)


def test_compute_log_ratio():
    pre_p = np.full((10, 10), 0.1, dtype=np.float32)  # -10 dB
    post_p = np.full((10, 10), 0.025, dtype=np.float32)  # -16 dB
    ratio_db = compute_log_ratio(pre_p, post_p)
    # Expected drop of ~ -6 dB
    assert np.allclose(ratio_db, -6.02, atol=0.1)


def test_lee_filter():
    rng = np.random.default_rng(42)
    clean = np.ones((50, 50), dtype=np.float32) * 0.1
    speckle = rng.gamma(shape=4, scale=0.25, size=(50, 50)).astype(np.float32)
    noisy = clean * speckle

    filtered = lee_filter(noisy, window_size=5, num_looks=4)
    assert filtered.shape == (50, 50)
    # Variance of filtered array should be significantly lower than noisy array
    assert np.var(filtered) < np.var(noisy)


def test_normalization_leakage_prevention():
    train_data = np.array([10.0, 20.0, 30.0, 40.0, 50.0], dtype=np.float32)
    test_data = np.array([100.0, 200.0], dtype=np.float32)

    # Scaler fit STRICTLY on train data
    stats = fit_scaler(train_data, method="standard")
    assert np.isclose(stats["center"], 30.0, atol=1e-3)

    norm_test = apply_scaler(test_data, stats)
    # Applied to test using train mean (30.0)
    assert np.isclose(norm_test[0], (100.0 - 30.0) / stats["scale"], atol=1e-3)


def test_mcd64a1_burn_date_and_qa_decoding():
    bd = np.array([[220, 0], [-1, -2]], dtype=np.int16)
    dec = decode_burn_date(bd)
    assert dec["burned_mask"][0, 0] == True
    assert dec["unburned_land_mask"][0, 1] == True
    assert dec["unmapped_mask"][1, 0] == True
    assert dec["water_mask"][1, 1] == True
    assert dec["valid_mask"][0, 0] == True
    assert dec["valid_mask"][1, 0] == False

    # QA bit 0 = land (1), bit 1 = valid data (2) => 3 = high-quality land
    qa = np.array([[3, 3], [0, 0]], dtype=np.uint8)
    unc = np.array([[2, 0], [0, 0]], dtype=np.uint8)
    summary = summarize_mcd64a1_layers(bd, uncertainty=unc, qa=qa, pixel_area_m2=400.0)
    assert summary["burned_pixels"] == 1
    assert summary["valid_pixels"] == 2
    assert summary["unmapped_pixels"] == 1
    assert summary["water_pixels"] == 1
    assert summary["uncertainty_days_mean"] == 2.0
    assert summary["qa_summary"]["qa_filtered_burned_pixels"] == 1


def test_firms_normalization_and_summary():
    assert normalize_firms_confidence("h") == "HIGH"
    assert normalize_firms_confidence("nominal") == "NOMINAL"
    assert normalize_firms_confidence("85") == "HIGH"
    assert normalize_firms_confidence("15") == "LOW"
    assert format_firms_utc_timestamp("2026-08-03", "945") == "2026-08-03T09:45:00Z"

    pt = ActiveFirePoint(
        latitude=38.11,
        longitude=-120.73,
        brightness=345.0,
        scan=0.4,
        track=0.4,
        acq_date="2026-08-03",
        acq_time="2130",
        satellite="N20",
        instrument="VIIRS",
        confidence="h",
        version="2.0NRT",
        bright_t31=305.0,
        frp=42.5,
        daynight="D",
    )
    summary = FIRMSClient.summarize_hotspots([pt])
    assert summary["total_hotspots"] == 1
    assert summary["high_confidence_hotspots"] == 1
    assert summary["first_detection_utc"] == "2026-08-03T21:30:00Z"
    assert summary["max_frp_mw"] == 42.5


def test_nisar_granule_id_parser():
    gid = "NISAR_L2_PR_GCOV_009_042_D_069_2005_DHDH_A_20260723T020229_20260723T020305_P05023_N_F_J_001"
    parsed = parse_nisar_granule_id(gid)
    assert parsed["parsed"] is True
    assert parsed["track"] == 42
    assert parsed["frame"] == 69
    assert parsed["flight_direction"] == "DESCENDING"
    assert parsed["polarization"] == "HHHH+HVHV"
    assert parsed["crid"] == "P05023"
    assert parsed["maturity_status"] == "PROVISIONAL"


def test_geospatial_burned_area_calculation():
    mask = np.zeros((100, 100), dtype=np.uint8)
    mask[:50, :50] = 1  # 2500 burned pixels
    valid = np.ones((100, 100), dtype=np.uint8)
    valid[80:, :] = 0  # 2000 invalid pixels -> 8000 valid pixels
    transform = (20.0, 0.0, 500000.0, 0.0, -20.0, 4200000.0)

    rep = compute_geospatial_burned_area(
        mask, valid, crs="EPSG:32610", transform=transform
    )
    assert rep.total_aoi_pixels == 10000
    assert rep.valid_observation_pixels == 8000
    assert rep.burned_pixels == 2500
    # 2500 * 400 m^2 = 1,000,000 m^2 = 1.0 km^2 = 100.0 ha
    assert np.isclose(rep.burned_area_km2, 1.0)
    assert np.isclose(rep.burned_area_ha, 100.0)
    assert np.isclose(rep.burned_percent_of_valid_area, 31.25)

    with pytest.raises(ValueError, match="projected planar CRS"):
        compute_geospatial_burned_area(
            mask, valid, crs="EPSG:4326", transform=transform
        )


def test_optical_water_exclusion_and_qa_bit2_filtering():
    from backend.processing.preprocessing.optical import valid_optical_mask, water_optical_mask
    from backend.processing.acquisition.firms_client import sanitize_firms_url

    scl_pre = np.array([[4, 6], [5, 7]], dtype=np.uint8)
    scl_post = np.array([[5, 4], [6, 7]], dtype=np.uint8)
    ref = np.full((2, 2), 0.25, dtype=np.float32)

    w_mask = water_optical_mask(scl_pre, scl_post)
    assert bool(w_mask[0, 1]) is True
    assert bool(w_mask[1, 0]) is True
    assert bool(w_mask[0, 0]) is False
    assert bool(w_mask[1, 1]) is False

    land_valid = valid_optical_mask(scl_pre, scl_post, ref, ref, exclude_water=True)
    assert bool(land_valid[0, 0]) is True
    assert bool(land_valid[1, 1]) is True
    assert bool(land_valid[0, 1]) is False
    assert bool(land_valid[1, 0]) is False

    # QA Bit 2 (4 = shortened mapping period): qa=3 (bits 0,1 set, bit 2=0) -> True; qa=7 (bits 0,1,2 set) -> False
    qa_dec = decode_qa_bitmask(np.array([3, 7], dtype=np.uint8))
    assert bool(qa_dec["high_quality_land_mask"][0]) is True
    assert bool(qa_dec["high_quality_land_mask"][1]) is False

    assert "<REDACTED_MAP_KEY>" in sanitize_firms_url(
        "https://firms.modaps.eosdis.nasa.gov/api/area/csv/secret123/VIIRS", "secret123"
    )
    assert "secret123" not in sanitize_firms_url(
        "https://firms.modaps.eosdis.nasa.gov/api/area/csv/secret123/VIIRS", "secret123"
    )
