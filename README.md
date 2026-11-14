<p align="center">
  <img src="frontend/public/astera-logo.jpg" alt="Team Astera logo" width="160">
</p>

<h1 align="center">Astera Watch</h1>
<p align="center"><em>Wildfire surface-change monitoring with open SAR data, built NISAR-ready</em></p>
<p align="center">Team Astera - NASA Space Apps Challenge</p>

---

Astera Watch is a geospatial and machine-learning platform for burned-area change
detection. The codebase supports NISAR GCOV ingestion, but **the current results use
Sentinel-1 C-band data because NISAR science products could not be downloaded without
Earthdata Login credentials**. Every result is labelled as a cross-sensor prototype; none
is presented as a NISAR result.

## Current status

- Real Sentinel-1 RTC, Sentinel-2 L2A, and MCD64A1 data acquired from Microsoft Planetary
  Computer for four verified 2026 California/Nevada fires.
- Three events used for a leakage-controlled experiment: Gann (TRAIN), Dome (VALIDATION),
  Bug (held-out TEST). Timber was acquired but excluded because its MCD64A1 scar
  aggregates an overlapping fire complex and its Sentinel-1 VH signal is incoherent.
- 336 model-ready paired patches (121 / 121 / 94), well below the 10,000 cap, with strict `SCL=6` water exclusion (`0` water pixels in valid mask) and `MaskedBCEDiceLoss`.
- Four analyses: calibrated log-ratio baseline, LightGBM (`Phase G2 Config D`), U-Net ResNet-34 (`MaskedBCEDiceLoss`), and multi-temporal CUSUM.
- All thresholds/normalization fitted on TRAIN (`valid_mask > 0` land pixels) or VAL only; TEST evaluated once.
- Active versioned run: **`run_20261114_025000_phase_g`** (preserving `run_20261114_013500` untouched).
- API serves stored real metrics, GeoTIFF audits, GeoJSONs, and RGBA PNG overlays across `/api` and `/api/v1`.
- React + TypeScript + Vite frontend (`frontend/`) integrated with all backend endpoints.
- Test suite: **60 backend tests passed** + **3 frontend Vitest tests passed**.

## Held-out TEST result (Bug Fire — `run_20261114_025000_phase_g`)

Evaluation against **Sentinel-2 L2A dNBR ≥ 0.11 (20 m)** and **NASA MODIS MCD64A1.061 QA-Filtered (20 m & 500 m blocks)** are reported on strictly separate leaderboards (`465,828` valid land pixels):

### Leaderboard 1: vs Sentinel-2 L2A dNBR ≥ 0.11 (20 m)
| Analysis | Threshold | TEST F1 | 95% Block-Bootstrap CI | IoU | Precision | Recall | Specificity | ROC-AUC | PR-AUC | Area Bias (%) |
|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|
| **U-Net ResNet-34 (`MaskedBCEDiceLoss`)** | `0.66` | **0.8051** | `[0.7720, 0.8301]` | **0.6738** | 0.6920 | 0.9624 | 0.5693 | **0.8756** | **0.8505** | `+39.07%` |
| **CUSUM (`h=3.5`)** | `3.50` | **0.7123** | `[0.6628, 0.7396]` | 0.5532 | 0.6101 | 0.8557 | 0.4500 | 0.7582 | 0.7587 | `+40.27%` |
| **Log-Ratio Baseline (`-1.20 dB`)** | `-1.20 dB` | **0.6964** | `[0.6504, 0.7235]` | 0.5342 | 0.6332 | 0.7735 | 0.5494 | 0.7342 | 0.7328 | `+22.16%` |
| **All-Burned Trivial** | `0.00` | **0.6679** | `[0.6011, 0.7016]` | 0.5014 | 0.5014 | 1.0000 | 0.0000 | `null` | `null` | `+99.44%` |
| **LightGBM (`Config D`, `best_iter=6`)** | `0.17` | **0.5076** | `[0.4640, 0.5435]` | 0.3401 | **0.8271** | 0.3661 | **0.9230** | 0.8136 | 0.7961 | `-55.73%` |

### Leaderboard 2: vs NASA MODIS MCD64A1.061 QA-Filtered (20 m & 500 m Blocks)
| Analysis | 20 m F1 | 20 m IoU | 20 m Precision | 20 m Recall | 20 m Specificity | 20 m ROC-AUC | 20 m Area Bias (%) | 500 m Block F1 | 500 m Pearson $r$ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **U-Net ResNet-34 (`MaskedBCEDiceLoss`)** | **0.9088** | **0.8329** | 0.9405 | 0.8792 | 0.8367 | **0.9433** | **`-6.52%`** | **0.9253** | **0.7906** |
| **All-Burned Trivial** | 0.8545 | 0.7460 | 0.7460 | 1.0000 | 0.0000 | `null` | `+34.06%` | 0.8567 | 0.0000 |
| **CUSUM (`h=3.5`)** | 0.8091 | 0.6794 | 0.8336 | 0.7860 | 0.5394 | 0.7520 | **`-5.72%`** | **0.9650** | **0.7931** |
| **Log-Ratio Baseline (`-1.20 dB`)** | 0.7636 | 0.6177 | 0.8468 | 0.6953 | 0.6306 | 0.7262 | `-17.89%` | 0.9287 | 0.7547 |
| **LightGBM (`Config D`)** | 0.4315 | 0.2751 | **0.9408** | 0.2799 | **0.9483** | 0.7730 | `-70.24%` | 0.3188 | 0.4524 |

Validation (`CA_DOME_2026`) vs dNBR: U-Net F1 `0.3388` (IoU `0.2039`, ROC-AUC `0.7794`), LightGBM F1 `0.1547`, Log-Ratio F1 `0.1331`, CUSUM F1 `0.1313`, All-Burned F1 `0.1304`. Training (`CA_GANN_2026`) vs dNBR: U-Net F1 `0.8575` (IoU `0.7506`, ROC-AUC `0.9684`).

**Do not cite these as NISAR performance.** The SAR input is Sentinel-1 C-band (`is_nisar: false`, `0` NISAR pixels used).

## Data sources

| Source | Role |
|---|---|
| Sentinel-1 RTC (VV/VH, 20 m) | SAR model input (`32` GeoTIFFs across 4 events) |
| Sentinel-2 L2A (B03/B04/B08/B11/B12/SCL) | Primary dNBR reference labels; `SCL=6` water strictly excluded (`48` GeoTIFFs) |
| NASA MODIS MCD64A1.061 (500 m) | Independent QA-filtered burned-area reference (`20` GeoTIFFs) |
| NASA FIRMS (`VIIRS_SNPP_NRT`) | Live active-fire thermal hotspot context (`3,766` buffered / `306` in-AOI + `106` Egypt rows; never used as burned-area polygons) |
| NISAR L2 GCOV (`C3622241360-ASF`) | Supported by `NISARGCOVReader`; `28` granules (`15` pairs) discovered via CMR; download blocked (`HTTP 401`) without Earthdata OAuth2 + ASF EULA |

## Reproduce

```powershell
# 1. Execute full versioned Phase G revalidation & geospatial export pipeline
python scripts/execute_phase_g_run.py

# 2. Run all 60 backend unit, masked-loss, and API contract tests
python -m pytest -v

# 3. Run frontend typecheck, tests, and production build
cd frontend
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

The acquisition step needs network access and should be run sequentially because the
Planetary Computer SAS endpoint rate-limits bursts. NISAR acquisition is a separate path
and remains blocked until Earthdata credentials are supplied.

## API

```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Endpoints (mounted under both `/api` and `/api/v1`):

- `GET /api/events` - verified real events (Gann, Dome, Bug; `?include_excluded=true` includes Timber)
- `GET /api/events/{event_id}` - event metadata and provenance
- `GET /api/events/{event_id}/before-after` - 16-step Before/After SAR change summary, burned area ($\text{km}^2$, $\text{ha}$, CI95), and provenance
- `GET /api/events/{event_id}/products` - georeferenced GeoTIFF, GeoJSON, and overview PNG product catalog
- `GET /api/events/{event_id}/validation` - independent validation against Sentinel-2 dNBR and NASA MODIS MCD64A1.061 (20 m pixel & 500 m block-reconciled)
- `GET /api/nisar/candidates` - live-verified NASA CMR (`C3622241360-ASF` & `C2854338529-ASF`) matched pre/post NISAR GCOV pairs & Harmony subset URLs
- `POST /api/analysis/run` - stored metrics for `log_ratio`, `lightgbm`, `unet`, `cusum`,
  or `all_burned`
- `GET /api/analysis/{job_id}/results` - job result cache
- `GET /api/models/comparison` - full real-data report
- `GET /api/health` - service health

The API never fabricates a confusion matrix. If the real report is missing, it says so.

## Repository layout

```
astera-wildfire-platform/
  backend/
    app/                 FastAPI app, schemas, analysis service
    processing/
      acquisition/       Planetary Computer, NISAR-ready event catalogue
      preprocessing/     grids, optical indices, radiometry, filters
      models/            patch datasets, LightGBM, U-Net, trainer
      change_detection/  log-ratio, Before/After area integration, and CUSUM
      validation/        segmentation & 500m block-reconciled metrics
    tests/               41 passing tests
  data/
    real/                acquired stacks, manifests, registry, dataset, prepared scenes
    mock/                historical synthetic fixtures (not used by real pipeline)
  docs/                  data sources, dataset card, preprocessing, models, experiments
  reports/               audit, research, real-data results, final completion report
  outputs/
    evaluation/          real_model_comparison.json, comprehensive_validation_report.json
    geospatial/          per-event GeoTIFFs, GeoJSON, before_after_overview.png
  scripts/               acquisition, dataset build, experiment runner, validation runner
```

## Documentation

- [Data sources](docs/DATA_SOURCES.md)
- [Dataset card](docs/DATASET_CARD.md)
- [Preprocessing](docs/PREPROCESSING.md)
- [Model cards](docs/MODEL_CARD.md)
- [Experiment log](docs/EXPERIMENTS.md)
- [Real-data results report](reports/REAL_DATA_RESULTS.md)
- [Project audit](reports/PHASE0_PROJECT_AUDIT.md)
- [Data research](reports/PHASE1_DATA_RESEARCH.md)

## Scientific principles

- Sentinel-1 results are never relabelled as NISAR results.
- Synthetic scenes are not mixed into real experiments.
- FIRMS active-fire detections are not burned-area ground truth.
- dNBR and MCD64A1 are references, not ground truth; their disagreement is reported.
- Missing metadata stays missing. It is not invented.
- Splits are by event before patch extraction.
- Normalization, thresholds, checkpoints, and hyperparameters are fitted on TRAIN/VAL only.
- The TEST event is not used for tuning.
- The 10,000-sample cap is a ceiling, not a target.

## NISAR path

The NISAR GCOV adapter and HDF5 reader remain first-class. Genuine NISAR training requires:

1. Earthdata Login credentials supplied through environment variables or `.netrc`.
2. GCOV search restricted to one frequency and consistent track/frame geometry.
3. Pre/post acquisitions bracketing the fire and avoiding the 2026-07-27 to 2026-08-10
   mission data gap.
4. Correct handling of GCOV covariance terms, `rtcGammaToSigmaFactor`, and the averaging
   `mask` dataset.
5. Re-running label calibration and all experiments with NISAR as the only input sensor.

See `docs/DATA_SOURCES.md` for details. No credentials are stored in this repository.
