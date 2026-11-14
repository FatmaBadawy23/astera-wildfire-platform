# Astera Watch - Dataset Card

**Dataset name:** Astera Watch Real Cross-Sensor Wildfire Prototype (2026)
**Version:** 2.0.0 (real-data prototype)
**Created:** 2026-11-13
**Data origin:** `CROSS_SENSOR_PROTOTYPE`
**NISAR used:** No
**Primary input sensor:** Sentinel-1 RTC C-band (VV/VH)
**Reference labels:** Sentinel-2 L2A dNBR
**Independent coarse check:** MCD64A1 burned area

---

## 1. Overview

This dataset contains event-grouped, paired pre/post Sentinel-1 patches and reference
burned-area masks for three 2026 California/Nevada wildfires. It replaces the earlier
synthetic benchmark, which is retained separately for historical reproducibility but is
clearly marked as synthetic.

| Property | Value |
|---|---|
| Model-ready samples | **336** |
| Hard sample cap | 10,000 |
| Patch size | 128 x 128 pixels |
| Patch stride | 64 pixels |
| Pixel size | 20 m x 20 m (400 m2) |
| AOI size | 16 km x 16 km (800 x 800 pixels) |
| CRS | UTM zone 10N (EPSG:32610) or 11N (EPSG:32611), per event |
| Input channels | 5 (VV pre, VH pre, VV post, VH post, dVH) |
| Label channels | dNBR-derived binary mask, MCD64A1 mask, validity mask |
| Train / Val / Test | 121 / 121 / 94 patches |
| Split unit | Whole wildfire event |

The sample count is well below the 10,000 cap. Overlapping patches are retained because
the cap is a ceiling, not a target; paired pre/post patch = one sample.

An exact-duplicate audit over the stored patch tensors found 121/121/94 unique hashes
(336 unique hashes in total), so there are no repeated samples within or across splits.

---

## 2. Events and split allocation

Splitting was performed **by event before patch extraction**. No event contributes patches
to more than one split.

| Event ID | Fire | Region | Split | Reported start | Reported acres | S1 dates | S2 pair | Patches |
|---|---|---|---|---|---|---|---|---|
| `CA_GANN_2026` | Gann Fire | Calaveras County, California | TRAIN | 2026-08-03 | 10,339 | 2026-07-26 / 08-07 / 08-19 / 08-31 | 2026-07-29 / 08-30 | 121 |
| `CA_DOME_2026` | Dome Fire | Yosemite area, California | VAL | 2026-09-21 | 6,159 | 2026-09-13 / 10-01 / 10-07 / 10-19 | 2026-09-12 / 10-07 | 121 |
| `CA_BUG_2026` | Bug Fire | Lassen/Sierra California and Washoe County, Nevada | TEST | 2026-08-08 | 93,733 | 2026-08-03 / 08-15 / 08-27 / 09-08 | 2026-08-06 / 08-30 | 94 |
| `CA_TIMBER_2026` | Timber Fire | Monterey County, California | EXCLUDED | 2026-08-09 | 25,435 | 2026-08-07 / 08-19 / 08-31 / 09-12 | 2026-07-27 / 08-26 | acquisition only |

Reported acreage is public incident reporting. It is not used to derive labels or to
compute model metrics.

### Why Timber is excluded

The MCD64A1 burn window in the Timber AOI aggregates the overlapping Timber/Plaskett
complex, and the Sentinel-1 VH signal showed no coherent scar (median log-ratio +0.07 dB
inside the MCD burn mask vs -0.08 dB outside). Including it would inject label noise into
training. The stack is retained as acquisition evidence and for future re-analysis with
independent perimeter data.

---

## 3. Reference labels

### 3.1 Primary label: Sentinel-2 dNBR

NBR is computed from surface reflectance as:

`NBR = (B08 - B12) / (B08 + B12)`

`dNBR = NBR_pre - NBR_post`

Only pixels that are usable in both Sentinel-2 acquisitions are included:

- SCL classes 4 (vegetation), 5 (bare), 6 (water), 7 (unclassified)
- finite positive reflectance in both dates
- valid Sentinel-1 pre and post pixels

The dNBR threshold was calibrated **on the TRAIN event only** against MCD64A1:

| Property | Value |
|---|---|
| Selected threshold | **0.11** |
| Calibration event | Gann Fire (`CA_GANN_2026`) |
| Calibration metric | pixel F1 vs MCD64A1 |
| Calibration F1 | 0.8447 |
| Calibration precision / recall | 0.8443 / 0.8452 |

The same threshold was then applied unchanged to validation and test. It was not tuned on
Dome or Bug.

### 3.2 Independent coarse check: MCD64A1

| Event | dNBR label fraction (valid) | MCD64A1 fraction (valid) | dNBR vs MCD F1 | Precision | Recall |
|---|---|---|---|---|---|
| Gann (TRAIN) | 0.1445 | 0.1444 | 0.8447 | 0.8443 | 0.8452 |
| Dome (VAL) | 0.0697 | 0.0569 | 0.5851 | 0.5314 | 0.6509 |
| Bug (TEST) | 0.5014 | 0.7459 | 0.7811 | 0.9716 | 0.6531 |

The Bug disagreement is large: dNBR identifies about 50% of valid pixels as burned, while
MCD64A1 identifies about 75%. Possible causes include 500 m MCD aggregation, late-season
regrowth/green-up by the 2026-08-30 Sentinel-2 post date, threshold transfer, and the
different physical definitions of the two products. This is a label-uncertainty finding,
not something to hide by tuning on the test event.

---

## 4. Channels and file layout

Each patch has shape `(5, 128, 128)`, in dB:

1. `VV_pre`
2. `VH_pre`
3. `VV_post`
4. `VH_post`
5. `dVH = VH_post - VH_pre`

Each target has shape `(1, 128, 128)`, `uint8`:

- `labels`: dNBR >= 0.11 on valid pixels
- `mcd`: MCD64A1 burn mask on valid pixels (independent check)
- `valid`: usable Sentinel-1 and Sentinel-2 pixels

Files:

```
data/real/
  acquisition_manifest.json
  {EVENT_ID}/stack.npz
  {EVENT_ID}/metadata.json
  {EVENT_ID}/qa_s1.png
  {EVENT_ID}/qa_labels.png
  dataset/
    train.npz
    val.npz
    test.npz
    dataset_manifest.json
    norm_stats.json
    prepared/{EVENT_ID}.npz
```

`prepared/{EVENT_ID}.npz` contains the full 800 x 800 aligned scene used for full-scene
evaluation, including the four-date temporal VH stack used by CUSUM.

---

## 5. Normalization and leakage controls

- Normalization is fitted on the **TRAIN** split only.
- Means (dB): `[-10.550, -16.976, -10.606, -17.242, -0.266]`
- Standard deviations (dB): `[3.562, 3.969, 3.549, 3.881, 2.109]`
- Missing pixels are filled with the corresponding TRAIN mean after the validity mask is
  recorded. Filling never changes the label or validity mask.
- Train augmentation: random horizontal flip, vertical flip, and 90-degree rotation. No
  augmentation is applied to validation or test.
- The dNBR threshold, LightGBM early stopping, U-Net checkpoint, U-Net probability
  threshold, and CUSUM `h` are selected on TRAIN or VAL only.
- The TEST event is evaluated once and is never used to select a threshold or epoch.

---

## 6. Class balance and data quality

| Split | Event | Patch label fraction | Patch valid fraction |
|---|---|---|---|
| TRAIN | Gann | 0.183 | 0.977 |
| VAL | Dome | 0.085 | 0.947 |
| TEST | Bug | 0.504 | 0.936 |

Scene-level validity and burn fractions differ from patch-level values because patches
overlap and are selected by a minimum-validity rule. Full-scene metrics are reported in
`outputs/evaluation/real_model_comparison.json`; those are the primary results.

Known quality issues:

1. **Severe class-prior shift.** TEST is about 50% burned; TRAIN is about 14% burned.
   The trivial all-burned baseline therefore has a high TEST F1 (0.668). Model F1 must be
   interpreted against that baseline.
2. **Sentinel-1 swath edge on Bug.** Only about 72.8% of the AOI has valid Sentinel-1 in
   both dates. The test domain is smaller and spatially non-random.
3. **Single event per split.** There is no multi-event estimate of variance. Event-level
   generalisation is a hypothesis, not a established property.
4. **Cross-sensor labels.** SAR models are trained against optical dNBR labels. The label
   and input measure different physical quantities.
5. **No NISAR.** The dataset contains no L-band data.

---

## 7. Intended use

Suitable for:

- Reproducible cross-sensor SAR/optical burned-area experiments
- Testing event-grouped leakage controls
- Comparing classical, tree-based, deep, and temporal baselines under domain shift
- Demonstrating the NISAR-ready data contract and adapter path

Not suitable for:

- Claims about NISAR performance
- Operational burned-area mapping without independent validation
- Treating dNBR or MCD64A1 as ground truth
- Estimating fire severity, carbon loss, or suppression effectiveness
- Generalising to other vegetation types or seasons without new validation

---

## 8. Provenance

Every acquired stack stores:

- event specification and split
- STAC item IDs and asset URLs
- acquisition datetimes, relative orbit, and pass
- Sentinel-2 scene cloud cover and AOI SCL-valid fraction
- MCD64A1 item IDs, burn windows, and burned fractions
- SHA-256 checksums of aligned arrays/stacks

See `data/real/acquisition_manifest.json` and
`data/real/dataset/dataset_manifest.json`. The dataset card intentionally records the
label disagreement instead of selecting the more flattering reference.
