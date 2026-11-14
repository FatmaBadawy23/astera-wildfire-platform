"""Unit tests for the real-data experiment helpers.

The full experiment is expensive (CPU U-Net) and is covered by
``scripts/run_real_pipeline.py``. These tests cover the deterministic helpers that encode
the scientific contract: no epsilon floor on missing SAR pixels, TRAIN-only threshold
selection, edge-complete tiling, and valid-domain metric masking.
"""

import numpy as np

from scripts.run_real_pipeline import (
    block_bootstrap_f1,
    calibrate_log_ratio,
    edge_aware_positions,
    features_from_scene,
    metrics_dict,
    power_to_db,
    select_probability_threshold,
)


def test_power_to_db_preserves_missing_pixels():
    power = np.array([1.0, 0.01, 0.0, -1.0, np.nan], dtype=np.float32)
    db = power_to_db(power)
    assert np.isclose(db[0], 0.0)
    assert np.isclose(db[1], -20.0)
    assert np.isnan(db[2])
    assert np.isnan(db[3])
    assert np.isnan(db[4])


def test_edge_aware_positions_cover_full_scene():
    assert edge_aware_positions(800, 128, 128) == [0, 128, 256, 384, 512, 640, 672]
    assert edge_aware_positions(300, 128, 128) == [0, 128, 172]
    assert edge_aware_positions(64, 128, 128) == [0]


def test_log_ratio_threshold_is_selected_on_supplied_reference_only():
    # 100 pixels: 20 real burns with a -4 dB drop, 80 stable pixels.
    delta = np.concatenate([np.full(20, -4.0), np.full(80, -0.2)]).astype(np.float32)
    label = np.concatenate([np.ones(20), np.zeros(80)]).astype(np.uint8)
    valid = np.ones(100, dtype=bool)

    calibration = calibrate_log_ratio(delta, label, valid)
    assert -4.0 <= calibration["selected"]["threshold_db"] < -0.2
    assert calibration["selected"]["f1"] == 1.0


def test_probability_threshold_selection():
    probability = np.array([0.9, 0.8, 0.2, 0.1], dtype=np.float32)
    label = np.array([1, 1, 0, 0], dtype=np.uint8)
    valid = np.ones(4, dtype=bool)
    selection = select_probability_threshold(probability, label, valid)
    assert selection["selected"]["f1"] == 1.0
    assert 0.2 < selection["selected"]["threshold"] <= 0.8


def test_metrics_ignore_invalid_pixels():
    prediction = np.array([[1, 0], [1, 1]], dtype=np.uint8)
    reference = np.array([[1, 0], [0, 0]], dtype=np.uint8)
    valid = np.array([[1, 1], [0, 0]], dtype=bool)
    metrics = metrics_dict(prediction, reference, valid)
    assert metrics["true_positives"] == 1
    assert metrics["false_positives"] == 0
    assert metrics["false_negatives"] == 0
    assert metrics["valid_pixels"] == 2


def test_block_bootstrap_is_bounded():
    prediction = np.zeros((128, 128), dtype=np.uint8)
    prediction[32:96, 32:96] = 1
    reference = prediction.copy()
    valid = np.ones((128, 128), dtype=bool)
    low, high = block_bootstrap_f1(prediction, reference, valid, iterations=50)
    assert 0.0 <= low <= high <= 1.0


def test_features_from_scene_uses_train_mean_for_missing_values():
    stack = np.full((5, 8, 8), np.nan, dtype=np.float32)
    stack[:, :, :] = -12.0
    stack[0, 0, 0] = np.nan
    means = np.array([-10.0, -17.0, -10.0, -17.0, 0.0], dtype=np.float32)
    features = features_from_scene(stack, means)
    assert features.shape == (8, 8, 10)
    assert np.isfinite(features).all()
    # The missing VV pre value was filled with the TRAIN mean (-10 dB).
    assert np.isclose(features[0, 0, 0], -10.0)
