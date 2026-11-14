"""Unit tests for ML models, sample limits, and change detection algorithms."""

import numpy as np
import pytest
import torch

from backend.processing.change_detection.cusum import CUSUMDetector
from backend.processing.change_detection.log_ratio_detector import LogRatioDetector
from backend.processing.models.dataset import (
    GlobalSampleTracker,
    extract_patches_from_scene,
)
from backend.processing.models.lightgbm_model import (
    LightGBMBurnedAreaClassifier,
    extract_features,
)
from backend.processing.models.unet_resnet import BCEDiceLoss, UNetResNet34


def test_global_sample_limit_enforcement():
    tracker = GlobalSampleTracker(max_limit=10)
    pre = np.ones((100, 100), dtype=np.float32)
    post = np.ones((100, 100), dtype=np.float32)
    mask = np.zeros((100, 100), dtype=np.uint8)

    # Attempt to extract patches with tiny stride
    patches, masks, _ = extract_patches_from_scene(
        pre, pre, post, post, mask,
        event_id="TEST_EV",
        split="TRAIN",
        patch_size=32,
        stride=16,
        tracker=tracker,
    )
    # Must never exceed the tracker max_limit
    assert len(patches) <= 10
    assert tracker.total_count <= 10


def test_log_ratio_detector():
    pre_hv = np.full((50, 50), 0.1, dtype=np.float32)
    post_hv = np.full((50, 50), 0.1, dtype=np.float32)
    # Plant a burn scar in the center (-6 dB drop)
    post_hv[20:35, 20:35] = 0.025

    detector = LogRatioDetector(method="fixed", fixed_threshold_db=-3.0)
    res = detector.detect(pre_hv, post_hv)

    assert res.binary_mask.shape == (50, 50)
    assert np.all(res.binary_mask[20:35, 20:35] == 1)
    assert np.all(res.binary_mask[:10, :10] == 0)


def test_lightgbm_training_and_inference():
    h, w = 40, 40
    pre_hh = np.full((h, w), 0.1, dtype=np.float32)
    pre_hv = np.full((h, w), 0.03, dtype=np.float32)
    post_hh = pre_hh.copy()
    post_hv = pre_hv.copy()

    # Scar
    post_hv[15:25, 15:25] = 0.005
    post_hh[15:25, 15:25] = 0.05
    mask = np.zeros((h, w), dtype=np.uint8)
    mask[15:25, 15:25] = 1

    feat = extract_features(pre_hh, pre_hv, post_hh, post_hv)
    X = feat.reshape(-1, 10)
    y = mask.ravel()

    clf = LightGBMBurnedAreaClassifier(n_estimators=10, max_depth=3)
    clf.fit(X, y)

    prob_map, bin_mask = clf.predict_spatial(feat, threshold=0.5)
    assert prob_map.shape == (h, w)
    assert bin_mask.shape == (h, w)
    # Center should be predicted as burned
    assert bin_mask[20, 20] == 1


def test_unet_resnet34_architecture():
    model = UNetResNet34(in_channels=5, num_classes=1, pretrained=False)
    # Test batch with shape (B=2, C=5, H=128, W=128)
    dummy_input = torch.randn(2, 5, 128, 128)
    output = model(dummy_input)

    assert output.shape == (2, 1, 128, 128)

    # Test loss function
    target = torch.randint(0, 2, (2, 1, 128, 128)).float()
    loss_fn = BCEDiceLoss()
    loss = loss_fn(output, target)
    assert loss.item() >= 0.0


def test_cusum_temporal_detector():
    h, w = 30, 30
    t0 = np.full((h, w), -12.0, dtype=np.float32)
    t1 = np.full((h, w), -12.0, dtype=np.float32)
    t2 = np.full((h, w), -12.0, dtype=np.float32)
    t3 = np.full((h, w), -12.0, dtype=np.float32)

    # Fire occurs at t2 in center
    t2[10:20, 10:20] = -18.0
    t3[10:20, 10:20] = -18.0

    detector = CUSUMDetector(k_allowance=0.5, h_decision=3.0)
    score, mask = detector.detect_downward_change([t0, t1, t2, t3], baseline_indices=(0, 2))

    assert mask.shape == (h, w)
    assert np.all(mask[10:20, 10:20] == 1)
    assert np.all(mask[:5, :5] == 0)
