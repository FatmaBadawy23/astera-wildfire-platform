# SCIENTIFIC VALIDATION & BASELINE INVESTIGATION REPORT
## Astera Watch — Phase 7 Multi-Reference Evaluation & Resolution Reconciliation
**Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*  
**Generated:** 2026-11-13  
**Primary Artifact:** `outputs/evaluation/comprehensive_validation_report.json`

---

## 1. Held-Out Test Set (`CA_BUG_2026`) Performance vs. 20 m Sentinel-2 $\text{dNBR}$ Reference

On the strictly held-out test event **`CA_BUG_2026` (Bug Fire, `465,843` valid 20 m pixels = $186.34\text{ km}^2$, reference burned prevalence = $50.14\%$ = $93.43\text{ km}^2$)**:

| Model | F1 Score (95% Block-Bootstrap CI) | IoU | Precision | Recall | Specificity | FPR | FNR | ROC-AUC | PR-AUC | Predicted Area ($\text{km}^2$) | Area Error (%) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`UNet_ResNet34`** | **`0.8150`** (`[0.7795, 0.8384]`) | **`0.6877`** | `0.7304` | **`0.9217`** | `0.6579` | `0.3421` | **`0.0783`** | **`0.8730`** | **`0.8474`** | `117.893` | `+26.19%` |
| **`CUSUM_Temporal`** | `0.7123` (`[0.6644, 0.7385]`) | `0.5532` | `0.6101` | `0.8557` | `0.4500` | `0.5500` | `0.1443` | `0.7582` | `0.7587` | `131.048` | `+40.27%` |
| **`Log_Ratio_Baseline`** | `0.6964` (`[0.6504, 0.7235]`) | `0.5342` | `0.6332` | `0.7735` | `0.5494` | `0.4506` | `0.2265` | `0.7516` | `0.7525` | `114.135` | `+22.16%` |
| **`All_Burned_Trivial`** | `0.6679` (`[0.6010, 0.7016]`) | `0.5014` | `0.5014` | `1.0000` | **`0.0000`** | **`1.0000`** | `0.0000` | `N/A` | `N/A` | `186.337` | `+99.44%` |
| **`LightGBM_Pixel_Spatial`** | `0.5018` (`[0.4605, 0.5356]`) | `0.3350` | **`0.8493`** | `0.3561` | **`0.9365`** | **`0.0635`** | `0.6439` | `0.6899` | `0.7117` | `39.176` | `-58.07%` |

---

## 2. Independent Validation Against NASA MODIS `MCD64A1.061` (QA-Filtered) on `CA_BUG_2026` (`TEST`)

| Model | 20 m Pixel F1 vs `MCD64A1` | 20 m Pixel IoU | Precision | Recall | Specificity | FPR | ROC-AUC | PR-AUC | 500 m Block F1 (`746` blocks) | 500 m Block Specificity | 500 m Block Pearson $r$ |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`UNet_ResNet34`** | **`0.8930`** | **`0.8067`** | **`0.9729`** | `0.8252` | **`0.9326`** | **`0.0674`** | **`0.9560`** | **`0.9822`** | **`0.9022`** | **`0.9572`** | **`0.7768`** |
| **`All_Burned_Trivial`** | `0.8545` | `0.7459` | `0.7459` | `1.0000` | **`0.0000`** | **`1.0000`** | `N/A` | `N/A` | `0.8567` | **`0.0000`** | **`0.0000`** |
| **`CUSUM_Temporal`** | `0.8091` | `0.6794` | `0.8336` | `0.7860` | `0.5394` | `0.4606` | `0.7520` | `0.8973` | `0.9650` | `0.8289` | `0.7931` |
| **`Log_Ratio_Baseline`** | `0.7636` | `0.6176` | `0.8468` | `0.6953` | `0.6307` | `0.3693` | `0.7458` | `0.8962` | `0.9287` | `0.9358` | `0.7547` |
| **`LightGBM_Pixel_Spatial`** | `0.4180` | `0.2642` | `0.9506` | `0.2679` | `0.9591` | `0.0409` | `0.6578` | `0.8655` | `0.2773` | `1.0000` | `0.4764` |
| **Sentinel-2 `dNBR` vs `MCD64A1`** | `0.7848` | `0.6458` | `0.9746` | `0.6568` | `0.9498` | `0.0502` | — | — | `0.7880` | `0.9679` | `0.7548` |

---

## 3. Root-Cause Investigation: `All_Burned_Trivial` ($F_1 = 0.8545$) vs. `UNet_ResNet34` ($F_1 = 0.8930$ against `MCD64A1` and $F_1 = 0.8150$ against `dNBR`)

1. **Mathematical Mechanism of `All_Burned_Trivial` $F_1$:**
   For a degenerate classifier that predicts $\hat{y} = 1$ for every valid pixel ($\text{TP} = P$, $\text{FP} = N$, $\text{FN} = 0$, $\text{TN} = 0$), $\text{Recall} = 1.0$, $\text{Precision} = p = \frac{P}{P+N}$ (the positive class prevalence), and:
   $$F_1(\text{All\_Burned}) = \frac{2p}{1 + p}$$
   - Against **500 m `MCD64A1.061`** on `CA_BUG_2026`, the coarse 500 m burn perimeter covers $p = 74.59\%$ ($347,494 / 465,843$) of valid pixels, so $F_1(\text{All\_Burned}) = \frac{2(0.7459)}{1.7459} = \mathbf{0.8545}$ automatically — despite having **$\text{Specificity} = 0.0000$**, **$\text{FPR} = 1.0000$** ($118,349$ false positives), and **$\text{Pearson } r = 0.0000$**.
   - Against **20 m Sentinel-2 `dNBR`**, the fine-scale burned prevalence is $p = 50.14\%$ ($233,570 / 465,843$) because 20 m optical imagery resolves unburned riparian corridors, rock outcrops, and low-severity islands inside the 500 m `MCD64A1` envelope. Against 20 m `dNBR`, `All_Burned_Trivial` drops to $F_1 = \frac{2(0.5014)}{1.5014} = \mathbf{0.6679}$ ($\text{Specificity} = 0.0000$).
2. **Why Earlier Summaries Miscompared `0.8545` and `0.8124`/`0.8150`:**
   Earlier summaries compared `All_Burned_Trivial` evaluated against **500 m `MCD64A1`** ($F_1 = 0.8545$) with `UNet_ResNet34` evaluated against **20 m `dNBR`** ($F_1 = 0.8150$). When evaluated on the **same reference dataset**:
   - **Against 20 m `dNBR`:** `UNet_ResNet34` achieves **$F_1 = 0.8150$** ($\text{IoU} = 0.6877$, $\text{Specificity} = 65.79\%$, $\text{ROC-AUC} = 0.8730$) vs. `All_Burned_Trivial` **$F_1 = 0.6679$** ($\text{Specificity} = 0.0\%$) — a **$+0.1471$ F1 improvement**.
   - **Against 500 m QA-filtered `MCD64A1` (at 20 m pixel level):** `UNet_ResNet34` achieves **$F_1 = 0.8930$** ($\text{IoU} = 0.8067$, $\text{Precision} = 97.29\%$, $\text{Specificity} = 93.26\%$, $\text{ROC-AUC} = 0.9560$, $\text{PR-AUC} = 0.9822$) vs. `All_Burned_Trivial` **$F_1 = 0.8545$** ($\text{Specificity} = 0.0\%$) — a **$+0.0385$ F1 improvement** while correctly rejecting **$93.26\%$ of unburned pixels**!
   - **Against 500 m `MCD64A1` Reconciled at Native 500 m Block Resolution (`25×25` px blocks):** `UNet_ResNet34` achieves **$F_1 = 0.9022$** ($\text{IoU} = 0.8219$, $\text{Specificity} = 95.72\%$, $\text{Pearson } r = 0.7768$) vs. `All_Burned_Trivial` **$F_1 = 0.8567$** ($\text{Specificity} = 0.0\%$, $\text{Pearson } r = 0.0000$).
3. **Why $F_1$ Alone Is Insufficient Under Severe Class Imbalance:**
   When positive class prevalence $p > 0.50$, a non-informative constant classifier achieves $F_1 > 0.66$. Therefore, Astera Watch mandates joint reporting of **Specificity (TNR)**, **False Positive Rate (FPR)**, **IoU**, **ROC-AUC**, **PR-AUC**, and **500 m block-reconciled Pearson $r$**.
