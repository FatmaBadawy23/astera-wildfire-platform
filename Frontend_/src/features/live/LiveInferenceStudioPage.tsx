/**
 * Live Fire Analysis Workspace (`Astera Watch`).
 * End-to-end SAR wildfire change detection:
 * 1. Drag-and-drop Pre-Fire & Post-Fire Sentinel-1 GeoTIFF (.tif/.tiff) or SAR stack (.npz) upload + previews.
 * 2. Scientific validation (rejects uncalibrated optical RGB PNG/JPEG/GeoTIFF, validates VV/VH, CRS, resolution, overlap & dates).
 * 3. Single-image recovery workflow (never fabricates a Before image — offers manual upload or compatible dataset pairing).
 * 4. Confirm geographical area & acquisition dates + ONE-click `Analyze Fire`.
 * 5. Synchronized Before/After views, interactive wipe slider, difference heatmap, MapLibre GeoTIFF/GeoJSON map,
 *    4-model comparison dashboard (UNet_ResNet34, LightGBM_Pixel_Spatial, Log_Ratio_Baseline, CUSUM_Temporal), and exports.
 */
import { useEffect, useRef, useState, type DragEvent } from "react";
import { UploadCloud, Flame, AlertTriangle, CheckCircle2, Sparkles, Database } from "lucide-react";
import { Page } from "@/components/layout/Page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SafetyNote } from "@/components/help/SafetyNote";
import {
  liveInferenceClient,
  type LiveAnalysisResult,
  type LiveAvailableModelsResponse,
  type LivePairValidation,
  type LiveReferenceCandidate,
  type LiveSamplePair,
  type LiveUploadMetadata,
} from "@/data/http/liveInferenceClient";
import { BeforeAfterComparePanel } from "./BeforeAfterComparePanel";
import { MultiModelDashboard } from "./MultiModelDashboard";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function toDateInputValue(raw?: string | null): string {
  if (!raw) return "";
  const m = raw.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "";
}

export function LiveInferenceStudioPage() {
  const [modelsInfo, setModelsInfo] = useState<LiveAvailableModelsResponse | null>(null);
  const [preUpload, setPreUpload] = useState<LiveUploadMetadata | null>(null);
  const [postUpload, setPostUpload] = useState<LiveUploadMetadata | null>(null);
  const [pairValidation, setPairValidation] = useState<LivePairValidation | null>(null);

  const [areaName, setAreaName] = useState("");
  const [preDate, setPreDate] = useState("");
  const [postDate, setPostDate] = useState("");
  const [selectedModel, setSelectedModel] = useState("unet");
  const [runAllModels, setRunAllModels] = useState(true);
  const [customThreshold, setCustomThreshold] = useState("");

  const [dragTarget, setDragTarget] = useState<"pre_fire" | "post_fire" | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ role: "pre_fire" | "post_fire"; pct: number } | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [referenceCandidates, setReferenceCandidates] = useState<LiveReferenceCandidate[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<LiveAnalysisResult | null>(null);

  const preInputRef = useRef<HTMLInputElement>(null);
  const postInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    liveInferenceClient
      .getAvailableModels()
      .then((res) => {
        if (active) setModelsInfo(res);
      })
      .catch((err) => {
        if (active) setErrorMessage(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  // Automatically fetch compatible reference candidates when only ONE valid acquisition is present
  useEffect(() => {
    const preValid = preUpload?.valid_for_sar_inference && preUpload.band_count < 4;
    const postValid = postUpload?.valid_for_sar_inference && postUpload.band_count < 4;
    if ((preValid && !postValid) || (!preValid && postValid)) {
      const singleMeta = preValid ? preUpload! : postUpload!;
      const roleNeeded: "pre" | "post" = preValid ? "post" : "pre";
      let active = true;
      setLoadingRefs(true);
      liveInferenceClient
        .findReferenceCandidates(singleMeta.upload_id, roleNeeded)
        .then((res) => {
          if (active) setReferenceCandidates(res.candidates ?? []);
        })
        .catch(() => {
          if (active) setReferenceCandidates([]);
        })
        .finally(() => {
          if (active) setLoadingRefs(false);
        });
      return () => {
        active = false;
      };
    }
    setReferenceCandidates([]);
  }, [preUpload, postUpload]);

  const validateAndSyncPair = async (
    preMeta: LiveUploadMetadata,
    postMeta: LiveUploadMetadata,
    dates?: { pre?: string; post?: string; area?: string }
  ) => {
    const resolvedPre = (dates?.pre ?? preDate) || toDateInputValue(preMeta.acquisition_date);
    const resolvedPost = (dates?.post ?? postDate) || toDateInputValue(postMeta.acquisition_date);
    const resolvedArea = dates?.area ?? areaName;
    if (resolvedPre && !preDate) setPreDate(resolvedPre);
    if (resolvedPost && !postDate) setPostDate(resolvedPost);

    const validation = await liveInferenceClient.validatePair(preMeta.upload_id, postMeta.upload_id, {
      autoCoregister: true,
      preDate: resolvedPre || undefined,
      postDate: resolvedPost || undefined,
      areaName: resolvedArea || undefined,
    });
    setPairValidation(validation);
    if (validation.compatible_models.length > 0 && !validation.compatible_models.includes(selectedModel)) {
      setSelectedModel(validation.compatible_models[0]);
    }
    return validation;
  };

  const handleUploadFile = async (file: File, role: "pre_fire" | "post_fire") => {
    setErrorMessage(null);
    setBusyMessage(`Inspecting radiometric & CRS metadata for ${file.name}...`);
    setUploadProgress({ role, pct: 5 });
    try {
      const acqDate = role === "pre_fire" ? preDate || undefined : postDate || undefined;
      const meta = await liveInferenceClient.uploadFile(file, role, {
        acquisitionDate: acqDate,
        onProgress: (pct) => setUploadProgress({ role, pct }),
      });

      if (role === "pre_fire") {
        setPreUpload(meta);
        if (meta.acquisition_date && !preDate) setPreDate(toDateInputValue(meta.acquisition_date));
      } else {
        setPostUpload(meta);
        if (meta.acquisition_date && !postDate) setPostDate(toDateInputValue(meta.acquisition_date));
      }
      setPairValidation(null);

      if (!meta.valid_for_sar_inference) {
        const codePrefix = meta.error_code ? `${meta.error_code}: ` : "";
        setErrorMessage(`${codePrefix}${meta.scientific_explanation}`);
        return;
      }

      const nextPre = role === "pre_fire" ? meta : preUpload;
      const nextPost = role === "post_fire" ? meta : postUpload;
      if (nextPre?.valid_for_sar_inference && nextPost?.valid_for_sar_inference) {
        setBusyMessage("Validating spatial overlap, CRS alignment, and acquisition order...");
        await validateAndSyncPair(nextPre, nextPost, {
          pre: role === "pre_fire" ? toDateInputValue(meta.acquisition_date) || preDate : preDate,
          post: role === "post_fire" ? toDateInputValue(meta.acquisition_date) || postDate : postDate,
        });
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadProgress(null);
      setBusyMessage(null);
    }
  };

  const handleDropFile = (e: DragEvent<HTMLDivElement>, role: "pre_fire" | "post_fire") => {
    e.preventDefault();
    setDragTarget(null);
    const f = e.dataTransfer?.files?.[0];
    if (f) void handleUploadFile(f, role);
  };

  const handlePairWithReference = async (cand: LiveReferenceCandidate) => {
    setErrorMessage(null);
    setBusyMessage(`Loading compatible ${cand.role_provided === "pre" ? "Pre-Fire" : "Post-Fire"} dataset acquisition (${cand.event_id})...`);
    try {
      const roleKey = cand.role_provided === "pre" ? "pre_fire" : "post_fire";
      const refMeta = await liveInferenceClient.uploadSample(
        cand.sample_id,
        roleKey,
        cand.acquisition_date ?? undefined
      );
      const nextArea = areaName || cand.title.split("—")[0].trim();
      if (!areaName) setAreaName(nextArea);

      let nextPre = preUpload;
      let nextPost = postUpload;
      let nextPreDate = preDate;
      let nextPostDate = postDate;

      if (cand.role_provided === "pre") {
        setPreUpload(refMeta);
        nextPre = refMeta;
        if (cand.acquisition_date) {
          nextPreDate = toDateInputValue(cand.acquisition_date);
          setPreDate(nextPreDate);
        }
      } else {
        setPostUpload(refMeta);
        nextPost = refMeta;
        if (cand.acquisition_date) {
          nextPostDate = toDateInputValue(cand.acquisition_date);
          setPostDate(nextPostDate);
        }
      }

      if (nextPre?.valid_for_sar_inference && nextPost?.valid_for_sar_inference) {
        await validateAndSyncPair(nextPre, nextPost, {
          pre: nextPreDate,
          post: nextPostDate,
          area: nextArea,
        });
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyMessage(null);
    }
  };

  const handleLoadSamplePair = async (sampleId: string, sampleMeta?: LiveSamplePair) => {
    setErrorMessage(null);
    setBusyMessage(`Loading real Sentinel-1 dataset GeoTIFF pair (${sampleId})...`);
    try {
      const preD = sampleMeta?.pre_date ?? "";
      const postD = sampleMeta?.post_date ?? "";
      const label = sampleMeta ? sampleMeta.title.split("—")[0].trim() : sampleId;
      setAreaName(label);
      setPreDate(toDateInputValue(preD));
      setPostDate(toDateInputValue(postD));

      const preMeta = await liveInferenceClient.uploadSample(sampleId, "pre_fire", preD || undefined);
      const postMeta = await liveInferenceClient.uploadSample(sampleId, "post_fire", postD || undefined);
      setPreUpload(preMeta);
      setPostUpload(postMeta);

      setBusyMessage("Validating spatial overlap and CRS alignment...");
      await validateAndSyncPair(preMeta, postMeta, {
        pre: toDateInputValue(preD) || toDateInputValue(preMeta.acquisition_date),
        post: toDateInputValue(postD) || toDateInputValue(postMeta.acquisition_date),
        area: label,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyMessage(null);
    }
  };

  const handleRevalidatePair = async () => {
    if (!preUpload?.valid_for_sar_inference || !postUpload?.valid_for_sar_inference) return;
    setErrorMessage(null);
    setBusyMessage("Re-validating spatial footprint and acquisition dates...");
    try {
      await validateAndSyncPair(preUpload, postUpload, { pre: preDate, post: postDate, area: areaName });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyMessage(null);
    }
  };

  const dateOrderClientError = Boolean(preDate && postDate && preDate >= postDate);
  const singleStackedUpload =
    (preUpload?.valid_for_sar_inference && preUpload.band_count >= 4) ||
    (postUpload?.valid_for_sar_inference && postUpload.band_count >= 4)
      ? preUpload?.band_count && preUpload.band_count >= 4
        ? preUpload
        : postUpload
      : null;

  const canAnalyze =
    !busyMessage &&
    !dateOrderClientError &&
    Boolean((pairValidation && pairValidation.compatible) || singleStackedUpload);

  const handleRunInference = async () => {
    setErrorMessage(null);
    setBusyMessage(
      runAllModels
        ? "Running UNet_ResNet34 + LightGBM_Pixel_Spatial + Log_Ratio_Baseline + CUSUM_Temporal..."
        : `Running ${selectedModel.toUpperCase()} wildfire inference...`
    );
    try {
      let currentPairId = pairValidation?.pair_id;
      if (preUpload?.valid_for_sar_inference && postUpload?.valid_for_sar_inference && !singleStackedUpload) {
        const freshValidation = await validateAndSyncPair(preUpload, postUpload, {
          pre: preDate,
          post: postDate,
          area: areaName,
        });
        if (!freshValidation.compatible) {
          setErrorMessage(
            freshValidation.reasons.join("; ") || "Before/After GeoTIFF pair failed scientific compatibility checks."
          );
          return;
        }
        currentPairId = freshValidation.pair_id;
      }

      const parsedThresh = customThreshold.trim() ? Number(customThreshold) : null;
      const res = await liveInferenceClient.runAnalysis({
        pair_id: currentPairId,
        upload_id: !currentPairId && singleStackedUpload ? singleStackedUpload.upload_id : undefined,
        model_type: selectedModel,
        threshold: parsedThresh !== null && Number.isFinite(parsedThresh) ? parsedThresh : null,
        run_all_models: runAllModels,
        live_inference: true,
        pre_date: preDate || undefined,
        post_date: postDate || undefined,
        area_name: areaName || undefined,
      });
      setAnalysisResult(res);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyMessage(null);
    }
  };

  const dualPolSamples = (modelsInfo?.sample_uploads ?? []).filter((s) => s.sample_id.endsWith("_DUALPOL"));
  const singleBandSamples = (modelsInfo?.sample_uploads ?? []).filter((s) => s.sample_id.endsWith("_VH_SINGLE"));
  const singleValidUpload =
    (preUpload?.valid_for_sar_inference && !postUpload) || (!preUpload && postUpload?.valid_for_sar_inference)
      ? !singleStackedUpload
        ? preUpload ?? postUpload
        : null
      : null;

  return (
    <Page
      title="Live Fire Analysis"
      description="Upload calibrated Sentinel-1 SAR Before/After imagery or pair a dataset reference, confirm metadata, and run all 4 trained wildfire detection models."
    >
      <div className="space-y-6">
        <SafetyNote />
        <p className="rounded-md border border-border bg-muted/40 p-3 text-xs">
          <strong>Scientific Validation &amp; Evidence Contract:</strong> All segmentation models run live over calibrated SAR backscatter (dB). Ordinary optical RGB images (`.png`, `.jpg`, or `uint8` RGB `.tif`) are explicitly rejected because optical RGB values lack microwave polarization and georeferenced gamma0 backscatter. Missing Before or After acquisitions are never fabricated.
        </p>

        {/* Step 1: Verified Checkpoints Overview */}
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">
                Verified Model Checkpoints ({modelsInfo?.active_run_id ?? "loading..."})
              </h2>
              <p className="text-xs text-muted-foreground">
                Trained on CA_GANN_2026 &amp; calibrated on CA_DOME_2026 (Sentinel-1 C-band RTC 20 m). All 4 models evaluate every validated scene where input contracts are met.
              </p>
            </div>
            <span className="rounded bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {modelsInfo?.data_origin ?? "CROSS_SENSOR_PROTOTYPE"} · Live FastAPI Connected
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {(modelsInfo?.models ?? []).map((m) => (
              <div
                key={m.model_id}
                className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">{m.registry_key}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-medium ${
                      m.status === "READY"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <div className="text-muted-foreground">{m.family}</div>
                <div className="text-[11px]">
                  Threshold: <strong>{m.default_threshold}</strong> · Dual-Pol:{" "}
                  {m.input_contract.requires_dual_pol ? "VV + VH required" : "VH sufficient"}
                </div>
                {m.checkpoint_size_bytes && (
                  <div className="text-[11px] font-mono text-muted-foreground truncate">
                    Checkpoint: {formatBytes(m.checkpoint_size_bytes)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Step 2: Upload Pre/Post SAR GeoTIFFs or Select Reference Dataset */}
        <Card className="p-4 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">1. Upload Pre-Fire &amp; Post-Fire Satellite Acquisitions</h2>
              <p className="text-xs text-muted-foreground">
                Drag and drop Sentinel-1 SAR GeoTIFFs (`.tif` / `.tiff`, up to 250 MB) or multi-band `.npz` stack, or load a real dataset fire below.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="live-studio-load-dualpol"
                onClick={() =>
                  void handleLoadSamplePair(
                    "CA_BUG_2026_DUALPOL",
                    dualPolSamples.find((s) => s.sample_id === "CA_BUG_2026_DUALPOL")
                  )
                }
                disabled={Boolean(busyMessage)}
              >
                <Database className="mr-1.5 size-3.5" aria-hidden="true" />
                Load CA_BUG_2026 Dual-Pol Pair
              </Button>
              {dualPolSamples
                .filter((s) => s.sample_id !== "CA_BUG_2026_DUALPOL")
                .map((s) => (
                  <Button
                    key={s.sample_id}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleLoadSamplePair(s.sample_id, s)}
                    disabled={Boolean(busyMessage)}
                  >
                    {s.event_id} Dual-Pol
                  </Button>
                ))}
              {singleBandSamples.slice(0, 2).map((s) => (
                <Button
                  key={s.sample_id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleLoadSamplePair(s.sample_id, s)}
                  disabled={Boolean(busyMessage)}
                >
                  {s.event_id} VH
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                {
                  roleKey: "pre_fire" as const,
                  title: "Pre-Fire Baseline Acquisition (Before)",
                  meta: preUpload,
                  inputRef: preInputRef,
                  testId: "live-pre-upload-input",
                  accent: "text-sky-600 dark:text-sky-400",
                },
                {
                  roleKey: "post_fire" as const,
                  title: "Post-Fire Target Acquisition (After)",
                  meta: postUpload,
                  inputRef: postInputRef,
                  testId: "live-post-upload-input",
                  accent: "text-orange-600 dark:text-orange-400",
                },
              ] as const
            ).map((slot) => {
              const isDragging = dragTarget === slot.roleKey;
              const isUploadingThis = uploadProgress?.role === slot.roleKey;
              return (
                <div
                  key={slot.roleKey}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragTarget(slot.roleKey);
                  }}
                  onDragLeave={() => setDragTarget((prev) => (prev === slot.roleKey ? null : prev))}
                  onDrop={(e) => handleDropFile(e, slot.roleKey)}
                  className={`rounded-xl border-2 border-dashed p-4 transition-colors space-y-3 ${
                    isDragging
                      ? "border-primary bg-primary/10"
                      : slot.meta?.valid_for_sar_inference
                        ? "border-emerald-500/60 bg-emerald-500/5"
                        : slot.meta && !slot.meta.valid_for_sar_inference
                          ? "border-destructive bg-destructive/5"
                          : "border-border bg-muted/20 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className={`text-sm font-semibold ${slot.accent}`}>{slot.title}</div>
                      <p className="text-[11px] text-muted-foreground">
                        Drop `.tif`, `.tiff`, or `.npz` here — or choose from disk
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => slot.inputRef.current?.click()}
                      disabled={Boolean(busyMessage)}
                    >
                      <UploadCloud className="mr-1.5 size-3.5" aria-hidden="true" />
                      Browse File
                    </Button>
                  </div>

                  <input
                    ref={slot.inputRef}
                    data-testid={slot.testId}
                    type="file"
                    accept=".tif,.tiff,.npz,.png,.jpg,.jpeg"
                    aria-label={slot.title}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadFile(f, slot.roleKey);
                    }}
                    className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-primary/10 file:px-2.5 file:py-1 file:text-xs file:font-medium"
                  />

                  {isUploadingThis && uploadProgress && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-medium">
                        <span>Uploading satellite raster...</span>
                        <span>{uploadProgress.pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-150"
                          style={{ width: `${uploadProgress.pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {slot.meta && (
                    <div className="rounded-lg border border-border bg-background/85 p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-medium truncate">{slot.meta.filename}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            slot.meta.valid_for_sar_inference
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {slot.meta.valid_for_sar_inference ? (
                            <>
                              <CheckCircle2 className="size-3" aria-hidden="true" /> VALID SAR
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="size-3" aria-hidden="true" /> {slot.meta.error_code ?? "REJECTED"}
                            </>
                          )}
                        </span>
                      </div>

                      {slot.meta.preview_url && slot.meta.valid_for_sar_inference && (
                        <div className="h-36 w-full overflow-hidden rounded border border-border bg-black/90 flex items-center justify-center">
                          <img
                            src={slot.meta.preview_url}
                            alt={`${slot.title} Quicklook Preview`}
                            className="max-h-full w-full object-contain"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                        <span>Format: {slot.meta.file_format}</span>
                        <span>Size: {formatBytes(slot.meta.file_size_bytes)}</span>
                        <span>CRS: {slot.meta.crs ?? "Missing"}</span>
                        <span>
                          Grid: {slot.meta.width}×{slot.meta.height} px
                        </span>
                        <span>Pols: {slot.meta.polarizations.join("+") || "None"}</span>
                        <span>
                          Res: {slot.meta.resolution_m != null ? `${slot.meta.resolution_m} m` : "—"} · Valid:{" "}
                          {slot.meta.valid_pixel_percentage}%
                        </span>
                      </div>

                      {!slot.meta.valid_for_sar_inference && (
                        <p className="text-[11px] text-destructive leading-snug">
                          {slot.meta.scientific_explanation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Single-Image Recovery Workflow */}
          {singleValidUpload && (
            <div
              data-testid="single-image-recovery-panel"
              className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-3.5 text-xs space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  <Sparkles className="size-4 text-amber-600" aria-hidden="true" />
                  Missing Counterpart Acquisition ({!preUpload ? "Pre-Fire Before Image" : "Post-Fire After Image"})
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Temporal wildfire detection requires both Before and After observations (never synthesized).
                </span>
              </div>
              <p>
                Upload a matching SAR GeoTIFF in the empty slot above, OR pair{" "}
                <strong>{singleValidUpload.filename}</strong> with a compatible dataset acquisition on disk:
              </p>

              {loadingRefs ? (
                <div className="text-muted-foreground">Searching dataset catalog for overlapping SAR acquisitions...</div>
              ) : referenceCandidates.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {referenceCandidates.slice(0, 4).map((cand) => (
                    <div
                      key={`${cand.sample_id}-${cand.role_provided}`}
                      className="flex items-center justify-between gap-2 rounded border border-border bg-background/90 p-2.5"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-medium truncate">{cand.title}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Date: {cand.acquisition_date ?? "—"} · Overlap: {cand.overlap_percent.toFixed(1)}% ·{" "}
                          {cand.polarizations.join("+")}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{cand.compatibility_note}</div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={cand.recommended ? "primary" : "secondary"}
                        disabled={!cand.recommended || Boolean(busyMessage)}
                        onClick={() => void handlePairWithReference(cand)}
                      >
                        Pair {cand.role_provided === "pre" ? "Pre" : "Post"}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Please upload the matching counterpart GeoTIFF manually (no compatible local catalog match queried).
                </p>
              )}
            </div>
          )}

          {/* Step 2b: Confirm Area & Dates + Analysis Settings + ONE Analyze Fire CTA */}
          <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">2. Confirm Area, Acquisition Dates &amp; Execute Multi-Model Analysis</h3>
              {pairValidation && (
                <div
                  data-testid="live-pair-validation"
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                    pairValidation.compatible
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  <span>
                    Pair {pairValidation.compatible ? "SUITABLE" : "UNSUITABLE"} ({pairValidation.pair_id}) · Overlap:{" "}
                    {pairValidation.checks?.spatial_overlap_percent ?? 0}% · CRS:{" "}
                    {pairValidation.checks?.crs_match ? "Matched" : "Co-registered"}
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-xs space-y-1">
                <span className="font-medium block">Geographical Area Label</span>
                <input
                  type="text"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  placeholder="e.g. Park Fire (Butte County, CA)"
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs"
                />
              </label>

              <label className="text-xs space-y-1">
                <span className="font-medium block">Pre-Fire Date (Before)</span>
                <input
                  type="date"
                  value={preDate}
                  onChange={(e) => setPreDate(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs"
                />
              </label>

              <label className="text-xs space-y-1">
                <span className="font-medium block">Post-Fire Date (After)</span>
                <input
                  type="date"
                  value={postDate}
                  onChange={(e) => setPostDate(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs"
                />
              </label>

              <label className="text-xs space-y-1">
                <span className="font-medium block">Primary Map Model</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="unet">UNet_ResNet34 (Primary)</option>
                  <option value="lightgbm">LightGBM_Pixel_Spatial</option>
                  <option value="log_ratio">Log_Ratio_Baseline</option>
                  <option value="cusum">CUSUM_Temporal</option>
                </select>
              </label>

              <label className="text-xs space-y-1">
                <span className="font-medium block">Optional Threshold Override</span>
                <input
                  type="number"
                  step="0.01"
                  value={customThreshold}
                  onChange={(e) => setCustomThreshold(e.target.value)}
                  placeholder="Model default"
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs"
                />
              </label>
            </div>

            {dateOrderClientError && (
              <div role="alert" className="rounded border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
                DATE_ORDER_INVALID: Pre-Fire acquisition date ({preDate}) must be earlier than Post-Fire acquisition date ({postDate}).
              </div>
            )}

            {pairValidation && !pairValidation.compatible && (
              <div role="alert" className="rounded border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Pair Incompatible: {pairValidation.reasons.join("; ")}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={runAllModels}
                    onChange={(e) => setRunAllModels(e.target.checked)}
                  />
                  <span>Execute &amp; Compare All 4 Trained Models</span>
                </label>
                {preUpload?.valid_for_sar_inference && postUpload?.valid_for_sar_inference && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleRevalidatePair()}
                    disabled={Boolean(busyMessage)}
                  >
                    Re-validate Pair
                  </Button>
                )}
              </div>

              <Button
                type="button"
                size="lg"
                data-testid="live-run-inference-btn"
                disabled={!canAnalyze}
                onClick={() => void handleRunInference()}
                className="font-semibold shadow-sm"
              >
                <Flame className="mr-1.5 size-4" aria-hidden="true" />
                {busyMessage ? "Analyzing Satellite Scene..." : "Analyze Fire"}
              </Button>
            </div>
          </div>

          {busyMessage && (
            <div
              role="status"
              className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary"
            >
              {busyMessage}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
            >
              {errorMessage}
            </div>
          )}
        </Card>

        {/* Step 3: Quantitative KPIs, Interactive Before/After Suite, 4-Model Dashboard & Exports */}
        {analysisResult && (
          <div className="space-y-6" data-testid="live-analysis-output">
            <Card className="p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">
                    Wildfire Analysis Results — {analysisResult.model_name}
                  </h2>
                  <p className="text-xs text-muted-foreground">{analysisResult.summary}</p>
                </div>
                <span className="rounded bg-muted px-2.5 py-1 text-xs font-mono">
                  {analysisResult.analysis_id} · {analysisResult.execution_time_sec.toFixed(2)}s
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Estimated Burned Area</div>
                  <div className="text-xl font-bold">{analysisResult.area_statistics.burned_area_km2.toFixed(2)} km²</div>
                  <div className="text-xs text-muted-foreground">
                    {analysisResult.area_statistics.burned_area_ha.toFixed(1)} ha ·{" "}
                    {analysisResult.area_statistics.burned_area_acres.toFixed(0)} acres (
                    {analysisResult.area_statistics.burned_percentage_of_valid.toFixed(2)}% of valid)
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Before → After SAR Backscatter (ΔVH)</div>
                  <div className="text-xl font-bold">
                    {analysisResult.before_after_radiometry.mean_delta_vh_burned_db.toFixed(2)} dB
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Scene Pre {analysisResult.before_after_radiometry.mean_pre_vh_db.toFixed(2)} dB → Post{" "}
                    {analysisResult.before_after_radiometry.mean_post_vh_db.toFixed(2)} dB
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Confidence &amp; Vector Polygons</div>
                  <div className="text-xl font-bold">
                    P95: {(analysisResult.before_after_radiometry.p95_burn_probability * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {analysisResult.burned_polygons_feature_count} GeoJSON polygons · Threshold{" "}
                    {analysisResult.threshold_used}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Spatial Grid &amp; Dates</div>
                  <div className="text-sm font-semibold">{analysisResult.spatial_metadata.crs}</div>
                  <div className="text-xs text-muted-foreground">
                    {analysisResult.spatial_metadata.width}×{analysisResult.spatial_metadata.height} @{" "}
                    {analysisResult.spatial_metadata.resolution_m} m
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {analysisResult.spatial_metadata.pre_date} → {analysisResult.spatial_metadata.post_date}
                  </div>
                </div>
              </div>
            </Card>

            <BeforeAfterComparePanel
              result={analysisResult}
              prePreviewUrl={preUpload?.preview_url}
              postPreviewUrl={postUpload?.preview_url}
            />

            <MultiModelDashboard result={analysisResult} />

            {/* Geospatial Downloads */}
            <Card className="p-4 space-y-2.5">
              <h3 className="text-sm font-semibold">Geospatial Exports (CRS-Preserved GeoTIFF &amp; GeoJSON)</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <a
                  href={analysisResult.downloads.burn_probability_tif}
                  download
                  className="rounded border border-border bg-muted/40 px-3 py-1.5 font-medium hover:bg-muted"
                >
                  Download Burn Probability (.tif)
                </a>
                <a
                  href={analysisResult.downloads.predicted_burn_mask_tif}
                  download
                  className="rounded border border-border bg-muted/40 px-3 py-1.5 font-medium hover:bg-muted"
                >
                  Download Burn Mask (.tif)
                </a>
                <a
                  href={analysisResult.downloads.delta_vh_db_tif}
                  download
                  className="rounded border border-border bg-muted/40 px-3 py-1.5 font-medium hover:bg-muted"
                >
                  Download ΔVH Radiometry (.tif)
                </a>
                {analysisResult.downloads.model_consensus_tif && (
                  <a
                    href={analysisResult.downloads.model_consensus_tif}
                    download
                    className="rounded border border-border bg-muted/40 px-3 py-1.5 font-medium hover:bg-muted"
                  >
                    Download Multi-Model Consensus (.tif)
                  </a>
                )}
                <a
                  href={analysisResult.downloads.burned_polygons_geojson}
                  download
                  className="rounded border border-border bg-muted/40 px-3 py-1.5 font-medium hover:bg-muted"
                >
                  Download Burned Polygons GeoJSON ({analysisResult.burned_polygons_feature_count} features)
                </a>
                <a
                  href={analysisResult.downloads.metadata_json}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-border bg-muted/40 px-3 py-1.5 font-medium hover:bg-muted"
                >
                  Inspect Full Result JSON
                </a>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Page>
  );
}
