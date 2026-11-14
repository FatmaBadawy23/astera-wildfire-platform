# NASA Astera Watch — One-Click Startup & Operations Guide

## 1. Quick Start (One-Click Launch)

To start the entire NASA Astera Watch Wildfire Intelligence Platform:

1. Open Windows File Explorer and navigate to:
   `C:\Users\asus\Desktop\Nasa`
2. Double-click **`RUN.bat`**.

### What `RUN.bat` Does Automatically
1. **Conflict & Duplicate Check**: Inspects TCP ports `8000` (FastAPI) and `5173` (Vite). If a previous Astera Watch launcher session is running, it cleanly cycles those processes; if an unrelated application is occupying either port, it aborts with a clear diagnostic showing the conflicting PID.
2. **Runtime & Environment Detection**: Locates Python (`.venv` / Conda `astera` / System Python 3.11+) and Node.js (`node.exe` / `npm.cmd`).
3. **Configuration Verification**: Checks `.env` / `.env.example` keys without printing secret values to the console or logs.
4. **Pre-Flight ML & Geospatial Verification**: Verifies that `fastapi`, `uvicorn`, `torch`, `lightgbm`, `rasterio`, `numpy`, `scipy`, and `matplotlib` are importable and that the active versioned run (`outputs/runs/latest_run.json` $\rightarrow$ `run_20261114_025000_phase_g`), dataset manifest, U-Net ResNet-34 checkpoint (`real_unet_resnet34_phase_g.pt`), and LightGBM checkpoint (`lightgbm_phase_g.pkl`) exist on disk.
5. **Backend Startup & HTTP Health Polling**: Starts `uvicorn backend.app.main:app --host 127.0.0.1 --port 8000` and polls `http://127.0.0.1:8000/api/health` and `http://127.0.0.1:8000/api/models/available` until all 4 models (`UNet_ResNet34`, `LightGBM_Pixel_Spatial`, `Log_Ratio_Baseline`, `CUSUM_Temporal`) report `READY`.
6. **Frontend Startup & Proxy Verification**: Starts Vite (`npm run dev` from `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\Frontend_`) on `http://127.0.0.1:5173` and verifies both `GET http://127.0.0.1:5173/` and proxied `GET http://127.0.0.1:5173/api/health` return HTTP `200`.
7. **PID Tracking, Persistent Windows & Browser Launch**: Keeps Backend and Frontend running in minimized terminal windows, writes the active process IDs and log paths to `C:\Users\asus\Desktop\Nasa\.astera_runtime\launcher_state.json`, and opens `http://127.0.0.1:5173` in your default browser.

---

## 2. How to Stop the Application (`STOP.bat`)

To shut down the platform cleanly:

1. Navigate to `C:\Users\asus\Desktop\Nasa`.
2. Double-click **`STOP.bat`**.

### Safety Guarantees of `STOP.bat`
- Reads `C:\Users\asus\Desktop\Nasa\.astera_runtime\launcher_state.json` and terminates **only** the FastAPI and Vite process trees started by `RUN.bat`.
- Does **not** kill unrelated Python or Node.js processes running on your machine.
- Verifies that TCP ports `8000` and `5173` are released.
- Preserves all datasets, trained checkpoints, uploaded rasters, and analysis outputs.

---

## 3. Service Ports & URLs

| Service | Local URL | Purpose |
| :--- | :--- | :--- |
| **React/Vite Web UI (`Frontend_`)** | `http://127.0.0.1:5173` | Main Astera Watch Fire Map, History, Research Center, and UI shell |
| **Live SAR Upload & Inference Studio** | `http://127.0.0.1:5173/live-inference` | Pre/Post GeoTIFF upload, pair validation, Before/After comparison & live multi-model SAR inference |
| **FastAPI Backend Base** | `http://127.0.0.1:8000/api` | REST API for events, uploads, pair validation, and real model inference |
| **Swagger / OpenAPI Docs** | `http://127.0.0.1:8000/docs` | Interactive API documentation and endpoint tester |
| **Root Health Check** | `http://127.0.0.1:8000/health` | Service status and NISAR maturity flags |
| **Detailed ML Health Check** | `http://127.0.0.1:8000/api/health` | Geospatial, dataset, and checkpoint readiness |
| **Available Models Registry** | `http://127.0.0.1:8000/api/models/available` | Checkpoint paths, SHA-256 hashes, input contracts, and thresholds |

---

## 4. Required Software & Dependencies

- **Operating System**: Windows 10 or Windows 11 (64-bit)
- **Python**: Python 3.11+ (verified with Python 3.13.7) with `fastapi`, `uvicorn`, `torch`, `lightgbm`, `rasterio`, `numpy`, `scipy`, `matplotlib`, `pillow`, `shapely`, `pyproj`
- **Node.js**: Node.js 18+ / 20+ / 22+ with `npm`

---

## 5. Runtime Logs & Troubleshooting

All startup and service logs are written to `C:\Users\asus\Desktop\Nasa\.astera_runtime\logs\`:
- `launcher.log` — Timestamped launcher pre-flight, startup, and shutdown log
- `backend.log` — FastAPI / Uvicorn live server output, HTTP requests, and errors
- `frontend.log` — Vite (`Frontend_`) live dev server output and errors

### Common Troubleshooting Steps
1. **Port Conflict (`Port 8000 or 5173 is already in use`)**:
   - Run `STOP.bat` first. If an external application is using port `8000` or `5173`, `launcher.log` will print the exact conflicting PID and command line.
2. **Missing Checkpoint or Dataset Error (`MISSING_ARTIFACT`)**:
   - Verify that `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\outputs\runs\latest_run.json` points to `run_20261114_025000_phase_g` and that `outputs/runs/run_20261114_025000_phase_g/checkpoints/` contains `real_unet_resnet34_phase_g.pt` and `lightgbm_phase_g.pkl`.
3. **Uncalibrated RGB Image Rejected on Upload (`UNSUPPORTED_OPTICAL_RGB_FOR_SAR_MODEL`)**:
   - By design, the SAR models require calibrated georeferenced Sentinel-1 GeoTIFFs (`.tif`/`.tiff`) or multi-band SAR stacks (`.npz`). Ordinary 8-bit RGB `.png`/`.jpg` photos lack radar polarizations (`VV`/`VH`) and CRS metadata and are scientifically rejected. Open `http://127.0.0.1:5173/live-inference` (or click **Live SAR Inference Studio** in Research Center) and use **"Load CA_BUG_2026 Dual-Pol (VV+VH) GeoTIFF Pair"** or upload `.tif` files from `outputs/sample_uploads/`.
