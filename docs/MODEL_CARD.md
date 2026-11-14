# Astera Watch - Model Cards

**Scope:** Sentinel-1 C-band burned-area change detection with Sentinel-2 dNBR reference
labels. These are **cross-sensor prototypes**, not NISAR models.

**Event protocol:** TRAIN = Gann Fire; VAL = Dome Fire; TEST = Bug Fire. The TEST event
was never used to fit or select anything.

**Primary metric:** pixel F1 on the full valid 800 x 800 scene. Intervals are 95% spatial
block-bootstrap intervals (64-pixel blocks, 400 resamples); they reflect within-event
spatial correlation but **not** between-event variance, because only one test event exists.

---

## Reference point: trivial all-burned baseline

Predicting every valid pixel as burned is not a scientific model, but it is essential
context because the TEST event is about 50% burned.

| Split | Event | F1 | IoU | Precision | Recall | Predicted area | Reference area |
|---|---|---|---|---|---|---|---|
| TRAIN | Gann | 0.2525 | 0.1445 | 0.1445 | 1.000 | 251.3 km2 | 36.3 km2 |
| VAL | Dome | 0.1304 | 0.0697 | 0.0697 | 1.000 | 243.4 km2 | 17.0 km2 |
| TEST | Bug | 0.6679 | 0.5014 | 0.5014 | 1.000 | 186.3 km2 | 93.4 km2 |

Any TEST F1 below 0.668 is worse than doing nothing. Any TEST F1 above 0.668 is only
useful if its precision/recall trade-off is defensible.

---

## 1. Log-ratio baseline (mandatory)

- **Class:** `backend.processing.change_detection.log_ratio_detector.LogRatioDetector`
- **Input:** Sentinel-1 VH dB pre/post
- **Decision rule:** burned if `VH_post - VH_pre <= threshold`
- **Threshold:** calibrated on TRAIN only by maximising pixel F1 against dNBR labels
- **Selected threshold:** **-1.20 dB** (TRAIN F1 0.2882, precision 0.2125, recall 0.4480)
- **Training cost:** none; one threshold parameter

| Split | Event | F1 | 95% CI | IoU | Precision | Recall | Specificity | Area error |
|---|---|---|---|---|---|---|---|---|
| TRAIN | Gann | 0.2882 | 0.207-0.330 | 0.1684 | 0.2125 | 0.4480 | 0.7195 | +110.9% |
| VAL | Dome | 0.1331 | 0.086-0.163 | 0.0713 | 0.0800 | 0.3958 | 0.6587 | +395.0% |
| TEST | Bug | 0.6964 | 0.650-0.724 | 0.5342 | 0.6332 | 0.7735 | 0.5494 | +22.2% |

**Interpretation:** the fixed TRAIN threshold transfers poorly to the weak Dome scar
(VAL F1 0.133, barely above the 0.130 all-burned baseline) but performs reasonably on the
strong Bug scar. This is a genuine cross-event transfer result, not a tuning failure.

---

## 2. LightGBM pixel-spatial classifier

- **Class:** `backend.processing.models.lightgbm_model.LightGBMBurnedAreaClassifier`
- **Input:** 10 features from the Sentinel-1 dB stack:
  `VV_pre`, `VH_pre`, `VV_post`, `VH_post`, `dVV`, `dVH`, `dVH-dVV`,
  local 5 x 5 mean of `dVH`, local 5 x 5 std of `dVH`, `VV_post - VH_post`
- **Training pixels:** 157,084 valid TRAIN pixels (spatial 2x thinning)
- **Validation pixels:** 152,139 valid VAL pixels
- **Hyperparameters:** 250 trees, learning rate 0.05, max depth 7, 31 leaves,
  `scale_pos_weight` balanced, early stopping on VAL logloss
- **Probability threshold:** selected on VAL, **0.18**
- **Training time:** about 0.4 s on CPU

| Split | Event | F1 | 95% CI | IoU | Precision | Recall | Specificity | Area error |
|---|---|---|---|---|---|---|---|---|
| TRAIN | Gann | 0.4830 | 0.407-0.543 | 0.3183 | 0.6893 | 0.3717 | 0.9717 | -46.1% |
| VAL | Dome | 0.1568 | 0.109-0.191 | 0.0851 | 0.1253 | 0.2094 | 0.8905 | +67.1% |
| TEST | Bug | 0.5018 | 0.461-0.536 | 0.3350 | 0.8493 | 0.3561 | 0.9365 | -58.1% |

Top features (importance): `local_mean_delta_vh`, `vh_post_db`, `vv_pre_db`,
`local_std_delta_vh`, `vv_post_db`.

**Interpretation:** LightGBM is conservative on TEST (precision 0.849, recall 0.356) and
misses most of the large Bug scar. It is worse than the trivial all-burned baseline on
TEST and worse than U-Net on both VAL and TEST. The TRAIN-to-TEST domain shift is severe:
the model learned Gann's weaker, smaller scar and does not transfer its decision boundary
to a 50%-burned sagebrush/forest landscape.

---

## 3. U-Net ResNet-34

- **Class:** `backend.processing.models.unet_resnet.UNetResNet34` via
  `backend.processing.models.trainer.train_unet_model`
- **Input:** 5 x 128 x 128 dB patch: `[VV_pre, VH_pre, VV_post, VH_post, dVH]`
- **Architecture:** ResNet-34 encoder adapted to 5 input channels, 4-stage decoder with
  skip connections, single-channel logit output
- **Loss:** 0.5 BCE + 0.5 Dice
- **Optimizer:** AdamW, lr 3e-4, cosine annealing, weight decay 1e-4
- **Epochs:** 8; checkpoint selected on VAL IoU
- **Best epoch:** 5 (VAL IoU 0.1759, VAL Dice 0.2992)
- **Probability threshold:** selected on VAL (`0.10..0.90` grid), **0.12**
- **Training time:** 297.28 s on CPU (no CUDA available)
- **Checkpoint:** `models/checkpoints/real_unet_resnet34_best.pt`
- **Important:** the old synthetic checkpoint `unet_resnet34_best.pt` is left untouched.

| Split | Event | F1 | 95% CI | IoU | Precision | Recall | Specificity | Area error |
|---|---|---|---|---|---|---|---|---|
| TRAIN | Gann | 0.9052 | 0.865-0.934 | 0.8268 | 0.9082 | 0.9022 | 0.9846 | -0.7% |
| VAL | Dome | 0.3164 | 0.205-0.423 | 0.1879 | 0.2308 | 0.5030 | 0.8743 | +118.0% |
| TEST | Bug | 0.8150 | 0.783-0.841 | 0.6877 | 0.7304 | 0.9217 | 0.6579 | +26.2% |

### Independent `MCD64A1.061` Comparison on Held-Out `TEST` (`CA_BUG_2026`)

| Model | 20 m vs `MCD64A1` F1 (95% CI) | 20 m Specificity | 20 m ROC-AUC | 500 m Block-Reconciled F1 (`25x25` blocks) | 500 m Block Specificity | 500 m Burn-Fraction Pearson $r$ |
|---|---|---|---|---|---|---|
| **U-Net ResNet-34** | **0.8930** (`0.8675-0.9163`) | **0.9326** | **0.9560** | **0.9022** | **0.9572** | **0.7768** |
| **All-Burned Trivial** | `0.8545` (`0.8180-0.8886`) | `0.0000` | `0.5000` | `0.8567` | `0.0000` | `0.0000` |
| **CUSUM (`h = 5.0`)** | `0.7848` (`0.7347-0.8147`) | `0.6258` | `0.6632` | `0.8229` | `0.5561` | `0.5070` |
| **VH Log-Ratio (`-1.20 dB`)** | `0.7429` (`0.6929-0.7715`) | `0.6713` | `0.7318` | `0.7835` | `0.5615` | `0.5565` |
| **LightGBM (`thr = 0.18`)** | `0.3863` (`0.3474-0.4198`) | `0.9756` | `0.8732` | `0.2683` | `0.9893` | `0.6290` |

Additional threshold-independent and independent cross-sensor metrics are stored in `outputs/evaluation/comprehensive_validation_report.json` (including ROC-AUC, PR-AUC, FPR, FNR, and independent evaluation against QA-filtered NASA MODIS `MCD64A1.061` burned area at both 20 m and native 500 m block resolution).

**Interpretation:** U-Net is the strongest model on both VAL and TEST, and the only model
whose TEST F1 clearly exceeds the all-burned baseline (0.815 vs 0.668). Its TEST precision
and recall are balanced (0.730 / 0.922), and predicted area is within 26% of the dNBR
reference. The TRAIN score is resubstitution and is not evidence of generalisation. The
full-scene probability map uses 50% overlapping tiles, matching the training patch stride.

The VAL score (0.316) is much lower than TEST. Dome is a small, weak-scar fire; Bug is a
large, high-contrast scar. The difference is event difficulty, not evidence that the model
is robust across fire regimes. No claim of general NISAR or operational performance is
supported.

---

## 4. CUSUM temporal detector

- **Class:** `backend.processing.change_detection.cusum.CUSUMDetector`
- **Input:** four chronological Sentinel-1 VH dB scenes per event
- **Baseline:** first acquisition only
- **Allowance:** `k = 0.5`
- **Decision threshold:** `h` selected on VAL from a pre-declared grid; **h = 5.0**
- **Output:** persistent downward-change mask
- **Training cost:** none; one hyperparameter selected on VAL

| Split | Event | F1 | 95% CI | IoU | Precision | Recall | Specificity | Area error |
|---|---|---|---|---|---|---|---|---|
| TRAIN | Gann | 0.2868 | 0.202-0.331 | 0.1674 | 0.1979 | 0.5204 | 0.6437 | +163.0% |
| VAL | Dome | 0.1312 | 0.083-0.162 | 0.0702 | 0.0762 | 0.4732 | 0.5698 | +521.3% |
| TEST | Bug | 0.7123 | 0.663-0.740 | 0.5532 | 0.6101 | 0.8557 | 0.4500 | +40.3% |

**Interpretation:** CUSUM detects the strong Bug scar with high recall but low specificity
and over-predicts area by 40%. It is unsupervised and should be used as a change-candidate
screen, not as a burned-area classifier.

---

## 5. Sentinel-2 dNBR reference layer (not an independent model)

The dNBR layer defines the labels, so its agreement with those labels is 1.0 by
construction. Its useful independent check is against MCD64A1:

| Event | dNBR vs MCD F1 | Precision | Recall | dNBR fraction | MCD fraction |
|---|---|---|---|---|---|
| Gann | 0.8447 | 0.8443 | 0.8452 | 0.1445 | 0.1444 |
| Dome | 0.5851 | 0.5314 | 0.6509 | 0.0697 | 0.0569 |
| Bug | 0.7811 | 0.9716 | 0.6531 | 0.5014 | 0.7459 |

This layer must not be reported as a predictive model. It is the reference definition and
its disagreement with MCD64A1 is part of the uncertainty budget.

---

## 6. Model selection and claims

- Only two trainable models were fitted (LightGBM and U-Net), plus the one-parameter
  log-ratio baseline and the unsupervised CUSUM detector. This satisfies the "maximum
  three trainable models" constraint.
- U-Net is the best-supported candidate on the single held-out event.
- LightGBM is not supported as the primary model for this dataset.
- No model is a NISAR model.
- No model is ready for operational deployment.

## 7. What would be needed before stronger claims

1. Real NISAR GCOV data with Earthdata Login.
2. Multiple events per split (at least 5-10 independent fires per split).
3. Independent burned-area perimeters, not dNBR or MCD64A1 alone.
4. Stratification by vegetation type, fire severity, season, and SAR geometry.
5. Event-level (not only pixel-level) uncertainty and leave-one-event-out validation.
6. Pre-registered thresholds and no test-set inspection during development.
7. External validation in a different year and region.
