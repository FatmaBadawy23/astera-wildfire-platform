# Astera Watch - Reproducible Experiment Log

**Experiment:** real cross-sensor wildfire burned-area prototype
**Date:** 2026-11-13
**Script:** `scripts/run_real_pipeline.py`
**Primary artifact:** `outputs/evaluation/real_model_comparison.json`
**Data origin:** `CROSS_SENSOR_PROTOTYPE`
**NISAR used:** No

All numbers below come from that JSON artifact. They are not hand-entered from an earlier
synthetic run.

---

## 1. Configuration

| Item | Value |
|---|---|
| Input sensor | Sentinel-1 RTC C-band VV/VH, 20 m |
| Reference labels | Sentinel-2 L2A dNBR, threshold calibrated on TRAIN |
| Independent check | MCD64A1 burned area, 500 m |
| TRAIN event | Gann Fire (`CA_GANN_2026`) |
| VAL event | Dome Fire (`CA_DOME_2026`) |
| TEST event | Bug Fire (`CA_BUG_2026`) |
| Patches | 128 x 128, stride 64 |
| Samples | 121 TRAIN / 121 VAL / 94 TEST = 336 |
| Normalization | TRAIN only |
| Seed | 42 |
| Device | CPU (torch 2.12.1+cpu; CUDA unavailable) |
| Python | 3.13.7 |
| NISAR | not acquired (Earthdata Login required, credentials absent) |

---

## 2. Command

```powershell
python scripts/run_real_pipeline.py --epochs 8
```

Upstream steps:

```powershell
python scripts/acquire_real_data.py --event all
python scripts/build_real_dataset.py
```

---

## 3. Label calibration

The dNBR threshold was selected on Gann only against MCD64A1:

| Threshold | TRAIN F1 | Precision | Recall |
|---|---|---|---|
| **0.11 (selected)** | **0.8447** | **0.8443** | **0.8452** |

The calibration curve is stored in `dataset_manifest.json`. The threshold was frozen for
Dome and Bug.

---

## 4. Full results

F1 is the primary metric. Intervals are 95% spatial block-bootstrap intervals. TRAIN is
resubstitution and is shown only for overfitting context.

### 4.1 Log-ratio baseline (VH threshold -1.20 dB)

| Split | F1 | 95% CI | IoU | Precision | Recall | Specificity | Area error |
|---|---|---|---|---|---|---|---|
| TRAIN | 0.2882 | 0.207-0.330 | 0.1684 | 0.2125 | 0.4480 | 0.7195 | +110.9% |
| VAL | 0.1331 | 0.086-0.163 | 0.0713 | 0.0800 | 0.3958 | 0.6587 | +395.0% |
| TEST | 0.6964 | 0.650-0.724 | 0.5342 | 0.6332 | 0.7735 | 0.5494 | +22.2% |

### 4.2 LightGBM (probability threshold 0.18)

| Split | F1 | 95% CI | IoU | Precision | Recall | Specificity | Area error |
|---|---|---|---|---|---|---|---|
| TRAIN | 0.4830 | 0.407-0.543 | 0.3183 | 0.6893 | 0.3717 | 0.9717 | -46.1% |
| VAL | 0.1568 | 0.109-0.191 | 0.0851 | 0.1253 | 0.2094 | 0.8905 | +67.1% |
| TEST | 0.5018 | 0.461-0.536 | 0.3350 | 0.8493 | 0.3561 | 0.9365 | -58.1% |

Training time: 0.42 s. Training pixels: 157,084. Validation pixels: 152,139.

### 4.3 U-Net ResNet-34 (probability threshold 0.54)

| Split | F1 | 95% CI | IoU | Precision | Recall | Specificity | Area error |
|---|---|---|---|---|---|---|---|
| TRAIN | 0.9052 | 0.865-0.934 | 0.8268 | 0.9082 | 0.9022 | 0.9846 | -0.7% |
| VAL | 0.3164 | 0.205-0.423 | 0.1879 | 0.2308 | 0.5030 | 0.8743 | +118.0% |
| TEST | 0.8150 | 0.783-0.841 | 0.6877 | 0.7304 | 0.9217 | 0.6579 | +26.2% |

Training: 8 epochs, best epoch 5, best VAL IoU 0.1759, 149.8 s CPU. Full-scene inference
uses 128 x 128 tiles with stride 64 and averages overlapping probabilities, matching the
training patch overlap.
Checkpoint: `models/checkpoints/real_unet_resnet34_best.pt`.

Training curve (loss / VAL IoU):

| Epoch | Train loss | Val loss | Val IoU |
|---|---|---|---|
| 1 | 0.7318 | 0.8644 | 0.0846 |
| 2 | 0.6331 | 0.9419 | 0.0894 |
| 3 | 0.6253 | 1.0783 | 0.0852 |
| 4 | 0.5932 | 0.9395 | 0.1034 |
| 5 | 0.5723 | 0.7467 | 0.1759 |
| 6 | 0.5744 | 0.9883 | 0.0888 |
| 7 | 0.5523 | 0.8265 | 0.1348 |
| 8 | 0.5735 | 0.8273 | 0.1374 |

### 4.4 CUSUM (h = 3.5)

| Split | F1 | 95% CI | IoU | Precision | Recall | Specificity | Area error |
|---|---|---|---|---|---|---|---|
| TRAIN | 0.2868 | 0.202-0.331 | 0.1674 | 0.1979 | 0.5204 | 0.6437 | +163.0% |
| VAL | 0.1312 | 0.083-0.162 | 0.0702 | 0.0762 | 0.4732 | 0.5698 | +521.3% |
| TEST | 0.7123 | 0.663-0.740 | 0.5532 | 0.6101 | 0.8557 | 0.4500 | +40.3% |

CUSUM `h` scan on VAL produced F1 values from 0.1306 (h=2.0) to 0.1312 (h=3.5) to
0.1308 (h=5.0). The selection is therefore nearly flat; `h=3.5` should not be read as a
strongly identified optimum.

### 4.5 All-burned trivial baseline

| Split | F1 | 95% CI | IoU | Precision | Recall | Specificity | Area error |
|---|---|---|---|---|---|---|---|
| TRAIN | 0.2525 | 0.173-0.305 | 0.1445 | 0.1445 | 1.000 | 0.000 | +592.0% |
| VAL | 0.1304 | 0.079-0.162 | 0.0697 | 0.0697 | 1.000 | 0.000 | +1334.3% |
| TEST | 0.6679 | 0.601-0.702 | 0.5014 | 0.5014 | 1.000 | 0.000 | +99.4% |

---

## 5. Independent optical check

dNBR vs MCD64A1 (not a model comparison):

| Event | F1 | Precision | Recall | IoU | dNBR fraction | MCD fraction |
|---|---|---|---|---|---|---|
| Gann | 0.8447 | 0.8443 | 0.8452 | 0.7312 | 0.1445 | 0.1444 |
| Dome | 0.5851 | 0.5314 | 0.6509 | 0.4136 | 0.0697 | 0.0569 |
| Bug | 0.7811 | 0.9716 | 0.6531 | 0.6408 | 0.5014 | 0.7459 |

The Bug disagreement is the largest label-uncertainty signal in the study.

---

## 6. Findings

1. **U-Net is the best candidate on the single held-out event.** TEST F1 0.815 vs
   all-burned 0.668. This is a real improvement, but it is one event.
2. **LightGBM does not transfer.** TEST F1 0.502 is below the trivial baseline. High
   precision and low recall indicate a conservative decision boundary learned from Gann.
3. **The log-ratio baseline is event-dependent.** It is poor on Dome and reasonable on
   Bug. A single TRAIN-calibrated threshold is not robust across scar strength.
4. **CUSUM is a useful candidate screen, not a classifier.** High recall on Bug, low
   specificity, 40% area over-prediction.
5. **Label uncertainty is material.** dNBR and MCD64A1 disagree by 24.5 percentage points
   of valid area on Bug.
6. **The test class prior inflates F1.** Always compare against the all-burned baseline.

## 7. Negative results and rejected alternatives

- No test-set threshold tuning was performed. Lowering the dNBR threshold on Bug would
  improve dNBR/MCD agreement but would violate the protocol.
- No attempt was made to make LightGBM look better by retraining on Dome or Bug.
- No NISAR result is reported because no NISAR scene was available.
- No synthetic scene is mixed into the real dataset.
- Ablations (e.g. VV-only vs VH-only, multi-scale features, longer U-Net training) were
  not run; they are listed as future work rather than invented.

## 8. Artifacts

```
outputs/evaluation/real_model_comparison.json
outputs/evaluation/real_test_maps.png
outputs/evaluation/real_predictions/CA_GANN_2026.npz
outputs/evaluation/real_predictions/CA_DOME_2026.npz
outputs/evaluation/real_predictions/CA_BUG_2026.npz
models/checkpoints/real_unet_resnet34_best.pt
data/real/acquisition_manifest.json
data/real/dataset/dataset_manifest.json
```

## 9. Test suite

```powershell
python -m pytest -q
```

Coverage includes the original adapters, NISAR reader, metrics, sample-limit enforcement,
synthetic pipeline compatibility, real-data helpers, and the API contract for real events.
