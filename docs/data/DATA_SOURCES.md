# Data sources

**Today the application uses no live satellite data.** Everything about fires and radar shown in the app is
**synthetic demo data**. The only real data in the repository are the Natural Earth map files, which give
geographic context only.

## Summary

| Source | Status in this repository | Format | Licence / terms |
|---|---|---|---|
| Synthetic demo data | **In use** (frontend mock adapter) | TypeScript fixtures, `frontend/src/data/mock/` | Project-made; labelled synthetic |
| Natural Earth 1:110m admin-0 countries | **In use** (outlines, names, country search) | GeoJSON / JSON, `frontend/public/basemap/` | Public domain |
| Natural Earth I with Shaded Relief and Water, 1:50m | **In use** (map background) | JPEG tiles, `frontend/public/basemap/relief/` | Public domain |
| NASA FIRMS active fires | **Planned**, not connected | (CSV/API; to be confirmed in Stage 6) | NASA open data terms; a free FIRMS MAP_KEY is needed (`FIRMS_MAP_KEY` in `.env.example`) |
| NASA NISAR (GCOV, GSLC) via ASF | **Planned**, not connected; product layout **unverified** | HDF5 | NASA open data; Earthdata login needed (`EARTHDATA_*` in `.env.example`) |
| Copernicus Sentinel-1 (via the Copernicus Data Space Ecosystem) | **Planned** for testing only, not connected | (e.g. GeoTIFF RTC; to be confirmed) | Copernicus free and open terms; CDSE account needed (`CDSE_*` in `.env.example`) |

The access details in parentheses come from the planned configuration (`.env.example`, roadmap Stages 3 and 6). No
client code exists yet, so the formats, endpoints and update frequencies must be confirmed by whoever builds Stage 6.

## Synthetic demo data (in use)

- File: `frontend/src/data/mock/fixtures.ts` and `detections.ts`. 6 possible fires (IDs `SYN-01` … `SYN-06`), 612
  FIRMS-style detections, simulated radar scenes, availability checks and analysis results. Demo period: 2026-07-01
  to 2026-08-31.
- Locations are **invented coordinates placed inside real countries** (so country search can be tried). They don't
  describe any real fire.
- Every record has provenance origin `synthetic` and the note "Synthetic example, not a satellite observation."
  The app shows one "Demo data" bar on every page, says "Invented location" on each item, and labels exports
  `synthetic`.
- **Must never be presented as real observations**, in the UI, exports, screenshots, presentations or reports.

## Natural Earth (in use; geographic context only)

| File | Source | Processing |
|---|---|---|
| `basemap/countries-110m.geojson` | Natural Earth 1:110m Cultural, Admin 0 Countries (`ne_110m_admin_0_countries`), downloaded 2026-11-11 | Reduced to ISO3 code + name, coordinates rounded to 2 decimals |
| `basemap/country-labels.json` | Same source | Label point (`LABEL_X`/`LABEL_Y`), `MIN_LABEL`, `LABELRANK` per country |
| `basemap/relief/{z}/{x}/{y}.jpg` | Natural Earth I with Shaded Relief and Water, 1:50m (`NE1_50M_SR_W`), downloaded 2026-11-13 from naciscdn.org | Reprojected to Web Mercator, 512 px tiles, zoom 0–4, JPEG quality 82. Colours unchanged; the app softens them per theme. Details: `basemap/relief/SOURCE.txt` |

Gap: the exact Natural Earth release version and download URL of the 1:110m countries file weren't recorded. The
processing scripts were one-off and aren't in the repository. Re-download from naturalearthdata.com if the files
need to be rebuilt.

**What the background map can and can't tell you:** green = usually vegetated, tan/brown = dry or bare, white =
ice, blue = water. It is a **long-term, generalised picture**, not current vegetation, fire or burned land, and not
an observation of any date. A green area may already have burned. At zoom levels above 4 it is only enlarged, so
it looks soft. Country outlines are simplified (1:110m) and are not authoritative borders.

## What each data source can and can't establish

| Data | Can establish | Can't establish |
|---|---|---|
| **FIRMS active-fire detections** (heat spots) | That a satellite sensor detected a thermal anomaly at a place and time, with the source's confidence value | That there was a wildfire (heat can come from industry, gas flares, volcanoes), its size or intensity, burned-area boundaries, or that it is burning now. Detections are points, never burned-area polygons or ground truth |
| **Possible fires** (candidate events = grouped detections) | That detections cluster in space and time | That a fire is confirmed. Astera Watch does not confirm fires |
| **Detection density** (shaded squares) | How many detections fall in a grid square in a period (exact counts) | Burned area, fire intensity or severity. Levels are relative to the busiest square at the current zoom |
| **Radar backscatter change** (NISAR or Sentinel-1) | That the radar signal changed between two comparable acquisitions; an **estimated** changed area with an uncertainty range | Proof of burned area, or the cause of the change. Backscatter also changes with vegetation, soil moisture, roughness, viewing geometry, frequency and polarization |
| **Natural Earth background** | General geographic context | Current land cover, vegetation, fire or damage |
| **Any of the above** | — | **Whether a place is safe, or whether to evacuate.** Satellite data alone can't say this. Astera Watch is not an emergency service; people must follow local authorities |

## NISAR vs Sentinel-1: not interchangeable

| | NISAR (NASA–ISRO) | Sentinel-1 (ESA Copernicus) |
|---|---|---|
| Radar band | L-band and S-band (shown separately; a band is never assumed if a product doesn't state it) | C-band |
| Products planned | GCOV (covariance) and GSLC (complex), processed **separately** | RTC / GeoTIFF (to be confirmed) |
| Status | File layout, units and quality flags **unverified** until real products are inspected (roadmap Stage C); assumptions must be marked `# NISAR-INTEGRATION` | Test data only; results are always labelled "Sentinel-1 C-band, not NISAR" |

Rules: images are compared only within the same sensor, band and product type, with a shared polarization and the
correct date order. There are **no universal thresholds**, and Sentinel-1 thresholds are never reused for NISAR.
Mock or Sentinel-1 results are never presented as NISAR results.

## Missing data

A missing value stays missing: it's shown as "Not available", with the reason when known, and is never replaced by
a guess. In code it is `null` plus a validation warning.
