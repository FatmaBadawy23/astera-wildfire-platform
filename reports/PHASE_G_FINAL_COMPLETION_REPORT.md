# ASTERA WATCH — PHASE G FINAL COMPLETION REPORT
## Scientific Integrity Remediation, Model Revalidation & Frontend Production Readiness
**NASA Space Apps Challenge 2026 | Dancing with the SARs**

- **Repository:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`
- **Branch:** `feature/sar-ml-pipeline`
- **Active Versioned Run ID:** `run_20261114_025000_phase_g`
- **Preserved Previous Run ID:** `run_20261114_013500` (untouched on disk)
- **Completion Timestamp (UTC):** `2026-11-14T01:20:00Z`

---

## 1. Executive Summary & Gate Completion Matrix

All ten mandatory execution gates (**G0–G9**) of **Phase G** were executed in strict sequential order, verified with automated tests, and documented in dedicated technical reports:

| Gate | Description | Deliverable Report / Artifact | Verification Status |
|---|---|---|---|
| **G0** | Read-Only Architecture & Scientific Audit | `reports/PHASE_G_INITIAL_AUDIT.md` | **VERIFIED** |
| **G1** | Critical Masked-Loss Correction (`MaskedBCEDiceLoss`, `SARPatchDataset`, `nan_channel_stats`, `trainer.py`) | `reports/PHASE_G_MASKED_LOSS_VALIDATION.md` & `backend/tests/test_masked_loss.py` (`14/14` passed) | **VERIFIED** |
| **G2** | LightGBM `best_iteration_ = 1` Root-Cause Investigation & Controlled `TRAIN`/`VAL` Experiment | `reports/PHASE_G_LIGHTGBM_INVESTIGATION.md` & `outputs/phase_g_investigations.json` | **VERIFIED** |
| **G3** | Event-Level Generalization & `CA_TIMBER_2026` Suitability Audit | `reports/PHASE_G_LIGHTGBM_INVESTIGATION.md` (Section 4) | **VERIFIED** |
| **G4** | Model Revalidation in Versioned Run `run_20261114_025000_phase_g` | `reports/PHASE_G_MODEL_REVALIDATION.md` & `outputs/runs/run_20261114_025000_phase_g/` | **VERIFIED** |
| **G5** | Geospatial Output & Data Quality Validation (`8` GeoTIFFs + `8` RGBA PNGs + `2` GeoJSONs per event) | `outputs/runs/run_20261114_025000_phase_g/evaluation/geospatial_quality_audit.json` | **VERIFIED** |
| **G6** | Backend Production API (`/api/runs/latest`, `/api/models/comparison`, `/api/dataset/stats`, `/api/events/{id}/analysis`, `/api/nisar/status`, PNG/GeoJSON routes) | `backend/app/api/endpoints.py` & `backend/app/services/analysis_service.py` | **VERIFIED** |
| **G7** | Frontend Production Integration (`frontend/` React + TypeScript + Vite) | `reports/PHASE_G_FRONTEND_INTEGRATION.md` & `frontend/dist/` | **VERIFIED** |
| **G8** | Frontend/Backend Contract Testing | `backend/tests/test_api_phase_g.py` (`22/22` API tests) & `frontend/src/App.test.tsx` (`3/3` Vitest tests) | **VERIFIED** |
| **G9** | Final End-to-End Verification | `reports/PHASE_G_FINAL_COMPLETION_REPORT.md` (`59/59` backend tests + `3/3` frontend tests + production build) | **VERIFIED** |

---

## 2. Summary of Scientific & Engineering Remediations

### 2.1 Gate G0: Forensic Report Errata & Stale Backend Resolution
- Audited `reports/LATEST_DATA_TRAINING_PROVENANCE_AUDIT.md` against the actual files in `outputs/runs/run_20261114_013500/evaluation/real_model_comparison.json` and `real_unet_resnet34.pt`.
- Identified and appended an explicit errata section correcting prose transcription discrepancies in the prior forensic report while preserving `run_20261114_013500` untouched.
- Identified that `AnalysisService` previously read legacy pre-water-exclusion paths (`outputs/evaluation/real_model_comparison.json` and `outputs/geospatial/`) for several routes; remediated in Gate G6 so all routes resolve dynamically via `outputs/runs/latest_run.json`.

### 2.2 Gate G1: Masked U-Net Loss & Valid-Only Channel Normalization
- **Problem:** In `run_20261114_013500`, `SARPatchDataset` yielded only `(patch, mask)` without `valid`, `BCEDiceLoss` averaged loss over all $128 \times 128 = 16,384$ pixels per patch (including `346,663` invalid/water pixels across the `336` patches where `valid == 0`), and `nan_channel_stats` computed channel mean/std over water pixels (`-22 dB` specular reflection over Lake Almanor in `CA_GANN_2026`).
- **Fix:**
  1. `backend/processing/models/dataset.py`: Updated `SARPatchDataset` to accept `valid_masks` and apply identical geometric augmentations (horizontal flip, vertical flip, 90° rotations) to `(patch, mask, valid)`.
  2. `backend/processing/models/unet_resnet.py`: Implemented `MaskedBCEDiceLoss` using `torch.where(valid_mask > 0.0, ...)` sanitization prior to BCE and Dice evaluation so `valid == 0` pixels contribute identically zero to the loss and receive identically zero gradient (`0.0`),even if invalid regions contain `NaN`/`Inf` logits or corrupt targets.
  3. `backend/processing/models/real_dataset.py`: Updated `nan_channel_stats(patches, valid)` to compute channel mean and standard deviation strictly over `valid > 0` land pixels.
  4. `backend/processing/models/trainer.py`: Updated `train_unet_model` to train with `MaskedBCEDiceLoss` and pass `valid_mask=y_valid_cat` into `calculate_segmentation_metrics` during epoch validation IoU checkpoint selection.

### 2.3 Gate G2 & G3: LightGBM Investigation & `CA_TIMBER_2026` Exclusion Proof
- **LightGBM Root Cause:** On `TRAIN` (`CA_GANN_2026`, `15.11%` burned), burned forest had higher pre-fire backscatter (`vh_pre_db = -14.64 dB` vs `-17.34 dB` unburned), whereas on `VAL` (`CA_DOME_2026`, `6.98%` burned), burned scrubland had lower pre-fire backscatter (`-15.36 dB` vs `-14.58 dB`). Combined with `scale_pos_weight = 5.6246` shifting leaf log-odds by `+1.727`, unweighted validation `binary_logloss` on `VAL` rose monotonically after tree 1 (`0.29699` → `0.59809`).
- **Controlled `TRAIN`/`VAL` Solution (`Config D`):** Using unweighted log-odds (`scale_pos_weight = 1.0`), `eval_metric = "auc"`, stronger structural regularization (`max_depth = 4`, `num_leaves = 15`, `min_child_samples = 200`, `reg_alpha = 2.0`, `reg_lambda = 10.0`), and `learning_rate = 0.03`, LightGBM resolved the single-tree collapse (`best_iteration = 6`, `80` splits) and improved `VAL` F1 (`0.1467` → `0.1547`), `VAL` ROC-AUC (`0.5476` → `0.5576`), `TEST` F1 (`0.5037` → `0.5076`), `TEST` Precision (`0.7937` → `0.8271`), `TEST` Specificity (`0.9035` → `0.9230`), and `TEST` ROC-AUC (`0.8059` → `0.8136`).
- **`CA_TIMBER_2026` Physical Inversion Proof:** Quantitative analysis across all 4 events proved that while `CA_GANN_2026`, `CA_DOME_2026`, and `CA_BUG_2026` exhibit coherent C-band VH backscatter drops in burned areas (`-0.88 dB`, `-0.25 dB`, `-1.96 dB`; `ROC-AUC = 0.6084`, `0.5337`, `0.7342`), `CA_TIMBER_2026` exhibits physically inverted C-band change (`+0.0668 dB` VH, `+0.4661 dB` VV, `ROC-AUC = 0.4876 < 0.50`) and `110,276` Pacific Ocean pixels (`17.23%`). It therefore remains excluded from supervised training (`include_in_training = False`).

---

## 3. Verified Model Revalidation Results (`run_20261114_025000_phase_g`)

### 3.1 Leaderboard 1: Held-Out Test (`CA_BUG_2026`) vs. Sentinel-2 dNBR $\ge 0.11$ (20 m)

| Model | Threshold | Run `013500` F1 | Phase G F1 | Phase G IoU | Precision | Recall | Specificity | ROC-AUC | PR-AUC | Pred Area ($\text{km}^2$) | Ref Area ($\text{km}^2$) | Area Bias (%) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **UNet_ResNet34** | `0.66` | `0.8126` | **`0.8051`** | **`0.6738`** | `0.6920` | `0.9624` | `0.5693` | **`0.8756`** | **`0.8505`** | `129.932` | `93.428` | `+39.07%` |
| **CUSUM_Temporal** | `3.50` | `0.7123` | **`0.7123`** | `0.5532` | `0.6101` | `0.8557` | `0.4500` | `0.7582` | `0.7587` | `131.047` | `93.428` | `+40.27%` |
| **Log_Ratio_Baseline** | `-1.20 dB` | `0.6964` | **`0.6964`** | `0.5342` | `0.6332` | `0.7735` | `0.5494` | `0.7342` | `0.7328` | `114.134` | `93.428` | `+22.16%` |
| **All_Burned_Trivial** | `0.00` | `0.6679` | **`0.6679`** | `0.5014` | `0.5014` | `1.0000` | `0.0000` | `null` | `null` | `186.331` | `93.428` | `+99.44%` |
| **LightGBM_Pixel_Spatial** | `0.17` | `0.5037` | **`0.5076`** | `0.3401` | **`0.8271`** | `0.3661` | **`0.9230`** | `0.8136` | `0.7961` | `41.360` | `93.428` | `-55.73%` |

*(Note: On `TRAIN` `CA_GANN_2026`, U-Net F1 improved from `0.6251` to **`0.8575`**; on `VAL` `CA_DOME_2026`, U-Net F1 improved from `0.3075` to **`0.3388`** and `best_val_iou` improved from `0.1731` to **`0.1876`**.)*

### 3.2 Leaderboard 2: Held-Out Test (`CA_BUG_2026`) vs. NASA MODIS MCD64A1.061 (QA-Filtered)

| Model | 20 m F1 | 20 m IoU | 20 m Precision | 20 m Recall | 20 m Specificity | 20 m ROC-AUC | 20 m PR-AUC | 20 m Area Bias (%) | 500 m Block F1 | 500 m Block IoU | 500 m Pearson $r$ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **UNet_ResNet34** | **`0.9088`** | **`0.8329`** | `0.9405` | `0.8792` | `0.8367` | **`0.9433`** | **`0.9765`** | **`-6.52%`** | **`0.9253`** | **`0.8611`** | **`0.7906`** |
| **All_Burned_Trivial** | `0.8545` | `0.7460` | `0.7460` | `1.0000` | `0.0000` | `null` | `null` | `+34.06%` | `0.8567` | `0.7493` | `0.0000` |
| **CUSUM_Temporal** | `0.8091` | `0.6794` | `0.8336` | `0.7860` | `0.5394` | `0.7520` | `0.8973` | **`-5.72%`** | **`0.9650`** | **`0.9323`** | **`0.7931`** |
| **Log_Ratio_Baseline** | `0.7636` | `0.6177` | `0.8468` | `0.6953` | `0.6306` | `0.7262` | `0.8845` | `-17.89%` | `0.9287` | `0.8669` | `0.7547` |
| **LightGBM_Pixel_Spatial** | `0.4315` | `0.2751` | **`0.9408`** | `0.2799` | **`0.9483`** | `0.7730` | `0.9041` | `-70.24%` | `0.3188` | `0.1896` | `0.4524` |
