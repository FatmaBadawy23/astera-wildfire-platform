"""Automated verification tests for Phase G1: Masked BCE + Dice Loss & Dataset Validity Handling.

Verifies all 8 mandatory mathematical & autograd invariants:
1. Changing predictions at invalid pixels does not change the loss.
2. Changing labels at invalid pixels does not change the loss.
3. Invalid pixels receive zero gradients.
4. Valid pixels receive non-zero gradients.
5. Water pixels (SCL == 6 -> valid_mask == 0) cannot contribute to loss or gradient.
6. Empty-validity masks do not produce NaNs or infinities.
7. Fully valid masks match the expected ordinary BCE/Dice behavior.
8. Loss remains finite under extreme logits.
"""

from __future__ import annotations

import numpy as np
import pytest
import torch

from backend.processing.models.dataset import SARPatchDataset
from backend.processing.models.real_dataset import nan_channel_stats
from backend.processing.models.unet_resnet import BCEDiceLoss, MaskedBCEDiceLoss
from backend.processing.preprocessing.optical import valid_optical_mask, water_optical_mask


def test_1_changing_predictions_at_invalid_pixels_does_not_change_loss():
    torch.manual_seed(42)
    logits_a = torch.randn(2, 1, 16, 16)
    targets = torch.randint(0, 2, (2, 1, 16, 16)).float()
    valid = torch.ones(2, 1, 16, 16)
    valid[:, :, 8:, :] = 0.0  # Bottom half is invalid

    logits_b = logits_a.clone()
    logits_b[:, :, 8:, :] = 999.0  # Wildly perturb predictions on invalid pixels
    logits_c = logits_a.clone()
    logits_c[:, :, 8:, :] = float("nan")  # Even NaN at invalid pixels must not change loss

    loss_fn = MaskedBCEDiceLoss(bce_weight=0.5, smooth=1.0)
    loss_a = loss_fn(logits_a, targets, valid=valid)
    loss_b = loss_fn(logits_b, targets, valid=valid)
    loss_c = loss_fn(logits_c, targets, valid=valid)

    assert torch.isfinite(loss_a)
    assert torch.allclose(loss_a, loss_b, atol=1e-7, rtol=0.0)
    assert torch.allclose(loss_a, loss_c, atol=1e-7, rtol=0.0)


def test_2_changing_labels_at_invalid_pixels_does_not_change_loss():
    torch.manual_seed(42)
    logits = torch.randn(2, 1, 16, 16)
    targets_a = torch.zeros(2, 1, 16, 16)
    targets_a[:, :, :4, :4] = 1.0
    valid = torch.ones(2, 1, 16, 16)
    valid[:, :, :, 8:] = 0.0  # Right half is invalid

    targets_b = targets_a.clone()
    targets_b[:, :, :, 8:] = 1.0  # Flip all invalid labels to burned
    targets_c = targets_a.clone()
    targets_c[:, :, :, 8:] = -99.0  # Arbitrary garbage labels on invalid pixels

    loss_fn = MaskedBCEDiceLoss(bce_weight=0.5, smooth=1.0)
    loss_a = loss_fn(logits, targets_a, valid=valid)
    loss_b = loss_fn(logits, targets_b, valid=valid)
    loss_c = loss_fn(logits, targets_c, valid=valid)

    assert torch.allclose(loss_a, loss_b, atol=1e-7, rtol=0.0)
    assert torch.allclose(loss_a, loss_c, atol=1e-7, rtol=0.0)


def test_3_and_4_invalid_pixels_receive_zero_gradients_and_valid_receive_gradients():
    torch.manual_seed(7)
    logits = torch.randn(2, 1, 16, 16, requires_grad=True)
    targets = torch.randint(0, 2, (2, 1, 16, 16)).float()
    valid = torch.zeros(2, 1, 16, 16)
    valid[:, :, :8, :8] = 1.0  # Only top-left quadrant is valid

    loss_fn = MaskedBCEDiceLoss(bce_weight=0.5, smooth=1.0)
    loss = loss_fn(logits, targets, valid=valid)
    loss.backward()

    grad = logits.grad
    assert grad is not None
    assert torch.isfinite(grad).all()

    invalid_grad = grad[valid == 0]
    valid_grad = grad[valid == 1]

    # Property 3: Invalid pixels receive identically zero gradient
    assert torch.all(invalid_grad == 0.0)
    assert float(invalid_grad.abs().max().item()) == 0.0

    # Property 4: Valid pixels receive non-zero gradients
    assert float(valid_grad.abs().sum().item()) > 0.0
    assert torch.all(valid_grad.abs() > 0.0)


def test_5_water_pixels_cannot_contribute_to_loss_or_gradient():
    # Construct synthetic Sentinel-2 SCL pre/post arrays where row 0 is land (SCL=4,5) and row 1 is water (SCL=6)
    scl_pre = np.array([[4, 5, 4, 5], [6, 6, 4, 5]], dtype=np.uint8)
    scl_post = np.array([[4, 5, 4, 5], [4, 6, 6, 6]], dtype=np.uint8)
    refl = np.full((2, 4), 0.2, dtype=np.float32)

    w_mask = water_optical_mask(scl_pre, scl_post)
    v_mask = valid_optical_mask(scl_pre, scl_post, refl, refl, exclude_water=True) & (~w_mask)

    # Row 1 consists entirely of pixels that are water in pre or post -> must be excluded (valid == 0)
    assert np.all(v_mask[1, :] == False)
    assert np.all(v_mask[0, :] == True)

    valid_t = torch.from_numpy(v_mask.astype(np.float32))[None, None, :, :]
    targets_t = torch.tensor([[[[1.0, 0.0, 1.0, 0.0], [1.0, 1.0, 1.0, 1.0]]]])

    logits_1 = torch.zeros((1, 1, 2, 4), requires_grad=True)
    logits_2_data = logits_1.detach().clone()
    logits_2_data[:, :, 1, :] = 50.0  # Change logits on water pixels
    logits_2 = logits_2_data.requires_grad_(True)

    loss_fn = MaskedBCEDiceLoss()
    l1 = loss_fn(logits_1, targets_t, valid=valid_t)
    l2 = loss_fn(logits_2, targets_t, valid=valid_t)
    assert torch.allclose(l1, l2, atol=1e-7, rtol=0.0)

    l2.backward()
    assert torch.all(logits_2.grad[:, :, 1, :] == 0.0)
    assert torch.all(logits_2.grad[:, :, 0, :].abs() > 0.0)


def test_6_empty_validity_masks_do_not_produce_nans():
    logits = torch.randn(2, 1, 8, 8, requires_grad=True)
    targets = torch.randint(0, 2, (2, 1, 8, 8)).float()
    empty_valid = torch.zeros(2, 1, 8, 8)

    for smooth_val in (1.0, 0.0):
        loss_fn = MaskedBCEDiceLoss(bce_weight=0.5, smooth=smooth_val)
        if logits.grad is not None:
            logits.grad.zero_()
        loss = loss_fn(logits, targets, valid=empty_valid)
        assert torch.isfinite(loss)
        assert float(loss.item()) == 0.0
        loss.backward()
        assert logits.grad is not None
        assert torch.isfinite(logits.grad).all()
        assert torch.all(logits.grad == 0.0)


def test_7_fully_valid_masks_match_ordinary_bce_dice_behavior():
    torch.manual_seed(123)
    logits = torch.randn(3, 1, 16, 16)
    targets = torch.randint(0, 2, (3, 1, 16, 16)).float()
    full_valid = torch.ones(3, 1, 16, 16)

    ordinary_loss_fn = BCEDiceLoss(bce_weight=0.5, smooth=1.0)
    masked_loss_fn = MaskedBCEDiceLoss(bce_weight=0.5, smooth=1.0)

    l_ord = ordinary_loss_fn(logits, targets)
    l_msk = masked_loss_fn(logits, targets, valid=full_valid)
    l_none = masked_loss_fn(logits, targets, valid=None)
    l_bce_with_valid = ordinary_loss_fn(logits, targets, valid=full_valid)

    assert torch.allclose(l_ord, l_msk, atol=1e-6, rtol=1e-6)
    assert torch.allclose(l_ord, l_none, atol=1e-6, rtol=1e-6)
    assert torch.allclose(l_ord, l_bce_with_valid, atol=1e-6, rtol=1e-6)


def test_8_loss_remains_finite_under_extreme_logits():
    logits = torch.tensor([[[[-1000.0, -100.0], [100.0, 1000.0]]]], requires_grad=True)
    targets = torch.tensor([[[[1.0, 0.0], [0.0, 1.0]]]])
    valid = torch.tensor([[[[1.0, 1.0], [1.0, 0.0]]]])

    loss_fn = MaskedBCEDiceLoss(bce_weight=0.5, smooth=1.0)
    loss = loss_fn(logits, targets, valid=valid)

    assert torch.isfinite(loss)
    loss.backward()
    assert logits.grad is not None
    assert torch.isfinite(logits.grad).all()
    assert float(logits.grad[0, 0, 1, 1].item()) == 0.0


def test_sar_patch_dataset_returns_aligned_valid_mask_under_augmentation():
    np.random.seed(42)
    patch = np.zeros((5, 8, 8), dtype=np.float32)
    mask = np.zeros((1, 8, 8), dtype=np.float32)
    valid = np.zeros((1, 8, 8), dtype=np.float32)
    # Mark a single asymmetric pixel (row 1, col 6) in all three tensors
    patch[:, 1, 6] = 10.0
    mask[0, 1, 6] = 1.0
    valid[0, 1, 6] = 1.0

    ds = SARPatchDataset(
        patches=[patch],
        masks=[mask],
        valid_masks=[valid],
        is_train=True,
    )
    for _ in range(20):
        x, y, m = ds[0]
        assert x.shape == (5, 8, 8)
        assert y.shape == (1, 8, 8)
        assert m.shape == (1, 8, 8)
        # Wherever y == 1, m == 1 and x[0] == 10.0 must co-locate after any flip/rotation
        pos = torch.nonzero(y[0] > 0.5, as_tuple=False)
        assert pos.shape == (1, 2)
        r, c = int(pos[0, 0]), int(pos[0, 1])
        assert float(m[0, r, c].item()) == 1.0
        assert float(x[0, r, c].item()) == 10.0


def test_nan_channel_stats_excludes_invalid_pixels():
    patches = np.ones((2, 5, 4, 4), dtype=np.float32) * 10.0
    valid = np.ones((2, 1, 4, 4), dtype=np.uint8)
    # Contaminate invalid pixels with -999.0
    patches[:, :, 2:, :] = -999.0
    valid[:, :, 2:, :] = 0

    means, stds = nan_channel_stats(patches, valid=valid)
    assert np.allclose(means, 10.0, atol=1e-5)
    assert np.allclose(stds, 1e-3, atol=1e-5)  # std of constant 10.0 clamped to 1e-3
