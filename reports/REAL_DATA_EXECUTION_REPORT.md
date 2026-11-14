# Astera Watch — Real NASA Data Acquisition, Wildfire Before/After Analysis & End-to-End Model Training Execution Report

**Project:** Astera Watch — NASA Space Apps Challenge 2026 (*Dancing with the SARs*)  
**Repository:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`  
**Branch:** `feature/sar-ml-pipeline` (`HEAD` commit `fd3eaeb6c48ba437c8752f0858cef9bdecfe128f`)  
**Versioned Acquisition Directory:** `data/acquisitions/run_20261114_013500/`  
**Versioned Output & Model Directory:** `outputs/runs/run_20261114_013500/`  
**Execution Date (UTC):** `2026-11-13T23:50:52Z`

---

## 1. Executive Summary

All phases (**Phases A through F**) of the real-data acquisition, defect remediation, water-free dataset construction, three-model training, independent multi-sensor validation, and FastAPI backend integration were executed non-destructively inside versioned directories without deleting or overwriting any existing project dataset, checkpoint, or evaluation artifact.

### Key Accomplishments
1. **Live Authenticated NASA Data Acquisition (`HTTP 200`):**
   - Verified `FIRMS_MAP_KEY` (`HTTP 200`, `transaction_limit: 5000`) and `NASA_API_KEY` (`HTTP 200`, `x-ratelimit-remaining: 9997`) from the Windows User environment scope without exposing secret keys in logs, code, or manifests.
   - Executed the initial **Egypt VIIRS NOAA-20 NRT** smoke test (`data/acquisitions/firms_smoke_test_20261114_012301/firms_egypt_noaa20.csv`: `14,992` bytes, `179` active fire detections, `100%` within `[24, 21, 37, 32]`, SHA-256 `854353a6905bfb38d5beb0a0446f38e12a4d12ca00cb6f4e211067ee25659be2`).
   - Queried FIRMS dynamic data availability (`data/acquisitions/run_20261114_013500/firms/firms_data_availability.csv`, `454` bytes) and acquired **`8,290` deduplicated real active fire hotspots** (`48` raw 5-day CSV files + `4` combined CSVs + `4` GeoJSON FeatureCollections) across all 4 California wildfire AOIs (`CA_GANN_2026`: `926`, `CA_TIMBER_2026`: `1,856`, `CA_DOME_2026`: `3,832`, `CA_BUG_2026`: `1,676`).
   - Queried **NASA EONET API v3** (`eonet_wildfires_aug_sep_2026.json`, `69,503` bytes, `100` wildfire events; `eonet_wildfires_recent.json`, `17,264` bytes, `25` active wildfire events).
2. **NISAR L2 GCOV Discovery & Explicit Completion Gates:**
   - Verified `170` real NISAR L-band GCOV granules (`9` Validated CRID `P05036` in `C3622241360-ASF`, `161` Provisional CRID `P05023` in `C2854338529-ASF`) and `15` matched same-track, same-frame before/after pairs across the 4 wildfire AOIs.
   - Empirically verified the NASA Earthdata Login authentication gate (`earthdata_login_configured: False`), recording:
     - `NISAR_METADATA_DISCOVERED = True`
     - `NISAR_GRANULE_DOWNLOADED = False`
     - `NISAR_DOWNLOAD_BLOCKED = True`
   - All downstream SAR metrics and geospatial products are explicitly labeled `is_nisar = False` and `data_origin = "CROSS_SENSOR_PROTOTYPE"`.
3. **Full Remediation of Prior Audit Defects in Versioned Dataset (`data/acquisitions/run_20261114_013500/dataset/`):**
   - **Water Mask Remediation (`SCL == 6` Excluded):** Updated `backend/processing/preprocessing/optical.py` (`SCL_LAND_VALID_CLASSES = (4, 5, 7)`) so open-water pixels (`27,522` in `CA_GANN_2026`, `401` in `CA_DOME_2026`, `16` in `CA_BUG_2026`) are strictly excluded (`0` water pixels remaining in `valid_mask` across all scenes and `336` extracted `128x128` patches).
   - **MODIS `MCD64A1.061` QA Bit 2 Remediation:** Updated `backend/processing/preprocessing/mcd64a1.py` so `high_quality_land_mask = is_land & is_valid_data & (~shortened_period)` (enforcing Bit 0 = 1, Bit 1 = 1, Bit 2 = 0).
   - **Dual `dNBR` Threshold Evaluation (`0.11` vs `0.27`):** Documented and evaluated both the `TRAIN`-calibrated threshold (`0.11`, achieving `F1 = 0.8475` on `TRAIN` and `F1 = 0.7811` on `TEST` against `MCD64A1`) and the USGS moderate-severity forest threshold (`0.27`, achieving `F1 = 0.6108` on `TRAIN` and `F1 = 0.0269` on `TEST` due to sparse sagebrush/rangeland canopy).
4. **End-to-End Training & Independent Evaluation of 3 Predictive Models (`outputs/runs/run_20261114_013500/`):**
   - **Model 3 (`UNet_ResNet34`, 5-channel deep segmentation):** Achieved **`F1 = 0.8126`** (`95% CI = [0.7796, 0.8382]`, `IoU = 0.6844`, `Precision = 0.7777`, `Recall = 0.8508`, `Specificity = 0.7554`, `ROC-AUC = 0.8736`) against Sentinel-2 `dNBR` on held-out `TEST` (`CA_BUG_2026`), and **`F1 = 0.8246`** (`Precision = 0.9730`, `Specificity = 0.9416`, **`ROC-AUC = 0.9388`**, **`PR-AUC = 0.9744`**) against independent QA-filtered NASA `MCD64A1.061` (`F1 = 0.8414` at 500 m block-reconciled resolution).

---

## 2. Authentication & Service Verification

| Service / Credential | Scope Verified | Endpoint Tested | HTTP Status | Result |
|---|---|---|---|---|
| `FIRMS_MAP_KEY` | Windows User Environment (`length = 32`) | `https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY=<REDACTED>` | `200 OK` | `{"transaction_limit": 5000, "current_transactions": 22, "transaction_interval": "10 minutes"}` |
| `FIRMS Data Availability` | Authenticated CSV API | `https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/<REDACTED>/all` | `200 OK` | `11` sensor datasets verified (`VIIRS_NOAA20_NRT`, `VIIRS_SNPP_NRT`, `VIIRS_NOAA21_NRT`, `MODIS_SP`, `MODIS_NRT`, etc.) |
| `NASA_API_KEY` | Windows User Environment (`length = 40`) | `https://api.nasa.gov/planetary/apod?api_key=<REDACTED>` | `200 OK` | `x-ratelimit-limit: 10000`, `x-ratelimit-remaining: 9997` |
| `NASA EONET v3` | Public / NASA API | `https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires` | `200 OK` | `100` summer 2026 wildfire events + `25` recent events retrieved |
| `NASA CMR REST API` | Public Catalog | `https://cmr.earthdata.nasa.gov/search/granules.json` | `200 OK` | `170` NISAR L2 GCOV granules + `4` `MCD64A1.061` granules verified |
| `NASA Earthdata Login` | Process, User Env & `~/.netrc` | `EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`, `EARTHDATA_TOKEN`, `~/.netrc` | `Absent` | `earthdata_login_configured = False` (`NISAR_DOWNLOAD_BLOCKED = True`) |
| `Planetary Computer STAC` | Public + SAS signing | `https://planetarycomputer.microsoft.com/api/stac/v1` | `200 OK` | `16` Sentinel-1 RTC + `8` Sentinel-2 L2A + `4` MODIS `MCD64A1.061` rasters verified |

---

## 3. Initial FIRMS Egypt Smoke Test Verification

- **File Path:** `data/acquisitions/firms_smoke_test_20261114_012301/firms_egypt_noaa20.csv` (also mirrored in `data/acquisitions/run_20261114_013500/firms/firms_egypt_noaa20_nrt.csv`)
- **Sanitized URL:** `https://firms.modaps.eosdis.nasa.gov/api/area/csv/<REDACTED_MAP_KEY>/VIIRS_NOAA20_NRT/24,21,37,32/3`
- **File Size:** `14,992` bytes
- **SHA-256:** `854353a6905bfb38d5beb0a0446f38e12a4d12ca00cb6f4e211067ee25659be2`
- **Record Count:** `179` active fire detections (`180` lines including header)
- **Coordinate Range Verified:** `latitude ∈ [22.47718, 31.91918]`, `longitude ∈ [25.91810, 36.12733]` (`100%` within `[24, 21, 37, 32]`)
- **Dates Covered:** `2026-11-11` to `2026-11-13` (`max_frp_mw = 14.58 MW`, `mean_frp_mw = 1.92 MW`)
- **First 5 Data Rows:**
  ```csv
  latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
  22.49639,28.01557,335.48,0.56,0.43,2026-11-11,1106,N20,VIIRS,n,2.0NRT,302.11,2.04,D
  22.49688,28.01931,335.13,0.56,0.43,2026-11-11,1106,N20,VIIRS,n,2.0NRT,302.4,4.54,D
  27.16839,31.01688,330.76,0.39,0.36,2026-11-11,1106,N20,VIIRS,l,2.0NRT,305.73,1.06,D
  28.33157,29.12632,332.44,0.42,0.38,2026-11-11,1108,N20,VIIRS,n,2.0NRT,301.98,1.8,D
  29.01448,31.20171,336.03,0.38,0.36,2026-11-11,1108,N20,VIIRS,n,2.0NRT,304.27,2.78,D
  ```

---

## 4. Real Wildfire Events & FIRMS Active Fire Progression

| Event ID | Fire Name | Split | Center (`lon, lat`) | CRS | Ignition Date | S1 Relative Orbit / Pass | FIRMS Deduplicated Hotspots (Buffered / Strict AOI) | FIRMS Max / Mean FRP (`MW`) | FIRMS Active Window (UTC) |
|---|---|---|---|---|---|---|---|---|---|
| `CA_GANN_2026` | Gann Fire (Calaveras County, CA) | `TRAIN` | `-120.734, 38.113` | `EPSG:32610` | `2026-08-03` | Orbit `42` (`descending`) | `926` / `921` | `2,830.10` / `46.80` | `2026-08-04T03:44Z` – `2026-08-16T10:26Z` |
| `CA_DOME_2026` | Dome Fire (Yosemite Area, CA) | `VAL` | `-119.613, 37.612` | `EPSG:32610` | `2026-09-21` | Orbit `144` (`descending`) | `3,832` / `3,832` | `2,408.42` / `21.68` | `2026-09-21T09:11Z` – `2026-10-05T23:26Z` |
| `CA_BUG_2026` | Bug Fire (Lassen CA / Washoe NV) | `TEST` | `-119.887, 39.830` | `EPSG:32611` | `2026-08-08` | Orbit `64` (`ascending`) | `1,676` / `887` | `1,187.20` / `36.58` | `2026-08-09T03:43Z` – `2026-08-19T23:10Z` |
| `CA_TIMBER_2026` | Timber Fire (Monterey County, CA) | `EXCLUDED` | `-121.668, 36.211` | `EPSG:32610` | `2026-08-09` | Orbit `35` (`ascending`) | `1,856` / `1,849` | `571.60` / `15.49` | `2026-08-09T09:17Z` – `2026-08-23T22:01Z` |

---

## 5. Acquired & Generated Datasets Inventory (Sizes & SHA-256 Checksums)

### 5.1 Real Satellite Rasters (`data/real/<EVENT_ID>/`)

| File Path | Sensor / Content | Size (Bytes) | SHA-256 Checksum |
|---|---|---|---|
| `data/real/CA_GANN_2026/stack.npz` | Sentinel-1 RTC (4 dates VV/VH) + Sentinel-2 L2A (pre/post B08/B12/SCL) + MCD64A1 (`800x800`, 20 m, `EPSG:32610`) | `26,207,283` | `51331e60cbdd788129eb2c930509aef885e1e7002b8f6078c363adbde26266d0` |
| `data/real/CA_GANN_2026/mcd64a1_ancillary.npz` | MODIS `MCD64A1.061` (`Burn_Date`, `Uncertainty`, `QA`, `First_Day`, `Last_Day`) | `22,435` | `44252a9eb99016009c678d20ae9c79c304b878b7ce07a698c13d301cb0b25410` |
| `data/real/CA_DOME_2026/stack.npz` | Sentinel-1 RTC + Sentinel-2 L2A + MCD64A1 (`800x800`, 20 m, `EPSG:32610`) | `26,023,453` | `36c84d432d3781f20396d42ed0704b4a88a1a03b4295de7197abd70a31563ba7` |
| `data/real/CA_DOME_2026/mcd64a1_ancillary.npz` | MODIS `MCD64A1.061` ancillary SDS | `24,630` | `1b47f3d4951582022adef2f3332e6ce7923d0c9ca5e71cf76a92e5386826ae42` |
| `data/real/CA_BUG_2026/stack.npz` | Sentinel-1 RTC + Sentinel-2 L2A + MCD64A1 (`800x800`, 20 m, `EPSG:32611`) | `20,704,291` | `56b69365b2e1ae77461385bf71bf0cbf87bcb895d1a093bddafd7c36e6a59258` |
| `data/real/CA_BUG_2026/mcd64a1_ancillary.npz` | MODIS `MCD64A1.061` ancillary SDS | `37,272` | `a5504ee89cb24e1704acb8af57c8327dcf4169799bfe490660d67d238cce8547` |
| `data/real/CA_TIMBER_2026/stack.npz` | Sentinel-1 RTC + Sentinel-2 L2A + MCD64A1 (`800x800`, 20 m, `EPSG:32610`) | `26,161,299` | `f313c0f24df48dbf71ce9f340ff67a0e8f759d218b2f3ced6c8e353a0401c006` |
| `data/real/CA_TIMBER_2026/mcd64a1_ancillary.npz` | MODIS `MCD64A1.061` ancillary SDS | `33,551` | `4c8bc4e07f604083db3728155f4b183b8dbae542931c77209688732f3a706fbb` |

### 5.2 Newly Acquired FIRMS, EONET & Water-Free Dataset Artifacts (`data/acquisitions/run_20261114_013500/`)

| File Path | Description | Size (Bytes) | SHA-256 Checksum |
|---|---|---|---|
| `data/acquisitions/firms_smoke_test_20261114_012301/firms_egypt_noaa20.csv` | Phase A Egypt VIIRS NOAA-20 NRT (`179` records) | `14,992` | `854353a6905bfb38d5beb0a0446f38e12a4d12ca00cb6f4e211067ee25659be2` |
| `data/acquisitions/run_20261114_013500/firms/firms_data_availability.csv` | Dynamic FIRMS sensor availability table | `454` | `6bfda4862a2ea59f5de2945ad730d611dc8d559d6a22f3648677d2f2d9883683` |
| `data/acquisitions/run_20261114_013500/firms/CA_GANN_2026_combined_hotspots.csv` | Deduplicated Gann Fire FIRMS hotspots (`926` records) | `105,089` | `5494f2eb6b60f585a3a4e11ad62850a4048088db12d3ca977bf4f357dbba425c` |
| `data/acquisitions/run_20261114_013500/firms/CA_GANN_2026_hotspots.geojson` | Gann Fire FIRMS GeoJSON FeatureCollection | `536,444` | `4de72e18f120ab54ac81c490aead78ae9d7ac2d3d1e275d488bcc2da23d18125` |
| `data/acquisitions/run_20261114_013500/firms/CA_TIMBER_2026_combined_hotspots.csv` | Deduplicated Timber Fire FIRMS hotspots (`1,856` records) | `211,713` | `c7b44b1ee49aa36e3ccc9e591cdf3e3e54112cb659836bf6ad9fc4892b5d2af1` |
| `data/acquisitions/run_20261114_013500/firms/CA_TIMBER_2026_hotspots.geojson` | Timber Fire FIRMS GeoJSON FeatureCollection | `1,079,661` | `5a879c5be71013cf14a44fbe0b88878fe8e249432c3f78fa48be9d4ec7c75ae7` |
| `data/acquisitions/run_20261114_013500/firms/CA_DOME_2026_combined_hotspots.csv` | Deduplicated Dome Fire FIRMS hotspots (`3,832` records) | `438,891` | `20f01f9161e15963ab4df43f50437f3a8d8e1107b4d621d72b92d6b5741640ce` |
| `data/acquisitions/run_20261114_013500/firms/CA_DOME_2026_hotspots.geojson` | Dome Fire FIRMS GeoJSON FeatureCollection | `2,222,121` | `199ae6f895472db5a9eccc4ae005e947bb3aa9a8136a6dbaa219654ff670e559` |
| `data/acquisitions/run_20261114_013500/firms/CA_BUG_2026_combined_hotspots.csv` | Deduplicated Bug Fire FIRMS hotspots (`1,676` records) | `190,117` | `804a274fe82301015251f236303adfe4526e6aed4fb36181fa8f621e932d0f00` |
| `data/acquisitions/run_20261114_013500/firms/CA_BUG_2026_hotspots.geojson` | Bug Fire FIRMS GeoJSON FeatureCollection | `969,157` | `496112d0c118b08c819db6afdc2750a1c21ab7b8ca836528a54ca0ed0f2fec1a` |
| `data/acquisitions/run_20261114_013500/eonet/eonet_wildfires_aug_sep_2026.json` | NASA EONET v3 summer 2026 wildfire events (`100` events) | `69,503` | `a2fd1c9036b00b85b5bf6b2417ea31adf42855586d27ad3c32f4cc5a084d4724` |
| `data/acquisitions/run_20261114_013500/eonet/eonet_wildfires_recent.json` | NASA EONET v3 recent active wildfires (`25` events) | `17,264` | `fe911088af3000ea9369090e824914d053eca84c2f1519a810eef7238ee66863` |
| `data/acquisitions/run_20261114_013500/dataset/train.npz` | Water-free `TRAIN` patch dataset (`121` patches, `(121, 5, 128, 128)`) | `34,437,165` | `16a7f674bea7adf8eb19748b51d5f7701bba62442ac8fa271094aca9391e71f7` |
| `data/acquisitions/run_20261114_013500/dataset/val.npz` | Water-free `VAL` patch dataset (`121` patches, `(121, 5, 128, 128)`) | `34,556,746` | `efa65e140180545782b3596835a0f695b1621a7909f46e85ef2641732f111d56` |
| `data/acquisitions/run_20261114_013500/dataset/test.npz` | Water-free `TEST` patch dataset (`94` patches, `(94, 5, 128, 128)`) | `24,679,055` | `8999e75a9396148e690bae25fa9bb5f8fdedbba80d8d37a1f453346722382663` |
| `outputs/runs/run_20261114_013500/checkpoints/lightgbm_water_free.pkl` | Trained LightGBM 10-feature spatial classifier checkpoint | `9,627` | `dc8e277e7b46e57e77ea9126e362a13fb4dd9eac584ab519a20ecbdbd9232d40` |
| `outputs/runs/run_20261114_013500/checkpoints/real_unet_resnet34_water_free.pt` | Trained 5-channel `UNetResNet34` checkpoint (best epoch `4`) | `349,209,175` | `401e6d1b99890e11a5d3c72208fccb5aff4e43c5f691bf8523ced0dd40cb36bc` |

---

## 6. NISAR Status & Completion Gates

- **`NISAR_METADATA_DISCOVERED`:** `True` (`170` granules discovered across `C3622241360-ASF` Validated and `C2854338529-ASF` Provisional; `15` matched same-track, same-frame before/after pairs).
- **`NISAR_GRANULE_DOWNLOADED`:** `False`
- **`NISAR_DOWNLOAD_BLOCKED`:** `True`
- **Exact Reason:** Both direct ASF Earthdata Cloud HDF5 downloads (`51.49 GB` for the 4 primary pairs, exceeding the `11.69 GB` local disk budget) and NASA Harmony OGC API Coverages spatial/variable subsets (`~20.48 MB` for the 4 primary pairs) redirect to `https://urs.earthdata.nasa.gov/oauth/authorize` and require NASA Earthdata Login credentials (`EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD`, `EARTHDATA_TOKEN`, or `~/.netrc`), which are not configured on this machine.

---

## 7. Preprocessing, Co-Registration & Water-Exclusion Verification

| Event ID | Split | CRS | Grid Dimensions (`H x W`) | Pixel Size (`m`) | Total Pixels | `SCL == 6` Water Pixels Detected | `SCL == 6` Water Pixels in `valid_mask` | Valid Land Pixels (`valid_fraction`) |
|---|---|---|---|---|---|---|---|---|
| `CA_GANN_2026` | `TRAIN` | `EPSG:32610` | `800 x 800` | `20.0 x 20.0` | `640,000` | `27,522` | **`0`** | `600,831` (`93.88%`) |
| `CA_DOME_2026` | `VAL` | `EPSG:32610` | `800 x 800` | `20.0 x 20.0` | `640,000` | `401` | **`0`** | `608,150` (`95.02%`) |
| `CA_BUG_2026` | `TEST` | `EPSG:32611` | `800 x 800` | `20.0 x 20.0` | `640,000` | `16` | **`0`** | `465,828` (`72.79%`) |

---

## 8. Before/After Change Detection & Burned-Area Estimates (`TEST`: `CA_BUG_2026`)

On the held-out `TEST` event (`CA_BUG_2026`, `EPSG:32611`, `465,828` valid land pixels = `186.3312 km²` valid observation area):

| Product / Model | Burned Pixels | Burned Area (`km²`) | Burned Area (`ha`) | `% of Valid Land Area` | `95% Spatial Block Bootstrap CI (km²)` |
|---|---|---|---|---|---|
| **Sentinel-2 `dNBR >= 0.11` Reference** | `233,570` | `93.4280` | `9,342.80` | `50.14%` | `[83.9429, 102.8440]` |
| **NASA MODIS `MCD64A1.061` (QA-Filtered)** | `347,486` | `138.9944` | `13,899.44` | `74.60%` | `[128.7756, 149.6693]` |
| **Model 3: `UNet_ResNet34` (Primary)** | `255,533` | `102.2132` | `10,221.32` | `54.86%` | `[90.3681, 114.5126]` |
| **Model 1: `Log_Ratio_Baseline` (`<= -1.20 dB`)** | `285,334` | `114.1336` | `11,413.36` | `61.25%` | `[109.0621, 119.1352]` |
| **Model 2: `LightGBM_Pixel_Spatial` (`>= 0.18`)** | `102,837` | `41.1348` | `4,113.48` | `22.08%` | `[34.9607, 47.8210]` |
| **Auxiliary: `CUSUM_Temporal` (`h = 3.5`)** | `327,617` | `131.0468` | `13,104.68` | `70.33%` | `[126.7151, 135.3262]` |

---

## 9. Model Training & Validation Results (Water-Free Dataset)

### 9.1 Evaluation Against Primary Optical Reference (`Sentinel-2 dNBR >= 0.11`)

| Model | Split (`Event`) | Threshold | `F1` (`95% Block CI`) | `IoU` | `Precision` | `Recall` | `Specificity` | `TP` | `FP` | `FN` | `TN` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Model 3: `UNet_ResNet34`** | `TRAIN` (`CA_GANN_2026`) | `0.68` | `0.8696` (`[0.8137, 0.9150]`) | `0.7693` | `0.9198` | `0.8247` | `0.9872` | `74,845` | `6,526` | `15,913` | `503,547` |
| **Model 3: `UNet_ResNet34`** | `VAL` (`CA_DOME_2026`) | `0.68` | `0.3240` (`[0.2024, 0.4348]`) | `0.1933` | `0.2499` | `0.4606` | `0.8963` | `19,542` | `58,666` | `22,886` | `507,056` |
| **Model 3: `UNet_ResNet34`** | **`TEST` (`CA_BUG_2026`)** | `0.68` | **`0.8126`** (`[0.7796, 0.8382]`) | **`0.6844`** | `0.7777` | `0.8508` | `0.7554` | `198,727` | `56,806` | `34,843` | `175,452` |
| **Auxiliary: `CUSUM_Temporal`** | **`TEST` (`CA_BUG_2026`)** | `h = 3.5` | `0.7123` (`[0.6628, 0.7396]`) | `0.5532` | `0.6101` | `0.8557` | `0.4500` | `199,877` | `127,740` | `33,693` | `104,518` |
| **Model 1: `Log_Ratio_Baseline`** | **`TEST` (`CA_BUG_2026`)** | `-1.20 dB` | `0.6964` (`[0.6504, 0.7235]`) | `0.5342` | `0.6332` | `0.7735` | `0.5494` | `180,673` | `104,661` | `52,897` | `127,597` |
| **Baseline: `All_Burned_Trivial`** | **`TEST` (`CA_BUG_2026`)** | `all` | `0.6679` (`[0.6011, 0.7016]`) | `0.5014` | `0.5014` | `1.0000` | `0.0000` | `233,570` | `232,258` | `0` | `0` |
| **Model 2: `LightGBM_Pixel_Spatial`** | **`TEST` (`CA_BUG_2026`)** | `0.18` | `0.5037` (`[0.4624, 0.5384]`) | `0.3367` | **`0.8239`** | `0.3628` | **`0.9220`** | `84,728` | `18,109` | `148,842` | `214,149` |

### 9.2 Independent Cross-Sensor Validation Against QA-Filtered NASA `MCD64A1.061` (`TEST`: `CA_BUG_2026`)

| Model | Evaluation Grid | `F1` | `IoU` | `Precision` | `Recall` | `Specificity` | `ROC-AUC` | `PR-AUC` |
|---|---|---|---|---|---|---|---|---|
| **Model 3: `UNet_ResNet34`** | `20 m` Pixel Grid (`465,828 px`) | **`0.8246`** | **`0.7015`** | **`0.9730`** | `0.7155` | **`0.9416`** | **`0.9388`** | **`0.9744`** |
| **Model 3: `UNet_ResNet34`** | `500 m` Block Reconciled (`746 blocks`) | **`0.8414`** | **`0.7261`** | **`0.9833`** | `0.7352` | **`0.9626`** | — | — |
| **Model 1: `Log_Ratio_Baseline`** | `20 m` Pixel Grid (`465,828 px`) | `0.7636` | `0.6177` | `0.8468` | `0.6953` | `0.6306` | `0.7458` | `0.8962` |
| **Model 1: `Log_Ratio_Baseline`** | `500 m` Block Reconciled (`746 blocks`) | **`0.9287`** | **`0.8669`** | **`0.9763`** | **`0.8855`** | **`0.9358`** | — | — |
| **Model 2: `LightGBM_Pixel_Spatial`** | `20 m` Pixel Grid (`465,828 px`) | `0.4288` | `0.2729` | `0.9388` | `0.2778` | `0.9468` | `0.6323` | `0.8579` |

---

## 10. Application Integration & Test Suite Verification

- Added FastAPI endpoints `/api/events/{event_id}/firms` (and `/api/v1/events/{event_id}/firms`) and `/api/runs/latest` (and `/api/v1/runs/latest`) in `backend/app/api/endpoints.py` and `backend/app/services/analysis_service.py`.
- Added unit and integration tests for water-excluded optical validity masks (`SCL != 6`), `MCD64A1` QA Bit 2 (`shortened_mapping_period`) filtering, FIRMS URL key sanitization, and the new FastAPI endpoints.
- All `pytest` tests in `backend/tests/` pass (`100%` pass rate).

---

## 11. Remaining Limitations & Next Steps

1. **NISAR L-Band HDF5 Ingestion Ready Upon Earthdata Login Provisioning:** Once NASA Earthdata Login credentials (`~/.netrc` or `EARTHDATA_TOKEN`) are configured, the verified NASA Harmony OGC API Coverages client (`backend/processing/acquisition/asf_client.py`) can download the 4 primary matched before/after NISAR L2 GCOV spatial/variable subsets (`~20.48 MB` total) and run the exact same water-free dataset and training pipeline on L-band (`HHHH`/`HVHV`) backscatter.
2. **Sample Size Across Fire Regimes:** With `3` active wildfire events (`1` `TRAIN`, `1` `VAL`, `1` `TEST`), expanding the catalog to `10+` events stratified by ecoregion (conifer forest vs. sagebrush rangeland vs. chaparral) will reduce cross-event threshold shift.
