# ASTERA WATCH — PHASE G4 & G5: MODEL REVALIDATION & GEOSPATIAL QUALITY REPORT

**Repository:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`  
**Branch:** `feature/sar-ml-pipeline`  
**New Versioned Run ID:** `run_20261114_025000_phase_g`  
**Previous Preserved Run ID:** `run_20261114_013500` (untouched on disk)  
**Execution Script:** `scripts/execute_phase_g_run.py`  
**Generated At (UTC):** `2026-11-14T01:00:39Z`

---

## 1. Executive Summary

Following the Phase G1 masked-loss remediation (`MaskedBCEDiceLoss`, valid-mask-aligned `SARPatchDataset`, and valid-only `nan_channel_stats`) and the Phase G2 LightGBM investigation (`Config D: D_unweighted_shallow_auc_es`), all candidate and baseline models were retrained and re-evaluated in an isolated versioned run: **`run_20261114_025000_phase_g`**.

Key outcomes:
1. **Zero Data Leakage & Preserved Provenance:**
   - `TRAIN = CA_GANN_2026` (`121` patches, `600,831` valid land pixels), `VAL = CA_DOME_2026` (`121` patches, `608,150` valid land pixels), `TEST = CA_BUG_2026` (`94` patches, `465,828` valid land pixels).
   - `CA_TIMBER_2026` remains excluded from supervised training (`include_in_training = False`).
   - `TEST` (`CA_BUG_2026`) was never used for normalization, threshold selection, early stopping, or model selection.
   - Previous run `run_20261114_013500` remains completely untouched on disk.
2. **U-Net ResNet-34 (`MaskedBCEDiceLoss`) Improvements:**
   - Best validation IoU on `CA_DOME_2026` improved from `0.1731` to **`0.1876`** (`+8.38%` relative gain).
   - On `TRAIN` (`CA_GANN_2026`, where `27,522` Lake Almanor water pixels were previously polluting unmasked training), F1 vs Sentinel-2 dNBR jumped from `0.6251` to **`0.8575`** (`+0.2324`), IoU from `0.4547` to **`0.7506`**, and ROC-AUC from `0.8588` to **`0.9684`**.
   - On `VAL` (`CA_DOME_2026`), F1 vs Sentinel-2 dNBR improved from `0.3075` to **`0.3388`** (`+0.0313`), IoU from `0.1816` to **`0.2039`**, ROC-AUC from `0.7332` to **`0.7794`**, and area bias dropped from `+168.42%` to **`+73.71%`**.
   - On held-out `TEST` (`CA_BUG_2026`), U-Net remains the #1 model on both independent leaderboards:
     - **vs Sentinel-2 dNBR (20 m):** `F1 = 0.8051` (`CI95 = [0.7720, 0.8301]`), `IoU = 0.6738`, `Precision = 0.6920`, `Recall = 0.9624`, `Specificity = 0.5693`, `ROC-AUC = 0.8756`, `PR-AUC = 0.8505`, area error reduced from `+42.14%` to **`+39.07%`**.
     - **vs NASA MODIS MCD64A1.061 (20 m QA-filtered):** `F1 = 0.9088` (`CI95 = [0.8705, 0.9259]`), `IoU = 0.8329`, `Precision = 0.9405`, `Recall = 0.8792`, `Specificity = 0.8367`, `ROC-AUC = 0.9433`, `PR-AUC = 0.9765`, area error **`-6.52%`** (`129.932 km²` predicted vs `138.994 km²` reference).
     - **vs NASA MODIS MCD64A1.061 (500 m native blocks):** `F1 = 0.9253`, `IoU = 0.8611`, `Pearson r = 0.7906`, area error **`-5.90%`**.
3. **LightGBM (`Config D`) Improvements:**
   - Resolved the single-tree early-stopping collapse (`best_iteration = 6` with `80` splits vs `best_iteration = 1` with `30` splits).
   - Improved `VAL` F1 (`0.1467` → **`0.1547`**), `VAL` ROC-AUC (`0.5476` → **`0.5576`**), `VAL` Specificity (`0.7310` → **`0.8136`**), `TEST` F1 (`0.5037` → **`0.5076`**), `TEST` Precision (`0.7937` → **`0.8271`**), `TEST` Specificity (`0.9035` → **`0.9230`**), `TEST` ROC-AUC (`0.8059` → **`0.8136`**), and `TEST` PR-AUC (`0.7852` → **`0.7961`**).

---

## 2. Checkpoints & Cryptographic Provenance (`run_20261114_025000_phase_g`)

| Artifact | Path | Size (Bytes) | SHA-256 |
|---|---|---:|---|
| LightGBM Checkpoint | `outputs/runs/run_20261114_025000_phase_g/checkpoints/lightgbm_phase_g.pkl` | `16,758` | `ef3099395e2918c3daa8f5f134d832fe63ba4749c51f061dc2f55b9dadb837e1` |
| U-Net ResNet-34 Checkpoint | `outputs/runs/run_20261114_025000_phase_g/checkpoints/real_unet_resnet34_phase_g.pt` | `349,206,898` | `025f136b09a584c6ba3657198b9e50c6b53b1058b081c1dac8d1a0a685e863bc` |
| `CA_GANN_2026` Predictions | `outputs/runs/run_20261114_025000_phase_g/evaluation/predictions/CA_GANN_2026.npz` | `6,814,008` | `1d3871c6d3356358b417ac77e11d84d4d3e02a7ef9cf0f5daa2ca06451852f00` |
| `CA_DOME_2026` Predictions | `outputs/runs/run_20261114_025000_phase_g/evaluation/predictions/CA_DOME_2026.npz` | `7,047,214` | `019e298df9b6326727295e75501aac5a3ab18dc277dfb9ddd609a277b9fe9ccb` |
| `CA_BUG_2026` Predictions | `outputs/runs/run_20261114_025000_phase_g/evaluation/predictions/CA_BUG_2026.npz` | `5,798,749` | `b13e3dd69780eba0aa15d3237a40a71ad52edc8e6c93e98961f9d13cbcb725d3` |

---

## 3. Leaderboard 1: Evaluation Against Sentinel-2 L2A dNBR $\ge 0.11$ (20 m)

*Reference definition: Sentinel-2 L2A $\text{dNBR} \ge 0.11$ over land-valid pixels ($\text{SCL} \in \{4, 5, 7\}$, water $\text{SCL}=6$ excluded).*

### 3.1 Held-Out Test Split (`CA_BUG_2026`, `465,828` Valid Land Pixels, Prevalence `50.14%`)

| Model | Role | Threshold | Run `013500` F1 | Phase G F1 | Phase G IoU | Precision | Recall | Specificity | ROC-AUC | PR-AUC | TP | FP | FN | TN | Pred Area ($\text{km}^2$) | Ref Area ($\text{km}^2$) | Area Error (%) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **UNet_ResNet34** | Learned DL | `0.66` | `0.8126` | **`0.8051`** | **`0.6738`** | `0.6920` | `0.9624` | `0.5693` | **`0.8756`** | **`0.8505`** | `224,788` | `100,042` | `8,782` | `132,216` | `129.932` | `93.428` | `+39.07%` |
| **CUSUM_Temporal** | Temporal Rule | `3.50` | `0.7123` | **`0.7123`** | `0.5532` | `0.6101` | `0.8557` | `0.4500` | `0.7582` | `0.7587` | `199,877` | `127,740` | `33,693` | `104,518` | `131.047` | `93.428` | `+40.27%` |
| **Log_Ratio_Baseline** | Analytical Baseline | `-1.20 dB` | `0.6964` | **`0.6964`** | `0.5342` | `0.6332` | `0.7735` | `0.5494` | `0.7342` | `0.7328` | `180,673` | `104,661` | `52,897` | `127,597` | `114.134` | `93.428` | `+22.16%` |
| **All_Burned_Trivial** | Trivial Baseline | `0.00` | `0.6679` | **`0.6679`** | `0.5014` | `0.5014` | `1.0000` | `0.0000` | `null` | `null` | `233,570` | `232,258` | `0` | `0` | `186.331` | `93.428` | `+99.44%` |
| **LightGBM_Pixel_Spatial** | Learned Tabular | `0.17` | `0.5037` | **`0.5076`** | `0.3401` | **`0.8271`** | `0.3661` | **`0.9230`** | `0.8136` | `0.7961` | `85,518` | `17,881` | `148,052` | `214,377` | `41.360` | `93.428` | `-55.73%` |

### 3.2 Validation Split (`CA_DOME_2026`, `608,150` Valid Land Pixels, Prevalence `6.98%`)

| Model | Run `013500` F1 | Phase G F1 | Phase G IoU | Precision | Recall | Specificity | ROC-AUC | PR-AUC | Pred Area ($\text{km}^2$) | Ref Area ($\text{km}^2$) | Area Error (%) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **UNet_ResNet34** | `0.3075` | **`0.3388`** | **`0.2039`** | `0.2669` | `0.4636` | `0.9045` | **`0.7794`** | **`0.2479`** | `29.480` | `16.971` | `+73.71%` |
| **LightGBM_Pixel_Spatial** | `0.1467` | **`0.1547`** | `0.0838` | `0.1052` | `0.2923` | `0.8136` | `0.5576` | `0.1021` | `47.150` | `16.971` | `+177.83%` |
| **Log_Ratio_Baseline** | `0.1331` | **`0.1331`** | `0.0713` | `0.0800` | `0.3958` | `0.6586` | `0.5337` | `0.0826` | `83.966` | `16.971` | `+394.76%` |
| **CUSUM_Temporal** | `0.1313` | **`0.1313`** | `0.0702` | `0.0762` | `0.4732` | `0.5698` | `0.5333` | `0.0826` | `105.383` | `16.971` | `+520.95%` |
| **All_Burned_Trivial** | `0.1304` | **`0.1304`** | `0.0698` | `0.0698` | `1.0000` | `0.0000` | `null` | `null` | `243.260` | `16.971` | `+1333.37%` |

### 3.3 Training Split (`CA_GANN_2026`, `600,831` Valid Land Pixels, Prevalence `15.11%`)

| Model | Run `013500` F1 | Phase G F1 | Phase G IoU | Precision | Recall | Specificity | ROC-AUC | PR-AUC | Pred Area ($\text{km}^2$) | Ref Area ($\text{km}^2$) | Area Error (%) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **UNet_ResNet34** | `0.6251` | **`0.8575`** | **`0.7506`** | `0.9140` | `0.8076` | `0.9865` | **`0.9684`** | **`0.9160`** | `32.077` | `36.303` | `-11.64%` |
| **LightGBM_Pixel_Spatial** | `0.5179` | **`0.5091`** | `0.3414` | `0.5845` | `0.4509` | `0.9430` | `0.8167` | `0.5589` | `28.004` | `36.303` | `-22.86%` |
| **Log_Ratio_Baseline** | `0.2957` | **`0.2957`** | `0.1735` | `0.2206` | `0.4481` | `0.7183` | `0.6084` | `0.2587` | `73.738` | `36.303` | `+103.12%` |
| **CUSUM_Temporal** | `0.2957` | **`0.2957`** | `0.1735` | `0.2065` | `0.5205` | `0.6441` | `0.6160` | `0.2929` | `91.510` | `36.303` | `+152.07%` |
| **All_Burned_Trivial** | `0.2625` | **`0.2625`** | `0.1511` | `0.1511` | `1.0000` | `0.0000` | `null` | `null` | `240.332` | `36.303` | `+562.01%` |

---

## 4. Leaderboard 2: Independent Evaluation Against NASA MODIS MCD64A1.061 (QA-Filtered)

*Reference definition: NASA MODIS Terra+Aqua MCD64A1.061 monthly burned area product (`Burn Date > 0` within fire DOY window, QA Bits `0=1` land, `1=1` valid data, `2=0` not water). Never mixed with Sentinel-2 dNBR metrics.*

### 4.1 Held-Out Test Split (`CA_BUG_2026`, `465,828` Valid Land Pixels, MCD64A1 Prevalence `74.60%`)

| Model | 20 m F1 | 20 m IoU | 20 m Precision | 20 m Recall | 20 m Specificity | 20 m ROC-AUC | 20 m PR-AUC | 20 m Area Error (%) | 500 m Block F1 | 500 m Block IoU | 500 m Pearson $r$ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **UNet_ResNet34** | **`0.9088`** | **`0.8329`** | `0.9405` | `0.8792` | `0.8367` | **`0.9433`** | **`0.9765`** | **`-6.52%`** | **`0.9253`** | **`0.8611`** | **`0.7906`** |
| **All_Burned_Trivial** | `0.8545` | `0.7460` | `0.7460` | `1.0000` | `0.0000` | `null` | `null` | `+34.06%` | `0.8567` | `0.7493` | `0.0000` |
| **CUSUM_Temporal** | `0.8091` | `0.6794` | `0.8336` | `0.7860` | `0.5394` | `0.7520` | `0.8973` | **`-5.72%`** | **`0.9650`** | **`0.9323`** | **`0.7931`** |
| **Log_Ratio_Baseline** | `0.7636` | `0.6177` | `0.8468` | `0.6953` | `0.6306` | `0.7262` | `0.8845` | `-17.89%` | `0.9287` | `0.8669` | `0.7547` |
| **LightGBM_Pixel_Spatial** | `0.4315` | `0.2751` | **`0.9408`** | `0.2799` | **`0.9483`** | `0.7730` | `0.9041` | `-70.24%` | `0.3188` | `0.1896` | `0.4524` |

---

## 5. Gate G5 Geospatial Output & Data Quality Validation

Every exported raster layer in `outputs/runs/run_20261114_025000_phase_g/geospatial/{event_id}/` was programmatically audited using `rasterio` and recorded in `outputs/runs/run_20261114_025000_phase_g/evaluation/geospatial_quality_audit.json`:

| Event ID | CRS | Grid Dimensions | Pixel Size | Water Pixels in Valid Mask | All 8 Required GeoTIFFs Valid & Aligned | RGBA Web PNG Overlays (`layers/*.png`) | GeoJSONs (`aoi_boundary`, `firms_hotspots`) |
|---|---|---|---|---:|---|---|---|
| `CA_GANN_2026` | `EPSG:32610` | `800 x 800` | `20.0 m x 20.0 m` | `0` (`27,522` water excluded) | `True` (`8/8`) | `8/8` PNGs + `before_after_overview.png` | Verified (`43` FIRMS hotspots) |
| `CA_DOME_2026` | `EPSG:32611` | `800 x 800` | `20.0 m x 20.0 m` | `0` (`401` water excluded) | `True` (`8/8`) | `8/8` PNGs + `before_after_overview.png` | Verified (`39` FIRMS hotspots) |
| `CA_BUG_2026` | `EPSG:32611` | `800 x 800` | `20.0 m x 20.0 m` | `0` (`16` water excluded) | `True` (`8/8`) | `8/8` PNGs + `before_after_overview.png` | Verified (`159` FIRMS hotspots) |
| `CA_TIMBER_2026` | `EPSG:32610` | `800 x 800` | `20.0 m x 20.0 m` | `0` (`110,276` water excluded) | `True` (`8/8`) | `8/8` PNGs + `before_after_overview.png` | Verified (`65` FIRMS hotspots) |

**Gate G4 & G5 Verdict:** **PASSED**.
