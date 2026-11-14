# NASA Data Expansion - Phase 0 Read-Only Audit

**Status:** audit complete. No pipeline code, datasets, manifests, checkpoints, API
behaviour, database schema, or Git state were modified. This report is the only file
created.

**Repository:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`
**Branch:** `feature/sar-ml-pipeline`
**Audit date:** 2026-11-13
**Current committed HEAD:** `fd3eaeb Add Stage 0 report` (4 commits total)

---

## 1. Audit scope and method

This audit answers the Phase 0 questions without changing the project:

1. What data sources are already integrated?
2. Which NASA datasets are already present?
3. Which products are missing?
4. Which preprocessing steps already exist?
5. Which components can be reused?
6. Which components need extension?
7. Does the architecture support multiple sensors?
8. Does the current event split remain valid after expansion?

Method: direct inspection of every acquisition, preprocessing, dataset, model,
evaluation, API, test, documentation, and manifest file in the repository; read-only
checks of the Python environment, credentials, disk space, and Git state. No network
downloads and no acquisition runs were performed.

**Important provenance statement.** The current results are a
**CROSS_SENSOR_PROTOTYPE** built from Sentinel-1 C-band and Sentinel-2 / MCD64A1
reference layers. They are **not NISAR results**. The repository already enforces this
in `README.md`, `docs/`, `reports/`, the API health response, and
`outputs/evaluation/real_model_comparison.json` (`data_origin`, `is_nisar`).

---

## 2. Repository state (verified)

- Branch `feature/sar-ml-pipeline`; all real-data work is uncommitted/untracked.
- 70 pending paths, about 11.9 MB, excluding ignored generated arrays and checkpoints.
- No commit and no push were performed during this audit.
- Existing checkpoints, untouched:
  - `models/checkpoints/real_unet_resnet34_best.pt` - 349,204,621 bytes
  - `models/checkpoints/unet_resnet34_best.pt` - 349,200,698 bytes (synthetic, retained)
- Git ignores the large generated artifacts: checkpoints, `data/real/*/stack.npz`,
  `data/real/dataset/*.npz`, `data/real/dataset/prepared/`, prediction maps, QA PNG.
- Trackable provenance: `data/real/acquisition_manifest.json`,
  `data/real/CA_*/metadata.json`, `data/real/dataset/dataset_manifest.json`,
  `data/real/dataset/norm_stats.json`, `outputs/evaluation/real_model_comparison.json`.

### Environment (verified)

| Item | Value |
|---|---|
| Python | 3.13.7, `C:\Program Files\Python313\python.exe` |
| rasterio / GDAL | 1.5.2 / GDAL 3.12.2 |
| numpy | 2.2.6 |
| torch | 2.12.1+cpu, CUDA unavailable |
| lightgbm / scikit-learn | 4.7.0 / 1.7.1 |
| h5py | 3.14.0 |
| asf_search | 14.1.0 (installed) |
| earthaccess | **not installed** |
| pystac_client / planetary_computer | **not installed** (not required; raw HTTP client is used) |
| Free disk on C: | **14.5 GB** (a risk for NISAR acquisition) |
| Test suite | **29 passed, 3 warnings** |

### Credentials (verified)

- No `.env` file exists.
- No `EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`, `FIRMS_MAP_KEY`, or `CDSE_*`
  environment variables are set.
- No `~/.netrc`.
- `.env.example` has empty placeholders only and sets `USE_MOCK_DATA=true`, which the
  current API does not use.

**Consequence:** NISAR GCOV acquisition and FIRMS acquisition cannot run now. This is
an access blocker, not a code blocker.

---

## 3. Data sources already integrated

| Source | Product actually used | Provider / access | Role | Status |
|---|---|---|---|---|
| Sentinel-1 | `sentinel-1-rtc`, VV/VH, 20 m grid | Microsoft Planetary Computer STAC + SAS | SAR model input | Real, 4 events |
| Sentinel-2 | `sentinel-2-l2a`, B04/B08/B12/SCL, 20 m grid | Microsoft Planetary Computer | dNBR reference labels, SCL mask | Real, 4 events |
| MODIS | `modis-64A1-061`, `Burn_Date` only | Microsoft Planetary Computer | Independent coarse burned-area check, burn-scar centroid and DOY window | Real, 4 events |
| Public incident reporting | Fire name, ignition date, reported acreage | Public fire-agency reporting | Event identity only | Used in `event_specs.py` |
| NISAR | none | ASF/EDL required | Intended primary sensor | **Not acquired** |
| FIRMS | none | FIRMS API key required | Active-fire evidence | **Not acquired** |
| SMAP / MODIS LST / vegetation | none | Earthdata | Optional context | **Not integrated** |

Acquisition quality is good for the current scope:

- `data/real/acquisition_manifest.json`: 4 events, `failures = {}`.
- Every Sentinel-1 record stores STAC item ID, asset URLs, datetime, relative orbit,
  pass direction, platform, valid fraction, and SHA-256 of the aligned arrays.
- Every Sentinel-2 record stores item ID, scene cloud cover, SCL-valid fraction,
  asset URLs, and checksums.
- Every MCD64A1 record stores item ID, asset URL, burn DOY window, burned pixel count,
  burned fraction, and checksum.
- Each event has `metadata.json` and `stack.npz` (roughly 21-26 MB).
- Sentinel-1 valid fraction: Bug 0.728, Gann 0.982, Dome 0.951, Timber 1.000.
- Sentinel-2 SCL-valid fractions: Bug 1.000/1.000, Dome 0.996/0.951,
  Gann 0.999/0.982, Timber 0.997/0.906.

Checksums are computed over the **aligned analysis arrays**, not over the raw remote
granules. That is adequate for internal reproducibility, but it is not a byte-level
granule integrity record. This distinction must be documented.

---

## 4. Existing pipeline inventory

### 4.1 Acquisition

| File | What it does | Reusable? |
|---|---|---|
| `backend/processing/acquisition/planetary_computer.py` | STAC search, SAS token cache, per-asset signing, signed raster open, retry/backoff | Yes, directly |
| `backend/processing/acquisition/event_specs.py` | Verified event catalogue, AOIs, target dates, split flags | Yes, extend only |
| `backend/processing/acquisition/asf_client.py` | ASF granule **search** for NISAR/Sentinel-1 | Partially; no download, no auth session |
| `backend/processing/acquisition/firms_client.py` | FIRMS area CSV query and parser | Partially; not wired to acquisition, no archive products |
| `scripts/acquire_real_data.py` | S1/S2/MCD acquisition onto a 20 m UTM grid; manifest + checksums | Yes, extend |

Key behaviours verified in `scripts/acquire_real_data.py`:

- `--event`, `--out`, `--half-size`, `--force`.
- Resume is **event-level**: an existing `stack.npz` is reused unless `--force`.
- No partial-granule resume and no per-asset cache.
- Sentinel-1 read uses `Resampling.average`; non-positive RTC values become NaN.
- Sentinel-2 B04/B08/B12 use bilinear resampling and asset-declared scale/offset;
  SCL uses nearest-neighbour.
- MCD64A1 `Burn_Date` uses nearest-neighbour and an event DOY window.
- The manifest is rewritten after each event; failures are recorded per event.

### 4.2 Preprocessing

| File | What it does | Reusable? |
|---|---|---|
| `backend/processing/preprocessing/grid.py` | Local UTM grid, AOI bounds, WarpedVRT reprojection, MCD Burn_Date reprojection, GeoTIFF writer | Yes |
| `backend/processing/preprocessing/optical.py` | NBR, dNBR, SCL-valid mask, dNBR threshold calibration, optical/reference agreement | Yes |
| `backend/processing/preprocessing/radiometry.py` | Linear-to-dB, log-ratio helpers | Yes |
| `backend/processing/preprocessing/filters.py` | Lee filter | Yes |
| `backend/processing/preprocessing/log_ratio.py` | Pre/post log-ratio features | Yes |
| `backend/processing/models/real_dataset.py` | 5-channel patch extraction, NaN handling, class balance | Yes, but S1-specific |

Verified choices:

- Grid: 16 km x 16 km, 800 x 800 at 20 m, local UTM (EPSG:32610/32611).
- Patches: 128 x 128, stride 64, minimum valid fraction 0.25.
- Sample cap: 10,000 enforced by `GlobalSampleTracker`; 336 generated.
- Split by event **before** patch extraction; one event per split.
- Normalization fitted on TRAIN only (`dataset_manifest.json`).
- dNBR threshold 0.11 calibrated on Gann against MCD64A1 only.
- Exact duplicate audit: 336 unique hashes (reported previously and consistent with
  the current dataset).
- MCD64A1 is **not** the training label; it is an independent check.

### 4.3 Models and evaluation

| Component | Status |
|---|---|
| Log-ratio baseline | Trained/calibrated (threshold -1.20 dB); required baseline present |
| LightGBM | 10 features, 250 trees; threshold 0.18 selected on VAL |
| U-Net ResNet-34 | 5-channel input, 8 epochs, best epoch 5, threshold 0.54 |
| CUSUM | 4 S1 acquisitions per event; h=3.5; unsupervised |
| All-burned trivial | Present as a prevalence reference |
| Full-scene inference | 128 tiles, stride 64, overlapping probabilities averaged |
| Uncertainty | 64-pixel block bootstrap, 400 resamples |
| Prediction maps | `outputs/evaluation/real_predictions/*.npz` |
| QA figure | `outputs/evaluation/real_test_maps.png` |

Current held-out TEST (Bug) results, as stored:

| Analysis | F1 | 95% block-bootstrap CI |
|---|---|---|
| U-Net ResNet-34 | 0.815 | 0.783-0.841 |
| CUSUM | 0.712 | 0.663-0.740 |
| Log-ratio | 0.696 | 0.650-0.724 |
| All-burned trivial | 0.668 | 0.601-0.702 |
| LightGBM | 0.502 | 0.461-0.536 |

VALID (Dome) is much harder: U-Net 0.316, LightGBM 0.157, log-ratio 0.133,
all-burned 0.130. The VAL/TEST gap is event difficulty, not proven generalisation.

### 4.4 API and application

| File | Status |
|---|---|
| `backend/app/main.py` | FastAPI app, CORS, `/health` with explicit NISAR unavailability |
| `backend/app/api/endpoints.py` | `/events`, `/events/{id}`, `/analysis/run`, `/analysis/{job}/results`, `/models/comparison` |
| `backend/app/services/analysis_service.py` | Reads real manifest and stored metrics; no request-time inference; no fabricated fallback |
| `backend/app/schemas/api_schemas.py` | Event, metrics, uncertainty, provenance schemas |
| `backend/app/database/__init__.py`, `backend/app/models/__init__.py` | Empty; the API does not use PostgreSQL |
| `frontend/` | **Only `public/astera-logo.jpg` exists**; there is no React/Vite app |

The API is additive-friendly: new before/after endpoints can be added without changing
existing response contracts. Existing endpoints must keep working.

---

## 5. Gap analysis against the requested expansion

| Requirement | Current state | Gap / action needed |
|---|---|---|
| Real NISAR GCOV | Adapter + format research only | EDL credentials, ASF/CMR search + download, real-granule structural validation |
| NISAR GSLC | Not implemented | Only if scientifically justified; complex-data path does not exist |
| NISAR polarization handling | Defaults to `HHHH/HVHV/HH/HV` in `load()` | Must discover actual polarizations per granule; support L-band quad-pol or dual-pol as present |
| NISAR calibration | Reads `rtcGammaToSigmaFactor` but does not apply it | Explicit gamma0/sigma0 choice, documented conversion, unit tests |
| NISAR `mask` semantics | Loaded as a layer but not interpreted | Must not treat as binary validity; document averaging-ensemble meaning |
| NISAR provenance | Adapter defaults acquisition time to `2026-01-01T00:00:00Z` and CRS to EPSG:4326 when metadata is absent | **Fabricated-default risk**; must fail or return null instead |
| FIRMS | Client skeleton, no key, no acquisition script, no manifest entries | Key, archive/NRT source selection, UTC normalisation, spatial/temporal layers, provenance |
| MCD64A1 QA / uncertainty | Only `Burn_Date` acquired | Add `Uncertainty`/QA assets, decode classes, preserve water/nodata separately |
| SMAP / LST | None | Optional; only if suitable pre/post observations exist and scope is approved |
| Before/after products | Full-scene prediction `.npz` + one QA PNG | Per-event before, after, change, reference, validity maps as GeoTIFF/COG/PNG |
| Dataset layout | Single 5-channel S1 stack per event | Sensor-separated arrays and explicit before/after/change/mask/label products |
| Multi-sensor training | `SARScene` supports sensors, but real pipeline hard-codes 5 S1 channels | Separate sensor experiments; never silently mix NISAR and Sentinel-1 |
| Event catalogue | 4 events, 3 used, one event per split | Adding observations is safe; adding events requires a split redesign |
| API before/after view | Not present | Add read-only endpoints for event products, coverage, reference, active fire, provenance |
| Frontend view | Frontend absent | Cannot "integrate into the existing UI"; see decisions |
| Database | Empty and unused; metadata lives in JSON | Do not add schema changes unless justified; JSON-first is consistent with current design |
| Tests | 29 pass; NISAR test uses a mock HDF5 | Add FIRMS parsing, MCD QA, real NISAR fixture (if available), provenance, API expansion tests |
| Documentation | Existing `README`, `DATA_SOURCES`, `DATASET_CARD`, `PREPROCESSING`, `MODEL_CARD`, `EXPERIMENTS` | Missing the specifically requested `NASA_*` and `BEFORE_AFTER_ANALYSIS` documents |

---

## 6. NISAR-specific findings

These are the most important technical risks for the expansion.

1. **No real NISAR granule has ever been read.** The adapter test
   (`backend/tests/test_adapters.py::test_nisar_gcov_adapter_read`) uses
   `write_mock_hdf5`, i.e. a synthetic NISAR-shaped file. Passing that test does not
   prove real-product compatibility.

2. **The adapter contains unsafe defaults.**
   - `NISAR_GCOV_Adapter.load()` sets `acq_time = "2026-01-01T00:00:00Z"` when
     `zeroDopplerStartTime` is absent. That is fabricated metadata and violates the
     project's own integrity rule.
   - It falls back to `EPSG:4326` when `projection` is absent, rather than failing.
   - `target_pols` defaults to `["HHHH", "HVHV", "HH", "HV"]`, so `load()` without an
     explicit list may silently ignore available `VVVV`/`VHVH`.
   - `inspect()` mutates `self.grid_path` when frequency A is absent, making the
     adapter stateful across calls.
   - `validate()` checks presence but not coordinate monotonicity, CRS/transform
     agreement, shape consistency across layers, or complex-vs-real dtype.
   - The `mask` layer is loaded but never used to mask or qualify backscatter, and its
     documented averaging-ensemble meaning is not implemented.
   - `rtcGammaToSigmaFactor` is loaded but never applied.

3. **Real NISAR access remains credential-gated.** `backend/processing/acquisition/`
   `asf_client.py` only searches; it stores `username`/`password` but never creates an
   authenticated session and never downloads. `asf_search` is installed, but
   `earthaccess` is not. No `.netrc` and no environment credentials exist.

4. **Coverage risk.** The known NISAR mission data gap
   (`2026-07-27T22:03:25Z` to `2026-08-10T00:55:27Z`, from
   `reports/PHASE1_DATA_RESEARCH.md`) overlaps the August pre/post windows of Gann,
   Timber, and Bug. Even with credentials, the exact pairs used for Sentinel-1 may not
   exist. This must be re-verified per event before any NISAR model is promised.

5. **L-band versus C-band.** NISAR is L-band; the current models and thresholds are
   C-band. A NISAR model must be trained and evaluated separately. Sentinel-1
   thresholds and metrics must never be transferred or relabelled.

6. **Disk and compute risk.** Only 14.5 GB is free on C:. NISAR GCOV granules are
   large; a multi-event, multi-polarization acquisition could exhaust the disk. NISAR
   reads must be windowed/streamed, with an explicit byte budget, and CUDA is
   unavailable.

---

## 7. FIRMS and MCD64A1 findings

### FIRMS

- `FIRMSClient` is a reasonable parser skeleton but:
  - default source is `VIIRS_NOAA20_NRT`, i.e. near-real-time, not the archived
    science-quality product;
  - `acq_time` is stored as the raw string, not normalised to UTC;
  - VIIRS `confidence` is a string (`l`/`n`/`h` or numeric depending on product) and
    is not normalised;
  - no bbox/AOI summarisation, no event-level temporal summary, no manifest record;
  - no API key and no `scripts/acquire_firms.py`.
- FIRMS must remain active-fire **evidence**, never a burned-area label. That rule is
  already documented and must be preserved.

### MCD64A1

- Only `Burn_Date` was acquired. `Uncertainty`, QA, and water/invalid classes are
  absent.
- The 500 m product is reprojected to 20 m with nearest-neighbour. This preserves
  categorical values but does **not** create 20 m information. Metrics computed on the
  20 m grid must state that the reference is coarse.
- The event window is applied before the mask is used; burn dates outside the window
  become zero. That is defensible for event-scoped analysis but must be documented as
  an event-window assumption, not a property of the product.

---

## 8. Event split validity after expansion

Current splits:

| Split | Event | Burned fraction (dNBR) | S1 valid fraction |
|---|---|---|---|
| TRAIN | Gann | 0.1445 | 0.982 |
| VAL | Dome | 0.0697 | 0.951 |
| TEST | Bug | 0.5014 | 0.728 |

Timber is acquired but `include_in_training=False`, because its MCD64A1 scar
aggregates the overlapping Timber/Plaskett complex and its VH signal is incoherent.

Assessment:

- **Adding NISAR observations for the same events preserves the split.** No leakage is
  introduced as long as the label definition and event assignment are unchanged.
- **Adding new events requires a split redesign.** A new event cannot be inserted into
  TRAIN or VAL after TEST has been examined without invalidating the held-out claim.
  Any new event must be assigned before evaluation and documented.
- **One event per split is the dominant scientific weakness.** The reported CIs reflect
  one event, not population variability. Adding events is a higher-value improvement
  than adding sensors, but it must be planned explicitly and kept under the 10,000
  sample cap.
- **Do not mix sensors in one training set.** A NISAR experiment must be
  NISAR-only. Sentinel-1 remains a separate cross-sensor reference.
- **Track/frame/geometry consistency.** Within an event, NISAR pre/post must use the
  same frequency, track/frame, and pass direction where possible. Mixing geometries
  must be documented as a limitation.

---

## 9. Integration readiness

- The backend is small and additive. `analysis_service.py` already loads provenance
  and uncertainty from a stored JSON artifact and returns explicit 404/400 errors.
- Adding before/after product endpoints would not require a database migration.
- The API currently returns a 200 with an `error` field when the comparison report is
  missing (`get_model_comparison_report`). This is a minor contract weakness but not a
  blocker.
- `sar_post_date` in the event payload is the **last** S1 acquisition (post2), while
  the role named `post` in acquisition metadata is an earlier date. This naming
  ambiguity should be resolved in the expansion (distinguish `post` from
  `last_observation`).
- There is no frontend application to integrate into. The only frontend asset is the
  logo. Phase 8 must therefore be scoped as API/product delivery unless the user
  explicitly wants a new UI scaffold.

---

## 10. Test coverage gaps

Existing tests are meaningful and must not be weakened. Missing coverage for the
expansion:

- FIRMS CSV parsing, confidence normalisation, UTC handling, empty/invalid response.
- MCD64A1 QA/uncertainty decoding and class preservation.
- NISAR real-file reading (only a mock fixture exists).
- NISAR metadata absence behaviour (must fail or null, not default to a fake date).
- NISAR complex off-diagonal handling and gamma0/sigma0 conversion.
- Multi-sensor dataset provenance and sensor-separation enforcement.
- Event-level leakage assertions when new events are added.
- Before/after product API contract and 404 behaviour.
- Date validation and pre/post ordering.
- Reproducibility check on a small real acquisition sample.

---

## 11. Risks and blockers

| ID | Risk / blocker | Severity | Mitigation |
|---|---|---|---|
| R1 | No Earthdata Login credentials | High | User supplies env vars or `.netrc`; otherwise document NISAR as unavailable and deliver non-NISAR pipeline |
| R2 | NISAR coverage / mission data gap for August 2026 events | High | Re-verify CMR/ASF per event; choose events with valid pre/post pairs; never fabricate |
| R3 | Only 14.5 GB free disk | High | Byte budget, windowed reads, per-event acquisition, cleanup policy requiring approval |
| R4 | No FIRMS MAP_KEY | Medium | User supplies key or FIRMS remains unavailable and is documented |
| R5 | NISAR adapter unsafe defaults and mock-only validation | High | Fix before any NISAR experiment; fail closed on missing metadata |
| R6 | One event per split | High (scientific) | Add events with a pre-registered split; keep sample cap |
| R7 | Label uncertainty (dNBR vs MCD64A1 disagreement) | High (scientific) | Keep both references, report disagreement, never call either ground truth |
| R8 | No frontend app | Medium | Scope Phase 8 as API + generated products; do not invent a UI |
| R9 | CPU-only training | Medium | Keep current model budget; no large NISAR deep model until compute is available |
| R10 | Existing uncommitted work | Medium | Preserve working tree; no commit/push without approval |

---

## 12. Proposed implementation plan (no work started)

The plan is ordered so that no code is written until the user approves Phase 0 and
Phase 1. Each phase ends with tests and a report.

### Phase 1 - NASA data research (read-only, no downloads)

- Re-verify NISAR GCOV availability, product version, polarizations, coverage, and the
  August 2026 data gap from official ASF/NASA documentation and CMR metadata search.
- Verify FIRMS archived VIIRS/MODIS sources and API constraints.
- Verify MCD64A1 C6.1 QA/uncertainty assets and native classes.
- Evaluate SMAP and MODIS LST only for the selected events.
- Deliver `reports/NASA_DATA_RESEARCH.md` with a comparison table and a justified
  selection. Stop for approval.

### Phase 2 - Acquisition design

- Define per-event, per-sensor pre/post windows and acceptance criteria.
- Define a v2 manifest schema that adds sensor, product version, granule ID, auth
  method (without secrets), download timestamp, byte-level checksum, and validity.
- Define disk budget and failure policy.
- Deliver `docs/NASA_DATA_ACQUISITION.md`. Stop for approval.

### Phase 3 - Acquisition

- Add a NISAR GCOV acquisition path only if credentials are available:
  ASF/CMR search, authenticated download or streamed windowed read, retry/resume,
  deduplication, checksums, manifest.
- Add FIRMS acquisition only if a key is available: archive source, UTC timestamps,
  confidence normalisation, AOI summary, manifest.
- Add MCD64A1 QA/uncertainty acquisition.
- Do not modify existing stacks or manifests; write new namespaced products.
- Gate: acquisition report, zero silent failures, existing tests still pass.

### Phase 4 - Scientific preprocessing and dataset expansion

- Fix the NISAR adapter: fail closed on missing metadata, discover polarizations,
  handle complex off-diagonal terms, apply documented sigma conversion only when
  requested, interpret `mask` correctly, add shape/CRS validation.
- Build per-sensor before/after/change/mask/label products on the existing 20 m grid.
- Add MCD64A1 QA layers and FIRMS event summaries as separate evidence.
- Preserve the existing 5-channel S1 dataset and checkpoints; add new arrays rather
  than overwriting.
- Gate: alignment/CRS/NoData tests, provenance tests, leakage tests, existing 29 tests
  still pass.

### Phase 5 - Before/after analysis and integration

- Produce per-event before, after, radar change, optical change, reference, validity,
  and active-fire layers; compute agreement metrics only where a reference exists.
- Add read-only API endpoints for these products with explicit provenance and sensor
  labels.
- Add NISAR-only experiments only if real NISAR training/evaluation data exists.
- Keep Sentinel-1, Sentinel-2, MCD64A1, FIRMS, and NISAR labels distinct in every
  response.
- Gate: API contract tests, no regression in existing endpoints, no fabricated
  metrics.

### Phase 6 - Documentation and final verification

- Write `docs/NASA_DATA_SOURCES.md`, `docs/NASA_PREPROCESSING.md`,
  `docs/BEFORE_AFTER_ANALYSIS.md`, `reports/NASA_DATA_RESEARCH.md`,
  `reports/NASA_DATA_INTEGRATION_REPORT.md`, and update the dataset/model cards.
- Run the full suite and a small reproducibility check.
- Report blockers honestly; do not claim completion for partially acquired data.

---

## 13. Decisions needed before Phase 1

1. **NISAR credentials:** will Earthdata Login credentials be supplied through
   environment variables or `.netrc`? If not, should NISAR remain a documented
   unavailable path while the rest of the expansion proceeds?
2. **FIRMS key:** is a `FIRMS_MAP_KEY` available? If not, FIRMS remains documented as
   unavailable.
3. **Disk budget:** is there approval to free space or use an external drive for NISAR
   granules? Current free space is 14.5 GB.
4. **Frontend scope:** the repository has no frontend application. Should Phase 8
   deliver API endpoints and static products only, or is a new UI scaffold expected?
5. **New events:** is adding wildfire events (to strengthen TRAIN/VAL/TEST) in scope,
   or must the current three-event split be preserved exactly?
6. **Optional datasets:** are SMAP soil moisture and MODIS LST in scope, or should the
   expansion stay limited to NISAR, Sentinel-1, Sentinel-2, FIRMS, and MCD64A1?

---

## 14. Components explicitly preserved

The expansion must not touch, overwrite, or relabel:

- `models/checkpoints/real_unet_resnet34_best.pt`
- `models/checkpoints/unet_resnet34_best.pt`
- `data/real/*/stack.npz`
- `data/real/acquisition_manifest.json`
- `data/real/dataset/*.npz`, `prepared/`, `dataset_manifest.json`, `norm_stats.json`
- `outputs/evaluation/real_model_comparison.json`
- `outputs/evaluation/real_predictions/*.npz`
- Existing API endpoints and response fields
- Existing tests (they may be extended, never weakened)
- The synthetic fixtures and their `SUPERSEDED - SYNTHETIC` labels

---

## 15. Audit conclusion

The repository already has a credible, reproducible, honestly labelled cross-sensor
prototype. It does **not** have real NISAR data, real FIRMS data, MCD64A1 QA layers,
per-sensor before/after products, or a frontend application. The NISAR adapter is
format-aware but not production-safe and has never read a real granule.

The highest-value next steps are, in order:

1. Verify whether genuine NISAR pre/post coverage exists for the selected events.
2. Fix the NISAR adapter's fabricated-default and validation problems before any real
   use.
3. Add before/after product generation and API exposure for the existing real data,
   which is achievable without credentials.
4. Add FIRMS and MCD64A1 QA only when access and scientific value are confirmed.
5. Strengthen event-level validation only with a pre-registered split.

No files were modified except this report. No datasets were downloaded. No commit or
push was made.
