# Phase 1 — Data-Source and Method Research

**Date:** 2026-11-13
**Purpose:** establish, from official documentation and live endpoint checks, what can
and cannot be used to train and evaluate a wildfire burned-area model for Astera Watch.

---

## 1. NISAR GCOV — verified specification

Primary source: NASA/JPL *NISAR Data User Guide*, GCOV page
(<https://nisar-docs.asf.alaska.edu/gcov>) and the Level-2 GCOV product specification
JPL D-102274 Rev F.

### 1.1 What GCOV is

- Level-2, geocoded, **radiometrically terrain corrected gamma-0** backscatter.
- Comparable in use to Sentinel-1 RTC/NRB products, but at **L-band** (24 cm).
- Projected to the appropriate UTM zone.
- Pixel spacing 10 m or 20 m for L-band depending on bandwidth; 80 m for some modes.

### 1.2 HDF5 hierarchy (confirmed)

```text
/science/LSAR/GCOV/grids/frequencyA/
    HHHH  HVHV  VVVV  VHVH          # diagonal terms, real-valued
    HHHV  HHVH  HHVV  HVVH  HVVV  VHVV  RHRV   # off-diagonal, complex, quad-pol only
    numberOfLooks
    mask
    rtcGammaToSigmaFactor
/science/LSAR/GCOV/grids/frequencyB/...
```

Key corrections to the existing adapter:

- **`mask` is not a binary validity mask.** The guide describes it as information about
  the averaging ensemble of radar samples used by adaptive multi-looking. It must not be
  interpreted as “valid/invalid” without reading the product specification's bit
  definitions.
- **Off-diagonal covariance terms are complex.** A reader that casts every polarization
  dataset to `float32` will fail on quad-pol products.
- **`rtcGammaToSigmaFactor`** converts gamma-0 to sigma-0. It is not a calibration
  constant to be applied silently; the analysis must state which convention it uses.
- Diagonal terms (`HHHH`, `HVHV`, `VVVV`, `VHVH`, `RHRH`, `RVRV`) are the ones usable
  directly as intensity/backscatter.

### 1.3 Maturity and availability (as of 2026-11-13)

| Release | Date | Coverage | Notes |
|---|---|---|---|
| BETA | Feb 2026 | Oct 2025 – Jan 2026 subset | Not fully calibrated |
| PROVISIONAL | 2026-07-20 | Acquisitions from 2026-06-17 to part of 2026-10-23 | Calibrated, partially validated |
| VALIDATED | 2026-11-06 | L0–L2 from 2026-10-21 onward | Fully calibrated and validated |

**Critical for this project:** a permanent instrument data gap exists between
`2026-07-27T22:03:25Z` and `2026-08-10T00:55:27Z`. Any August 2026 fire whose pre-fire
window falls inside that gap cannot be paired with a NISAR pre-fire acquisition unless
an earlier acquisition (before 2026-07-27) is used.

### 1.4 Access requirement

- NISAR science data is archived at ASF and is free, but **requires Earthdata Login
  (EDL)**.
- Anonymous HDF5 requests are redirected to `urs.earthdata.nasa.gov` and rejected.
- Browse images are public; science layers are not.
- A `.netrc` with `machine urs.earthdata.nasa.gov login <user> password <pass>` or
  environment-based EDL credentials are required.

**Consequence:** genuine NISAR training is blocked in this environment. This is a
credential/access limitation, not a data-availability limitation.

---

## 2. Sentinel-1 RTC — cross-sensor stand-in

Source: Microsoft Planetary Computer collection `sentinel-1-rtc`.

- Sentinel-1 C-band (5.405 GHz), GRD-derived radiometric terrain correction.
- 10 m pixel spacing, UTM projection, linear gamma-0 power.
- Dual-pol VV/VH for the 2026 IW GRD acquisitions used here.
- Available at 6–12 day cadence depending on the Sentinel-1 constellation configuration.
- Open access; no EDL required. Signing is done with
  `GET https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=<asset>`.

**Why it is not NISAR:** different frequency (C vs L), different wavelength, different
penetration and scattering physics. A model trained on C-band must never be reported as
a NISAR model. It is a **cross-sensor prototype**, useful for pipeline validation and
for a later L-band transfer experiment.

---

## 3. Sentinel-2 L2A — optical reference

Source: Microsoft Planetary Computer collection `sentinel-2-l2a`.

- Bands used: `B04` (red, 10 m), `B08` (NIR, 10 m), `B12` (SWIR2, 20 m), `SCL`
  (scene classification, 20 m).
- Normalized Burn Ratio: `NBR = (B08 - B12) / (B08 + B12)`.
- Differenced NBR: `dNBR = NBR_pre - NBR_post`.
- Cloud/shadow/snow masking from `SCL`: keep classes 4 (vegetation), 5 (bare),
  6 (water), 7 (unclassified); reject 3, 8, 9, 10, 11.
- dNBR thresholds are **not universal**. The standard 0.27 threshold is forest-oriented;
  the Bug Fire AOI is sagebrush/bare ground and showed a much lower separation
  (burn median dNBR ≈ 0.13, unburned ≈ 0.02). Any threshold must be calibrated on the
  training event and reported.

**Role in this work:** independent optical reference for cross-checking. It is not
ground truth and it is not used to claim NISAR performance.

---

## 4. MCD64A1 — official burned-area labels

Source: Microsoft Planetary Computer collection `modis-64A1-061`, tile `h08v05`.

- 500 m monthly global burned-area product.
- `Burn_Date` layer: day-of-year of burning, 0 = unburned, -1 = fill.
- August 2026 composite `A2026213` and September 2026 composite `A2026244` are
  available for the study area.
- In the Bug Fire AOI, burn dates span DOY 219–240 (2026-08-07 to 2026-08-28), matching
  the reported fire window.

**Limitations:** 500 m resolution, monthly compositing, commission/omission errors,
and a minimum mapping unit that misses small fires. It is an official burned-area
product, not field truth.

**Role in this work:** primary independent burned-area label at coarse resolution.
Because it is much coarser than the 20 m analysis grid, all label-derived metrics carry
a resolution caveat.

---

## 5. FIRMS — active-fire evidence only

- Requires a `MAP_KEY`; none is configured.
- Even when available, FIRMS detections are **active-fire points**, not burned-area
  polygons and not ground truth.
- It may be used for event dating or as a sanity check, never as a segmentation label.

---

## 6. Verified 2026 wildfire events

The following events were selected because they are real, recent, and covered by both
Sentinel-1 and Sentinel-2 in the study period. Coordinates below are the **burn-scar
centroids computed from MCD64A1**, not hand-entered approximations.

| Event | Region | Reported ignition | Reported size | MCD64A1 burn window (DOY) | MCD64A1 centroid |
|---|---|---|---|---|---|
| Gann Fire | Calaveras County, CA | 2026-08-03 | ~10,339 acres | 215–220 (Aug 3–8) | 38.113 N, 120.734 W |
| Dome Fire | Yosemite area, CA | 2026-09-21 | ~6,159 acres | 256–272 (Sep 13–29) | 37.612 N, 119.613 W |
| Bug Fire | Lassen/Sierra CA + Washoe NV | 2026-08-08 | 93,733 acres | 219–240 (Aug 7–28) | 39.830 N, 119.887 W |
| Timber Fire | Monterey County, CA | 2026-08-09 | 25,435 acres | 219–243 (Aug 7–31) | 36.211 N, 121.668 W |

Reported ignition dates and acreages come from public incident reporting and are
recorded as **reported values**, not as measurements made here. The MCD64A1 windows are
the values actually observed in the data and are the ones used for labelling.

Event assignment for the study:

- **TRAIN:** Gann Fire, Timber Fire
- **VAL:** Dome Fire
- **TEST:** Bug Fire (held out for the entire study; never used for fitting or tuning)

Splitting is by event **before** patch extraction, so no patch from a test event can
appear in training.

---

## 7. What genuine NISAR training would require

1. **Earthdata Login credentials** in `.env` or `.netrc` (never committed).
2. **ASF/earthaccess download** of GCOV granules for the same relative orbit and pass
   before and after each fire.
3. **Verification of the real HDF5 hierarchy** on a downloaded granule, including:
   - `listOfPolarizations` values and dataset dtypes;
   - `mask` bit semantics from the product specification;
   - `xCoordinates`/`yCoordinates` and projection metadata;
   - `zeroDopplerStartTime` and identification metadata.
4. **Consistent L-band geometry**: same track/frame and pass for pre/post; otherwise
   incidence-angle and speckle differences contaminate the log-ratio.
5. **A pre-fire acquisition outside the 2026-07-27 → 2026-08-10 gap**, or a fire whose
   window does not overlap the gap.
6. **Independent labels**: MCD64A1 and/or high-resolution fire perimeters; not FIRMS.
7. **Evaluation on held-out events**, with per-event reporting and area error.
8. **A documented L-band threshold policy**: no transfer of C-band dB thresholds.

Until 1–5 are satisfied, any “NISAR model” claim is unsupported. The present work
therefore delivers a **cross-sensor prototype** and a NISAR-ready adapter/pipeline, not
a trained NISAR model.

---

## 8. Method decisions

- Analysis grid: 20 m, local UTM zone, 16 km × 16 km AOI around each burn-scar
  centroid (chosen to keep the scar and surrounding unburned area inside the Sentinel-1
  swath; larger boxes lost up to a third of their area to swath-edge fill).
- S1 pre/post: same relative orbit and pass, 2–4 dates per event.
- S1 features: VV and VH gamma-0 in dB, plus VH log-ratio and VV log-ratio.
- S2: pre/post NBR, dNBR, SCL-derived validity.
- Labels: MCD64A1 burn date within the event's observed burn window (primary);
  S2 dNBR (independent cross-check).
- Samples: 256 × 256 patches at 20 m, stride 128, global cap 10,000, event-grouped.
- Models: mandatory log-ratio baseline, LightGBM, U-Net ResNet-34. CUSUM only on the
  test event with ≥3 S1 dates.
- No test-driven tuning. Normalization fitted on training patches only.
