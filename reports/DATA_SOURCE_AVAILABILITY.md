# DATA SOURCE AVAILABILITY REPORT
## Astera Watch — Live NASA, Earthdata, ASF, Harmony, LP DAAC & STAC Availability Audit
**Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*  
**Generated:** 2026-11-13  
**Machine-Readable Registry:** `data/real/data_source_registry.json` (`52` verified entries)

---

## 1. Live API & Catalog Query Summary

| Data Source / Service | Endpoint Queried | HTTP Status | Rate Limit / Auth Behavior | Availability Status |
| :--- | :--- | :--- | :--- | :--- |
| **NASA Open APIs / EONET v3** | `https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires` | `200 OK` | `X-RateLimit-Limit: 60` (`DEMO_KEY` / public; `59` remaining) | **`ACCESSIBLE`** (Event metadata only; not a SAR raster archive) |
| **NASA CMR Collections API** | `https://cmr.earthdata.nasa.gov/search/collections.json` | `200 OK` | Public REST API (no auth required for search) | **`ACCESSIBLE`** (`3` NISAR L2 GCOV collections + `MCD64A1.061` verified) |
| **NASA CMR Granules API (`NISAR_L2_GCOV_V1`)** | `https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C3622241360-ASF` | `200 OK` | Public metadata search | **`DISCOVERED`** (`9` Validated `CRID P05036` granules across 4 AOIs, Oct 26–27, 2026) |
| **NASA CMR Granules API (`NISAR_L2_GCOV_PROVISIONAL_V1`)** | `https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2854338529-ASF` | `200 OK` | Public metadata search | **`DISCOVERED`** (`161` Provisional `CRID P05023` granules across 4 AOIs, June 4 – Oct 19, 2026) |
| **NASA Harmony Capabilities API** | `https://harmony.earthdata.nasa.gov/capabilities?collectionId=C3622241360-ASF` (and `C2854338529-ASF`) | `200 OK` | Public capabilities inspection; OGC Coverages execution redirects (`303 See Other`) to `urs.earthdata.nasa.gov` | **`BLOCKED_AUTH`** (`bbox: true`, `variable: true`, `reprojection: true` confirmed; requires Earthdata Login OAuth2) |
| **ASF Earthdata Cloud Direct HDF5** | `https://nisar.asf.earthdatacloud.nasa.gov/NISAR/.../*.h5` | `302 Found` | Redirects to `https://urs.earthdata.nasa.gov/oauth/authorize`; `~6.1–6.9 GB` per file | **`BLOCKED_STORAGE`** & **`BLOCKED_AUTH`** |
| **Planetary Computer STAC (`sentinel-1-rtc`)** | `https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc` | `200 OK` | Anonymous SAS token signing via `planetary-computer` | **`PROCESSED`** & **`VERIFIED`** (`16` scenes, 4 per event, co-registered to 20 m UTM) |
| **Planetary Computer STAC (`sentinel-2-l2a`)** | `https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a` | `200 OK` | Anonymous SAS token signing | **`PROCESSED`** & **`VERIFIED`** (`8` pre/post scenes, 2 per event, co-registered to 20 m UTM) |
| **NASA LP DAAC / STAC (`MCD64A1.061`)** | `https://planetarycomputer.microsoft.com/api/stac/v1/collections/modis-64A1-061` | `200 OK` | Anonymous SAS token signing | **`PROCESSED`** & **`VERIFIED`** (`4` monthly tiles, all 5 SDS layers extracted: `Burn_Date`, `Uncertainty`, `QA`, `First_Day`, `Last_Day`) |
| **NASA FIRMS Active Fire API** | `https://firms.modaps.eosdis.nasa.gov/api/area/csv/...` | N/A | Requires `FIRMS_MAP_KEY` (`False` in environment) | **`BLOCKED_AUTH`** (Graceful fallback implemented in `FIRMSClient`) |

---

## 2. Official NISAR GCOV Collections Discovered in NASA CMR

1. **`C3622241360-ASF` (`NISAR_L2_GCOV_V1`):**
   - **Title:** *NISAR Validated Geocoded Polarimetric Covariance Product Version 1*
   - **CRID / PGE Version:** `P05036` (`R05.03.6`)
   - **Temporal Coverage:** `2026-10-21` onward (publicly released `2026-11-06`)
   - **Harmony Subsetting:** Supported (`bbox: true`, `variable: true`, `reprojection: true`)
2. **`C2854338529-ASF` (`NISAR_L2_GCOV_PROVISIONAL_V1`):**
   - **Title:** *NISAR Provisional Geocoded Polarimetric Covariance Product Version 1*
   - **CRID / PGE Version:** `P05023` (`R05.02.3`)
   - **Temporal Coverage:** `2026-06-04` through `2026-10-19` (publicly released `2026-07-20`; permanent outage `2026-07-27T22:03:25Z` to `2026-08-10T00:55:27Z`)
   - **Harmony Subsetting:** Supported (`bbox: true`, `variable: true`, `reprojection: true`)
3. **`C3622214170-ASF` (`NISAR_L2_GCOV_BETA_V1`):**
   - **Title:** *NISAR Beta Geocoded Polarimetric Covariance Product Version 1* (early calibration phase).

---

## 3. Matched Pre-Fire & Post-Fire NISAR GCOV Pairs Across All 4 Study Events

By querying both `C2854338529-ASF` (`Provisional P05023`) and `C3622241360-ASF` (`Validated P05036`), **15 exact same-orbit, same-track, same-frame pre-fire and post-fire NISAR L2 GCOV pairs** were discovered across the 4 wildfire AOIs (`data/real/nisar_cmr_candidates.json`):

| Event ID | Split | Ignition Date | Primary Orbit / Track / Frame | Pre-Fire Granule (`P05023`) | Immediate Post-Fire Granule (`P05023` / `P05036`) | Validated Post-Fire Granule (`P05036`) | Total Pairs Found |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`CA_GANN_2026`** | `TRAIN` | `2026-08-03` | `DESCENDING` Track `42` Frame `69` | `2026-07-23T02:56:06Z` (`6,770.46 MB`, `G4260296005-ASF`) | `2026-08-16T02:56:05Z` (`6,774.52 MB`, `G4284565052-ASF`) | `2026-10-27T02:56:05Z` (`6,766.48 MB`, `G4406462944-ASF`) | `3` |
| **`CA_DOME_2026`** | `VAL` | `2026-09-21` | `DESCENDING` Track `42` Frame `69` | `2026-09-09T02:56:04Z` (`6,770.42 MB`, `G4311254441-ASF`) | `2026-10-27T02:56:05Z` (`6,766.48 MB`, `G4406462944-ASF`) | `2026-10-27T02:56:05Z` (`6,766.48 MB`, `G4406462944-ASF`) | `5` (incl. `ASC T34 F21`: `2026-09-20` $\to$ `2026-10-02`) |
| **`CA_BUG_2026`** | `TEST` | `2026-08-08` | `DESCENDING` Track `42` Frame `68` | `2026-07-23T02:55:30Z` (`6,865.52 MB`, `G4260295244-ASF`) | `2026-08-16T02:55:29Z` (`6,865.57 MB`, `G4284562405-ASF`) | `2026-10-27T02:55:30Z` (`6,677.13 MB`, `G4406486031-ASF`) | `3` |
| **`CA_TIMBER_2026`** | `EXCLUDED` | `2026-08-09` | `DESCENDING` Track `42` Frame `70` | `2026-07-23T02:56:40Z` (`6,126.01 MB`, `G4260298818-ASF`) | `2026-08-16T02:56:39Z` (`5,985.67 MB`, `G4284560161-ASF`) | `2026-10-27T02:56:39Z` (`6,134.17 MB`, `G4406466150-ASF`) | `4` |

---

## 4. Machine-Readable Registry Summary (`data/real/data_source_registry.json`)

- **Total Registry Entries:** `52`
  - **`PROCESSED` & `VERIFIED` (`28` entries):**
    - `16` Sentinel-1A/1D C-band RTC scenes (`4` dates $\times$ `4` events)
    - `8` Sentinel-2A/2B L2A optical surface reflectance scenes (`2` dates $\times$ `4` events)
    - `4` NASA MODIS `MCD64A1.061` monthly burned-area & ancillary QA/Uncertainty tiles (`1` per event)
  - **`BLOCKED_AUTH` (`12` entries):**
    - `12` NASA Harmony OGC API Coverages spatial + variable subset requests (`pre_fire`, `post_fire_immediate`, `post_fire_validated` across 4 events; estimated `2.56 MB` each)
  - **`BLOCKED_STORAGE` & `BLOCKED_AUTH` (`12` entries):**
    - `12` full-frame ASF Earthdata Cloud NISAR L2 GCOV `.h5` granules (`5.99–6.87 GB` each)
