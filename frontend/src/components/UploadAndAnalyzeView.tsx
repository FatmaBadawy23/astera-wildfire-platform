import React, { useEffect, useState } from "react";
import { api, resolveApiAssetUrl } from "../api";
import type {
  AvailableModelsResponse,
  LiveAnalysisResultResponse,
  UploadMetadataResponse,
  ValidatePairResponse,
} from "../types";

export const UploadAndAnalyzeView: React.FC = () => {
  const [modelsInfo, setModelsInfo] = useState<AvailableModelsResponse | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);

  const [preUpload, setPreUpload] = useState<UploadMetadataResponse | null>(null);
  const [postUpload, setPostUpload] = useState<UploadMetadataResponse | null>(null);
  const [pairValidation, setPairValidation] = useState<ValidatePairResponse | null>(null);

  const [selectedModel, setSelectedModel] = useState<string>("unet");
  const [customThreshold, setCustomThreshold] = useState<string>("");
  const [runAllModels, setRunAllModels] = useState<boolean>(true);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<LiveAnalysisResultResponse | null>(null);

  const [compareMode, setCompareMode] = useState<"side_by_side" | "swipe" | "overview" | "difference">("side_by_side");
  const [swipePercent, setSwipePercent] = useState<number>(50);
  const [swipeRightLayer, setSwipeRightLayer] = useState<
    "post_fire_vh_db" | "burn_probability" | "predicted_burn_mask" | "delta_vh_db"
  >("post_fire_vh_db");

  useEffect(() => {
    let active = true;
    api
      .getAvailableModels()
      .then((res) => {
        if (active) setModelsInfo(res);
      })
      .catch((err) => {
        if (active) setErrorMsg(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoadingModels(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleFileUpload = async (file: File, role: "pre_fire" | "post_fire") => {
    setErrorMsg(null);
    setBusyAction(`Uploading & inspecting ${file.name} (${role})...`);
    try {
      const meta = await api.uploadFile(file, role);
      if (role === "pre_fire") {
        setPreUpload(meta);
        setPairValidation(null);
      } else {
        setPostUpload(meta);
        setPairValidation(null);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleLoadSamplePair = async (sampleId: string) => {
    setErrorMsg(null);
    setBusyAction(`Loading real georeferenced Sentinel-1 sample pair (${sampleId})...`);
    try {
      const preMeta = await api.uploadSample(sampleId, "pre_fire");
      const postMeta = await api.uploadSample(sampleId, "post_fire");
      setPreUpload(preMeta);
      setPostUpload(postMeta);
      const pairRes = await api.validatePair(preMeta.upload_id, postMeta.upload_id, true);
      setPairValidation(pairRes);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestRgbRejection = async () => {
    setErrorMsg(null);
    setBusyAction("Testing scientific guardrail with uncalibrated 8-bit RGB PNG...");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(0, 0, 64, 64);
      }
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b || new Blob()), "image/png")
      );
      const rgbFile = new File([blob], "uncalibrated_rgb_photo.png", { type: "image/png" });
      const meta = await api.uploadFile(rgbFile, "pre_fire");
      setPreUpload(meta);
      setPairValidation(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleValidatePair = async () => {
    if (!preUpload || !postUpload) return;
    setErrorMsg(null);
    setBusyAction("Validating CRS, spatial overlap, resolution, and co-registration...");
    try {
      const res = await api.validatePair(preUpload.upload_id, postUpload.upload_id, true);
      setPairValidation(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunInference = async () => {
    setErrorMsg(null);
    setBusyAction(`Running real ${selectedModel.toUpperCase()} inference and generating geospatial products...`);
    try {
      const parsedThresh =
        customThreshold.trim() !== "" && !Number.isNaN(Number(customThreshold))
          ? Number(customThreshold)
          : null;

      let pairId = pairValidation?.pair_id;
      if (!pairId && preUpload && postUpload) {
        const pairRes = await api.validatePair(preUpload.upload_id, postUpload.upload_id, true);
        setPairValidation(pairRes);
        if (!pairRes.compatible) {
          throw new Error(`Incompatible Before/After pair: ${pairRes.reasons.join("; ")}`);
        }
        pairId = pairRes.pair_id;
      }

      const res = await api.runLiveAnalysis({
        pair_id: pairId,
        upload_id: !pairId && preUpload ? preUpload.upload_id : undefined,
        model_type: selectedModel,
        threshold: parsedThresh,
        run_all_models: runAllModels,
        live_inference: true,
      });
      setAnalysisResult(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const renderUploadCard = (
    title: string,
    role: "pre_fire" | "post_fire",
    meta: UploadMetadataResponse | null,
    inputId: string
  ) => (
    <div
      style={{
        background: "#111827",
        border: `1px solid ${
          meta ? (meta.valid_for_sar_inference ? "#10b981" : "#ef4444") : "#1e293b"
        }`,
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, color: "#f8fafc" }}>{title}</h3>
        {meta && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 999,
              background: meta.valid_for_sar_inference ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.2)",
              color: meta.valid_for_sar_inference ? "#34d399" : "#fca5a5",
            }}
          >
            {meta.validation_status}
          </span>
        )}
      </div>

      <label
        htmlFor={inputId}
        style={{
          display: "block",
          border: "1px dashed #334155",
          borderRadius: 8,
          padding: "12px",
          textAlign: "center",
          cursor: "pointer",
          background: "#0f172a",
          color: "#cbd5e1",
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        Click to upload GeoTIFF (<code>.tif</code>/<code>.tiff</code>) or SAR Stack (<code>.npz</code>)
        <input
          id={inputId}
          data-testid={inputId}
          type="file"
          accept=".tif,.tiff,.npz,.png,.jpg,.jpeg"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f, role);
          }}
        />
      </label>

      {meta && (
        <div style={{ fontSize: 12.5, color: "#cbd5e1", display: "grid", gap: 6 }}>
          <div>
            <strong>File:</strong> <code>{meta.filename}</code> ({(meta.file_size_bytes / 1024).toFixed(1)} KB)
          </div>
          <div>
            <strong>Upload ID:</strong> <code>{meta.upload_id}</code> | <strong>Format:</strong> {meta.file_format}
          </div>
          <div>
            <strong>Grid & CRS:</strong> {meta.width} × {meta.height} px | CRS:{" "}
            <code>{meta.crs || "None (Ungeoreferenced)"}</code> | Res:{" "}
            {meta.resolution_m ? `${meta.resolution_m} m` : "N/A"}
          </div>
          <div>
            <strong>Bands ({meta.band_count}):</strong> {meta.bands.join(", ")} |{" "}
            <strong>Valid Pixels:</strong> {meta.valid_pixel_percentage}%
          </div>
          <div>
            <strong>Compatible Models:</strong>{" "}
            {meta.compatible_models.length > 0 ? meta.compatible_models.join(", ") : "None"}
          </div>
          <div
            style={{
              padding: 8,
              borderRadius: 6,
              background: meta.valid_for_sar_inference ? "rgba(15,23,42,0.8)" : "rgba(127,29,29,0.35)",
              color: meta.valid_for_sar_inference ? "#94a3b8" : "#fecaca",
              fontSize: 12,
            }}
          >
            {meta.scientific_explanation}
          </div>
          {meta.preview_url && (
            <div style={{ marginTop: 6 }}>
              <img
                src={resolveApiAssetUrl(meta.preview_url)}
                alt={`${meta.filename} preview`}
                style={{
                  width: "100%",
                  maxHeight: 190,
                  objectFit: "contain",
                  background: "#020617",
                  borderRadius: 6,
                  border: "1px solid #1e293b",
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Header & Quick Sample Loader */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
          border: "1px solid #312e81",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: "0 0 6px 0", fontSize: 20, color: "#f8fafc" }}>
              Satellite Raster Upload, Before/After Co-Registration & Live SAR Model Inference
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, color: "#cbd5e1", maxWidth: 880 }}>
              Upload georeferenced Pre-Fire and Post-Fire Sentinel-1 GeoTIFFs (<code>.tif</code>/<code>.tiff</code>) or
              multi-band SAR stacks (<code>.npz</code>), verify spatial alignment and CRS compatibility, and execute live
              forward passes through <strong>UNet_ResNet34</strong>, <strong>LightGBM_Pixel_Spatial</strong>,{" "}
              <strong>Log_Ratio_Baseline</strong>, and <strong>CUSUM_Temporal</strong>.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              data-testid="load-sample-dualpol-btn"
              onClick={() => handleLoadSamplePair("CA_BUG_2026_DUALPOL")}
              disabled={Boolean(busyAction)}
              style={{
                background: "#f97316",
                color: "#0f172a",
                border: "none",
                borderRadius: 8,
                padding: "9px 14px",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Load Real Sentinel-1 Dual-Pol Pair (CA_BUG_2026)
            </button>
            <button
              data-testid="load-sample-dome-btn"
              onClick={() => handleLoadSamplePair("CA_DOME_2026_VH_SINGLE")}
              disabled={Boolean(busyAction)}
              style={{
                background: "#1e293b",
                color: "#e2e8f0",
                border: "1px solid #475569",
                borderRadius: 8,
                padding: "9px 14px",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Load CA_DOME_2026 Pair
            </button>
            <button
              data-testid="test-rgb-rejection-btn"
              onClick={handleTestRgbRejection}
              disabled={Boolean(busyAction)}
              style={{
                background: "rgba(239,68,68,0.16)",
                color: "#fca5a5",
                border: "1px solid #dc2626",
                borderRadius: 8,
                padding: "9px 14px",
                fontWeight: 600,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              Test Uncalibrated RGB (.png) Rejection
            </button>
          </div>
        </div>

        {busyAction && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(59,130,246,0.18)",
              border: "1px solid #3b82f6",
              color: "#93c5fd",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ⏳ {busyAction}
          </div>
        )}

        {errorMsg && (
          <div
            data-testid="inference-error-banner"
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.2)",
              border: "1px solid #ef4444",
              color: "#fecaca",
              fontSize: 13,
            }}
          >
            <strong>Validation / Execution Diagnostic:</strong> {errorMsg}
          </div>
        )}
      </div>

      {/* Step 1: Upload Pre-Fire and Post-Fire Rasters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
        {renderUploadCard("1A. Pre-Fire (Before) Satellite Raster", "pre_fire", preUpload, "pre-fire-upload-input")}
        {renderUploadCard("1B. Post-Fire (After) Satellite Raster", "post_fire", postUpload, "post-fire-upload-input")}
      </div>

      {/* Step 2: Pair Validation & Model Execution Controls */}
      <div
        style={{
          background: "#111827",
          border: "1px solid #1e293b",
          borderRadius: 10,
          padding: 16,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, color: "#f8fafc" }}>
              2. Before/After Spatial Compatibility & Real Model Execution
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 12.5, color: "#94a3b8" }}>
              Validates CRS, spatial bounding box overlap, pixel dimensions, and resolution before running PyTorch &
              LightGBM inference.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              data-testid="validate-pair-btn"
              onClick={handleValidatePair}
              disabled={!preUpload || !postUpload || Boolean(busyAction)}
              style={{
                background: "#1e293b",
                color: "#f8fafc",
                border: "1px solid #475569",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: !preUpload || !postUpload ? "not-allowed" : "pointer",
                opacity: !preUpload || !postUpload ? 0.5 : 1,
              }}
            >
              Validate Before/After Pair
            </button>

            <select
              data-testid="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                background: "#0f172a",
                color: "#f8fafc",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
              }}
            >
              <option value="unet">UNet_ResNet34 (Primary 5-Ch Deep Segmentation)</option>
              <option value="lightgbm">LightGBM_Pixel_Spatial (10-Feature Classifier)</option>
              <option value="log_ratio">Log_Ratio_Baseline (Analytical ΔVH Threshold)</option>
              <option value="cusum">CUSUM_Temporal (Multi-Temporal Anomaly Detector)</option>
            </select>

            <input
              type="text"
              placeholder="Default threshold"
              value={customThreshold}
              onChange={(e) => setCustomThreshold(e.target.value)}
              style={{
                width: 130,
                background: "#0f172a",
                color: "#f8fafc",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
              }}
            />

            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#cbd5e1" }}>
              <input
                type="checkbox"
                checked={runAllModels}
                onChange={(e) => setRunAllModels(e.target.checked)}
              />
              Compare all compatible models
            </label>

            <button
              data-testid="run-live-inference-btn"
              onClick={handleRunInference}
              disabled={!preUpload || Boolean(busyAction)}
              style={{
                background: "#10b981",
                color: "#022c22",
                border: "none",
                borderRadius: 8,
                padding: "9px 18px",
                fontSize: 13.5,
                fontWeight: 800,
                cursor: !preUpload ? "not-allowed" : "pointer",
                opacity: !preUpload ? 0.5 : 1,
              }}
            >
              ▶ Run Real Model Inference
            </button>
          </div>
        </div>

        {pairValidation && (
          <div
            data-testid="pair-validation-summary"
            style={{
              padding: 12,
              borderRadius: 8,
              background: pairValidation.compatible ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${pairValidation.compatible ? "#059669" : "#dc2626"}`,
              fontSize: 12.5,
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span>
                <strong>Pair ID:</strong> <code>{pairValidation.pair_id}</code> |{" "}
                <strong>Status:</strong> {pairValidation.status}
              </span>
              {pairValidation.checks && (
                <span>
                  CRS Match: <strong>{pairValidation.checks.crs_match ? "YES" : "NO"}</strong> (
                  <code>{pairValidation.checks.pre_crs}</code>) | Spatial Overlap:{" "}
                  <strong>{pairValidation.checks.spatial_overlap_percent}%</strong> | Dimensions Match:{" "}
                  <strong>{pairValidation.checks.dimensions_match ? "YES" : "NO"}</strong> | Dual-Pol (VV+VH):{" "}
                  <strong>{pairValidation.checks.dual_polarization_available ? "YES" : "NO"}</strong>
                </span>
              )}
            </div>
            {pairValidation.reasons.length > 0 && (
              <div style={{ color: "#fca5a5" }}>
                <strong>Blocking Reasons:</strong> {pairValidation.reasons.join(" | ")}
              </div>
            )}
            {pairValidation.warnings.length > 0 && (
              <div style={{ color: "#fde68a" }}>
                <strong>Warnings:</strong> {pairValidation.warnings.join(" | ")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 3: Live Analysis Results & Interactive Before/After Comparison */}
      {analysisResult && (
        <div
          data-testid="live-analysis-results"
          style={{
            background: "#111827",
            border: "1px solid #10b981",
            borderRadius: 12,
            padding: 20,
            display: "grid",
            gap: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "rgba(16,185,129,0.2)",
                  color: "#34d399",
                  marginRight: 8,
                }}
              >
                LIVE INFERENCE COMPLETED ({analysisResult.execution_time_sec}s)
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                Analysis ID: <code>{analysisResult.analysis_id}</code> | CRS:{" "}
                <code>{analysisResult.spatial_metadata.crs}</code> ({analysisResult.spatial_metadata.width}×
                {analysisResult.spatial_metadata.height} px @ {analysisResult.spatial_metadata.resolution_m} m)
              </span>
              <h3 style={{ margin: "6px 0 0 0", fontSize: 18, color: "#f8fafc" }}>
                {analysisResult.model_name} — {analysisResult.source_label}
              </h3>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(
                [
                  ["side_by_side", "Side-by-Side Comparison"],
                  ["swipe", "Before/After Swipe Slider"],
                  ["difference", "ΔVH Difference & Burn Mask"],
                  ["overview", "6-Panel Scientific Figure"],
                ] as const
              ).map(([modeKey, label]) => (
                <button
                  key={modeKey}
                  onClick={() => setCompareMode(modeKey)}
                  style={{
                    background: compareMode === modeKey ? "#f97316" : "#1e293b",
                    color: compareMode === modeKey ? "#0f172a" : "#e2e8f0",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    padding: "7px 12px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 13.5, color: "#cbd5e1", background: "#0f172a", padding: 12, borderRadius: 8 }}>
            {analysisResult.summary}
          </p>

          {/* Key Quantitative KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            <div style={{ background: "#0f172a", padding: 12, borderRadius: 8, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 11.5, color: "#94a3b8" }}>Predicted Burned Area</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f97316" }}>
                {analysisResult.area_statistics.burned_area_km2.toFixed(2)} km²
              </div>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                {analysisResult.area_statistics.burned_area_ha.toLocaleString()} ha (
                {analysisResult.area_statistics.burned_area_acres.toLocaleString()} acres)
              </div>
            </div>
            <div style={{ background: "#0f172a", padding: 12, borderRadius: 8, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 11.5, color: "#94a3b8" }}>Burned Fraction of Valid Land</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f8fafc" }}>
                {analysisResult.area_statistics.burned_percentage_of_valid}%
              </div>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                {analysisResult.area_statistics.burned_pixels.toLocaleString()} /{" "}
                {analysisResult.area_statistics.valid_land_pixels.toLocaleString()} px
              </div>
            </div>
            <div style={{ background: "#0f172a", padding: 12, borderRadius: 8, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 11.5, color: "#94a3b8" }}>Pre vs Post VH Backscatter</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8" }}>
                {analysisResult.before_after_radiometry.mean_pre_vh_db} dB →{" "}
                {analysisResult.before_after_radiometry.mean_post_vh_db} dB
              </div>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                Mean ΔVH (Burned): {analysisResult.before_after_radiometry.mean_delta_vh_burned_db} dB
              </div>
            </div>
            <div style={{ background: "#0f172a", padding: 12, borderRadius: 8, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 11.5, color: "#94a3b8" }}>Vectorized Burn Polygons</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#34d399" }}>
                {analysisResult.burned_polygons_feature_count}
              </div>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                Threshold: {analysisResult.threshold_used} | P95 Prob:{" "}
                {analysisResult.before_after_radiometry.p95_burn_probability}
              </div>
            </div>
          </div>

          {/* Visual Comparison Modes */}
          {compareMode === "side_by_side" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              {[
                { title: `Pre-Fire VH dB (${analysisResult.spatial_metadata.pre_date})`, url: analysisResult.layers.pre_fire_vh_db },
                { title: `Post-Fire VH dB (${analysisResult.spatial_metadata.post_date})`, url: analysisResult.layers.post_fire_vh_db },
                { title: "Radar Backscatter Change (ΔVH dB)", url: analysisResult.layers.delta_vh_db },
                { title: `${analysisResult.model_name} Burn Probability`, url: analysisResult.layers.burn_probability },
                { title: "Predicted Burned Candidate Mask", url: analysisResult.layers.predicted_burn_mask },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    background: "#020617",
                    border: "1px solid #1e293b",
                    borderRadius: 8,
                    padding: 10,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>{item.title}</div>
                  <img
                    src={resolveApiAssetUrl(item.url)}
                    alt={item.title}
                    style={{ width: "100%", borderRadius: 6, display: "block" }}
                  />
                </div>
              ))}
            </div>
          )}

          {compareMode === "swipe" && (
            <div style={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontSize: 13, color: "#e2e8f0" }}>
                  <strong>Left:</strong> Pre-Fire VH Backscatter (dB) | <strong>Right:</strong>{" "}
                  <select
                    value={swipeRightLayer}
                    onChange={(e) => setSwipeRightLayer(e.target.value as typeof swipeRightLayer)}
                    style={{
                      background: "#0f172a",
                      color: "#f8fafc",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      padding: "4px 8px",
                      marginLeft: 6,
                    }}
                  >
                    <option value="post_fire_vh_db">Post-Fire VH Backscatter (dB)</option>
                    <option value="burn_probability">Model Burn Probability [0..1]</option>
                    <option value="predicted_burn_mask">Predicted Burned Mask</option>
                    <option value="delta_vh_db">Radar Change ΔVH (dB)</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Swipe Position: {swipePercent}%</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={swipePercent}
                    onChange={(e) => setSwipePercent(Number(e.target.value))}
                    style={{ width: 220 }}
                  />
                </div>
              </div>
              <div
                style={{
                  position: "relative",
                  maxWidth: 560,
                  margin: "0 auto",
                  overflow: "hidden",
                  borderRadius: 8,
                  border: "1px solid #334155",
                }}
              >
                <img
                  src={resolveApiAssetUrl(analysisResult.layers[swipeRightLayer])}
                  alt="After layer"
                  style={{ width: "100%", display: "block" }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `${swipePercent}%`,
                    overflow: "hidden",
                    borderRight: "2px solid #f97316",
                  }}
                >
                  <img
                    src={resolveApiAssetUrl(analysisResult.layers.pre_fire_vh_db)}
                    alt="Before layer"
                    style={{ width: 560, maxWidth: "none", display: "block" }}
                  />
                </div>
              </div>
            </div>
          )}

          {compareMode === "difference" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {[
                { title: "Radar Backscatter Change ΔVH (Post - Pre dB)", url: analysisResult.layers.delta_vh_db },
                { title: "Canopy Backscatter Loss Heatmap (-ΔVH Magnitude)", url: analysisResult.layers.difference_heatmap },
                { title: "Predicted Burned Candidate Mask", url: analysisResult.layers.predicted_burn_mask },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 8, padding: 12 }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>{item.title}</div>
                  <img src={resolveApiAssetUrl(item.url)} alt={item.title} style={{ width: "100%", borderRadius: 6 }} />
                </div>
              ))}
            </div>
          )}

          {compareMode === "overview" && (
            <div style={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 8, padding: 12 }}>
              <img
                src={resolveApiAssetUrl(analysisResult.layers.overview_png)}
                alt="6-Panel Scientific Overview"
                style={{ width: "100%", borderRadius: 6, display: "block" }}
              />
            </div>
          )}

          {/* Multi-Model Comparison Table */}
          <div>
            <h4 style={{ margin: "0 0 8px 0", fontSize: 14, color: "#f8fafc" }}>
              Multi-Model Execution Comparison on Uploaded Scene Pair
            </h4>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "#94a3b8", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px" }}>Model</th>
                    <th style={{ padding: "8px 10px" }}>Threshold</th>
                    <th style={{ padding: "8px 10px" }}>Runtime (s)</th>
                    <th style={{ padding: "8px 10px" }}>Burned Pixels</th>
                    <th style={{ padding: "8px 10px" }}>Burned Area (km²)</th>
                    <th style={{ padding: "8px 10px" }}>Burned Area (ha)</th>
                    <th style={{ padding: "8px 10px" }}>% of Valid Land</th>
                    <th style={{ padding: "8px 10px" }}>vs S2 dNBR F1 / IoU / ROC-AUC</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(analysisResult.model_comparison).map((m) => (
                    <tr key={m.model_id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: "#f8fafc" }}>{m.registry_name}</td>
                      <td style={{ padding: "8px 10px" }}>{m.threshold}</td>
                      <td style={{ padding: "8px 10px" }}>{m.execution_time_sec}s</td>
                      <td style={{ padding: "8px 10px" }}>{m.burned_pixels.toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: "#f97316" }}>
                        {m.burned_area_km2.toFixed(2)} km²
                      </td>
                      <td style={{ padding: "8px 10px" }}>{m.burned_area_ha.toLocaleString()} ha</td>
                      <td style={{ padding: "8px 10px" }}>{m.burned_percentage}%</td>
                      <td style={{ padding: "8px 10px" }}>
                        {m.metrics_vs_sentinel2_dnbr
                          ? `F1=${m.metrics_vs_sentinel2_dnbr.f1_score.toFixed(3)} | IoU=${m.metrics_vs_sentinel2_dnbr.iou.toFixed(3)} | AUC=${(m.metrics_vs_sentinel2_dnbr.roc_auc ?? 0).toFixed(3)}`
                          : "Custom Upload (No S2 Reference Attached)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Downloadable Geospatial Products */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#94a3b8" }}>Export Geospatial Artifacts:</span>
            {[
              ["Burn Probability GeoTIFF", analysisResult.downloads.burn_probability_tif],
              ["Predicted Burn Mask GeoTIFF", analysisResult.downloads.predicted_burn_mask_tif],
              ["ΔVH Change GeoTIFF", analysisResult.downloads.delta_vh_db_tif],
              ["Burned Polygons GeoJSON", analysisResult.downloads.burned_polygons_geojson],
              ["Full Result JSON", analysisResult.downloads.metadata_json],
            ].map(([label, href]) => (
              <a
                key={label}
                href={resolveApiAssetUrl(href)}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: "#1e293b",
                  color: "#38bdf8",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 12,
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                ⬇ {label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Available Models Registry & Input Contracts */}
      {!loadingModels && modelsInfo && (
        <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 15, color: "#f8fafc" }}>
            Verified Model Registry & Input Contracts (Active Run: <code>{modelsInfo.active_run_id}</code>)
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {modelsInfo.models.map((m) => (
              <div
                key={m.model_id}
                style={{
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 12,
                  display: "grid",
                  gap: 5,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "#f8fafc", fontSize: 13 }}>{m.registry_key}</strong>
                  <span
                    style={{
                      fontSize: 10.5,
                      padding: "2px 6px",
                      borderRadius: 999,
                      background: m.status === "READY" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                      color: m.status === "READY" ? "#34d399" : "#fca5a5",
                    }}
                  >
                    {m.status}
                  </span>
                </div>
                <div style={{ color: "#94a3b8" }}>{m.name}</div>
                <div>
                  <strong>Default Threshold:</strong> {m.default_threshold} | <strong>Dual-Pol Required:</strong>{" "}
                  {m.input_contract.requires_dual_pol ? "Yes (VV+VH)" : "No (VH/Single-Pol)"}
                </div>
                <div>
                  <strong>Input Contract:</strong> {m.input_contract.type}
                </div>
                {m.checkpoint_path && (
                  <div style={{ wordBreak: "break-all" }}>
                    <strong>Checkpoint:</strong> <code>{m.checkpoint_path}</code>
                    {m.checkpoint_size_bytes ? ` (${(m.checkpoint_size_bytes / (1024 * 1024)).toFixed(2)} MB)` : ""}
                  </div>
                )}
                {m.checkpoint_sha256 && (
                  <div>
                    <strong>SHA-256:</strong> <code>{m.checkpoint_sha256.slice(0, 16)}…</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
