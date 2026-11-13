# Development setup (Windows)

The supported setup is **Windows + PowerShell**, a **local PostgreSQL + PostGIS** install (no Docker), the
**Conda env `astera`** for Python, and **Node.js 22 + npm** for the frontend. Run commands from the repository root
unless a step says otherwise.

## 1. Prerequisites

| Tool | Version used by the team | Notes |
|---|---|---|
| Git | any recent | |
| Node.js + npm | Node **22.20.0**, npm 10.9 | `frontend/package.json` requires Node ≥ 22.13.0 |
| Anaconda or Miniconda | conda 24.x | Only for the Python env and the database checks |
| PostgreSQL 18 + PostGIS 3.7 | 18.6 / 3.7.0 | Only for backend work; the frontend doesn't need it |
| Microsoft Edge | any recent | Only for the browser tests (`journey-checks.mjs`) |

About 10 GB of free disk space is needed for the Conda env, PostgreSQL and `node_modules`.

## 2. Frontend (enough to run the app)

```powershell
cd frontend
npm ci            # exact versions from package-lock.json
npm run dev       # http://localhost:5173 (strict port)
```

The app runs on **synthetic demo data** with no backend and no database. To build and preview production files:

```powershell
npm run build     # typecheck + production build into frontend/dist
npm run preview
```

Optional frontend settings: copy `frontend/.env.example` to `frontend/.env.local`. Only `VITE_*` variables reach the
browser, so **never put secrets there**. `VITE_DATA_MODE=http` switches to the backend adapter, which reports
"not available yet" because no backend exists. Any other value, or none, means demo data.

## 3. Python environment `astera` (backend, processing, notebooks)

Full guide: [conda-environment.md](conda-environment.md). In short:

```powershell
$env:CONDA_CHANNEL_PRIORITY = "strict"
conda env create -f environment.yml
conda run -n astera python docs/setup/verify_env.py      # must end with RESULT: PASS
```

Rules (they prevent GDAL and PROJ conflicts on Windows):

- **Always run project Python through the env:** `conda run -n astera python …` or an activated terminal
  (`conda activate astera`). Never call `…\envs\astera\python.exe` directly: the PostGIS installer sets
  machine-wide `GDAL_DATA` and `PROJ_LIB`, and only activation replaces them. Don't delete those machine variables;
  PostGIS needs them.
- Don't use another Python on PATH (for example MSYS2) or the Conda `base` env.
- Never `pip install` geospatial packages (GDAL, Rasterio, PyProj, Shapely, GeoPandas, h5py). Change
  `environment.yml` and update the env instead.
- If `conda` isn't on PATH: `& "$env:USERPROFILE\anaconda3\Scripts\conda.exe" run -n astera …`.

## 4. Database (only for backend work)

Full guide: [postgresql-windows.md](postgresql-windows.md). It covers installation, the
letters-and-digits-only password rule, creating the role and databases with `create_databases.sql` at a hidden
password prompt, and the `.env` file. Then:

```powershell
Copy-Item .env.example .env        # fill in YOUR local values; never commit, print or share .env
conda run -n astera python docs/setup/verify_db.py   # read-only; RESULT: PASS (27/27)
```

Details: [../architecture/DATABASE.md](../architecture/DATABASE.md).

## 5. Backend

There is nothing to run yet: `backend/` has no FastAPI app (see [../architecture/BACKEND.md](../architecture/BACKEND.md)).
When a FastAPI app object is added, the planned command (from the project rules, run from `backend/`) is
`conda run -n astera uvicorn app.main:app --reload` on http://localhost:8000. Check it against the code at that time.

## 6. Git workflow

- Branches: `main` (Stage 0), `stage-d-design` (design docs), `stage-f-frontend` (frontend and documentation).
  Tags: `checkpoint-stage-0`, `checkpoint-stage-d`, `checkpoint-stage-f`; one per completed stage.
- **Never force-push.** Never commit `.env` or anything under `data/raw`, `data/processed` or `data/outputs`.
- The project works stage by stage ([../ROADMAP.md](../ROADMAP.md)): propose, approve, implement, run the
  stage's checks, report. If a check fails, stop and discuss it before changing anything.

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `npm run dev` says port 5173 is in use | Another dev server is running (the port is strict). Stop it, or use that one |
| Vitest error "failed to find the current suite" | Run tests with `npm test` (uses `scripts/run-vitest.mjs`, which fixes the drive-letter case on Windows), not `npx vitest` from a lowercase `c:\` path |
| `conda run` prints "Error while loading conda entry point: anaconda-auth …" | A known problem in the Conda `base` installation. It doesn't affect the `astera` env. Leave `base` untouched |
| GDAL/PROJ errors in Python | You're not using the activated `astera` env; see section 3 |
| Database password rejected | Use English letters and digits only; see postgresql-windows.md, troubleshooting |
| The map shows a message instead of a map | WebGL isn't available in that browser; the lists still work |
