/**
 * Multi-Model Wildfire SAR Analysis & Cross-Model Comparison Dashboard.
 * Connects UNet_ResNet34, LightGBM_Pixel_Spatial, Log_Ratio_Baseline, and CUSUM_Temporal:
 * - Status badge (`COMPLETED` or `UNAVAILABLE` with explicit scientific contract reason)
 * - Burned area (km², ha, %), Mean probability, Detected change regions, Spatial agreement / IoU
 * - Per-model probability & binary mask prediction visualizations
 * - Quantitative comparison bars & reference evaluation metrics (when Sentinel-2 dNBR / MCD64A1 exists)
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LiveAnalysisResult, LiveModelComparisonEntry } from "@/data/http/liveInferenceClient";

const CANONICAL_ORDER = ["unet", "lightgbm", "log_ratio", "cusum"];

export interface MultiModelDashboardProps {
  result: LiveAnalysisResult;
}

export function MultiModelDashboard({ result }: MultiModelDashboardProps) {
  const [layerKind, setLayerKind] = useState<"probability" | "mask">("probability");

  const entries: LiveModelComparisonEntry[] = CANONICAL_ORDER.map((id) => result.model_comparison[id]).filter(
    (item): item is LiveModelComparisonEntry => Boolean(item)
  );
  // Append any extra key if present
  for (const [k, v] of Object.entries(result.model_comparison)) {
    if (!CANONICAL_ORDER.includes(k)) entries.push(v);
  }

  const maxAreaKm2 = Math.max(0.01, ...entries.map((e) => e.burned_area_km2 || 0));
  const hasAnyRefMetrics = entries.some((e) => Boolean(e.metrics_vs_sentinel2_dnbr));

  return (
    <Card className="p-4 space-y-5" data-testid="multi-model-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Multi-Model SAR Inference & Prediction Comparison</h3>
          <p className="text-xs text-muted-foreground">
            Per-model burned area, burn probability, connected change regions, execution status, and cross-model differences.
          </p>
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Per-model visual layer type">
          <Button
            type="button"
            size="sm"
            variant={layerKind === "probability" ? "primary" : "secondary"}
            className="h-7 px-2.5 text-xs"
            onClick={() => setLayerKind("probability")}
          >
            Probability Heatmaps
          </Button>
          <Button
            type="button"
            size="sm"
            variant={layerKind === "mask" ? "primary" : "secondary"}
            className="h-7 px-2.5 text-xs"
            onClick={() => setLayerKind("mask")}
          >
            Binary Burn Masks
          </Button>
        </div>
      </div>

      {/* Per-Model Cards with Prediction Visualizations */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {entries.map((m) => {
          const isCompleted = (m.status ?? "COMPLETED") === "COMPLETED";
          const isPrimary = m.model_id === result.model_type;
          const imgUrl = layerKind === "mask" ? m.mask_png : m.probability_png;
          const seg = m.metrics_vs_sentinel2_dnbr;

          return (
            <div
              key={m.model_id}
              data-testid={`model-card-${m.model_id}`}
              className={`flex flex-col justify-between rounded-lg border p-3 text-xs space-y-2.5 ${
                isPrimary ? "border-primary bg-primary/5" : "border-border bg-muted/20"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm leading-tight">{m.registry_name}</span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      isCompleted
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                    }`}
                  >
                    {m.status ?? "COMPLETED"}
                  </span>
                </div>
                {isPrimary && (
                  <p className="text-[11px] font-medium text-primary">Primary Active Model (Threshold {m.threshold})</p>
                )}
              </div>

              {isCompleted ? (
                <>
                  {imgUrl ? (
                    <div className="h-40 w-full overflow-hidden rounded border border-border bg-black/90 flex items-center justify-center">
                      <img
                        src={imgUrl}
                        alt={`${m.registry_name} ${layerKind === "mask" ? "Burn Mask" : "Burn Probability"}`}
                        className="max-h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-24 flex items-center justify-center rounded border border-dashed border-border text-muted-foreground">
                      Raster visualization pending
                    </div>
                  )}

                  <dl className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Burned Area</dt>
                      <dd className="font-semibold">{m.burned_area_km2.toFixed(2)} km²</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Mean Prob.</dt>
                      <dd className="font-semibold">
                        {m.mean_probability != null ? `${(m.mean_probability * 100).toFixed(1)}%` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Change Regions</dt>
                      <dd className="font-semibold">{m.detected_regions_count ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Runtime</dt>
                      <dd className="font-semibold">{m.execution_time_sec.toFixed(2)}s</dd>
                    </div>
                  </dl>

                  {seg && (
                    <div className="rounded bg-background/70 p-2 text-[11px] border border-border/70">
                      <div className="font-medium mb-0.5">vs. Sentinel-2 dNBR Ref.</div>
                      <div>
                        F1: <strong>{seg.f1_score.toFixed(3)}</strong> · IoU: <strong>{seg.iou.toFixed(3)}</strong>
                        {seg.roc_auc != null ? ` · AUC: ${seg.roc_auc.toFixed(3)}` : ""}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed">
                  <strong>Model Not Executed:</strong>{" "}
                  {m.status_reason ?? "Input acquisitions do not satisfy this model's temporal or polarization contract."}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Burned Area Comparison Bars */}
      <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold">Cross-Model Burned Area Estimate Comparison (km²)</span>
          <span className="text-muted-foreground">Agreement & Area Delta reported vs. {result.model_name}</span>
        </div>
        <div className="space-y-2">
          {entries.map((m) => {
            const isCompleted = (m.status ?? "COMPLETED") === "COMPLETED";
            const pctWidth = isCompleted ? Math.min(100, Math.max(2, (m.burned_area_km2 / maxAreaKm2) * 100)) : 0;
            return (
              <div key={m.model_id} className="grid grid-cols-12 items-center gap-2 text-xs">
                <div className="col-span-4 sm:col-span-3 font-medium truncate">{m.registry_name}</div>
                <div className="col-span-5 sm:col-span-6 h-3 rounded-full bg-muted overflow-hidden">
                  {isCompleted && (
                    <div
                      className={`h-full rounded-full ${
                        m.model_id === result.model_type ? "bg-primary" : "bg-orange-500/80"
                      }`}
                      style={{ width: `${pctWidth}%` }}
                    />
                  )}
                </div>
                <div className="col-span-3 text-right font-mono text-[11px]">
                  {isCompleted ? (
                    <>
                      {m.burned_area_km2.toFixed(2)} km²
                      {m.delta_area_vs_primary_km2 != null && m.model_id !== result.model_type
                        ? ` (${m.delta_area_vs_primary_km2 >= 0 ? "+" : ""}${m.delta_area_vs_primary_km2.toFixed(2)})`
                        : ""}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Unavailable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Differences & Evaluation Metrics Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Model</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Threshold</th>
              <th className="py-2 pr-3 font-medium">Burned Area</th>
              <th className="py-2 pr-3 font-medium">Mean Prob.</th>
              <th className="py-2 pr-3 font-medium">Regions</th>
              <th className="py-2 pr-3 font-medium">Agreement vs Primary</th>
              <th className="py-2 pr-3 font-medium">IoU vs Primary</th>
              {hasAnyRefMetrics && <th className="py-2 pr-3 font-medium">Ref. F1 / IoU (dNBR)</th>}
              <th className="py-2 font-medium">Runtime</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((m) => {
              const isCompleted = (m.status ?? "COMPLETED") === "COMPLETED";
              const seg = m.metrics_vs_sentinel2_dnbr;
              return (
                <tr key={m.model_id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{m.registry_name}</td>
                  <td className="py-2 pr-3">{m.status ?? "COMPLETED"}</td>
                  <td className="py-2 pr-3 font-mono">{m.threshold ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {isCompleted ? `${m.burned_area_km2.toFixed(2)} km² (${m.burned_percentage.toFixed(1)}%)` : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {isCompleted && m.mean_probability != null ? `${(m.mean_probability * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 pr-3">{isCompleted ? (m.detected_regions_count ?? "—") : "—"}</td>
                  <td className="py-2 pr-3">
                    {isCompleted && m.agreement_with_primary_percent != null
                      ? `${m.agreement_with_primary_percent.toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {isCompleted && m.iou_vs_primary != null ? m.iou_vs_primary.toFixed(3) : "—"}
                  </td>
                  {hasAnyRefMetrics && (
                    <td className="py-2 pr-3">
                      {seg ? `${seg.f1_score.toFixed(3)} / ${seg.iou.toFixed(3)}` : "—"}
                    </td>
                  )}
                  <td className="py-2 font-mono">{isCompleted ? `${m.execution_time_sec.toFixed(2)}s` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
