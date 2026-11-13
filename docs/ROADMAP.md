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
| 0.1 | Folder structure, config files, README, this roadmap, logo copy | Tree matches the planned structure |
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

**Status (updated at Stage F0, 2026-11-11): Stage D closed after D.2.** The table above is kept as the
original plan. D.3–D.9 were **not completed**; their requirements moved into Stage F, where they are
implemented and tested in the real application:

| Step | Status | Where it continues |
|---|---|---|
| D.0 | ✅ Completed (commit `36fb5c6`) | — |
| D.1 | ✅ Completed (commit `2f9539e`) | — |
| D.2 | ✅ Completed (commit `accb77f`); Amendment 1 (FIRMS detection-density palette) added in F0 | — |
| D.3 | ↪ Transferred | F1–F2: typography, units, number formats and accessibility rules implemented and tested in code |
| D.4 | ↪ Transferred | F3: scientific UI rules implemented as components and enforced by automated tests |
| D.5 | ↪ Transferred | F2–F3: the implemented component library is the component specification |
| D.6 | ↪ Transferred | F2 and F8: layout, collapsible sidebar, responsive behaviour, focus-not-obscured checks |
| D.7 | ✖ Superseded | Replaced by the implemented pages (F2–F7) |
| D.8 | ✖ Superseded | Static HTML mockups replaced by the real application |
| D.9 | ↪ Transferred | F8: QA and report. No `checkpoint-stage-d` tag unless the team decides otherwise. |

## Stage F: Frontend application (Before)

> **Status (2026-11-13):** built and in review. The product structure below is the **original plan**; it was
> redesigned during Stage F. Implemented: Fire map (homepage), Fire Story (event details, data availability,
> radar analysis and report in one page), Fire History & Impacts, My Places & Alerts (alerts not available yet),
> User Guide, Help with Ask Astera (coming soon), How It Works, What's planned. There are no login pages (no
> accounts exist) and no sidebar (header menu, and a tab bar on phones). See
> [PROJECT_STATUS.md](PROJECT_STATUS.md) and [architecture/FRONTEND.md](architecture/FRONTEND.md).

The real React application, built now on mock data and ready for FastAPI. Branch: `stage-f-frontend`
(from `stage-d-design`). It follows the approved visual identity (D.1) and design tokens (D.2).

**Product structure:**
1. **Welcome & Authentication:** Welcome, Login, Register, Continue as Guest. **Guest-first:** guests have
   full access to every available feature; registration is optional. Until backend authentication exists,
   Login/Register clearly state that **accounts are not available yet**. Authentication is never simulated,
   and no passwords or credentials are stored in the browser.
2. **Global Fire Explorer** (main page): map, FIRMS detection points and detection-density heatmap,
   date-range / country / data-source filters, search, recent events.
3. **Fire Event Details:** location, timeline, detection dates, data sources, scene metadata.
4. **Data Availability:** pre-/post-fire scene availability by product type (NISAR GCOV, NISAR GSLC,
   Sentinel-1), acquisition dates, polarization, coverage and quality when available; clear missing/unsuitable states.
5. **SAR Analysis:** only after the availability check passes: before/after comparison, backscatter,
   change map, **estimated** changed area, confidence, uncertainty and limitations.
6. **Reports & Insights:** event summaries, charts, JSON/CSV export and browser print-to-PDF.
7. **AI Scientific Assistant:** connected to the selected event and its available results; never invents data.
8. **Data & Methodology:** sources, processing, assumptions and limitations.

**Stack (exact versions pinned in `package-lock.json`):** React 19 + TypeScript 5.9.3 + Vite, Tailwind CSS v4
+ shadcn/ui, React Router 7, MapLibre GL JS, Recharts, Axios + TanStack Query, Vitest + Testing Library +
axe-core. Node.js **22.20.0** is kept (no upgrade), so versions are chosen to support it.

**Scientific requirements:** FIRMS detections are never shown as burned-area polygons; the heatmap shows
**"FIRMS detection density, not burned area"** (never intensity or burned extent); every value is marked
measured / derived / estimated / placeholder; mock data is never presented as a NASA observation; NISAR
scene availability is never assumed (L-band and S-band shown separately, only when present); analysis runs
only after the availability check.

**Offline map:** Natural Earth 1:110m **country boundaries** (public domain), bundled as the offline
country layer. It is **not** a detailed basemap and has no province/region boundaries; offline search and
filtering work at **country** level only. Online basemaps are optional; the core country map and the
synthetic event exploration work without internet.

**Architecture:** feature modules; a data layer with repository interfaces and two adapters (mock now,
FastAPI HTTP later) selected by configuration; provisional frontend types until Stage 1 contracts exist.

| Step | Work | Gate |
|---|---|---|
| F0 | Branch, roadmap and design README updates, D.2 Amendment 1 (heatmap palette) | Validators pass; docs reviewed |
| F1 | Scaffold, pinned dependencies, Tailwind v4 + shadcn/ui, local fonts, tokens from `tokens.json`, theme | Typecheck, lint, build, tests (tokens match `tokens.json`; theme toggle) |
| F2 | App shell: collapsible sidebar, header, MOCK banner, routes, Welcome/Login/Register + guest flow, 404, error boundary | Route, keyboard and guest-access tests; axe: 0 violations in both themes |
| F3 | Data layer, provisional types, synthetic fixtures, science components | Tests: mock data always labelled; "Not available" never replaced; formatters; availability rules |
| F4 | Global Fire Explorer | Tests: filters; heatmap legend wording; no FIRMS polygons; text alternative; manual map review |
| F5 | Event Details + Data Availability | Tests: missing/unsuitable states; no NISAR scene assumed |
| F6 | SAR Analysis | Tests: locked without a suitable pair; estimate and uncertainty labels; Sentinel-1 never shown as NISAR |
| F7 | Reports & Insights, AI Assistant, Data & Methodology | Tests: exports carry provenance; assistant answers "not available" instead of inventing |
| F8 | QA, responsive and accessibility review, documentation, stage report | Full test run; manual review; PR; `checkpoint-stage-f` |

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
- *(Added at Stage F0)* The Stage F provisional frontend types are an input to these contracts.
  User accounts and authentication contracts are **planned** (not yet designed); guest access stays.
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
- *(Added at Stage F0)* Authentication endpoints and a users table are **planned** for the accounts
  shown in Stage F; until they exist the application runs in guest mode only.
- **Gate:** pytest against a test database; responses match the Stage 1 contracts.

## Stage 6: Data discovery modules (Before; live access optional)

- FIRMS client (fire event discovery), kept separate from ASF and Copernicus
  scene search, plus a pre/post scene matcher by location and date.
- **Gate:** tests with recorded responses; live calls only with keys.

## Stage 7: Frontend–API integration (Before, after Stage 5)

*Updated at Stage F0: the frontend application itself is built in **Stage F**.*

- Switch the Stage F data layer from the mock adapter to the FastAPI adapter.
- Replace the provisional frontend types with the Stage 1 contracts.
- Connect backend authentication when it exists (guest access stays available).
- Check real basemap styles against the data colours (D.2 open item).
- **Gate:** Vitest tests against API contracts, `npm run build`, end-to-end click-through
  with the backend, and a review against the scientific UI rules.

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
| 1 | Frontend dashboard and UI | D, F, 7 |
| 2 | Maps, charts, before/after comparison | D, F, 7 |
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
