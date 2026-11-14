# FINAL TEST & VERIFICATION REPORT
## Astera Watch — Phase 10 Automated Test Suite & Bug Fix Audit
**Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*  
**Generated:** 2026-11-13

---

## 1. Test Execution Summary

- **Command Executed:** `python -m pytest backend/tests/ -v`
- **Working Directory:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`
- **Environment:** Python `3.13.7`, `pytest-9.1.1`, Windows 11 (`win32`)
- **Result:** **`41 passed, 0 failed, 0 skipped` (`19.12s`)**

---

## 2. Test Modules & Coverage Breakdown

| Test Module | Tests Passed | Key Capabilities Verified |
| :--- | :---: | :--- |
| **`backend/tests/test_adapters.py`** | `6 / 6` | Mock SAR scene generation; `NISAR_GCOV_Adapter` HDF5 inspection, validation, and loading; fail-closed validation on missing `zeroDopplerStartTime` and `projection`; stateless `frequencyB` discovery, `complex64` off-diagonal covariance (`HHHV`), $\gamma^0 \to \sigma^0$ conversion (`rtcGammaToSigmaFactor`), subswath `mask` decoding (`0`, `1..254`, `255`); `_extract_asf_bytes` nested dict parsing and `build_harmony_subset_url`; 500 m coarse block reconciliation (`calculate_coarse_block_reconciliation_metrics`). |
| **`backend/tests/test_api.py`** | `13 / 13` | `/health` and `/api/health`; `/api/events` and `/api/events/{event_id}`; `POST /api/analysis/run` (LightGBM & U-Net stored metrics, `404` on unknown event, `400` on unknown model); `/api/models/comparison`; `/api/events/{event_id}/before-after`; `/api/events/{event_id}/products` (including `before_after_overview_png` format `"PNG"`); `/api/events/{event_id}/validation` (including `vs_nasa_mcd64a1_500m_block_reconciled` and `all_burned`); `/api/nisar/candidates` (`C3622241360-ASF` & `C2854338529-ASF` matched pairs); `/api/v1/...` route alias parity; `USE_MOCK_DATA=true` explicit `SYNTHETIC_MOCK_DATA` labeling. |
| **`backend/tests/test_metrics.py`** | `2 / 2` | Exact binary confusion matrix, Precision, Recall, F1, IoU, Dice, Specificity, FPR, FNR, and projected area error calculation. |
| **`backend/tests/test_models.py`** | `5 / 5` | Hard global sample cap (`MAX_GLOBAL_SAMPLES = 10,000`) enforcement; calibrated log-ratio detector; LightGBM training and spatial inference; U-Net ResNet-34 forward pass (`(B, 5, 128, 128) -> (B, 1, 128, 128)`); 4-step CUSUM temporal change detector. |
| **`backend/tests/test_preprocessing.py`** | `8 / 8` | Linear-to-dB conversion; log-ratio computation; Enhanced Lee speckle filter; leakage-free normalization (`fit` on `TRAIN` only); `MCD64A1.061` `Burn_Date` and `QA` bitfield decoding; FIRMS UTC/confidence normalization; JPL `NISAR_L2_PR_GCOV_...` granule ID parser (`P05023` vs `P05036`); projected UTM burned-area integration and `EPSG:4326` rejection. |
| **`backend/tests/test_real_pipeline.py`** | `7 / 7` | Strict `NaN`-preserving `power_to_db`; edge-aware full-scene tiling; `TRAIN`-only log-ratio threshold calibration; `VAL`-only probability threshold selection; `valid_mask` enforcement in segmentation metrics; spatial block-bootstrap 95% CI bounds; `TRAIN`-mean imputation for missing pixels. |

---

## 3. Bugs Discovered & Fixed During Verification

1. **`asf_search` Nested Dictionary `bytes` Bug (`backend/processing/acquisition/asf_client.py`):**
   - *Symptom:* `asf_search 14.1.0` returns `item.properties["bytes"]` as a nested dictionary `{"<granule>.h5": {"bytes": 7099342848, "format": "HDF5"}, ...}` for NISAR products rather than a scalar number, raising `TypeError: float() argument must be a string or a real number, not 'dict'`.
   - *Fix:* Implemented `_extract_asf_bytes(raw_bytes, scene_name)` to extract the `.h5` byte count cleanly for both dictionary and scalar representations; verified by `test_asf_bytes_extraction_and_harmony_url_builder`.
2. **`MCD64A1.061 QA` Layer `dst_nodata` Remapping (`scripts/acquire_ancillary_and_nisar_metadata.py`):**
   - *Symptom:* Earlier extraction of `QA` for `CA_GANN_2026` did not pass `dst_nodata=255`, causing `QA == 0` (water) pixels to be remapped.
   - *Fix:* Forced re-extraction of `QA` with `dst_nodata=255` across all 4 events, restoring the exact `0.42%` water pixel fraction (`land_fraction = 0.9958`) in `CA_GANN_2026`.
3. **PNG Product Format Classification (`backend/app/services/analysis_service.py`):**
   - *Fix:* Updated `get_event_geospatial_products` so `.png` visualization products (`before_after_overview.png`) report `"format": "PNG"`.
