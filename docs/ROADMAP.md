# Astera Watch — Implementation Roadmap

*Wildfire Surface-Change Monitoring with NASA NISAR Radar*
Team Astera · NASA Space Apps Challenge

## How we work

- The project is built in **stages**. Each stage ends with a **gate**: the tests
  are run, the results are shown to the team lead, and the next stage starts
  only after approval.
- **If a test fails, nothing is changed** until the failure has been discussed.
- No software is installed and no system setting is changed without approval.
- **No Docker / Docker Compose.** Local setup: Windows, Conda env `astera`
  (Python 3.11), local PostgreSQL + PostGIS, Node for the frontend.
- Each stage is developed on a feature branch and merged with a pull request.

**Before / Wait** says whether the stage can be finished before the competition or
needs real NISAR products.

---

## Stage 0: Environment and repository setup (Before)

| Step | Work | Gate |
|---|---|---|
| 0.1 | Folder structure, config files, README, CLAUDE.md, this roadmap, logo copy | Tree matches the planned structure |
| 0.2 | Create Conda env `astera` from `environment.yml` | All geospatial and backend imports succeed in `astera` |
| 0.3 | Install PostgreSQL 18 + PostGIS 3.7 ([guide](setup/postgresql-windows.md)) | Service running, `psql --version` works |
| 0.4 | Create role `astera`, database `astera_watch`, extension `postgis`, local `.env` | `SELECT PostGIS_Version();` returns a version; Python connects |
| 0.5 | `git init`, first commit, push to the private GitHub repo `astera-wildfire-platform` | Clean `git status`; repo visible and private |

## Stage D: Design system and UI mockups (Before, design only)

**Design only:** no package installs, no React app, no application code, and no
changes to `frontend/`. Every deliverable is a document or static design file in
[`docs/design/`](design/README.md). The logo (`frontend/public/astera-logo.jpg`)
is the visual reference. Branch: `stage-d-design`.

| Step | Work | Gate |
|---|---|---|
| D.0 | Branch, design-docs index, this roadmap update | Approved |
| D.1 | Visual identity: colours sampled from the logo, name lockup, logo usage rules | Palette and logo rules approved |
| D.2 | Design tokens; light and dark themes; fixed scientific data palette (FIRMS detection points, reference burned-area perimeters, dB change scale, change mask, no-data); source labels for Mock, Sentinel-1 (C-band), NISAR L-band and NISAR S-band, shown only for the bands a product actually provides | WCAG 2.2 AA in both themes: text contrast **and** non-text contrast (UI components, graphical objects, focus indicators) |
| D.3 | Typography (Montserrat headings, Inter body, monospace numbers), units and number formats, accessibility rules | Approved |
| D.4 | Scientific UI rules and wording | Approved; becomes the review checklist |
| D.5 | Component specifications with all states | Approved |
| D.6 | Layout: collapsible left sidebar, header, assistant panel, responsive breakpoints | Approved |
| D.7 | Low-fidelity wireframes of every page with all UI states | Structure approved before visual design |
| D.8 | High-fidelity mockups in light and dark: self-contained HTML/CSS with minimal vanilla JavaScript only for demonstration (theme switch, sidebar collapse, comparison slider); static map placeholders; no packages or external dependencies | Manual screenshot review by the team lead |
| D.9 | Design QA, Stage D report, merge, `checkpoint-stage-d` | QA checklist passes; verified that no frontend files, application code, package installs, environment files or database configuration changed |

Decisions: collapsible left sidebar · MapLibre in the app, static placeholder
maps in design · Montserrat headings · no separate Data Upload page · manual
screenshot review (no Playwright).

## Stage 1: Interfaces and contracts (Before, whole team)

- Internal SAR data model (`SARScene`, `RasterLayer`, `ValidationReport`,
  `Provenance`). Missing values are explicit `null` plus a warning, never invented.
  Native metadata is preserved. Every scene is flagged `is_synthetic` / `data_origin`.
- Adapter base interface (inspect, identify, extract metadata, read layers,
  validate, normalize, report unsupported fields).
- Database schema document (fire events, scenes, data sources, analysis jobs,
  results, change layers, chat sessions). FIRMS points are stored as
  `active_fire_point` and never as burned area.
- Pydantic request/response schemas for all API endpoints, documented in `docs/api.md`.
- **Gate:** model unit tests pass and the team signs off on the contracts. Parallel work starts only after this.

## Stage 2: Mock data generator (Before)

- Deterministic script: small pre/post GeoTIFF pairs (HH/HV-style, linear power,
  nodata areas), a `MOCK_*` HDF5 file (does **not** claim to be the NISAR layout),
  JSON metadata, a demo GeoJSON perimeter, FIRMS-style CSV, and expected outputs
  with a known planted change region.
- Every file is labelled **SYNTHETIC — NOT REAL SATELLITE DATA**.
- **Gate:** identical checksums on re-run; every file carries the label.

## Stage 3: Adapters and validation (Before; NISAR parts finished at the competition)

- `MockSARAdapter`: fully implemented.
- `Sentinel1Adapter`: GeoTIFF/RTC path.
- `NISAR_GCOV_Adapter`, `NISAR_GSLC_Adapter`: structure plus validation; HDF5 paths
  kept in a mapping config; integration points marked `# NISAR-INTEGRATION`.
  They stay "unverified" until real products are tested.
- Validation of metadata, product type, CRS, dimensions, nodata, polarization,
  geometry compatibility, dates, units/scaling and quality flags.
- **Gate:** pytest passes, including deliberately broken mock files.

## Stage 4: SAR processing pipeline (Before)

- GCOV and GSLC preprocessing kept separate (GSLC: intensity + multilooking;
  GCOV: diagonal power terms).
- Shared steps: alignment check, dB conversion, log-ratio change, change mask
  with a **data-driven, configurable** threshold (no universal value), changed
  area in an equal-area projection, exports (PNG overlays + COG + JSON),
  processing log and provenance.
- **Gate:** the planted mock change is recovered within tolerance; provenance is complete.

## Stage 5: Database and backend API (Before)

- SQLAlchemy + GeoAlchemy2 models, Alembic migrations, mock-data seeding.
- Endpoints: `/api/events`, `/api/events/{id}`, `/api/scenes`, `/api/scenes/{id}`,
  `/api/data/inspect`, `/api/data/upload`, `/api/analysis/run`,
  `/api/analysis/{id}`, `/api/analysis/{id}/results`, `/api/chat`, `/health`.
- Analysis runs as FastAPI background tasks (no extra job system).
- **Gate:** pytest against a test database; responses match the Stage 1 contracts.

## Stage 6: Data discovery modules (Before; live access optional)

- FIRMS client (fire event discovery), kept separate from ASF and Copernicus
  scene search, plus a pre/post scene matcher by location and date.
- **Gate:** tests with recorded responses; live calls only with keys.

## Stage 7: Frontend pages (Before)

- Create the frontend app (Vite + React + TypeScript + Tailwind + shadcn/ui,
  fonts bundled locally) and build the pages from the Stage D design
  documentation and tokens in `docs/design/`.
- Connect to the API (Axios + TanStack Query), MapLibre maps, Recharts charts,
  before/after comparison slider, MOCK DATA banner.
- **Gate:** Vitest tests, `npm run build`, manual click-through, and a review
  against the Stage D scientific UI rules.

## Stage 8: Chatbot (Before)

- Provider-independent chat service: rule-based answers from a knowledge base
  and real backend results; optional LLM interface (keys stay on the server).
- **Gate:** tests confirm it labels mock data, separates measurements from
  estimates, never treats FIRMS points as burned area, and never invents results.

## Stage 9: Notebooks (Before)

- `01_data_exploration`, `02_sar_change_detection`, `03_validation`. They import
  from `backend/processing/` and include a "switching to real NISAR" section.
- **Gate:** all notebooks run top to bottom on mock data.

## Stage 10: Integration, docs and demo (Before)

- Start scripts for backend and frontend, seeding, logging, install guide, team guide.
- **Gate:** on a fresh machine following the README, the full demo flow works:
  select event → load scenes → run analysis → view results → ask the assistant.

## Stage 11: Sentinel-1 dry run (Optional, Before)

- One real Sentinel-1 pair through the pipeline, labelled **Sentinel-1 C-band, not NISAR**.

## Stage C: Competition (Wait)

1. Inspect real GCOV/GSLC files (`/api/data/inspect`, notebook 01).
2. Update the NISAR mapping config and the `# NISAR-INTEGRATION` points.
3. Re-run the adapter tests on the real files.
4. Tune thresholds for L-band data at the chosen site.
5. Run the analysis and validate it against independent burned-area reference data.

---

## Team ownership

| # | Module | Stages |
|---|---|---|
| 1 | Frontend dashboard and UI | D, 7 |
| 2 | Maps, charts, before/after comparison | D, 7 |
| 3 | Backend API and database | 5 |
| 4 | Data ingestion and NISAR adapters | 2, 3, 6 |
| 5 | SAR preprocessing and change detection | 4, 9 |
| 6 | Chatbot, integration, testing, setup | 0, 8, 10 |

Everyone takes part in Stage 1.

## Key risks

- The real NISAR product layout, units and quality flags are unverified until we have sample files.
- Fire signatures in L-band backscatter depend on the site, so there's no universal threshold.
- There may be no matching pre/post NISAR pair for a chosen fire.
- Large files: subset or clip on ingest; they are never stored in the database.
- Windows-specific GDAL/PROJ conflicts: use only the `astera` Conda env.
