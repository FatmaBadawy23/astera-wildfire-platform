# Astera Watch — Real Data Acquisition, Processing & End-to-End Execution Plan

**Project:** Astera Watch — NASA Space Apps Challenge 2026 (*Dancing with the SARs*)  
**Repository:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`  
**Branch:** `feature/sar-ml-pipeline` (`HEAD` commit `fd3eaeb6c48ba437c8752f0858cef9bdecfe128f`)  
**Plan Created (UTC):** `2026-11-13T23:26:30Z`

---

## 1. Phase A Diagnostic & Initial FIRMS Smoke Test Verification

### 1.1 Authentication Status of NASA Services

| Service / Credential | Environment / Config Check | Live Endpoint Verification | Status |
|---|---|---|---|
| **NASA API (`NASA_API_KEY`)** | Present in Windows User Environment (`length = 40`) | `https://api.nasa.gov/planetary/apod?api_key=<REDACTED>` -> `HTTP 200` (`x-ratelimit-remaining: 9998`) | **AUTHENTICATED** |
| **NASA FIRMS (`FIRMS_MAP_KEY`)** | Present in Windows User Environment (`length = 32`) | `https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY=<REDACTED>` -> `HTTP 200` (`transaction_limit: 5000`) | **AUTHENTICATED** |
| **NASA EONET v3** | Open NASA Earth Observatory API (also compatible with `NASA_API_KEY`) | `https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&limit=5` -> `HTTP 200` | **OPERATIONAL** |
| **NASA CMR (NISAR & MODIS)** | Public REST metadata catalog (`cmr.earthdata.nasa.gov`) | `C3622241360-ASF` (NISAR GCOV Validated), `C2854338529-ASF` (Provisional), `C2565786756-LPCLOUD` (MCD64A1.061) -> `HTTP 200` | **METADATA OPERATIONAL** |
| **NASA Earthdata Login (`EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD` / `EARTHDATA_TOKEN` / `~/.netrc`)** | Checked Process & User environment variables and `~/.netrc` / `~/_netrc` | All `False` (`earthdata_login_configured: False`) | **NISAR GRANULE DOWNLOAD BLOCKED BY MISSING CREDENTIALS** |
| **Microsoft Planetary Computer STAC** | Public STAC + SAS token signing (`planetarycomputer.microsoft.com/api/stac/v1`) | `sentinel-1-rtc`, `sentinel-2-l2a`, `modis-64A1-061` -> `HTTP 200` | **OPERATIONAL** |

### 1.2 Initial FIRMS Smoke Test Result (Egypt AOI)

Executed prior to any source code modification:
- **Directory:** `data/acquisitions/firms_smoke_test_20261114_012301/`
- **File:** `data/acquisitions/firms_smoke_test_20261114_012301/firms_egypt_noaa20.csv`
- **Sanitized URL:** `https://firms.modaps.eosdis.nasa.gov/api/area/csv/<REDACTED_MAP_KEY>/VIIRS_NOAA20_NRT/24,21,37,32/3`
- **HTTP Status:** `200 OK`
- **File Size:** `14,992` bytes
- **SHA-256:** `854353a6905bfb38d5beb0a0446f38e12a4d12ca00cb6f4e211067ee25659be2`
- **Columns Verified:** `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight`
- **Total Records:** `179` active fire detections (`180` lines including header)
- **Coordinate Bounding Check (`[24, 21, 37, 32]`):** `100%` within bounds (`lat ∈ [22.47718, 31.91918]`, `lon ∈ [25.91810, 36.12733]`)
- **Acquisition Dates Present:** `2026-11-11`, `2026-11-12`, `2026-11-13`
- **Dynamic Data Availability Table Saved:** `data/acquisitions/firms_smoke_test_20261114_012301/firms_data_availability.csv` (`442` bytes, `HTTP 200`)
  - Key discovery from `data_availability`: Historical August–September 2023 wildfire events fall inside FIRMS Standard Processing (`VIIRS_NOAA20_SP`, `VIIRS_SNPP_SP`, `VIIRS_NOAA21_SP`, `MODIS_SP`), whereas current 2026 windows fall inside Near Real-Time (`VIIRS_NOAA20_NRT`, `VIIRS_SNPP_NRT`, `VIIRS_NOAA21_NRT`, `MODIS_NRT`).

---

## 2. Exact Files to Be Updated or Created

To preserve all existing datasets (`data/real/`), checkpoints (`models/checkpoints/`), and evaluation outputs (`outputs/evaluation/`) without overwriting or deleting any existing artifact:

### 2.1 Existing Source Code Modules to Enhance (Backward-Compatible)
1. `backend/processing/acquisition/firms_client.py`:
   - Add automatic Windows User environment variable fallback (`winreg` / `HKEY_CURRENT_USER\Environment`) for `FIRMS_MAP_KEY` and `NASA_API_KEY` when not inherited into process scope.
   - Add `check_mapkey_status()` and `fetch_data_availability()` (`https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{MAP_KEY}/all`).
   - Add automatic sensor source selection (`select_available_sources_for_date()`) so historical event windows (`2023-08`) query Standard Processing (`VIIRS_NOAA20_SP`, `VIIRS_SNPP_SP`, `VIIRS_NOAA21_SP`, `MODIS_SP`) while recent windows query NRT (`_NRT`).
   - Add raw CSV persistence, SHA-256 computation, sanitized URL logging (`<REDACTED_MAP_KEY>`), and duplicate-query prevention.
2. `backend/processing/preprocessing/optical.py`:
   - Define `SCL_LAND_VALID_CLASSES = (4, 5, 7)` (excluding `SCL == 6` Water from valid burn-mapping land pixels) while preserving `SCL_VALID_CLASSES` for backward compatibility and adding `exclude_water: bool = True` to `valid_optical_mask()`, plus an explicit `water_optical_mask(scl_pre, scl_post)` helper.
3. `backend/processing/preprocessing/mcd64a1.py`:
   - Update `decode_qa_bitmask()` so `high_quality_land_mask = is_land & is_valid_data & (~shortened_period)` (incorporating Bit 2 `shortened_mapping_period == 0` per Collection 6.1 QA specification) and include `shortened_mapping_period_fraction` in `summarize_mcd64a1_layers()` `qa_summary`.
4. `backend/services/wildfire_service.py` & `backend/routers/wildfire.py`:
   - Expose verified FIRMS active fire hotspot summaries, EONET cross-check metadata, and versioned run provenance in the FastAPI backend responses without breaking existing API contracts.
5. `backend/tests/test_before_after_and_mcd64a1.py`:
   - Add unit and integration tests covering FIRMS dynamic availability & CSV parsing, water-excluded optical validity masks (`SCL != 6`), `MCD64A1` QA Bit 2 filtering, and end-to-end versioned pipeline outputs.

### 2.2 New Script & Versioned Reports to Create
1. `scripts/execute_versioned_real_pipeline.py`:
   - End-to-end orchestrator that writes exclusively to a versioned run directory (`data/acquisitions/run_<timestamp>/` and `outputs/runs/run_<timestamp>/`), executing:
     - Phase B: Live FIRMS acquisition (Egypt NRT + 4 California wildfire AOIs using `_SP` and `_NRT`), NASA EONET v3 wildfire query, NASA API verification, NISAR CMR granule discovery + credential gate check (`NISAR_METADATA_DISCOVERED = True`, `NISAR_DOWNLOAD_BLOCKED = True`), and verification/linking of real Sentinel-1 RTC, Sentinel-2 L2A, and `MCD64A1.061` rasters.
     - Phase C: Water-excluded (`SCL ∈ {4, 5, 7}`) before/after alignment, SAR feature extraction (`VV/VH` dB, `ΔVV`, `ΔVH`, `Δ(VH-VV)`, local 5x5 mean/std), optical `NBR`/`dNBR` calculation (reporting both `0.11` TRAIN-calibrated and `0.27` USGS moderate-severity thresholds), and leakage-free patch dataset generation (`train.npz`, `val.npz`, `test.npz`).
     - Phase D: Training and validation of the 3 predictive models (Model 1: Calibrated SAR VH Log-Ratio baseline; Model 2: LightGBM 10-feature spatial classifier; Model 3: 5-channel `UNetResNet34` segmentation network) + temporal CUSUM change detector, saving checkpoints, configs, and training histories into `outputs/runs/run_<timestamp>/checkpoints/`.
     - Phase E: Held-out `TEST` (`CA_BUG_2026`) evaluation against both Sentinel-2 `dNBR` and QA-filtered NASA `MCD64A1.061` (including 500 m block reconciliation), exporting georeferenced GeoTIFFs, GeoJSON perimeters, and 6-panel Before/After PNG figures into `outputs/runs/run_<timestamp>/geospatial/`.
2. `reports/REAL_DATA_EXECUTION_PLAN.md` (this document).
3. `reports/REAL_DATA_EXECUTION_REPORT.md` (final evidence report with exact file paths, byte sizes, SHA-256 checksums, confusion matrices, and `git status`).

---

## 3. Exact Data Sources to Be Queried

1. **NASA FIRMS API (`firms.modaps.eosdis.nasa.gov`):**
   - `GET /mapserver/mapkey_status/?MAP_KEY=<FIRMS_MAP_KEY>`
   - `GET /api/data_availability/csv/<FIRMS_MAP_KEY>/all`
   - `GET /api/area/csv/<FIRMS_MAP_KEY>/VIIRS_NOAA20_NRT/24,21,37,32/3` (Egypt NRT verification)
   - `GET /api/area/csv/<FIRMS_MAP_KEY>/{SOURCE}/{BBOX}/{DAYS}/{DATE}` across `CA_GANN_2026`, `CA_DOME_2026`, `CA_BUG_2026`, and `CA_TIMBER_2026` using available Standard Processing (`VIIRS_NOAA20_SP`, `VIIRS_SNPP_SP`, `VIIRS_NOAA21_SP`, `MODIS_SP`) for the August 2023 fire ignition windows.
2. **NASA EONET API v3 (`eonet.gsfc.nasa.gov/api/v3/events`):**
   - Wildfire category events (`category=wildfires`) and historical August–September 2023 California/Oregon wildfire events (`start=2023-08-01&end=2023-09-30`).
3. **NASA API (`api.nasa.gov`):**
   - Authenticated health and rate-limit check using `NASA_API_KEY`.
4. **NASA CMR API (`cmr.earthdata.nasa.gov/search/granules.json`):**
   - NISAR L2 GCOV Validated (`C3622241360-ASF`) and Provisional (`C2854338529-ASF`) granules over all 4 wildfire AOIs.
   - NASA MODIS `MCD64A1.061` (`C2565786756-LPCLOUD`) granules over all 4 wildfire AOIs.
5. **Real Co-Registered Satellite Imagery (`data/real/<EVENT_ID>/` from Microsoft Planetary Computer):**
   - `sentinel-1-rtc`: 16 acquisitions (4 per event: `pre`, `early`, `post`, `post2`, VV & VH $\gamma^0$ at 20 m).
   - `sentinel-2-l2a`: 8 acquisitions (2 per event: `pre`, `post`, `B08`, `B12`, `SCL` at 20 m).
   - `modis-64A1-061`: 4 monthly granules (`Burn_Date`, `Uncertainty`, `QA`, `First_Day`, `Last_Day`).

---

## 4. Exact Local Directories to Be Created

All new acquisition, dataset, model, and geospatial artifacts will be written to versioned directories:
```text
data/acquisitions/firms_smoke_test_20261114_012301/
data/acquisitions/run_<timestamp>/
  firms/
  eonet/
  nisar_metadata/
  sentinel1/
  sentinel2/
  modis/
  processed/
  dataset/
    prepared/
  manifests/
outputs/runs/run_<timestamp>/
  checkpoints/
  evaluation/
    predictions/
  geospatial/
    CA_GANN_2026/
    CA_DOME_2026/
    CA_BUG_2026/
    CA_TIMBER_2026/
```

---

## 5. Expected Storage Usage

- **Current Free Disk Space:** `11.69 GB` (`> 10 GB` minimum free space requirement).
- **Expected New Versioned Run Footprint:** `~85 MB – 140 MB` total:
  - Raw FIRMS CSVs, EONET JSONs, NISAR CMR JSONs, and manifests: `< 5 MB`
  - Water-excluded (`SCL != 6`) dataset (`train.npz`, `val.npz`, `test.npz`, `prepared/*.npz`): `~45 MB`
  - Model checkpoints (`real_unet_resnet34_water_free.pt`, LightGBM model, configs): `~15 MB`
  - Prediction archives and georeferenced GeoTIFFs/PNGs/GeoJSONs: `~25 MB`
- Well within the `< 15 GB` hard storage cap and leaves `> 11.5 GB` free on `C:`.

---

## 6. Execution Order

1. **Step 1 (Completed):** Phase A authentication diagnostics, live FIRMS Egypt smoke test (`firms_smoke_test_20261114_012301`), and creation of `reports/REAL_DATA_EXECUTION_PLAN.md`.
2. **Step 2:** Update `backend/processing/acquisition/firms_client.py`, `backend/processing/preprocessing/optical.py`, and `backend/processing/preprocessing/mcd64a1.py`.
3. **Step 3:** Create and execute `scripts/execute_versioned_real_pipeline.py` to run Phases B, C, D, and E into `data/acquisitions/run_<timestamp>/` and `outputs/runs/run_<timestamp>/`.
4. **Step 4:** Integrate versioned run and FIRMS hotspot summaries into `backend/services/wildfire_service.py` and `backend/routers/wildfire.py`.
5. **Step 5:** Add unit/integration tests and execute the complete `pytest` suite (`python -m pytest backend/tests/ -v`).
6. **Step 6:** Synchronize documentation (`docs/*.md`, `reports/ASTERA_WATCH_FINAL_COMPLETION_REPORT.md`) and generate `reports/REAL_DATA_EXECUTION_REPORT.md`.
