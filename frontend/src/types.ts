export interface HealthResponse {
  status: string;
  version: string;
  environment: string;
  geospatial_ready: boolean;
  ml_ready: boolean;
  active_run_id?: string;
  dataset_ready: boolean;
  checkpoints_ready: boolean;
  is_nisar: boolean;
  data_origin: string;
  nisar_status?: {
    metadata_discovered: boolean;
    authentication_required: boolean;
    download_blocked: boolean;
    nisar_granules_downloaded: boolean;
    nisar_pixels_used: number;
    current_sar_model_input: string;
  };
}

export interface FireEvent {
  event_id: string;
  fire_name: string;
  country: string;
  state_region: string;
  center_lat: number;
  center_lon: number;
  fire_start_date: string;
  fire_containment_date?: string | null;
  acres_burned: number;
  primary_vegetation: string;
  sar_pre_date: string;
  sar_post_date: string;
  split_assignment: string;
  notes?: string;
  data_origin: string;
  is_nisar: boolean;
  sensor?: string;
  mcd_burn_doy_window?: string;
  include_in_training: boolean;
  exclusion_reason?: string | null;
  bounds_wgs84?: [number, number, number, number];
  crs?: string;
  firms_hotspot_count?: number;
  firms_max_frp_mw?: number;
  predicted_burned_area_km2?: number;
  dnbr_reference_area_km2?: number;
  mcd64a1_reference_area_km2?: number;
  s1_dates?: string[];
  s2_pre_date?: string;
  s2_post_date?: string;
  valid_land_pixels?: number;
  water_pixels_excluded?: number;
  run_id?: string;
}

export interface SegmentationMetrics {
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  true_negatives: number;
  total_pixels: number;
  prevalence: number;
  precision: number;
  recall: number;
  f1_score: number;
  iou: number;
  dice: number;
  specificity: number;
  false_positive_rate?: number;
  false_negative_rate?: number;
  predicted_area_km2: number;
  reference_area_km2: number;
  area_error_percent: number;
  valid_pixels?: number;
  f1_ci95_block_bootstrap?: [number, number];
  roc_auc?: number | null;
  pr_auc?: number | null;
  event_id?: string;
  note?: string;
}

export interface Block500mMetrics {
  block_resolution_m: number;
  block_size_px: number;
  valid_500m_blocks: number;
  fractional_burn_mae: number;
  fractional_burn_rmse: number;
  fractional_burn_pearson_r: number;
  block_classification_metrics: SegmentationMetrics;
  event_id?: string;
}

export interface ModelLeaderboardEntry<TMetrics = SegmentationMetrics> {
  description: string;
  role: string;
  category: string;
  reference_product: string;
  threshold_used: number;
  checkpoint_path?: string | null;
  independent_of_label: boolean;
  metrics: {
    TRAIN: TMetrics;
    VAL: TMetrics;
    TEST: TMetrics;
  };
}

export interface ModelComparisonResponse {
  created_at_utc: string;
  run_id: string;
  previous_baseline_run_id?: string;
  data_origin: string;
  is_nisar: boolean;
  sensor_input: string;
  splits: {
    TRAIN: string[];
    VAL: string[];
    TEST: string[];
  };
  excluded_events?: string[];
  scientific_limitations?: string[];
  reference_labels: {
    definition: string;
    threshold: number;
    threshold_usgs_moderate: number;
    independent_check: string;
    scientific_disclaimer?: string;
  };
  training: {
    seed: number;
    lightgbm: {
      config_id: string;
      training_time_sec: number;
      training_pixels: number;
      validation_pixels: number;
      best_iteration: number;
      total_splits: number;
      scale_pos_weight: number;
      eval_metric: string;
      selected_probability_threshold: number;
      checkpoint_path: string;
      checkpoint_bytes: number;
      checkpoint_sha256: string;
      top_features: [string, number][];
    };
    unet: {
      architecture: string;
      in_channels: number;
      channels: string[];
      loss_function: string;
      masked_loss_used: boolean;
      epochs_trained: number;
      best_epoch: number;
      best_val_iou: number;
      best_val_dice: number;
      train_losses: number[];
      val_losses: number[];
      val_ious: number[];
      training_time_sec: number;
      checkpoint_path: string;
      checkpoint_bytes: number;
      checkpoint_sha256: string;
      selected_probability_threshold: number;
    };
    cusum: {
      selected_h: number;
      k_allowance: number;
    };
    log_ratio: {
      threshold_db: number;
    };
  };
  models: Record<string, ModelLeaderboardEntry<SegmentationMetrics>>;
  leaderboards: {
    vs_sentinel2_dnbr_20m: Record<string, ModelLeaderboardEntry<SegmentationMetrics>>;
    vs_nasa_mcd64a1_20m: Record<string, ModelLeaderboardEntry<SegmentationMetrics>>;
    vs_nasa_mcd64a1_500m_blocks: Record<string, ModelLeaderboardEntry<Block500mMetrics>>;
  };
}

export interface LatestRunResponse {
  available: boolean;
  run_id: string;
  previous_baseline_run_id?: string;
  generated_at_utc: string;
  dataset_version: string;
  model_version: string;
  training_status: string;
  evaluation_status: string;
  data_origin: string;
  is_nisar: boolean;
  sensor_provenance: {
    sar_input: string;
    primary_optical_reference: string;
    independent_thermal_reference: string;
    active_fire_detections: string;
    nisar_l_band_pixels_used: number;
  };
  dataset_counts: {
    patches_per_split: Record<string, number>;
    total_patches: number;
    patch_size: number;
    stride: number;
  };
  event_splits: Record<string, string[]>;
  excluded_events: string[];
  water_exclusion_audit: Record<
    string,
    {
      total_pixels: number;
      scl6_water_pixels_detected: number;
      scl6_water_pixels_in_valid_mask: number;
      valid_land_pixels: number;
      valid_land_fraction: number;
    }
  >;
  water_exclusion_status: string;
  checkpoint_metadata: {
    unet: {
      architecture: string;
      loss_function: string;
      masked_loss_used: boolean;
      best_epoch: number;
      best_val_iou: number;
      selected_probability_threshold: number;
      checkpoint_path: string;
      checkpoint_bytes: number;
      checkpoint_sha256: string;
    };
    lightgbm: {
      config_id: string;
      best_iteration: number;
      total_splits: number;
      selected_probability_threshold: number;
      checkpoint_path: string;
      checkpoint_bytes: number;
      checkpoint_sha256: string;
    };
  };
  output_availability: {
    geospatial_events_ready: string[];
    all_rasters_valid_and_aligned: boolean;
  };
  scientific_limitations: string[];
  firms_egypt_smoke_test?: {
    row_count?: number;
    sensor?: string;
    http_status?: number;
  };
  eonet_wildfire_cross_check?: {
    open_wildfire_events_found?: number;
  };
}

export interface DatasetStatsResponse {
  dataset_version: string;
  created_at_utc: string;
  data_origin: string;
  is_nisar: boolean;
  events_summary: {
    total_catalog_events: number;
    supervised_pipeline_events: number;
    excluded_events: number;
    splits: Record<string, string[]>;
    excluded_event_ids: string[];
  };
  acquisitions_summary: {
    total_raster_files_on_disk: number;
    supervised_raster_files_used: number;
    per_event_acquisitions: {
      sentinel1_rtc_scenes: number;
      sentinel1_bands_per_scene: number;
      sentinel2_l2a_scenes: number;
      sentinel2_bands_per_scene: number;
      modis_mcd64a1_windows: number;
      modis_layers_per_event: number;
    };
    date_range_overall: [string, string];
  };
  patch_configuration: {
    patch_size: number;
    stride: number;
    overlap_factor_interior_pixels: number;
    unet_in_channels: number;
    unet_channel_names: string[];
    lightgbm_feature_count: number;
    lightgbm_feature_names: string[];
    patches_per_split: Record<string, number>;
    total_patches: number;
    normalization: {
      mean: number[];
      std: number[];
      fitted_on: string;
    };
  };
  pixel_accounting: {
    explanation: string;
    unique_scene_pixels_supervised_3_events: {
      total_scene_pixels: number;
      valid_land_pixels: number;
      water_pixels_excluded_scl6: number;
      other_invalid_pixels: number;
      burned_dnbr_pixels: number;
      unburned_dnbr_pixels: number;
      burned_mcd64a1_pixels: number;
      lightgbm_subsampled_train_pixels: number;
      lightgbm_subsampled_val_pixels: number;
    };
    overlapping_patch_pixels_336_patches: {
      total_nominal_patch_pixels: number;
      valid_land_patch_pixels: number;
      invalid_or_water_masked_patch_pixels: number;
      burned_valid_patch_pixels: number;
      unburned_valid_patch_pixels: number;
      by_split: Record<
        string,
        {
          path: string;
          bytes: number;
          sha256: string;
          samples: number;
          nominal_patch_pixels: number;
          valid_patch_pixels: number;
          invalid_patch_pixels: number;
          burned_valid_patch_pixels: number;
          unburned_valid_patch_pixels: number;
          positive_pixel_fraction_valid: number;
        }
      >;
    };
    per_event: Record<
      string,
      {
        event_id: string;
        fire_name: string;
        split: string;
        include_in_training: boolean;
        exclusion_reason?: string;
        grid_dimensions_hw: [number, number];
        resolution_m: number;
        unique_scene_pixels: number;
        valid_land_pixels: number;
        water_pixels_excluded_scl6: number;
        water_pixels_in_valid_mask: number;
        other_invalid_pixels: number;
        burned_dnbr_pixels: number;
        unburned_dnbr_pixels: number;
        burned_dnbr_prevalence: number;
        burned_mcd64a1_pixels: number;
        burned_mcd64a1_prevalence: number;
        s1_acquisitions_count: number;
        s1_date_range: [string, string];
        s2_pre_date: string;
        s2_post_date: string;
      }
    >;
  };
  data_provenance: {
    newly_acquired_live_network_data: Record<string, string>;
    cached_real_satellite_rasters: Record<string, string>;
    derived_versioned_dataset_arrays: Record<string, string | number>;
  };
  sensors: string[];
}

export interface RasterLayerAudit {
  file: string;
  exists: boolean;
  size_bytes: number;
  crs: string;
  transform: number[];
  dimensions_hw: [number, number];
  resolution_m: [number, number];
  dtype: string;
  nodata: number;
  min_valid_value: number;
  max_valid_value: number;
  aligned_to_event_grid: boolean;
}

export interface AreaEstimateItem {
  crs: string;
  pixel_width_m: number;
  pixel_height_m: number;
  pixel_area_m2: number;
  total_aoi_pixels: number;
  valid_observation_pixels: number;
  invalid_masked_pixels: number;
  valid_coverage_percent: number;
  total_aoi_area_km2: number;
  total_aoi_area_ha: number;
  valid_observation_area_km2: number;
  valid_observation_area_ha: number;
  burned_pixels: number;
  burned_area_km2: number;
  burned_area_ha: number;
  burned_percent_of_valid_area: number;
  burned_percent_of_total_aoi: number;
  burned_area_km2_ci95: [number, number];
  threshold_sensitivity_km2_range: [number, number];
}

export interface EventAnalysisResponse {
  event_id: string;
  run_id: string;
  fire_name: string;
  state_region: string;
  split: string;
  include_in_training: boolean;
  exclusion_reason?: string | null;
  is_nisar: boolean;
  data_origin: string;
  bounds_wgs84: [number, number, number, number];
  center_lat: number;
  center_lon: number;
  reported_acres: number;
  water_pixels_excluded_scl6: number;
  water_pixels_remaining_in_valid: number;
  before_after_verification: {
    temporal_verification: {
      reported_ignition_date: string;
      s1_pre_dates: string[];
      s1_post_dates: string[];
      s2_pre_date: string;
      s2_post_date: string;
      pre_strictly_before_or_at_ignition: boolean;
      post_after_ignition: boolean;
    };
    spatial_grid_verification: {
      crs: string;
      resolution_m: number;
      dimensions_hw: [number, number];
      bounds_utm: [number, number, number, number];
      all_layers_co_registered: boolean;
    };
    geometry_and_polarization_verification: {
      sensor: string;
      polarizations_verified: string[];
      pre_relative_orbits: string[];
      post_relative_orbits: string[];
      shared_orbit_geometry: boolean;
    };
  };
  sar_change_statistics: {
    vh_pre_mean_db: number;
    vh_post_mean_db: number;
    delta_vh_mean_db: number;
    delta_vh_std_db: number;
    delta_vh_p10_db: number;
    delta_vh_p90_db: number;
  };
  burn_probability_summary: {
    model: string;
    threshold: number;
    mean_probability_valid: number;
    median_probability_valid: number;
    p90_probability_valid: number;
    max_probability_valid: number;
    min_probability_valid: number;
  };
  primary_model: string;
  area_estimates: {
    primary_model_burned_area: AreaEstimateItem;
    by_model: Record<string, AreaEstimateItem>;
    sentinel2_dnbr_reference: AreaEstimateItem;
    sentinel2_dnbr_usgs_027_reference: AreaEstimateItem;
    nasa_mcd64a1_reference: AreaEstimateItem;
  };
  firms_active_fire_summary: {
    total_hotspots: number;
    high_confidence_hotspots: number;
    nominal_confidence_hotspots: number;
    low_confidence_hotspots: number;
    first_detection_utc: string;
    last_detection_utc: string;
    max_frp_mw: number;
    mean_frp_mw: number;
    scientific_disclaimer: string;
  };
  independent_validation: {
    models: Record<
      string,
      {
        vs_sentinel2_dnbr: SegmentationMetrics;
        vs_nasa_mcd64a1_qa_filtered: SegmentationMetrics;
        vs_nasa_mcd64a1_500m_block_reconciled: Block500mMetrics;
      }
    >;
  };
  raster_quality_audit: {
    event_id: string;
    crs: string;
    bounds_utm: [number, number, number, number];
    water_pixels_in_valid_mask: number;
    all_rasters_valid_and_aligned: boolean;
    layers: Record<string, RasterLayerAudit>;
  };
  web_overlay_urls: Record<string, string>;
  overview_figure_url: string;
  geojson_url: string;
}

export interface EventGeoJSONResponse {
  event_id: string;
  run_id: string;
  bounds_wgs84: [number, number, number, number];
  aoi_boundary: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: Record<string, unknown>;
      geometry: {
        type: "Polygon";
        coordinates: number[][][];
      };
    }>;
  };
  firms_hotspots: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: {
        acq_date?: string;
        acq_time?: string;
        frp?: number;
        confidence?: string;
        instrument?: string;
        satellite?: string;
      };
      geometry: {
        type: "Point";
        coordinates: [number, number];
      };
    }>;
  };
  firms_hotspot_count_in_aoi: number;
  scientific_disclaimer: string;
}

export interface NisarStatusResponse {
  metadata_discovered: boolean;
  authentication_required: boolean;
  download_blocked: boolean;
  nisar_granules_downloaded: boolean;
  nisar_processed: boolean;
  nisar_used_in_model_training: boolean;
  nisar_pixels_used: number;
  current_sar_model_input: string;
  current_sar_sensor_detail: string;
  validated_collection_concept_id: string;
  provisional_collection_concept_id: string;
  total_validated_granules_discovered: number;
  matched_same_geometry_pairs_count: number;
  http_status_on_unauthenticated_download: number;
  blocking_reason: string;
  events: Record<
    string,
    {
      event_id: string;
      fire_name: string;
      validated_granules_count: number;
      matched_pairs_count: number;
      pre_granule_ur?: string;
      post_granule_ur?: string;
      track_frame_pass?: string;
    }
  >;
}

export interface SampleUploadPair {
  sample_id: string;
  title: string;
  event_id: string;
  sensor: string;
  bands: string[];
  compatible_models: string[];
  pre_file: string;
  post_file: string;
  pre_date: string;
  post_date: string;
}

export interface AvailableModelDescriptor {
  model_id: string;
  registry_key: string;
  name: string;
  family: string;
  version: string;
  status: string;
  is_primary: boolean;
  checkpoint_path: string | null;
  checkpoint_size_bytes: number | null;
  checkpoint_sha256: string | null;
  loss_function: string;
  default_threshold: number;
  input_contract: {
    type: string;
    channels?: string[];
    features?: string[];
    requires_dual_pol: boolean;
    tile_size?: number;
    stride?: number;
    normalization_mean_db?: number[];
    normalization_std_db?: number[];
    min_temporal_scenes?: number;
  };
  benchmark_test_metrics: {
    vs_sentinel2_dnbr_20m?: SegmentationMetrics;
    vs_nasa_mcd64a1_20m?: SegmentationMetrics;
  };
  limitations: string[];
}

export interface AvailableModelsResponse {
  active_run_id: string;
  data_origin: string;
  is_nisar: boolean;
  models: AvailableModelDescriptor[];
  sample_uploads: SampleUploadPair[];
}

export interface UploadMetadataResponse {
  upload_id: string;
  filename: string;
  role: string;
  file_format: string;
  file_size_bytes: number;
  sha256: string;
  created_at_utc: string;
  is_valid: boolean;
  valid_for_sar_inference: boolean;
  validation_status: string;
  error_code: string | null;
  scientific_explanation: string;
  sensor?: string;
  acquisition_date?: string | null;
  matched_event_id?: string | null;
  crs: string | null;
  bounds: number[] | null;
  bounds_wgs84: number[] | null;
  width: number;
  height: number;
  band_count: number;
  bands: string[];
  polarizations: string[];
  radiometric_scale?: string;
  resolution_m: number | null;
  nodata: number | null;
  valid_pixel_percentage: number;
  band_statistics?: Array<{
    band_index?: number;
    band?: string;
    description?: string;
    dtype?: string;
    valid_pixels?: number;
    valid_percentage?: number;
    min?: number | null;
    max?: number | null;
    mean?: number | null;
    std?: number | null;
  }>;
  compatible_models: string[];
  warnings: string[];
  preview_url: string | null;
}

export interface ValidatePairResponse {
  pair_id: string;
  pre_upload_id: string;
  post_upload_id: string;
  pre_filename?: string;
  post_filename?: string;
  compatible: boolean;
  status: string;
  checks?: {
    crs_match: boolean;
    pre_crs: string | null;
    post_crs: string | null;
    spatial_overlap_percent: number;
    dimensions_match: boolean;
    transform_match: boolean;
    resolution_match: boolean;
    date_order_valid: boolean;
    co_registered: boolean;
    dual_polarization_available: boolean;
  };
  target_grid?: {
    crs: string | null;
    width: number;
    height: number;
    resolution_m: number | null;
    bounds: number[] | null;
    bounds_wgs84: number[] | null;
  };
  matched_event_id?: string | null;
  compatible_models: string[];
  reasons: string[];
  warnings: string[];
}

export interface LiveModelComparisonItem {
  model_id: string;
  registry_name: string;
  threshold: number;
  checkpoint_path: string | null;
  checkpoint_sha256: string | null;
  execution_time_sec: number;
  burned_pixels: number;
  burned_area_km2: number;
  burned_area_ha: number;
  burned_percentage: number;
  mean_probability: number;
  metrics_vs_sentinel2_dnbr?: SegmentationMetrics;
  metrics_vs_mcd64a1?: SegmentationMetrics;
}

export interface LiveAnalysisResultResponse {
  analysis_id: string;
  job_id: string;
  status: string;
  created_at_utc: string;
  execution_time_sec: number;
  source_type: string;
  source_label: string;
  event_id: string;
  upload_id: string | null;
  pair_id: string | null;
  model_type: string;
  model_name: string;
  threshold_used: number;
  data_origin: string;
  is_nisar: boolean;
  spatial_metadata: {
    crs: string;
    width: number;
    height: number;
    resolution_m: number;
    pixel_area_m2: number;
    bounds_wgs84: number[] | null;
    pre_date: string;
    post_date: string;
  };
  area_statistics: {
    total_grid_pixels: number;
    valid_land_pixels: number;
    burned_pixels: number;
    unburned_pixels: number;
    burned_percentage_of_valid: number;
    total_valid_area_km2: number;
    burned_area_m2: number;
    burned_area_ha: number;
    burned_area_km2: number;
    burned_area_acres: number;
    dnbr_reference_area_km2: number | null;
    mcd64a1_reference_area_km2: number | null;
  };
  before_after_radiometry: {
    mean_pre_vh_db: number;
    std_pre_vh_db: number;
    mean_post_vh_db: number;
    std_post_vh_db: number;
    mean_delta_vh_db: number;
    std_delta_vh_db: number;
    mean_delta_vh_burned_db: number;
    mean_delta_vh_unburned_db: number;
    separability_burned_minus_unburned_db: number;
    max_backscatter_drop_db: number;
    mean_burn_probability: number;
    p95_burn_probability: number;
  };
  metrics: SegmentationMetrics;
  model_comparison: Record<string, LiveModelComparisonItem>;
  layers: {
    pre_fire_vh_db: string;
    post_fire_vh_db: string;
    delta_vh_db: string;
    burn_probability: string;
    predicted_burn_mask: string;
    difference_heatmap: string;
    overview_png: string;
  };
  downloads: {
    pre_fire_vh_db_tif: string;
    post_fire_vh_db_tif: string;
    delta_vh_db_tif: string;
    burn_probability_tif: string;
    predicted_burn_mask_tif: string;
    burned_polygons_geojson: string;
    metadata_json: string;
  };
  burned_polygons_feature_count: number;
  summary: string;
  provenance: Record<string, unknown>;
  caveats: string[];
}
