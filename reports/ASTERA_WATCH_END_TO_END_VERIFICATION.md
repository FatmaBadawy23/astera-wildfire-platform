# Astera Watch — One-Click Launcher (`Frontend_`) & End-to-End Verification Report

## 1. Directory Clarification (`Frontend_`)

- **Requested expected path checked**: `C:\Users\asus\Desktop\Nasa\Frontend_` — does **not** exist on disk.
- **Actual `Frontend_` repository path on disk**: `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\Frontend_`
- `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\scripts\launcher_ctl.ps1` now resolves `$FrontendDir` by checking `$WorkspaceRoot\Frontend_` (`C:\Users\asus\Desktop\Nasa\Frontend_`) first and `$AppRoot\Frontend_` (`C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\Frontend_`) second, failing fast if neither contains `package.json`. It no longer points to the legacy `frontend/` directory.

---

## 2. Implemented Changes Summary

### One-Click Launcher (`RUN.bat`, `STOP.bat`, `STARTUP_README.md`, `scripts/`)
- `C:\Users\asus\Desktop\Nasa\RUN.bat` and `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\RUN.bat`: Delegate to `astera-wildfire-platform\scripts\launcher_ctl.ps1 -Action Start`.
- `C:\Users\asus\Desktop\Nasa\STOP.bat` and `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\STOP.bat`: Delegate to `astera-wildfire-platform\scripts\launcher_ctl.ps1 -Action Stop`.
- `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\scripts\preflight_check.py`: Added Python pre-flight verifier checking required packages (`fastapi`, `uvicorn`, `pydantic`, `torch`, `lightgbm`, `rasterio`, `numpy`, `scipy`, `matplotlib`, `PIL`, `shapely`, `pyproj`), active run pointer (`outputs/runs/latest_run.json` -> `run_20261114_025000_phase_g`), dataset manifest, model comparison report, `real_unet_resnet34_phase_g.pt`, and `lightgbm_phase_g.pkl`.
- `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\scripts\launcher_ctl.ps1`:
  - Uses `C:\Program Files\Python313\python.exe` (Python 3.13.7; skipping MSYS2/Conda `base`) and `Node.js v22.19.0` / `npm 10.9.3`.
  - Runs FastAPI (`uvicorn backend.app.main:app --host 127.0.0.1 --port 8000`) and `Frontend_` Vite (`npm.cmd run dev -- --host 127.0.0.1 --port 5173`, using `Frontend_\package.json` `"dev": "vite"` with `--cwd` set to `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\Frontend_`) in persistent minimized console windows wrapped by `scripts\launch_service_window.py`.
  - Records PIDs, ports, `frontend_dir`, and log paths in `C:\Users\asus\Desktop\Nasa\.astera_runtime\launcher_state.json`.
  - Polls `http://127.0.0.1:8000/api/health`, `/api/models/available`, `http://127.0.0.1:5173/`, and proxied `http://127.0.0.1:5173/api/health`.
- `C:\Users\asus\Desktop\Nasa\STARTUP_README.md` (and synced `astera-wildfire-platform\STARTUP_README.md`): Documented one-click startup, `STOP.bat` selective shutdown, URLs, `Frontend_` working directory, logs, and troubleshooting.

### `Frontend_` Fixes & Integration
- Installed locked `Frontend_` dependencies via `npm.cmd ci` (`added 417 packages`).
- `Frontend_\src\data\http\liveInferenceClient.ts`:
  - Normalized `VITE_API_BASE_URL` so host URLs without a trailing `/api` resolve `/api/...` cleanly while keeping the default `/api` Vite proxy (`Frontend_\vite.config.ts` -> `http://127.0.0.1:8000`).
  - Extracted structured FastAPI `detail.code` / `detail.message` objects instead of stringifying to `[object Object]`.
- `Frontend_\src\features\live\LiveInferenceStudioPage.tsx`:
  - Fixed `<Page title=... description=...>` prop requirement (removing duplicate `<PageHeader>`), resolving `tsc -b --noEmit` error `TS2741`.
  - Implemented interactive Before/After swipe image comparison overlay (`compareMode === "swipe"`) and GeoTIFF/GeoJSON download links.
- `Frontend_\src\features\research\ResearchPages.tsx`: Added a link to `"Live SAR Inference Studio"` (`/live-inference`) inside `ResearchOverviewPage`'s `worksToday` section while keeping `NAV_ITEMS` unchanged.
- `Frontend_\src\features\live\LiveInferenceStudioPage.test.tsx`: Added Vitest component test covering model registry display, sample dual-pol loading, pair validation, inference results, swipe view switching, and 422 RGB error handling.

---

## 3. Executed Tests & Live Verification Evidence

### Static & Unit/Component Checks
1. **Backend pytest suite** (`& "C:\Program Files\Python313\python.exe" -m pytest -v` in `astera-wildfire-platform`):
   - Result: **`63 passed, 1 warning in 36.73s`**, exit code `0`.
2. **`Frontend_` TypeScript check & Vite build** (`npm.cmd run build` -> `tsc -b && vite build`):
   - Result: Exit code `0`, `✓ 2340 modules transformed`, `✓ built in 5.01s`.
3. **`Frontend_` Vitest suite** (`npm.cmd test` -> `node scripts/run-vitest.mjs run`):
   - Result: **27 test files passed (`345` tests passed)**, **1 test file failed** (`src/styles/tokens.test.ts` — pre-existing `ENOENT` because `docs/design/tokens.json` does not exist in `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\docs\design\`).

### Live `RUN.bat` Startup, Vite Proxy & Multi-Model Inference Test
Executed `cmd.exe /c "C:\Users\asus\Desktop\Nasa\RUN.bat -KeepAlive -NoBrowser"`:
- Pre-flight check passed: `PREFLIGHT_OK|run_id=run_20261114_025000_phase_g|unet_mb=333.03|lgbm_kb=16.4|torch=2.12.1+cpu`
- Frontend directory resolved: `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform\Frontend_` (`package.json` `dev` script=`vite`)
- `.astera_runtime\logs\frontend.log`: `Vite v8.3.7 ready in 1472 ms` at `http://127.0.0.1:5173/`
- `.astera_runtime\logs\backend.log`: Uvicorn started (`PID 25024`), zero server errors across all requests.

Live verification through Vite `Frontend_` (`http://127.0.0.1:5173`) -> FastAPI (`http://127.0.0.1:8000`):
- `GET /health` and `GET /api/health` -> HTTP `200`, `active_run_id=run_20261114_025000_phase_g`.
- `GET /api/models/available` -> HTTP `200`, 4 models `READY`: `UNet_ResNet34`, `LightGBM_Pixel_Spatial`, `Log_Ratio_Baseline`, `CUSUM_Temporal`.
- `GET http://127.0.0.1:5173/live-inference` -> HTTP `200`.
- `GET http://127.0.0.1:5173/src/features/live/LiveInferenceStudioPage.tsx` -> HTTP `200` (transformed module length `70349`).
- `POST /api/analysis/upload` with synthetic `64x64` RGB PNG -> HTTP `200` with scientific rejection (`valid_for_sar_inference=False`, `error_code=UNSUPPORTED_OPTICAL_RGB_FOR_SAR_MODEL`, `validation_status=REJECTED_NON_GEOSPATIAL_RGB`).
- `POST /api/analysis/upload` with `CA_BUG_2026_sentinel1_pre_dualpol_vv_vh_db.tif` (`upl_bf79127441`) and `post_dualpol_vv_vh_db.tif` (`upl_d4592188a2`) -> both HTTP `200`, `valid_for_sar_inference=True`.
- `POST /api/analysis/validate-pair` -> HTTP `200`, `pair_id=pair_37f4f9d021`, `status=SUITABLE`, `compatible=True`, overlap `100.0%`.
- `POST /api/analysis/run` (`model_type="unet"`, `run_all_models=True`, `live_inference=True`) -> HTTP `200`, `analysis_id=ana_14a1f7eb49`:
  - `unet` (`UNet_ResNet34`): `129.934 km²` (`324,835` px, ROC AUC vs MCD64A1 `0.9432`, F1 `0.9087`, `7.0583s`)
  - `lightgbm` (`LightGBM_Pixel_Spatial`): `41.3448 km²` (`103,362` px, ROC AUC vs dNBR `0.8136`, `4.7572s`)
  - `log_ratio` (`Log_Ratio_Baseline`): `114.1336 km²` (`285,334` px, F1 vs MCD64A1 `0.7636`, `0.0403s`)
  - `cusum` (`CUSUM_Temporal`): `131.0424 km²` (`327,606` px, F1 vs MCD64A1 `0.8091`, `0.0728s`)
- Overlay PNGs (`pre_fire_vh_db.png`, `post_fire_vh_db.png`, `delta_vh_db.png`, `burn_probability.png`, `predicted_burn_mask.png`), `overview.png`, and `burned_polygons.geojson` (`250` features) all returned HTTP `200` via Vite proxy.
- `/api/metrics`, `/api/dataset/stats`, `/api/nisar/status`, `/api/models/comparison` returned HTTP `200` via Vite proxy.

### `STOP.bat` Selective Shutdown & `RUN.bat` Clean Restart
- Spawned an unrelated dummy Python process (`PID 31368`).
- Executed `cmd.exe /c "C:\Users\asus\Desktop\Nasa\STOP.bat -NoPause"` -> exit code `0`.
- Verified: port `8000` free (`PORT8000_BUSY=False`), port `5173` free (`PORT5173_BUSY=False`), `launcher_state.json` removed (`STATE_EXISTS=False`), checkpoint intact (`CKPT_INTACT=True`), and unrelated Python `PID 31368` remained alive (`DUMMY_PID_31368_ALIVE=True`).
- Restarted `RUN.bat -KeepAlive -NoBrowser` a second time -> verified `BACKEND_STATUS=ONLINE`, `RUN=run_20261114_025000_phase_g`, `FRONTEND_HTTP=200`, `PROXY_STATUS=ONLINE`, then ran `STOP.bat -NoPause` so ports are free and ready for interactive double-click launch.

---

## 4. Remaining Gaps / Known Limitations

1. **Interactive Chrome Browser DevTools Inspection Not Run**: The `browser` subagent could not attach to a running Chrome session (`DevToolsActivePort` missing / remote debugging disabled at `chrome://inspect/#remote-debugging`), so interactive point-and-click verification in a live Chrome window remains unexecuted here; all live API/proxy endpoints, transformed React/TSX serving, and component DOM behaviors were verified programmatically and via Vitest/jsdom.
2. **Pre-existing Missing Design Token File**: `Frontend_\src\styles\tokens.test.ts` fails in `npm test` because `docs/design/tokens.json` does not exist in `astera-wildfire-platform` (already compiled `src/styles/tokens.css` works for Vite build/dev).
3. **`Frontend_\.env.example` Default `VITE_DATA_MODE=mock`**: The general map/history/event pages inside `Frontend_` use `unavailableRepositories` when `VITE_DATA_MODE=http` because Stage 7 HTTP adapters for those catalog pages are placeholders in `Frontend_`; `/live-inference` connects directly to FastAPI `/api/...` in all modes via `liveInferenceClient.ts`.
