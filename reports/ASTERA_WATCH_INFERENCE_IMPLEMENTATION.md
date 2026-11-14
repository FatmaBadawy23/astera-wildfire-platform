# Astera Watch — Upload, Before/After Co-Registration & Real Model Inference Implementation Report

**Generated:** `2026-11-14`
**Repository:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`
**Active Versioned Run:** `run_20261114_025000_phase_g`

---

## 1. Architecture Overview

The Astera Watch platform connects the React/TypeScript web frontend (`frontend/` and `Frontend_/`) to the FastAPI geospatial & ML backend (`backend/app/main.py`) with two core services for live user-uploaded satellite analysis:

1. **`UploadValidationService` ([`backend/app/services/upload_service.py`](../backend/app/services/upload_service.py))**
   - Inspects uploaded `.tif`/`.tiff` GeoTIFFs and `.npz` SAR stacks using `rasterio` and `numpy`.
   - Extracts CRS (`EPSG:32610` / `EPSG:32611`), affine geotransform, WGS84 bounding box (`bounds_wgs84`), grid dimensions (`width × height`), band count, polarizations (`VV`, `VH`), pixel resolution (`m`), NoData values, valid pixel percentage, and per-band radiometric statistics (`min`, `max`, `mean`, `std`).
   - Automatically detects linear SAR power vs. decibel (`dB`) scale (`_to_db_auto`) and renders a transparent-background RGBA preview PNG (`outputs/uploads/{upload_id}/preview.png`).
   - **Scientific Guardrail (`UNSUPPORTED_OPTICAL_RGB_FOR_SAR_MODEL`)**: Explicitly rejects uncalibrated 8-bit RGB display images (`.png`, `.jpg`, `.jpeg`) for SAR model inference with a detailed scientific explanation.
   - **Before vs. After Pair Validation & Co-Registration (`validate_and_align_pair`)**: Checks CRS match, WGS84 spatial overlap percentage ($\ge 25\%$ required), pixel dimensions, affine transform, resolution, and temporal ordering; automatically reprojects/co-registers mismatched grids onto the Pre-Fire reference UTM grid via `rasterio.warp.reproject(..., Resampling.bilinear)`.

2. **`InferenceService` ([`backend/app/services/inference_service.py`](../backend/app/services/inference_service.py))**
   - **Model 1 — `UNet_ResNet34` (`unet`)**: Loads `outputs/runs/run_20261114_025000_phase_g/checkpoints/real_unet_resnet34_phase_g.pt` (`349,206,898` bytes, SHA-256 `025f136b09a584c6ba3657198b9e50c6b53b1058b081c1dac8d1a0a685e863bc`), constructs the 5-channel SAR dB stack `["vv_pre_db", "vh_pre_db", "vv_post_db", "vh_post_db", "delta_vh_db"]`, normalizes with the `TRAIN` (`CA_GANN_2026`) valid-land statistics, executes overlapping sliding-window PyTorch inference (`tile=128`, `stride=64`), and applies the VAL-calibrated probability threshold (`0.66`).
   - **Model 2 — `LightGBM_Pixel_Spatial` (`lightgbm`)**: Loads `outputs/runs/run_20261114_025000_phase_g/checkpoints/lightgbm_phase_g.pkl` (`16,758` bytes, SHA-256 `ef3099395e2918c3daa8f5f134d832fe63ba4749c51f061dc2f55b9dadb837e1`), extracts the exact 10 per-pixel and $5\times 5$ spatial texture features (`["vv_pre_db", "vh_pre_db", "vv_post_db", "vh_post_db", "delta_vv_db", "delta_vh_db", "delta_diff_db", "local_mean_delta_vh", "local_std_delta_vh", "post_vv_minus_vh_db"]`), runs `predict_spatial`, and applies the VAL-calibrated probability threshold (`0.17`).
   - **Model 3 — `Log_Ratio_Baseline` (`log_ratio`)**: Computes physical cross-pol radar backscatter change $\Delta\text{VH} = \text{VH}_{\text{post, dB}} - \text{VH}_{\text{pre, dB}}$ and applies the `TRAIN` F1-calibrated threshold (`-1.20 dB`).
   - **Model 4 — `CUSUM_Temporal` (`cusum`)**: Executes sequential multi-temporal cumulative sum change detection (`CUSUMDetector(k_allowance=0.5, h_decision=3.5)`) across $\ge 3$ co-registered temporal VH scenes.
   - **Exported Geospatial Artifacts (`outputs/analysis_runs/{analysis_id}/`)**:
     - Single-band float32 GeoTIFFs (`pre_fire_vh_db.tif`, `post_fire_vh_db.tif`, `delta_vh_db.tif`, `burn_probability.tif`, `predicted_burn_mask.tif`)
     - Web-ready RGBA PNG overlays (`pre_fire_vh_db.png`, `post_fire_vh_db.png`, `delta_vh_db.png`, `burn_probability.png`, `predicted_burn_mask.png`, `difference_heatmap.png`)
     - 6-panel scientific overview figure (`overview.png`)
     - Vectorized WGS84 (`EPSG:4326`) burned candidate polygons (`burned_polygons.geojson`)
     - Complete quantitative result manifest (`result.json`) with CRS-aware area statistics (`km²`, `ha`, `m²`, `acres`) and pre/post radiometric change statistics.
