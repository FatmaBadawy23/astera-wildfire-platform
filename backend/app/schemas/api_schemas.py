"""Pydantic Request and Response Schemas for Astera Watch API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    geospatial_ready: bool
    ml_ready: bool
    active_run_id: Optional[str] = None
    dataset_ready: bool = True
    checkpoints_ready: bool = True
    is_nisar: bool = False
    data_origin: str = "CROSS_SENSOR_PROTOTYPE"
    nisar_status: Optional[Dict[str, Any]] = None


class FireEventSchema(BaseModel):
    event_id: str
    fire_name: str
    country: str
    state_region: str
    center_lat: float
    center_lon: float
    fire_start_date: str
    fire_containment_date: Optional[str] = None
    acres_burned: int
    primary_vegetation: str
    sar_pre_date: str
    sar_post_date: str
    split_assignment: str
    notes: Optional[str] = None
    data_origin: str = "CROSS_SENSOR_PROTOTYPE"
    is_nisar: bool = False
    sensor: Optional[str] = None
    mcd_burn_doy_window: Optional[str] = None
    include_in_training: bool = True
    exclusion_reason: Optional[str] = None
    bounds_wgs84: Optional[List[float]] = None
    crs: Optional[str] = None
    firms_hotspot_count: Optional[int] = None
    firms_max_frp_mw: Optional[float] = None
    predicted_burned_area_km2: Optional[float] = None
    dnbr_reference_area_km2: Optional[float] = None
    mcd64a1_reference_area_km2: Optional[float] = None
    s1_dates: Optional[List[str]] = None
    s2_pre_date: Optional[str] = None
    s2_post_date: Optional[str] = None
    valid_land_pixels: Optional[int] = None
    water_pixels_excluded: Optional[int] = None
    run_id: Optional[str] = None


class AnalysisRunRequest(BaseModel):
    event_id: Optional[str] = Field(
        default=None,
        description="Catalog event ID (e.g., CA_BUG_2026, CA_DOME_2026, CA_GANN_2026)",
    )
    upload_id: Optional[str] = Field(
        default=None,
        description="Single uploaded multi-band GeoTIFF or NPZ upload ID",
    )
    pair_id: Optional[str] = Field(
        default=None,
        description="Validated Before/After pair ID from /api/analysis/validate-pair",
    )
    pre_upload_id: Optional[str] = Field(
        default=None,
        description="Pre-fire upload ID (automatically paired with post_upload_id if pair_id is omitted)",
    )
    post_upload_id: Optional[str] = Field(
        default=None,
        description="Post-fire upload ID (automatically paired with pre_upload_id if pair_id is omitted)",
    )
    model_type: str = Field(
        default="lightgbm",
        description="One of: 'log_ratio', 'lightgbm', 'unet', 'cusum', 'all_burned'",
    )
    polarization: str = Field(default="HV", description="'HH', 'HV', or 'DUAL'")
    threshold_db: Optional[float] = Field(default=None, description="Optional manual threshold in dB")
    threshold: Optional[float] = Field(default=None, description="Optional probability or dB threshold")
    run_all_models: bool = Field(
        default=True,
        description="Whether to execute all 4 SAR models (UNet, LightGBM, Log-Ratio, CUSUM) for side-by-side comparison",
    )
    live_inference: bool = Field(
        default=False,
        description="Force live sliding-window PyTorch/LightGBM tensor inference even for catalog events",
    )
    pre_date: Optional[str] = Field(default=None, description="Confirmed pre-fire ISO acquisition date")
    post_date: Optional[str] = Field(default=None, description="Confirmed post-fire ISO acquisition date")
    area_name: Optional[str] = Field(default=None, description="Confirmed geographic area label")


class ValidatePairRequest(BaseModel):
    pre_upload_id: str
    post_upload_id: str
    auto_coregister: bool = True
    pre_date: Optional[str] = None
    post_date: Optional[str] = None
    area_name: Optional[str] = None


class SampleUploadRequest(BaseModel):
    sample_id: Optional[str] = None
    file_path: Optional[str] = None
    role: str = "auto"
    acquisition_date: Optional[str] = None


class SegmentationMetricsSchema(BaseModel):
    true_positives: int
    false_positives: int
    false_negatives: int
    true_negatives: int
    total_pixels: int
    prevalence: float
    precision: float
    recall: float
    f1_score: float
    iou: float
    dice: float
    specificity: float
    false_positive_rate: Optional[float] = None
    false_negative_rate: Optional[float] = None
    predicted_area_km2: float
    reference_area_km2: float
    area_error_percent: float
    valid_pixels: Optional[int] = None
    f1_ci95_block_bootstrap: Optional[List[float]] = None
    roc_auc: Optional[float] = None
    pr_auc: Optional[float] = None
    event_id: Optional[str] = None
    note: Optional[str] = None


class AnalysisResultResponse(BaseModel):
    job_id: str
    event_id: str
    model_type: str
    status: str
    execution_time_sec: float
    metrics: SegmentationMetricsSchema
    summary: str
    data_origin: str
    is_nisar: bool = False
    uncertainty: Optional[Dict[str, Any]] = None
    provenance: Optional[Dict[str, Any]] = None
    caveats: Optional[List[str]] = None


class InspectResponse(BaseModel):
    file_name: str
    sensor: str
    product_type: str
    crs: str
    dimensions: List[int]
    polarizations: List[str]
    is_synthetic: bool
    validation_status: str
