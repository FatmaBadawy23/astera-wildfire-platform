# Research Center (design note, stages R0–R3)

> **Status:** **research projects** (R2) and the **dataset catalog** (R3, initial draft) work; project data and
> dataset links are kept in this browser only. The other five tools don't work yet; each page says what the tool will
> do and what it needs first. Astera Watch adds no example projects, and the section contains no annotations, models,
> results, institutions or partnerships. No satellite data is connected: the only real datasets are two Natural Earth
> reference maps.

## Goal

A workspace for wildfire research inside Astera Watch, with seven capabilities:

| # | Capability | Route | Label today | Next step |
|---|---|---|---|---|
| 1 | Research projects (workspace) | `/research/projects` | **Works in this browser** | Server storage, accounts and sharing need the backend |
| 2 | Satellite and geospatial data | `/research/data` | **Works in this browser** (initial draft) | Real satellite data and uploads need the backend |
| 3 | Wildfire annotation | `/research/annotation` | Not available yet | R5: points and areas on the map, GeoJSON download |
| 4 | AI models | `/research/models` | **Planned** | R7: model-card template; running models needs the backend |
| 5 | Statistics and time series | `/research/analysis` | Not available yet | R4: heat-spot statistics from the existing (demo) data |
| 6 | Scientific reports | `/research/reports` | Not available yet | R6: JSON/CSV download and print |
| 7 | Research collaboration | `/research/collaboration` | **Planned** | Needs accounts, a backend and verified agreements |

**Works in this browser** = works now; data stays in this browser on this device. **Not available yet** = designed
and scheduled, no part works. **Planned** = needs decisions, hosting or agreements first. All three use `StatusTag`
(the "works" label is neutral, so it can't be mistaken for a "not yet" label).

## Navigation

| Width | Main navigation |
|---|---|
| 768 px and wider (header) | Fire map · Fire history · **Research Center** · Learn menu · Help · theme |
| Below 768 px (tab bar) | Map · History · **Research** · Help (the Learn pages are reached from Help) |

The Research Center has its own sub-menu (`nav` named "Research Center"): Overview, Projects, Data, Annotation,
AI models, Analysis, Reports, Collaboration. It is a side list from 1024 px and a wrapping row of links below. The
main-menu item stays highlighted on every `/research/*` page (`hasSubpages` in `src/app/nav.ts`). The "Research Hub"
idea on What's planned is now the "Research Center" card, linking to `/research`.

## Code

| File | Contents |
|---|---|
| `frontend/src/data/types/research.ts` | R0 provisional types: `ResearchProject`, `StudyArea`, `DatasetEntry`, `Annotation`, `ModelCard`, `ModelRun`, `ResearchReport`, `Institution`, `ProjectMember` (`RESEARCH_CONTRACT_VERSION = "r0-provisional-1"`). Nothing creates, stores or fetches them yet |
| `frontend/src/features/research/capabilities.ts` | The single source of every label in the section: status, what it will do, what's missing, schedule, links to related working features |
| `frontend/src/features/research/ResearchPages.tsx` | `ResearchLayout` (sub-menu), `ResearchOverviewPage`, `CapabilityPage` (one template for all seven) |
| `frontend/src/features/research/research.test.tsx` | Labels, no controls on any page, navigation and focus, My places unaffected |

There is no research repository, no browser storage and no network call in the section. Pages have no forms,
inputs, uploads or buttons.

## Research projects (R2)

| Route | Page |
|---|---|
| `/research/projects` | Workspace: all saved projects (newest change first), "New project", where projects are kept |
| `/research/projects/new` | Create form |
| `/research/projects/:projectId` | Details: about, objectives, study area (countries with Fire history / Fire map links), linked possible fires (with "not confirmed" and demo labels, or "not found in the current data"), the other tools with their real status, Edit and Delete |
| `/research/projects/:projectId/edit` | Edit form |

- **Fields:** title (required, ≤ 120 characters), description, research objectives (one per line, ≤ 10), the
  person's own project status (Planning, In progress, On hold, Completed), study-area countries (≤ 20, country
  search), study-area description, linked possible fires (≤ 50). Up to 50 projects.
- **Linking:** only possible fires from the current data in the chosen countries can be linked. Links outside the
  chosen countries are dropped on save, and the form says so first.
- **Delete** opens a confirmation dialog (Radix AlertDialog, Cancel focused first). Nothing else in Astera Watch is
  affected.
- **Forms:** visible labels, an error summary that takes focus and links to each field, `aria-invalid` and
  `aria-describedby` on fields.

**Storage (behind a repository, so a backend can replace it):**

| File | Role |
|---|---|
| `src/data/research/projectRepository.ts` | `ResearchProjectRepository` interface (list, get, create, update, delete, subscribe), `ProjectInput`, limits and validation shared by every adapter |
| `src/data/research/localProjectRepository.ts` | Browser adapter: `localStorage["astera-watch-research-projects"]`, envelope `{ version: 1, projects }` |
| `src/data/research/ResearchProvider.tsx` | Provides the repository (tests may inject one) and the TanStack Query hooks the pages use |

- Nothing is sent anywhere. Another tab's changes are picked up through the `storage` event.
- If the stored value can't be read, the pages show an error and **nothing is written over it**. Records in an
  unknown format are not shown but are written back unchanged.
- If the browser blocks storage, projects last for the visit only and the pages say so.
- The adapter touches only its own key: My places, theme and other keys are never read or changed.
- To move to a backend: implement `ResearchProjectRepository` over the API (`DataError` kinds as elsewhere) and pass
  it to `ResearchProvider`. Projects already in browsers would need an explicit, person-initiated import.

## Dataset catalog (R3, initial draft)

| Route | Page |
|---|---|
| `/research/data` | Catalog: filters (type of data, real or demo, country covered; options come from the catalog), groups "Real data in the app", "Demo data (invented)", "Derived from demo data", and a separate "Sources not connected yet" list |
| `/research/data/:datasetId` | Details: every metadata field ("Not available" + reason when missing), Real/Demo label and source badges, derived-from links, what the data can and can't tell you, how it was prepared, "Use in a research project" |
| Project details | "Datasets" section: linked datasets with their label, Remove, "Find datasets"; IDs no longer in the catalog are kept and say so |

**What is in the catalog today** (nothing else exists):

| Group | Entries | Notes |
|---|---|---|
| Real data | Natural Earth 1:110m countries (outlines, names, label points); Natural Earth I shaded relief 1:50m | Bundled with the app; public domain; download dates only (no acquisition date); release versions not recorded |
| Demo data | Demo heat spots (612), 11 demo radar scenes (one entry each) | Built from the fixtures; invented dates labelled; missing scene metadata kept missing |
| Derived from demo data | Demo possible fires; simulated analysis results | Name their inputs |
| Not connected (sources, not datasets) | NASA FIRMS, NISAR (ASF), Sentinel-1 (CDSE) | No records or dates; can't be opened as datasets or linked |

In `http` data mode the catalog has the two reference datasets only.

**Structure (definitions separate from the UI):**

| File | Role |
|---|---|
| `src/data/catalog/definitions/naturalEarth.ts` | Real reference datasets (facts from `SOURCE.txt` and DATA_SOURCES.md only) |
| `src/data/catalog/definitions/demo.ts` | Demo datasets generated from the fixtures, so they can't drift from the demo data |
| `src/data/catalog/definitions/sources.ts` | Known sources that are not connected |
| `src/data/catalog/catalog.ts` | Assembles the catalog per data mode; `validateCatalog` rules; `CATALOG_VERSION` |
| `src/data/catalog/datasetRepository.ts` | `DatasetCatalogRepository` (list, get, list sources) and the static adapter |
| `src/data/catalog/CatalogProvider.tsx` | Provides the catalog (tests or a future backend adapter can be injected) and its query hooks |
| `src/data/types/research.ts` | `DatasetEntry` (origin, access, provider, source, format, licence, citation, version, spatial and temporal coverage, acquisition date, other dates with their kind, record count, free-form `properties`, missing-value reasons) and `DataSourceEntry` |

- **Updating the catalog:** edit a definitions file and keep IDs stable (projects store them). New kinds of metadata go
  into `properties`; filters and groups are computed from the entries, so nothing in the UI lists datasets.
- **Rules (`validateCatalog`, checked by unit tests and in development):** unique, well-formed IDs; synthetic data
  is demo access with synthetic provenance and no licence; real data is never demo; derived data names inputs that
  exist; acquisition dates only in `acquisitionDate`; unconnected sources are never datasets.
- **Linking:** `ResearchProjectRepository.linkDataset` / `unlinkDataset` change only `datasetIds` (and the "last
  changed" time). The app links through `useLinkDataset`, which first asks the catalog for the dataset, so
  unconnected sources and unknown IDs are refused. Up to 50 datasets per project.
- **Moving to a backend:** implement `DatasetCatalogRepository` over a datasets API and pass it to
  `CatalogProvider`; when a source is connected, remove it from `sources.ts` and serve its datasets instead.

## Rules carried by the types

- Missing values are `null` and shown as "Not available", never invented.
- Datasets, annotations and model outputs carry provenance. Synthetic data stays labelled as synthetic.
- An annotation is a person's interpretation (`nature: "interpretation"`). There is **no burned-area annotation
  kind**: annotations are never presented as burned-area measurements.
- Model outputs are `SciValue`s of kind `estimated` with uncertainty, and record the model version and inputs. A
  model is only used on the input products it was validated for.
- A report records every dataset, model run, annotation and possible fire it uses, and carries the demo label when
  any source is synthetic.
- An `Institution` exists only with a verified agreement. There are none.

## What is missing (backend, storage, models)

| Need | Status | Where it belongs |
|---|---|---|
| Data contracts for the research entities | Provisional frontend types only | Roadmap Stage 1 (team sign-off) |
| Database tables: projects, datasets, annotations, model cards, model runs, reports, members, users | None (the database has no tables) | Roadmap Stage 5, Alembic migrations |
| File storage and uploads | None | `data/` on disk + file references in the database; `/api/data/upload` (Stage 5); validation (Stage 3) |
| Processing for radar change over time | None | Roadmap Stage 4 |
| AI models | **None chosen, trained, validated or hosted.** The `astera` env has no ML libraries | Team decision; new packages need approval; runs as background jobs on the server |
| Accounts, roles, sharing | None | Planned in the roadmap, not designed |
| Partnerships | **None** | Agreements outside the software, verified before any listing |

## Retiring My places (Phase A done in R1)

- **Phase A (R1):** My places left the header menu, the phone tab bar and the footer. The `/places` page, its
  saved list (`localStorage["astera-watch-places"]`), every "Save … to My places" action, the User Guide article and
  the Help topic are unchanged. No code reads, changes or clears saved places outside My places itself (a unit test
  checks that the Research Center never touches that key).
- **Phase B (later, owner decision):** either offer to copy saved countries into a research project (only with the
  person's consent), or retire the feature (remove the save actions, redirect `/places`, retire the article).
- **Phase C (only after B):** remove `features/places/` and its tests. Never clear the stored list silently; if
  wanted, add an explicit "Remove my saved places" action.

## Plan

R0 (types, this note), R1 (overview, sub-pages, labels, navigation), R2 (projects, browser only) and R3 (dataset
catalog, initial draft) are done. Each later stage needs approval: R4 statistics, R5 annotation, R6 reports, R7
model-card page. Uploads,
model runs, collaboration and server storage need the backend stages first.
