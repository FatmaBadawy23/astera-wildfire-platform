# Astera Watch - Final Real-Data Deliverable Report

**Deliverable:** audited, real-data, reproducible wildfire change-detection prototype
**Date:** 2026-11-13
**Repository:** `astera-wildfire-platform`
**Branch:** `feature/sar-ml-pipeline` (working tree)
**Status:** complete for Sentinel-1 cross-sensor prototype; NISAR acquisition blocked by
missing Earthdata credentials

---

## 1. Deliverable summary

The platform was audited, corrected, and executed end to end with real open data:

| Deliverable | Status |
|---|---|
| Read-only project audit | Complete: `reports/PHASE0_PROJECT_AUDIT.md` |
| Data/source research | Complete: `reports/PHASE1_DATA_RESEARCH.md` |
| Real acquisition design | Complete: event catalogue, STAC/SAS client, local UTM grid |
| Environment preserved | Complete: no replacement of the Python environment |
| Real data acquisition | Complete: 4 events, 4 Sentinel-1 dates + 2 Sentinel-2 dates each |
| Preprocessing | Complete: 20 m grid, SCL masking, dNBR, MCD64A1 reprojection |
| Dataset | Complete: 336 event-grouped patches (121/121/94) |
| Classical baseline | Complete: TRAIN-calibrated VH log-ratio |
| LightGBM | Complete: trained on TRAIN, early-stopped on VAL |
| U-Net ResNet-34 | Complete: trained on CPU, separate real checkpoint |
| CUSUM | Complete: 4 real dates, h selected on VAL |
| Honest comparison | Complete: `outputs/evaluation/real_model_comparison.json` |
| App integration | Complete: API serves stored real metrics with provenance |
| Tests | Complete: 29 passed |
| Documentation | Complete: data sources, dataset card, preprocessing, model card, experiments |
| NISAR | Blocked: Earthdata Login credentials absent; no scene fabricated |

---

## 2. Audit corrections

The audit found that the prior scientific deliverables were based on synthetic scenes and
fabricated event metadata. The following corrections were made:

1. Old metrics were not reused or relabelled. They are marked **SUPERSEDED - SYNTHETIC
   DATA**.
2. The synthetic manifest remains for historical reproducibility but is not used by the
   real pipeline or the API.
3. Real events were verified and acquired from public catalogues.
4. The NISAR blocker was documented instead of being hidden behind mock HDF5 files.
5. The API no longer returns hard-coded F1 0.95 or fabricated confusion matrices.
6. The previous synthetic checkpoint was preserved; the real U-Net writes to a new file.

---

## 3. Real experiment

### 3.1 Data

- Sentinel-1 RTC: VV/VH, 20 m, four dates per event, same relative orbit/pass.
- Sentinel-2 L2A: B04/B08/B12/SCL, pre/post pairs, SCL-valid tile selection.
- MCD64A1: burn-date windows, independent coarse check.
- No NISAR, no FIRMS labels, no synthetic scenes.

### 3.2 Splits

- TRAIN: Gann Fire
- VAL: Dome Fire
- TEST: Bug Fire (held out, evaluated once)
- Excluded: Timber Fire (overlapping MCD complex and incoherent VH signal)

### 3.3 Controls

- Event split before patch extraction.
- 10,000 sample cap; 336 generated.
- TRAIN-only normalization.
- TRAIN-only dNBR threshold calibration.
- VAL-only LightGBM early stopping and probability threshold.
- VAL-only U-Net checkpoint and probability threshold.
- VAL-only CUSUM `h`.
- No test-driven tuning.

---

## 4. Results

### 4.1 Held-out TEST (Bug Fire)

| Analysis | F1 | 95% CI | Precision | Recall | IoU | Area error |
|---|---|---|---|---|---|---|
| U-Net ResNet-34 | **0.815** | 0.783-0.841 | 0.730 | 0.922 | 0.688 | +26.2% |
| CUSUM | 0.712 | 0.663-0.740 | 0.610 | 0.856 | 0.553 | +40.3% |
| Log-ratio | 0.696 | 0.650-0.724 | 0.633 | 0.774 | 0.534 | +22.2% |
| All-burned | 0.668 | 0.601-0.702 | 0.501 | 1.000 | 0.501 | +99.4% |
| LightGBM | 0.502 | 0.461-0.536 | 0.849 | 0.356 | 0.335 | -58.1% |

### 4.2 Validation (Dome Fire)

| Analysis | F1 | 95% CI | Precision | Recall |
|---|---|---|---|---|
| U-Net | 0.316 | 0.205-0.423 | 0.231 | 0.503 |
| LightGBM | 0.157 | 0.109-0.191 | 0.125 | 0.209 |
| Log-ratio | 0.133 | 0.086-0.163 | 0.080 | 0.396 |
| All-burned | 0.130 | 0.079-0.162 | 0.070 | 1.000 |

U-Net is the best candidate on the single held-out event. LightGBM does not transfer. The
all-burned baseline is high on TEST because the event is about 50% burned.

---

## 5. Scientific limitations

The deliverable is honest about what it does **not** establish:

- It is not a NISAR result.
- It has one event per split, so between-event variance is unknown.
- dNBR and MCD64A1 disagree strongly on the TEST event; labels are uncertain.
- The TEST event has a severe class-prior shift and a smaller valid domain because of the
  Sentinel-1 swath edge.
- Pixel metrics are spatially autocorrelated; block-bootstrap intervals help but do not
  create independent events.
- U-Net's TEST score may reflect the strong Bug scar rather than general robustness.
- No operational deployment claim is supported.

These limitations are documented in `docs/MODEL_CARD.md`,
`reports/REAL_DATA_RESULTS.md`, and the `caveats` array in the comparison JSON.

---

## 6. App integration

`backend/app/services/analysis_service.py` now:

- loads verified events from the real acquisition manifest and event catalogue;
- loads `outputs/evaluation/real_model_comparison.json`;
- returns stored metrics for the requested event/model;
- reports `data_origin = CROSS_SENSOR_PROTOTYPE` and `is_nisar = false`;
- includes the block-bootstrap F1 interval and provenance;
- returns an explicit error if the report is missing, instead of inventing values.

The API shape is preserved: `/api/events`, `/api/analysis/run`,
`/api/analysis/{job_id}/results`, `/api/models/comparison`, `/api/health`.

---

## 7. Verification

```text
python -m pytest -q
29 passed, 3 warnings
```

The test suite covers:

- NISAR GCOV adapter and mock compatibility;
- sample-limit enforcement;
- segmentation metrics;
- log-ratio and CUSUM detectors;
- U-Net architecture and loss;
- LightGBM training/inference;
- real-data helper functions;
- API contract for real events, stored metrics, provenance, and error handling.

The only warnings are third-party deprecations (Starlette multipart and `datetime.utcnow`
inside the pre-existing adapter).

---

## 8. Reproduction

```powershell
python scripts/acquire_real_data.py --event all
python scripts/build_real_dataset.py
python scripts/run_real_pipeline.py --epochs 8
python -m pytest -q
```

Environment: Python 3.13.7, rasterio 1.5.2/GDAL 3.12.2, torch 2.12.1+cpu, 8 CPU threads,
no CUDA. No new environment was created and no existing package was replaced.

---

## 9. Remaining work

1. Supply Earthdata Login credentials and acquire real NISAR GCOV.
2. Add multiple events per split and independent perimeter labels.
3. Re-run the full experiment with NISAR as the only input sensor.
4. Add leave-one-event-out validation and event-level uncertainty.
5. Add vegetation/severity stratification.
6. Consider longer U-Net training and pre-registered ablations, without test tuning.

The platform is NISAR-ready but not NISAR-validated. That distinction is the central
scientific result of this deliverable.
