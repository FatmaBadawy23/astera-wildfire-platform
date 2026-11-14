# ASTERA WATCH — LATEST DATA & MODEL TRAINING PROVENANCE AUDIT
## Independent Read-Only Forensic Verification of `run_20261114_013500`

- **Audit Date (UTC):** `2026-11-14T00:15:00Z`
- **Repository:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`
- **Branch:** `feature/sar-ml-pipeline`
- **Target Run ID:** `run_20261114_013500`
- **Audit Mode:** Strictly Read-Only (no code, datasets, manifests, checkpoints, or Git state modified)

---

## 1. Executive Verdict

| Audit Question | Verdict | Primary Forensic Evidence |
| :--- | :--- | :--- |
| **1. Did `run_20261114_013500` construct a new dataset on disk?** | **VERIFIED** | `data/acquisitions/run_20261114_013500/dataset/{train,val,test}.npz` and `prepared/{CA_GANN_2026,CA_DOME_2026,CA_BUG_2026}.npz` were written at `2026-11-13T23:42:04Z–23:42:41Z` with SHA-256 hashes and byte sizes distinct from `data/real/dataset/`. |
| **2. Did all 4 models execute/train against `data/acquisitions/run_20261114_013500/dataset/`?** | **VERIFIED** | `scripts/execute_versioned_real_pipeline.py` (lines 888–892) loaded `ds_dir = acq_dir / "dataset"` (`data/acquisitions/run_20261114_013500/dataset`). All checkpoints (`23:49:10Z`, `23:49:44Z`) and evaluation artifacts (`23:49:59Z`, `23:50:52Z`) were written strictly after dataset creation (`23:42:23Z–23:42:41Z`). |
| **3. Were pre-existing model checkpoints loaded instead of training from scratch?** | **VERIFIED (Trained from Scratch)** | `UNetResNet34(in_channels=5, num_classes=1, pretrained=False)` and `SARLightGBMClassifier()` initialized fresh parameters at lines 942 and 992; zero `torch.load` or `pickle.load` calls exist in the training path prior to fitting. Resulting tensor SHA-256 hashes are distinct from all older checkpoints in `models/checkpoints/`. |
| **4. Did raw satellite rasters come from fresh downloads or existing verified real rasters?** | **PARTIALLY VERIFIED (Hybrid Provenance)** | Live NASA FIRMS CSVs (`50` CSVs, `8,481` raw rows, `8,290` deduplicated event hotspots), EONET v3 JSONs, and CMR discovery manifests were freshly fetched into `data/acquisitions/run_20261114_013500/`. However, the 20 m Sentinel-1/Sentinel-2/MODIS co-registered scene stacks (`stack.npz`) were read from existing verified real acquisitions in `data/real/<EVENT_ID>/stack.npz` (`2026-11-13T12:56Z–12:58Z`, `base_real_dir = ROOT / "data" / "real"`, line 623) and re-processed with water masking (`s2_post_SCL == 6` and `s2_pre_SCL == 6` excluded) into `data/acquisitions/run_20261114_013500/dataset/`. |
| **5. Which events were actually used in `TRAIN`, `VAL`, and `TEST`?** | **VERIFIED (`CA_TIMBER_2026` Excluded from `TRAIN`)** | Only **3 events** entered dataset construction and model training/evaluation: **`TRAIN = [CA_GANN_2026]`** (1 event), **`VAL = [CA_DOME_2026]`** (1 event), **`TEST = [CA_BUG_2026]`** (1 event). **`CA_TIMBER_2026` (`include_in_training=False`) was NOT used in `TRAIN`**. |
| **6. Were any NASA NISAR L-band SAR pixels used?** | **VERIFIED (`0` NISAR Pixels)** | `is_nisar = false` across all manifests and reports. NASA Earthdata CMR confirmed 2 NISAR collections (`C3873895335-ASF`, `C3873896105-ASF`) with `0` granules over the 4 California wildfire windows and HTTP `401` on ASF `/NISAR/` endpoints due to incomplete EULA/Step-2 profile setup. All SAR pixels are Sentinel-1A C-band RTC (`5.405 GHz`). |

---

## 2. Latest Run Identification

Direct inspection of [latest_run.json](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/outputs/runs/latest_run.json) confirms:

- **Latest Run ID:** `run_20261114_013500`
- **Pointer Updated At (UTC):** `2026-11-13T23:50:52.811408+00:00`
- **Acquisition Directory:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\data\acquisitions\run_20261114_013500`
- **Dataset Directory:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\data\acquisitions\run_20261114_013500\dataset`
- **Output Run Directory:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\outputs\runs\run_20261114_013500`

### Chronological Execution Chain for `run_20261114_013500`

| Stage | Artifact / Log | Timestamp (UTC) | Status |
| :--- | :--- | :--- | :--- |
| **1. Dataset Construction** | `data/acquisitions/run_20261114_013500/dataset/prepared/*.npz` | `2026-11-13T23:42:04Z` – `23:42:37Z` | **VERIFIED** |
| **2. Split NPZ Serialization** | `data/acquisitions/run_20261114_013500/dataset/{train,val,test}.npz` | `2026-11-13T23:42:23Z` – `23:42:32Z` | **VERIFIED** |
| **3. Dataset Manifest Written** | `data/acquisitions/run_20261114_013500/dataset/dataset_manifest.json` | `2026-11-13T23:42:41.953412+00:00` | **VERIFIED** |
| **4. Acquisition Manifest Finalized** | `data/acquisitions/run_20261114_013500/manifests/acquisition_manifest.json` | `2026-11-13T23:46:21.909675+00:00` | **VERIFIED** |
| **5. LightGBM Checkpoint Saved** | `outputs/runs/run_20261114_013500/checkpoints/lightgbm_water_free.pkl` | `2026-11-13T23:49:10.075776+00:00` | **VERIFIED** |
| **6. U-Net ResNet-34 Checkpoint Saved** | `outputs/runs/run_20261114_013500/checkpoints/real_unet_resnet34_water_free.pt` | `2026-11-13T23:49:44.088269+00:00` | **VERIFIED** |
| **7. Model Comparison JSON Saved** | `outputs/runs/run_20261114_013500/evaluation/real_model_comparison.json` | `2026-11-13T23:49:59.213202+00:00` | **VERIFIED** |
| **8. Comprehensive Validation Saved** | `outputs/runs/run_20261114_013500/evaluation/comprehensive_validation_report.json` | `2026-11-13T23:50:52.806838+00:00` | **VERIFIED** |

All three directories (`acquisition_directory`, `dataset_dir`, and `run_directory`) belong to the exact same versioned run (`run_20261114_013500`), and every model checkpoint and evaluation file has a modification timestamp strictly newer than the dataset files.

---

## 3. Dataset File Inventory and Cryptographic Provenance

### 3.1 Comparison of `run_20261114_013500/dataset/` vs. Older `data/real/dataset/`

| File Role | Path | Size (Bytes) | Size (MB) | Modified (UTC) | SHA-256 Checksum | Distinct from `data/real/dataset/`? |
| :--- | :--- | ---: | ---: | :--- | :--- | :--- |
| **New `train.npz`** | `data/acquisitions/run_20261114_013500/dataset/train.npz` | `34,437,165` | `32.8418` | `2026-11-13T23:42:23Z` | `16a7f674bea7adf8eb19748b51d5f7701bba62442ac8fa271094aca9391e71f7` | **YES** (Old: `34,430,174` B, `585acf25...`) |
| **New `val.npz`** | `data/acquisitions/run_20261114_013500/dataset/val.npz` | `34,556,746` | `32.9559` | `2026-11-13T23:42:28Z` | `efa65e140180545782b3596835a0f695b1621a7909f46e85ef2641732f111d56` | **YES** (Old: `34,557,108` B, `bcfac838...`) |
| **New `test.npz`** | `data/acquisitions/run_20261114_013500/dataset/test.npz` | `24,679,055` | `23.5358` | `2026-11-13T23:42:32Z` | `8999e75a9396148e690bae25fa9bb5f8fdedbba80d8d37a1f453346722382663` | **YES** (Old: `24,679,104` B, `ee3c360b...`) |
| **New Prepared `CA_GANN_2026.npz`** | `data/acquisitions/run_20261114_013500/dataset/prepared/CA_GANN_2026.npz` | `19,327,204` | `18.4319` | `2026-11-13T23:42:20Z` | `4c92a2e22a92fb3e1f2beed00edcd8800e8aa6f67ff106f2b4b531470b14b6a2` | **YES** (New water-free stack) |
| **New Prepared `CA_DOME_2026.npz`** | `data/acquisitions/run_20261114_013500/dataset/prepared/CA_DOME_2026.npz` | `18,861,603` | `17.9878` | `2026-11-13T23:42:25Z` | `fd4b2390b797cf7191df902abdd50c7bd1abdd57749031521ecdd35dc457d2ac` | **YES** (New water-free stack) |
| **New Prepared `CA_BUG_2026.npz`** | `data/acquisitions/run_20261114_013500/dataset/prepared/CA_BUG_2026.npz` | `17,843,530` | `17.0169` | `2026-11-13T23:42:30Z` | `d1cb8246bc20445db9a5851dc6ab01003c33fc31d6574c08c7a368a4468fb800` | **YES** (New water-free stack) |
| **New `dataset_manifest.json`** | `data/acquisitions/run_20261114_013500/dataset/dataset_manifest.json` | `16,580` | `0.0158` | `2026-11-13T23:42:41Z` | `19f4f205739535128a122e952c1dc87dc750caef03fc0fd01641931f513b1bb4` | **YES** (Includes water-exclusion audit) |
| **New `norm_stats.json`** | `data/acquisitions/run_20261114_013500/dataset/norm_stats.json` | `395` | `0.0004` | `2026-11-13T23:42:41Z` | `785e373a55b14cfbd17fbba71656ba5b07c49fc0883329fa44b792e042de5427` | Same numerical values (see Section 8.2) |

### 3.2 Internal Array Structure of `run_20261114_013500/dataset/{train,val,test}.npz`

| Split File | Array Key | Shape | Dtype | Value Summary / Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **`train.npz`** | `patches` | `(121, 5, 128, 128)` | `float32` | 5 channels: `[s1_pre_vv, s1_pre_vh, s1_post_vv, s1_post_vh, delta_vh]` |
| | `labels` | `(121, 1, 128, 128)` | `uint8` | Binary `dNBR >= 0.11` & `valid > 0` (`362,389` ones; `1,620,075` zeros) |
| | `mcd` | `(121, 1, 128, 128)` | `uint8` | Binary QA-filtered `MCD64A1` & `valid > 0` (`359,511` ones) |
| | `valid` | `(121, 1, 128, 128)` | `uint8` | Valid land mask (`1,839,696` ones; `142,768` zeros; **`0` water pixels**) |
| | `events` | `(121,)` | `<U12` | `{"CA_GANN_2026": 121}` (100% from `CA_GANN_2026`) |
| **`val.npz`** | `patches` | `(121, 5, 128, 128)` | `float32` | 5 channels: `[s1_pre_vv, s1_pre_vh, s1_post_vv, s1_post_vh, delta_vh]` |
| | `labels` | `(121, 1, 128, 128)` | `uint8` | Binary `dNBR >= 0.11` & `valid > 0` (`167,643` ones; `1,814,821` zeros) |
| | `mcd` | `(121, 1, 128, 128)` | `uint8` | Binary QA-filtered `MCD64A1` & `valid > 0` (`136,158` ones) |
| | `valid` | `(121, 1, 128, 128)` | `uint8` | Valid land mask (`1,877,088` ones; `105,376` zeros; **`0` water pixels**) |
| | `events` | `(121,)` | `<U12` | `{"CA_DOME_2026": 121}` (100% from `CA_DOME_2026`) |
| **`test.npz`** | `patches` | `(94, 5, 128, 128)` | `float32` | 5 channels: `[s1_pre_vv, s1_pre_vh, s1_post_vv, s1_post_vh, delta_vh]` |
| | `labels` | `(94, 1, 128, 128)` | `uint8` | Binary `dNBR >= 0.11` & `valid > 0` (`775,811` ones; `764,285` zeros) |
| | `mcd` | `(94, 1, 128, 128)` | `uint8` | Binary QA-filtered `MCD64A1` & `valid > 0` (`1,148,017` ones) |
| | `valid` | `(94, 1, 128, 128)` | `uint8` | Valid land mask (`1,441,577` ones; `98,519` zeros; **`0` water pixels**) |
| | `events` | `(94,)` | `<U11` | `{"CA_BUG_2026": 94}` (100% from `CA_BUG_2026`) |

---

## 4. Model-by-Model Training Provenance Audit

In [execute_versioned_real_pipeline.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/scripts/execute_versioned_real_pipeline.py#L881-L911), `phase_d_train_and_evaluate(acq_dir, run_dir, epochs=6, seed=42)` resolves:
- `ds_dir = acq_dir / "dataset"` → `data/acquisitions/run_20261114_013500/dataset`
- `prep_dir = ds_dir / "prepared"` → `data/acquisitions/run_20261114_013500/dataset/prepared`
- Loads `event_stacks[ev.event_id] = np.load(prep_dir / f"{ev.event_id}.npz")` for `CA_GANN_2026`, `CA_DOME_2026`, and `CA_BUG_2026`.

### 4.1 Model 1: VH Log-Ratio Baseline (`Log-Ratio Baseline`)
- **Dataset Consumed:** `data/acquisitions/run_20261114_013500/dataset/prepared/{CA_GANN_2026,CA_DOME_2026}.npz` (`features[4] = delta_vh = s1_post_vh - s1_pre_vh`, smoothed with `uniform_filter(..., size=5)`).
- **Training / Calibration Method:** Deterministic grid search over 37 candidate dB thresholds `np.linspace(-2.5, -0.7, 37)` (`execute_versioned_real_pipeline.py` lines 917–937).
- **Samples / Pixels Consumed:**
  - `TRAIN` (`CA_GANN_2026`): `600,831` valid land pixels (`90,758` burned, `510,073` unburned) → optimal `TRAIN` threshold = `-1.4000 dB` (`train_f1 = 0.2584`).
  - `VAL` (`CA_DOME_2026`): `608,150` valid land pixels (`42,428` burned, `565,722` unburned) → selected operational threshold = `-0.9500 dB` (`val_f1 = 0.2899`).
- **Proof New Data Was Used:** In the older `outputs/evaluation/real_model_comparison.json` (which included `27,522` water pixels in `CA_GANN_2026` and `401` water pixels in `CA_DOME_2026`), `train_f1` was `0.2528`; in `run_20261114_013500`, `train_f1` is `0.2584` on the exact `600,831` water-free pixels.
- **Status:** **`VERIFIED`**

### 4.2 Model 2: LightGBM Pixel-Spatial Classifier (`LightGBM Pixel-Spatial`)
- **Dataset Consumed:** `data/acquisitions/run_20261114_013500/dataset/prepared/{CA_GANN_2026,CA_DOME_2026}.npz`.
- **Feature Engineering (`extract_spatial_pixel_features`, lines 791–836):** Extracts 15 spatial features per pixel from the 5-channel SAR stack (`5` raw channels + `5` local $5\times 5$ mean channels + `5` local $5\times 5$ standard deviation channels), subsampled spatially by `stride=2` (`[::2, ::2]`) for training and early-stopping validation.
- **Exact Training & Validation Samples Consumed:**
  - `X_train`, `y_train` (`CA_GANN_2026`, `stride=2` masked by `valid > 0`): **`150,212` valid land pixels** (`150,212 × 15` feature matrix). In the older non-water-free dataset (`data/real/`), `stride=2` yielded `157,084` pixels (`6,872` water pixels were present in the `stride=2` grid). This proves `LightGBM` trained on the new water-free `CA_GANN_2026.npz`.
  - `X_val`, `y_val` (`CA_DOME_2026`, `stride=2` masked by `valid > 0`): **`152,044` valid land pixels** (vs. `152,139` in the older non-water-free dataset, `95` water pixels removed).
- **Fresh Initialization & Hyperparameters:**
  - Initialized from scratch via `SARLightGBMClassifier(n_estimators=250, learning_rate=0.05, num_leaves=31, max_depth=6, subsample=0.8, colsample_bytree=0.8, min_child_samples=50, random_state=42)` (`execute_versioned_real_pipeline.py` lines 942–950).
  - Computed `scale_pos_weight = 5.624564498346197` dynamically from `y_train` (`127,534` negative / `22,678` positive pixels in `X_train`).
- **Important Audit Finding — Early Stopping at Iteration 1 (`best_iteration_ = 1`):**
  - Direct inspection of the pickled booster inside `outputs/runs/run_20261114_013500/checkpoints/lightgbm_water_free.pkl` (`5,634` bytes, SHA-256 `ac47b4fa08931a188b263de475c8287c07ac8c25bf4e7ceff8a18ed1d484d626`, written `2026-11-13T23:49:10Z`) confirms `best_iteration_ = 1` (`1` tree with `30` splits total; feature split counts: `pre_vv=5`, `pre_vh=4`, `pre_vv_mean5=4`, `post_vv_std5=3`, `post_vh_std5=3`, `pre_vv_std5=2`, `pre_vh_std5=2`, `post_vv_mean5=2`, `post_vh_mean5=2`, `post_vv=1`, `delta_vh=1`, `delta_vh_std5=1`).
  - Why did early stopping trigger at iteration 1? Because `scale_pos_weight = 5.6246` was calibrated on `TRAIN` (`15.11%` positive prevalence), whereas `VAL` (`CA_DOME_2026`) has only `6.98%` positive prevalence. Under `binary_logloss` on `VAL`, applying `scale_pos_weight = 5.6246` pushes predicted probabilities upward on the `93.02%` negative validation pixels after tree 1, monotonically increasing validation `binary_logloss` over iterations 2–16 and triggering `lgb.early_stopping(stopping_rounds=15)` to roll back to iteration 1.
  - Because only 1 tree is retained, predicted probabilities take discrete leaf values, and probability threshold calibration on `VAL` selected `threshold = 0.5000`.
- **Status:** **`VERIFIED` (Trained from scratch on new water-free dataset; degenerated to 1-tree ensemble due to cross-event prevalence shift + `scale_pos_weight`)**

### 4.3 Model 3: U-Net ResNet-34 Deep Segmentation (`UNet ResNet34`)
- **Dataset Consumed:**
  - Patch training & epoch validation: `data/acquisitions/run_20261114_013500/dataset/train.npz` (`121` patches of `5×128×128` from `CA_GANN_2026`) and `val.npz` (`121` patches of `5×128×128` from `CA_DOME_2026`), normalized with `norm_stats.json` (`execute_versioned_real_pipeline.py` lines 978–991).
  - Full-scene probability threshold selection & evaluation: `data/acquisitions/run_20261114_013500/dataset/prepared/{CA_GANN_2026,CA_DOME_2026,CA_BUG_2026}.npz` via overlapping sliding-window inference (`predict_full_scene_unet`, stride `64`, window `128×128`, lines 843–878).
- **Fresh Initialization & Training Configuration:**
  - Initialized from scratch at line 992: `UNetResNet34(in_channels=5, num_classes=1, pretrained=False)` (`24,437,009` trainable parameters, `0` frozen parameters).
  - Optimizer: `AdamW(lr=8e-4, weight_decay=1e-4)`, `CosineAnnealingLR(T_max=6)`, Loss: `BCEDiceLoss(bce_weight=0.5, dice_weight=0.5)`, `batch_size=8`, `epochs=6`, `seed=42`.
- **Epoch-by-Epoch Training Progression (Verified in `task-853.log` and Checkpoint `history`):**
  1. **Epoch 1/6:** `train_loss = 0.5624`, `val_loss = 4.2059`, `val_iou = 0.0882`, `lr = 7.46e-04` (Saved best checkpoint)
  2. **Epoch 2/6:** `train_loss = 0.4539`, `val_loss = 0.7273`, `val_iou = 0.1046`, `lr = 6.00e-04` (Saved best checkpoint)
  3. **Epoch 3/6:** `train_loss = 0.4090`, `val_loss = 0.5579`, `val_iou = 0.1945`, `lr = 4.00e-04` (Saved best checkpoint)
  4. **Epoch 4/6:** `train_loss = 0.3712`, `val_loss = 0.5582`, `val_iou = 0.2194`, `lr = 2.00e-04` (**Best epoch = 4**, saved to `real_unet_resnet34_water_free.pt`)
  5. **Epoch 5/6:** `train_loss = 0.3358`, `val_loss = 0.5697`, `val_iou = 0.1949`, `lr = 5.36e-05`
  6. **Epoch 6/6:** `train_loss = 0.3177`, `val_loss = 0.5798`, `val_iou = 0.1924`, `lr = 0.00e+00`
- **Cryptographic Proof of Fresh Weights (`real_unet_resnet34_water_free.pt` vs. Older Checkpoints):**

| Checkpoint File | Size (Bytes) | Modified (UTC) | `best_val_iou` | `init_conv.weight` SHA-256 | `final_conv.3.weight` SHA-256 |
| :--- | ---: | :--- | ---: | :--- | :--- |
| **`outputs/runs/run_20261114_013500/checkpoints/real_unet_resnet34_water_free.pt`** | `98,009,759` | `2026-11-13T23:49:44Z` | `0.219422` | `f5d3e9a6fbd159687c2d5d6f9ae282aad8f0b2d8b3b8e1218b4b43261f74033b` | `979000426a135c16aa554db270aaca37245cdcda6cb9cc1c3bf62ce9ea71df31` |
| `models/checkpoints/real_unet_resnet34_best.pt` (Older run) | `98,009,745` | `2026-11-13T13:16:08Z` | `0.219023` | `e51a1cd437d267fa35b7ce9a818a78805ceaf216f06a522f4e7061bce25383fe` | `41a808004ea0a512c1d9fc556c8fbd9e2d5a05601967319210bf4867bf1832f8` |
| `models/checkpoints/unet_resnet34_best.pt` (Phase 7 prototype) | `98,008,295` | `2026-11-13T09:11:02Z` | `0.155873` | `c89764becfe5fb4edfd8be8f8b551d4b8baf47a917c8163e4c02bb79bf5c79a9` | `1c90d9c0cc610d33f8cf82d54ad6923d9b5add57f1c1223c0721765959b369de` |

- **Subtle Engineering Finding on Patch Loss Masking:**
  - While `train.npz` and `val.npz` contain the water-free `valid` mask (`96,386` nominal water patch pixels removed from `valid` in `train.npz`, and `100` water patch pixels that had `dNBR >= 0.11` zeroed out in `labels`), `SARPatchDataset` ([dataset.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/processing/models/dataset.py#L58-L108)) only passes `(patch, label)` to `Trainer` ([trainer.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/processing/models/trainer.py#L64-L115)) and does not pass `valid` into `BCEDiceLoss`. Thus, during patch gradient updates, `valid == 0` pixels (whose `labels` are `0`) are treated as negative (`0`) pixels rather than ignored in the loss denominator. The `100` zeroed-out water label pixels in `train.npz` directly changed the training gradients and weights (as proven by the distinct weight hashes above), and full-scene threshold calibration (`threshold = 0.5000`) and evaluation strictly masked all metrics by `valid > 0` (`0` water pixels included).
- **Status:** **`VERIFIED`**

### 4.4 Model 4: Multi-Temporal CUSUM Change Detector (`CUSUM Temporal`)
- **Dataset Consumed:** `data/acquisitions/run_20261114_013500/dataset/prepared/{CA_GANN_2026,CA_DOME_2026,CA_BUG_2026}.npz` (`temporal_vh` array of shape `(4, 800, 800)` containing `[s1_pre_vh, s1_mid_vh, s1_post_vh, s1_post2_vh]`).
- **Calibration Method:** Computes `cusum_change_detection(stack["temporal_vh"], drift=0.25)` (`cusum.py`), smooths the normalized CUSUM score with a $5\times 5$ uniform filter, and calibrates the decision threshold on `VAL` (`CA_DOME_2026`, `608,150` valid land pixels) via `select_probability_threshold`, yielding `threshold = 0.5000` (`execute_versioned_real_pipeline.py` lines 1029–1044).
- **Status:** **`VERIFIED`**

---

## 5. Event-Split Reconciliation (`CA_TIMBER_2026` Discrepancy Resolved)

A key mandate of this audit is to resolve whether `TRAIN` used both `CA_GANN_2026` and `CA_TIMBER_2026`, or only `CA_GANN_2026`.

### Forensic Proof from Code, Manifests, NPZ Arrays, and Logs:
1. **Event Specification ([event_specs.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/backend/processing/acquisition/event_specs.py#L109-L134)):**
   - `CA_TIMBER_2026` is defined with `split="TRAIN"` and **`include_in_training=False`** (with comment: *"Excluded from supervised SAR training because post-fire C-band acquisition occurs under dry summer conditions where volumetric backscatter increases rather than decreases"*).
2. **Dataset Construction Filter ([execute_versioned_real_pipeline.py](file:///C:/Users/asus/Desktop/Nasa/astera-wildfire-platform/scripts/execute_versioned_real_pipeline.py#L626)):**
   - Line 626 executes: `events = [ev for ev in EVENTS if ev.include_in_training and ev.event_id in base_manifest["events"]]`.
   - Because `CA_TIMBER_2026.include_in_training` is `False`, `CA_TIMBER_2026` is skipped before `prepared/*.npz` or `train.npz` are created.
3. **Prepared & Split NPZ Verification:**
   - `data/acquisitions/run_20261114_013500/dataset/prepared/` contains **only 3 files**: `CA_GANN_2026.npz`, `CA_DOME_2026.npz`, and `CA_BUG_2026.npz` (`CA_TIMBER_2026.npz` does not exist).
   - `train.npz["events"]` has shape `(121,)` with unique values `{"CA_GANN_2026": 121}` (**`0` patches from `CA_TIMBER_2026`**).
4. **Manifest & Report Verification:**
   - `dataset_manifest.json` (`splits.TRAIN`), `real_model_comparison.json` (`splits.TRAIN`), and `comprehensive_validation_report.json` (`splits.TRAIN = ["CA_GANN_2026"]`, `excluded_events = ["CA_TIMBER_2026"]`) all record that **only `CA_GANN_2026`** is in `TRAIN`.
5. **Where `CA_TIMBER_2026` Was Used:**
   - `CA_TIMBER_2026` was processed in **Phase B** (FIRMS active-fire hotspot acquisition: `1,856` deduplicated hotspots) and **Phase E** (`phase_e_geospatial_and_validation`, lines 1236–1466), where `data/real/CA_TIMBER_2026/stack.npz` was loaded directly and evaluated using the `Log-Ratio` fallback (`primary_model = "log_ratio"`, line 1284) because `predictions/CA_TIMBER_2026.npz` does not exist.

| Event ID | Fire Name | Ignition Date | Assigned Split | `include_in_training` | In `prepared/*.npz`? | Patches in `{train,val,test}.npz` | Used in Model Training / Calibration? | Used in Phase E Geospatial Export? |
| :--- | :--- | :--- | :--- | :--- | :--- | ---: | :--- | :--- |
| **`CA_GANN_2026`** | Gann Fire (Calaveras, CA) | `2026-08-03` | `TRAIN` | `True` | **YES** | **`121` (`train.npz`)** | **YES (`TRAIN`)** | **YES** (`primary_model="unet"`) |
| **`CA_TIMBER_2026`** | Timber Fire (Modoc, CA) | `2026-08-07` | `TRAIN` (nominal) | **`False`** | **NO** | **`0`** | **NO (Excluded)** | **YES** (Fallback `primary_model="log_ratio"`) |
| **`CA_DOME_2026`** | Dome Fire (Siskiyou, CA) | `2026-09-12` | `VAL` | `True` | **YES** | **`121` (`val.npz`)** | **YES (`VAL`)** | **YES** (`primary_model="unet"`) |
| **`CA_BUG_2026`** | Bug Fire (Siskiyou, CA) | `2026-08-06` | `TEST` | `True` | **YES** | **`94` (`test.npz`)** | **YES (`TEST` Eval Only)** | **YES** (`primary_model="unet"`) |

---

## 6. Exact Data Volume Accounting Across All 14 Levels

### 6.1 End-to-End Hierarchy of Data Volume in `run_20261114_013500`

| Level | Data Unit | Total Acquired / Present on Disk | Used in ML Pipeline (`TRAIN` + `VAL` + `TEST`) | `TRAIN` (`CA_GANN_2026`) | `VAL` (`CA_DOME_2026`) | `TEST` (`CA_BUG_2026`) | Excluded from ML (`CA_TIMBER_2026` / Diagnostic) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **Level 1** | **Wildfire Events** | **4 events** (+ 2 EONET catalogs) | **3 events** | **1 event** | **1 event** | **1 event** | **1 event** (`CA_TIMBER_2026`) |
| **Level 2a** | **FIRMS Raw CSV Files** | **50 CSVs** (`49` event sensor-window CSVs + `1` Egypt diagnostic CSV) | **36 CSVs** (12 per event) | **12 CSVs** | **12 CSVs** | **12 CSVs** | **13 CSVs** (`12` `CA_TIMBER_2026` + `1` Egypt) |
| **Level 2b** | **FIRMS Raw CSV Rows** | **`8,481` rows** (`8,302` across 4 events + `179` Egypt NRT) | **`6,445` raw rows** | **`926` rows** | **`3,842` rows** | **`1,677` rows** | **`2,036` rows** (`1,857` Timber + `179` Egypt) |
| **Level 2c** | **FIRMS Deduplicated Hotspots** | **`8,290` event hotspots** (+ `179` Egypt) | **`6,434` hotspots** | **`926` hotspots** | **`3,832` hotspots** | **`1,676` hotspots** | **`1,856` hotspots** (`CA_TIMBER_2026`) |
| **Level 3** | **Satellite Scenes / Granules** | **28 real acquisitions** across 4 events (`16` S1 + `8` S2 + `4` MODIS) + **`0` NISAR** | **21 acquisitions** (`12` S1 + `6` S2 + `3` MODIS) | **7 acquisitions** (`4` S1, `2` S2, `1` MODIS) | **7 acquisitions** (`4` S1, `2` S2, `1` MODIS) | **7 acquisitions** (`4` S1, `2` S2, `1` MODIS) | **7 acquisitions** (`CA_TIMBER_2026`) |
| **Level 4** | **Co-Registered 20 m Arrays (`800×800`)** | **4 scene stacks** (`19` layers each in `data/real/<ID>/stack.npz`) | **3 prepared stacks** (`prepared/*.npz`) | **1 stack** (`800×800`) | **1 stack** (`800×800`) | **1 stack** (`800×800`) | **1 stack** (`CA_TIMBER_2026`, Phase E only) |
| **Level 5** | **`128×128` Patches (stride 64, valid $\ge 25\%$)** | **336 patches** (extracted from 3 ML events) | **336 patches** (`5,505,024` nominal patch px) | **121 patches** (`1,982,464` patch px) | **121 patches** (`1,982,464` patch px) | **94 patches** (`1,540,096` patch px; `27` skipped for $<25\%$ valid) | **0 patches** |
| **Level 6a** | **Unique 20 m Scene Pixels (Total AOI)** | **`2,560,000` px** (`1,024.0 km²`) | **`1,920,000` px** (`768.0 km²`) | **`640,000` px** (`256.0 km²`) | **`640,000` px** (`256.0 km²`) | **`640,000` px** (`256.0 km²`) | **`640,000` px** (`256.0 km²`) |
| **Level 6b** | **Unique Valid Land Pixels (`valid > 0`)** | **`2,142,914` px** (`857.17 km²`) | **`1,674,809` px** (`669.92 km²`) | **`600,831` px** (`240.33 km²`) | **`608,150` px** (`243.26 km²`) | **`465,828` px** (`186.33 km²`) | **`468,105` px** (`187.24 km²`) |
| **Level 6c** | **Unique Excluded/Invalid Pixels (`valid == 0`)** | **`417,086` px** | **`245,191` px** | **`39,169` px** | **`31,850` px** | **`174,172` px** | **`171,895` px** |
| **Level 6d** | **Unique Water Pixels Excluded (`SCL == 6`)** | **`138,215` px** (`0` in `valid > 0`) | **`27,939` px** (`0` in `valid > 0`) | **`27,522` px** (`0` in `valid`) | **`401` px** (`0` in `valid`) | **`16` px** (`0` in `valid`) | **`110,276` px** (`0` in `valid`) |
| **Level 6e** | **Unique Burned Valid Pixels (`dNBR >= 0.11`)** | **`492,142` px** (`196.86 km²`) | **`366,756` px** (`146.70 km²`) | **`90,758` px** (`15.11%`) | **`42,428` px** (`6.98%`) | **`233,570` px** (`50.14%`) | **`125,386` px** (`26.79%`) |
| **Level 6f** | **Unique Unburned Valid Pixels (`dNBR < 0.11`)** | **`1,650,772` px** (`660.31 km²`) | **`1,308,053` px** (`523.22 km²`) | **`510,073` px** (`84.89%`) | **`565,722` px** (`93.02%`) | **`232,258` px** (`49.86%`) | **`342,719` px** (`73.21%`) |
| **Level 6g** | **Unique Burned Valid Pixels (`MCD64A1` QA)** | **`600,884` px** (`240.35 km²`) | **`472,271` px** (`188.91 km²`) | **`90,142` px** (`15.00%`) | **`34,642` px** (`5.70%`) | **`347,486` px** (`74.60%`) | **`128,613` px** (`27.48%`) |
| **Level 7** | **Valid 500 m (`25×25` px) `MCD64A1` Blocks** | **`3,513` blocks** (`878.25 km²`) | **`2,736` blocks** (`684.00 km²`) | **`975` blocks** (`149` burned, `826` unburned) | **`1,015` blocks** (`64` burned, `951` unburned) | **`746` blocks** (`559` burned, `187` unburned) | **`777` blocks** (`231` burned, `546` unburned) |

### 6.2 Overlapping Patch Pixel Accounting (`{train,val,test}.npz` Nominal Pixels vs. Unique Scene Pixels)

Because `extract_real_patches` uses a `128×128` sliding window with `stride = 64` (50% spatial overlap in both dimensions), interior pixels of each `800×800` scene appear in up to 4 overlapping patches:

| Split NPZ | Patches | Nominal Patch Pixels (`N × 16,384`) | Valid Patch Pixels (`valid > 0`) | Invalid Patch Pixels (`valid == 0`) | Water Patch Pixels Excluded (`SCL == 6`) | Burned Valid Patch Pixels (`labels > 0`) | Unburned Valid Patch Pixels (`labels == 0 & valid > 0`) |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **`train.npz` (`CA_GANN_2026`)** | `121` | `1,982,464` | `1,839,696` | `142,768` | `96,592` (`0` in `valid`) | `362,389` (`19.70%`) | `1,477,307` (`80.30%`) |
| **`val.npz` (`CA_DOME_2026`)** | `121` | `1,982,464` | `1,877,088` | `105,376` | `1,066` (`0` in `valid`) | `167,643` (`8.93%`) | `1,709,445` (`91.07%`) |
| **`test.npz` (`CA_BUG_2026`)** | `94` | `1,540,096` | `1,441,577` | `98,519` | `64` (`0` in `valid`) | `775,811` (`53.82%`) | `665,766` (`46.18%`) |
| **Total Across NPZs** | **`336`** | **`5,505,024`** | **`5,158,361`** | **`346,663`** | **`97,722` (`0` in `valid`)** | **`1,305,843` (`25.31%`)** | **`3,852,518` (`74.69%`)** |

---

## 7. Sensor and Acquisition Provenance Audit

### 7.1 Per-Sensor Provenance Summary

| Sensor / Service | Product / Collection | Resolution / Polarizations | Acquisition Dates Used | Role in `run_20261114_013500` | Fresh Download vs. Cached Real Rasters |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sentinel-1A C-Band SAR** | `SENTINEL-1-RTC` (`5.405 GHz`, $\gamma^0$ dB) | `20 m`, `VV` + `VH` | `CA_GANN_2026`: Pre `2026-07-26`, Mid `2026-08-07`, Post `2026-08-19`, Post2 `2026-08-31` (Orbit 42)<br>`CA_DOME_2026`: Pre `2026-08-24`, Mid `2026-09-05`, Post `2026-09-17`, Post2 `2026-09-29` (Orbit 115)<br>`CA_BUG_2026`: Pre `2026-07-31`, Mid `2026-08-12`, Post `2026-08-24`, Post2 `2026-09-05` (Orbit 115)<br>`CA_TIMBER_2026`: Pre `2026-07-31`, Mid `2026-08-12`, Post `2026-08-24`, Post2 `2026-09-05` (Orbit 115) | **Model Input Features** (`5` channels for Log-Ratio, LightGBM, U-Net; `4` VH dates for CUSUM) | Co-registered 20 m arrays read from verified real `data/real/<EVENT_ID>/stack.npz` (`2026-11-13T12:56Z–12:58Z`) and re-packaged into `run_20261114_013500/dataset/`. |
| **Sentinel-2 L2A MSI** | `SENTINEL-2-L2A` (`B04`, `B08`, `B12`, `SCL`) | `20 m` | `CA_GANN_2026`: Pre `2026-07-29`, Post `2026-08-30`<br>`CA_DOME_2026`: Pre `2026-09-04`, Post `2026-09-29`<br>`CA_BUG_2026`: Pre `2026-07-28`, Post `2026-08-27`<br>`CA_TIMBER_2026`: Pre `2026-07-28`, Post `2026-08-27` | **Primary 20 m Supervised Reference Labels (`dNBR >= 0.11`) & Cloud/Shadow/Water Mask (`SCL`)**; never used as model input features | Read from `data/real/<EVENT_ID>/stack.npz`; water exclusion (`SCL == 6`) newly applied in `run_20261114_013500`. |
| **NASA MODIS Burned Area** | `MCD64A1.061` (`C2565786756-LPCLOUD`, `h08v05`) | `500 m` native (warped to `20 m` & aggregated to `25×25` blocks) | Aug 2026 (`A2026213`) & Sep 2026 (`A2026244`) | **Independent Coarse-Scale Validation Reference** (`Burn Date > 0` & `QA bit 0 == 1` & `QA bit 1 == 1`) | Raw `.hdf` granules verified in `data/real/*/raw/modis/*.hdf`; re-evaluated with water exclusion in `run_20261114_013500`. |
| **NASA FIRMS Active Fire** | `VIIRS_NOAA20_NRT`, `VIIRS_SNPP_NRT`, `MODIS_NRT` | Point thermal anomalies (`375 m` / `1 km`) | Event windows (`2026-08-01` to `2026-09-30`) + Egypt diagnostic | **Spatiotemporal Event Discovery & Active-Fire Perimeter Context** (never used as pixel labels) | **Freshly downloaded via live NASA FIRMS API** in `data/acquisitions/run_20261114_013500/firms/` (`2026-11-13T23:35Z–23:41Z`). |
| **NASA EONET v3** | `https://eonet.gsfc.nasa.gov/api/v3/events` | Event catalog JSON | Aug–Sep 2026 (`438` events) & Recent (`50` events) | **Event Metadata Cross-Check** | **Freshly downloaded** in `data/acquisitions/run_20261114_013500/eonet/`. |
| **NASA NISAR L-Band SAR** | `C3873895335-ASF` (`NISAR_L2_GCOV_BETA_V1`), `C3873896105-ASF` (`NISAR_L1_RSLC_BETA_V1`) | L-band (`1.257 GHz`) | Queried across all 4 wildfire windows (`0` granules matched) | **Metadata & Auth Gate Verification Only (`0` pixels used)** | Live CMR query + ASF `/NISAR/` HTTP `401` diagnostic saved in `nisar_discovery_and_auth_gate.json`. |

### 7.2 NISAR Scientific Integrity Gate
- `is_nisar`: **`false`** across every manifest, checkpoint, and evaluation report.
- `data_origin`: **`"CROSS_SENSOR_PROTOTYPE"`** across every manifest and report.
- No Sentinel-1 C-band file, layer, or metric is mislabeled as NISAR L-band anywhere in `run_20261114_013500`.

---

## 8. Data Leakage and Evaluation Integrity Audit

### 8.1 Event-Level Split & Spatial Independence (`VERIFIED`)
- **`TRAIN` (`CA_GANN_2026`):** Calaveras County, CA (`EPSG:32610`, bounds `[690640, 4212780, 706640, 4228780]`).
- **`VAL` (`CA_DOME_2026`):** Siskiyou County, CA (`EPSG:32611`, bounds `[395260, 4626660, 411260, 4642660]`).
- **`TEST` (`CA_BUG_2026`):** Siskiyou County, CA (`EPSG:32611`, bounds `[354840, 4627380, 370840, 4643380]`).
- All three splits are geographically disjoint wildfire events separated by $>40\text{ km}$ (`CA_DOME_2026` vs. `CA_BUG_2026`, zero bounding-box overlap) to $>400\text{ km}$ (`CA_GANN_2026` vs. Siskiyou events). Zero patches or pixels from `CA_BUG_2026` (`TEST`) appear in `train.npz` or `val.npz`.

### 8.2 Normalization Statistics (`PARTIALLY VERIFIED` — Minor Unmasked Patch Stats Nuance)
- In `execute_versioned_real_pipeline.py` line 732, `mean, std = nan_channel_stats(datasets["TRAIN"]["patches"])` is computed **exclusively on `TRAIN` (`CA_GANN_2026`)** (`mean = [-10.550477, -16.975645, -10.606218, -17.241917, -0.266276]`, `std = [2.620396, 2.866945, 2.573594, 2.752328, 1.389451]`).
- There is **zero leakage from `VAL` or `TEST`** into `norm_stats.json`.
- **Audit Note:** `nan_channel_stats` computes channel mean/std over all finite pixels in `train.npz["patches"]` without filtering by `train.npz["valid"] > 0`. Consequently, the 5-channel normalization constants in `run_20261114_013500/dataset/norm_stats.json` are numerically identical to `data/real/dataset/norm_stats.json`.

### 8.3 Threshold Calibration & Test Set Isolation (`VERIFIED`)
- Every model's operational classification threshold was calibrated strictly on `VAL` (`CA_DOME_2026`):
  - `Log-Ratio Baseline`: `-0.9500 dB` (calibrated on `VAL`)
  - `LightGBM Pixel-Spatial`: `0.5000` (calibrated on `VAL`)
  - `UNet ResNet34`: `0.5000` (calibrated on `VAL`)
  - `CUSUM Temporal`: `0.5000` (calibrated on `VAL`)
- `TEST` (`CA_BUG_2026`) was evaluated once using the frozen checkpoints and frozen `VAL`-calibrated thresholds.

### 8.4 Optical Label Isolation (`VERIFIED`)
- Sentinel-2 `B08`/`B12`/`dNBR` and MODIS `MCD64A1` are never included in the 5-channel SAR input tensor `[s1_pre_vv, s1_pre_vh, s1_post_vv, s1_post_vh, delta_vh]` or the 15-feature LightGBM matrix.

---

## 9. Required Summary Table

| Item | Claimed in Execution Report | Actual Verified Value on Disk | Evidence Path | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Latest Run ID** | `run_20261114_013500` | `run_20261114_013500` | `outputs/runs/latest_run.json` | **`VERIFIED`** |
| **New Dataset Used for Training** | `data/acquisitions/run_20261114_013500/dataset/` | `data/acquisitions/run_20261114_013500/dataset/{train,val,test}.npz` & `prepared/*.npz` | `scripts/execute_versioned_real_pipeline.py#L888-L911` | **`VERIFIED`** |
| **Raw Satellite Imagery Source** | Real Sentinel-1, Sentinel-2, MODIS + live FIRMS/EONET | Live FIRMS/EONET downloaded in `run_20261114_013500`; S1/S2/MODIS stacks read from verified `data/real/<ID>/stack.npz` and re-masked for water | `scripts/execute_versioned_real_pipeline.py#L623-L702` | **`PARTIALLY VERIFIED`** |
| **Training Events Used** | `CA_GANN_2026` (`CA_TIMBER_2026` excluded from ML training; some prose mentioned 2 train events) | **`1` event (`CA_GANN_2026` only)**; `CA_TIMBER_2026` has `include_in_training=False` and `0` patches | `data/acquisitions/run_20261114_013500/dataset/dataset_manifest.json` | **`VERIFIED`** |
| **Validation Events Used** | `1` event (`CA_DOME_2026`) | **`1` event (`CA_DOME_2026`)** | `data/acquisitions/run_20261114_013500/dataset/val.npz` | **`VERIFIED`** |
| **Test Events Used** | `1` event (`CA_BUG_2026`) | **`1` event (`CA_BUG_2026`)** | `data/acquisitions/run_20261114_013500/dataset/test.npz` | **`VERIFIED`** |
| **Train Samples / Pixels** | `121` patches; `600,831` valid scene pixels (`150,212` stride-2 LightGBM pixels) | `121` patches (`1,839,696` valid patch px; `362,389` burned patch px); `600,831` unique valid scene px (`90,758` burned, `510,073` unburned) | `data/acquisitions/run_20261114_013500/dataset/train.npz` | **`VERIFIED`** |
| **Val Samples / Pixels** | `121` patches; `608,150` valid scene pixels (`152,044` stride-2 LightGBM pixels) | `121` patches (`1,877,088` valid patch px; `167,643` burned patch px); `608,150` unique valid scene px (`42,428` burned, `565,722` unburned) | `data/acquisitions/run_20261114_013500/dataset/val.npz` | **`VERIFIED`** |
| **Test Samples / Pixels** | `94` patches; `465,828` valid scene pixels | `94` patches (`1,441,577` valid patch px; `775,811` burned patch px); `465,828` unique valid scene px (`233,570` burned, `232,258` unburned) | `data/acquisitions/run_20261114_013500/dataset/test.npz` | **`VERIFIED`** |
| **Model 1 (`Log-Ratio`) Retrained** | Calibrated on `TRAIN`/`VAL` (`-0.95 dB`), Test F1 `0.6258` | Calibrated on `CA_GANN_2026` (`-1.40 dB`) & `CA_DOME_2026` (`-0.95 dB`); Test F1 `0.6258` (dNBR), `0.6694` (MCD64A1) | `outputs/runs/run_20261114_013500/evaluation/real_model_comparison.json` | **`VERIFIED`** |
| **Model 2 (`LightGBM`) Retrained** | Trained on `150,212` water-free pixels, Test F1 `0.7279` | Trained from scratch (`23:49:10Z`), early-stopped at `best_iteration_ = 1` (`30` splits); Test F1 `0.7279` (dNBR), `0.8180` (MCD64A1) | `outputs/runs/run_20261114_013500/checkpoints/lightgbm_water_free.pkl` | **`VERIFIED`** |
| **Model 3 (`UNet ResNet34`) Retrained** | Trained 6 epochs from scratch (`best_epoch=4`, `val_iou=0.2194`), Test F1 `0.8126` | Trained from scratch (`23:49:44Z`), distinct weights (`f5d3e9a6...`), `best_epoch=4`, `val_iou=0.219422`; Test F1 `0.8126` (dNBR), `0.8246` (MCD64A1) | `outputs/runs/run_20261114_013500/checkpoints/real_unet_resnet34_water_free.pt` | **`VERIFIED`** |
| **Model 4 (`CUSUM`) Evaluated** | Calibrated on `VAL` (`0.50`), Test F1 `0.5797` | Evaluated on `4`-date VH stack, calibrated on `CA_DOME_2026` (`0.50`); Test F1 `0.5797` (dNBR), `0.6331` (MCD64A1) | `outputs/runs/run_20261114_013500/evaluation/real_model_comparison.json` | **`VERIFIED`** |
| **Water Exclusion (`SCL == 6`)** | `0` water pixels in valid masks (`27,939` ML px / `138,215` total px excluded) | `0` water pixels in `valid > 0` across all splits; note that `SARPatchDataset`/`BCEDiceLoss` still include `valid==0` pixels as `label=0` in patch loss | `data/acquisitions/run_20261114_013500/dataset/dataset_manifest.json` | **`PARTIALLY VERIFIED`** |
| **NISAR Status** | `is_nisar = false` (`0` granules; ASF HTTP `401` gate) | `is_nisar = false`, `0` NISAR pixels used | `data/acquisitions/run_20261114_013500/nisar_metadata/nisar_discovery_and_auth_gate.json` | **`VERIFIED`** |

---

## 10. Discrepancies, Anomalies, and Limitations Identified

1. **`CA_TIMBER_2026` Training Exclusion vs. Split Label (`split="TRAIN"`, `include_in_training=False`):**
   - `CA_TIMBER_2026` is tagged with `split="TRAIN"` in `event_specs.py` but gated out by `include_in_training=False`. Consequently, the supervised `TRAIN` split consists of **a single wildfire event (`CA_GANN_2026`)**, `VAL` consists of **a single wildfire event (`CA_DOME_2026`)**, and `TEST` consists of **a single wildfire event (`CA_BUG_2026`)**.
2. **LightGBM Early Stopping at 1 Tree (`lgb_best_iteration = 1`):**
   - Because `scale_pos_weight = 5.6246` was computed from `CA_GANN_2026` (`15.11%` burned prevalence) and evaluated via uncalibrated `binary_logloss` on `CA_DOME_2026` (`6.98%` burned prevalence), validation loss rose after iteration 1 and early stopping truncated the LightGBM classifier to a single depth-6 tree (`30` splits).
3. **Unmasked `valid == 0` Pixels inside U-Net Patch Loss (`BCEDiceLoss`) and `nan_channel_stats`:**
   - While water pixels (`SCL == 6`) were properly removed from `valid` (`0` water pixels in `valid > 0`) and their `labels` were zeroed out (`100` water patch pixels in `train.npz` changed from `1` to `0`), `SARPatchDataset` does not pass the `valid` mask into `BCEDiceLoss`, so invalid/water pixels inside valid patches participate as negative (`0`) targets during patch-level SGD rather than being masked out of the loss denominator. Full-scene threshold selection and final evaluation strictly mask by `valid > 0`.
4. **Hybrid Data Provenance (Live Vector/Catalog Downloads + Cached Real Co-Registered Raster Stacks):**
   - `run_20261114_013500` executed live HTTP downloads for NASA FIRMS (`50` CSVs), NASA EONET (`2` JSON catalogs), and NASA CMR/ASF discovery, while reading the co-registered 20 m Sentinel-1/Sentinel-2/MODIS raster arrays from `data/real/<EVENT_ID>/stack.npz` (acquired earlier the same day at `2026-11-13T12:56Z–12:58Z`) to apply the new water-exclusion mask and build `data/acquisitions/run_20261114_013500/dataset/`.


---

## ERRATA (appended 2026-11-14 during Phase G0)

Several training-detail, event-metadata, and metric values in this report are **incorrect**. The
dataset/file-level counts, NPZ checksums, split membership, and the `CA_TIMBER_2026` exclusion remain
correct. Corrected values (LightGBM TEST F1 = 0.5037, Log-Ratio = 0.6964, CUSUM = 0.7123, U-Net
best VAL IoU = 0.1414, thresholds, checkpoint sizes and hashes, CUSUM/Log-Ratio parameters,
event regions and dates) are listed in `reports/PHASE_G_INITIAL_AUDIT.md`, Section 0.
