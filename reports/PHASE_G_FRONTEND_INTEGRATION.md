# ASTERA WATCH — PHASE G7 & G8: FRONTEND PRODUCTION INTEGRATION & CONTRACT REPORT

**Repository:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`  
**Branch:** `feature/sar-ml-pipeline`  
**Frontend Root:** `frontend/` (Vite + React 18 + TypeScript 5.6)  
**Backend Root:** `backend/app/` (FastAPI + Pydantic v2)  
**Active Versioned Run:** `run_20261114_025000_phase_g`

---

## 1. Frontend Architecture & Production Stack

The Astera Watch frontend (`frontend/`) was engineered as a modular, strict-typed React + TypeScript + Vite single-page application consuming live FastAPI endpoints with zero hardcoded scientific metrics:

- **Entry & Build Configuration:**
  - `frontend/package.json` (`build`, `typecheck`, `lint`, `test`, `dev`, `preview`)
  - `frontend/tsconfig.json` (strict TypeScript 5.6 configuration)
  - `frontend/vite.config.ts` (dev proxy to `http://127.0.0.1:8000` for `/api` and `/health`, plus Vitest + JSDOM configuration)
  - `frontend/index.html` (loads `Space Grotesk`, `Inter`, `JetBrains Mono`, and `/astera-logo.jpg`)
- **Source Modules (`frontend/src/`):**
  - `src/types.ts`: Strict TypeScript interfaces matching all Phase G6 backend response contracts (`HealthResponse`, `LatestRunResponse`, `FireEvent`, `ModelComparisonResponse`, `DatasetStatsResponse`, `EventAnalysisResponse`, `EventGeoJSONResponse`, `NisarStatusResponse`).
  - `src/api.ts`: Typed HTTP client and asset URL resolver.
  - `src/index.css`: Full Light (`#FAF8F3` warm cream) and Dark (`#0B1020` midnight orbital navy) theme system with `#F97316` solar amber, `#EA580C` ember orange, `#38BDF8` orbital cyan, `#EF4444` fire red, and `#22C55E` validation green.
  - `src/App.tsx`: Top navigation shell, theme toggle, error/loading state management, and **Main Dashboard** view.
  - `src/components/WildfireMapView.tsx`: **Interactive Wildfire Map** with event selector, georeferenced 800×800 (20 m) RGBA raster overlays, dual-layer underlay comparison, opacity slider (`0%–100%`), zoom controls, live WGS84 cursor coordinate readout, AOI polygon boundary, interactive FIRMS thermal hotspot point inspector, and verified GeoTIFF metadata card.
  - `src/components/EventDetailsView.tsx`: **Event Details Page** with acquisition timeline, co-registration verification, water-exclusion status, interactive side-by-side Before/After raster comparison, 6-panel publication overview figure, and burned-area comparison across all models and references (`km²`, `ha`, `95% CI`).
  - `src/components/ModelPerformanceView.tsx`: **Model Performance Page** with three strictly separated leaderboards (`vs Sentinel-2 dNBR 20 m`, `vs NASA MODIS MCD64A1.061 20 m`, and `vs NASA MODIS MCD64A1.061 Native 500 m Blocks`), split selector (`TEST`, `VAL`, `TRAIN`), confusion matrices (`TP, FP, FN, TN`), ROC-AUC, PR-AUC, and checkpoint SHA-256 provenance.
  - `src/components/DatasetExplorerView.tsx`: **Dataset Explorer** explicitly distinguishing **Unique Non-Overlapping Scene Pixels** (`1,920,000` total, `1,674,809` valid land, `27,939` water excluded) from **Overlapping Sliding-Window Patch Pixels** (`336` patches × `128×128` = `5,505,024` nominal pixels, `5,158,361` valid land patch pixels, `346,663` invalid/water masked patch pixels), per-event breakdown including excluded `CA_TIMBER_2026`, valid-only normalization stats, and live-network vs. cached-raster data provenance.
  - `src/components/NisarStatusView.tsx`: **Truthful NISAR Status Panel** reporting `Metadata discovered: Yes (28 granules, 15 matched pairs)`, `Authentication required: Yes`, `Download blocked: Yes (HTTP 401)`, `NISAR granules downloaded: No`, `NISAR pixels used: 0`, and `Current SAR model input: Sentinel-1 C-band`.

---

## 2. Backend Production API Endpoints (`Gate G6`)

All backend routes are mounted under both `/api` and `/api/v1` and dynamically resolve the active versioned run from `outputs/runs/latest_run.json` (`run_20261114_025000_phase_g`):

| Endpoint | Method | Purpose | Verified Status |
|---|---|---|---|
| `/health` & `/api/health` | `GET` | Service health, `active_run_id`, dataset & checkpoint readiness, NISAR status | `200 OK` |
| `/api/runs/latest` | `GET` | Full active run manifest, sensor provenance, dataset counts, water-exclusion audit, checkpoint SHA-256s, scientific limitations | `200 OK` |
| `/api/models/comparison` & `/api/metrics` | `GET` | Verified model metrics with separate leaderboards (`vs_sentinel2_dnbr_20m`, `vs_nasa_mcd64a1_20m`, `vs_nasa_mcd64a1_500m_blocks`) | `200 OK` |
| `/api/dataset/stats` | `GET` | Unique scene pixels vs. overlapping patch pixels, per-event & per-split breakdowns, normalization stats, data provenance | `200 OK` |
| `/api/events` | `GET` | Monitored wildfire events (`?include_excluded=true` returns all 4 events including `CA_TIMBER_2026`) | `200 OK` |
| `/api/events/{event_id}` | `GET` | Single event metadata (`?allow_excluded=true` supported) | `200 OK` |
| `/api/events/{event_id}/analysis` | `GET` | Unified event analysis: before/after stats, area estimates, FIRMS summary, validation metrics, raster audit, web overlay URLs | `200 OK` |
| `/api/events/{event_id}/geojson` | `GET` | Co-registered `aoi_boundary` and `firms_hotspots` GeoJSON FeatureCollections | `200 OK` |
| `/api/events/{event_id}/rasters` | `GET` | Verified `raster_quality_audit` and RGBA PNG overlay URLs | `200 OK` |
| `/api/events/{event_id}/layers/{layer_key}.png` | `GET` | Streams transparent RGBA PNG web overlay (`image/png`) for all 8 required layers | `200 OK` |
| `/api/events/{event_id}/overview.png` | `GET` | Streams 6-panel Before/After overview figure (`image/png`) | `200 OK` |
| `/api/events/{event_id}/firms` | `GET` | Event FIRMS summary + GeoJSON FeatureCollection | `200 OK` |
| `/api/nisar/status` & `/api/nisar/candidates` | `GET` | Truthful NISAR status (`0` pixels used) + CMR pre/post granule pairs | `200 OK` |
| `/api/analysis/run` | `POST` | Returns stored real evaluation metrics and block-bootstrap CI for any `(event_id, model_type)` pair | `200 OK` |

---

## 3. Contract & Build Verification (`Gate G8`)

- **Backend API & Contract Tests (`backend/tests/test_api.py` + `backend/tests/test_api_phase_g.py`):** `22/22 passed` (including invalid event ID `404` tests, invalid layer `404` tests, missing `latest_run.json` fallback test, and security check verifying zero leaked absolute local paths or API keys).
- **Frontend TypeScript Check (`npm.cmd run typecheck`):** `0 errors`.
- **Frontend Unit/Integration Tests (`npm.cmd run test`):** `3/3 passed`.
- **Frontend Production Build (`npm.cmd run build`):** Succeeded, generating optimized production assets in `frontend/dist/`.
