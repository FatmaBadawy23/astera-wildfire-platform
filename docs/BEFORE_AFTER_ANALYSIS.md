# Astera Watch — Before-Fire vs After-Fire Analysis & Area Estimation Guide

## 1. Scientific Foundation

Wildfire burned-area mapping with Synthetic Aperture Radar (SAR) requires comparing a **pre-fire** baseline acquisition ($t_{\text{pre}} < t_{\text{ignition}}$) against a **post-fire** acquisition ($t_{\text{post}} > t_{\text{ignition}}$) co-registered on an identical projected meter grid and acquired in consistent viewing geometry (same orbit pass direction and relative orbit track).

### 1.1 Radiometric Backscatter Change ($\Delta \gamma^0$)
Let $\gamma^0_{\text{pre}}$ and $\gamma^0_{\text{post}}$ denote radiometrically terrain-flattened linear backscatter power ($\text{m}^2/\text{m}^2$). Strictly positive finite pixels ($\gamma^0 > 0$) are converted to decibels:

$$\gamma^0_{\text{dB}} = 10 \log_{10}(\gamma^0)$$

Non-positive or no-data pixels are preserved as `NaN` rather than clamped to an artificial epsilon floor. The cross-polarized log-ratio change is:

$$\Delta \gamma^0_{\text{VH, dB}} = \gamma^0_{\text{VH, post, dB}} - \gamma^0_{\text{VH, pre, dB}} = 10 \log_{10}\!\left(\frac{\gamma^0_{\text{VH, post}}}{\gamma^0_{\text{VH, pre}}}\right)$$

When wildfire consumes canopy foliage and small branches, volume scattering decreases ($\Delta \gamma^0_{\text{VH, dB}} < 0\text{ dB}$). We additionally compute:
- **Co-polarized change:** $\Delta \gamma^0_{\text{VV, dB}} = \gamma^0_{\text{VV, post, dB}} - \gamma^0_{\text{VV, pre, dB}}$
- **Depolarization ratio change:** $\Delta(\gamma^0_{\text{VH, dB}} - \gamma^0_{\text{VV, dB}})$
- **Relative cross-pol power change:** $(\gamma^0_{\text{VH, post}} - \gamma^0_{\text{VH, pre}}) / \gamma^0_{\text{VH, pre}}$
- **Local spatial texture:** $5 \times 5$ local standard deviation $\sigma_{5\times 5}(\Delta \gamma^0_{\text{VH, dB}})$

---

## 2. Geospatially Accurate Burned-Area Integration

All area calculations in `backend/processing/change_detection/before_after.py` are performed in the event's local **projected UTM Coordinate Reference System** (`EPSG:32610` or `EPSG:32611`), never in geographic degrees (`EPSG:4326` is explicitly rejected with a `ValueError`).

Given affine pixel dimensions $\Delta x = 20.0\text{ m}$ and $\Delta y = 20.0\text{ m}$:
- **Single-pixel area:** $A_{\text{pixel}} = |\Delta x \cdot \Delta y| = 400.0\text{ m}^2 = 0.0004\text{ km}^2 = 0.04\text{ ha}$
- **Total AOI area ($800 \times 800\text{ pixels}$):** $A_{\text{AOI}} = 640,000 \times 400\text{ m}^2 = 256.0\text{ km}^2 = 25,600.0\text{ ha}$
- **Valid observation area:**
  $$A_{\text{valid}} = N_{\text{valid}} \cdot A_{\text{pixel}}$$
  where $N_{\text{valid}}$ counts pixels that are simultaneously valid in pre/post SAR ($\gamma^0 > 0$), cloud/shadow/snow-free in pre/post Sentinel-2 `SCL` (`SCL` $\in \{4, 5, 7\}$), and non-water (`SCL` $\neq 6$).
- **Burned area (restricted strictly to valid observations):**
  $$A_{\text{burned, km}^2} = \frac{N_{\text{burned} \wedge \text{valid}} \cdot A_{\text{pixel}}}{10^6}, \qquad A_{\text{burned, ha}} = \frac{N_{\text{burned} \wedge \text{valid}} \cdot A_{\text{pixel}}}{10^4}$$
- **Burned percentage of valid observation area:**
  $$P_{\text{burned | valid}} = 100 \times \frac{N_{\text{burned} \wedge \text{valid}}}{N_{\text{valid}}}$$

### 2.1 Spatial Block-Bootstrap Uncertainty ($95\%$ CI)
Because adjacent $20\text{ m}$ pixels are spatially autocorrelated, naive i.i.d. binomial standard errors severely underestimate uncertainty. Astera Watch partitions the $800 \times 800$ grid into $64 \times 64\text{ pixel}$ ($1.28\text{ km} \times 1.28\text{ km}$) spatial blocks and resamples blocks with replacement ($B = 200$ iterations) to compute the $2.5\text{th}$ and $97.5\text{th}$ percentile confidence bounds on $A_{\text{burned, km}^2}$, alongside threshold sensitivity bounds ($\pm 0.05$ on model probability or $\pm 0.25\text{ dB}$ on log-ratio threshold).

---

## 3. Exported Geospatial Products (`outputs/geospatial/<EVENT_ID>/`)

For each wildfire event (`CA_GANN_2026`, `CA_DOME_2026`, `CA_BUG_2026`, `CA_TIMBER_2026`), `scripts/generate_before_after_and_validation.py` writes:

| File Name | Dtype & NoData | Description |
| :--- | :--- | :--- |
| `pre_vh_db.tif` | `float32` (`-9999.0`) | Pre-fire Sentinel-1 RTC VH backscatter $\gamma^0$ in dB |
| `post_vh_db.tif` | `float32` (`-9999.0`) | Post-fire temporal-median Sentinel-1 RTC VH backscatter $\gamma^0$ in dB |
| `delta_vh_db.tif` | `float32` (`-9999.0`) | Post-fire minus pre-fire VH log-ratio change ($\Delta \gamma^0_{\text{VH, dB}}$) |
| `burn_prob.tif` | `float32` (`-9999.0`) | Burned-area probability map (U-Net ResNet-34 on active splits) |
| `burn_mask.tif` | `uint8` (`255`) | Binary burned-area segmentation mask (`1` = burned, `0` = unburned) |
| `valid_mask.tif` | `uint8` (`255`) | Composite SAR + optical valid-observation mask (`1` = valid land, `0` = masked) |
| `dnbr.tif` | `float32` (`-9999.0`) | Sentinel-2 L2A differenced Normalized Burn Ratio ($\text{dNBR}$) |
| `mcd64a1_burn_date.tif` | `int16` (`-1`) | NASA MODIS `MCD64A1.061` ordinal burn day of year ($1\text{–}366$) |
| `aoi_boundary.geojson` | GeoJSON (`EPSG:4326`) | AOI polygon with UTM/WGS84 bounds and burned-area summary properties |
| `before_after_overview.png` | PNG (`140 DPI`) | 6-panel georeferenced visual comparison (Pre-fire VH, Post-fire VH, $\Delta\gamma^0_{\text{VH, dB}}$, Burn Probability, Binary Burn Mask, and Sentinel-2 $\text{dNBR}$ vs `MCD64A1`) |
| `before_after_summary.json` | JSON | Complete 16-step verification, radiometric change, area estimates, and independent validation |
