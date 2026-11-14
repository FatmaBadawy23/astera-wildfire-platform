# PHASE 0 — FINAL EXECUTION BASELINE REPORT

- **Project:** Astera Watch — NISAR-Based Wildfire Monitoring and Burned-Area Intelligence Platform
- **Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*
- **Phase:** Phase 0 (Read-Only Repository, Hardware, Storage, and Dataset Baseline)
- **Generated At:** 2026-11-13T22:57:00+02:00
- **Repository Root:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`

---

## 1. Git State & Repository Structure

- **Branch:** `feature/sar-ml-pipeline`
- **HEAD Commit:** `fd3eaeb6c48ba437c8752f0858cef9bdecfe128f` (*"Fix CUSUM collapse and upgrade mock generator to spatially correlated Perlin noise"*)
- **Staged Files:** `0`
- **Deleted Files:** `0`
- **Modified Tracked Files (`3`):** `.gitignore`, `CLAUDE.md`, `README.md`
- **Untracked Directories & Modules:**
  - `backend/app/` (`main.py`, `api/endpoints.py`, `schemas/api_schemas.py`, `services/analysis_service.py`)
  - `backend/processing/acquisition/` (`asf_client.py`, `event_specs.py`, `firms_client.py`, `planetary_computer.py`)
  - `backend/processing/adapters/` (`base.py`, `mock_adapter.py`, `nisar_gcov_adapter.py`)
  - `backend/processing/change_detection/` (`before_after.py`, `cusum.py`, `log_ratio_detector.py`)
  - `backend/processing/models/` (`dataset.py`, `lightgbm_model.py`, `trainer.py`, `unet_resnet.py`)
  - `backend/processing/preprocessing/` (`filters.py`, `grid.py`, `log_ratio.py`, `mcd64a1.py`, `optical.py`, `radiometry.py`)
  - `backend/processing/validation/` (`metrics.py`)
  - `backend/tests/` (`test_adapters.py`, `test_api.py`, `test_metrics.py`, `test_models.py`, `test_preprocessing.py`, `test_real_pipeline.py`)
  - `scripts/` (`acquire_real_data.py`, `build_real_dataset.py`, `run_real_pipeline.py`, `acquire_ancillary_and_nisar_metadata.py`, `generate_before_after_and_validation.py`, `generate_mock_data.py`, `train_and_evaluate.py`)
  - `data/`, `models/checkpoints/`, `outputs/`, `docs/`, `reports/`

---

## 2. Hardware, Environment, Storage & Authentication Baseline

| Resource / Parameter | Measured Value | Operational Impact |
|---|---|---|
| **Operating System** | Windows 11 (`10.0.26300-SP0`) | Native PowerShell / Python 3.13 environment |
| **Python Version** | `3.13.7` (64-bit AMD64) | Installed packages: `torch 2.12.1+cpu`, `lightgbm 4.7.0`, `rasterio 1.5.2`, `h5py 3.14.0`, `asf_search 14.1.0`, `httpx` |
| **System RAM** | `7.82 GiB` Total / `0.72–1.5 GiB` Free | Requires conservative batch sizes (`batch_size <= 8`) and streaming/windowed raster I/O |
| **GPU Hardware** | NVIDIA GeForce RTX 3050 Laptop GPU (`4096 MiB` VRAM, Driver `577.00`) | Hardware present, but installed PyTorch wheel is `2.12.1+cpu` (`torch.cuda.is_available() == False`) |
| **Disk Space (`C:\`)** | `322.12 GB` Total / `309.27 GB` Used / **`12.86 GB` (`11.97 GiB`) Free** | **Strict storage ceiling:** At least `8–10 GB` must remain free for Windows OS & swap; safe new download budget is **`<= 2.5 GB`** |
| **Earthdata Login (`~/.netrc` / `_netrc` / Env)** | **Not Configured (`False`)** | Blocks authenticated downloads from `https://nisar.asf.earthdatacloud.nasa.gov/` and NASA Harmony customization |
| **`NASA_API_KEY` / `FIRMS_MAP_KEY`** | **Not Configured (`False`)** | Public `api.nasa.gov` endpoints work via `DEMO_KEY` (`30 req/hr`, `50 req/day`) or unauthenticated EONET v3; FIRMS REST CSV requires `FIRMS_MAP_KEY` |

---

## 3. Existing Datasets, Checkpoints, and Outputs Inventory

### 3.1 Directory Storage Footprint
- `data/real/`: **`269.10 MB`**
- `data/mock/`: **`10.88 MB`** (`6` synthetic HDF5 files for unit testing)
- `models/checkpoints/`: **`666.05 MB`** (`2` ResNet34 U-Net checkpoints)
- `outputs/`: **`55.05 MB`** (evaluation JSONs, prediction maps, 32 GeoTIFFs, 4 GeoJSONs, QA plots)

### 3.2 Real Event Stacks (`data/real/<EVENT_ID>/`)
All 4 approved California 2026 fire events exist on disk on co-registered `800 × 800` UTM grids at `20.0 m` spacing (`16.0 km × 16.0 km` = `256.0 km²`):

| Event ID | Fire Name | Split Role | CRS | `stack.npz` Size | `stack.npz` SHA-256 | `mcd64a1_ancillary.npz` Size |
|---|---|---|---|---:|---|---:|
| `CA_GANN_2026` | Gann Fire | `TRAIN` | `EPSG:32610` | `26,207,283 B` | `51331e60cbdd788129eb2c930509aef885e1e7002b8f6078c363adbde26266d0` | `22,435 B` |
| `CA_DOME_2026` | Dome Fire | `VAL` | `EPSG:32611` | `26,023,453 B` | `36c84d432d3781f20396d42ed0704b4a88a1a03b4295de7197abd70a31563ba7` | `24,630 B` |
| `CA_BUG_2026` | Bug Fire | `TEST` | `EPSG:32611` | `20,704,291 B` | `56b69365b2e1ae77461385bf71bf0cbf87bcb895d1a093bddafd7c36e6a59258` | `37,272 B` |
| `CA_TIMBER_2026` | Timber Fire | `EXCLUDED` | `EPSG:32610` | `26,161,299 B` | `f313c0f24df48dbf71ce9f340ff67a0e8f759d218b2f3ced6c8e353a0401c006` | `33,539 B` |

### 3.3 Checkpoints (`models/checkpoints/`)
- `models/checkpoints/real_unet_resnet34_best.pt`: `349,204,621` bytes (`333.03 MB`), SHA-256 prefix `578ae4667eda4848` (Trained on real Sentinel-1 patches from `CA_GANN_2026`, selected on `CA_DOME_2026`).
- `models/checkpoints/unet_resnet34_best.pt`: `349,200,698` bytes (`333.02 MB`), SHA-256 prefix `1927158dec5fb15f` (Legacy synthetic checkpoint, preserved).

### 3.4 Existing API Routes (`backend/app/api/endpoints.py`)
Mounted under `/api/v1` in `backend/app/main.py`:
- `GET /api/v1/health`
- `GET /api/v1/events`
- `GET /api/v1/events/{event_id}`
- `GET /api/v1/events/{event_id}/before-after`
- `GET /api/v1/events/{event_id}/products`
- `GET /api/v1/events/{event_id}/validation`
- `GET /api/v1/nisar/candidates`
- `POST /api/v1/analysis/run`
- `GET /api/v1/analysis/{job_id}/results`
- `GET /api/v1/models/comparison`

---

## 4. Identified Baseline Gaps To Address in Phases 1–12

1. **Live NASA APIs & Harmony Investigation (Phases 1–3):**
   - Query live NASA EONET v3 (`https://eonet.gsfc.nasa.gov/api/v3/events`), NASA APIs (`https://api.nasa.gov/`), NASA CMR (`C3622241360-ASF`), ASF Vertex (`asf_search`), and NASA Harmony (`https://harmony.earthdata.nasa.gov/C3622241360-ASF/ogc-api-coverages/1.0.0/`) to verify collection capabilities, provisional vs. validated CRIDs (`P05023` vs. `P05036`), and exact authentication/subsetting behavior.
   - Build the comprehensive machine-readable registry `data/real/data_source_registry.json` with explicit states (`VERIFIED`, `PROCESSED`, `DISCOVERED`, `BLOCKED_AUTH`, `BLOCKED_STORAGE`).
2. **Fix `MCD64A1 QA` GDAL `dst_nodata=0` Remapping (Phase 3–4):**
   - Re-extract `QA` with `dst_nodata=255` so water pixels (`QA == 0`) are not remapped to `1`.
3. **Fix LightGBM Threshold Sensitivity & Save Versioned v2 Geospatial Outputs (Phases 4–8):**
   - Ensure `lightgbm_prob` is properly utilized in `compute_geospatial_burned_area` so LightGBM's threshold sensitivity range is physical (`~31–48 km²`) rather than `[0.0, 186.34 km²]`.
   - Add 500 m native-block fractional validation alongside 20 m pixel-level metrics to rigorously explain and contextualize `All_Burned_Trivial` (`F1 = 0.8545`, `Specificity = 0.0%`) vs. `U-Net` (`F1 = 0.8930`, `Specificity = 93.26%`) against `MCD64A1`.
   - Generate publication-grade Before/After visualization PNGs (`outputs/geospatial/<EVENT_ID>/before_after_overview.png`) with clear legends, units, sensor provenance (`Sentinel-1 C-band RTC`, `CROSS_SENSOR_PROTOTYPE`), and dates.
4. **API Route & Provenance Hardening (Phase 9):**
   - Support both `/api/v1/...` and `/api/...` route prefixes so both legacy clients and `/api/events/{event_id}/before-after` callers work seamlessly.
   - Ensure every API response explicitly includes `sensor`, `collection`, `product_version`, `acquisition_timestamps`, `event_id`, `data_origin` (`CROSS_SENSOR_PROTOTYPE` vs `NISAR_GCOV`), `processing_version`, `model_version`, `reference_source`, and `project_maturity_status`.
