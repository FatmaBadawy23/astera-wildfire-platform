import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { App } from "./App";
import { api } from "./api";

vi.mock("./api", () => ({
  resolveApiAssetUrl: (p: string) => p,
  api: {
    getHealth: vi.fn(),
    getLatestRun: vi.fn(),
    getEvents: vi.fn(),
    getModelComparison: vi.fn(),
    getDatasetStats: vi.fn(),
    getNisarStatus: vi.fn(),
    getEventAnalysis: vi.fn(),
    getEventGeoJSON: vi.fn(),
  },
}));

const mockHealth = {
  status: "ONLINE",
  version: "2.1.0-phase-g",
  environment: "production-verified",
  geospatial_ready: true,
  ml_ready: true,
  active_run_id: "run_20261114_025000_phase_g",
  dataset_ready: true,
  checkpoints_ready: true,
  is_nisar: false,
  data_origin: "CROSS_SENSOR_PROTOTYPE",
};

const mockLatestRun = {
  available: true,
  run_id: "run_20261114_025000_phase_g",
  previous_baseline_run_id: "run_20261114_013500",
  generated_at_utc: "2026-11-14T01:00:39Z",
  dataset_version: "run_20261114_025000_phase_g",
  model_version: "phase_g_run_20261114_025000_phase_g",
  training_status: "COMPLETED",
  evaluation_status: "VERIFIED",
  data_origin: "CROSS_SENSOR_PROTOTYPE",
  is_nisar: false,
  sensor_provenance: {
    sar_input: "Sentinel-1 RTC C-band (VV/VH), 20 m",
    primary_optical_reference: "Sentinel-2 L2A dNBR >= 0.11",
    independent_thermal_reference: "NASA MODIS MCD64A1.061",
    active_fire_detections: "NASA FIRMS VIIRS_SNPP_NRT",
    nisar_l_band_pixels_used: 0,
  },
  dataset_counts: {
    patches_per_split: { TRAIN: 121, VAL: 121, TEST: 94 },
    total_patches: 336,
    patch_size: 128,
    stride: 64,
  },
  event_splits: { TRAIN: ["CA_GANN_2026"], VAL: ["CA_DOME_2026"], TEST: ["CA_BUG_2026"] },
  excluded_events: ["CA_TIMBER_2026"],
  water_exclusion_audit: {},
  water_exclusion_status: "VERIFIED_ZERO_WATER_PIXELS_IN_VALID_MASK",
  checkpoint_metadata: {
    unet: {
      architecture: "UNetResNet34",
      loss_function: "MaskedBCEDiceLoss(bce_weight=0.5, smooth=1.0)",
      masked_loss_used: true,
      best_epoch: 4,
      best_val_iou: 0.1876,
      selected_probability_threshold: 0.66,
      checkpoint_path: "outputs/runs/run_20261114_025000_phase_g/checkpoints/real_unet_resnet34_phase_g.pt",
      checkpoint_bytes: 349206898,
      checkpoint_sha256: "025f136b09a584c6ba3657198b9e50c6b53b1058b081c1dac8d1a0a685e863bc",
    },
    lightgbm: {
      config_id: "D_unweighted_shallow_auc_es",
      best_iteration: 6,
      total_splits: 80,
      selected_probability_threshold: 0.17,
      checkpoint_path: "outputs/runs/run_20261114_025000_phase_g/checkpoints/lightgbm_phase_g.pkl",
      checkpoint_bytes: 16758,
      checkpoint_sha256: "ef3099395e2918c3daa8f5f134d832fe63ba4749c51f061dc2f55b9dadb837e1",
    },
  },
  output_availability: {
    geospatial_events_ready: ["CA_GANN_2026", "CA_DOME_2026", "CA_BUG_2026", "CA_TIMBER_2026"],
    all_rasters_valid_and_aligned: true,
  },
  scientific_limitations: [
    "Only one wildfire event (CA_GANN_2026) contributed to supervised model training.",
    "Zero NISAR L-band pixels were used; all SAR model inputs are Sentinel-1A C-band.",
  ],
  firms_egypt_smoke_test: { row_count: 106 },
};

const mockEvents = [
  {
    event_id: "CA_BUG_2026",
    fire_name: "Bug Fire",
    country: "USA",
    state_region: "California",
    center_lat: 39.83,
    center_lon: -119.88,
    fire_start_date: "2026-08-08",
    acres_burned: 9300,
    primary_vegetation: "Forest",
    sar_pre_date: "2026-08-03",
    sar_post_date: "2026-09-08",
    split_assignment: "TEST",
    data_origin: "CROSS_SENSOR_PROTOTYPE",
    is_nisar: false,
    include_in_training: true,
    firms_hotspot_count: 1676,
    predicted_burned_area_km2: 129.932,
    dnbr_reference_area_km2: 93.428,
    mcd64a1_reference_area_km2: 138.994,
    valid_land_pixels: 465828,
    water_pixels_excluded: 16,
  },
  {
    event_id: "CA_TIMBER_2026",
    fire_name: "Timber Fire",
    country: "USA",
    state_region: "Monterey County, California",
    center_lat: 36.15,
    center_lon: -121.66,
    fire_start_date: "2026-08-19",
    acres_burned: 8425,
    primary_vegetation: "Coastal",
    sar_pre_date: "2026-07-04",
    sar_post_date: "2026-09-02",
    split_assignment: "VAL",
    data_origin: "CROSS_SENSOR_PROTOTYPE",
    is_nisar: false,
    include_in_training: false,
    exclusion_reason: "C-band VH backscatter change is physically inverted.",
    firms_hotspot_count: 726,
    predicted_burned_area_km2: 85.1,
    dnbr_reference_area_km2: 49.86,
    mcd64a1_reference_area_km2: 83.75,
    valid_land_pixels: 506053,
    water_pixels_excluded: 110276,
  },
];

const sampleMetrics = (f1: number, refArea: number) => ({
  true_positives: 224788,
  false_positives: 100042,
  false_negatives: 8782,
  true_negatives: 132216,
  total_pixels: 465828,
  prevalence: 0.5014,
  precision: 0.692,
  recall: 0.9624,
  f1_score: f1,
  iou: 0.6738,
  dice: f1,
  specificity: 0.5693,
  predicted_area_km2: 129.932,
  reference_area_km2: refArea,
  area_error_percent: 39.07,
  f1_ci95_block_bootstrap: [0.772, 0.8301] as [number, number],
  roc_auc: 0.8756,
  pr_auc: 0.8505,
});

const mockComparison = {
  created_at_utc: "2026-11-14T00:59:37Z",
  run_id: "run_20261114_025000_phase_g",
  data_origin: "CROSS_SENSOR_PROTOTYPE",
  is_nisar: false,
  sensor_input: "Sentinel-1 RTC C-band",
  splits: { TRAIN: ["CA_GANN_2026"], VAL: ["CA_DOME_2026"], TEST: ["CA_BUG_2026"] },
  reference_labels: {
    definition: "Sentinel-2 dNBR >= 0.11",
    threshold: 0.11,
    threshold_usgs_moderate: 0.27,
    independent_check: "MODIS MCD64A1.061",
  },
  training: {
    seed: 42,
    lightgbm: {
      config_id: "D_unweighted_shallow_auc_es",
      training_time_sec: 0.84,
      training_pixels: 150212,
      validation_pixels: 152044,
      best_iteration: 6,
      total_splits: 80,
      scale_pos_weight: 1.0,
      eval_metric: "auc",
      selected_probability_threshold: 0.17,
      checkpoint_path: "outputs/runs/run_20261114_025000_phase_g/checkpoints/lightgbm_phase_g.pkl",
      checkpoint_bytes: 16758,
      checkpoint_sha256: "ef3099395e2918c3daa8f5f134d832fe63ba4749c51f061dc2f55b9dadb837e1",
      top_features: [["local_mean_delta_vh", 28]] as [string, number][],
    },
    unet: {
      architecture: "UNetResNet34",
      in_channels: 5,
      channels: ["vv_pre_db", "vh_pre_db", "vv_post_db", "vh_post_db", "delta_vh_db"],
      loss_function: "MaskedBCEDiceLoss(bce_weight=0.5, smooth=1.0)",
      masked_loss_used: true,
      epochs_trained: 6,
      best_epoch: 4,
      best_val_iou: 0.1876,
      best_val_dice: 0.3159,
      train_losses: [0.72, 0.54],
      val_losses: [0.84, 0.75],
      val_ious: [0.08, 0.1876],
      training_time_sec: 137.5,
      checkpoint_path: "outputs/runs/run_20261114_025000_phase_g/checkpoints/real_unet_resnet34_phase_g.pt",
      checkpoint_bytes: 349206898,
      checkpoint_sha256: "025f136b09a584c6ba3657198b9e50c6b53b1058b081c1dac8d1a0a685e863bc",
      selected_probability_threshold: 0.66,
    },
    cusum: { selected_h: 3.5, k_allowance: 0.5 },
    log_ratio: { threshold_db: -1.2 },
  },
  models: {},
  leaderboards: {
    vs_sentinel2_dnbr_20m: {
      UNet_ResNet34: {
        description: "U-Net ResNet-34 with MaskedBCEDiceLoss",
        role: "candidate",
        category: "deep_learning",
        reference_product: "Sentinel-2 L2A dNBR >= 0.11 (20 m)",
        threshold_used: 0.66,
        independent_of_label: true,
        metrics: {
          TRAIN: sampleMetrics(0.8575, 36.303),
          VAL: sampleMetrics(0.3388, 16.971),
          TEST: sampleMetrics(0.8051, 93.428),
        },
      },
    },
    vs_nasa_mcd64a1_20m: {
      UNet_ResNet34: {
        description: "U-Net ResNet-34 with MaskedBCEDiceLoss",
        role: "candidate",
        category: "deep_learning",
        reference_product: "NASA MODIS MCD64A1.061 QA-Filtered (20 m)",
        threshold_used: 0.66,
        independent_of_label: true,
        metrics: {
          TRAIN: sampleMetrics(0.8758, 36.057),
          VAL: sampleMetrics(0.3079, 13.857),
          TEST: sampleMetrics(0.9088, 138.994),
        },
      },
    },
    vs_nasa_mcd64a1_500m_blocks: {},
  },
};

const mockDatasetStats = {
  dataset_version: "run_20261114_025000_phase_g",
  created_at_utc: "2026-11-14T00:56:27Z",
  data_origin: "CROSS_SENSOR_PROTOTYPE",
  is_nisar: false,
  events_summary: {
    total_catalog_events: 4,
    supervised_pipeline_events: 3,
    excluded_events: 1,
    splits: { TRAIN: ["CA_GANN_2026"], VAL: ["CA_DOME_2026"], TEST: ["CA_BUG_2026"] },
    excluded_event_ids: ["CA_TIMBER_2026"],
  },
  acquisitions_summary: {
    total_raster_files_on_disk: 100,
    supervised_raster_files_used: 75,
    per_event_acquisitions: {
      sentinel1_rtc_scenes: 4,
      sentinel1_bands_per_scene: 2,
      sentinel2_l2a_scenes: 2,
      sentinel2_bands_per_scene: 6,
      modis_mcd64a1_windows: 1,
      modis_layers_per_event: 5,
    },
    date_range_overall: ["2026-07-04", "2026-10-19"] as [string, string],
  },
  patch_configuration: {
    patch_size: 128,
    stride: 64,
    overlap_factor_interior_pixels: 4.0,
    unet_in_channels: 5,
    unet_channel_names: ["vv_pre_db", "vh_pre_db", "vv_post_db", "vh_post_db", "delta_vh_db"],
    lightgbm_feature_count: 10,
    lightgbm_feature_names: [],
    patches_per_split: { TRAIN: 121, VAL: 121, TEST: 94 },
    total_patches: 336,
    normalization: {
      mean: [-10.1, -16.6, -10.15, -16.86, -0.25],
      std: [2.81, 3.55, 2.81, 3.5, 2.09],
      fitted_on: "TRAIN (valid_mask > 0 land pixels only)",
    },
  },
  pixel_accounting: {
    explanation: "Unique scene pixels vs overlapping patch pixels.",
    unique_scene_pixels_supervised_3_events: {
      total_scene_pixels: 1920000,
      valid_land_pixels: 1674809,
      water_pixels_excluded_scl6: 27939,
      other_invalid_pixels: 217252,
      burned_dnbr_pixels: 366756,
      unburned_dnbr_pixels: 1308053,
      burned_mcd64a1_pixels: 472270,
      lightgbm_subsampled_train_pixels: 150212,
      lightgbm_subsampled_val_pixels: 152044,
    },
    overlapping_patch_pixels_336_patches: {
      total_nominal_patch_pixels: 5505024,
      valid_land_patch_pixels: 5158361,
      invalid_or_water_masked_patch_pixels: 346663,
      burned_valid_patch_pixels: 1305843,
      unburned_valid_patch_pixels: 3852518,
      by_split: {},
    },
    per_event: {},
  },
  data_provenance: {
    newly_acquired_live_network_data: { firms: "106 rows" },
    cached_real_satellite_rasters: { s1: "32 files" },
    derived_versioned_dataset_arrays: { npz: 3 },
  },
  sensors: [],
};

const mockNisarStatus = {
  metadata_discovered: true,
  authentication_required: true,
  download_blocked: true,
  nisar_granules_downloaded: false,
  nisar_processed: false,
  nisar_used_in_model_training: false,
  nisar_pixels_used: 0,
  current_sar_model_input: "Sentinel-1 C-band",
  current_sar_sensor_detail: "Sentinel-1A/C/D C-band RTC at 20 m",
  validated_collection_concept_id: "C3622241360-ASF",
  provisional_collection_concept_id: "C2854338529-ASF",
  total_validated_granules_discovered: 28,
  matched_same_geometry_pairs_count: 15,
  http_status_on_unauthenticated_download: 401,
  blocking_reason: "Earthdata OAuth2 + ASF EULA required",
  events: {},
};

const mockEventAnalysis = {
  event_id: "CA_BUG_2026",
  run_id: "run_20261114_025000_phase_g",
  fire_name: "Bug Fire",
  state_region: "California",
  split: "TEST",
  include_in_training: true,
  is_nisar: false,
  data_origin: "CROSS_SENSOR_PROTOTYPE",
  bounds_wgs84: [-119.98, 39.75, -119.79, 39.9] as [number, number, number, number],
  center_lat: 39.83,
  center_lon: -119.88,
  reported_acres: 9300,
  water_pixels_excluded_scl6: 16,
  water_pixels_remaining_in_valid: 0,
  before_after_verification: {
    temporal_verification: {
      reported_ignition_date: "2026-08-08",
      s1_pre_dates: ["2026-08-03"],
      s1_post_dates: ["2026-08-27", "2026-09-08"],
      s2_pre_date: "2026-08-06",
      s2_post_date: "2026-08-30",
      pre_strictly_before_or_at_ignition: true,
      post_after_ignition: true,
    },
    spatial_grid_verification: {
      crs: "EPSG:32611",
      resolution_m: 20,
      dimensions_hw: [800, 800] as [number, number],
      bounds_utm: [0, 0, 1, 1] as [number, number, number, number],
      all_layers_co_registered: true,
    },
    geometry_and_polarization_verification: {
      sensor: "Sentinel-1 C-band RTC",
      polarizations_verified: ["VV", "VH"],
      pre_relative_orbits: ["64"],
      post_relative_orbits: ["64"],
      shared_orbit_geometry: true,
    },
  },
  sar_change_statistics: {
    vh_pre_mean_db: -19.45,
    vh_post_mean_db: -21.43,
    delta_vh_mean_db: -1.98,
    delta_vh_std_db: 2.43,
    delta_vh_p10_db: -5.16,
    delta_vh_p90_db: 1.08,
  },
  burn_probability_summary: {
    model: "unet",
    threshold: 0.66,
    mean_probability_valid: 0.72,
    median_probability_valid: 0.77,
    p90_probability_valid: 0.9,
    max_probability_valid: 0.99,
    min_probability_valid: 0.28,
  },
  primary_model: "unet",
  area_estimates: {
    primary_model_burned_area: {
      crs: "EPSG:32611",
      pixel_width_m: 20,
      pixel_height_m: 20,
      pixel_area_m2: 400,
      total_aoi_pixels: 640000,
      valid_observation_pixels: 465828,
      invalid_masked_pixels: 174172,
      valid_coverage_percent: 72.79,
      total_aoi_area_km2: 256,
      total_aoi_area_ha: 25600,
      valid_observation_area_km2: 186.33,
      valid_observation_area_ha: 18633,
      burned_pixels: 324830,
      burned_area_km2: 129.932,
      burned_area_ha: 12993.2,
      burned_percent_of_valid_area: 69.73,
      burned_percent_of_total_aoi: 50.75,
      burned_area_km2_ci95: [119.75, 140.02] as [number, number],
      threshold_sensitivity_km2_range: [116.5, 141.3] as [number, number],
    },
    by_model: {},
    sentinel2_dnbr_reference: {
      crs: "EPSG:32611",
      pixel_width_m: 20,
      pixel_height_m: 20,
      pixel_area_m2: 400,
      total_aoi_pixels: 640000,
      valid_observation_pixels: 465828,
      invalid_masked_pixels: 174172,
      valid_coverage_percent: 72.79,
      total_aoi_area_km2: 256,
      total_aoi_area_ha: 25600,
      valid_observation_area_km2: 186.33,
      valid_observation_area_ha: 18633,
      burned_pixels: 233570,
      burned_area_km2: 93.428,
      burned_area_ha: 9342.8,
      burned_percent_of_valid_area: 50.14,
      burned_percent_of_total_aoi: 36.5,
      burned_area_km2_ci95: [83.9, 102.8] as [number, number],
      threshold_sensitivity_km2_range: [72.1, 109.2] as [number, number],
    },
    sentinel2_dnbr_usgs_027_reference: {
      crs: "EPSG:32611",
      pixel_width_m: 20,
      pixel_height_m: 20,
      pixel_area_m2: 400,
      total_aoi_pixels: 640000,
      valid_observation_pixels: 465828,
      invalid_masked_pixels: 174172,
      valid_coverage_percent: 72.79,
      total_aoi_area_km2: 256,
      total_aoi_area_ha: 25600,
      valid_observation_area_km2: 186.33,
      valid_observation_area_ha: 18633,
      burned_pixels: 4781,
      burned_area_km2: 1.91,
      burned_area_ha: 191,
      burned_percent_of_valid_area: 1.03,
      burned_percent_of_total_aoi: 0.75,
      burned_area_km2_ci95: [1.5, 2.3] as [number, number],
      threshold_sensitivity_km2_range: [1.5, 2.3] as [number, number],
    },
    nasa_mcd64a1_reference: {
      crs: "EPSG:32611",
      pixel_width_m: 20,
      pixel_height_m: 20,
      pixel_area_m2: 400,
      total_aoi_pixels: 640000,
      valid_observation_pixels: 465828,
      invalid_masked_pixels: 174172,
      valid_coverage_percent: 72.79,
      total_aoi_area_km2: 256,
      total_aoi_area_ha: 25600,
      valid_observation_area_km2: 186.33,
      valid_observation_area_ha: 18633,
      burned_pixels: 347486,
      burned_area_km2: 138.994,
      burned_area_ha: 13899.4,
      burned_percent_of_valid_area: 74.6,
      burned_percent_of_total_aoi: 54.29,
      burned_area_km2_ci95: [128.0, 148.0] as [number, number],
      threshold_sensitivity_km2_range: [128.0, 148.0] as [number, number],
    },
  },
  firms_active_fire_summary: {
    total_hotspots: 1676,
    high_confidence_hotspots: 338,
    nominal_confidence_hotspots: 1193,
    low_confidence_hotspots: 145,
    first_detection_utc: "2026-08-09T03:43:00Z",
    last_detection_utc: "2026-08-19T23:10:00Z",
    max_frp_mw: 1187.2,
    mean_frp_mw: 36.58,
    scientific_disclaimer: "Hotspots are thermal points.",
  },
  independent_validation: { models: {} },
  raster_quality_audit: {
    event_id: "CA_BUG_2026",
    crs: "EPSG:32611",
    bounds_utm: [0, 0, 1, 1] as [number, number, number, number],
    water_pixels_in_valid_mask: 0,
    all_rasters_valid_and_aligned: true,
    layers: {},
  },
  web_overlay_urls: {},
  overview_figure_url: "/api/events/CA_BUG_2026/overview.png",
  geojson_url: "/api/events/CA_BUG_2026/geojson",
};

const mockGeoJSON = {
  event_id: "CA_BUG_2026",
  run_id: "run_20261114_025000_phase_g",
  bounds_wgs84: [-119.98, 39.75, -119.79, 39.9] as [number, number, number, number],
  aoi_boundary: { type: "FeatureCollection" as const, features: [] },
  firms_hotspots: { type: "FeatureCollection" as const, features: [] },
  firms_hotspot_count_in_aoi: 159,
  scientific_disclaimer: "FIRMS points.",
};

describe("Astera Watch Frontend Integration & Scientific Integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getHealth).mockResolvedValue(mockHealth);
    vi.mocked(api.getLatestRun).mockResolvedValue(mockLatestRun);
    vi.mocked(api.getEvents).mockResolvedValue(mockEvents);
    vi.mocked(api.getModelComparison).mockResolvedValue(mockComparison);
    vi.mocked(api.getDatasetStats).mockResolvedValue(mockDatasetStats);
    vi.mocked(api.getNisarStatus).mockResolvedValue(mockNisarStatus);
    vi.mocked(api.getEventAnalysis).mockResolvedValue(mockEventAnalysis);
    vi.mocked(api.getEventGeoJSON).mockResolvedValue(mockGeoJSON);
  });

  it("renders dashboard with verified run_id, separate dNBR/MCD64A1 KPIs, and events table", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText(/run_20261114_025000_phase_g/i).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/F1 = 0.8051/i)).toBeInTheDocument();
    expect(screen.getByText(/F1 = 0.9088/i)).toBeInTheDocument();
    expect(screen.getByText(/Bug Fire/i)).toBeInTheDocument();
    expect(screen.getByText(/Timber Fire/i)).toBeInTheDocument();
  });

  it("navigates across Model Performance, Dataset Explorer, and NISAR Status views", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Monitored 2026 California Wildfire Events Catalogue/i)).toBeInTheDocument();
    });

    // Switch to Model Performance
    fireEvent.click(screen.getByRole("button", { name: /Model Performance/i }));
    expect(screen.getByText(/Leaderboard 1 — Evaluated Against Sentinel-2 L2A dNBR/i)).toBeInTheDocument();
    expect(screen.getByText(/0.8051/i)).toBeInTheDocument();

    // Switch to Leaderboard 2 (MCD64A1)
    fireEvent.click(screen.getByRole("button", { name: /Leaderboard 2: vs NASA MODIS MCD64A1/i }));
    expect(screen.getByText(/0.9088/i)).toBeInTheDocument();

    // Switch to Dataset Explorer and verify unique vs overlapping pixel distinction
    fireEvent.click(screen.getByRole("button", { name: /Dataset Explorer/i }));
    expect(screen.getByText(/1,674,809/i)).toBeInTheDocument();
    expect(screen.getByText(/5,505,024/i)).toBeInTheDocument();

    // Switch to NISAR Status and verify truthful 0 pixels used
    fireEvent.click(screen.getByRole("button", { name: /NISAR Status/i }));
    expect(screen.getByText(/Truthful NISAR L2 GCOV Operational Status/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Sentinel-1 C-band/i).length).toBeGreaterThan(0);
  });

  it("handles API errors gracefully", async () => {
    vi.mocked(api.getHealth).mockRejectedValueOnce(new Error("Network offline"));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Network offline/i);
    });
  });
});
