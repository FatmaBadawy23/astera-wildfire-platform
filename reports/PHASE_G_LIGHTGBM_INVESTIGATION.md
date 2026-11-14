# PHASE G2 & G3: LIGHTGBM TRAINING INVESTIGATION & EVENT-LEVEL GENERALIZATION AUDIT

- **Date (UTC):** `2026-11-14T00:48:30Z`
- **Status:** **`VERIFIED`**
- **Evidence Artifact:** [phase_g_investigations.json](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/outputs/phase_g_investigations.json)
- **Investigation Script:** [phase_g_investigations.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/scripts/phase_g_investigations.py)
- **Modified Model Module:** [lightgbm_model.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/processing/models/lightgbm_model.py)

---

## 1. Phase G2: Why the Baseline LightGBM Stopped at `best_iteration_ = 1`

### 1.1 Dataset & Split Class Distributions (Stride-2 Valid Pixels)

| Split | Event | Stride-2 Valid Rows | Full-Scene Valid Pixels | Positive (`dNBR >= 0.11`) | Negative (`dNBR < 0.11`) | Positive Prevalence | Balanced Ratio (`neg / pos`) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **`TRAIN`** | `CA_GANN_2026` | `150,212` | `600,831` | `22,675` | `127,537` | **`15.10%`** | **`5.6246`** |
| **`VAL`** | `CA_DOME_2026` | `152,044` | `608,150` | `10,669` | `141,375` | **`7.02%`** | `13.2510` |

### 1.2 Root-Cause Diagnosis of `best_iteration_ = 1`
Direct inspection of `outputs/runs/run_20261114_013500/checkpoints/lightgbm_water_free.pkl` and our controlled reproduction in [phase_g_investigations.json](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/outputs/phase_g_investigations.json) revealed **two interacting causes**:

1. **Mismatch Between Weighted Training Objective and Unweighted Validation Log-Loss (`scale_pos_weight = 5.6246` vs. `VAL` Prevalence `7.02%`):**
   - Training with `scale_pos_weight = 5.6246` multiplies the positive-class gradient/hessian by $5.6246$, shifting the stationary leaf log-odds by $+\ln(5.6246) = +1.727$ (towards an effective weighted positive prior of $\approx 50\%$).
   - However, LightGBM's default validation evaluation metric (`metric="binary_logloss"`) computes **unweighted** binary cross-entropy on `VAL` (`CA_DOME_2026`), where only `7.02%` of pixels are burned and `92.98%` are unburned.
   - Starting from tree 1, every subsequent boosting step increases predicted probabilities on the `92.98%` negative validation pixels toward the weighted equilibrium, causing `val binary_logloss` to rise monotonically from **`0.29699` (iter 1) → `0.31016` (iter 2) → `0.32397` (iter 3) → `0.49648` (iter 16)**. With `stopping_rounds = 15`, early stopping rolled the ensemble back to **Iteration 1 (a single tree with 30 splits)**.

2. **Cross-Event Covariate Shift on Absolute Pre/Post Backscatter (`vv_pre_db`, `vh_pre_db`, `vv_post_db`, `vh_post_db`):**
   - Auditing all 10 features across `TRAIN` (`CA_GANN_2026`) and `VAL` (`CA_DOME_2026`) shows zero `NaN` values and zero optical label leakage, but reveals a strong **domain shift in absolute backscatter levels** versus **consistent physical direction in relative change features**:

| Feature Name | `TRAIN` Burned Mean | `TRAIN` Unburned Mean | `TRAIN` ($\text{Burn} - \text{Unburn}$) | `VAL` Burned Mean | `VAL` Unburned Mean | `VAL` ($\text{Burn} - \text{Unburn}$) | Physical Direction Consistent Across Events? |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| `vv_pre_db` | `-8.7924` | `-10.5242` | `+1.7318 dB` | `-9.7797` | `-9.1975` | `-0.5822 dB` | **NO (Site/Terrain Shift)** |
| `vh_pre_db` | `-14.6389` | `-17.3370` | `+2.6981 dB` | `-15.3576` | `-14.5769` | `-0.7807 dB` | **NO (Site/Terrain Shift)** |
| `vv_post_db` | `-8.9247` | `-10.5561` | `+1.6314 dB` | `-10.0225` | `-9.3979` | `-0.6246 dB` | **NO (Site/Terrain Shift)** |
| `vh_post_db` | `-15.5974` | `-17.4222` | `+1.8248 dB` | `-16.0260` | `-14.9729` | `-1.0531 dB` | **NO (Site/Terrain Shift)** |
| **`delta_vv_db`** | `-0.1323` | `-0.0319` | **`-0.1004 dB`** | `-0.2428` | `-0.2005` | **`-0.0423 dB`** | **YES (Consistent Drop)** |
| **`delta_vh_db`** | `-0.9585` | `-0.0852` | **`-0.8733 dB`** | `-0.6683` | `-0.3960` | **`-0.2723 dB`** | **YES (Consistent Drop)** |
| **`delta_diff_db`** | `-0.8262` | `-0.0533` | **`-0.7729 dB`** | `-0.4255` | `-0.1955` | **`-0.2300 dB`** | **YES (Consistent Drop)** |
| **`local_mean_delta_vh`** | `-0.9703` | `-0.0866` | **`-0.8837 dB`** | `-0.6609` | `-0.3961` | **`-0.2648 dB`** | **YES (Primary Signal)** |
| **`local_std_delta_vh`** | `2.0034` | `1.8224` | **`+0.1810 dB`** | `1.9468` | `1.8409` | **`+0.1059 dB`** | **YES (Texture Increase)** |
| `post_vv_minus_vh_db` | `6.6727` | `6.8661` | `-0.1934 dB` | `6.0034` | `5.5749` | `+0.4285 dB` | **NO (Depol Shift)** |

   - Because `CA_GANN_2026` burned denser woodland surrounded by sparser grassland (`vh_pre_db` was `+2.70 dB` higher inside the burn scar before the fire), deep trees (`max_depth=7, num_leaves=31`) overfit to absolute pre/post intensity levels (`17` of `30` splits in Config A), causing even unweighted `binary_logloss` (`Config B`) to increase after tree 1 on `VAL`.

---

## 2. Controlled `TRAIN` / `VAL` Experiment Results (Zero `TEST` Access)

All 5 configurations were trained strictly on `TRAIN` (`CA_GANN_2026`, `150,212` rows) and evaluated/selected strictly on `VAL` (`CA_DOME_2026`, `152,044` stride-2 rows; `608,150` full-scene valid pixels):

| Config ID | Weighting Strategy | Early-Stopping Metric | Tree Depth / Leaves / Reg | `best_iteration` (Splits) | `TRAIN` LogLoss | `VAL` LogLoss (Brier) | `VAL` ROC-AUC | `VAL` PR-AUC | `VAL` Threshold | `VAL` Precision / Recall | `VAL` F1 (`IoU`) |
| :--- | :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **`A_baseline_balanced_logloss`** | Balanced (`5.6246`) | `binary_logloss` | `d=7, L=31, L2=0` | `1` (`30`) | `0.4099` | `0.2963` (`0.0748`) | `0.5476` | `0.0993` | `0.19` | `0.1673` / `0.1307` | `0.1467` (`0.0792`) |
| **`B_unweighted_logloss`** | Unweighted (`1.0`) | `binary_logloss` | `d=5, L=15, L2=5` | `1` (`14`) | `0.4167` | `0.2844` (`0.0716`) | `0.5404` | `0.0944` | `0.15` | `0.0747` / `0.7426` | `0.1357` (`0.0728`) |
| **`C_sqrt_weighted_auc_es`** | Sqrt-Balanced (`2.3716`) | `auc` | `d=4, L=15, L2=10` | `6` (`83`) | `0.3882` | `0.3050` (`0.0776`) | `0.5535` | `0.1014` | `0.19` | `0.0932` / `0.3834` | `0.1500` (`0.0811`) |
| **`D_unweighted_shallow_auc_es` (SELECTED)** | **Unweighted (`1.0`)** | **`auc`** | **`d=4, L=15, L2=10`** | **`6` (`80`)** | **`0.3899`** | **`0.2870` (`0.0724`)** | **`0.5576`** | **`0.1021`** | **`0.17`** | **`0.1052` / `0.2923`** | **`0.1547` (`0.0838`)** |
| **`E_balanced_shallow_ap_es`** | Balanced (`5.6246`) | `average_precision` | `d=4, L=15, L2=10` | `3` (`41`) | `0.4044` | `0.3060` (`0.0777`) | `0.5575` | `0.1012` | `0.21` | `0.1418` / `0.1540` | `0.1477` (`0.0797`) |

### Selection Decision (Strictly on `VAL`):
- **Configuration `D_unweighted_shallow_auc_es`** (`scale_pos_weight=1.0`, `eval_metric="auc"`, `learning_rate=0.03`, `max_depth=4`, `num_leaves=15`, `min_child_samples=200`, `subsample=0.8`, `colsample_bytree=0.8`, `reg_alpha=2.0`, `reg_lambda=10.0`, `stopping_rounds=25`) is selected for Phase G4 revalidation because:
  1. It eliminates the single-tree collapse (`best_iteration = 6` with `80` splits vs. `1` tree with `30` splits).
  2. It achieves the **highest `VAL F1` (`0.1547`)**, **highest `VAL IoU` (`0.0838`)**, **highest `VAL PR-AUC` (`0.1021`)**, and **highest `VAL ROC-AUC` (`0.5576`)** across all tested configurations.
  3. Because `scale_pos_weight = 1.0` preserves well-calibrated probability estimates on `VAL` (`logloss = 0.2870`, `Brier = 0.0724` vs. `0.2963` / `0.0748` in Config A), downstream threshold selection on `VAL` operates over a smooth, multi-tree probability distribution rather than 31 discrete single-tree leaf steps.

---

## 3. Phase G3: Event-Level Generalization & `CA_TIMBER_2026` Suitability Audit

### 3.1 Cross-Event Physical & Geospatial Audit Table

| Check / Metric | `CA_GANN_2026` (`TRAIN`) | `CA_TIMBER_2026` (Excluded) | `CA_DOME_2026` (`VAL`) | `CA_BUG_2026` (`TEST`) |
| :--- | :--- | :--- | :--- | :--- |
| **Region** | Calaveras County, CA | Monterey County, CA | Yosemite area, CA | Lassen/Sierra CA & Washoe NV |
| **Reported Ignition / Area** | `2026-08-03` (`10,339 ac`) | `2026-08-09` (`25,435 ac`) | `2026-09-21` (`6,159 ac`) | `2026-08-08` (`93,733 ac`) |
| **CRS & Grid** | `EPSG:32610` (`800×800` @ 20 m) | `EPSG:32610` (`800×800` @ 20 m) | `EPSG:32611` (`800×800` @ 20 m) | `EPSG:32611` (`800×800` @ 20 m) |
| **Sentinel-1 Pre / Post Dates** | `2026-07-26` / `2026-08-31` | `2026-08-07` / `2026-09-12` | `2026-09-13` / `2026-10-19` | `2026-08-03` / `2026-09-08` |
| **Sentinel-2 Pre / Post Dates** | `2026-07-29` / `2026-08-30` | `2026-07-27` / `2026-08-26` | `2026-09-12` / `2026-10-07` | `2026-08-06` / `2026-08-30` |
| **Water Pixels Excluded (`SCL==6`)** | `27,522` (`4.30%`) | **`110,276` (`17.23%` ocean)** | `401` (`0.06%`) | `16` (`0.00%`) |
| **Valid Land Pixels (`valid > 0`)** | `600,831` (`93.88%`) | `468,105` (`73.14%`) | `608,150` (`95.02%`) | `465,828` (`72.79%`) |
| **Burned Pixels (`dNBR >= 0.11`)** | `90,758` (`15.11%`) | `125,386` (`26.79%`) | `42,428` (`6.98%`) | `233,570` (`50.14%`) |
| **Burned Pixels (`MCD64A1` QA)** | `90,142` (`15.00%`) | `128,613` (`27.48%`) | `34,642` (`5.70%`) | `347,486` (`74.60%`) |
| **Median $\Delta\text{VH}$ Inside Burn Scar** | **`-0.8882 dB`** | **`-0.0334 dB` (no drop)** | **`-0.6401 dB`** | **`-2.9279 dB`** |
| **Median $\Delta\text{VH}$ Outside Burn Scar** | `-0.0833 dB` | `-0.1428 dB` | `-0.3898 dB` | `-0.9400 dB` |
| **Mean $\Delta\text{VH}_{\text{burn}} - \Delta\text{VH}_{\text{unburn}}$** | **`-0.8815 dB`** | **`+0.0668 dB` (inverted)** | **`-0.2504 dB`** | **`-1.9574 dB`** |
| **Mean $\Delta\text{VV}_{\text{burn}} - \Delta\text{VV}_{\text{unburn}}$** | `-0.1008 dB` | **`+0.4661 dB` (inverted)** | `-0.0326 dB` | `-1.3593 dB` |
| **Physical $-\Delta\text{VH}$ ROC-AUC vs. dNBR** | **`0.6084`** | **`0.4876` ($< 0.50$)** | **`0.5337`** | **`0.7342`** |
| **`include_in_training` Decision** | **`True` (`TRAIN`)** | **`False` (Excluded)** | **`True` (`VAL`)** | **`True` (`TEST`)** |

### 3.2 Why `CA_TIMBER_2026` Does Not Pass Scientific Training Quality Checks
1. **Inverted C-Band Backscatter Physics (`ROC-AUC = 0.4876 < 0.50`):**
   - In `CA_GANN_2026`, `CA_DOME_2026`, and `CA_BUG_2026`, wildfire canopy consumption causes a physical decrease in C-band cross-polarized (`VH`) volume backscatter ($\Delta\text{VH}_{\text{burn}} - \Delta\text{VH}_{\text{unburn}} = -0.88\text{ dB}$, $-0.25\text{ dB}$, and $-1.96\text{ dB}$).
   - In `CA_TIMBER_2026` (steep Big Sur / Monterey coastal range, ascending Orbit 35), burned pixels show a slightly **positive** relative change ($\Delta\text{VH}_{\text{burn}} - \Delta\text{VH}_{\text{unburn}} = +0.0668\text{ dB}$, $\Delta\text{VV}_{\text{burn}} - \Delta\text{VV}_{\text{unburn}} = +0.4661\text{ dB}$), making $-\Delta\text{VH}$ worse than random chance (`ROC-AUC = 0.4876`).
2. **Overlapping Multi-Fire Complex & Temporal Mismatch:**
   - The Sentinel-2 post-fire scene (`2026-08-26`) was acquired 17 days before the final Sentinel-1 post2 pass (`2026-09-12`) while the overlapping Timber/Plaskett fire complex continued burning through late August (`MCD64A1` burn DOY window `219–243`).
3. **Conclusion on Split Preservation:**
   - `CA_TIMBER_2026` **fails** the physical radiometric coherence check for supervised C-band SAR training and must remain excluded (`include_in_training = False`), retained strictly as acquisition/geospatial evidence with explicit quality warnings.
   - The baseline split (**`TRAIN = [CA_GANN_2026]`**, **`VAL = [CA_DOME_2026]`**, **`TEST = [CA_BUG_2026]`**) is preserved unchanged, and all reports and API responses explicitly state that models are trained on **one wildfire event (`CA_GANN_2026`)**, validated on **one event (`CA_DOME_2026`)**, and tested on **one held-out event (`CA_BUG_2026`)**.
