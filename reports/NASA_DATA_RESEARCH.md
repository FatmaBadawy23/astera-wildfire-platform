# PHASE 1 — OFFICIAL NASA & MULTI-SENSOR DATA RESEARCH REPORT
## Astera Watch — NISAR-Targeted Wildfire Monitoring & Burned-Area Intelligence Platform
**Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*  
**Repository:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`  
**Document Status:** Consolidated Scientific & Technical Reference (Phase 1 Complete)  
**Generated:** 2026-11-13

---

## 1. Executive Decision Summary

1. **Primary Scientific Target:** **NASA-ISRO Synthetic Aperture Radar (NISAR) Level-2 Geocoded Polarimetric Covariance (`NISAR_L2_GCOV_V1`)**, NASA CMR Concept ID `C3622241360-ASF`, archived at the Alaska Satellite Facility (ASF) DAAC (`https://nisar.asf.earthdatacloud.nasa.gov/...`).
2. **Real NISAR Availability & Blocker Status:** Live ASF CMR metadata queries confirm that real 2026 NISAR L2 GCOV dual-polarization (`HHHH`, `HVHV`) granules exist with **100% spatial polygon coverage** over all four California 2026 study AOIs (`CA_GANN_2026`, `CA_TIMBER_2026`, `CA_DOME_2026`, `CA_BUG_2026`) in both Descending and Ascending orbits. However, all pre-/post-fire pairs spanning May–October 2026 are **Provisional maturity (`CRID P05023`, PGE `R05.02.3`)** because NASA's **Validated L0–L2 science release (`CRID P05036`, PGE `R05.03.6`)** opened on `2026-11-06` and covers acquisitions starting **`2026-10-21` forward**. In addition, a permanent mission-wide instrument gap occurred from **`2026-07-27T22:03:25Z` to `2026-08-10T00:55:27Z`**. Direct HDF5 binary download requires NASA **Earthdata Login (EDL)** credentials (`EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD` or `~/.netrc`), which are not configured in the current environment, and each full-frame HDF5 granule is **6.06–7.49 GB** (~55.5 GB for 4 pairs, exceeding the ~13.0 GB free disk space unless subsetted or streamed).
3. **Operational Real-Data Cross-Sensor Architecture:** To guarantee 100% real-data execution without fabricating NISAR measurements or violating storage constraints, Astera Watch operates a dual-track architecture:
   - **Track A (NISAR GCOV Native Track):** Complete HDF5 specification-compliant adapter (`NISAR_GCOV_Adapter`) for `/science/LSAR/GCOV/grids/frequencyA` (and `frequencyB`), dynamic polarimetric covariance discovery (`listOfPolarizations`), adaptive multi-look subswath `mask` decoding, $\gamma^0 \to \sigma^0$ conversion via `rtcGammaToSigmaFactor`, and live ASF CMR candidate pair verification.
   - **Track B (Verified Real-Data Cross-Sensor Track):** Real **Sentinel-1 Radiometrically Terrain-Corrected ($\gamma^0$) C-band SAR** (`sentinel-1-rtc`, VV/VH, 20 m UTM grid) paired with real **Sentinel-2 L2A** optical/SWIR (`sentinel-2-l2a`, `B08`/`B12`/`SCL` dNBR reference) and independent **NASA MODIS Terra+Aqua Burned Area Monthly L3 Global 500 m (`MCD64A1.061`, Concept ID `C2565786756-LPCLOUD`, DOI `10.5067/MODIS/MCD64A1.061`)** (`Burn_Date`, `Uncertainty`, `QA`, `First_Day`, `Last_Day`).
4. **Scientific Integrity Rules Enforced:**
   - Sentinel-1 C-band RTC products are explicitly labeled `is_nisar=False` and `data_origin="CROSS_SENSOR_PROTOTYPE"`.
   - Synthetic test fixtures (`data/mock/*.h5`) are isolated to unit tests and explicitly labeled `is_synthetic=True`.
   - Event-level spatial splitting (`TRAIN = CA_GANN_2026`, `VAL = CA_DOME_2026`, `TEST = CA_BUG_2026`, `EXCLUDED = CA_TIMBER_2026`) is strictly preserved without spatial or statistical leakage.

---

## 2. Primary Target: NASA NISAR Level-2 GCOV (`NISAR_L2_GCOV_V1`)

### 2.1 Official Product Identification
- **Short Name:** `NISAR_L2_GCOV_V1`
- **Long Name:** NISAR L-band Level-2 Geocoded Polarimetric Covariance (`GCOV`) Version 1
- **NASA CMR Concept ID:** `C3622241360-ASF`
- **Archive Center:** Alaska Satellite Facility (ASF) Distributed Active Archive Center (DAAC)
- **Format:** HDF5 (`.h5`) conforming to JPL D-102271 (*NISAR Level-2 Geocoded Polarimetric Covariance Product Specification*)
- **Radar Instrument:** L-band Synthetic Aperture Radar (LSAR), center frequency $1.257\text{ GHz}$, wavelength $\lambda \approx 23.84\text{ cm}$
- **Nominal Orbit Cycle:** 12-day exact repeat cycle

### 2.2 Release Maturity Timeline & Mission Gaps
- **Provisional Release (`2026-07-20`):** Public release of Provisional L1/L2 products (`CRID P05023`, PGE `R05.02.3`) for acquisitions starting **`2026-06-17`**.
- **Permanent Instrument Outage (`2026-07-27` to `2026-08-10`):** No NISAR science observations exist between **`2026-07-27T22:03:25Z`** and **`2026-08-10T00:55:27Z`** due to spacecraft/instrument operations. These frames will never be backfilled.
- **Validated Science Release (`2026-11-06`):** Public release of Validated L0–L2 science products (`CRID P05036`, PGE `R05.03.6`) covering acquisitions from **`2026-10-21` forward**.

### 2.3 Internal HDF5 Group Structure & Datasets
```text
/science/LSAR/
├── identification/
│   ├── zeroDopplerStartTime          # ISO-8601 UTC string (mandatory)
│   ├── zeroDopplerEndTime            # ISO-8601 UTC string
│   ├── trackNumber                   # Relative orbit track (1–175)
│   ├── frameNumber                   # Frame index along track
│   ├── orbitPassDirection            # "Ascending" or "Descending"
│   ├── boundingPolygon               # WKT polygon of scene footprint
│   ├── productVersion                # e.g., "0.9.0" / "1.0.0"
│   ├── compositeReleaseId            # "P05023" (Provisional) or "P05036" (Validated)
│   └── isGeocoded                    # True
└── GCOV/
    └── grids/
        ├── frequencyA/               # Primary science band (20 MHz / 40 MHz / 80 MHz; 10–20 m posting)
        │   ├── xCoordinates          # 1D float64 center easting coordinates (m)
        │   ├── yCoordinates          # 1D float64 center northing coordinates (m)
        │   ├── xCoordinateSpacing    # Scalar float64 (e.g., +20.0 m)
        │   ├── yCoordinateSpacing    # Scalar float64 (e.g., -20.0 m)
        │   ├── projection            # Scalar integer dataset with CF/CRS attributes (`epsg_code`, `spatial_ref`)
        │   ├── listOfPolarizations   # 1D array of strings (e.g., ["HH", "HV"] -> covariance terms)
        │   ├── listOfCovarianceTerms # 1D array of strings (e.g., ["HHHH", "HVHV", "HHHV"])
        │   ├── HHHH                  # 2D float32 real diagonal term: RTC gamma-0 linear power
        │   ├── HVHV                  # 2D float32 real diagonal term: RTC gamma-0 linear power
        │   ├── VVVV                  # 2D float32 real diagonal term (when dual-V or quad-pol mode)
        │   ├── VHVH                  # 2D float32 real diagonal term (when dual-V or quad-pol mode)
        │   ├── HHHV                  # 2D complex64 off-diagonal covariance term (optional mode)
        │   ├── mask                  # 2D uint8 validity & subswath ensemble code:
        │   │                         #   0 = invalid / radar shadow-layover masked
        │   │                         #   1..N = valid subswath / adaptive multi-looking ensemble ID
        │   │                         #   255 = fill / outside imaged swath
        │   ├── numberOfLooks         # 2D float32 effective number of looks (ENL) per pixel
        │   └── rtcGammaToSigmaFactor # 2D float32 factor: sigma0 = gamma0 * rtcGammaToSigmaFactor
        └── frequencyB/               # Secondary 5 MHz split-spectrum band (~80 m posting, when present)
```

### 2.4 Physical Scattering Response to Wildfire (L-Band vs C-Band)
- **Radiometric Terrain Flattening ($\gamma^0$):** NISAR GCOV diagonal terms (`HHHH`, `HVHV`, `VVVV`, `VHVH`) represent terrain-flattened radiometric backscatter $\gamma^0$ in linear power units ($\text{m}^2/\text{m}^2$). Using $\gamma^0$ rather than ellipsoid $\sigma^0$ mitigates topographic slope modulation in mountainous wildfire terrain (Sierra Nevada, Coast Ranges).
- **Volume Scattering Loss ($\Delta \gamma^0_{\text{HV}}$):** Cross-polarized backscatter (`HVHV` at L-band, `VH` at C-band) is dominated by multiple volume scattering within forest canopy branches, twigs, and foliage. Wildfire consumption of needles, leaves, and small/medium branches reduces canopy volume scattering, causing a characteristic post-fire decrease ($\Delta \gamma^0_{\text{cross}} = 10\log_{10}(\gamma^0_{\text{post}} / \gamma^0_{\text{pre}}) < 0\text{ dB}$) and a reduction in the depolarization ratio ($\gamma^0_{\text{cross}} / \gamma^0_{\text{co}}$).
- **Moisture & Dielectric Confounders:** Post-fire rainfall or soil moisture elevation increases surface dielectric constant $\varepsilon_r$, which can increase co-polarized (`HHHH` / `VV`) surface scattering and partially offset canopy loss. Multi-polarization features (`VV`, `VH`, $\Delta\text{VV}$, $\Delta\text{VH}$, $\text{VH}/\text{VV}$, spatial texture) and multi-date post-fire composites reduce single-date soil-moisture false positives.

---

## 3. Operational SAR Source: Copernicus Sentinel-1 RTC (`sentinel-1-rtc`)

- **Collection:** `sentinel-1-rtc` (Microsoft Planetary Computer STAC API, `https://planetarycomputer.microsoft.com/api/stac/v1`, derived from ESA Copernicus Sentinel-1A/1C IW GRD terrain-corrected to $\gamma^0$ using PlanetDEM/COP-DEM 30 m).
- **Sensor & Band:** C-band SAR ($5.405\text{ GHz}$, $\lambda \approx 5.55\text{ cm}$), Interferometric Wide Swath (IW) mode.
- **Polarizations:** Dual-polarization `VV` (co-pol) and `VH` (cross-pol) in linear $\gamma^0$ power.
- **Native Posting & Target Grid:** Resampled via `WarpedVRT` onto a common event-specific $20\text{ m} \times 20\text{ m}$ local UTM grid ($800 \times 800\text{ pixels} = 16\text{ km} \times 16\text{ km} = 256\text{ km}^2$).
- **Temporal Sampling in Astera Watch:** Two pre-fire scenes ($t_0, t_1$) and two post-fire scenes ($t_2, t_3$) per event, enabling both temporal-median pre/post log-ratio change detection and 4-step Cumulative Sum (`CUSUM`) sequential change detection.

---

## 4. Optical Burn Severity Reference: Copernicus Sentinel-2 L2A (`sentinel-2-l2a`)

- **Collection:** `sentinel-2-l2a` (Bottom-of-Atmosphere surface reflectance $\rho_{\text{BOA}}$).
- **Spectral Bands Used:**
  - `B08` (Near-Infrared, $\lambda_c = 842\text{ nm}$, $10\text{ m}$ native resolution, resampled to $20\text{ m}$ grid via bilinear interpolation).
  - `B12` (Short-Wave Infrared 2, $\lambda_c = 2190\text{ nm}$, $20\text{ m}$ native resolution).
  - `SCL` (Scene Classification Layer, $20\text{ m}$ native resolution, resampled via nearest-neighbor).
- **Quality & Cloud Masking (`SCL`):**
  - **Valid Land/Water Classes (`SCL_VALID_CLASSES`):** `4` (Vegetation), `5` (Not-vegetated / bare / burned), `6` (Water — retained for scene validity but excluded from burned-area positive class via $\text{NBR}_{\text{pre}}$ / spectral checks), `7` (Unclassified low-probability cloud/land).
  - **Invalid / Masked Classes (`SCL_INVALID_CLASSES`):** `0` (No Data), `1` (Saturated/Defective), `2` (Dark Area / Topographic Shadow), `3` (Cloud Shadows), `8` (Cloud Medium Probability), `9` (Cloud High Probability), `10` (Thin Cirrus), `11` (Snow/Ice).
- **Normalized Burn Ratio (NBR) & Differenced NBR (dNBR):**
  $$\text{NBR} = \frac{\rho_{\text{B08}} - \rho_{\text{B12}}}{\rho_{\text{B08}} + \rho_{\text{B12}}}, \qquad \text{dNBR} = \text{NBR}_{\text{pre}} - \text{NBR}_{\text{post}}$$
- **Calibration Rule (No Test Leakage):** Binary burned-area reference mask ($\text{dNBR} \ge \tau_{\text{dNBR}}$) is calibrated strictly on the **TRAIN** event (`CA_GANN_2026`) against independent MODIS `MCD64A1.061` burned area, yielding $\tau_{\text{dNBR}} = 0.11$ (aligned with the USGS/Key & Benson 2006 low-burn-severity boundary of $0.10$).

---

## 5. Independent NASA Burned-Area Product: MODIS `MCD64A1.061`

- **Collection:** `MCD64A1.061` (`modis-64A1-061` on Planetary Computer STAC; NASA LP DAAC Concept ID `C2565786756-LPCLOUD`, DOI `10.5067/MODIS/MCD64A1.061`).
- **Spatial & Temporal Resolution:** Monthly $500\text{ m}$ sinusoidal grid (reprojected via nearest-neighbor `WarpedVRT` to the $20\text{ m}$ UTM grid).
- **Science Data Sets (SDS Layers):**
  1. `Burn_Date` (`INT16`): Ordinal day of burn ($1\text{–}366$); `0` = unburned land; `-1` = unmapped due to insufficient data; `-2` = water.
  2. `Uncertainty` (`UINT8`): Estimated uncertainty in day of burn (days, $1\text{–}100$).
  3. `QA` (`UINT8` bitmask):
     - Bit 0: Land/water flag (`1` = land, `0` = water)
     - Bit 1: Valid data flag (`1` = sufficient valid observations, `0` = insufficient)
     - Bit 2: Shortened mapping period (`1` = period shortened, `0` = full month)
     - Bit 3: Grid cell relabeled during contextual relabeling (`1` = relabeled, `0` = not relabeled)
     - Bit 4: Spare (`0`)
     - Bits 5–7: Special condition code (`0` = none, `1` = agricultural burn, `2` = too few training observations, `3` = spectral bounds saturated)
  4. `First_Day` (`INT16`): First valid day of reliable mapping in the year ($1\text{–}366$).
  5. `Last_Day` (`INT16`): Last valid day of reliable mapping in the year ($1\text{–}366$).
- **Role in Astera Watch:** Independent NASA satellite burned-area product used (a) on `TRAIN` (`CA_GANN_2026`) to calibrate the Sentinel-2 $\text{dNBR}$ threshold without hand-tuning, and (b) across all events (`TRAIN`, `VAL`, `TEST`) as an independent coarse-resolution ($500\text{ m}$) validation benchmark alongside $20\text{ m}$ Sentinel-2 $\text{dNBR}$.

---

## 6. Active Fire Hotspot Context: NASA FIRMS (`VIIRS` / `MODIS`)

- **Service:** NASA Fire Information for Resource Management System (`https://firms.modaps.eosdis.nasa.gov/api/area/csv`).
- **Sensors:** Suomi-NPP VIIRS ($375\text{ m}$), NOAA-20 / NOAA-21 VIIRS ($375\text{ m}$), Terra/Aqua MODIS ($1\text{ km}$).
- **Scientific Role & Limitation:** Provides thermal anomaly detections (`latitude`, `longitude`, `acq_date`, `acq_time` UTC, `confidence` [`l`/`n`/`h` or $0\text{–}100$], `frp` in MW) for ignition timing and active fire progression context. **FIRMS point detections are never treated as pixel-level burned-area segmentation polygons.**

---

## 7. Multi-Sensor Data Source Comparison Table

| Source / Product | Agency / Archive | Sensor / Band | Native Resolution | Key Layers | Role in Astera Watch | Auth Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`NISAR_L2_GCOV_V1`** (`C3622241360-ASF`) | NASA / ISRO / ASF DAAC | L-band SAR ($\lambda = 23.8\text{ cm}$) | $10\text{–}20\text{ m}$ (`frequencyA`) | `HHHH`, `HVHV`, `mask`, `numberOfLooks`, `rtcGammaToSigmaFactor` | Primary scientific target; native HDF5 adapter & verified CMR pairs | CMR metadata: Public; HDF5 download: Earthdata Login |
| **`sentinel-1-rtc`** | ESA / Planetary Computer | C-band SAR ($\lambda = 5.55\text{ cm}$) | $10\text{–}20\text{ m}$ | `vv`, `vh` (linear $\gamma^0$ RTC) | Operational pre/post SAR time series ($t_0, t_1, t_2, t_3$) | Public (STAC + SAS token) |
| **`sentinel-2-l2a`** | ESA / Planetary Computer | MSI Optical / SWIR | $10\text{–}20\text{ m}$ | `B08` (NIR), `B12` (SWIR2), `SCL` | $20\text{ m}$ pre/post $\text{dNBR}$ reference & cloud/shadow mask | Public (STAC + SAS token) |
| **`MCD64A1.061`** (`C2565786756-LPCLOUD`) | NASA LP DAAC / Planetary Computer | MODIS Terra+Aqua | $500\text{ m}$ monthly | `Burn_Date`, `Uncertainty`, `QA`, `First_Day`, `Last_Day` | Independent NASA burned-area calibration & validation reference | Public via STAC (`modis-64A1-061`) |
| **NASA FIRMS** | NASA LANCE / MODAPS | VIIRS $375\text{ m}$ / MODIS $1\text{ km}$ | Point hotspots | `acq_date`, `acq_time`, `confidence`, `frp` | Ignition timing & active fire context (never segmentation labels) | `FIRMS_MAP_KEY` (graceful fallback if absent) |

---

## 8. Scientific Justification for the Dual-Track Design

1. **Why Before-Fire vs After-Fire Pair Alignment is Mandatory:** Single-date post-fire SAR cannot distinguish pre-existing bare rock, sparse shrubland, water bodies, or steep fore-slopes from wildfire damage. Differencing radiometrically terrain-flattened ($\gamma^0$) co-registered pre-fire and post-fire scenes in identical viewing geometry (same orbit direction and relative orbit/track where available) isolates temporal structural change ($\Delta \gamma^0$) from static topography and land cover.
2. **Why NISAR Adapter + Sentinel-1 RTC Execution is Scientifically Sound:** Both `NISAR_L2_GCOV_V1` (`HHHH`/`HVHV`) and `sentinel-1-rtc` (`VV`/`VH`) represent geocoded, radiometrically terrain-flattened $\gamma^0$ linear backscatter power on a projected UTM meter grid. The feature engineering ($\gamma^0_{\text{pre, dB}}$, $\gamma^0_{\text{post, dB}}$, $\Delta \gamma^0_{\text{dB}}$, depolarization change, local spatial standard deviation) and model architectures (Log-Ratio, CUSUM, LightGBM, U-Net ResNet-34) are mathematically identical across both sensors while preserving explicit sensor provenance (`is_nisar`).

---

## 9. Official References & Documentation Links

1. **NASA Space Apps Challenge 2026 — Dancing with the SARs:** `https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/?tab=resources`
2. **ASF NISAR Data User Guide:** `https://nisar-docs.asf.alaska.edu/`
3. **NASA CMR API (`NISAR_L2_GCOV_V1`):** `https://cmr.earthdata.nasa.gov/search/collections.json?concept_id=C3622241360-ASF`
4. **MODIS `MCD64A1.061` User Guide & LP DAAC Page:** `https://doi.org/10.5067/MODIS/MCD64A1.061`
5. **NASA FIRMS API Documentation:** `https://firms.modaps.eosdis.nasa.gov/api/`
6. **Key, C. H., & Benson, N. C. (2006):** *Landscape Assessment (LA): Sampling and Analysis Methods* (FIREMON, USDA Forest Service RMRS-GTR-164-CD — NBR/dNBR severity thresholds).

---

## 10. Acquisition Requirements & Authentication Behaviour

| Resource | Public Discovery | Binary Data Access | Behaviour When Credentials Absent |
| :--- | :--- | :--- | :--- |
| **ASF / NASA CMR (`NISAR_L2_GCOV_V1`)** | Unauthenticated HTTPS (`asf_search` / CMR REST) | Requires `EARTHDATA_USERNAME` & `EARTHDATA_PASSWORD` or `~/.netrc` | Queries live CMR metadata, verifies footprint intersection & CRID, reports `AUTH_REQUIRED` blocker without fabricating HDF5 data |
| **Planetary Computer STAC (`S1`, `S2`, `MCD64A1`)** | Unauthenticated HTTPS | Anonymous SAS token signing (`pc.apis.stac`) | Fully operational without user credentials; streams windowed AOI subsets via `WarpedVRT` |
| **NASA FIRMS API** | Requires `FIRMS_MAP_KEY` | CSV over HTTPS | `FIRMSClient.is_configured()` returns `False`; logs warning and returns empty hotspot list cleanly |

---

## 11. Live-Verified NISAR GCOV Event-Pair Availability (All 4 Study Events)

Live queries against `https://cmr.earthdata.nasa.gov/search/granules.json` across both **`NISAR_L2_GCOV_V1` (`C3622241360-ASF`, Validated `CRID P05036`)** and **`NISAR_L2_GCOV_PROVISIONAL_V1` (`C2854338529-ASF`, Provisional `CRID P05023`)** discovered **170 total granules** (`9` Validated `P05036` + `161` Provisional `P05023`) and **15 matched same-track, same-frame pre-fire/post-fire pairs** across all four 2026 California wildfire events (`data/real/nisar_cmr_candidates.json`):

| Event ID & Split | Primary Orbit (`Track/Frame`) | Pre-Fire NISAR GCOV Granule (`Date`, Size, Concept ID) | Immediate Post-Fire Granule (`Date`, Size, Concept ID) | Validated Post-Fire Granule (`Date`, Size, Concept ID) | Harmony AOI Subset Size |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`CA_GANN_2026`** (`TRAIN`) | `DESC` (`42 / 69`) | `NISAR_L2_PR_GCOV_026_042_D_069_4005_DHDH_A_20260723T025606_20260723T025641_P05023_N_F_J_001` (`2026-07-23`, $6,770.46\text{ MB}$, `G4260296005-ASF`) | `NISAR_L2_PR_GCOV_028_042_D_069_4005_DHDH_A_20260816T025605_20260816T025640_P05023_N_F_J_001` (`2026-08-16`, $6,774.52\text{ MB}$, `G4284565052-ASF`) | `NISAR_L2_PR_GCOV_034_042_D_069_4005_DHDH_A_20261027T025605_20261027T025640_P05036_N_F_J_001` (`2026-10-27`, $6,766.48\text{ MB}$, `G4406462944-ASF`) | $\sim 5.12\text{ MB}$ / pair |
| **`CA_TIMBER_2026`** (`EXCLUDED`) | `DESC` (`42 / 70`) | `NISAR_L2_PR_GCOV_026_042_D_070_4005_DHDH_A_20260723T025640_20260723T025715_P05023_N_F_J_001` (`2026-07-23`, $6,126.01\text{ MB}$, `G4260298818-ASF`) | `NISAR_L2_PR_GCOV_028_042_D_070_4005_DHDH_A_20260816T025639_20260816T025713_P05023_N_F_J_001` (`2026-08-16`, $5,985.67\text{ MB}$, `G4284560161-ASF`) | `NISAR_L2_PR_GCOV_034_042_D_070_4005_DHDH_A_20261027T025639_20261027T025714_P05036_N_F_J_001` (`2026-10-27`, $6,134.17\text{ MB}$, `G4406466150-ASF`) | $\sim 5.12\text{ MB}$ / pair |
| **`CA_DOME_2026`** (`VAL`) | `DESC` (`42 / 69`) | `NISAR_L2_PR_GCOV_030_042_D_069_4005_DHDH_A_20260909T025604_20260909T025639_P05023_N_F_J_001` (`2026-09-09`, $6,770.42\text{ MB}$, `G4311254441-ASF`) | `NISAR_L2_PR_GCOV_034_042_D_069_4005_DHDH_A_20261027T025605_20261027T025640_P05036_N_F_J_001` (`2026-10-27`, $6,766.48\text{ MB}$, `G4406462944-ASF`) | `NISAR_L2_PR_GCOV_034_042_D_069_4005_DHDH_A_20261027T025605_20261027T025640_P05036_N_F_J_001` (`2026-10-27`, $6,766.48\text{ MB}$, `G4406462944-ASF`) | $\sim 5.12\text{ MB}$ / pair |
| **`CA_BUG_2026`** (`TEST`) | `DESC` (`42 / 68`) | `NISAR_L2_PR_GCOV_026_042_D_068_4005_DHDH_A_20260723T025530_20260723T025607_P05023_N_F_J_001` (`2026-07-23`, $6,865.52\text{ MB}$, `G4260295244-ASF`) | `NISAR_L2_PR_GCOV_028_042_D_068_4005_DHDH_A_20260816T025529_20260816T025606_P05023_N_F_J_001` (`2026-08-16`, $6,865.57\text{ MB}$, `G4284562405-ASF`) | `NISAR_L2_PR_GCOV_034_042_D_068_4005_DHDH_A_20261027T025530_20261027T025606_P05036_N_F_J_001` (`2026-10-27`, $6,677.13\text{ MB}$, `G4406486031-ASF`) | $\sim 5.12\text{ MB}$ / pair |

- **NASA Harmony Subsetting Verification (`https://harmony.earthdata.nasa.gov/capabilities`):**
  Both `C3622241360-ASF` (`NISAR_L2_GCOV_V1`) and `C2854338529-ASF` (`NISAR_L2_GCOV_PROVISIONAL_V1`) support server-side `bbox` spatial subsetting, `variable` subsetting (`20` variables including `HHHH`, `HVHV`, `mask`, `numberOfLooks`, `rtcGammaToSigmaFactor`), and `reprojection` via `nasa/harmony-gdal-adapter` and `asf/nisar-py`. Subsetting the 4 primary pairs to the $16\text{ km} \times 16\text{ km}$ AOIs reduces the total download size from **$51.49\text{ GB}$ (`BLOCKED_STORAGE`)** to **$\sim 20.48\text{ MB}$ (`BLOCKED_AUTH` only — requires NASA Earthdata Login OAuth2 at `urs.earthdata.nasa.gov`)**.

---

## 12. Storage & Hardware Budget Verification

- **Current Environment Verified (`2026-11-13`):**
  - OS: Windows 11 (`AMD64`)
  - Python: `3.13.7`
  - PyTorch: `2.12.1+cpu` (`torch.cuda.is_available() == False`, `device_count == 0`)
  - Free Disk Space on `C:`: **`12.53 GB` (`11.67 GiB`)**
- **Storage Budget Policy:**
  - Full-frame NISAR GCOV HDF5 pairs ($8 \text{ granules} \approx 51.49\text{ GB}$) cannot be downloaded in full onto a $12.53\text{ GB}$ disk (`BLOCKED_STORAGE`).
  - Harmony-subsetted NISAR GCOV pairs ($\sim 20.48\text{ MB}$) fit easily within the disk budget and are blocked solely by missing local NASA Earthdata Login credentials (`BLOCKED_AUTH`).
  - All AOI raster stacks (`800 × 800` at $20\text{ m}$), ancillary QA/Uncertainty layers, and exported GeoTIFF/GeoJSON/PNG products remain under **$350\text{ MB}$ total** across all 4 events (`162.88 MB` in `data/real/` + `22.5 MB` in `outputs/geospatial/`).

---

## 13. Smallest Scientifically Sufficient Dataset Specification

- **Spatial Domain:** 4 California 2026 wildfire AOIs (`16 km × 16 km`, `800 × 800` pixels at $20\text{ m}$ UTM).
- **Active Modeling Split (3 Events, Zero Overlap):**
  1. `CA_GANN_2026` (`TRAIN`, `EPSG:32610`): $121$ patches ($128 \times 128$, stride $64$), $14.45\%$ burned pixels ($90,789 / 628,295$ valid pixels; $36.316\text{ km}^2$).
  2. `CA_DOME_2026` (`VAL`, `EPSG:32611`): $121$ patches ($128 \times 128$, stride $64$), $6.97\%$ burned pixels ($42,428 / 608,542$ valid pixels; $16.971\text{ km}^2$).
  3. `CA_BUG_2026` (`TEST`, `EPSG:32611`): $94$ patches ($128 \times 128$, stride $64$), $50.14\%$ burned pixels ($233,570 / 465,843$ valid pixels; $93.428\text{ km}^2$).
  4. `CA_TIMBER_2026` (`EXCLUDED`, `EPSG:32610`): Retained in `data/real/CA_TIMBER_2026/` for negative-control / complex-terrain diagnostic inspection (`include_in_training=False` due to overlapping Plaskett/Timber multi-burn history and mixed-orbit coherence loss).

---

## 14. Phase 2–12 Implementation Architecture

1. **Phase 2 & 3 (Acquisition & Metadata Expansion):**
   - Extend `backend/processing/acquisition/asf_client.py` with live NASA CMR (`C3622241360-ASF`) granule search, CRID/PGE maturity parsing, polygon intersection check, and explicit Earthdata Login status reporting.
   - Extend `backend/processing/acquisition/firms_client.py` with UTC timestamp normalization, VIIRS/MODIS confidence normalization (`LOW`/`NOMINAL`/`HIGH`), and AOI summary metrics.
   - Acquire and store all 5 `MCD64A1.061` layers (`Burn_Date`, `Uncertainty`, `QA`, `First_Day`, `Last_Day`) plus live NISAR CMR candidate manifests into `data/real/<EVENT_ID>/mcd64a1_ancillary.npz` and `data/real/nisar_cmr_candidates.json` without modifying existing `stack.npz` files.
2. **Phase 4 (Adapter & Preprocessing Hardening):**
   - Harden `backend/processing/adapters/nisar_gcov_adapter.py`: eliminate fabricated fallback timestamp (`2026-01-01T00:00:00Z`) and fabricated CRS (`EPSG:4326`), eliminate stateful `self.grid_path` mutation, support dynamic `listOfPolarizations` (real diagonal vs complex off-diagonal covariance terms), decode `mask` (`0` invalid, `1..N` valid subswath, `255` fill), and support $\gamma^0 \to \sigma^0$ conversion via `rtcGammaToSigmaFactor`.
   - Add `backend/processing/preprocessing/mcd64a1.py` to decode `MCD64A1.061` `QA` bitfields, `Burn_Date` special values (`0`, `-1`, `-2`), and `Uncertainty`.
3. **Phase 5 (Before/After Change Detection & Geospatial Products):**
   - Implement `backend/processing/change_detection/before_after.py` and `scripts/generate_before_after_products.py` executing the 16-step Before/After scientific verification and area-estimation pipeline, writing standard GeoTIFFs (`pre_vh_db.tif`, `post_vh_db.tif`, `delta_vh_db.tif`, `burn_prob.tif`, `burn_mask.tif`, `valid_mask.tif`), `aoi_boundary.geojson`, and `before_after_summary.json` under `outputs/geospatial/<EVENT_ID>/`.
4. **Phases 6–10 (Comprehensive Evaluation, Independent Validation & Backend API):**
   - Preserve existing checkpoints and `outputs/evaluation/real_model_comparison.json` while generating `outputs/evaluation/comprehensive_validation_report.json` with ROC-AUC, PR-AUC, FPR, FNR, inference latency, model size, and independent `MCD64A1.061` (QA-filtered) vs Sentinel-2 $\text{dNBR}$ cross-validation.
   - Expose additive FastAPI endpoints (`/api/events/{event_id}/before-after`, `/api/events/{event_id}/products`, `/api/events/{event_id}/validation`, `/api/nisar/candidates`) and support `USE_MOCK_DATA` cleanly.
5. **Phases 11–12 (Testing & Documentation):**
   - Expand unit and integration tests in `backend/tests/` and update all scientific and architectural documentation.
