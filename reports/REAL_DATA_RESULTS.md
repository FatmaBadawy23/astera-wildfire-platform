# Astera Watch - Real Data Results Report

**Date:** 2026-11-13
**Author:** Astera Watch scientific pipeline
**Status:** reproducible cross-sensor prototype
**Data origin:** `CROSS_SENSOR_PROTOTYPE`
**NISAR used:** No

---

## Executive summary

The original Astera Watch metrics were produced from synthetic in-repository scenes. They
have been superseded. This report replaces them with an experiment using openly accessible
real satellite data:

- Sentinel-1 RTC C-band (VV/VH, 20 m) as the only model input;
- Sentinel-2 L2A dNBR as the reference label;
- MCD64A1 burned area as an independent coarse check;
- four verified 2026 California/Nevada fires, three used for TRAIN/VAL/TEST;
- 336 paired patches, event-grouped before extraction;
- 121 TRAIN / 121 VAL / 94 TEST;
- log-ratio baseline, LightGBM, U-Net ResNet-34, and CUSUM.

Held-out TEST result (Bug Fire):

| Analysis | F1 | 95% CI | Precision | Recall | IoU |
|---|---|---|---|---|---|
| U-Net ResNet-34 | **0.815** | 0.783-0.841 | 0.730 | 0.922 | 0.688 |
| CUSUM (h=3.5) | 0.712 | 0.663-0.740 | 0.610 | 0.856 | 0.553 |
| Log-ratio (-1.20 dB) | 0.696 | 0.650-0.724 | 0.633 | 0.774 | 0.534 |
| All-burned baseline | 0.668 | 0.601-0.702 | 0.501 | 1.000 | 0.501 |
| LightGBM | 0.502 | 0.461-0.536 | 0.849 | 0.356 | 0.335 |

U-Net is the best-supported candidate, but the evidence is one test event. LightGBM does
not transfer from the small Gann scar to the large Bug scar. The trivial all-burned
baseline is high because the test event is about 50% burned. No result is NISAR
performance.

---

## 1. Why the old results were replaced

The previous pipeline generated synthetic paired scenes with a known planted burn mask,
then trained and evaluated on them. Those numbers measured the synthetic generator, not
wildfire physics. Specific problems found in the audit:

- the events were fabricated;
- the NISAR products were mock HDF5 files, not NISAR GCOV;
- the reported 0.95+ F1 values were not comparable to real-sensor performance;
- the U-Net and LightGBM results were reported as if they were real-data conclusions.

The old reports and docs are retained only as historical artifacts and are explicitly
marked **SUPERSEDED - SYNTHETIC DATA**. The old synthetic checkpoint is also retained and
was not overwritten by the real U-Net checkpoint.

---

## 2. NISAR availability

NISAR was not acquired.

- NISAR GCOV products require NASA Earthdata Login.
- No credentials or authenticated session were available.
- The official documentation confirms EDL is mandatory.
- The NISAR mission data gap from `2026-07-27T22:03:25Z` to
  `2026-08-10T00:55:27Z` overlaps the August fire pairing window.

The NISAR adapter remains in the codebase. Supplying valid credentials and re-running the
acquisition path would enable the genuine experiment. Until then, all results must be
labelled cross-sensor.

---

## 3. Study design

### 3.1 Events

| Event | Split | Reported start | Reported acres | MCD64A1 DOY | S1 dates |
|---|---|---|---|---|---|
| Gann Fire, Calaveras County, CA | TRAIN | 2026-08-03 | 10,339 | 215-222 | 07-26, 08-07, 08-19, 08-31 |
| Dome Fire, Yosemite area, CA | VAL | 2026-09-21 | 6,159 | 244-273 | 09-13, 10-01, 10-07, 10-19 |
| Bug Fire, CA/NV | TEST | 2026-08-08 | 93,733 | 219-240 | 08-03, 08-15, 08-27, 09-08 |
| Timber Fire, Monterey County, CA | excluded | 2026-08-09 | 25,435 | 219-243 | 08-07, 08-19, 08-31, 09-12 |

Timber was excluded because MCD64A1 aggregates the overlapping Timber/Plaskett complex and
the Sentinel-1 VH change was incoherent. It is retained as acquisition evidence.

### 3.2 AOI and patches

- 16 km x 16 km AOI centered on MCD64A1 burn-scar centroid.
- Local UTM grid, 20 m pixels, 800 x 800.
- 128 x 128 patches, stride 64, minimum valid fraction 0.25.
- 121 / 121 / 94 patches; 336 total, under the 10,000 cap.
- Splits assigned by event before patch extraction.

### 3.3 Labels

`dNBR = NBR_pre - NBR_post`, with NBR from Sentinel-2 B08/B12.

The dNBR threshold was calibrated on Gann against MCD64A1 only:

- selected threshold 0.11;
- F1 0.8447, precision 0.8443, recall 0.8452;
- frozen for Dome and Bug.

MCD64A1 is an independent coarse check. It is not used to fit SAR model weights and is not
ground truth.

### 3.4 Leakage controls

- dNBR threshold, normalization, LightGBM early stopping, U-Net checkpoint, U-Net
  probability threshold, and CUSUM `h` are all selected on TRAIN or VAL only.
- TEST is evaluated once.
- No synthetic data is mixed in.
- No test-driven threshold lowering was performed, even where it would improve agreement.

---

## 4. Results

### 4.1 Validation event (Dome Fire)

| Analysis | F1 | 95% CI | Precision | Recall | Specificity | Area error |
|---|---|---|---|---|---|---|
| U-Net | 0.316 | 0.205-0.423 | 0.231 | 0.503 | 0.874 | +118% |
| LightGBM | 0.157 | 0.109-0.191 | 0.125 | 0.209 | 0.891 | +67% |
| Log-ratio | 0.133 | 0.086-0.163 | 0.080 | 0.396 | 0.659 | +395% |
| All-burned | 0.130 | 0.079-0.162 | 0.070 | 1.000 | 0.000 | +1334% |

Dome is a hard event: small scar, weak VH contrast, and only 7% burned. U-Net is the only
analysis clearly above the trivial baseline, and even it is weak.

### 4.2 Held-out test event (Bug Fire)

| Analysis | F1 | 95% CI | Precision | Recall | Specificity | Area error |
|---|---|---|---|---|---|---|
| U-Net | 0.815 | 0.783-0.841 | 0.730 | 0.922 | 0.658 | +26% |
| CUSUM | 0.712 | 0.663-0.740 | 0.610 | 0.856 | 0.450 | +40% |
| Log-ratio | 0.696 | 0.650-0.724 | 0.633 | 0.774 | 0.549 | +22% |
| All-burned | 0.668 | 0.601-0.702 | 0.501 | 1.000 | 0.000 | +99% |
| LightGBM | 0.502 | 0.461-0.536 | 0.849 | 0.356 | 0.937 | -58% |

U-Net is the only analysis with a clear margin over the all-burned baseline and a
defensible precision/recall balance. CUSUM and log-ratio are above the baseline but
over-predict area. LightGBM is conservative and misses most of the scar.

### 4.3 Why the VAL and TEST results differ

Dome and Bug are not exchangeable:

- Dome burn fraction: 7% of valid pixels; Bug: 50%.
- Dome has a weak VH drop; Bug has a strong, spatially coherent drop.
- Bug covers a large sagebrush/forest scar; Dome is a smaller fire.
- Bug has only 72.8% Sentinel-1 validity because of the swath edge; Dome has 95.1%.

The model did not become better at generalisation between VAL and TEST; the TEST event is
easier for a VH-drop detector.

### 4.4 Label uncertainty

dNBR and MCD64A1 agreement:

| Event | dNBR fraction | MCD fraction | F1 | Precision | Recall |
|---|---|---|---|---|---|
| Gann | 0.1445 | 0.1444 | 0.8447 | 0.8443 | 0.8452 |
| Dome | 0.0697 | 0.0569 | 0.5851 | 0.5314 | 0.6509 |
| Bug | 0.5014 | 0.7459 | 0.7811 | 0.9716 | 0.6531 |

On Bug, dNBR marks 50.1% of valid pixels burned; MCD marks 74.6%. This 24.5-point gap is
larger than the F1 difference between several models. Possible causes include 500 m MCD
aggregation, the late 2026-08-30 optical post date, threshold transfer, and differing
physical definitions. The experiment does not resolve this; it reports it.

---

## 5. Uncertainty and statistical limits

- Only one event per split. The 95% block-bootstrap intervals describe within-event
  spatial correlation, not between-event variance.
- A true generalisation estimate needs multiple independent fires per split.
- Pixel-level metrics are spatially autocorrelated; bootstrap blocks reduce but do not
  eliminate this.
- The TEST event has a severe class-prior shift. F1 alone is misleading; the all-burned
  baseline is included for context.
- The labels are optical references, not field or perimeter ground truth.
- The input is C-band, not L-band NISAR.

---

## 6. What was actually learned

1. **Event grouping and provenance are now enforced.** The pipeline can reproduce every
   acquisition and every split.
2. **A strong-scar event is detectable with U-Net.** TEST F1 0.815 and balanced
   precision/recall are credible for this event.
3. **A weak-scar event remains hard.** VAL F1 0.316 shows the method is not solved.
4. **Classical transfer is fragile.** LightGBM's high precision / low recall on TEST is a
   domain-shift failure, not a tuning opportunity.
5. **Coarse labels limit conclusions.** dNBR/MCD disagreement is material.
6. **The old synthetic claims are not supported.** The 0.95+ F1 numbers do not survive
   real data.

---

## 7. What genuine NISAR training requires

1. Earthdata Login credentials via environment variables or `.netrc`.
2. GCOV search per AOI with consistent frequency, track/frame, and pass.
3. Pre/post acquisitions that bracket the fire and avoid the 2026-07-27 to 2026-08-10 gap.
4. Correct GCOV covariance handling and `rtcGammaToSigmaFactor` if sigma0 is needed.
5. Label calibration and all experiments re-run with NISAR as the only input sensor.
6. Multiple events per split, independent burned-area perimeters, and event-level
   uncertainty.
7. External validation in another year and region.

Until then, the correct description is: **Sentinel-1 cross-sensor prototype, NISAR-ready
pipeline, NISAR results not available.**

---

## 8. Artifacts

| Artifact | Path |
|---|---|
| Full comparison JSON | `outputs/evaluation/real_model_comparison.json` |
| TEST QA figure | `outputs/evaluation/real_test_maps.png` |
| Prediction maps | `outputs/evaluation/real_predictions/*.npz` |
| Real U-Net checkpoint | `models/checkpoints/real_unet_resnet34_best.pt` |
| Acquisition manifest | `data/real/acquisition_manifest.json` |
| Dataset manifest | `data/real/dataset/dataset_manifest.json` |
| Dataset card | `docs/DATASET_CARD.md` |
| Model cards | `docs/MODEL_CARD.md` |
| Experiment log | `docs/EXPERIMENTS.md` |

## 9. Reproduction

```powershell
python scripts/acquire_real_data.py --event all
python scripts/build_real_dataset.py
python scripts/run_real_pipeline.py --epochs 8
python -m pytest -q
```

The run is deterministic with seed 42 on the same data. Re-acquisition may select
different STAC items if the upstream catalogue changes; the manifest records exactly what
was used.
