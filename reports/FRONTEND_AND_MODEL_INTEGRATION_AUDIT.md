# ASTERA WATCH — PHASE 0 READ-ONLY AUDIT: `Frontend_/` & MODEL INTEGRATION
**Repository:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`  
**Branch:** `feature/sar-ml-pipeline`  
**Primary Frontend Directory Audited:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\Frontend_` (exact name with trailing underscore)  
**Secondary Frontend Directory Compared:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\frontend`  
**Active Verified Run:** `run_20261114_025000_phase_g` (`outputs/runs/latest_run.json`)  
**Audit Timestamp:** `2026-11-14T03:44:00+02:00`  
**Mode:** Strictly Read-Only (Zero source, dataset, checkpoint, or configuration files modified)

---

## 1. Executive Summary

1. **`Frontend_/` (with trailing underscore) is a rich, accessibility-first, production-grade React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + MapLibre GL 6 + React Router 7 application** comprising **102 files inside `src/`**, offline Natural Earth relief tiles (`public/basemap/relief/0..4`), vector country boundaries (`public/basemap/countries-110m.geojson`), custom CSS design tokens (`src/styles/tokens.css`), and **16 Vitest + Testing Library + Axe accessibility test files**.
2. **`Frontend_/` vs. `frontend/` Comparison (Rule 17):**
   - `Frontend_/` is the developer-supplied multi-route application featuring the Interactive MapLibre Explorer (`/`), Fire History (`/history`), 7-section Fire Story (`/events/:eventId`), Research Center (`/research`, `/research/projects`, `/research/data`, `/research/models`, `/research/analysis`, `/research/annotation`, `/research/reports`, `/research/collaboration`), My Places (`/places`), User Guide (`/guide`), and How It Works (`/how-it-works`).
   - `frontend/` (without underscore) is a 13-file single-page dashboard created during Phase G7.
   - **Decision:** In accordance with Rules 2–6, 17, and 18, **`Frontend_/` is the canonical frontend application** to integrate with the Astera Watch backend and real ML inference pipeline, preserving all existing visual design tokens, components, routes, accessibility behaviors, and tests.
3. **Current Data-Mode State in `Frontend_/`:**
   - `Frontend_/src/data/DataProvider.tsx` selects between `createMockRepositories()` (`mock` mode) and `createUnavailableRepositories()` (`http` mode).
   - `Frontend_/src/data/http/unavailableRepositories.ts` is currently a Stage 1 stub where **every repository method rejects with `DataError("unavailable", BACKEND_UNAVAILABLE_MESSAGE)`**.
   - `Frontend_/src/features/research/capabilities.ts` currently marks **AI Models (`/research/models`)** as `"planned"` and **Analysis (`/research/analysis`)** as `"unavailable"`, and `DatasetCatalogPage` (`/research/data`) states `"Adding your own files is not available yet."`
4. **Backend & Real Model Readiness:**
   - The FastAPI backend (`backend/app/main.py`, `backend/app/api/endpoints.py`, `backend/app/services/analysis_service.py`) is online and dynamically resolves `outputs/runs/latest_run.json` $\rightarrow$ `run_20261114_025000_phase_g`.
   - Verified real checkpoints exist on disk:
     - **U-Net ResNet-34 (`UNet_ResNet34`):** `outputs/runs/run_20261114_025000_phase_g/checkpoints/real_unet_resnet34_phase_g.pt` (`349,206,898` bytes, SHA-256 `025f136b09a584c6ba3657198b9e50c6b53b1058b081c1dac8d1a0a685e863bc`, trained with `MaskedBCEDiceLoss`, 5-channel SAR dB input, threshold `0.66`).
     - **LightGBM Pixel-Spatial (`LightGBM_Pixel_Spatial`):** `outputs/runs/run_20261114_025000_phase_g/checkpoints/lightgbm_phase_g.pkl` (`16,758` bytes, SHA-256 `ef3099395e2918c3daa8f5f134d832fe63ba4749c51f061dc2f55b9dadb837e1`, 10-feature SAR spatial input, threshold `0.17`).
     - **Analytical Baselines:** `Log_Ratio_Baseline` (`backend/processing/change_detection/log_ratio_detector.py`, calibrated threshold `-1.20 dB`) and `CUSUM_Temporal` (`backend/processing/change_detection/cusum.py`, multi-temporal VH dB stack $\ge 3$ scenes, `k=0.5`, `h=3.5`).

---

## 2. Full `Frontend_/` Inventory & Comparison with `frontend/`

### 2.1 `Frontend_/` Technical Stack (`Frontend_/package.json`)

| Category | Package / Tool | Version | Notes |
|---|---|---|---|
| Core Framework | `react`, `react-dom` | `19.3.1` | Strict TypeScript (`5.9.3`) |
| Routing | `react-router` | `7.18.5` | Data router (`createBrowserRouter`) |
| Build Tooling | `vite`, `@vitejs/plugin-react` | `8.3.7`, `6.3.0` | Alias `@` $\rightarrow$ `./src`, port `5173` |
| Styling | `tailwindcss`, `@tailwindcss/vite` | `4.3.5` | Custom design system tokens in `src/styles/tokens.css` & `globals.css` |
| Geospatial Map | `maplibre-gl` | `6.17.0` | Offline Natural Earth shaded relief + country outlines & labels |
| Data Fetching | `@tanstack/react-query`, `axios` | `5.107.1`, `1.21.1` | Repository pattern in `src/data/` |
| Charts & UI | `recharts`, `radix-ui`, `lucide-react` | `3.10.1`, `1.8.1`, `1.71.0` | Accessible primitives & icons |
| Testing & QA | `vitest`, `@testing-library/react`, `axe-core`, `jsdom` | `5.1.0`, `16.3.3`, `4.14.0`, `29.1.1` | 16 unit/integration/a11y test suites + `scripts/browser-checks.mjs` |

> ** Dependency Installation Note:** `Frontend_/node_modules` is not yet installed on disk (`Test-Path Frontend_\node_modules` returned `False`), whereas `Frontend_/package-lock.json` (`253,306` bytes) is present. Installing dependencies via `npm.cmd ci` (or `npm.cmd install`) in `Frontend_/` will be performed in Phase 1.

### 2.2 Complete Route & Component Inventory of `Frontend_/`

| Route Path | Component (`Frontend_/src/...`) | Current Functionality | Integration Target |
|---|---|---|---|
| `/` | `features/explorer/ExplorerPage.tsx` + `ExplorerMap.tsx` | Interactive MapLibre GL map, Natural Earth relief tiles, FIRMS density grid, heat-spot points, candidate fire markers, country/date/radar filters, map legend | Connect to real backend events (`/api/events`), real FIRMS hotspots (`/api/events/{id}/firms`), and real SAR layer overlays in API mode while keeping mock mode intact for existing unit tests |
| `/history` | `features/history/FireHistoryPage.tsx` | Filterable catalog of candidate fires with summary `StatTile`s, country search, radar sensor filter, and sort order | Populate from real NASA wildfire catalog (`CA_GANN_2026`, `CA_DOME_2026`, `CA_BUG_2026`, `CA_TIMBER_2026`) + user-analyzed scenes |
| `/events/:eventId` | `features/story/FireStoryPage.tsx` | 7-section Fire Story (`#summary`, `#known`, `#heat-spots`, `#radar-data`, `#analysis`, `#report`, `#learn`), MapLibre story map, daily FIRMS histogram, pre/post scene metadata, surface-change metrics, JSON/CSV download | Display real Sentinel-1 pre/post scene metadata, interactive Before vs. After SAR & prediction map overlays (`/api/events/{id}/layers/{key}.png`), 6-panel overview (`/api/events/{id}/overview.png`), multi-model metrics, and trigger live model re-inference |
| `/research` | `features/research/ResearchPages.tsx` | Research Center layout & overview with sub-navigation for Projects, Data, Annotation, AI Models, Analysis, Reports, Collaboration | Update capabilities status and wire real backend capabilities |
| `/research/projects/*` | `features/research/projects/ProjectPages.tsx`, `ProjectForm.tsx` | Create, edit, view, delete research projects; link fire events and catalog datasets | Preserve full browser storage workflow and allow linking real backend datasets & analysis runs |
| `/research/data/*` | `features/research/datasets/DatasetPages.tsx` | Dataset catalog & dataset details with provenance, coverage, licence, and "Add to project" | Include real backend-acquired datasets (`run_20261114_025000_phase_g` Sentinel-1 RTC, Sentinel-2 dNBR, MODIS MCD64A1, FIRMS) AND add **Real Satellite Image Upload & Validation** workflow |
| `/research/models` | `features/research/ResearchPages.tsx` (currently `CapabilityPage id="models"`) | Static placeholder (`"Planned: nothing here works yet"`) | Replace/upgrade with interactive **AI Models & Model Comparison** workspace showing real model cards (`UNet_ResNet34`, `LightGBM_Pixel_Spatial`, `Log_Ratio_Baseline`, `CUSUM_Temporal`), dual-leaderboard evaluation metrics (`Sentinel-2 dNBR` vs `MODIS MCD64A1`), checkpoints, and interactive model runner |
| `/research/analysis` | `features/research/ResearchPages.tsx` (currently `CapabilityPage id="analysis"`) | Static placeholder (`"Not available yet: nothing here works yet"`) | Replace/upgrade with interactive **Wildfire Before/After Analysis & Live Inference Studio** supporting single-image & pre/post pair upload, compatibility validation, model selection, threshold adjustment, interactive Before/After swipe/side-by-side/overlay viewer, and downloadable GeoTIFF/GeoJSON/PNG outputs |
| `/places` | `features/places/MyPlacesPage.tsx` | Saved countries & local alerts | Works automatically with HTTP adapter |
| `/guide`, `/how-it-works`, `/planned` | `features/guide/*`, `features/planned/*` | Documentation, FAQ articles, methodology | Preserve intact |

### 2.3 Comparison Between `Frontend_/` and `frontend/` (Rule 17)

| Dimension | `Frontend_/` (With Trailing Underscore) | `frontend/` (Without Underscore) |
|---|---|---|
| Origin | Developer-provided full product frontend | Created during Phase G7 |
| File Count in `src/` | **102 files** (modular `app/`, `components/`, `data/`, `features/`, `lib/`, `styles/`, `test/`) | **13 files** (`App.tsx` + 5 view components) |
| Routing | Full URL routing via `react-router` v7 (`createBrowserRouter`, 15+ routes & redirects) | Tab state in `App.tsx` |
| Map Engine | Real `maplibre-gl` v6 with offline Natural Earth relief tiles, country boundaries, and custom label layer | HTML5 Canvas / SVG overlay viewer |
| Scientific Value System | Strict `SciValue<T>` (`measured`, `derived`, `estimated`, `placeholder`) + `Provenance` validator (`validate.ts`) | Direct JSON rendering |
| Accessibility & Tests | 16 Vitest files including `axe-core` WCAG checks, keyboard navigation, route focus, responsive layout | 1 Vitest file (`App.test.tsx`) |
| **Action Plan** | **Primary application — integrate all backend APIs, upload, before/after validation, and real model inference here** | Keep untouched for reference; run dev/build/test servers from `Frontend_/` |

---

## 3. Backend Architecture & Existing Endpoints Inventory

### 3.1 Existing FastAPI Endpoints (`backend/app/api/endpoints.py`)

| Method & Path | Handler | Current Behavior |
|---|---|---|
| `GET /api/health` | `health_check` | Returns `status`, `version`, `active_run_id` (`run_20261114_025000_phase_g`), `geospatial_ready`, `ml_ready`, `dataset_ready`, `checkpoints_ready`, `nisar_status` |
| `GET /api/runs/latest` | `get_latest_versioned_run` | Returns `outputs/runs/latest_run.json` + manifest & model comparison summary |
| `GET /api/models/comparison` | `get_model_comparison` | Returns full `model_comparison.json` from active run (`run_20261114_025000_phase_g`) |
| `GET /api/metrics` | `get_metrics_alias` | Alias for `/api/models/comparison` |
| `GET /api/dataset/stats` | `get_dataset_stats` | Returns `dataset_manifest.json` with split counts, normalization stats, water mask audit |
| `GET /api/nisar/status` | `get_nisar_status` | Returns honest NISAR CMR discovery vs Earthdata auth status |
| `GET /api/nisar/candidates` | `get_nisar_candidates` | Returns discovered NISAR granules from `data/real/nisar_cmr_candidates.json` |
| `GET /api/events` | `list_fire_events` | Lists real wildfire events (`include_excluded: bool = False` by default; `True` includes `CA_TIMBER_2026`) |
| `GET /api/events/{event_id}` | `get_fire_event` | Returns `FireEventSchema` for an event |
| `GET /api/events/{event_id}/analysis` | `get_event_unified_analysis` | Returns unified event metadata, before/after summary, rasters, GeoJSONs, and per-model metrics |
| `GET /api/events/{event_id}/before-after` | `get_event_before_after` | Returns `before_after_summary.json` with provenance |
| `GET /api/events/{event_id}/products` | `get_event_products` | Returns geospatial file manifest for an event |
| `GET /api/events/{event_id}/validation` | `get_event_validation` | Returns Sentinel-2 dNBR vs MODIS MCD64A1 dual-reference validation |
| `GET /api/events/{event_id}/firms` | `get_event_firms_hotspots` | Returns FIRMS active-fire hotspot summary and records |
| `GET /api/events/{event_id}/geojson` | `get_event_geojson` | Returns `aoi_boundary` and `firms_hotspots` GeoJSON FeatureCollections |
| `GET /api/events/{event_id}/rasters` | `get_event_rasters` | Returns raster layer metadata, WGS84 bounds, and PNG overlay URLs |
| `GET /api/events/{event_id}/layers/{layer_key}.png` | `get_event_layer_png` | Serves 800×800 transparent RGBA PNG overlay for `pre_fire_vh_db`, `post_fire_vh_db`, `delta_vh_db`, `burn_probability`, `predicted_burn_mask`, `dnbr_reference`, `mcd64a1_reference`, `valid_land_mask` |
| `GET /api/events/{event_id}/overview.png` | `get_event_overview_png` | Serves 6-panel Before/After + Reference QA PNG |
| `POST /api/analysis/run` | `trigger_analysis` | Currently looks up pre-computed event metrics in `AnalysisService.run_analysis` (does not yet run live model inference on uploaded rasters) |
| `GET /api/analysis/{job_id}/results` | `get_analysis_results` | Returns cached job result from `AnalysisService.jobs_cache` |

---

## 4. Exact Model Input/Output Contracts & Scientific Constraints

### 4.1 Model 1: `UNet_ResNet34` (Deep Learning Spatial Segmentation)
- **Implementation:** `backend/processing/models/unet_resnet.py` (`UNetResNet34(in_channels=5, num_classes=1, pretrained=False)`)
- **Verified Checkpoint:** `outputs/runs/run_20261114_025000_phase_g/checkpoints/real_unet_resnet34_phase_g.pt` (`349,206,898` bytes)
- **Exact Input Tensor Contract:**
  - Shape: `(B, 5, H, W)` `float32` tensor (sliding window `128×128` with stride `64` and overlap averaging via `predict_unet_scene`).
  - Channel order (all in decibels $\text{dB} = 10 \log_{10}(\text{power})$):
    - `Channel 0`: `vv_pre_db` (Pre-fire co-pol VV backscatter in dB)
    - `Channel 1`: `vh_pre_db` (Pre-fire cross-pol VH backscatter in dB)
    - `Channel 2`: `vv_post_db` (Post-fire co-pol VV backscatter in dB)
    - `Channel 3`: `vh_post_db` (Post-fire cross-pol VH backscatter in dB)
    - `Channel 4`: `delta_vh_db` (`vh_post_db - vh_pre_db` in dB)
  - Missing-value imputation & Z-score normalization (from `TRAIN = CA_GANN_2026` valid land pixels in `dataset_manifest.json`):
    - `mean = [-10.1034727, -16.6154194, -10.1521187, -16.8679810, -0.2525662]`
    - `std  = [ 2.8118210,   3.5553586,   2.8102582,   3.5088341,   2.0916770]`
- **Output Contract:**
  - Continuous burn probability raster `prob_map` $\in [0, 1]$ (`float32`, shape `(H, W)`), masked by `valid_mask > 0`.
  - Binary burn prediction mask `(prob_map >= threshold) & (valid_mask > 0)` (`uint8`), default VAL-calibrated threshold = **`0.66`**.

### 4.2 Model 2: `LightGBM_Pixel_Spatial` (Gradient Boosted Decision Trees)
- **Implementation:** `backend/processing/models/lightgbm_model.py` (`LightGBMBurnedAreaClassifier`) & `scripts/run_real_pipeline.py` (`extract_features_db`)
- **Verified Checkpoint:** `outputs/runs/run_20261114_025000_phase_g/checkpoints/lightgbm_phase_g.pkl` (`16,758` bytes, Config D `D_unweighted_shallow_auc_es`, `best_iteration = 6`)
- **Exact Input Feature Contract:**
  - Shape: `(H, W, 10)` `float32` flattened to `(H*W, 10)` for `model.predict_proba(X)[:, 1]`.
  - Exact 10-feature order:
    1. `vv_pre_db`
    2. `vh_pre_db`
    3. `vv_post_db`
    4. `vh_post_db`
    5. `delta_vv_db` (`vv_post_db - vv_pre_db`)
    6. `delta_vh_db` (`vh_post_db - vh_pre_db`)
    7. `delta_diff_db` (`delta_vh_db - delta_vv_db`)
    8. `local_mean_delta_vh` ($5 \times 5$ uniform filter mean of `delta_vh_db`)
    9. `local_std_delta_vh` ($5 \times 5$ local standard deviation of `delta_vh_db`)
    10. `post_vv_minus_vh_db` (`vv_post_db - vh_post_db`)
- **Output Contract:**
  - Continuous burn probability raster `prob_map` $\in [0, 1]$ (`float32`, shape `(H, W)`), masked by `valid_mask > 0`.
  - Binary burn prediction mask `(prob_map >= threshold) & (valid_mask > 0)` (`uint8`), default VAL-calibrated threshold = **`0.17`**.

### 4.3 Model 3: `Log_Ratio_Baseline` (Analytical Radar Change Detector)
- **Implementation:** `backend/processing/change_detection/log_ratio_detector.py` (`LogRatioDetector`)
- **Input Requirements:**
  - Requires at minimum a co-registered Pre-fire and Post-fire cross-pol (`VH` or `HV`) backscatter pair (either linear power $\sigma^0/\gamma^0 > 0$ or dB) or single-band SAR backscatter pair.
  - Supports single-polarization (`VH`/`HV` or `VV`/`HH`) when dual-pol (`VV+VH`) is not present in a user-uploaded single-band SAR GeoTIFF pair!
- **Output Contract:**
  - `change_map_db = post_db - pre_db` (`float32`).
  - Continuous score `1 / (1 + exp(-((-change_map_db - abs(threshold_db)) / 1.5)))` $\in [0, 1]$.
  - Binary change mask `(change_map_db <= threshold_db) & (valid_mask > 0)`, default TRAIN-calibrated threshold = **`-1.20 dB`** (or user-configurable / adaptive / Otsu).

### 4.4 Model 4: `CUSUM_Temporal` (Multi-Temporal Cumulative Sum Detector)
- **Implementation:** `backend/processing/change_detection/cusum.py` (`CUSUMDetector`)
- **Input Requirements:**
  - Requires $\ge 3$ co-registered temporal SAR backscatter rasters in dB `(T, H, W)`.
- **Output Contract:**
  - Cumulative negative anomaly score `s_low` (`float32`) and binary mask `(s_low >= h_decision) & valid_mask`, with `k_allowance = 0.5` and VAL-calibrated `h_decision = 3.5`.

### 4.5 Scientific Input Validation Contract (Why Ordinary RGB PNG/JPEG Images Cannot Feed SAR Models)
- `UNet_ResNet34` and `LightGBM_Pixel_Spatial` operate on calibrated physical radar backscatter ($\gamma^0$ in linear power or dB) across dual polarizations (`VV` and `VH`) before and after a fire.
- An ordinary 3-band 8-bit RGB PNG or JPEG contains uncalibrated display-referred optical color values (`0..255`) with no Coordinate Reference System (CRS), no affine geotransform, and no radar polarization channels.
- Therefore, the upload & validation service must:
  1. Inspect uploaded files with `rasterio` / `numpy`.
  2. Accept georeferenced `.tif` / `.tiff` GeoTIFFs (single-band SAR dB/power, 2-band `[VV, VH]` SAR GeoTIFFs, 4-band `[VV_pre, VH_pre, VV_post, VH_post]` GeoTIFFs, or 5-band `[VV_pre, VH_pre, VV_post, VH_post, delta_VH]` GeoTIFFs) as well as `.npz` prepared multi-band stacks.
  3. Explicitly determine which models are compatible with the uploaded raster(s):
     - **Dual-pol (`VV + VH`) Pre + Post pair or 4/5-band stacked GeoTIFF / `.npz`:** Compatible with **all models** (`UNet_ResNet34`, `LightGBM_Pixel_Spatial`, `Log_Ratio_Baseline`).
     - **Single-band (`VH` or `VV`) Pre + Post GeoTIFF pair:** Compatible with **`Log_Ratio_Baseline`** (analytical dB change detection), while explicitly reporting why `UNet_ResNet34` and `LightGBM_Pixel_Spatial` require dual-polarization (`VV + VH`).
     - **Ungeoreferenced RGB `.png` / `.jpg` / `.jpeg`:** Rejected for SAR model inference with a clear, structured scientific explanation (`UNSUPPORTED_OPTICAL_RGB_FOR_SAR_MODEL`), never silently converted or faked.

---

## 5. Identified Integration Gaps

1. **Gap 1 — Missing Real HTTP Repository Adapter in `Frontend_/`:**
   - `Frontend_/src/data/http/unavailableRepositories.ts` throws `DataError("unavailable")` for all 5 repositories (`events`, `detections`, `scenes`, `availability`, `analysis`).
   - Needs a real `httpRepositories.ts` adapter (plus dataset catalog adapter) that maps FastAPI responses (`/api/events`, `/api/events/{id}/firms`, `/api/events/{id}/before-after`, `/api/events/{id}/analysis`, `/api/events/{id}/rasters`) to `Frontend_/` domain types (`FireEvent`, `ActiveFireDetection`, `SceneSummary`, `AvailabilityReport`, `AnalysisResult`) while passing every runtime invariant in `Frontend_/src/data/validate.ts`.
2. **Gap 2 — Date Window Clamping in `ExplorerParams` (`useExplorerParams.ts`):**
   - `DATA_PERIOD` in `useExplorerParams.ts` is hardcoded to `DEMO_WINDOW` (`2025-07-01`..`2025-09-30`).
   - In `mock` mode, this must remain `2025-07-01`..`2025-09-30` so all existing Vitest unit tests pass unchanged.
   - In `http` / `api` mode, the real NASA wildfire events (`CA_GANN_2026`, `CA_DOME_2026`, `CA_BUG_2026`, `CA_TIMBER_2026`) span **`2024-07-01`..`2024-09-30`**, so `useExplorerParams` must support the real data window when connected to the backend.
3. **Gap 3 — `FireStoryPage.tsx` Missing Visual Raster Overlays & Model Selector:**
   - `FireStoryPage.tsx` line 227 currently renders: `"The change map image itself is not available in this data, so only the numbers are shown."`
   - When `analysis.layers.differenceMap` or `analysis.layers.changeMask` (or event raster overlays from the backend) are present, `FireStoryPage.tsx` should render the interactive Before/After SAR backscatter, ΔVH dB change map, U-Net/LightGBM burn probability, and optical/MODIS reference overlays, plus the 6-panel overview PNG and live model switching.
4. **Gap 4 — Backend Upload, Pair Validation, and Live Inference Endpoints Missing:**
   - The backend needs:
     - `POST /api/analysis/upload` (upload single or paired `.tif`/`.tiff`/`.npz` files, inspect with `rasterio`, extract CRS, bounds, dimensions, bands, dtype, nodata, valid pixel %, and return structured `upload_id` + compatibility diagnostics).
     - `POST /api/analysis/validate-pair` (validate Before vs. After raster pair compatibility: CRS, spatial overlap %, resolution, dimensions, band compatibility, and automatically co-register/reproject onto a common UTM grid via `rasterio.warp.reproject` when needed).
     - `POST /api/analysis/run` (extended to run real `InferenceService.analyze(...)` on either an uploaded `upload_id` / `pair_id` or a catalog `event_id`, executing real PyTorch `UNetResNet34`, `LightGBM`, `LogRatioDetector`, or `CUSUMDetector`, generating output GeoTIFFs, RGBA PNG overlays, GeoJSON burned-area polygons, and CRS-aware area statistics).
     - `GET /api/analysis/jobs/{job_id}` (and existing `/api/analysis/{job_id}/results`).
     - `GET /api/analysis/results/{analysis_id}` & `GET /api/analysis/results/{analysis_id}/layers/{layer_key}` (serve generated PNG overlays, GeoTIFF downloads, and GeoJSON boundaries for any analysis run).
     - `GET /api/analysis/history` (list completed analysis runs from both the active run catalog and user uploads).
     - `GET /api/models/available` (return model registry cards, checkpoint paths, SHA-256 hashes, input contracts, thresholds, and dual-reference benchmark metrics).
5. **Gap 5 — Interactive Upload, Before/After Comparison, and Model Comparison UI in `Frontend_/`:**
   - `/research/analysis` (`Analysis`) and `/research/models` (`AI models`) and `/research/data` (`Datasets`) in `Frontend_/` need interactive workspaces connected to the new backend endpoints while preserving the existing Research Center navigation and layout.

---

## 6. Phased Implementation Plan (Phases 1–9)

1. **Phase 1 — `Frontend_/` Setup & Backend API Integration:**
   - Install dependencies in `Frontend_/` (`npm.cmd ci`).
   - Support both `VITE_DATA_MODE=http` and `VITE_DATA_MODE=api` in `Frontend_/src/app/env.ts` (defaulting to `mock` inside Vitest runs so all 16 existing test suites pass, and `http`/`api` in `.env.development` / `.env.local` for live backend execution, plus a Vite `/api` proxy in `Frontend_/vite.config.ts`).
   - Implement `Frontend_/src/data/http/httpRepositories.ts` and `httpCatalogRepository.ts` mapping real FastAPI endpoints to `Frontend_/` repositories and catalog datasets.
2. **Phase 2 — Real Image Upload & Raster Validation Service (`backend/app/services/upload_service.py`):**
   - Implement `POST /api/analysis/upload` and `GET /api/analysis/uploads/{upload_id}` with real `rasterio` inspection, thumbnail/preview PNG generation, and strict rejection of ungeoreferenced RGB images for SAR models.
3. **Phase 3 — Before vs. After Compatibility & Co-Registration (`backend/app/services/upload_service.py`):**
   - Implement `POST /api/analysis/validate-pair` checking CRS, bounding-box intersection, resolution, band compatibility, and performing automatic `rasterio.warp.reproject` alignment when CRS or grid dimensions differ.
4. **Phase 4 — Real Model Registry & Unified `InferenceService` (`backend/app/services/inference_service.py`):**
   - Load real checkpoints (`real_unet_resnet34_phase_g.pt` and `lightgbm_phase_g.pkl`) and analytical detectors (`LogRatioDetector`, `CUSUMDetector`).
   - Implement `InferenceService.analyze(input_data, model_name, options)` executing genuine forward passes on uploaded rasters or catalog events.
5. **Phase 5 & 6 — Backend Endpoints & Geospatial Artifact Generation:**
   - Generate prediction GeoTIFF, probability GeoTIFF, change-detection GeoTIFF, RGBA PNG overlays (`pre_vh_db`, `post_vh_db`, `delta_vh_db`, `burn_probability`, `predicted_burn_mask`), vectorized burned-area GeoJSON polygons (`rasterio.features.shapes`), 6-panel overview PNG, and CRS-aware area calculations ($\text{km}^2$ and hectares).
   - Expose all required endpoints in `backend/app/api/endpoints.py`.
6. **Phase 7 — Complete Frontend Experience in `Frontend_/`:**
   - Upgrade `/events/:eventId` (`FireStoryPage.tsx`) to display real Before/After SAR & model prediction overlays, interactive comparison modes (Side-by-Side, Swipe Slider, Layer Overlay, Difference View), and live model execution.
   - Upgrade `/research/analysis` into the full **Wildfire Before/After Upload & Inference Studio**.
   - Upgrade `/research/models` into the **AI Model Registry & Dual-Reference Benchmark Leaderboard**.
   - Upgrade `/research/data` to list all real NASA datasets from the backend and allow direct raster file uploads.
7. **Phase 8 — Automated Tests:**
   - Add backend pytest suite (`backend/tests/test_inference_and_upload.py`) testing real GeoTIFF upload, RGB rejection, pair co-registration, and real inference across `unet`, `lightgbm`, and `log_ratio`.
   - Verify all existing 16 Vitest suites in `Frontend_/` pass and add new Vitest tests for HTTP repository mapping, Upload & Analyze, Before/After comparison, and Model Registry views.
8. **Phase 9 — Final Runtime Verification & Deliverable Reports:**
   - Run FastAPI backend (`:8000`) and `Frontend_/` Vite server (`:5173`), execute end-to-end upload + inference + visualization checks, and produce `reports/ASTERA_WATCH_INFERENCE_IMPLEMENTATION.md` and `reports/ASTERA_WATCH_END_TO_END_VERIFICATION.md`.
