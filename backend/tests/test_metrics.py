"""Unit tests for scientific segmentation evaluation metrics."""

import numpy as np
import pytest

from backend.processing.validation.metrics import calculate_segmentation_metrics


def test_perfect_segmentation_metrics():
    y_true = np.zeros((10, 10), dtype=np.uint8)
    y_true[2:8, 2:8] = 1  # 36 burned pixels
    y_pred = y_true.copy()

    metrics = calculate_segmentation_metrics(y_pred, y_true, pixel_area_m2=100.0)

    assert metrics.true_positives == 36
    assert metrics.false_positives == 0
    assert metrics.false_negatives == 0
    assert metrics.true_negatives == 64
    assert np.isclose(metrics.precision, 1.0)
    assert np.isclose(metrics.recall, 1.0)
    assert np.isclose(metrics.f1_score, 1.0)
    assert np.isclose(metrics.iou, 1.0)
    assert np.isclose(metrics.specificity, 1.0)
    assert np.isclose(metrics.area_error_percent, 0.0)


def test_imbalanced_metrics_with_fp_fn():
    y_true = np.zeros((10, 10), dtype=np.uint8)
    y_true[2:6, 2:6] = 1  # 16 true positives

    y_pred = np.zeros((10, 10), dtype=np.uint8)
    y_pred[2:6, 2:5] = 1  # 12 overlap, 4 false negatives
    y_pred[7:9, 7:9] = 1  # 4 false positives

    metrics = calculate_segmentation_metrics(y_pred, y_true)

    assert metrics.true_positives == 12
    assert metrics.false_positives == 4
    assert metrics.false_negatives == 4
    assert metrics.precision == 12 / 16  # 0.75
    assert metrics.recall == 12 / 16  # 0.75
    assert metrics.iou == 12 / 20  # 0.60
