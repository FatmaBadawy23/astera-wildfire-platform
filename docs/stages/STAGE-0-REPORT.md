# Stage 0 Report: Environment and Repository Setup

**Project:** Astera Watch, Wildfire Surface-Change Monitoring with NASA NISAR Radar
**Team:** Astera · NASA Space Apps Challenge
**Stage status:** ✅ Complete
**Completed:** 2026-11-10
**Checkpoint:** Git tag `checkpoint-stage-0` → commit `a676179`

---

## 1. Summary

Stage 0 prepared everything the team needs before writing application code:

- a clean project repository with the agreed folder structure and documentation,
- a verified Python environment (`astera`) for the backend, SAR processing and notebooks,
- a local PostgreSQL 18 + PostGIS 3.7 database server with an app database and a test database,
- a private GitHub repository with a first checkpoint.

No application features were built in this stage. All work followed the stage-gate
rule: **each step was proposed, approved, executed, verified, and only then continued.**

## 2. Key decisions

| Decision | Choice | Reason |
|---|---|---|
| Website name | **Astera Watch** | Built on the team name "Astera" (star) |
| Subtitle | *Wildfire Surface-Change Monitoring with NASA NISAR Radar* | States the purpose clearly |
| Containers | **No Docker / Docker Compose** | Team decision: simpler local setup on Windows |
| Python | Conda env `astera`, Python 3.11, **conda-forge only** | GDAL/Rasterio/PROJ/HDF5 must share one set of native libraries; no pip for geospatial packages |
| Plotting | `matplotlib-base` instead of `matplotlib` | Same plotting library without the Qt desktop GUI (~0.5 GB less disk) |
| Database | Local PostgreSQL **18.6** + PostGIS **3.7.0** | Installed directly on Windows |
| Databases | `astera_watch` (app) and `astera_watch_test` (automated tests only) | Tests never touch real data |
| DB user | Role `astera`, least privilege | No superuser / createdb / createrole / replication / bypassrls |
| Repository | Private GitHub repo `FatmaBadawy23/astera-wildfire-platform` | Keeps GitHub's existing MIT LICENSE |
| Design reference | Team logo (`frontend/public/astera-logo.jpg`) | Navy / blue / purple space theme; light **and** dark mode required (Stage D) |

## 3. What was done, step by step

### 0.1 Project skeleton and documentation ✅
Created the folder structure (`frontend/`, `backend/app/…`, `backend/processing/…`,
`backend/tests/`, `notebooks/`, `data/{mock,raw,processed,outputs}/`, `docs/`) and:

- `README.md`: project overview, data sources, stack, setup, scientific principles
- `docs/ROADMAP.md`: all stages (0, D, 1–11, C) with gates and team ownership
- `environment.yml`, `.env.example`, `.gitignore`, `.gitattributes`
- `docs/setup/`: Conda guide, PostgreSQL guide, verification scripts

### 0.2 Python environment `astera` ✅
- Dry run first, then creation from `environment.yml`.
- **264 packages, 100% from conda-forge** (no `defaults`, no pip).
- Key versions: Python 3.11.18 · GDAL / libgdal-core / **libgdal-hdf5** 3.10.3 ·
  Rasterio 1.4.3 · PROJ 9.6.2 / pyproj 3.7.2 · GEOS 3.13.1 / Shapely 2.0.7 ·
  HDF5 1.14.3 / h5py 3.12.1 · GeoPandas 1.0.1 · NumPy 2.1.3 · SciPy 1.14.1 ·
  FastAPI 0.115.14 · SQLAlchemy 2.0.54 · JupyterLab 4.3.8
- Verified with `docs/setup/verify_env.py` → **RESULT: PASS**
  (all 22 imports, GDAL HDF5 + GeoTIFF drivers, coordinate transforms,
  GDAL/PROJ data paths inside the env).

### 0.3 PostgreSQL + PostGIS ✅
- Installed by the team: PostgreSQL 18.6 (service `postgresql-x64-18`, automatic, port 5432),
  pgAdmin 4, PostGIS Bundle 3.7.0.
- `psql` is not on PATH, so it's called by full path: `C:\Program Files\PostgreSQL\18\bin\psql.exe`.

### 0.4 Role, databases and `.env` ✅
- Read-only preflight confirmed no existing role or databases.
- `docs/setup/create_databases.sql` (stops on first error, never drops anything) created:
  role `astera`, databases `astera_watch` + `astera_watch_test`, PostGIS in both.
- Local `.env` created from `.env.example` with an overwrite guard. **`.env` is never committed.**
- Verified with `docs/setup/verify_db.py` (read-only session) → **RESULT: PASS, 27/27 checks**
  for both databases: PostgreSQL 18, correct user/database, least-privilege role, ownership,
  PostGIS 3.7, EPSG:4326 + EPSG:6933, equal-area test (1°×1° cell at equator = 12,308 km²).

### 0.5 Git and GitHub ✅
- Local repo initialized in the project folder; 31 files staged and reviewed; `.env` confirmed ignored.
- GitHub repo already contained an MIT LICENSE and a one-line README, so the local commit was
  **rebased** onto it (no merge commit, no force-push). README conflict resolved by keeping
  the full project README; LICENSE preserved exactly.
- Pushed `main` and tag `checkpoint-stage-0`.

## 4. Problems encountered and how they were solved

| # | Problem | Cause | Resolution |
|---|---|---|---|
| 1 | The user's home folder `C:\Users\DELL` was itself a Git repository | An earlier accidental `git init` / `git add` (0 commits, no remote) | Investigated read-only (no commits, refs, remotes, worktrees or dependants), then deleted the folder **with approval**. The project now has its own repo. Freed 3.96 GB. |
| 2 | Conda dry run failed: `NoSpaceLeftError` | Drive C: had ~10 MB free | Read-only storage audit, then a **staged** cleanup of caches only (pip, Conda, VS Code VSIX, npm), command by command, verifying after each. Existing Conda envs verified unchanged. Free space went 0.003 → 11.6 GB. |
| 3 | Solver pulled in the Qt GUI toolkit | Full `matplotlib` package includes a desktop backend | Replaced with `matplotlib-base` (single approved line in `environment.yml`) |
| 4 | Risk of GDAL/PROJ conflicts | The PostGIS installer sets machine-wide `GDAL_DATA` / `PROJ_LIB` | Variables left untouched (PostGIS needs them). Rule: **always run Python via `conda run -n astera …`** or an activated terminal |
| 5 | `verify_db.py` failed: password authentication | Password contained special characters (needed URL-encoding), then non-English characters (Windows keyboard layout / console encoding mismatch); also one truncated `.env` line | Diagnosed read-only (server log `DETAIL` lines and yes/no checks, never showing the password). Password reset to **English letters and digits only**. Rule added to docs |
| 6 | First push not possible | GitHub repo was not empty (LICENSE + README) | `git fetch` → inspect → rebase with one reviewed README conflict → normal push |

## 5. Rules established for the team

1. **Stage gates:** propose → approve → execute → verify → report. On any failure: stop, change nothing, discuss.
2. **No Docker.**
3. **Python:** always `conda run -n astera …` (or `conda activate astera`). Never MSYS2 Python, never the Conda `base` env, never `pip install` geospatial packages.
4. **Database password** (`astera` role): **English letters and digits only.**
5. **Secrets:** `.env` is never committed, printed or shared. Only `.env.example` (with `CHANGE_ME`) is in Git.
6. **Git:** never force-push. One checkpoint tag per completed stage (`checkpoint-stage-<x>`).

## 6. How a teammate reproduces this setup

1. Clone the private repo (ask for access).
2. Create the Python env: [docs/setup/conda-environment.md](../setup/conda-environment.md).
3. Install PostgreSQL 18 + PostGIS 3.7 and create the databases: [docs/setup/postgresql-windows.md](../setup/postgresql-windows.md).
4. Verify:
   ```powershell
   conda run -n astera python docs/setup/verify_env.py   # RESULT: PASS
   conda run -n astera python docs/setup/verify_db.py    # RESULT: PASS (27/27)
   ```

Allow **~10 GB free disk space** for the Conda env, PostgreSQL and the upcoming frontend packages.

## 7. Deliverables (in the repository)

| File | Purpose |
|---|---|
| `README.md`, `docs/ROADMAP.md` | Project overview, staged plan |
| `environment.yml` | Conda env definition (conda-forge only) |
| `.env.example`, `.gitignore`, `.gitattributes` | Config template, ignore rules, line endings |
| `docs/setup/conda-environment.md` | Python environment guide |
| `docs/setup/postgresql-windows.md` | PostgreSQL + PostGIS guide (PG 18 / PostGIS 3.7) |
| `docs/setup/create_databases.sql` | Safe role/database/PostGIS creation script |
| `docs/setup/verify_env.py`, `docs/setup/verify_db.py` | Read-only verification scripts |
| `backend/…/__init__.py`, `data/*/.gitkeep`, `notebooks/.gitkeep` | Empty package/folder skeleton |
| `frontend/public/astera-logo.jpg` | Team logo (design reference) |

## 8. Not done in Stage 0 (by design)

- No frontend packages installed and no UI built: **Stage D**.
- No data models, API, adapters or processing code: **Stages 1–5**.
- No real or mock datasets yet: **Stage 2**.

## 9. Next stage

**Stage D: Design system and UI mockups**, on feature branch `stage-d-design`:
Vite + React + TypeScript + Tailwind + shadcn/ui, light/dark mode based on the logo,
app shell with all page routes, static mockups clearly labelled as mock data.
Gate: `npm run build` passes, screenshots of both themes reviewed and approved, then `checkpoint-stage-d`.
