# PHASE G1: CRITICAL MASKED-LOSS CORRECTION & VALIDATION REPORT

- **Date (UTC):** `2026-11-14T00:44:30Z`
- **Status:** **`VERIFIED` (14/14 unit tests passing)**
- **Modified Modules:**
  - [unet_resnet.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/processing/models/unet_resnet.py) (`MaskedBCEDiceLoss` & optional `valid` support in `BCEDiceLoss`)
  - [dataset.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/processing/models/dataset.py) (`SARPatchDataset` with synchronized geometric augmentation on `valid_masks`)
  - [real_dataset.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/processing/models/real_dataset.py) (`nan_channel_stats` restricted to `valid > 0` land pixels when supplied)
  - [trainer.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/processing/models/trainer.py) (`train_unet_model` using `MaskedBCEDiceLoss` and valid-masked epoch validation IoU/Dice)
- **Verification Test Suite:**
  - [test_masked_loss.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/tests/test_masked_loss.py)

---

## 1. Root Cause Identified in Phase G0

In the baseline implementation (`run_20261114_013500`):
1. `train.npz` and `val.npz` stored a `valid` mask `(N, 1, 128, 128)` where `1` indicates valid land (Sentinel-1 finite positive $\gamma^0$, Sentinel-2 SCL land classes `{4, 5, 7}`, water `SCL == 6` excluded) and `0` indicates invalid/cloud/shadow/water/no-data pixels (`142,768` patch pixels in `train.npz`, `105,376` in `val.npz`).
2. However, `SARPatchDataset` accepted only `(patches, masks)` and omitted `valid_masks`.
3. `BCEDiceLoss` computed unweighted `nn.BCEWithLogitsLoss()` and global Dice over **all** $128\times 128$ pixels of every patch. Because `labels` had `0` wherever `valid == 0`, every cloud, shadow, water, and SAR no-data pixel was supervised as a negative (unburned) training example.
4. Furthermore, `train_unet_model` in `trainer.py` computed epoch-level validation IoU (`calculate_segmentation_metrics(y_pred_cat, y_true_cat)`) without passing `valid_mask`, meaning checkpoint selection included predictions over invalid pixels.

---

## 2. Mathematical & Engineering Remediation

### 2.1 Dataset Validity Handling (`SARPatchDataset`)
- `SARPatchDataset` now accepts `valid_masks: Optional[List[np.ndarray]] = None`.
- When `valid_masks` is provided, `__getitem__` returns `(x_tensor, y_tensor, m_tensor)` and applies random horizontal flips, vertical flips, and $90^\circ$ rotations identically to `patch`, `mask`, and `valid`.
- When `valid_masks` is `None`, legacy 2-tuple `(x_tensor, y_tensor)` behavior is preserved so existing unit tests remain 100% compatible.

### 2.2 Masked Binary Cross-Entropy (`L_BCE`)
For logits $z$, binary targets $y \in \{0, 1\}$, and binary validity mask $m \in \{0, 1\}$:
1. Prior to any arithmetic, invalid entries are sanitized via `torch.where(valid_bool, logits, 0.0)` and `torch.where(valid_bool, targets, 0.0)`. Because `torch.where` routes zero gradient to unselected branches, invalid pixels receive **identically zero gradient** (`0.0`) and even `NaN`/`Inf` values at invalid locations cannot contaminate forward or backward passes.
2. Masked BCE is computed as:
   $$\mathcal{L}_{\text{BCE}} = \frac{\sum_{i} m_i \cdot \text{BCEWithLogits}(z_i, y_i)}{\max\left(\sum_{i} m_i,\, 1\right)}$$

### 2.3 Masked Dice Loss (`L_Dice`)
Using valid-masked probabilities $p_i = m_i \cdot \sigma(z_i)$ and valid-masked targets $\tilde{y}_i = m_i \cdot y_i$:
$$\mathcal{L}_{\text{Dice}} = 1 - \frac{2 \sum_i p_i \tilde{y}_i + s}{\max\left(\sum_i p_i + \sum_i \tilde{y}_i + s,\, 10^{-7}\right)}$$
- Invalid pixels ($m_i = 0$) have $p_i = 0$ and $\tilde{y}_i = 0$, contributing zero to both numerator and denominator.
- If an entire batch has zero valid pixels ($\sum_i m_i = 0$), `MaskedBCEDiceLoss.forward` returns `(safe_logits * 0.0).sum()`, which evaluates to `0.0`, remains finite, preserves the autograd graph, and produces zero gradients everywhere.

### 2.4 Valid-Masked Epoch Checkpoint Selection (`trainer.py`)
- `train_unet_model` unpacks `(x_batch, y_batch, m_batch)` via `_unpack_batch`, skips optimizer steps if a batch has zero valid pixels, and passes `valid_mask=y_valid_cat` to `calculate_segmentation_metrics` during validation epoch evaluation.

---

## 3. Automated Test Verification Results

Command executed:
```powershell
python -m pytest backend/tests/test_masked_loss.py backend/tests/test_models.py -v
```

| # | Test Name | Verified Invariant | Result |
|---:|:---|:---|:---|
| 1 | `test_1_changing_predictions_at_invalid_pixels_does_not_change_loss` | Setting invalid logits to `999.0` or `NaN` leaves loss unchanged (`atol=1e-7`) | **PASSED** |
| 2 | `test_2_changing_labels_at_invalid_pixels_does_not_change_loss` | Setting invalid labels to `1.0` or `-99.0` leaves loss unchanged (`atol=1e-7`) | **PASSED** |
| 3 | `test_3_and_4_invalid_pixels_receive_zero_gradients_and_valid_receive_gradients` | `max(\|grad[valid==0]\|) == 0.0` and `min(\|grad[valid==1]\|) > 0.0` | **PASSED** |
| 4 | `test_5_water_pixels_cannot_contribute_to_loss_or_gradient` | Sentinel-2 `SCL == 6` water pixels have `valid == 0`, zero loss effect, and `grad == 0.0` | **PASSED** |
| 5 | `test_6_empty_validity_masks_do_not_produce_nans` | All-zero `valid` mask returns `0.0` (both `smooth=1.0` and `smooth=0.0`) with finite zero gradients | **PASSED** |
| 6 | `test_7_fully_valid_masks_match_ordinary_bce_dice_behavior` | All-one `valid` mask matches legacy `BCEDiceLoss` within `1e-6` | **PASSED** |
| 7 | `test_8_loss_remains_finite_under_extreme_logits` | Extreme logits `[-1000, +1000]` yield finite loss and finite gradients | **PASSED** |
| 8 | `test_sar_patch_dataset_returns_aligned_valid_mask_under_augmentation` | Flips and $90^\circ$ rotations keep `x`, `y`, and `m` pixel-aligned across 20 random draws | **PASSED** |
| 9 | `test_nan_channel_stats_excludes_invalid_pixels` | Invalid pixels with `-999.0` do not affect `TRAIN` channel mean or std | **PASSED** |
| 10–14 | `backend/tests/test_models.py` (all 5 existing model tests) | Backward compatibility with existing model tests | **PASSED** |
