# Frontend architecture

React 19 + TypeScript 5.9 + Vite 8, Tailwind CSS 4, React Router 7, TanStack Query 5, MapLibre GL 6, Radix UI
primitives, Vitest + Testing Library + axe-core. Exact versions are in `frontend/package.json` and
`frontend/package-lock.json`. Node.js 22.20.0 is used (`engines`: `>=22.13.0`).

## Folder map (`frontend/`)

| Path | What lives there |
|---|---|
| `index.html` | HTML entry; an inline script applies the saved theme before first paint (default Light) |
| `src/main.tsx`, `src/App.tsx` | React entry; `AppProviders` (theme, data, query client) and the router |
| `src/app/` | `router.tsx` (all routes), `nav.ts` (menu items and paths), `env.ts` (data mode) |
| `src/components/layout/` | App shell: `AppShell`, `Header`, `PrimaryNav` (header menu, Learn menu and phone tab bar), `PageFooter` (all pages except the Fire map), `Page`/`PageHeader` (page title block), `DemoBar`, `ThemeToggle`, `StandaloneFrame` (404 and error pages), route focus (`useRouteFocus.ts`) |
| `src/components/help/` | Help panel state (`HelpContext.tsx`) and the safety note |
| `src/components/science/` | Scientific display components: legends, source badges, value with kind and uncertainty, provenance, availability status |
| `src/components/search/` | `CountrySearch` (accessible combobox, countries only) |
| `src/components/states/` | Loading, empty, error and "not available yet" states; `QueryState` maps a query to them |
| `src/components/ui/` | Small UI primitives (button, popover, tooltip, status tag, `Card`/`CardHeader`/`StatTile`) |
| `src/data/` | Data layer (see below) |
| `src/features/<page>/` | One folder per page: `explorer` (Fire map), `story` (Fire Story), `history`, `places`, `guide` (User Guide, How It Works, the article texts), `help` (Help panel), `research` (Research Center), `planned`, `errors`, `dev` and `foundation` (development-only previews) |
| `src/lib/` | Formatting (`format.ts`), theme logic (`lib/theme/`), `cn` helper |
| `src/styles/` | `tokens.css` (**generated**, do not edit), `globals.css` (Tailwind mapping, base styles, print styles) |
| `src/test/` | Test setup, axe helper, viewport helper |
| `public/basemap/` | Natural Earth map assets (see [DATA_SOURCES.md](../data/DATA_SOURCES.md)) |
| `scripts/` | `generate-tokens.mjs`, `run-vitest.mjs` (Windows-safe Vitest launcher), `journey-checks.mjs` (browser tests), `browser-checks.mjs` (older browser tests, outdated) |

## Routes (`src/app/router.tsx`)

| Path | Page | Notes |
|---|---|---|
| `/` | Fire map (`features/explorer/ExplorerPage.tsx`) | Homepage. Filters and selection live in the URL (`?country=`, `?event=`, `?from=`, `?to=`, `?radar=`, `?q=`) |
| `/events/:eventId` | Fire Story (`features/story/FireStoryPage.tsx`) | Everything about one possible fire |
| `/history` | Fire History & Impacts | Filters in the URL (`?country=`, `?radar=`, `?result=1`, `?sort=`) |
| `/places` | My Places & Alerts | Saved countries (this browser only); alerts not available. Not in the main menu since R1; reached from "Save … to My places" links |
| `/research`, `/research/{annotation,models,analysis,reports,collaboration}` | Research Center | Overview and one description page per tool that doesn't work yet; see [RESEARCH_CENTER.md](RESEARCH_CENTER.md) |
| `/research/data`, `/research/data/:datasetId` | Dataset catalog | Works (initial draft); definitions in `src/data/catalog/` |
| `/research/projects`, `/research/projects/new`, `/research/projects/:projectId`, `/research/projects/:projectId/edit` | Research projects | Works; saved in this browser only |
| `/guide` | User Guide | Articles from `features/guide/guideArticles.tsx`; `#<article-id>` links |
| `/how-it-works` | How It Works | Secondary information page |
| `/planned` | What's planned | Future ideas; no data |
| `/dev/science`, `/dev/foundation` | Component previews | **Development builds only** |
| anything else | 404 | Standalone page (no menu, no demo bar) |

Old addresses redirect: `/explorer` → `/` (keeps the query), `/events`, `/availability`, `/analysis`, `/reports` →
`/history`, `/methodology` → `/how-it-works`, `/assistant` → `/guide#ask`, `/login`, `/register` → `/`. There are
no accounts, so there are no login pages.

Every page has one `h1` with `data-page-heading`. On navigation, `useRouteFocus` moves focus to it. It doesn't
move focus on a direct load or a redirect on load.

## State

| Kind | Where | Storage |
|---|---|---|
| Server-like data (events, detections, scenes, availability, analysis) | TanStack Query hooks, `src/data/hooks.ts` | Memory only |
| Filters, selected possible fire | URL search params (`features/explorer/useExplorerParams.ts`, history page) | URL, so links can be shared |
| Theme | `lib/theme/ThemeProvider.tsx` | `localStorage["astera-theme"]` (`light` / `dark` / `system`; default **light**). `?theme=light\|dark` overrides without saving |
| Help panel (open, tab, topic) | `components/help/HelpContext.tsx` | Memory |
| Welcome card dismissed | `ExplorerPage.tsx` | `localStorage["astera-watch-welcome-dismissed"]` |
| Saved places (My places) | `features/places/placesStore.ts` | `localStorage["astera-watch-places"]` (ISO3 codes, up to 20). This browser only |
| Research projects | `src/data/research/` (repository + `ResearchProvider`) | `localStorage["astera-watch-research-projects"]` (`{ version: 1, projects }`, up to 50). This browser only; a backend adapter can replace it |

Every `localStorage` access is wrapped in `try/catch`, so the app also works when storage is blocked.

## Data flow

```
page component ──► hook (src/data/hooks.ts) ──► repository interface (src/data/repositories.ts)
                                                   ├── mock adapter (src/data/mock/mockRepositories.ts) ◄── fixtures.ts, detections.ts
                                                   └── http adapter (src/data/http/unavailableRepositories.ts): always "unavailable"
```

- **Adapter choice:** `src/app/env.ts`. `VITE_DATA_MODE=http` selects the HTTP placeholder; **any other value,
  or none, selects mock data.** Note: `frontend/.env.example` names the value `api`, but the code expects `http`
  (see [PROJECT_STATUS.md](../PROJECT_STATUS.md), known issues).
- **Errors** are `DataError` (`src/data/errors.ts`): `unavailable` (no backend; shown without Retry), `not-found`,
  `network` (retried twice) and `invalid-response`. Mock records are validated (`src/data/validate.ts`) before use.
- **Development-only mock scenarios:** add `?mockScenario=error|empty|slow|unavailable` to any URL in `npm run dev`
  to see each state. This is compiled out of production builds.
- **Synthetic fixtures** (`src/data/mock/fixtures.ts`): 6 possible fires (SYN-01 … SYN-06) in 6 countries,
  612 detections, demo period 2026-07-01 to 2026-08-31. They cover every UI state: suitable NISAR L-band pair,
  missing metadata, Sentinel-1 pair, no pre-fire scene, different bands and products, failed analysis.
- **Rules in the frontend** (`src/data/rules/availability.ts`) only *refuse* pairs that can never be compared. They
  don't decide suitability; that is the data source's job.

## Map (`features/explorer/`)

- `ExplorerMap.tsx` creates one MapLibre map (lazy-loaded chunk). `mapStyle.ts` builds the style. The layers, bottom
  to top:

| Layer | Source | Notes |
|---|---|---|
| `background` | none | Water colour (`--aw-color-map-placeholder`), shown until relief tiles load |
| `country-fill` | `basemap/countries-110m.geojson` | Land fallback (`--aw-color-map-land`) |
| `relief` | `basemap/relief/{z}/{x}/{y}.jpg` (zoom 0–4, enlarged beyond) | Natural Earth relief. Softened per theme by `RELIEF_PAINT` |
| `density-fill`, `density-outline` | computed in the browser | FIRMS detection density squares, **from zoom 3** (`DENSITY_MIN_ZOOM`). Grid size follows zoom (`cellSizeForZoom`); counts are exact (`src/data/aggregate.ts`) |
| `country-border` | countries | `--aw-color-map-outline` |
| `detection-casing`, `detection-points` | detections | Heat spots **from zoom 9** (`POINTS_MIN_ZOOM`): fire dot, light ring, dark ring |
| possible-fire markers | HTML `<button>`s (MapLibre `Marker`) | Keyboard reachable. Only markers fully in view are in the Tab order |
| country names | HTML overlay (`countryLabelLayer.ts`) | Natural Earth label points and ranks; hidden where they would cover data |

- Colours are read from CSS custom properties (`readMapColors`) and re-applied when the theme changes.
- Searching a country fits the map to the largest land area of that country (`src/data/countryIndex.ts`). The fit
  is padded so the floating map key never covers it (`fitPadding`).
- Without WebGL, the map shows a message and the list still works.
- In development builds the map instance is exposed as `document.querySelector('[data-explorer-map]').__awMap`
  for the browser tests.

## Styling and themes

- **Design tokens:** the source of truth is `docs/design/tokens.json` (DTCG format), documented in
  `docs/design/02-design-tokens.md`. `npm run tokens` regenerates `src/styles/tokens.css`, and a unit test fails if they
  differ. **Never edit `tokens.css` by hand.**
- `globals.css` maps tokens to Tailwind names (`bg-surface`, `text-foreground`, `text-foreground-strong`,
  `border-border-strong`, `bg-planned`, …). Dark mode is the `data-theme="dark"` attribute on `<html>`.
- **Data colours are the same in both themes** (fire detection `#D94100`, density levels, change scale, badges).
  The density colours are **provisional** (see [PROJECT_STATUS.md](../PROJECT_STATUS.md)).
- Fonts are bundled locally (`@fontsource`): Montserrat (headings), Inter (body), JetBrains Mono (numbers and IDs).

## Where to make common changes

| Change | File(s) |
|---|---|
| Add or rename a page or menu item | `src/app/router.tsx`, `src/app/nav.ts` |
| Help and User Guide wording | `src/features/guide/guideArticles.tsx` (one source for both) |
| Map layers or colours | `src/features/explorer/mapStyle.ts`, `ExplorerMap.tsx`; colours in `docs/design/tokens.json`, then `npm run tokens` |
| Legend text (exact scientific wording) | `src/components/science/Legends.tsx`, `src/features/explorer/layerHelp.ts` |
| Connect the backend | `src/data/http/` (new adapter), `src/data/DataProvider.tsx`, types in `src/data/types/` |
| Demo data | `src/data/mock/fixtures.ts` (must stay labelled synthetic) |
