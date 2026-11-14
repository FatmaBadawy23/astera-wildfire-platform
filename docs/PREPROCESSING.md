# Astera Watch - Preprocessing Specification

This document describes the preprocessing actually applied to the real Sentinel-1,
Sentinel-2, and MCD64A1 data. It is written to be reproducible from
`scripts/acquire_real_data.py` and `scripts/build_real_dataset.py`.

---

## 1. Analysis grid

For each event:

1. Take the burn-scar centroid computed from MCD64A1 (not a hand-placed point).
2. Build a local UTM grid in the appropriate zone (EPSG:32610 or EPSG:32611).
3. Use a 16 km x 16 km AOI, 800 x 800 pixels at 20 m.
4. Store the grid transform, CRS, bounds, and shape in the event metadata.

All layers are read directly onto this grid. This avoids resampling already-resampled
products and keeps Sentinel-1, Sentinel-2, and MCD64A1 pixel-aligned.

---

## 2. Sentinel-1 RTC

### 2.1 Selection

For each requested date:

- filter STAC items by exact date, relative orbit, and orbit pass;
- rank remaining items by AOI footprint coverage;
- reject dates with no matching item and record the missing date in the QA metadata.

Mixing orbits or passes within an event is prohibited because incidence angle and
geometry change the backscatter distribution.

### 2.2 Reading and radiometry

- Bands: `vv`, `vh`
- Resampling: average (continuous power)
- Values `<= 0` are fill/no-data and become `NaN`.
- Power is converted to dB only when a dB product is needed:

`dB = 10 * log10(power)`

Missing values stay `NaN`; no epsilon floor is used for real-data processing. (The
synthetic pipeline's `linear_to_db` helper has an epsilon floor; the real pipeline uses
`power_to_db` in `scripts/run_real_pipeline.py` to preserve missingness.)

### 2.3 Validity

A pixel is Sentinel-1-valid only if pre and post VV and VH are all finite and positive.
Per-date valid fractions are recorded in `metadata.json`.

---

## 3. Sentinel-2 L2A

### 3.1 Tile selection

Scene-wide cloud cover is not sufficient. A tile can advertise 0% cloud and still be
mostly no-data over a small AOI at a swath edge. The acquisition code therefore:

1. collects up to eight same-date candidates;
2. reads the 20 m `SCL` band over the AOI for each candidate;
3. computes the fraction of usable classes (4, 5, 6, 7);
4. selects the tile with the highest usable fraction, breaking ties by AOI coverage and
   then by lower scene cloud cover.

This fixed an earlier failure where Gann used a tile with 58.3% class-0 no-data and only
55 training patches. The corrected Gann tiles have 99.9% and 98.2% usable SCL over the
AOI.

### 3.2 Reflectance

- Bands: `B04` (red), `B08` (NIR), `B12` (SWIR-2)
- Resampling: bilinear
- L2A integer reflectance is scaled by the asset metadata scale (typically 1/10000).
- The BOA offset is applied when present in the asset metadata.
- Non-positive or non-finite reflectance becomes `NaN`.

### 3.3 Scene classification

Only SCL classes 4-7 are used:

| Class | Meaning | Used |
|---|---|---|
| 4 | vegetation | yes |
| 5 | bare soil | yes |
| 6 | water | yes |
| 7 | unclassified | yes |
| 0 | no-data | no |
| 1 | saturated/defective | no |
| 2 | cast shadow | no |
| 3 | cloud shadow | no |
| 8 | medium-probability cloud | no |
| 9 | high-probability cloud | no |
| 10 | thin cirrus | no |
| 11 | snow/ice | no |

SCL is resampled with **nearest neighbour**, never bilinear.

---

## 4. Reference labels

### 4.1 NBR and dNBR

`NBR = (B08 - B12) / (B08 + B12)`

`dNBR = NBR_pre - NBR_post`

The optical validity mask requires:

- usable SCL in both dates;
- finite positive B08 in both dates;
- finite positive B12 where the NBR ratio is formed;
- valid Sentinel-1 pre and post pixels.

### 4.2 Threshold calibration

The dNBR threshold is selected on the **TRAIN event only**:

- candidate thresholds: 0.02 to 0.40, step 0.01;
- reference: MCD64A1 burn mask;
- metric: pixel F1;
- selected threshold: **0.11** (F1 0.8447, precision 0.8443, recall 0.8452).

The threshold is then frozen and applied to validation/test. There is no test-driven
threshold search.

### 4.3 MCD64A1 handling

- Read `Burn_Date` from the MCD64A1 granule.
- Reproject to the 20 m UTM grid with nearest-neighbour resampling.
- A pixel is burned if its burn date falls inside the event's DOY window.
- Multiple granules are combined with a pixel-wise maximum.
- MCD64A1 is never used to fit SAR model weights; it is an independent coarse check.

---

## 5. Patch extraction

- Patch size: 128 x 128 pixels.
- Stride: 64 pixels (50% overlap).
- Minimum valid fraction per patch: 0.25.
- A patch is rejected if the paired pre/post sample cannot be formed.
- Global cap: 10,000 samples, enforced by `GlobalSampleTracker`.
- Final count: 336 samples (121 TRAIN / 121 VAL / 94 TEST).
- Event assignment is fixed before extraction; patches from one event never enter another
  split.

Patch channels are the same five dB channels used by the U-Net:

`[VV_pre, VH_pre, VV_post, VH_post, dVH]`

where `dVH = VH_post - VH_pre`.

---

## 6. Missing-data strategy

1. Build and store the validity mask first.
2. Compute per-channel means over finite TRAIN pixels only.
3. Replace `NaN` with the corresponding TRAIN mean for model input.
4. Never fill across split boundaries.
5. Keep the validity mask for metric computation and for masking predictions.

This prevents invalid pixels from silently becoming a class while still giving the neural
network a finite input tensor. LightGBM also receives filled features; its metrics are
computed only on valid pixels.

---

## 7. Full-scene inference

To avoid reporting only overlapping patch metrics, the experiment script performs
full-scene inference:

- rebuild the five-channel dB stack from the prepared 800 x 800 arrays;
- fill missing values with TRAIN means;
- normalize with TRAIN mean/std;
- tile with 128 x 128 windows, stride 64 (50% overlap), and edge-aware positions so the
  entire scene is covered;
- average probabilities in overlaps;
- compute metrics only on the full-scene validity mask.

This is stricter than patch-level scoring and avoids double-counting the 50% overlap.

---

## 8. Temporal stack and CUSUM

- All four real Sentinel-1 dates per event are used, in chronological order.
- CUSUM requires at least three observations; all included events have four.
- Missing temporal pixels are filled with the pixel's temporal median (or -17 dB if the
  entire time series is missing) so a single missing date does not poison the score.
- Baseline: the first acquisition only (the only reliably pre-fire date in each event).
- Allowance `k = 0.5`; decision threshold `h` selected on the VAL event from
  `{2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0}`.
- Selected `h = 3.5`.
- CUSUM is unsupervised; its output is a persistent-downward-change mask, not a
  calibrated burn probability.

---

## 9. Leakage controls

The following are enforced in code and recorded in the manifests:

- split by event before patch generation;
- no event in two splits;
- dNBR threshold fitted on TRAIN only;
- normalization fitted on TRAIN only;
- LightGBM early stopping on VAL only;
- U-Net checkpoint selection on VAL only;
- U-Net probability threshold selected on VAL only;
- CUSUM `h` selected on VAL only;
- TEST evaluated once;
- no TEST data used in any fit or selection step.

The test event is not used to make the results look better. Known domain-shift and
label-disagreement problems are reported in `docs/DATASET_CARD.md` and
`reports/REAL_DATA_RESULTS.md`.

---

## 10. Reproduce

```powershell
python scripts/acquire_real_data.py --event all
python scripts/build_real_dataset.py
python scripts/run_real_pipeline.py --epochs 8
```

The acquisition step requires network access to Microsoft Planetary Computer. It does not
require credentials. NISAR acquisition is a separate, currently blocked path because
Earthdata Login is mandatory.
