# Astera Watch — Final Scientific & Engineering Evidence Audit Report

**Audit Target:** `Astera Watch — Final Completion Report (Phases 0–12)` (`reports/ASTERA_WATCH_FINAL_COMPLETION_REPORT.md`)  
**Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*  
**Repository Path:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`  
**Audit Mode:** Strictly Read-Only Independent Verification (zero existing files modified, overwritten, or deleted; zero remote network calls; zero model retraining)  
**Audit Timestamp:** `2026-11-13T23:52:00+02:00`

---

## Executive Audit Verdict

| Audit Dimension | Audit Classification | Summary of Evidence & Findings |
| :--- | :--- | :--- |
| **Phase 0: Repository Baseline & Preservation** | **`PARTIALLY_VERIFIED`** | Repository root, branch (`feature/sar-ml-pipeline`), Python/package versions, and preservation of all data/checkpoints are verified. **Discrepancy:** Actual `HEAD` is `fd3eaeb` (`Add Stage 0 report`) with `3` modified tracked files and `48` untracked porcelain entries (`140` untracked files with `-uall`), whereas `FINAL_EXECUTION_BASELINE.md` and `ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` (Q1) cited a non-existent commit `a9e1265` with `12` modified and `32` untracked entries. |
| **Phase 1: Actual Data Acquisition (S1, S2, MCD64A1)** | **`PARTIALLY_VERIFIED`** | All 28 local dataset entries in `data/real/data_source_registry.json` (`stack.npz` and `mcd64a1_ancillary.npz` across 4 events) exist on disk and match recalculated SHA-256 checksums and byte sizes (`99.21 MB` total) with **0 mismatches**. **Discrepancies:** (1) `ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` Q5 cited stale `.npz` byte sizes (`49.06 MB` total) and SHA-256 hashes (`4939875e...`) that do not match the actual files on disk or `data_source_registry.json`; (2) Q6 misstated `CA_DOME_2026` S1 orbit as `137 ascending` (actual: `144 descending`) and `CA_BUG_2026` CRS as `EPSG:32610` (actual: `EPSG:32611`); (3) `MCD64A1` QA Bit 2 (`shortened_mapping_period`) is decoded by `decode_qa_bitmask()` but ignored in `high_quality_land_mask` and omitted from `qa_summary` (empirically `0.00%` of pixels across all 4 AOIs have Bit 2 set). |
| **Phase 2: NISAR Discovery, Acquisition & Adapter** | **`PARTIALLY_VERIFIED`** | `data/real/nisar_cmr_candidates.json` genuinely contains `170` discovered CMR granules (`9` Validated `P05036` + `161` Provisional `P05023`) and `15` same-track, same-frame, same-direction pre/post candidate pairs. Zero binary NISAR HDF5 files or Harmony subsets were downloaded (`NISAR_DATA_ACQUIRED = False`). The `20.48 MB` Harmony subset size is a plausible analytical calculation (`2.56 MB/granule × 8`), not an empirically measured download. **Adapter Status:** `NISAR_GCOV_Adapter` was tested strictly against synthetic HDF5 fixtures (`data/mock/*.h5` and unit tests), supporting **`NISAR_ADAPTER_SPEC_TESTED`**, not `NISAR_REAL_GRANULE_PREPROCESSING_VERIFIED`. |
| **Phase 3: Scientific Labels, dNBR, & SCL Masking** | **`PARTIALLY_VERIFIED`** | `compute_nbr` and `compute_dnbr` formulas are exact. **Critical Findings:** (1) Actual reference labels in `dataset_manifest.json`, `real_model_comparison.json`, and `real_predictions/*.npz` were generated with a TRAIN-calibrated threshold of **$\text{dNBR} \ge 0.11$**, whereas `ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` Q6/Q9 falsely claimed **$\text{dNBR} \ge 0.27$**; (2) `SCL_VALID_CLASSES = (4, 5, 6, 7)` in `optical.py` includes **`SCL == 6` (Water)** and `SCL == 7` (Unclassified), and `build_real_dataset.py` did **not** exclude `SCL == 6` water pixels when building `valid` for `Gann` (`27,464` water px included), `Dome` (`392` water px), and `Bug` (`15` water px). |
| **Phase 4: Model Training, Metrics & 500 m Reconciliation** | **`PARTIALLY_VERIFIED`** | Independent recalculation from `outputs/evaluation/real_predictions/<EVENT_ID>.npz` and `mcd64a1_ancillary.npz` **100% reproduces** all headline metrics in `comprehensive_validation_report.json` (`TEST` U-Net 20 m dNBR `F1 = 0.8150`, 20 m MCD64A1 `F1 = 0.8930`, 500 m block-reconciled `F1 = 0.9022`, `Specificity = 0.9572`, `Pearson r = 0.7768`). **Discrepancy:** `ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` Q10 and `docs/MODEL_CARD.md` reported `U-Net threshold = 0.12` (`297.28 s`) and `CUSUM h = 5.0`, whereas `real_model_comparison.json` records `U-Net selected_probability_threshold = 0.54` (`149.76 s`) and `CUSUM selected_h = 3.5`. |
| **Phase 5: Geospatial Products, API, & Test Suite** | **`VERIFIED`** | All `44` geospatial files (`32` GeoTIFFs, `4` GeoJSONs, `4` PNGs, `4` JSON summaries) exist under `outputs/geospatial/<EVENT_ID>/` with valid UTM CRS and affine transforms. All `41` automated tests in `backend/tests/` pass (`41 passed in 24.61s`). |

---

## PHASE 0 — Repository Baseline and Preservation Audit

### 0.1 Actual Repository State vs `reports/FINAL_EXECUTION_BASELINE.md`

| Baseline Attribute | Claimed in `FINAL_EXECUTION_BASELINE.md` & `ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` (Q1) | Actual Measured State (`2026-11-13T23:46+02:00`) | Verification Status |
| :--- | :--- | :--- | :--- |
| **Repository Root** | `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform` | `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform` | `VERIFIED` |
| **Current Git Branch** | `feature/sar-ml-pipeline` | `feature/sar-ml-pipeline` | `VERIFIED` |
| **Current HEAD Commit** | `a9e1265` (*"Implement real SAR data pipeline, ML models, and validation reports"*) | `fd3eaeb6c48ba437c8752f0858cef9bdecfe128f` (`Add Stage 0 report`) | **`DISCREPANCY_FOUND`** |
| **Modified Tracked Files (`git status --short`)** | `12` modified tracked files | **`3` modified tracked files:** `M .gitignore`, `M` project rules file, `M README.md` | **`DISCREPANCY_FOUND`** |
| **Untracked Entries (`git status --short`)** | `32` untracked files/directories | **`48` untracked porcelain entries** (`140` individual untracked files via `git status --porcelain -uall`) | **`DISCREPANCY_FOUND`** |
| **Deleted Files** | `0` | **`0`** | `VERIFIED` |
| **Python & Package Versions** | Python `3.13.7`, PyTorch `2.11.0+cpu`, LightGBM `4.6.0`, Rasterio `1.5.0`, `h5py 3.16.0`, `asf_search 12.0.1` | Python `3.13.7`, PyTorch `2.11.0+cpu` (`CUDA: False`), LightGBM `4.6.0`, Rasterio `1.5.0`, `h5py 3.16.0`, `asf_search 12.0.1` | `VERIFIED` |
| **Available Disk Space** | `15.53 GB` free (at initial baseline) / `12.53 GB` free (in `data_source_registry.json`) | **`11.69 GB` free** of `300.00 GB` total | `VERIFIED` |

### 0.2 Complete `git log` and `git status --short` Record

Actual `git log --oneline`:
```text
fd3eaeb Add Stage 0 report
a676179 Stage 0: project skeleton, setup docs, Conda env and database setup scripts
7da1f32 README
4ab0b4d Initial commit
```
*Audit Note:* Commit `a9e1265` does not exist in `.git/logs/HEAD` or `git log --all`. All pipeline code under `backend/`, `scripts/`, `data/`, `docs/`, `outputs/`, and `reports/` resides in the working tree as untracked files (`??`) built on top of commit `fd3eaeb`.

---

## PHASE 1 — Actual Data Acquisition Audit

### 1.1 Sentinel-1 RTC Verification (`16` Claimed Scenes)

- **What Actually Exists on Disk:**
  - **No raw full-scene Sentinel-1 GeoTIFF files exist on disk.** Instead, `scripts/acquire_real_data.py` queried Microsoft Planetary Computer STAC (`sentinel-1-rtc`), signed SAS URLs, windowed the $16\text{ km} \times 16\text{ km}$ AOI via `rasterio.vrt.WarpedVRT` (`Resampling.bilinear`, 20 m UTM grid), and saved the **derived, co-registered `800 × 800` `float32` linear $\gamma^0$ arrays** (`s1_pre_vv`, `s1_pre_vh`, `s1_mid_vv`, `s1_mid_vh`, `s1_post_vv`, `s1_post_vh`, `s1_post2_vv`, `s1_post2_vh`) inside `data/real/<EVENT_ID>/stack.npz`.
  - Provenance metadata (exact scene IDs, UTC acquisition timestamps, relative orbit numbers, pass directions, platform `sentinel-1c` vs `sentinel-1d`, Azure Blob URLs, and per-band SHA-256 checksums of the resampled arrays) is preserved in [acquisition_manifest.json](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/data/real/acquisition_manifest.json) and [data_source_registry.json](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/data/real/data_source_registry.json).

- **Verified Sentinel-1 Scene Table (Actual `acquisition_manifest.json` vs Report Claims):**

| Event ID | Split | Actual CRS & Grid | Actual Relative Orbit & Pass | Actual 4 Scene IDs & Timestamps (`pre`, `mid`, `post`, `post2`) | Valid S1 Coverage (`800×800`) | Discrepancies vs Completion Report |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`CA_GANN_2026`** | `TRAIN` | `EPSG:32610` (`20 m`, `800×800`) | Orbit **`42`**, `descending` (`S1C`) | `pre`: `S1C_..._20260726T140658_..._rtc` (`2026-07-26T14:07:11Z`)<br>`mid`: `S1C_..._20260807T140659_..._rtc` (`2026-08-07T14:07:11Z`)<br>`post`: `S1C_..._20260819T140700_..._rtc` (`2026-08-19T14:07:12Z`)<br>`post2`: `S1C_..._20260831T140700_..._rtc` (`2026-08-31T14:07:13Z`) | `100.00%` (`0` NaNs; linear $\gamma^0 \in [0.0005, 25.17]$) | Matches report dates/orbit. |
| **`CA_DOME_2026`** | `VAL` | `EPSG:32611` (`20 m`, `800×800`) | Orbit **`144`**, `descending` (`S1D` / `S1C`) | `pre`: `S1D_..._20260913T135910_..._rtc` (`2026-09-13T13:59:23Z`)<br>`mid`: `S1C_..._20261001T135854_..._rtc` (`2026-10-01T13:59:06Z`)<br>`post`: `S1D_..._20261007T135910_..._rtc` (`2026-10-07T13:59:23Z`)<br>`post2`: `S1D_..._20261019T135910_..._rtc` (`2026-10-19T13:59:23Z`) | `100.00%` (`0` NaNs; linear $\gamma^0 \in [0.0011, 12.31]$) | **Report Q6 & `DATA_SOURCES.md` falsely claimed orbit `137 ascending` (`08-31, 09-12, 10-06, 10-18`).** Actual data is orbit `144 descending` (`09-13, 10-01, 10-07, 10-19`), and `mid` mixes `S1C` with `S1D`. |
| **`CA_BUG_2026`** | `TEST` | **`EPSG:32611`** (`20 m`, `800×800`) | Orbit **`64`**, `ascending` (`S1D`) | `pre`: `S1D_..._20260803T015102_..._rtc` (`2026-08-03T01:51:14Z`)<br>`mid`: `S1D_..._20260815T015102_..._rtc` (`2026-08-15T01:51:15Z`)<br>`post`: `S1D_..._20260827T015103_..._rtc` (`2026-08-27T01:51:16Z`)<br>`post2`: `S1D_..._20260908T015103_..._rtc` (`2026-09-08T01:51:16Z`) | `72.79%` (`174,000–174,196` swath-edge NaNs per band; finite $\gamma^0 \in [0.0007, 13.46]$) | **Report Q6 & Q14 falsely listed `CA_BUG_2026` CRS as `EPSG:32610`.** Actual CRS in `stack.npz` and GeoTIFFs is **`EPSG:32611`**. |
| **`CA_TIMBER_2026`** | `EXCLUDED` (`split="TRAIN"`, `include_in_training=False`) | `EPSG:32610` (`20 m`, `800×800`) | Orbit **`35`**, `ascending` (`S1C`) | `pre`: `S1C_..._20260807T020631_..._rtc` (`2026-08-07T02:06:44Z`)<br>`mid`: `S1C_..._20260819T020632_..._rtc` (`2026-08-19T02:06:44Z`)<br>`post`: `S1C_..._20260831T020633_..._rtc` (`2026-08-31T02:06:45Z`)<br>`post2`: `S1C_..._20260912T020633_..._rtc` (`2026-09-12T02:06:45Z`) | `100.00%` (`0` NaNs; linear $\gamma^0 \in [0.00046, 5.32]$) | **Report Q6 & `DATA_SOURCES.md` claimed dates `07-26, 08-07, 08-19, 08-31`.** Actual dates in `acquisition_manifest.json` are `08-07, 08-19, 08-31, 09-12`. |

### 1.2 Sentinel-2 L2A Verification (`8` Claimed Scenes)

- **What Actually Exists on Disk:**
  - Derived 20 m UTM (`800 × 800`) arrays `s2_pre_B04`, `s2_pre_B08`, `s2_pre_B12`, `s2_pre_SCL`, `s2_post_B04`, `s2_post_B08`, `s2_post_B12`, `s2_post_SCL` inside `data/real/<EVENT_ID>/stack.npz` (`0` NaNs across all 4 events).
  - Reflectance bands (`B04`, `B08`, `B12`) are stored in `float32` scaled by $1/10000$ (values range from `0.0718` to `1.6249`).
  - **Discrepancy Caught in `docs/DATA_SOURCES.md`:** `DATA_SOURCES.md` Section 1.2 claimed `CA_GANN_2026` used Sentinel-2 tile `T10SGF` on `2026-07-29` and `2026-08-28` (`0.996 / 0.985`). Actual `acquisition_manifest.json` and `data_source_registry.json` show `CA_GANN_2026` used tile **`T10SFH`**:
    - Pre-fire: `S2C_MSIL2A_20260729T183921_R070_T10SFH_20260729T233215` (`2026-07-29T18:39:21Z`, `scl_valid_fraction = 0.9991`)
    - Post-fire: `S2A_MSIL2A_20260830T184831_R070_T10SFH_20260831T044811` (`2026-08-30T18:48:31Z`, `scl_valid_fraction = 0.9820`)

### 1.3 MODIS `MCD64A1.061` Verification & QA Bit Decoding Audit

- **Actual Source Assets & Derived Layers:**
  - Two monthly 500 m Sinusoidal COG granules from Planetary Computer (`modis-64A1-061`, NASA Concept ID `C2565786756-LPCLOUD`) were windowed and nearest-neighbor warped onto each event's 20 m UTM grid:
    - `MCD64A1.A2026213.h08v05.061.2026286121320` (August 2026 — used for `CA_GANN_2026`, `CA_BUG_2026`, `CA_TIMBER_2026`)
    - `MCD64A1.A2026244.h08v05.061.2026314113209` (September 2026 — used for `CA_DOME_2026`)
  - All 5 Science Data Sets (`burn_date`, `uncertainty`, `qa`, `first_day`, `last_day`) exist in `data/real/<EVENT_ID>/mcd64a1_ancillary.npz` (note: the array key for uncertainty is `"uncertainty"`, whereas `ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` Q8 referred to it as `"burn_date_uncertainty"`).
- **QA Bit Decoding Audit ([mcd64a1.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/processing/preprocessing/mcd64a1.py)):**
  - `decode_qa_bitmask(qa)` decodes:
    - **Bit 0 (`0b00000001`):** `is_land` (`1` = land, `0` = water)
    - **Bit 1 (`0b00000010`):** `is_valid_data` (`1` = sufficient valid data, `0` = insufficient)
    - **Bit 2 (`0b00000100`):** `shortened_mapping_period` (`1` = shortened, `0` = not shortened)
    - **Bit 3 (`0b00001000`):** `contextual_relabeled` (`1` = relabeled, `0` = not relabeled)
    - **Bits 5–7 (`(q >> 5) & 0b111`):** `special_condition_code` (`0..7`)
  - **How Bit 2 is handled:** `decode_qa_bitmask()` computes `shortened_mapping_period` correctly, **but** `high_quality_land_mask = is_land & is_valid_data` ignores Bit 2, and `summarize_mcd64a1_layers()` does not include `shortened_mapping_period` in `qa_summary`.
  - **Empirical Bit Distribution Across All 4 Events:**
    - `CA_GANN_2026`: `qa` unique values `[0, 3, 11, 131]` $\to$ Bit 0 = `99.58%`, Bit 1 = `99.58%`, **Bit 2 = `0.00%` (`0` px)**, Bit 3 = `0.25%` (`1,620` px), Bit 7 = `0.75%` (`4,799` px).
    - `CA_DOME_2026`: `qa` unique values `[3, 11]` $\to$ Bit 0 = `100.00%`, Bit 1 = `100.00%`, **Bit 2 = `0.00%` (`0` px)**, Bit 3 = `1.01%` (`6,449` px).
    - `CA_BUG_2026`: `qa` unique values `[3, 11]` $\to$ Bit 0 = `100.00%`, Bit 1 = `100.00%`, **Bit 2 = `0.00%` (`0` px)**, Bit 3 = `0.94%` (`6,041` px).
    - `CA_TIMBER_2026`: `qa` unique values `[0, 1, 3, 11, 35, 131]` $\to$ Bit 0 = `83.21%`, Bit 1 = `82.95%`, **Bit 2 = `0.00%` (`0` px)**, Bit 3 = `0.92%` (`5,883` px), Bit 5 = `0.08%` (`528` px), Bit 7 = `0.22%` (`1,380` px).

### 1.4 Data Registry & Checksum Verification Table

We independently recalculated the byte size and SHA-256 digest of every local dataset file on disk and compared them against both `data/real/data_source_registry.json` (`52` entries: `28` `PROCESSED` local entries + `24` `DISCOVERED` remote NISAR entries) and the prose claims in `ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` (Q5) and `reports/DATA_ACQUISITION_REPORT.md`:

| Dataset File (Derived 20 m Co-Registered Archive) | Claimed in `data_source_registry.json` (`bytes` / `sha256_checksum`) | Claimed in `ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` (Q5) | Independently Verified on Disk (`bytes` / `SHA-256`) | Evidence & Provenance | Audit Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `data/real/CA_GANN_2026/stack.npz` | `26,207,283 B`<br>`51331e60cbdd788129eb2c930509aef885e1e7002b8f6078c363adbde26266d0` | `10,602,380 B`<br>`4939875e56cf8086...` (**STALE**) | **`26,207,283 B`**<br>`51331e60cbdd788129eb2c930509aef885e1e7002b8f6078c363adbde26266d0` | Registry entries `[00]–[05]` (`4` S1C + `2` S2 L2A + `1` MCD64A1 derived arrays) | **`VERIFIED` vs Registry** (`DISCREPANCY` in Report Q5 prose) |
| `data/real/CA_GANN_2026/mcd64a1_ancillary.npz` | `22,435 B`<br>`44252a9eb99016009c678d20ae9c79c304b878b7ce07a698c13d301cb0b25410` | `28,274 B`<br>`0d35c1e168740bb7...` (**STALE**) | **`22,435 B`**<br>`44252a9eb99016009c678d20ae9c79c304b878b7ce07a698c13d301cb0b25410` | Registry entry `[06]` (`MCD64A1.A2026213.h08v05.061` 5-SDS ancillary) | **`VERIFIED` vs Registry** (`DISCREPANCY` in Report Q5 prose) |
| `data/real/CA_DOME_2026/stack.npz` | `26,023,453 B`<br>`36c84d432d3781f20396d42ed0704b4a88a1a03b4295de7197abd70a31563ba7` | `11,834,637 B`<br>`53b311fa76c211db...` (**STALE**) | **`26,023,453 B`**<br>`36c84d432d3781f20396d42ed0704b4a88a1a03b4295de7197abd70a31563ba7` | Registry entries `[26]–[31]` (`4` S1D/S1C + `2` S2 L2A + `1` MCD64A1 derived arrays) | **`VERIFIED` vs Registry** (`DISCREPANCY` in Report Q5 prose) |
| `data/real/CA_DOME_2026/mcd64a1_ancillary.npz` | `24,630 B`<br>`1b47f3d4951582022adef2f3332e6ce7923d0c9ca5e71cf76a92e5386826ae42` | `17,774 B`<br>`ec88b263d48543d8...` (**STALE**) | **`24,630 B`**<br>`1b47f3d4951582022adef2f3332e6ce7923d0c9ca5e71cf76a92e5386826ae42` | Registry entry `[32]` (`MCD64A1.A2026244.h08v05.061` 5-SDS ancillary) | **`VERIFIED` vs Registry** (`DISCREPANCY` in Report Q5 prose) |
| `data/real/CA_BUG_2026/stack.npz` | `20,704,291 B`<br>`56b69365b2e1ae77461385bf71bf0cbf87bcb895d1a093bddafd7c36e6a59258` | `13,772,965 B`<br>`9f488943222b2eb2...` (**STALE**) | **`20,704,291 B`**<br>`56b69365b2e1ae77461385bf71bf0cbf87bcb895d1a093bddafd7c36e6a59258` | Registry entries `[39]–[44]` (`4` S1D + `2` S2 L2A + `1` MCD64A1 derived arrays) | **`VERIFIED` vs Registry** (`DISCREPANCY` in Report Q5 prose) |
| `data/real/CA_BUG_2026/mcd64a1_ancillary.npz` | `37,272 B`<br>`a5504ee89cb24e1704acb8af57c8327dcf4169799bfe490660d67d238cce8547` | `55,610 B`<br>`4817c9101cf235a9...` (**STALE**) | **`37,272 B`**<br>`a5504ee89cb24e1704acb8af57c8327dcf4169799bfe490660d67d238cce8547` | Registry entry `[45]` (`MCD64A1.A2026213.h08v05.061` 5-SDS ancillary) | **`VERIFIED` vs Registry** (`DISCREPANCY` in Report Q5 prose) |
| `data/real/CA_TIMBER_2026/stack.npz` | `26,161,299 B`<br>`f313c0f24df48dbf71ce9f340ff67a0e8f759d218b2f3ced6c8e353a0401c006` | `12,727,310 B`<br>`5d80d1fd84e1dcbb...` (**STALE**) | **`26,161,299 B`**<br>`f313c0f24df48dbf71ce9f340ff67a0e8f759d218b2f3ced6c8e353a0401c006` | Registry entries `[13]–[18]` (`4` S1C + `2` S2 L2A + `1` MCD64A1 derived arrays) | **`VERIFIED` vs Registry** (`DISCREPANCY` in Report Q5 prose) |
| `data/real/CA_TIMBER_2026/mcd64a1_ancillary.npz` | `33,551 B`<br>`4c8bc4e07f604083db3728155f4b183b8dbae542931c77209688732f3a706fbb` | `24,523 B`<br>`92d414cf2df2199b...` (**STALE**) | **`33,551 B`**<br>`4c8bc4e07f604083db3728155f4b183b8dbae542931c77209688732f3a706fbb` | Registry entry `[19]` (`MCD64A1.A2026213.h08v05.061` 5-SDS ancillary) | **`VERIFIED` vs Registry** (`DISCREPANCY` in Report Q5 prose) |
| **24 NISAR GCOV Registry Entries (`[07]–[12]`, `[20]–[25]`, `[33]–[38]`, `[46]–[51]`)** | `local_file_path: null`, `download_status: BLOCKED_AUTH` (`12`) / `BLOCKED_STORAGE` (`12`), `validation_status: DISCOVERED` | Not downloaded (`BLOCKED_AUTH` / `BLOCKED_STORAGE`) | **`0` local files (`None`)** | CMR metadata & Harmony URLs only | `VERIFIED` (Metadata only) |

---

## PHASE 2 — NISAR Discovery and Acquisition Audit

### 2.1 NISAR Granule Discovery & Pre/Post Pair Verification

Inspection of [nisar_cmr_candidates.json](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/data/real/nisar_cmr_candidates.json) confirms:
- **Total CMR Granules Recorded:** **`170`** (`36` on `CA_GANN_2026` + `31` on `CA_TIMBER_2026` + `56` on `CA_DOME_2026` + `47` on `CA_BUG_2026`; note that because `Gann` and `Dome` share Track 42 Frame 69 and Track 34 Frame 21, several granules appear in more than one event's spatial query list).
- **Maturity Breakdown:** **`9` Validated `CRID P05036`** (`NISAR_L2_GCOV_V1`, `C3622241360-ASF`, acquired `2026-10-26` to `2026-10-27`) and **`161` Provisional `CRID P05023`** (`NISAR_L2_GCOV_PROVISIONAL_V1`, `C2854338529-ASF`, acquired `2026-06-04` to `2026-10-21`).
- **Audit of the 15 Candidate Pre/Post Pairs:**
  - All 15 pairs satisfy: (1) identical `track`, (2) identical `frame`, (3) identical `orbit_direction` (`DESCENDING` or `ASCENDING`), (4) identical polarization (`HHHH+HVHV`), (5) pre-fire timestamp strictly prior to `ignition_date` and post-fire timestamp after `burn_window_end_date`, and (6) full WKT polygon enclosure of the AOI.
  - **Discrepancies Identified Between `nisar_cmr_candidates.json` and `ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` (Q3):**
    1. On `CA_BUG_2026` (`DESC T42 F68`) and `CA_TIMBER_2026` (`DESC T42 F70`), `primary_nisar_pair["post_fire_granule"]` in `nisar_cmr_candidates.json` is the **`2026-09-09`** (`Cycle 030`) granule (`G4311241515-ASF`, `6,685.0 MB` for Bug; `G4311256123-ASF`, `6,141.48 MB` for Timber) because `match_before_after_pairs()` filters for post-fire granules after `burn_window_end_date` (`2026-08-28` and `2026-08-31`), whereas `ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` Q3 listed the `2026-08-16` (`Cycle 028`) granule as the immediate post-fire pair for Bug and Timber.
    2. In 6 of the 11 alternate pairs (on Tracks `135`, `143`, `114`, and `106`), the JSON field `validated_post_fire_granule` actually holds a late-October **`CRID P05023` (`PROVISIONAL`)** granule (`G4385047366-ASF`, `G4359659208-ASF`, `G4385054823-ASF`, `G4382827690-ASF`, `G4381273909-ASF`, `G4381210839-ASF`) because `match_before_after_pairs()` in `asf_client.py` falls back to `post_candidates[-1]` when no `P05036` validated granule exists on that track/frame. Only Tracks `42` and `34` have genuine `CRID P05036` (`VALIDATED_SCIENCE`) post-fire granules (`G4406462944-ASF`, `G4408663010-ASF`, `G4406466150-ASF`, `G4408635016-ASF`, `G4406486031-ASF`, `G4408660323-ASF`).
    3. All 15 pairs are **metadata candidate pairs**, not radiometrically or interferometrically confirmed pairs, because no binary HDF5 granule was downloaded.

### 2.2 NISAR Acquisition Status Chain

| Acquisition Stage | Audit Status | Empirical Evidence |
| :--- | :--- | :--- |
| `DISCOVERED_METADATA` | **`VERIFIED` (`COMPLETED`)** | `data/real/nisar_cmr_candidates.json` (`170` CMR granules, `15` matched candidate pairs). |
| `SUBSET_URL_GENERATED` | **`VERIFIED` (`COMPLETED`)** | `build_harmony_subset_url()` in `asf_client.py` generated valid OGC API Coverages URLs (`harmony_subset_urls` in `nisar_cmr_candidates.json`). |
| `SUBSET_SIZE_ESTIMATED` | **`VERIFIED` (`ESTIMATED_ONLY`)** | Hardcoded in `asf_client.py` line 444 as `estimated_subset_mb_per_granule = 2.56` (`5.12 MB` per pair, `20.48 MB` across 4 pairs). Technically plausible ($800 \times 800 \times 17\text{ B} = 10.88\text{ MB}$ raw $\to \sim 2.56\text{ MB}$ with DEFLATE), but **never measured from an actual Harmony response**. |
| `DOWNLOAD_ATTEMPTED` | **`VERIFIED` (`COMPLETED`)** | Unauthenticated HTTP probe redirected (`HTTP 302/303`) to `https://urs.earthdata.nasa.gov/oauth/authorize` and returned `HTTP 401 Unauthorized`. |
| `DOWNLOAD_FAILED_AUTH` | **`VERIFIED` (`COMPLETED`)** | Recorded as `download_status: "BLOCKED_AUTH"` (`earthdata_login_configured: false`). |
| `DOWNLOAD_COMPLETED` | **`NOT_COMPLETED`** | Zero NISAR bytes downloaded. |
| `BINARY_FILE_VERIFIED` | **`NOT_COMPLETED`** | Zero real NISAR `.h5` or NetCDF4 subset files exist anywhere in the repository. |
| `NISAR_DATA_ACQUIRED` | **`FALSE`** | Explicitly `False` in `data_source_registry.json` (`project_maturity_status.NISAR_DATA_ACQUIRED = false`). |

### 2.3 NISAR Preprocessing Adapter Audit ([nisar_gcov_adapter.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/processing/adapters/nisar_gcov_adapter.py))

- **Implementation Audit:**
  - Correctly resolves `/science/LSAR/GCOV/grids/frequencyA` and `/science/LSAR/GCOV/grids/frequencyB` without mutating `self.grid_path`.
  - Dynamically discovers diagonal (`HHHH`, `HVHV`, `VVVV`, `VHVH`, `RHRH`, `RVRV`, `HH`, `HV`, `VV`, `VH`) and complex off-diagonal (`HHHV`, `HHVH`, `HHVV`, `HVVH`, `HVVV`, `VVVH`, `RHRV`, `complex64`) covariance datasets.
  - Decodes `mask` (`uint8`: `0` = invalid shadow/layover, `1..254` = valid subswath ID, `255` = fill outside swath) via `decode_nisar_mask()`.
  - Implements $\sigma^0 = \gamma^0 \times \text{rtcGammaToSigmaFactor}$ (`gamma0_to_sigma0()`), mapping non-positive or non-finite factors to `NaN`.
  - Fails closed (`ValidationReport(is_valid=False)`) when `zeroDopplerStartTime`, `projection` (`epsg_code`), or monotonic `xCoordinates`/`yCoordinates` are missing.
- **Test Fixture Audit ([test_adapters.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/tests/test_adapters.py) & `data/mock/*.h5`):**
  - All tests use synthetic HDF5 files generated by `write_mock_hdf5()` or inline `h5py.File` fixtures (`data/mock/OR_HAY_CREEK_2026_pre_gcov.h5`, etc., all marked `is_synthetic = 1`).
  - **Official Adapter Audit Status:** **`NISAR_ADAPTER_SPEC_TESTED`** (the adapter has **not** been tested on an official JPL/ASF real NISAR sample granule or a real 2026 NISAR observation).

---

## PHASE 3 — Scientific Label, Reference, and Validation Audit

### 3.1 Sentinel-2 $\text{dNBR}$ Implementation & Threshold Audit

- **Mathematical Implementation ([optical.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/processing/preprocessing/optical.py)):**
  - `compute_nbr(nir, swir2)` computes `(B08 - B12) / (B08 + B12)` in `float32`, setting pixels where `|B08 + B12| <= 1e-6` or non-finite to `NaN`.
  - `compute_dnbr(nbr_pre, nbr_post)` computes `nbr_pre - nbr_post`.
- **CRITICAL AUDIT FINDING — Actual $\text{dNBR}$ Threshold is `0.11`, Not `0.27`:**
  - `reports/ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` (Q6, Q9) and `reports/PREPROCESSING_REPORT.md` state that binary reference labels were thresholded at $\text{dNBR} \ge 0.27$.
  - **Actual Repository Evidence:** [build_real_dataset.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/scripts/build_real_dataset.py) (lines 139–149) called `calibrate_dnbr_threshold()` on `TRAIN` (`CA_GANN_2026`) against `MCD64A1`, selecting **`label_threshold = 0.11`** ([dataset_manifest.json](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/data/real/dataset/dataset_manifest.json) line 11; [real_model_comparison.json](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/outputs/evaluation/real_model_comparison.json) line 13).
  - Every saved `label` array in `data/real/dataset/{train,val,test}.npz`, `data/real/dataset/prepared/<EVENT_ID>.npz`, and `outputs/evaluation/real_predictions/<EVENT_ID>.npz` was generated using **`dnbr >= 0.11`**.

### 3.2 `SCL` Class Handling Audit (`SCL ∈ {4, 5, 6, 7}` vs `SCL ∈ {4, 5, 7}`)

- **Code Inspection ([optical.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/processing/preprocessing/optical.py) line 14):**
  ```python
  SCL_VALID_CLASSES = (4, 5, 6, 7)  # vegetation, bare, water, unclassified
  ```
- **Scientific Justification & Audit Finding:**
  - In Sentinel-2 L2A Scene Classification Layer (`SCL`):
    - Class `4` = Vegetation (valid land)
    - Class `5` = Not-vegetated / bare soil / fresh char (valid land; essential after wildfire because burned canopy transitions from Class `4` to Class `5`)
    - Class `6` = **Water** (open water bodies; cannot burn and causes specular radar backscatter artifacts)
    - Class `7` = Unclassified (low-probability cloud/shadow border or dark char/topographic transitions)
  - **Discrepancy Between `build_real_dataset.py` and Report Prose:**
    - `reports/ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` (Q8, Q9) and `docs/BEFORE_AFTER_ANALYSIS.md` claim that valid pixels are restricted to `SCL ∈ {4, 5, 7}` and non-water (`SCL != 6`).
    - In reality, `scripts/build_real_dataset.py` (line 63) used `valid_optical_mask()`, which checks `np.isin(scl, (4, 5, 6, 7))` **without excluding `SCL == 6` (Water)**.
    - Although `scripts/generate_before_after_and_validation.py` (line 230) added `not_water = (s2_scl_pre != 6) & (s2_scl_post != 6)`, line 259 (`if pred_path.exists(): valid_mask = pr["valid"]`) overwrote `valid_mask` with the water-inclusive mask from `real_predictions/<EVENT_ID>.npz` for `CA_GANN_2026`, `CA_DOME_2026`, and `CA_BUG_2026`:

| Event ID | Valid Pixels with `SCL ∈ {4,5,6,7}` (Actual in `real_predictions/*.npz` & `valid_mask.tif`) | Valid Pixels with `SCL ∈ {4,5,7}` (Water Excluded) | `SCL == 6` Water Pixels Included in Active Evaluation | Valid Pixels Claimed in `ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` (Q6) |
| :--- | :--- | :--- | :--- | :--- |
| **`CA_GANN_2026` (`TRAIN`)** | **`628,295`** (`98.17%`) | `600,831` (`93.88%`) | **`27,464`** (`4.29%`) | `628,337` (`+42` px discrepancy) |
| **`CA_DOME_2026` (`VAL`)** | **`608,542`** (`95.08%`) | `608,150` (`95.02%`) | **`392`** (`0.06%`) | `608,556` (`+14` px discrepancy) |
| **`CA_BUG_2026` (`TEST`)** | **`465,843`** (`72.79%`) | `465,828` (`72.79%`) | **`15`** (`0.002%`) | `465,671` (`-172` px discrepancy) |
| **`CA_TIMBER_2026` (`EXCLUDED`)** | `578,128` (`90.33%`) | **`468,105`** (`73.14%`, actual in `valid_mask.tif`) | **`0`** (excluded because `pred_path` absent) | `520,257` (`+52,152` px discrepancy) |

---

## PHASE 4 — Independent Model & Metric Recalculation Audit

### 4.1 Independent Recalculation on Held-Out `TEST` (`CA_BUG_2026`)

We independently recalculated all confusion matrices, 20 m segmentation metrics (vs Sentinel-2 `dNBR >= 0.11` and vs QA-filtered `MCD64A1.061`), and 500 m block-reconciled metrics (`25 × 25` pixel blocks, `746` valid blocks) directly from `outputs/evaluation/real_predictions/CA_BUG_2026.npz`, `data/real/CA_BUG_2026/stack.npz`, and `data/real/CA_BUG_2026/mcd64a1_ancillary.npz`:

| Model | Confusion Matrix vs `dNBR` (`TP / FP / FN / TN`) | Recalculated 20 m `dNBR` F1 / IoU / Spec | Report Claimed 20 m `dNBR` F1 / IoU / Spec | Recalculated 20 m `MCD64A1` F1 / Spec | Report Claimed 20 m `MCD64A1` F1 / Spec | Recalculated 500 m Block F1 / Spec / Pearson $r$ | Report Claimed 500 m Block F1 / Spec / Pearson $r$ | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`UNet_ResNet34`** | `215,276 / 79,456 / 18,294 / 152,817` | **`0.8150` / `0.6877` / `0.6579`** | `0.8150` / `0.6877` / `0.6579` | **`0.8930` / `0.9326`** | `0.8930` / `0.9326` | **`0.9022` / `0.9572` / `0.7768`** | `0.9022` / `0.9572` / `0.7768` | **`VERIFIED` (100% Exact Match)** |
| **`CUSUM`** | `199,877 / 127,743 / 33,693 / 104,530` | **`0.7123` / `0.5532` / `0.4500`** | `0.7123` / `0.5532` / `0.4500` | **`0.8091` / `0.5394`** | `0.7848` / `0.6258` | **`0.9650` / `0.8289` / `0.7931`** | `0.8229` / `0.5561` / `0.5070` | **`PARTIALLY_VERIFIED`** (`dNBR` exact; report prose cited `h=5.0` MCD table instead of stored `h=3.5` prediction) |
| **`VH Log-Ratio`** | `180,673 / 104,664 / 52,897 / 127,609` | **`0.6964` / `0.5342` / `0.5494`** | `0.6964` / `0.5342` / `0.5494` | **`0.7636` / `0.6307`** | `0.7429` / `0.6713` | **`0.9287` / `0.9358` / `0.7547`** | `0.7835` / `0.5615` / `0.5565` | **`PARTIALLY_VERIFIED`** (`dNBR` exact; report prose MCD row mismatched `comprehensive_validation_report.json`) |
| **`All_Burned_Trivial`** | `233,570 / 232,273 / 0 / 0` | **`0.6679` / `0.5014` / `0.0000`** | `0.6679` / `0.5014` / `0.0000` | **`0.8545` / `0.0000`** | `0.8545` / `0.0000` | **`0.8567` / `0.0000` / `0.0000`** | `0.8567` / `0.0000` / `0.0000` | **`VERIFIED` (100% Exact Match)** |
| **`LightGBM`** | `83,182 / 14,759 / 150,388 / 217,514` | **`0.5018` / `0.3350` / `0.9365`** | `0.5018` / `0.3350` / `0.9365` | **`0.4180` / `0.9591`** | `0.3863` / `0.9756` | **`0.2773` / `1.0000` / `0.4764`** | `0.2683` / `0.9893` / `0.6290` | **`PARTIALLY_VERIFIED`** (`dNBR` exact; report prose MCD row mismatched `comprehensive_validation_report.json`) |

### 4.2 Hyperparameter & Burned-Area Audit (`comprehensive_validation_report.json` vs Report Prose)

- **Hyperparameters in `outputs/evaluation/real_model_comparison.json` vs `ASTERA_WATCH_FINAL_COMPLETION_REPORT.md` (Q10):**
  - `UNet_ResNet34`: Actual `selected_probability_threshold = 0.54`, `training_time_sec = 149.76`, `best_epoch = 5` (Report Q10 claimed `threshold = 0.12`, `297.28 s`).
  - `CUSUM`: Actual `selected_h = 3.5`, `k_allowance = 0.5` (Report Q10 claimed `h = 5.0`).
  - `LightGBM`: Actual `selected_probability_threshold = 0.18`, `training_time_sec = 0.45` (Matches `0.18`).
  - `Log-Ratio`: Actual `threshold_db = -1.20` (Matches `-1.20 dB`).
- **Burned-Area Estimates (`outputs/geospatial/<EVENT_ID>/before_after_summary.json` vs Report Q14):**
  - `CA_GANN_2026` (`UNet`): Actual `36.0748 km²` (`CI95: [25.0741, 47.2084] km²`), `dNBR = 36.3156 km²`, `MCD64A1 = 36.2780 km²` (Report Q14 cited `36.09 km²`, `36.33 km²`, `36.30 km²` — minor `0.02 km²` rounding difference from the `42`-pixel water mask difference).
  - `CA_DOME_2026` (`UNet`): Actual `36.9968 km²` (`CI95: [28.3248, 48.5759] km²`), `dNBR = 16.9712 km²`, `MCD64A1 = 13.8568 km²` (Report Q14 cited `36.98 km²`, `16.96 km²`, `13.86 km²`).
  - `CA_BUG_2026` (`UNet`): Actual `117.8928 km²` (`CI95: [106.5201, 129.0670] km²`), `dNBR = 93.4280 km²`, `MCD64A1 = 138.9976 km²` (Report Q14 cited `117.85 km²`, `93.41 km²`, `138.94 km²`).
  - `CA_TIMBER_2026` (`Log-Ratio`): Actual `before_after_summary.json` records **`49.5572 km²`** (`CI95: [48.2981, 51.0275] km²`), **`dNBR = 50.1544 km²`** (at `dnbr >= 0.11`), and **`MCD64A1 = 51.4452 km²`** over `468,105` valid land pixels (`187.2420 km²`), whereas Report Q14 cited `61.71 km²`, `dNBR = 5.52 km²` (at `dnbr >= 0.27`), and `MCD64A1 = 63.61 km²` over `520,257` valid pixels.

---

## PHASE 5 — Geospatial Products, API, and Test Suite Verification

1. **Geospatial Outputs (`outputs/geospatial/<EVENT_ID>/`):**
   - All **44 files** (`11` per event $\times 4$ events: `pre_vh_db.tif`, `post_vh_db.tif`, `delta_vh_db.tif`, `burn_prob.tif`, `burn_mask.tif`, `valid_mask.tif`, `dnbr.tif`, `mcd64a1_burn_date.tif`, `aoi_boundary.geojson`, `before_after_overview.png`, `before_after_summary.json`) exist on disk, are non-empty, and carry valid projected UTM CRS (`EPSG:32610` for `Gann`/`Timber`, `EPSG:32611` for `Dome`/`Bug`) and `20.0 m` affine transforms (`VERIFIED`).
2. **FastAPI Endpoints (`backend/app/`):**
   - All 10 endpoint routes mounted at both `/api/*` and `/api/v1/*` return `HTTP 200 OK` with explicit `provenance` dictionaries and `is_nisar: false`, `data_origin: "CROSS_SENSOR_PROTOTYPE"` (`VERIFIED`).
3. **Automated Test Suite (`backend/tests/`):**
   - `python -m pytest backend/tests/ -q` executed `41` tests across `6` test files (`test_adapters.py`, `test_api.py`, `test_metrics.py`, `test_models.py`, `test_preprocessing.py`, `test_real_pipeline.py` — note that Report Q17 said "3 test suites" when 6 test files actually exist) and passed **`41 passed, 0 failed in 24.61s`** (`VERIFIED`).
4. **Post-Audit Repository Preservation Check:**
   - Zero existing files were modified, overwritten, or deleted during this audit. The only file added is `reports/FINAL_EVIDENCE_AUDIT_REPORT.md`.
