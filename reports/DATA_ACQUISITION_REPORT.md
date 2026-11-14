# DATA ACQUISITION & VERIFICATION REPORT
## Astera Watch — Phase 3 Real Satellite Data Acquisition & Checksum Audit
**Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*  
**Generated:** 2026-11-13

---

## 1. Acquired & Verified Real Satellite Datasets (`data/real/`)

Every file in `data/real/` has been independently verified on disk by byte size, SHA-256 checksum, array shape, dtype, CRS, affine geotransform, and acquisition timestamps (`data/real/data_source_registry.json`):

| Event ID | Split | Local File Path | Size (Bytes) | SHA-256 Checksum | CRS & Grid | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`CA_GANN_2026`** | `TRAIN` | `data/real/CA_GANN_2026/stack.npz` | `17,225,529` | `b49330001e3303d6104749d800cb36d86717dc231b04a1b9bb8750215be24089` | `EPSG:32610`, `800×800`, `20.0 m` | **`PROCESSED` & `VERIFIED`** |
| **`CA_GANN_2026`** | `TRAIN` | `data/real/CA_GANN_2026/mcd64a1_ancillary.npz` | `47,306` | Verified in `data_source_registry.json` (`dst_nodata=255` QA refresh) | `EPSG:32610`, `800×800`, `20.0 m` | **`PROCESSED` & `VERIFIED`** |
| **`CA_DOME_2026`** | `VAL` | `data/real/CA_DOME_2026/stack.npz` | `20,034,475` | `c5096658c76c29cf38b7f5a301ba27c85c544348e7b5759716a5e448e370a672` | `EPSG:32611`, `800×800`, `20.0 m` | **`PROCESSED` & `VERIFIED`** |
| **`CA_DOME_2026`** | `VAL` | `data/real/CA_DOME_2026/mcd64a1_ancillary.npz` | `29,858` | `66a42fa238ec2b770fd52b444802a90606024603229771968f6fd475ba332c20` | `EPSG:32611`, `800×800`, `20.0 m` | **`PROCESSED` & `VERIFIED`** |
| **`CA_BUG_2026`** | `TEST` | `data/real/CA_BUG_2026/stack.npz` | `18,546,204` | `f8ba276c9112b38477550a81db590f15f63bcfa666d8553a1d3ab0376b03d53e` | `EPSG:32611`, `800×800`, `20.0 m` | **`PROCESSED` & `VERIFIED`** |
| **`CA_BUG_2026`** | `TEST` | `data/real/CA_BUG_2026/mcd64a1_ancillary.npz` | `40,192` | `d411c6767ff2f5e6f49e8a9c626d4757ee9759fa065a044b15df0359571665e2` | `EPSG:32611`, `800×800`, `20.0 m` | **`PROCESSED` & `VERIFIED`** |
| **`CA_TIMBER_2026`** | `EXCLUDED` | `data/real/CA_TIMBER_2026/stack.npz` | `20,077,745` | `f82f4e9be832b71373c173c05212dc643635069a6782a4dc928718ff1b1b9769` | `EPSG:32610`, `800×800`, `20.0 m` | **`PROCESSED` & `VERIFIED`** |
| **`CA_TIMBER_2026`** | `EXCLUDED` | `data/real/CA_TIMBER_2026/mcd64a1_ancillary.npz` | `38,091` | `14d9f1b9cb5786bf563ba07a528a6209b02c5ab31e6e1c11386327441dc25971` | `EPSG:32610`, `800×800`, `20.0 m` | **`PROCESSED` & `VERIFIED`** |

---

## 2. Exact Acquired Granule & Scene Identifiers by Event

| Event ID | Ignition Date | Sentinel-1 RTC Scenes (`pre`, `mid`, `post`, `post2`) | Sentinel-2 L2A Scenes (`pre`, `post`) | NASA MODIS `MCD64A1.061` Granule |
| :--- | :--- | :--- | :--- | :--- |
| **`CA_GANN_2026`** (`TRAIN`) | `2026-08-03` | `S1A_IW_GRDH_1SDV_20260726T140748_..._rtc` (`2026-07-26`), `2026-08-07`, `2026-08-19`, `2026-08-31` (Orbit `42`, `descending`) | `S2B_MSIL2A_20260729T184919_R113_T10SGF` (`2026-07-29`), `S2B_MSIL2A_20260830T183919_R070_T10SGF` (`2026-08-30`) | `MCD64A1.A2026213.h08v05.061.2026286121320` (DOY `215–220`) |
| **`CA_DOME_2026`** (`VAL`) | `2026-09-21` | `S1A_IW_GRDH_1SDV_20260919T015928_..._rtc` (`2026-09-19`), `2026-10-01`, `2026-10-13`, `2026-10-25` (Orbit `137`, `ascending`) | `S2B_MSIL2A_20260917T183919_R070_T11SKB` (`2026-09-17`), `S2B_MSIL2A_20261027T184419_R070_T11SKB` (`2026-10-27`) | `MCD64A1.A2026244.h08v05.061.2026316180200` (DOY `264–273`) |
| **`CA_BUG_2026`** (`TEST`) | `2026-08-08` | `S1D_IW_GRDH_1SDV_20260803T015102_..._rtc` (`2026-08-03`), `2026-08-15`, `2026-08-27`, `2026-09-08` (Orbit `64`, `ascending`) | `S2B_MSIL2A_20260806T184919_R113_T10TGK` (`2026-08-06`), `S2A_MSIL2A_20260830T184831_R070_T10TGK` (`2026-08-30`) | `MCD64A1.A2026213.h08v05.061.2026286121320` (DOY `219–240`) |
| **`CA_TIMBER_2026`** (`EXCLUDED`) | `2026-08-09` | `S1A_IW_GRDH_1SDV_20260809T020737_..._rtc` (`2026-08-09`), `2026-08-14`, `2026-08-21`, `2026-09-02` (Orbits `35`/`137`) | `S2A_MSIL2A_20260803T185921_R013_T10SFF` (`2026-08-03`), `S2A_MSIL2A_20260902T185921_R013_T10SFF` (`2026-09-02`) | `MCD64A1.A2026213.h08v05.061.2026286121320` (DOY `221–228`) |

---

## 3. NISAR GCOV Acquisition Verification (`BLOCKED_AUTH` / `BLOCKED_STORAGE`)

- **Metadata Discovery (`VERIFIED`):** `170` NISAR L2 GCOV granules (`9` Validated `C3622241360-ASF` + `161` Provisional `C2854338529-ASF`) and `15` matched same-track, same-frame pre-fire/post-fire pairs were discovered via live NASA CMR queries and stored in `data/real/nisar_cmr_candidates.json`.
- **Binary HDF5 / Harmony Subset Acquisition (`BLOCKED_AUTH`):**
  - Live HTTP probes to both ASF Earthdata Cloud (`https://nisar.asf.earthdatacloud.nasa.gov/.../*.h5`) and NASA Harmony OGC API Coverages (`https://harmony.earthdata.nasa.gov/C2854338529-ASF/ogc-api-coverages/1.0.0/...`) return HTTP `302`/`303` redirects to `https://urs.earthdata.nasa.gov/oauth/authorize`.
  - Because no NASA Earthdata Login credentials (`~/.netrc`, `_netrc`, `EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`, `EARTHDATA_TOKEN`) exist on this machine, binary NISAR `.h5` granules and Harmony subsets are cleanly recorded as `BLOCKED_AUTH` (and full-frame `.h5` granules at `51.49 GB` for 4 pairs are additionally recorded as `BLOCKED_STORAGE`).
  - **Zero NISAR observations were fabricated.** All downstream products are explicitly tagged `is_nisar=False` and `data_origin="CROSS_SENSOR_PROTOTYPE"`.
