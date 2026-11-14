# BACKEND & APPLICATION INTEGRATION REPORT
## Astera Watch — Phase 9 FastAPI Endpoints, Provenance & Schema Verification
**Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*  
**Generated:** 2026-11-13  
**Entry Point:** `backend/app/main.py` (`FastAPI v2.0.0`)

---

## 1. API Route Architecture (`/api/...` and `/api/v1/...`)

Both `/api` and `/api/v1` prefixes are mounted in `backend/app/main.py`, preserving 100% backwards compatibility with existing clients while supporting versioned `/api/v1/...` consumers:

| HTTP Method & Route | `/api/v1` Alias | Handler (`backend/app/api/endpoints.py`) | Service Method (`AnalysisService`) | Verified HTTP Status |
| :--- | :--- | :--- | :--- | :---: |
| `GET /health` | — | `root_health` | — | `200 OK` |
| `GET /api/health` | `GET /api/v1/health` | `health_check` | — | `200 OK` |
| `GET /api/events` | `GET /api/v1/events` | `list_fire_events` | `list_events(include_excluded)` | `200 OK` |
| `GET /api/events/{event_id}` | `GET /api/v1/events/{event_id}` | `get_fire_event` | `get_event(event_id, allow_excluded)` | `200 OK` (`404` on unknown) |
| `GET /api/events/{event_id}/before-after` | `GET /api/v1/events/{event_id}/before-after` | `get_event_before_after` | `get_before_after_analysis(event_id)` | `200 OK` |
| `GET /api/events/{event_id}/products` | `GET /api/v1/events/{event_id}/products` | `get_event_products` | `get_event_geospatial_products(event_id)` | `200 OK` |
| `GET /api/events/{event_id}/validation` | `GET /api/v1/events/{event_id}/validation` | `get_event_independent_validation` | `get_event_independent_validation(event_id)` | `200 OK` |
| `GET /api/nisar/candidates` | `GET /api/v1/nisar/candidates` | `get_nisar_candidates` | `get_nisar_candidates_report()` | `200 OK` |
| `POST /api/analysis/run` | `POST /api/v1/analysis/run` | `trigger_analysis` | `run_analysis(...)` | `200 OK` (`400`/`404` on invalid input) |
| `GET /api/analysis/{job_id}/results` | `GET /api/v1/analysis/{job_id}/results` | `get_analysis_results` | `get_job_results(job_id)` | `200 OK` |
| `GET /api/models/comparison` | `GET /api/v1/models/comparison` | `get_model_comparison` | `get_model_comparison_report()` | `200 OK` |

---

## 2. Provenance & Scientific Honesty Contract

Every Before/After, geospatial product, and validation response includes an explicit `provenance` object:
```json
{
  "sensor": "Sentinel-1 RTC C-band (VV/VH)",
  "collection": "sentinel-1-rtc",
  "product_version": "RTC Gamma0 20m",
  "acquisition_timestamps": {
    "s1_pre_dates": ["2026-08-03"],
    "s1_post_dates": ["2026-08-27", "2026-09-08"],
    "s2_pre_date": "2026-08-06",
    "s2_post_date": "2026-08-30"
  },
  "event_id": "CA_BUG_2026",
  "data_origin": "CROSS_SENSOR_PROTOTYPE",
  "processing_version": "2.0.0",
  "model_version": "unet_v2.0.0",
  "reference_source": "Sentinel-2 L2A dNBR >= 0.11 (primary) & NASA MODIS MCD64A1.061 (independent check)",
  "project_maturity_status": {
    "CROSS_SENSOR_PROTOTYPE": true,
    "NISAR_DATA_DISCOVERED": true,
    "NISAR_PREPROCESSING_VALIDATED": true,
    "NISAR_DATA_ACQUIRED": false,
    "NISAR_CHANGE_ANALYSIS_COMPLETED": false,
    "NISAR_MODEL_EVALUATED": false
  }
}
```
- When `USE_MOCK_DATA=true` (`AnalysisService(use_mock_data=True)`), every event is explicitly tagged `data_origin="SYNTHETIC_MOCK_DATA"` and `is_synthetic=True`.
