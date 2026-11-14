import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UploadAndAnalyzeView } from "./UploadAndAnalyzeView";
import { api } from "../api";

vi.mock("../api", () => ({
  resolveApiAssetUrl: (p: string) => p,
  api: {
    getAvailableModels: vi.fn(),
    uploadFile: vi.fn(),
    uploadSample: vi.fn(),
    validatePair: vi.fn(),
    runLiveAnalysis: vi.fn(),
  },
}));

const mockModelsResponse = {
  active_run_id: "run_20261114_025000_phase_g",
  data_origin: "CROSS_SENSOR_PROTOTYPE",
  is_nisar: false,
  sample_uploads: [
    {
      sample_id: "CA_BUG_2026_DUALPOL",
      title: "CA_BUG_2026 Dual-Pol",
      event_id: "CA_BUG_2026",
      sensor: "Sentinel-1 C-band RTC (20 m)",
      bands: ["VV_dB", "VH_dB"],
      compatible_models: ["unet", "lightgbm", "log_ratio"],
      pre_file: "outputs/sample_uploads/CA_BUG_2026_sentinel1_pre_dualpol_vv_vh_db.tif",
      post_file: "outputs/sample_uploads/CA_BUG_2026_sentinel1_post_dualpol_vv_vh_db.tif",
      pre_date: "2024-07-12",
      post_date: "2024-08-05",
    },
  ],
  models: [
    {
      model_id: "unet",
      registry_key: "UNet_ResNet34",
      name: "U-Net ResNet-34 (5-Channel SAR Segmentation)",
      family: "Deep Convolutional Encoder-Decoder",
      version: "2.1.0-phase-g",
      status: "READY",
      is_primary: true,
      checkpoint_path: "outputs/runs/run_20261114_025000_phase_g/checkpoints/real_unet_resnet34_phase_g.pt",
      checkpoint_size_bytes: 349206898,
      checkpoint_sha256: "025f136b09a584c6",
      loss_function: "MaskedBCEDiceLoss",
      default_threshold: 0.66,
      input_contract: {
        type: "5-channel co-registered SAR dB tensor",
        channels: ["vv_pre_db", "vh_pre_db", "vv_post_db", "vh_post_db", "delta_vh_db"],
        requires_dual_pol: true,
      },
      benchmark_test_metrics: {},
      limitations: [],
    },
  ],
};

const mockPreUpload = {
  upload_id: "upl_pre_001",
  filename: "CA_BUG_2026_pre.tif",
  role: "pre_fire",
  file_format: "GEOTIFF",
  file_size_bytes: 3227556,
  sha256: "abc123",
  created_at_utc: "2026-11-14T00:00:00Z",
  is_valid: true,
  valid_for_sar_inference: true,
  validation_status: "VALID_GEOTIFF",
  error_code: null,
  scientific_explanation: "Georeferenced GeoTIFF (800x800 px, 2 bands, CRS=EPSG:32611).",
  crs: "EPSG:32611",
  bounds: [0, 0, 16000, 16000],
  bounds_wgs84: [-119.98, 39.75, -119.79, 39.9],
  width: 800,
  height: 800,
  band_count: 2,
  bands: ["VV_dB", "VH_dB"],
  polarizations: ["VV", "VH"],
  resolution_m: 20,
  nodata: -9999,
  valid_pixel_percentage: 72.79,
  compatible_models: ["unet", "lightgbm", "log_ratio"],
  warnings: [],
  preview_url: "/api/analysis/uploads/upl_pre_001/preview.png",
};

const mockPostUpload = {
  ...mockPreUpload,
  upload_id: "upl_post_002",
  filename: "CA_BUG_2026_post.tif",
  role: "post_fire",
  preview_url: "/api/analysis/uploads/upl_post_002/preview.png",
};

const mockPairValidation = {
  pair_id: "pair_12345",
  pre_upload_id: "upl_pre_001",
  post_upload_id: "upl_post_002",
  compatible: true,
  status: "SUITABLE",
  checks: {
    crs_match: true,
    pre_crs: "EPSG:32611",
    post_crs: "EPSG:32611",
    spatial_overlap_percent: 100,
    dimensions_match: true,
    transform_match: true,
    resolution_match: true,
    date_order_valid: true,
    co_registered: false,
    dual_polarization_available: true,
  },
  compatible_models: ["unet", "lightgbm", "log_ratio", "cusum"],
  reasons: [],
  warnings: [],
};

const mockLiveResult = {
  analysis_id: "ana_test01",
  job_id: "ana_test01",
  status: "COMPLETED",
  created_at_utc: "2026-11-14T00:01:00Z",
  execution_time_sec: 1.84,
  source_type: "uploaded_pair",
  source_label: "Uploaded Pair (CA_BUG_2026_pre.tif vs CA_BUG_2026_post.tif)",
  event_id: "CA_BUG_2026",
  upload_id: "upl_pre_001",
  pair_id: "pair_12345",
  model_type: "unet",
  model_name: "UNet_ResNet34",
  threshold_used: 0.66,
  data_origin: "CROSS_SENSOR_PROTOTYPE",
  is_nisar: false,
  spatial_metadata: {
    crs: "EPSG:32611",
    width: 800,
    height: 800,
    resolution_m: 20,
    pixel_area_m2: 400,
    bounds_wgs84: [-119.98, 39.75, -119.79, 39.9],
    pre_date: "2024-07-12",
    post_date: "2024-08-05",
  },
  area_statistics: {
    total_grid_pixels: 640000,
    valid_land_pixels: 465828,
    burned_pixels: 324830,
    unburned_pixels: 140998,
    burned_percentage_of_valid: 69.73,
    total_valid_area_km2: 186.33,
    burned_area_m2: 129932000,
    burned_area_ha: 12993.2,
    burned_area_km2: 129.93,
    burned_area_acres: 32106.9,
    dnbr_reference_area_km2: 93.43,
    mcd64a1_reference_area_km2: 138.99,
  },
  before_after_radiometry: {
    mean_pre_vh_db: -19.45,
    std_pre_vh_db: 2.1,
    mean_post_vh_db: -21.43,
    std_post_vh_db: 2.4,
    mean_delta_vh_db: -1.98,
    std_delta_vh_db: 2.43,
    mean_delta_vh_burned_db: -2.61,
    mean_delta_vh_unburned_db: -0.52,
    separability_burned_minus_unburned_db: -2.09,
    max_backscatter_drop_db: -9.8,
    mean_burn_probability: 0.72,
    p95_burn_probability: 0.94,
  },
  metrics: {
    true_positives: 224788,
    false_positives: 100042,
    false_negatives: 8782,
    true_negatives: 132216,
    total_pixels: 465828,
    prevalence: 0.5014,
    precision: 0.692,
    recall: 0.9624,
    f1_score: 0.8051,
    iou: 0.6738,
    dice: 0.8051,
    specificity: 0.5693,
    predicted_area_km2: 129.93,
    reference_area_km2: 93.43,
    area_error_percent: 39.07,
  },
  model_comparison: {
    unet: {
      model_id: "unet",
      registry_name: "UNet_ResNet34",
      threshold: 0.66,
      checkpoint_path: "outputs/runs/run_20261114_025000_phase_g/checkpoints/real_unet_resnet34_phase_g.pt",
      checkpoint_sha256: "025f",
      execution_time_sec: 1.4,
      burned_pixels: 324830,
      burned_area_km2: 129.93,
      burned_area_ha: 12993.2,
      burned_percentage: 69.73,
      mean_probability: 0.72,
    },
    lightgbm: {
      model_id: "lightgbm",
      registry_name: "LightGBM_Pixel_Spatial",
      threshold: 0.17,
      checkpoint_path: "outputs/runs/run_20261114_025000_phase_g/checkpoints/lightgbm_phase_g.pkl",
      checkpoint_sha256: "ef30",
      execution_time_sec: 0.2,
      burned_pixels: 254100,
      burned_area_km2: 101.64,
      burned_area_ha: 10164.0,
      burned_percentage: 54.55,
      mean_probability: 0.52,
    },
  },
  layers: {
    pre_fire_vh_db: "/api/analysis/results/ana_test01/layers/pre_fire_vh_db.png",
    post_fire_vh_db: "/api/analysis/results/ana_test01/layers/post_fire_vh_db.png",
    delta_vh_db: "/api/analysis/results/ana_test01/layers/delta_vh_db.png",
    burn_probability: "/api/analysis/results/ana_test01/layers/burn_probability.png",
    predicted_burn_mask: "/api/analysis/results/ana_test01/layers/predicted_burn_mask.png",
    difference_heatmap: "/api/analysis/results/ana_test01/layers/difference_heatmap.png",
    overview_png: "/api/analysis/results/ana_test01/layers/overview.png",
  },
  downloads: {
    pre_fire_vh_db_tif: "/api/analysis/results/ana_test01/geotiff/pre_fire_vh_db.tif",
    post_fire_vh_db_tif: "/api/analysis/results/ana_test01/geotiff/post_fire_vh_db.tif",
    delta_vh_db_tif: "/api/analysis/results/ana_test01/geotiff/delta_vh_db.tif",
    burn_probability_tif: "/api/analysis/results/ana_test01/geotiff/burn_probability.tif",
    predicted_burn_mask_tif: "/api/analysis/results/ana_test01/geotiff/predicted_burn_mask.tif",
    burned_polygons_geojson: "/api/analysis/results/ana_test01/geojson/burned_polygons.geojson",
    metadata_json: "/api/analysis/results/ana_test01",
  },
  burned_polygons_feature_count: 148,
  summary: "UNet_ResNet34 inference completed in 1.84s. Estimated burned candidate area: 129.93 km².",
  provenance: {},
  caveats: [],
};

describe("UploadAndAnalyzeView integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getAvailableModels).mockResolvedValue(mockModelsResponse);
    vi.mocked(api.uploadSample)
      .mockResolvedValueOnce(mockPreUpload)
      .mockResolvedValueOnce(mockPostUpload);
    vi.mocked(api.validatePair).mockResolvedValue(mockPairValidation);
    vi.mocked(api.runLiveAnalysis).mockResolvedValue(mockLiveResult);
  });

  it("loads sample Pre/Post pair, validates compatibility, and executes real multi-model inference", async () => {
    render(<UploadAndAnalyzeView />);

    await waitFor(() => {
      expect(screen.getAllByText(/UNet_ResNet34/i).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByTestId("load-sample-dualpol-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("pair-validation-summary")).toHaveTextContent(/pair_12345/i);
    });

    fireEvent.click(screen.getByTestId("run-live-inference-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("live-analysis-results")).toHaveTextContent(/129\.93 km²/i);
    });

    const resultsPanel = screen.getByTestId("live-analysis-results");
    expect(resultsPanel).toHaveTextContent(/LightGBM_Pixel_Spatial/i);
    expect(resultsPanel).toHaveTextContent(/101\.64 km²/i);
    expect(resultsPanel).toHaveTextContent(/148/i);
  });
});
