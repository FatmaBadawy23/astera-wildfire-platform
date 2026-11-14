# Astera Watch - Data Sources

This document describes the data actually used by the current experiments, the data that
was attempted but could not be obtained, and the access rules that must be followed.

**Current status:** the model results in this repository are a **cross-sensor prototype**
built from Sentinel-1 C-band SAR and Sentinel-2/MCD64A1 reference layers. They are **not**
NISAR results.

---

## 1. Data used

| Source | Product / collection | Provider | Role in this study |
|---|---|---|---|
| Sentinel-1 | `sentinel-1-rtc` (RTC, VV/VH, 20 m) | Microsoft Planetary Computer | SAR model input |
| Sentinel-2 | `sentinel-2-l2a` (L2A, B04/B08/B12/SCL, 20 m) | Microsoft Planetary Computer | dNBR reference labels and independent optical check |
| MODIS | `modis-64A1-061` (MCD64A1 burned area, 500 m) | Microsoft Planetary Computer | Coarse independent burned-area check; also used to locate burn-scar centroids and burn-date windows |
| Public incident reporting | 2026 California/Nevada fire names, ignition dates, reported acreage | Public fire-agency reporting | Event identity only; not used as a pixel label |

### 1.1 Sentinel-1 RTC

- Collection ID: `sentinel-1-rtc`
- Bands read: `vv`, `vh`
- Native product: radiometrically terrain-corrected gamma0, 10 m; read onto a 20 m analysis grid
- Orbits used in the final experiments:

| Event | Relative orbit | Pass | Dates used |
|---|---|---|---|
| Gann | 42 | descending | 2026-07-26, 2026-08-07, 2026-08-19, 2026-08-31 |
| Dome | 137 | ascending | 2026-08-31, 2026-09-12, 2026-10-06, 2026-10-18 |
| Bug | 64 | ascending | 2026-08-03, 2026-08-15, 2026-08-27, 2026-09-08 |
| Timber (acquisition only) | 35 | ascending | 2026-07-26, 2026-08-07, 2026-08-19, 2026-08-31 |

Only acquisitions on the same relative orbit and pass are combined. This avoids mixing
viewing geometries inside one event.

### 1.2 Sentinel-2 L2A

- Collection ID: `sentinel-2-l2a`
- Bands read: `B04` (red), `B08` (NIR), `B12` (SWIR-2), `SCL` (scene classification)
- Used dates and tiles in the final stacks:

| Event | Pre date / tile | Post date / tile | SCL-valid fraction (pre / post) |
|---|---|---|---|
| Gann | 2026-07-29 / T10SGF | 2026-08-28 / T10SGF | 0.996 / 0.985 |
| Dome | 2026-09-12 / T11SKB | 2026-10-07 / T11SKB | 0.996 / 0.951 |
| Bug | 2026-08-06 / T10TGK | 2026-08-30 / T10TGK | 1.000 / 1.000 |
| Timber | 2026-07-27 / T10SFF | 2026-08-26 / T10SFF | 0.997 / 0.906 |

Tile selection is described in `docs/PREPROCESSING.md`. In short, candidate tiles are
scored by the actual fraction of usable SCL classes over the AOI, not by scene-wide cloud
cover or footprint overlap. This matters: an earlier Gann tile had low reported cloud
cover but 58.3% no-data over the AOI.

### 1.3 MCD64A1

- Collection ID: `modis-64A1-061` (NASA LP DAAC Concept ID `C2565786756-LPCLOUD`, DOI `10.5067/MODIS/MCD64A1.061`)
- Assets used:
  - `Burn_Date` (`INT16`: `1..366` ordinal day of burn, `0` = unburned land, `-1` = unmapped, `-2` = water)
  - `Burn_Date_Uncertainty` (`UINT8`: estimated burn-date uncertainty in days, stored in `data/real/<EVENT_ID>/mcd64a1_ancillary.npz`)
  - `QA` (`UINT8` bitmask: Bit 0 land/water, Bit 1 valid data, Bit 2 shortened mapping period, Bit 3 contextual relabeling, Bits 5–7 special condition code)
  - `First_Day` and `Last_Day` (`INT16`: reliable mapping window bounds)
- August 2026 granule: `MCD64A1.A2026213.h08v05.061.2026286121320`
- September 2026 granule: `MCD64A1.A2026244.h08v05.061.2026314113209`
- All MCD64A1 layers are reprojected to the 20 m UTM grid with nearest-neighbour resampling (`backend/processing/preprocessing/mcd64a1.py`).
- Burn-date windows (day of year, 2026):

| Event | DOY window | Approximate dates |
|---|---|---|
| Gann | 215-222 | 2026-08-03 to 2026-08-10 |
| Timber | 219-243 | 2026-08-07 to 2026-08-31 |
| Dome | 244-273 | 2026-09-01 to 2026-09-30 |
| Bug | 219-240 | 2026-08-07 to 2026-08-28 |

MCD64A1 is a 500 m coarse product. It is an **independent check**, not ground truth and
not the training label.

### 1.4 Access method and reproducibility

All three remote collections were read through the Microsoft Planetary Computer STAC and
SAS endpoints:

- STAC search: `https://planetarycomputer.microsoft.com/api/stac/v1/search`
- SAS token: `https://planetarycomputer.microsoft.com/api/sas/v1/token/{collection_id}`
- Per-asset signing: `https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=...`

The acquisition script reads only the AOI window; it does not download full granules.
Every acquisition record stores the STAC item IDs, asset URLs, acquisition datetimes,
relative orbit/pass, SCL valid fractions, and SHA-256 checksums for the aligned arrays.
See `data/real/acquisition_manifest.json`.

Rate limiting: the signing endpoint returns HTTP 429 under bursts. The client retries with
backoff and caches tokens. A full four-event acquisition is reproducible but should be run
sequentially, not as parallel jobs.

---

## 2. NISAR: not acquired

NISAR is the intended primary sensor for the platform, but **no NISAR scene was downloaded
or used in these experiments**.

Why:

- NISAR GCOV science products require NASA Earthdata Login (EDL).
- No `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD`, `.netrc` entry, Earthdata token, or
  authenticated session was available in the execution environment.
- The official ASF/NISAR documentation confirms that EDL authentication is mandatory; it
  is not an optional or rate-limit workaround.

The platform keeps the NISAR GCOV adapter (`backend/processing/adapters/nisar_gcov_adapter.py`) and live NASA CMR candidate pair verifier (`data/real/nisar_cmr_candidates.json`) first-class across both:
- **`NISAR_L2_GCOV_V1`** (`C3622241360-ASF`, Validated `CRID P05036`, released `2026-11-06` for acquisitions from `2026-10-21` onward), and
- **`NISAR_L2_GCOV_PROVISIONAL_V1`** (`C2854338529-ASF`, Provisional `CRID P05023`, covering `2025-10-17` to `2026-10-21`).

Live CMR metadata and `asf_search` queries discovered **170 NISAR GCOV granules** (`9` Validated `P05036` + `161` Provisional `P05023`) and **15 matched same-geometry pre-fire (`P05023`) and post-fire (`P05023` immediate + `P05036` validated) pairs** covering 100% of all four event AOIs (`51.49 GB` total for the 8 primary full HDF5 granules, classified `BLOCKED_STORAGE` under the 13.0 GB local disk budget; or **`~20.48 MB` total** via NASA Harmony OGC API Coverages spatial + variable subsetting, classified `BLOCKED_AUTH` solely due to missing local Earthdata Login credentials). All 52 local and remote dataset entries are catalogued with SHA-256 checksums and exact status codes in `data/real/data_source_registry.json`.

Additional timing limitation: the NISAR mission data gap from
`2026-07-27T22:03:25Z` to `2026-08-10T00:55:27Z` overlaps the pre/post pairing window of
the August 2026 fires. Even with credentials, the exact August pair used here could not be
reproduced from NISAR for every event.

### What genuine NISAR training would require

1. Earthdata Login credentials, supplied only through environment variables or `.netrc`.
2. A NISAR GCOV search over each AOI, restricted to one frequency, one track/frame, and
   consistent ascending/descending geometry.
3. Pre-fire and post-fire acquisitions that bracket the fire and are not separated by the
   mission data gap.
4. Reading `/science/LSAR/GCOV/grids/frequencyA/{HHHH,HVHV,VVVV,VHVH,...}`, applying
   `rtcGammaToSigmaFactor` if sigma0 is required, and treating the `mask` dataset as
   averaging-ensemble information rather than a binary validity mask.
5. Re-running label calibration, training, validation, and testing with NISAR as the only
   input sensor. Sentinel-1 results must not be relabelled as NISAR.

No credentials are printed, logged, or committed. `.env.example` contains empty
placeholders only.

---

## 3. FIRMS: not used

NASA FIRMS is an active-fire detection product. It is not a burned-area boundary and must
not be used as dense pixel-level training truth. A FIRMS `MAP_KEY` was not available, so
FIRMS was not queried in this study. Event discovery used public incident reporting and
MCD64A1 burn scars instead.

---

## 4. Licensing and attribution

- Sentinel-1 and Sentinel-2: Copernicus Open Access.
- MODIS MCD64A1: NASA Open Data.
- NISAR: NASA Open Data, subject to Earthdata Login.
- Public incident reporting: used for event identity and reported acreage only.

When reusing these results, cite the upstream data providers and this repository's
provenance manifest. Do not cite the numbers as NISAR performance.
