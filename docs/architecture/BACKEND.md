# Backend architecture

> **Status: not implemented.** `backend/` contains only empty Python packages (`__init__.py` files). There is
> no FastAPI application object, no `main.py`, no endpoint, no model, no processing code and no test. Nothing in
> `backend/` can be run yet.

## What exists

| Path | Intended purpose (from the [roadmap](../ROADMAP.md)) | Contents today |
|---|---|---|
| `backend/app/api/` | Route handlers | empty package |
| `backend/app/database/` | DB session, migrations | empty package |
| `backend/app/models/` | SQLAlchemy + GeoAlchemy2 models | empty package |
| `backend/app/schemas/` | Pydantic request and response schemas | empty package |
| `backend/app/services/` | Analysis jobs, chat | empty package |
| `backend/processing/adapters/` | `MockSARAdapter`, `NISAR_GCOV_Adapter`, `NISAR_GSLC_Adapter`, `Sentinel1Adapter` | empty package |
| `backend/processing/acquisition/` | FIRMS, ASF and Copernicus search clients | empty package |
| `backend/processing/preprocessing/` | GCOV and GSLC preprocessing, kept separate | empty package |
| `backend/processing/change_detection/` | Log-ratio change, data-driven threshold, changed area | empty package |
| `backend/processing/validation/` | Metadata and product validation | empty package |
| `backend/tests/` | pytest | empty package |

The Python environment for all of this already exists and is verified: the Conda env `astera`, defined in
`environment.yml` (Python 3.11, GDAL 3.10 with the HDF5 driver, Rasterio, h5py, GeoPandas, FastAPI, SQLAlchemy,
GeoAlchemy2, psycopg 3, Alembic, httpx, pytest, JupyterLab). See [DEVELOPMENT.md](../setup/DEVELOPMENT.md).

## Planned API (roadmap Stage 5, not built)

These endpoint names come from the roadmap. Request and response contracts don't exist yet (roadmap Stage 1),
and none of these endpoints is implemented:

`/health`, `/api/events`, `/api/events/{id}`, `/api/scenes`, `/api/scenes/{id}`, `/api/data/inspect`,
`/api/data/upload`, `/api/analysis/run`, `/api/analysis/{id}`, `/api/analysis/{id}/results`, `/api/chat`.

The roadmap plans analysis as FastAPI background tasks, with no separate job system.

## Configuration (planned)

`.env.example` (copy to `.env`; **never commit `.env`**) lists the settings the backend will read: `APP_ENV`,
`LOG_LEVEL`, `USE_MOCK_DATA`, `DATABASE_URL`, `TEST_DATABASE_URL`, `DATA_DIR`, `MAX_UPLOAD_MB`, `CORS_ORIGINS`,
`VITE_API_BASE_URL`, `FIRMS_MAP_KEY`, `EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`, `CDSE_USERNAME`, `CDSE_PASSWORD`,
`LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`. Today only `DATABASE_URL` and `TEST_DATABASE_URL` are used, by
`docs/setup/verify_db.py`. Ask the team lead for values; never paste them into documents, tickets or chats.

## Rules the backend must follow (project rules)

- `backend/processing/` is a plain Python library. The API and the notebooks import it; notebooks never duplicate
  processing logic.
- Each product type has its own adapter producing one common internal model. GCOV (covariance) and GSLC (complex)
  processing stay separate.
- The real NISAR file structure is **not verified**. Mark NISAR-specific assumptions with `# NISAR-INTEGRATION`
  and keep HDF5 paths in configuration.
- No universal backscatter thresholds. Sentinel-1 (C-band) thresholds are never reused for NISAR (L-band or S-band).
- Missing metadata becomes `null` plus a validation warning, never a guessed default.
- FIRMS points are stored as active-fire points, never as burned area.
- Synthetic data is labelled as synthetic in files, API responses and the UI.
- Satellite files stay on disk under `data/`. The database stores metadata, footprints and file references.
- Always run Python through the Conda env (`conda run -n astera …`); see [DEVELOPMENT.md](../setup/DEVELOPMENT.md).

## Frontend integration point

When the API exists, implement a repository adapter in `frontend/src/data/http/`, select it in
`frontend/src/data/DataProvider.tsx`, and map the API contracts to the frontend types in `frontend/src/data/types/`
in one place. See [FRONTEND.md](FRONTEND.md#data-flow).
