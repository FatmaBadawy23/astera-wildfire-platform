import type {
  AvailableModelsResponse,
  DatasetStatsResponse,
  EventAnalysisResponse,
  EventGeoJSONResponse,
  FireEvent,
  HealthResponse,
  LatestRunResponse,
  LiveAnalysisResultResponse,
  ModelComparisonResponse,
  NisarStatusResponse,
  UploadMetadataResponse,
  ValidatePairResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    let errText = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody?.detail) errText = String(errBody.detail);
    } catch {
      // ignore
    }
    throw new Error(errText);
  }
  return response.json() as Promise<T>;
}

export function resolveApiAssetUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (API_BASE.startsWith("http") && path.startsWith("/api")) {
    return `${API_BASE.replace(/\/api$/, "")}${path}`;
  }
  return path;
}

export const api = {
  getHealth: () => fetchJson<HealthResponse>("/health"),
  getLatestRun: () => fetchJson<LatestRunResponse>("/runs/latest"),
  getEvents: (includeExcluded = true) =>
    fetchJson<FireEvent[]>(`/events?include_excluded=${includeExcluded}`),
  getEventAnalysis: (eventId: string) =>
    fetchJson<EventAnalysisResponse>(`/events/${encodeURIComponent(eventId)}/analysis`),
  getEventGeoJSON: (eventId: string) =>
    fetchJson<EventGeoJSONResponse>(`/events/${encodeURIComponent(eventId)}/geojson`),
  getModelComparison: () => fetchJson<ModelComparisonResponse>("/models/comparison"),
  getDatasetStats: () => fetchJson<DatasetStatsResponse>("/dataset/stats"),
  getNisarStatus: () => fetchJson<NisarStatusResponse>("/nisar/status"),
  getAvailableModels: () => fetchJson<AvailableModelsResponse>("/models/available"),
  uploadFile: async (file: File, role = "auto"): Promise<UploadMetadataResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("role", role);
    return fetchJson<UploadMetadataResponse>("/analysis/upload", {
      method: "POST",
      body: formData,
    });
  },
  uploadSample: (sampleId: string, role: string, filePath?: string) =>
    fetchJson<UploadMetadataResponse>("/analysis/upload-sample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sample_id: sampleId, role, file_path: filePath }),
    }),
  validatePair: (preUploadId: string, postUploadId: string, autoCoregister = true) =>
    fetchJson<ValidatePairResponse>("/analysis/validate-pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pre_upload_id: preUploadId,
        post_upload_id: postUploadId,
        auto_coregister: autoCoregister,
      }),
    }),
  runLiveAnalysis: (payload: {
    event_id?: string;
    upload_id?: string;
    pair_id?: string;
    pre_upload_id?: string;
    post_upload_id?: string;
    model_type: string;
    threshold?: number | null;
    run_all_models?: boolean;
    live_inference?: boolean;
  }) =>
    fetchJson<LiveAnalysisResultResponse>("/analysis/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getAnalysisHistory: () =>
    fetchJson<{ runs: Array<Record<string, unknown>> }>("/analysis/history"),
};
