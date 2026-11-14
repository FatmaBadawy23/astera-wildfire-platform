/**
 * Live HTTP Client for Astera Watch FastAPI Backend (Upload, Before/After Validation & Real SAR Model Inference).
 */

export interface LiveModelInfo {
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
  };
  limitations: string[];
}

export interface LiveSamplePair {
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

export interface LiveAvailableModelsResponse {
  active_run_id: string;
  data_origin: string;
  is_nisar: boolean;
  models: LiveModelInfo[];
  sample_uploads: LiveSamplePair[];
}

export interface LiveUploadMetadata {
  upload_id: string;
  filename: string;
  role: string;
  file_format: string;
  file_size_bytes: number;
  sha256: string;
  is_valid: boolean;
  valid_for_sar_inference: boolean;
  validation_status: string;
  error_code: string | null;
  scientific_explanation: string;
  sensor?: string | null;
  acquisition_date?: string | null;
  matched_event_id?: string | null;
  crs: string | null;
  bounds?: [number, number, number, number] | null;
  bounds_wgs84?: [number, number, number, number] | null;
  width: number;
  height: number;
  band_count: number;
  bands: string[];
  dtypes?: string[] | null;
  polarizations: string[];
  radiometric_scale?: string | null;
  resolution_m: number | null;
  valid_pixel_percentage: number;
  compatible_models: string[];
  incompatible_models_reasons?: Record<string, string>;
  warnings: string[];
  preview_url: string | null;
}

export interface LiveReferenceCandidate {
  sample_id: string;
  title: string;
  event_id: string;
  role_provided: "pre" | "post";
  file_path: string;
  sensor: string;
  bands: string[];
  polarizations: string[];
  acquisition_date: string | null;
  crs: string | null;
  bounds_wgs84: [number, number, number, number] | null;
  width: number;
  height: number;
  overlap_percent: number;
  crs_match: boolean;
  date_order_valid: boolean;
  dual_polarization_match: boolean;
  recommended: boolean;
  compatibility_note: string;
}

export interface LivePairValidation {
  pair_id: string;
  pre_upload_id: string;
  post_upload_id: string;
  pre_filename?: string;
  post_filename?: string;
  pre_date?: string | null;
  post_date?: string | null;
  area_name?: string | null;
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
    bounds_wgs84: [number, number, number, number] | null;
  };
  compatible_models: string[];
  reasons: string[];
  warnings: string[];
}

export interface LiveModelSegMetrics {
  precision: number;
  recall: number;
  f1_score: number;
  iou: number;
  dice: number;
  area_error_percent: number;
  roc_auc?: number | null;
  pr_auc?: number | null;
}

export interface LiveModelComparisonEntry {
  model_id: string;
  registry_name: string;
  status?: "COMPLETED" | "UNAVAILABLE";
  status_reason?: string | null;
  threshold: number | null;
  execution_time_sec: number;
  burned_pixels: number;
  burned_area_km2: number;
  burned_area_ha: number;
  burned_percentage: number;
  mean_probability?: number;
  detected_regions_count?: number;
  agreement_with_primary_percent?: number | null;
  iou_vs_primary?: number | null;
  delta_area_vs_primary_km2?: number | null;
  probability_png?: string | null;
  mask_png?: string | null;
  probability_tif?: string | null;
  mask_tif?: string | null;
  metrics_vs_sentinel2_dnbr?: LiveModelSegMetrics;
  metrics_vs_mcd64a1?: LiveModelSegMetrics;
}

export interface LiveAnalysisResult {
  analysis_id: string;
  job_id: string;
  status: string;
  execution_time_sec: number;
  source_label: string;
  event_id: string;
  model_type: string;
  model_name: string;
  threshold_used: number;
  spatial_metadata: {
    crs: string;
    width: number;
    height: number;
    resolution_m: number;
    bounds_wgs84?: [number, number, number, number] | null;
    pre_date: string;
    post_date: string;
    area_name?: string | null;
  };
  area_statistics: {
    valid_land_pixels: number;
    burned_pixels: number;
    burned_percentage_of_valid: number;
    total_valid_area_km2?: number;
    burned_area_ha: number;
    burned_area_km2: number;
    burned_area_acres: number;
    dnbr_reference_area_km2?: number | null;
    mcd64a1_reference_area_km2?: number | null;
  };
  before_after_radiometry: {
    mean_pre_vh_db: number;
    mean_post_vh_db: number;
    mean_delta_vh_db: number;
    mean_delta_vh_burned_db: number;
    mean_delta_vh_unburned_db?: number;
    separability_burned_minus_unburned_db?: number;
    max_backscatter_drop_db?: number;
    mean_burn_probability?: number;
    p95_burn_probability: number;
  };
  model_comparison: Record<string, LiveModelComparisonEntry>;
  layers: {
    pre_fire_vh_db: string;
    post_fire_vh_db: string;
    delta_vh_db: string;
    burn_probability: string;
    predicted_burn_mask: string;
    difference_heatmap: string;
    model_consensus?: string;
    overview_png: string;
    models?: Record<string, { probability: string; mask: string }>;
  };
  downloads: {
    burn_probability_tif: string;
    predicted_burn_mask_tif: string;
    delta_vh_db_tif: string;
    pre_fire_vh_db_tif?: string;
    post_fire_vh_db_tif?: string;
    model_consensus_tif?: string;
    burned_polygons_geojson: string;
    metadata_json: string;
    [key: string]: string | undefined;
  };
  burned_polygons_feature_count: number;
  summary: string;
}

const rawApiBase = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
const API_BASE = rawApiBase ? (rawApiBase.endsWith("/api") ? rawApiBase : `${rawApiBase}/api`) : "/api";

function parseErrorDetail(body: unknown, fallbackStatus: number): string {
  const b = body as { detail?: string | { message?: string; code?: string } } | null;
  if (b?.detail) {
    if (typeof b.detail === "string") return b.detail;
    if (typeof b.detail === "object" && typeof b.detail.message === "string") {
      return b.detail.code ? `${b.detail.code}: ${b.detail.message}` : b.detail.message;
    }
    return JSON.stringify(b.detail);
  }
  return `HTTP ${fallbackStatus}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      detail = parseErrorDetail(await res.json(), res.status);
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

const XHR_PROGRESS_MIN_BYTES = 2 * 1024 * 1024;

async function uploadWithProgress(
  path: string,
  formData: FormData,
  onProgress?: (pct: number) => void,
  fileSizeBytes?: number
): Promise<LiveUploadMetadata> {
  if (
    !onProgress ||
    typeof XMLHttpRequest === "undefined" ||
    (fileSizeBytes !== undefined && fileSizeBytes < XHR_PROGRESS_MIN_BYTES)
  ) {
    const res = await requestJson<LiveUploadMetadata>(path, { method: "POST", body: formData });
    onProgress?.(100);
    return res;
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
      }
    };
    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve(parsed as LiveUploadMetadata);
        } else {
          reject(new Error(parseErrorDetail(parsed, xhr.status)));
        }
      } catch {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading satellite raster."));
    xhr.send(formData);
  });
}

export const liveInferenceClient = {
  getAvailableModels: () => requestJson<LiveAvailableModelsResponse>("/models/available"),
  findReferenceCandidates: (uploadId?: string, roleNeeded?: "pre" | "post") => {
    const q = new URLSearchParams();
    if (uploadId) q.set("upload_id", uploadId);
    if (roleNeeded) q.set("role_needed", roleNeeded);
    const qs = q.toString();
    return requestJson<{ upload_id: string | null; role_needed: string | null; candidates: LiveReferenceCandidate[] }>(
      `/analysis/reference-candidates${qs ? `?${qs}` : ""}`
    );
  },
  uploadFile: (
    file: File,
    role = "auto",
    opts?: { acquisitionDate?: string; sensorHint?: string; onProgress?: (pct: number) => void }
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("role", role);
    if (opts?.acquisitionDate) formData.append("acquisition_date", opts.acquisitionDate);
    if (opts?.sensorHint) formData.append("sensor_hint", opts.sensorHint);
    return uploadWithProgress("/analysis/upload", formData, opts?.onProgress, file.size);
  },
  uploadSample: (sampleId: string, role: string, acquisitionDate?: string) =>
    requestJson<LiveUploadMetadata>("/analysis/upload-sample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sample_id: sampleId, role, acquisition_date: acquisitionDate }),
    }),
  validatePair: (
    preUploadId: string,
    postUploadId: string,
    opts?: { autoCoregister?: boolean; preDate?: string; postDate?: string; areaName?: string }
  ) =>
    requestJson<LivePairValidation>("/analysis/validate-pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pre_upload_id: preUploadId,
        post_upload_id: postUploadId,
        auto_coregister: opts?.autoCoregister ?? true,
        pre_date: opts?.preDate || undefined,
        post_date: opts?.postDate || undefined,
        area_name: opts?.areaName || undefined,
      }),
    }),
  runAnalysis: (payload: {
    pair_id?: string;
    upload_id?: string;
    event_id?: string;
    model_type: string;
    threshold?: number | null;
    run_all_models?: boolean;
    live_inference?: boolean;
    pre_date?: string;
    post_date?: string;
    area_name?: string;
  }) =>
    requestJson<LiveAnalysisResult>("/analysis/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};
