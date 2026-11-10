<p align="center">
  <img src="frontend/public/astera-logo.jpg" alt="Team Astera logo" width="160">
</p>

<h1 align="center">Astera Watch</h1>
<p align="center"><em>Wildfire Surface-Change Monitoring with NASA NISAR Radar</em></p>
<p align="center">Team Astera · NASA Space Apps Challenge</p>

---

Astera Watch is a web application for monitoring surface changes linked to
wildfires using synthetic aperture radar (SAR) data from the NASA NISAR mission.
You pick a wildfire event, load compatible pre-fire and post-fire radar scenes,
run a backscatter change analysis, explore the results on maps, and ask the
built-in assistant to explain them.

> **Project status: early setup (Stage 0).** See [docs/ROADMAP.md](docs/ROADMAP.md).
>
> Until real NISAR products are available, the application runs on **synthetic
> mock datasets**. They are always clearly labelled and are never presented as
> real satellite observations.

## Data sources

| Source | Role |
|---|---|
| NASA NISAR (via ASF) | Primary SAR data (GCOV / GSLC products) |
| NASA FIRMS | Active-fire detections, used **only** for event discovery. Not burned-area boundaries. |
| Copernicus Sentinel-1 | Temporary C-band test data during development |
| Mock datasets | Synthetic data for development and testing |

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router,
  MapLibre GL JS, Recharts, Axios, TanStack Query
- **Backend:** Python 3.11, FastAPI, Pydantic, SQLAlchemy
- **SAR / geospatial:** GDAL, Rasterio, h5py, NumPy, SciPy, GeoPandas, Shapely, PyProj, Matplotlib
- **Database:** PostgreSQL + PostGIS (local install, no Docker)
- **Testing:** Pytest, Vitest
- **Notebooks:** JupyterLab

## Repository layout

```
astera-wildfire-platform/
├── frontend/              React + Vite web app
├── backend/
│   ├── app/               FastAPI application
│   │   ├── api/           Route handlers
│   │   ├── database/      DB session and migrations
│   │   ├── models/        SQLAlchemy models
│   │   ├── schemas/       Pydantic request/response schemas
│   │   └── services/      Business logic (analysis jobs, chat, ...)
│   ├── processing/        SAR processing library (also used by notebooks)
│   │   ├── adapters/      Mock, NISAR GCOV, NISAR GSLC, Sentinel-1 readers
│   │   ├── acquisition/   FIRMS, ASF, Copernicus search clients
│   │   ├── preprocessing/ Product-specific preprocessing
│   │   ├── change_detection/
│   │   └── validation/
│   └── tests/
├── notebooks/             Exploration, change detection, validation
├── data/
│   ├── mock/              Small synthetic datasets (committed)
│   ├── raw/               Downloaded satellite files (not committed)
│   ├── processed/         Intermediate files (not committed)
│   └── outputs/           Analysis outputs (not committed)
├── docs/                  Roadmap, setup guides, API docs
├── environment.yml        Conda environment `astera`
└── .env.example           Configuration template
```

## Setup (Windows)

1. **Python environment:** follow [docs/setup/conda-environment.md](docs/setup/conda-environment.md)
   to create and activate the `astera` Conda env.
2. **Database:** follow [docs/setup/postgresql-windows.md](docs/setup/postgresql-windows.md)
   to install PostgreSQL + PostGIS and create the `astera_watch` database.
3. **Configuration:** `Copy-Item .env.example .env` and fill in your values.
   Never commit `.env`.
4. Backend, frontend and notebook run instructions will be added in later stages.

## Scientific principles

- Mock and Sentinel-1 results are never presented as NISAR results.
- FIRMS active-fire detections are not burned-area ground truth.
- Missing metadata stays missing. It is reported, never invented.
- GCOV and GSLC products are processed separately.
- There are no universal backscatter thresholds. Fire effects on radar depend on
  vegetation, moisture, roughness, geometry, frequency and polarization.

## Team

Team Astera: six members. Module ownership is listed in [docs/ROADMAP.md](docs/ROADMAP.md#team-ownership).
