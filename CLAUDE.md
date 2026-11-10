# CLAUDE.md: guidance for AI assistants working in this repo

Project: **Astera Watch**, Wildfire Surface-Change Monitoring with NASA NISAR Radar.
Team Astera (six students), NASA Space Apps Challenge. Full roadmap: `docs/ROADMAP.md`.

## Working rules (mandatory)

- Work **stage by stage** as defined in `docs/ROADMAP.md`. After each stage, run
  its gate tests, report the results, and **wait for approval** before continuing.
- **Do not install software, change system settings, or run git commit/push
  without explicit approval.** Show the exact commands first.
- **If a test fails, change nothing.** Report the failure and discuss it first.
- **No Docker / Docker Compose.**

## Environment

- OS: Windows. Python: Conda env **`astera`** (Python 3.11, conda-forge only).
- **Always run project Python through the env:**
  ```powershell
  conda run -n astera python <script.py>
  conda run -n astera pytest
  conda run -n astera uvicorn app.main:app --reload
  ```
  or from a terminal where `conda activate astera` has been run.
  If `conda` is not on PATH, use `& "$env:USERPROFILE\anaconda3\Scripts\conda.exe" run -n astera ...`.
- **Never call `...\envs\astera\python.exe` directly** without activation. The
  PostGIS installer set machine-wide `GDAL_DATA` / `PROJ_LIB` pointing at
  PostgreSQL's folders. Only Conda activation (which `conda run` does) replaces
  them with the env's own GDAL/PROJ data. Do not delete those machine variables:
  PostGIS needs them.
- **Never** use the MSYS2 Python on PATH (`C:\msys64\...`) or the Conda `base` env
  (it has a broken package; leave it untouched).
- Never `pip install` geospatial packages (GDAL, Rasterio, PyProj, Shapely,
  GeoPandas, h5py) into `astera`. Change `environment.yml` and update the env instead.
- Verify the env any time with `conda run -n astera python docs/setup/verify_env.py`.
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
- The real NISAR file structure is **not yet verified**. Mark NISAR-specific
  assumptions with `# NISAR-INTEGRATION` and keep HDF5 paths in config.
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
