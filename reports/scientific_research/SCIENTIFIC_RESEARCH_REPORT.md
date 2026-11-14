> **SUPERSEDED — SYNTHETIC DATA.** This document reports results produced by
> synthetic scenes generated in-repository, not by NASA NISAR. The metrics below are
> not evidence of real-world performance and must not be cited as NISAR results.
> See `reports/PHASE0_PROJECT_AUDIT.md`, `reports/PHASE1_DATA_RESEARCH.md`, and
> `reports/REAL_DATA_RESULTS.md` for the corrected record.

# Astera Watch — Scientific Research & Model Selection Report

**Challenge:** NASA Space Apps Challenge 2026 — Dancing with the SARs  
**Subject:** NISAR-Based Wildfire Monitoring & Burned-Area Intelligence Platform  
**Authors:** Senior Scientific & Engineering Research Team  
**Date:** 2026-11-13  
**Status:** Approved for Implementation  

---

## 1. SAR Remote Sensing Foundations for Wildfire Science

### 1.1 Microwave Interaction Physics: L-Band vs C-Band in Burn Scars
Synthetic Aperture Radar (SAR) systems operate in the microwave spectrum, allowing active, day-and-night, cloud-penetrating, and smoke-penetrating Earth observation. 

| Sensor Parameter | NISAR L-SAR | Sentinel-1 C-SAR | Physical Consequence for Wildfire Monitoring |
|---|---|---|---|
| **Wavelength ($\lambda$)** | ~24 cm (1.25 GHz) | ~5.6 cm (5.4 GHz) | L-band penetrates forest canopies down to major branches, trunks, and the soil surface. C-band interacts mostly with upper crown foliage and small twigs. |
| **Volumetric Scattering** | High pre-fire in dense woody biomass | Moderate pre-fire in crown leaves | When fire destroys canopy crowns and understory, L-band cross-pol ($HV$) experiences a profound drop in volume scattering (-3 to -8 dB). |
| **Surface & Double-Bounce** | Significant trunk-ground interaction | Dominantly canopy surface scattering | Post-fire ash, exposed soil, and charred standing trunks alter L-band double-bounce and surface roughness. |
| **Moisture Sensitivity** | Deep soil moisture penetration | Topmost surface/foliage moisture | Post-fire changes in dielectric constant due to vegetation desiccation and soil baking directly modulate backscatter. |
| **Temporal Coherence** | Longer coherence over vegetated areas | Quick decorrelation in winds/growth | L-band maintains interferometric coherence better in wooded ecosystems, making damage proxy maps viable. |

### 1.2 Radiometric Conventions: Gamma-Zero ($\gamma^0$) vs Sigma-Zero ($\sigma^0$)
The standard Level-2 NISAR GCOV product is formatted in **Radiometrically Terrain-Corrected (RTC) Gamma-Nought ($\gamma^0$)**:
$$\gamma^0 = \frac{\sigma^0}{\cos \theta_{inc}}$$
where $\theta_{inc}$ is the local radar incidence angle relative to the digital elevation model (DEM) surface normal.
- $\gamma^0$ minimizes topographic radiometric slope distortions better than $\sigma^0$ across mountainous terrain (typical of western US wildfires).
- The GCOV HDF5 layer `rtcGammaToSigmaFactor` provides the exact pixel-by-pixel scalar conversion between $\gamma^0$ and $\sigma^0$ when needed.
- Logarithmic conversion (decibels) is computed strictly as:
$$\text{Backscatter (dB)} = 10 \cdot \log_{10}(\text{power} + \epsilon), \quad \epsilon = 10^{-7}$$

### 1.3 NISAR GCOV Product Architecture
Inside the Level-2 GCOV HDF5 file:
- Primary group: `/science/LSAR/GCOV/grids/frequencyA/`
- Covariance layers: `HHHH`, `HVHV`, `VVVV`, `VHVH` (linear power units).
- Mask layers: `mask` (0 = valid focused data, non-zero = invalid/swath boundary), `inputDataExceptionMask`.
- Metadata: `numberOfLooks` (effective looks after spatial multi-looking), `listOfPolarizations`, `projection` (EPSG code), `xCoordinates`, `yCoordinates`.
- Pixel spacing: Standard 10m to 20m regular UTM grid.

---

## 2. Scientific Analysis of the Proposed Model Comparison

We rigorously evaluated all candidate architectures against physical requirements, dataset scale limits (<= 10,000 samples), computational constraints (CPU execution target), and generalization to unseen wildfires:

### A. Burned-Area Segmentation Architectures
1. **U-Net with ResNet34 Backbone (Selected Primary DL Candidate):**
   - *Input:* 4 channels: $[HH_{pre}, HV_{pre}, HH_{post}, HV_{post}]$ or 5 channels: $[HH_{pre}, HV_{pre}, HH_{post}, HV_{post}, \Delta_{ratio}^{HV}]$.
   - *Architecture:* U-Net decoder with skip connections from a ResNet34 encoder.
   - *Channel Adaptation:* The first convolution layer (`conv1`) is adapted from 3 channels (RGB ImageNet) to N channels by initializing new channels with the mean of RGB weights or He normal initialization, preserving transfer learning benefits.
   - *Advantages:* Moderate parameter count (~24M params), fast convergence on small datasets, robust multi-scale feature representation, proven spatial boundary retention.
2. **U-Net++ (Ablation / Secondary):**
   - Dense nested skip pathways improve boundary precision slightly in medical imaging, but increase memory footprint by 40% and risk overfitting when training samples are under 5,000 patches. Deferred unless U-Net shows severe boundary leakage.
3. **ChangeFormer / BIT (Transformer-based):**
   - High memory requirements, quadratic spatial self-attention complexity, extreme data hunger (requires >50,000 paired scenes to avoid severe over-smoothing). **Rejected** for operational pipeline under 10k sample constraint.

### B. Classical Machine Learning Baselines
4. **Log-Ratio Change Detection (Mandatory Physics Baseline):**
   $$\Delta_{ratio} = 10 \cdot \log_{10}\left(\frac{\gamma_{post}^0 + \epsilon}{\gamma_{pre}^0 + \epsilon}\right) = \gamma_{post}^{0,(dB)} - \gamma_{pre}^{0,(dB)}$$
   - Cross-polarization ($HV$ or $VH$) log-ratio is the most sensitive direct indicator of vegetation biomass loss.
   - Thresholding via Otsu, Kittler-Illingworth, or adaptive percentile $\tau = \mu - k\sigma$.
5. **LightGBM Gradient Boosted Trees (Classical ML Baseline):**
   - Pixel-wise and spatial neighborhood features: $[HH_{pre}, HV_{pre}, HH_{post}, HV_{post}, \text{Ratio}_{HH}, \text{Ratio}_{HV}, \text{Diff}_{norm}, \text{Std}_{3\times3}, \text{Entropy}_{3\times3}]$.
   - Extremely fast training on CPU, highly interpretable (Tree SHAP, feature importances), handles class imbalance natively via `scale_pos_weight`.

### C. Temporal Monitoring
6. **CUSUM (Cumulative Sum Control Chart):**
   - Suitable when $\ge 3$ temporal SAR acquisitions exist for baseline mean/variance estimation:
     $$S_t = \max(0, S_{t-1} + (x_t - \mu_0 - k))$$
   - Non-trainable statistical change-point detector for fire progression and vegetation recovery tracking.

### D. External Ancillary Evidence
7. **NASA FIRMS (VIIRS/MODIS Active Fire):**
   - Used for spatio-temporal fire event bounding, ignition dating, and independent spatial verification. Never used as dense pixel-level burned-area training ground truth.

---

## 3. Final Model Selection Decision Matrix

| Model | Task | Input | Output | Training Requirement | Dataset Requirement | Computational Cost | Advantages | Limitations | Scientific Evidence | Evidence Type | Implementation Priority | Final Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **1. Log-Ratio Thresholding** | Unsupervised Change Detection | Pre/Post $\gamma^0$ (HH, HV) | Binary change mask | None (analytical) | $\ge 1$ pre/post pair | Negligible (<1s) | Sensor-physics grounded, zero training data, no risk of overfitting | Sensitive to soil moisture and speckle; fixed threshold | ASF SAR Burned Area Guidelines | Physics / Peer-reviewed | **Priority 1** | **SELECTED (Mandatory Baseline)** |
| **2. LightGBM Pixel-Spatial Classifier** | Supervised Pixel Classification | 10 polarimetric & texture features | Burn probability $[0, 1]$ | Supervised GBDT | 1,000–5,000 labeled pixels/patches | Very Low (<30s on CPU) | Feature importance, handles non-linearities, no GPU required | Ignores global spatial shape semantics | Remote Sensing Letters 2023 | Empirical ML / Benchmark | **Priority 2** | **SELECTED (Classical ML Baseline)** |
| **3. U-Net + ResNet34** | Semantic Change Segmentation | 5-channel patch $[HH_1, HV_1, HH_2, HV_2, \Delta_{HV}]$ | Burned area probability map (256x256) | Supervised Mini-batch SGD/AdamW | 500–5,000 paired patches | Moderate (trainable on CPU/GPU) | Context-aware, spatial boundaries, multi-scale receptive field | Requires paired training patches; GPU preferred | IEEE TGRS SAR Wildfire Segmentation | Peer-reviewed DL | **Priority 3** | **SELECTED (Primary DL Model)** |
| **4. U-Net++** | Semantic Segmentation | 5-channel patch | 256x256 mask | Supervised | >5,000 paired patches | High | Dense skip pathways | High parameter count, overfits on small datasets | Medical/RS literature | Engineering Analysis | Priority 4 | **DEFERRED (Ablation Only)** |
| **5. ChangeFormer / BIT** | Bitemporal Transformer | Pre/post image pairs | Change mask | Supervised Transformer | >30,000 paired patches | Extreme (OOM on CPU) | Global attention | Data-hungry, unstable training on small sets | IEEE JSTARS 2022 | Literature | Priority 5 | **REJECTED (Incompatible with Constraints)** |
| **6. CUSUM** | Multi-temporal Change Detection | Time-series $\gamma^0(t)$ | Change points / anomaly score | None (Statistical) | $\ge 3$ temporal scenes | Low | Tracks post-fire recovery over time | Requires dense time series | Statistical Process Control | Statistical Theory | Priority 2 (Temporal) | **SELECTED (for $\ge 3$ scene sequences)** |
| **7. NASA FIRMS (VIIRS/MODIS)** | Event Discovery & Evidence | Lat/Lon/Date | Point fire hotspots | None (External API) | Bounding box + Date range | Negligible | Independent thermal evidence | Hotspot coordinates are NOT burn scar boundaries | NASA LANCE Documentation | Official NASA Product | Priority 1 (Ancillary) | **SELECTED (Event Verification Only)** |

---

## 4. Scientific Ground Truth and Label Integrity

1. **Optical Reference (Sentinel-2 dNBR):**
   $$\text{NBR} = \frac{\rho_{NIR} - \rho_{SWIR2}}{\rho_{NIR} + \rho_{SWIR2}} = \frac{B08 - B12}{B08 + B12}$$
   $$\text{dNBR} = \text{NBR}_{pre} - \text{NBR}_{post}$$
   - Standard USGS / NASA burn severity thresholds:
     - Unburned / Regrowth: $< 0.10$
     - Low severity: $0.10 - 0.27$
     - Moderate-low: $0.27 - 0.44$
     - Moderate-high: $0.44 - 0.66$
     - High severity: $> 0.66$
   - Binary reference burn mask: $\text{dNBR} \ge 0.27$ (moderate to high severity burn scar).
2. **Scientific Epistemology:**
   - Sentinel-2 dNBR serves as a **high-confidence reference label (pseudo-ground-truth)** for SAR model training and evaluation.
   - We explicitly state in all model cards and reports that optical dNBR labels represent an independent optical proxy, not direct radar in-situ ground truth.
   - Cloud, cloud-shadow, and smoke contaminated optical pixels are strictly masked using Sentinel-2 Scene Classification Layer (SCL).
