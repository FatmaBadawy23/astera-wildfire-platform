# Handover guide for the incoming developer

Follow these steps in order. Each one links to the detailed document. You shouldn't need any earlier chat or
verbal explanation; if something here is wrong or missing, fix this document.

## Step 1: Understand the project (30 minutes)

1. [README](../README.md): what Astera Watch is and what works today.
2. [PROJECT_STATUS.md](PROJECT_STATUS.md): real vs demo vs planned features, branches and tags, known issues,
   decisions waiting for the project owner.
3. [architecture/OVERVIEW.md](architecture/OVERVIEW.md): how the frontend, the (planned) backend and the database fit.
4. [data/DATA_SOURCES.md](data/DATA_SOURCES.md): what each data source can and **can't** establish. Read it before
   changing any wording, legend or colour.

## Step 2: Get the code

```powershell
git clone https://github.com/FatmaBadawy23/astera-wildfire-platform.git   # private repo: ask the owner for access
cd astera-wildfire-platform
git checkout stage-f-frontend   # the frontend and this documentation (not merged into main yet)
```

Branches and tags are listed in [PROJECT_STATUS.md](PROJECT_STATUS.md#branches-and-tags).

## Step 3: Run the frontend (15 minutes)

```powershell
cd frontend
npm ci
npm run dev            # http://localhost:5173 on synthetic demo data; no backend or database needed
```

Try the journey: search "Portugal", select SYN-03, open its Fire Story, save its country to My places, open Fire
history, open the Research Center, create a research project and add a dataset to it from the catalog (saved in this browser only), open Help → Ask Astera,
and switch between Light and Dark.

## Step 4: Run the checks

From `frontend/`: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. With `npm run dev` running:
`node scripts/journey-checks.mjs`. Expected results and the two known browser-check failures are listed in
[setup/TESTING.md](setup/TESTING.md).

## Step 5: Python and database (only for backend or processing work)

Follow [setup/DEVELOPMENT.md](setup/DEVELOPMENT.md) sections 3–4:
- create the `astera` Conda env and run `verify_env.py`;
- install PostgreSQL 18 + PostGIS 3.7 and create **your own** local role and databases with
  `docs/setup/create_databases.sql` (you choose the password at a hidden prompt; nobody sends you one);
- copy `.env.example` to `.env` with your values and run `verify_db.py`.

Never commit, print or share `.env`, passwords or a full `DATABASE_URL`.

## Step 6: Know where to make changes

| Task | Start here |
|---|---|
| Frontend pages, routes, map, themes | [architecture/FRONTEND.md](architecture/FRONTEND.md), especially "Where to make common changes" |
| Colours and design tokens | `docs/design/tokens.json`, then `npm run tokens`; documented in `docs/design/02-design-tokens.md` |
| User Guide and Help text | `frontend/src/features/guide/guideArticles.tsx` |
| Backend API, processing | [architecture/BACKEND.md](architecture/BACKEND.md) (skeleton only; follow roadmap Stages 1 → 5) |
| Database schema | [architecture/DATABASE.md](architecture/DATABASE.md) (empty; schema to be designed in Stage 1) |
| Research Center | [architecture/RESEARCH_CENTER.md](architecture/RESEARCH_CENTER.md) (projects and the dataset catalog work in this browser; next stages R4–R7 need approval) |

## Step 7: Rules that must not be broken

- **Scientific honesty:**
  - FIRMS detections are thermal anomalies, never confirmed fires or burned area.
  - Radar change is an estimate with uncertainty, never proof of burned area.
  - NISAR and Sentinel-1 are never mixed or presented as each other.
  - Missing values stay "Not available".
  - Synthetic data is always labelled and never presented as real observations.
  - Nothing in the app gives evacuation or safety advice.
- **Accessibility:** WCAG 2.2 AA. The axe checks in `npm test` and `journey-checks.mjs` must stay at zero violations
  in both themes.
- **Environment:**
  - No Docker.
  - Python only through the `astera` Conda env.
  - No `pip install` of geospatial packages.
  - No new npm dependencies without the team's agreement.
- **Git and process:**
  - Never force-push, and never commit secrets.
  - Work stage by stage: propose, get approval, implement, run the checks, report. If a check fails, stop and
    discuss it before changing anything.

## Step 8: Open decisions to raise with the project owner

Listed in [PROJECT_STATUS.md](PROJECT_STATUS.md#provisional-decisions-waiting-for-the-project-owner): the density
colour palette, the browser-test fixes, and when to merge the stage branches into `main`.

## Suggested first task

Reproduce the setup and all checks (steps 3–4), then fix known issue 3 in
[PROJECT_STATUS.md](PROJECT_STATUS.md#known-issues): `frontend/.env.example` names the data mode `api`, but the
code reads `http`. It's a one-line change that touches the data-mode switch you'll need for Stage 7. Then start
**Stage 1**: write the data contracts, using `frontend/src/data/types/` as input.
