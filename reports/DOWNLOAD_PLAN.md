# STORAGE & DOWNLOAD PLAN
## Astera Watch — Phase 2 Storage Budget & Acquisition Engineering Plan
**Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*  
**Generated:** 2026-11-13

---

## 1. Local Disk & Memory Budget Audit

| Resource | Measured Value | Safe Operational Ceiling | Status |
| :--- | :--- | :--- | :--- |
| **Total Disk Capacity (`C:`)** | `462.66 GB` (`430.89 GiB`) | — | Verified |
| **Free Disk Space (`C:`)** | **`12.53 GB`** (`11.67 GiB`) | Keep `>= 5.0 GB` free OS safety buffer; max new data footprint `<= 2.0 GB` | Enforced |
| **System RAM** | `7.82 GiB` (`1.04 GiB` available) | Stream windowed AOI rasters (`800 × 800`); max batch size `8` | Enforced |

---

## 2. Granule vs. AOI Subset Storage Calculation

Each wildfire study AOI is a $16\text{ km} \times 16\text{ km}$ ($256\text{ km}^2$) bounding box gridded at $20\text{ m} \times 20\text{ m}$ ($800 \times 800 = 640,000\text{ pixels}$).

| Acquisition Mode | Per-Granule / Per-Event Size | Total Across 4 Events | Fits `12.53 GB` Disk Budget? | Execution Decision |
| :--- | :--- | :--- | :--- | :--- |
| **Full-Frame NISAR L2 GCOV HDF5 (`C2854338529-ASF` / `C3622241360-ASF`)** | `5.99 GB – 6.87 GB` per `.h5` granule | **`51.49 GB`** (4 primary pre/post pairs = 8 granules) | **NO (`BLOCKED_STORAGE`)** — exceeds total free disk (`12.53 GB`) by $4.1\times$ | **Do NOT download full-frame `.h5` files** |
| **NASA Harmony OGC Coverages Spatial + Variable Subset (`HHHH`, `HVHV`, `mask`, `numberOfLooks`, `rtcGammaToSigmaFactor`)** | $5 \text{ vars} \times 800 \times 800 \times 4\text{ B} \approx \mathbf{2.56\text{ MB}}$ per granule ($\sim 5.12\text{ MB}$ per pair) | **`~20.48 MB`** (8 subsetted granules) or **`~30.72 MB`** (12 granules incl. Validated `P05036`) | **YES** ($< 0.3\%$ of free disk) | **Prepared exact Harmony URLs in `nisar_cmr_candidates.json`; blocked solely by missing local Earthdata Login (`BLOCKED_AUTH`)** |
| **Windowed Sentinel-1 RTC + Sentinel-2 L2A + `MCD64A1.061` Co-Registered Stacks (`stack.npz`)** | `16.4 MB – 20.1 MB` per event | **`72.37 MB`** (4 events) | **YES** | **Downloaded, verified, and preserved (`PROCESSED`)** |
| **Supplemental `MCD64A1.061` Ancillary Layers (`mcd64a1_ancillary.npz`: `Burn_Date`, `Uncertainty`, `QA`, `First_Day`, `Last_Day`)** | `29 KB – 48 KB` per event | **`0.15 MB`** (4 events) | **YES** | **Downloaded and verified (`PROCESSED`)** |
| **Prepared Leakage-Safe Patch Dataset (`data/real/dataset/*.npz`)** | `336` patches ($5 \times 128 \times 128$) + 3 prepared scenes | **`90.35 MB`** | **YES** | **Built and verified (`PROCESSED`)** |
| **Exported Geospatial Products (`outputs/geospatial/<EVENT_ID>/*.tif`, `.geojson`, `.png`)** | `~5.6 MB` per event (8 GeoTIFFs + GeoJSON + 6-panel PNG + JSON summary) | **`22.52 MB`** (4 events) | **YES** | **Generated and verified (`PROCESSED`)** |

---

## 3. Exact NASA Harmony Subset Request Specification (Ready for Execution with Earthdata Credentials)

When NASA Earthdata Login credentials (`~/.netrc` with `machine urs.earthdata.nasa.gov login <user> password <pass>` or `EARTHDATA_TOKEN`) are provided, `ASFSearchClient.build_harmony_subset_url()` executes server-side subsetting via:
```text
https://harmony.earthdata.nasa.gov/{collection_concept_id}/ogc-api-coverages/1.0.0/collections/parameter_vars/coverage/rangeset
  ?granuleId={granule_concept_id}
  &subset=lat({min_lat}:{max_lat})
  &subset=lon({min_lon}:{max_lon})
  &crs=EPSG:32610
  &variable=/science/LSAR/GCOV/grids/frequencyA/HHHH,
            /science/LSAR/GCOV/grids/frequencyA/HVHV,
            /science/LSAR/GCOV/grids/frequencyA/mask,
            /science/LSAR/GCOV/grids/frequencyA/numberOfLooks,
            /science/LSAR/GCOV/grids/frequencyA/rtcGammaToSigmaFactor
```
All 12 exact Harmony subset URLs (pre-fire, immediate post-fire, and validated post-fire for all 4 events) are stored in `data/real/nisar_cmr_candidates.json` and `data/real/data_source_registry.json`.
