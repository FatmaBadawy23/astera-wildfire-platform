# LEAKAGE-SAFE DATASET ENGINEERING REPORT
## Astera Watch — Phase 5 Event-Grouped Dataset & Normalization Audit
**Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*  
**Generated:** 2026-11-13  
**Manifest:** `data/real/dataset/dataset_manifest.json`

---

## 1. Event-Level Spatial Grouping (Zero Event or Pixel Leakage)

To prevent spatial autocorrelation leakage between neighboring patches of the same wildfire, splitting is enforced strictly at the **wildfire event level**:

| Split | Event ID | Fire Name & Region | UTM CRS | Valid Pixels (`/ 640,000`) | Burned Pixels ($\text{dNBR} \ge 0.11$) | Burned Prevalence (Valid) | Patches (`128×128`, Stride `64`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`TRAIN`** | `CA_GANN_2026` | Gann Fire (Calaveras County, CA) | `EPSG:32610` | `628,295` (`98.17%`) | `90,789` (`36.316 km²`) | `14.45%` | **`121`** (`data/real/dataset/train.npz`) |
| **`VAL`** | `CA_DOME_2026` | Dome Fire (Madera County, CA) | `EPSG:32611` | `608,542` (`95.08%`) | `42,428` (`16.971 km²`) | `6.97%` | **`121`** (`data/real/dataset/val.npz`) |
| **`TEST`** | `CA_BUG_2026` | Bug Fire (Lassen/Sierra CA & Washoe NV) | `EPSG:32611` | `465,843` (`72.79%`) | `233,570` (`93.428 km²`) | `50.14%` | **`94`** (`data/real/dataset/test.npz`) |
| **`EXCLUDED`** | `CA_TIMBER_2026` | Timber Fire (Monterey County, CA) | `EPSG:32610` | `624,132` (`97.52%`) | `169,205` (`67.682 km²`) | `27.11%` | `0` (Excluded from training/tuning; complex multi-fire overlap) |
| **Total Active** | **3 Events** | — | — | **`1,702,680`** | **`366,787`** | **`21.54%`** | **`336` unique patches** (`<= 10,000` cap) |

---

## 2. Patch Tensor Specification & Hard Sample Cap

- **Patch Dimensions:** `(5, 128, 128)` `float32` (`2.56 km × 2.56 km` spatial footprint at $20\text{ m}$ resolution).
- **5 Input Channels (dB):**
  1. `Channel 0`: $\gamma^0_{\text{VV, pre}}$ (dB)
  2. `Channel 1`: $\gamma^0_{\text{VH, pre}}$ (dB)
  3. `Channel 2`: $\gamma^0_{\text{VV, post}}$ (dB, temporal median of `post` and `post2`)
  4. `Channel 3`: $\gamma^0_{\text{VH, post}}$ (dB, temporal median of `post` and `post2`)
  5. `Channel 4`: $\Delta \gamma^0_{\text{VH}} = \gamma^0_{\text{VH, post}} - \gamma^0_{\text{VH, pre}}$ (dB)
- **Global Sample Cap Enforcement:** `336` total patches across `TRAIN + VAL + TEST`, strictly respecting `MAX_GLOBAL_SAMPLES = 10,000` (`backend/processing/models/dataset.py`).

---

## 3. Leakage-Free Normalization & Threshold Calibration

1. **Channel Normalization Statistics (`fitted_on: ["CA_GANN_2026"]` only):**
   - `mean`: `[-11.0970, -17.2041, -11.0005, -17.3191, -0.0252]` dB
   - `std`: `[2.7798, 2.5734, 2.9056, 2.7429, 1.5641]` dB
   - Verified that `VAL` (`CA_DOME_2026`) and `TEST` (`CA_BUG_2026`) pixels never contributed to `mean` or `std`.
2. **Reference Label Threshold Calibration (`fitted_on: ["CA_GANN_2026"]` only):**
   - Swept $\tau_{\text{dNBR}} \in [0.02, 0.40]$ on `TRAIN` (`CA_GANN_2026`) against `MCD64A1.061` burned area, selecting $\tau_{\text{dNBR}} = 0.11$ ($F_1 = 0.8447$, $\text{Precision} = 0.8443$, $\text{Recall} = 0.8452$).
   - Neither `VAL` nor `TEST` was inspected during label calibration.
