# CLAUDE.md: guidance for AI assistants working in this repo

Project: **Astera Watch**, a NISAR-ready wildfire surface-change platform.
Team Astera (six students), NASA Space Apps Challenge. Full roadmap: `docs/ROADMAP.md`.

Current scientific status: real Sentinel-1/Sentinel-2/MCD64A1 cross-sensor prototype.
NISAR GCOV was not acquired because Earthdata Login credentials were unavailable. Never
describe the current metrics as NISAR results. See `reports/REAL_DATA_RESULTS.md`.

## Working rules (mandatory)

- Work **stage by stage** as defined in `docs/ROADMAP.md`. After each stage, run
  its gate tests, report the results, and **wait for approval** before continuing.
- **Do not install software, change system settings, or run git commit/push
  without explicit approval.** Show the exact commands first.
- **If a test fails, change nothing.** Report the failure and discuss it first.
- **No Docker / Docker Compose.**

## Environment

- OS: Windows. **Verified current interpreter: system Python 3.13.7.**
- The Conda env **`astera` does not currently exist** in this workspace. Do not create
  or activate it without explicit approval. The commands used for the real-data run are:
  ```powershell
  python scripts/acquire_real_data.py --event all
  python scripts/build_real_dataset.py
  python scripts/run_real_pipeline.py --epochs 8
  python -m pytest -q
  ```
- Do not replace or upgrade the existing Python environment. Install only missing
  dependencies, and only with approval.
- Do not use the MSYS2 Python or the Conda `base` env.
- The PostGIS installer may set machine-wide `GDAL_DATA` / `PROJ_LIB` pointing at
  PostgreSQL's folders. Do not delete those variables; PostGIS needs them.
- Database: local **PostgreSQL 18 + PostGIS 3.7**, service `postgresql-x64-18`,
  database `astera_watch`, connection in `.env` (`DATABASE_URL`). `psql` is not on
  PATH: use `& "C:\Program Files\PostgreSQL\18\bin\psql.exe"`. Never print or
  commit secrets.
- Frontend: Node + npm, Vite dev server on `http://localhost:5173`.
- Backend: FastAPI on `http://localhost:8000`.

## Architecture rules

- `backend/processing/` is a plain Python library. API code and notebooks import
  from it; notebooks must not duplicate processing logic.
- Satellite files live in `data/`, never inside PostgreSQL. The DB stores metadata,
  footprints and file references.
- Each data product type has its own adapter (`MockSARAdapter`, `NISAR_GCOV_Adapter`,
  `NISAR_GSLC_Adapter`, `Sentinel1Adapter`) producing the common internal model.
- Keep things simple: no microservices, no message queues, no Kubernetes.

## Scientific integrity rules

- Do not fabricate NASA data, metadata or results. Missing values become `null`
  plus a validation warning, never guessed defaults.
- The real NISAR GCOV structure is verified in `reports/PHASE1_DATA_RESEARCH.md`.
  Keep HDF5 paths in config and mark unresolved NISAR integration work with
  `# NISAR-INTEGRATION`.
- NISAR acquisition requires Earthdata Login. Read credentials only from environment
  variables or `.netrc`; never print, log, or commit them.
- Keep GCOV (covariance) and GSLC (complex) processing separate.
- No universal backscatter thresholds. Do not transfer Sentinel-1 C-band
  thresholds to NISAR L/S-band.
- FIRMS active-fire points are **never** burned-area polygons or ground truth.
- All synthetic data must be labelled as such, in files, API responses and the UI.
- The chatbot only reports results that exist in the backend and states when data is mock.

## Design

- The logo `frontend/public/astera-logo.jpg` is the visual reference: space navy,
  blue ring, purple accents, white.
- Light and dark mode are both required.
- Data colours (fire points, change maps, MOCK banner) are separate from brand
  colours and the same in both themes.
