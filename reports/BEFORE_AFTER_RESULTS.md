# GEOSPATIAL BEFORE/AFTER PRODUCTS & BURNED-AREA RESULTS
## Astera Watch — Phase 8 Before/After Radiometric Change & Area Estimation Report
**Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*  
**Generated:** 2026-11-13  
**Output Directory:** `outputs/geospatial/<EVENT_ID>/`

---

## 1. Exported Georeferenced Products Per Event

For every wildfire event (`CA_GANN_2026`, `CA_DOME_2026`, `CA_BUG_2026`, `CA_TIMBER_2026`), `scripts/generate_before_after_and_validation.py` exports **11 verified files** under `outputs/geospatial/<EVENT_ID>/`:

1. `pre_vh_db.tif` (`float32`, `nodata=-9999.0`, DEFLATE): Pre-fire Sentinel-1 RTC VH $\gamma^0$ (dB)
2. `post_vh_db.tif` (`float32`, `nodata=-9999.0`, DEFLATE): Post-fire Sentinel-1 RTC VH $\gamma^0$ (dB)
3. `delta_vh_db.tif` (`float32`, `nodata=-9999.0`, DEFLATE): Post minus Pre VH log-ratio change $\Delta\gamma^0_{\text{VH}}$ (dB)
4. `burn_prob.tif` (`float32`, `nodata=-9999.0`, DEFLATE): Continuous burned-area probability / change score
5. `burn_mask.tif` (`uint8`, `nodata=255`, DEFLATE): Binary burned-area classification (`1` = burned, `0` = unburned)
6. `valid_mask.tif` (`uint8`, `nodata=255`, DEFLATE): Composite valid observation mask (`1` = valid SAR + cloud-free optical land, `0` = masked)
7. `dnbr.tif` (`float32`, `nodata=-9999.0`, DEFLATE): Sentinel-2 L2A differenced Normalized Burn Ratio ($\text{dNBR}$)
8. `mcd64a1_burn_date.tif` (`int16`, `nodata=-1`, DEFLATE): NASA MODIS `MCD64A1.061` ordinal day of burn ($1\text{–}366$)
9. `aoi_boundary.geojson` (`EPSG:4326` GeoJSON polygon with UTM bounds and area metadata)
10. `before_after_overview.png` (`140 DPI` 6-panel publication figure with UTM coordinates, colorbars, dates, and burned-area totals)
11. `before_after_summary.json` (Complete machine-readable verification, radiometric change, area, and validation summary)

---

## 2. Geospatially Accurate Burned-Area Estimates Across All 4 Events

All area calculations integrate valid $20\text{ m} \times 20\text{ m}$ ($400\text{ m}^2$) pixels in projected UTM coordinates (`EPSG:32610` / `EPSG:32611`), strictly excluding NoData/cloud/water pixels:

| Event ID & Split | CRS | Total AOI ($\text{km}^2$ / $\text{ha}$) | Valid Area ($\text{km}^2$ / Coverage %) | Primary Model Burned Area ($\text{km}^2$ / $\text{ha}$) | 95% Block-Bootstrap CI ($\text{km}^2$) | Threshold Sensitivity ($\text{km}^2$) | Sentinel-2 `dNBR` Reference ($\text{km}^2$) | NASA MODIS `MCD64A1` ($\text{km}^2$) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`CA_GANN_2026`** (`TRAIN`) | `EPSG:32610` | `256.00 km²` (`25,600 ha`) | `251.32 km²` (`98.17%`) | **`36.07 km²`** (`3,607.48 ha`, U-Net) | `[25.07, 47.21]` | `[33.91, 38.94]` | `36.32 km²` (`3,631.56 ha`) | `36.28 km²` (`3,627.80 ha`) |
| **`CA_DOME_2026`** (`VAL`) | `EPSG:32611` | `256.00 km²` (`25,600 ha`) | `243.42 km²` (`95.08%`) | **`37.00 km²`** (`3,699.68 ha`, U-Net) | `[26.17, 48.09]` | `[29.13, 47.34]` | `16.97 km²` (`1,697.12 ha`) | `24.81 km²` (`2,480.80 ha`) |
| **`CA_BUG_2026`** (`TEST`) | `EPSG:32611` | `256.00 km²` (`25,600 ha`) | `186.34 km²` (`72.79%`) | **`117.89 km²`** (`11,789.28 ha`, U-Net) | `[106.52, 129.07]` | `[103.07, 130.42]` | `93.43 km²` (`9,342.80 ha`) | `139.00 km²` (`13,899.76 ha`) |
| **`CA_TIMBER_2026`** (`EXCLUDED`) | `EPSG:32610` | `256.00 km²` (`25,600 ha`) | `249.65 km²` (`97.52%`) | **`29.59 km²`** (`2,958.92 ha`, Log-Ratio) | `[26.85, 32.39]` | `[21.43, 39.75]` | `67.68 km²` (`6,768.20 ha`) | `64.39 km²` (`6,438.96 ha`) |

---

## 3. Physical Radiometric Backscatter Change ($\Delta\gamma^0$) Inside vs. Outside Burn Scars

| Event ID | Burned Region Mean $\gamma^0_{\text{VH, pre}}$ (dB) | Burned Region Mean $\gamma^0_{\text{VH, post}}$ (dB) | Burned Region Mean $\Delta\gamma^0_{\text{VH}}$ (dB) | Unburned Region Mean $\Delta\gamma^0_{\text{VH}}$ (dB) | Burned vs. Unburned $\Delta\text{VH}$ Separation (dB) | Burned Region Mean $\text{dNBR}$ |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`CA_GANN_2026`** (`TRAIN`) | `-14.6426` | `-15.4047` | **`-0.7622 dB`** | `+0.0995 dB` | **`-0.8617 dB`** | `+0.2663` |
| **`CA_DOME_2026`** (`VAL`) | `-14.2307` | `-14.7770` | **`-0.5463 dB`** | `-0.2289 dB` | **`-0.3174 dB`** | `+0.2330` |
| **`CA_BUG_2026`** (`TEST`) | `-18.8952` | `-21.5625` | **`-2.6672 dB`** | `-0.7561 dB` | **`-1.9111 dB`** | `+0.1635` |
| **`CA_TIMBER_2026`** (`EXCLUDED`) | `-13.5244` | `-13.6811` | **`-0.1567 dB`** | `-0.1194 dB` | **`-0.0373 dB`** | `+0.2266` |

> [!NOTE]
> The radiometric separation table above explains physically why `CA_TIMBER_2026` was excluded from supervised training (`-0.0373 dB` separation due to mixed-orbit geometry and overlapping historical Plaskett/Timber burn scars) and why `CA_BUG_2026` (`TEST`) exhibits strong cross-polarization attenuation (`-2.6672 dB` in burned canopy vs. `-0.7561 dB` in unburned terrain, a `-1.9111 dB` physical separation).
