# MODEL TRAINING & CHECKPOINT VERIFICATION REPORT
## Astera Watch — Phase 6 Model Selection, Training & Checkpoint Audit
**Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*  
**Generated:** 2026-11-13  
**Stored Reports:** `outputs/evaluation/real_model_comparison.json` & `outputs/evaluation/comprehensive_validation_report.json`

---

## 1. Model Portfolio & Hardware Execution Audit

- **Execution Hardware:** CPU (`PyTorch 2.12.1+cpu`, `LightGBM 4.7.0`, `seed=42`). Although an NVIDIA GeForce RTX 3050 Laptop GPU is present in hardware, the installed PyTorch build is CPU-only (`torch.cuda.is_available() == False`), so training and inference executed deterministically on CPU.
- **Checkpoints Verified & Preserved (`models/checkpoints/`):**
  1. `models/checkpoints/real_unet_resnet34_best.pt` (`349,211,769` bytes = `333.03 MB`, SHA-256 `4c9910e483c9487778cc54df092b494a154d9460ad7dc57517b6abbc525d6282`) — Trained on real Sentinel-1 RTC patches (`CA_GANN_2026` TRAIN), selected at epoch 5 on `CA_DOME_2026` (`VAL`).
  2. `models/checkpoints/unet_resnet34_best.pt` (`349,205,409` bytes = `333.03 MB`) — Legacy synthetic-data checkpoint preserved untouched (`real_unet_resnet34_best.pt` is used exclusively for all real-data evaluations).

---

## 2. Model Specifications & Training Hyperparameters

| Model Identifier | Family & Architecture | Input Features / Shape | Training Set | Validation / Tuning (`CA_DOME_2026`) | Selected Threshold | Training Time | Scene Inference Latency (CPU) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`Log_Ratio_Baseline`** (`log_ratio`) | Physics-Based Cross-Pol Backscatter Log-Ratio ($\Delta\gamma^0_{\text{VH, dB}} \le \tau$) | 1 channel ($\Delta\gamma^0_{\text{VH, dB}}$) | Calibrated on `CA_GANN_2026` (`628,295` valid pixels) | Evaluated on `VAL` without re-tuning | **$\tau = -1.20\text{ dB}$** (TRAIN $F_1 = 0.2882$) | `< 0.1 s` | `0.02 s` |
| **`LightGBM_Pixel_Spatial`** (`lightgbm`) | Gradient Boosted Decision Trees (`n_estimators=250`, `lr=0.05`, `max_depth=7`, `num_leaves=31`, `scale_pos_weight=5.85`) | 10 features (`vv_pre`, `vh_pre`, `vv_post`, `vh_post`, `delta_vv`, `delta_vh`, `delta_diff`, $5\times 5$ `mean_dvh`, $5\times 5$ `std_dvh`, `post_vv_minus_vh`) | `157,084` spatially thinned (`2×2`) valid pixels on `CA_GANN_2026` (`14.6%` positive) | Early-stopped on `152,139` `VAL` pixels (`7.0%` positive); probability threshold selected on `VAL` | **$p \ge 0.18$** (VAL $F_1 = 0.1568$) | `0.45 s` | `0.42 s` |
| **`UNet_ResNet34`** (`unet`) | Deep 2D Encoder-Decoder with ResNet-34 backbone & skip connections (`BCE + Dice` loss, `AdamW`, `lr=3e-4`, `batch_size=8`, `8` epochs) | `(5, 128, 128)` patch tensor (`vv_pre`, `vh_pre`, `vv_post`, `vh_post`, `delta_vh` in dB) | `121` patches from `CA_GANN_2026` (`TRAIN`) | Best checkpoint at **Epoch 5** (`val_loss = 0.7467`, `val_iou = 0.1759`, `val_dice = 0.2992`); probability threshold selected on `VAL` full scene | **$p \ge 0.12$** (VAL $F_1 = 0.3164$) | `297.28 s` | `1.85 s` (overlap-tile `128×128`, stride `64`) |
| **`CUSUM_Temporal`** (`cusum`, supplementary) | Sequential Multi-Temporal Cumulative Sum Change Detector ($k = 0.5$) | 4-date Sentinel-1 VH $\gamma^0$ dB stack ($t_0, t_1, t_2, t_3$) | Unsupervised baseline ($t_0$) | Decision interval $h \in [2.0, 5.0]$ selected on `VAL` | **$h = 5.0$** (VAL $F_1 = 0.1304$) | `< 0.1 s` | `0.08 s` |

---

## 3. U-Net ResNet-34 Learning Curve Across All 8 Epochs

| Epoch | Train Loss (`BCE + Dice`) | Val Loss (`CA_DOME_2026`) | Val IoU (`p >= 0.5`) | Checkpoint Status |
| :---: | :---: | :---: | :---: | :--- |
| **1** | `0.7318` | `0.8644` | `0.0977` | Saved |
| **2** | `0.6331` | `0.9419` | `0.0680` | — |
| **3** | `0.6253` | `1.0783` | `0.0256` | — |
| **4** | `0.5932` | `0.9395` | `0.0442` | — |
| **5** | `0.5723` | **`0.7467`** | **`0.1759`** (`Dice = 0.2992`) | **Best Checkpoint (`real_unet_resnet34_best.pt`)** |
| **6** | `0.5744` | `0.9883` | `0.0085` | — |
| **7** | `0.5523` | `0.8265` | `0.0725` | — |
| **8** | `0.5735` | `0.8588` | `0.0566` | — |
