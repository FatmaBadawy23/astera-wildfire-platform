# Phase 0 — Read-Only Project Audit

**Project:** Astera Watch — Wildfire surface-change monitoring with NASA NISAR
**Repository:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`
**Branch:** `feature/sar-ml-pipeline`
**Audit date:** 2026-11-13
**Auditor mode:** read-only inspection; no production code was modified during this phase.

---

## 1. Executive summary

The repository contains a coherent, well-structured prototype for SAR-based burned-area
detection, but **the scientific results currently presented by the application and the
reports are not derived from real NISAR data**. They are derived from synthetic scenes
generated at runtime by `backend/processing/adapters/mock_adapter.py`, then written as
NISAR-shaped HDF5 files and reported with labels such as `NASA_NISAR_MOCK_CALIBRATED`.

The prototype architecture is worth preserving: the adapter interface, preprocessing
modules, change detectors, model wrappers, FastAPI layer, and tests are a reasonable
foundation. The **claims, defaults, and provenance labels are not**.

This audit establishes three things:

1. What is genuinely implemented and working.
2. Which outputs are synthetic and must never be presented as NISAR results.
3. What real, openly accessible data can replace the synthetic path, and what remains
   blocked by missing credentials.

The audit does not modify code, tests, or data.

---

## 2. Method

- Read every tracked and untracked source file in `backend/`, `scripts/`, `docs/`,
  `reports/`, `data/`, `outputs/`.
- Traced the execution path from `scripts/run_scientific_pipeline.py` and
  `backend/app/services/analysis_service.py` to the synthetic generators.
- Ran the existing suite without changes.
- Probed official data endpoints over HTTPS (ASF, Earthdata, AWS Open Data,
  Microsoft Planetary Computer) to establish what is actually reachable without
  credentials.
- Compared repository claims against observed artefacts (`outputs/`, `models/`,
  `data/mock/`).

---

## 3. Repository inventory

### 3.1 Source modules (untracked working tree)

| Path | Role | Status |
|---|---|---|
| `backend/processing/adapters/base.py` | Canonical `SARScene`, `RasterLayer`, `ValidationReport` | Implemented |
| `backend/processing/adapters/mock_adapter.py` | Synthetic paired-scene generator and mock HDF5 writer | Implemented, synthetic by design |
| `backend/processing/adapters/nisar_gcov_adapter.py` | NISAR GCOV HDF5 reader | Implemented against documented hierarchy; **never run on a real NISAR file** |
| `backend/processing/acquisition/asf_client.py` | ASF search/download client | Implemented; download path requires Earthdata Login |
| `backend/processing/acquisition/firms_client.py` | FIRMS client | Implemented; no `MAP_KEY` present |
| `backend/processing/preprocessing/radiometry.py` | Linear/dB conversions | Implemented |
| `backend/processing/preprocessing/log_ratio.py` | Log-ratio change | Implemented |
| `backend/processing/preprocessing/filters.py` | Speckle/median filters | Implemented |
| `backend/processing/change_detection/log_ratio_detector.py` | Adaptive log-ratio | Implemented |
| `backend/processing/change_detection/cusum.py` | CUSUM temporal detector | Implemented |
| `backend/processing/models/dataset.py` | Patch extraction, 10k tracker, split handling | Implemented |
| `backend/processing/models/lightgbm_model.py` | Pixel/spatial LightGBM | Implemented |
| `backend/processing/models/unet_resnet.py` | U-Net + ResNet-34 | Implemented; encoder trained from scratch |
| `backend/processing/models/trainer.py` | Training loop | Implemented |
| `backend/processing/validation/metrics.py` | Segmentation and area metrics | Implemented |
| `backend/app/api/endpoints.py` | FastAPI routes | Implemented |
| `backend/app/services/analysis_service.py` | Analysis job service | **Fabricates metrics** (see §5) |
| `backend/app/main.py`, `schemas/api_schemas.py` | API app/schemas | Implemented |
| `scripts/run_scientific_pipeline.py` | Master pipeline | **Generates synthetic data at runtime** |
| `frontend/` | UI | Only `public/astera-logo.jpg`; no application code |

### 3.2 Tests

`backend/tests/`: `test_adapters.py`, `test_api.py`, `test_metrics.py`,
`test_models.py`, `test_preprocessing.py`.

Baseline run on 2026-11-13:

```text
python -m pytest backend/tests -q
19 passed, 3 warnings in 16.91s
```

All fixtures are synthetic. No test reads a real satellite product. The tests therefore
verify plumbing, not scientific validity.

### 3.3 Data and model artefacts

- `data/mock/` — six synthetic HDF5 files for `OR_ROWE_CREEK_2026`,
  `OR_HAY_CREEK_2026`, `WA_SPOKANE_2026`.
- `data/events_manifest.json` / `.csv` — fabricated events, coordinates, dates, acreage.
- `models/checkpoints/unet_resnet34_best.pt` — ~349 MB checkpoint trained on the
  synthetic scenes.
- `outputs/evaluation/scientific_model_comparison.json` — synthetic benchmark values
  (e.g. test F1 0.9758).

### 3.4 Documentation

| Document | Current problem |
|---|---|
| `README.md` | Presents synthetic metrics as project results |
| `docs/DATASET_CARD.md` | Describes the synthetic dataset as NISAR data |
| `docs/MODEL_CARD.md` | Reports synthetic metrics without a synthetic-data warning |
| `docs/DATA_SOURCES.md` | Mixes real source descriptions with the mock pipeline |
| `docs/PREPROCESSING.md` | Describes intended processing, not verified real-data processing |
| `docs/EXPERIMENTS.md` | Reports the synthetic benchmark as an experiment |
| `reports/FINAL_SCIENTIFIC_DELIVERABLE_REPORT.md` | Claims 9.45/10 readiness on synthetic results |
| `reports/scientific_research/SCIENTIFIC_RESEARCH_REPORT.md` | Contains NISAR assumptions that needed verification |

---

## 4. What is genuinely real

- The Python/FastAPI/processing architecture and interfaces.
- The mathematical implementations of log-ratio, CUSUM, metrics, patch extraction,
  normalization, and the model wrappers.
- The **existence** of real NISAR GCOV granules over the western US in 2026, verified
  through the ASF search API.
- Real, credential-free access to **Sentinel-1 RTC**, **Sentinel-2 L2A**, and
  **MCD64A1** through Microsoft Planetary Computer (verified by windowed reads in §6).
- Real 2026 wildfire events that can anchor an honest cross-sensor prototype.

## 5. Integrity findings (must be corrected)

### F1 — Runtime synthesis presented as NISAR

`scripts/run_scientific_pipeline.py` calls `generate_paired_sar_scene()` for every event,
writes the arrays to `data/mock/*_gcov.h5`, and then evaluates every model on those
arrays. The output JSON does not carry a synthetic-data flag. A reader cannot tell that
the scenes never came from NISAR.

### F2 — Fabricated metrics in the API

`backend/app/services/analysis_service.py`:

- reads `test_f1`, `test_iou`, etc. from the synthetic comparison file;
- if a key is missing, substitutes hard defaults (`0.95`, `0.90`, `0.94`, `0.96`, `0.99`);
- fixes `burn_ref = 7848` and `total_pixels = 262144` regardless of the event;
- reconstructs a confusion matrix from those constants;
- returns `data_origin = "NASA_NISAR_MOCK_CALIBRATED"`.

The confusion matrix is therefore algebraically consistent but empirically meaningless.

### F3 — Fabricated event catalogue

`data/events_manifest.json` lists `OR_ROWE_CREEK_2026`, `OR_HAY_CREEK_2026`, and
`WA_SPOKANE_2026` with coordinates, ignition dates, and acreage that could not be
verified. They do not correspond to the real 2026 fire season used in this audit.

### F4 — Unverified NISAR reader assumptions

`nisar_gcov_adapter.py` assumes:

- a `mask` layer that behaves like a validity mask (the official guide describes it as
  information about the averaging ensemble);
- diagonal covariance terms are always real and can be cast to `float32` (off-diagonal
  terms are complex);
- a fallback acquisition time of `2026-01-01T00:00:00Z` when metadata is absent.

The hierarchy itself (`/science/LSAR/GCOV/grids/frequencyA`) is correct per the
official product guide. The reader has never been executed against a real granule.

### F5 — Misleading readiness claim

`reports/FINAL_SCIENTIFIC_DELIVERABLE_REPORT.md` assigns 9.45/10 readiness. That number
is computed from synthetic benchmark output and must be withdrawn.

### F6 — Model card without training-set provenance

`docs/MODEL_CARD.md` reports high scores but does not state that the training and test
scenes were generated by the same simulator with the same burn model. That is a
simulator-consistency result, not a generalization result.

### F7 — Empty product surface

The database models are empty, and the frontend contains only a logo. The README and
final report describe a product that does not exist in the repository.

---

## 6. Real data access verification (2026-11-13)

All checks below were executed from the repository environment. No credentials were
used or printed.

### 6.1 NISAR GCOV

- ASF search API: `https://api.daac.asf.alaska.edu/services/search/param`
  returns NISAR GCOV granules over the western US for August–September 2026.
- Example granule:
  `NISAR_L2_PR_GCOV_031_149_A_027_4005_DHDH_A_20260928T123936_...h5`.
- Direct HDF5 download redirects to Earthdata Login and returns HTTP 401 without
  credentials.
- Browse PNGs are public; science data is not.
- **Blocker:** Earthdata Login username/password are absent (`.env` missing, `.netrc`
  missing, environment variables unset). EDL is mandatory for NISAR science data.
- **Official availability note:** PROVISIONAL products cover acquisitions from
  2026-06-17 to part of 2026-10-23 and contain a mission data gap from
  `2026-07-27T22:03:25Z` to `2026-08-10T00:55:27Z`. VALIDATED L0–L2 products begin
  2026-10-21. This gap directly affects August 2026 fire pre/post pairing.

### 6.2 Sentinel-1 RTC (Microsoft Planetary Computer)

- STAC search `sentinel-1-rtc` over the Bug Fire AOI returned 75 granules for
  July–October 2026, including ascending relative orbit 64 and descending 144.
- SAS signing works through `GET /api/sas/v1/sign?href=<asset>`.
- A windowed read of `iw-vh.rtc.tiff` at 10 m over the AOI succeeded.
- Data are gamma-0 RTC linear power, not NISAR L-band.
- **Status:** usable for an explicitly labelled cross-sensor prototype.

### 6.3 Sentinel-2 L2A (Microsoft Planetary Computer)

- STAC search returned low-cloud acquisitions over the same AOIs.
- Assets `B04`, `B08`, `B12`, `SCL` were read through signed URLs and reprojected to a
  20 m analysis grid.
- A dNBR computation over the Bug Fire AOI produced a burn signal consistent with the
  MCD64A1 burn extent.
- **Status:** usable as an independent optical reference and for cross-checks.

### 6.4 MCD64A1 burned area (Microsoft Planetary Computer)

- Collection `modis-64A1-061`, tile `h08v05`, monthly composites `A2026213` (August)
  and `A2026244` (September) are available for 2026.
- Burn dates in the Bug Fire AOI span DOY 219–240 (2026-08-07 to 2026-08-28), which
  matches the reported fire window.
- **Status:** usable as an official coarse burned-area label (500 m).

### 6.5 FIRMS

- No `FIRMS_MAP_KEY` is configured; area API calls fail with HTTP 400 and the 24 h CSV
  is header-only.
- FIRMS is active-fire evidence, never a burned-area label. Not used for labels.

---

## 7. Environment

- OS: Windows; system Python 3.13.7 at `C:\Program Files\Python313\python.exe`.
- The repository's documented Conda env `astera` does not exist on this machine.
  Work therefore uses the existing system environment.
- Present: numpy, scipy, pandas, h5py, rasterio 1.5.2 (GDAL 3.12.2), pyproj,
  geopandas, shapely, torch 2.12.1+cpu, lightgbm, scikit-learn, fastapi, httpx,
  pytest, matplotlib, opencv, Pillow.
- Missing: `osgeo`, `tifffile`, `xarray`, `rioxarray`, `earthaccess`, `asf_search`.
- CUDA unavailable; 8 CPU threads; ~22.7 GB free disk at audit time.
- No `.env`; `.env.example` has empty `EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`,
  `FIRMS_MAP_KEY`, `CDSE_*`.

---

## 8. Preservation plan

1. **Do not delete** the synthetic artefacts or the existing tests.
2. Add explicit `SUPERSEDED — SYNTHETIC DATA` banners to every report, dataset card,
   model card, and README section that reports synthetic metrics.
3. Keep the synthetic pipeline available behind an explicit `--synthetic` flag and a
   `SYNTHETIC` provenance field.
4. Add a real-data path alongside it:
   - `Sentinel-1 RTC + Sentinel-2 L2A + MCD64A1`, downloaded through Planetary Computer.
   - Clearly labelled `CROSS_SENSOR_PROTOTYPE`, never `NISAR`.
5. Replace API metric fabrication with loading of a real evaluation artefact that
   carries provenance and caveats.
6. Keep the NISAR adapter, but mark it `LIVE_VALIDATION_PENDING` and correct the
   documented semantics of `mask` and complex covariance terms.
7. Preserve the current working tree in a non-destructive checkpoint.

### Checkpoint references

- Git stash commit: `0842ac4d18a28c1b2bdb631bd0f3cf130e17002d`
- Local ref: `refs/checkpoints/pre-real-data-audit`
- Working-tree archive (source, docs, tests; excludes `.git`, model weights,
  caches): `C:\Users\asus\Desktop\Nasa\.checkpoints\pre-real-data-audit.zip`

No branch commit or push was performed.

---

## 9. Gate decision

The prototype may proceed to a real-data phase **only** if:

- synthetic results are relabelled everywhere;
- the API stops inventing metrics;
- the event catalogue is replaced with verified events;
- the real-data path carries explicit sensor and label provenance;
- the final report distinguishes NISAR readiness from cross-sensor prototype results.

Those conditions define the remainder of this work.
