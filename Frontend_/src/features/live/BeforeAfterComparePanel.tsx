/**
 * Synchronized Before vs. After SAR Visualization Suite:
 * 1. Side-by-Side Synchronized View (Pre-Fire, Post-Fire, Delta-VH / Difference, Burn Probability)
 * 2. Interactive Swipe Slider (Pre vs Post / Probability / Change Heatmap / Consensus)
 * 3. Change Detection & Multi-Model Consensus View
 * 4. Interactive MapLibre GeoTIFF + Polygon Burn Map (`BurnAnalysisMap`)
 * 5. Full 6-Panel Scientific Figure Overview
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LiveAnalysisResult } from "@/data/http/liveInferenceClient";
import { BurnAnalysisMap, type BurnMapOverlayOption } from "./BurnAnalysisMap";

type CompareMode = "side_by_side" | "swipe" | "difference" | "map" | "overview";
type SwipeTarget = "post" | "probability" | "difference" | "consensus";

export interface BeforeAfterComparePanelProps {
  result: LiveAnalysisResult;
  prePreviewUrl?: string | null;
  postPreviewUrl?: string | null;
}

export function BeforeAfterComparePanel({
  result,
  prePreviewUrl,
  postPreviewUrl,
}: BeforeAfterComparePanelProps) {
  const [compareMode, setCompareMode] = useState<CompareMode>("side_by_side");
  const [swipePercent, setSwipePercent] = useState(50);
  const [swipeTarget, setSwipeTarget] = useState<SwipeTarget>("post");
  const [activeMapOverlay, setActiveMapOverlay] = useState<string>("burn_probability");
  const [mapOpacity, setMapOpacity] = useState<number>(0.85);
  const [showPolygons, setShowPolygons] = useState<boolean>(true);
  const [linkedZoom, setLinkedZoom] = useState<number>(1);

  const preUrl = result.layers.pre_fire_vh_db;
  const postUrl = result.layers.post_fire_vh_db;
  const swipeRightMap: Record<SwipeTarget, { label: string; alt: string; url: string }> = {
    post: {
      label: `Post-Fire (${result.spatial_metadata.post_date})`,
      alt: "Post-Fire VH Overlay",
      url: postUrl,
    },
    probability: {
      label: `Burn Probability (${result.model_name})`,
      alt: "Burn Probability Overlay",
      url: result.layers.burn_probability,
    },
    difference: {
      label: "Backscatter Change Heatmap (ΔVH)",
      alt: "Difference Heatmap Overlay",
      url: result.layers.difference_heatmap,
    },
    consensus: {
      label: "Multi-Model Agreement Consensus",
      alt: "Multi-Model Consensus Overlay",
      url: result.layers.model_consensus ?? result.layers.predicted_burn_mask,
    },
  };
  const swipeRight = swipeRightMap[swipeTarget];

  const mapOverlays: BurnMapOverlayOption[] = [
    { id: "burn_probability", label: "Burn Probability", url: result.layers.burn_probability },
    { id: "predicted_burn_mask", label: "Burn Mask", url: result.layers.predicted_burn_mask },
    ...(result.layers.model_consensus
      ? [{ id: "model_consensus", label: "Model Consensus", url: result.layers.model_consensus }]
      : []),
    { id: "difference_heatmap", label: "ΔVH Heatmap", url: result.layers.difference_heatmap },
    { id: "delta_vh_db", label: "Signed ΔVH (dB)", url: result.layers.delta_vh_db },
    { id: "pre_fire_vh_db", label: "Pre-Fire VH", url: result.layers.pre_fire_vh_db },
    { id: "post_fire_vh_db", label: "Post-Fire VH", url: result.layers.post_fire_vh_db },
  ];

  const modes: Array<{ id: CompareMode; label: string }> = [
    { id: "side_by_side", label: "Side-by-Side Sync" },
    { id: "swipe", label: "Before/After Swipe" },
    { id: "difference", label: "Change & Consensus" },
    { id: "map", label: "Interactive Burn Map" },
    { id: "overview", label: "6-Panel Scientific Overview" },
  ];

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Before vs. After SAR Comparison & Change Visualization</h3>
          <p className="text-xs text-muted-foreground">
            {result.spatial_metadata.area_name ? `${result.spatial_metadata.area_name} · ` : ""}
            Pre-Fire: {result.spatial_metadata.pre_date} vs. Post-Fire: {result.spatial_metadata.post_date} ·{" "}
            {result.spatial_metadata.crs} ({result.spatial_metadata.resolution_m} m/px)
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Before and after comparison modes">
          {modes.map((m) => (
            <Button
              key={m.id}
              type="button"
              aria-pressed={compareMode === m.id}
              size="sm"
              variant={compareMode === m.id ? "primary" : "secondary"}
              onClick={() => setCompareMode(m.id)}
            >
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      {compareMode === "side_by_side" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs">
            <span>
              Synchronized panels ({result.spatial_metadata.width}×{result.spatial_metadata.height} px) · Pre μ ={" "}
              {result.before_after_radiometry.mean_pre_vh_db.toFixed(2)} dB → Post μ ={" "}
              {result.before_after_radiometry.mean_post_vh_db.toFixed(2)} dB
            </span>
            <label className="flex items-center gap-2 font-medium">
              <span>Sync Zoom: {linkedZoom.toFixed(1)}×</span>
              <input
                type="range"
                min={1}
                max={2.4}
                step={0.2}
                value={linkedZoom}
                onChange={(e) => setLinkedZoom(Number(e.target.value))}
                aria-label="Synchronized panel zoom"
                className="w-24 accent-primary"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <figure className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>1. Before (Pre-Fire VH dB)</span>
                <span className="text-muted-foreground">{result.spatial_metadata.pre_date}</span>
              </div>
              <div className="h-56 overflow-hidden rounded border border-border bg-black/90 flex items-center justify-center">
                <img
                  src={preUrl || prePreviewUrl || ""}
                  alt="Pre-Fire VH Backscatter"
                  className="max-h-full w-full object-contain transition-transform duration-150"
                  style={{ transform: `scale(${linkedZoom})` }}
                />
              </div>
            </figure>

            <figure className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>2. After (Post-Fire VH dB)</span>
                <span className="text-muted-foreground">{result.spatial_metadata.post_date}</span>
              </div>
              <div className="h-56 overflow-hidden rounded border border-border bg-black/90 flex items-center justify-center">
                <img
                  src={postUrl || postPreviewUrl || ""}
                  alt="Post-Fire VH Backscatter"
                  className="max-h-full w-full object-contain transition-transform duration-150"
                  style={{ transform: `scale(${linkedZoom})` }}
                />
              </div>
            </figure>

            <figure className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>3. ΔVH Change Heatmap</span>
                <span className="text-muted-foreground">
                  {result.before_after_radiometry.mean_delta_vh_db.toFixed(2)} dB
                </span>
              </div>
              <div className="h-56 overflow-hidden rounded border border-border bg-black/90 flex items-center justify-center">
                <img
                  src={result.layers.difference_heatmap}
                  alt="SAR Backscatter Difference Heatmap"
                  className="max-h-full w-full object-contain transition-transform duration-150"
                  style={{ transform: `scale(${linkedZoom})` }}
                />
              </div>
            </figure>

            <figure className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>4. Burn Probability ({result.model_type.toUpperCase()})</span>
                <span className="text-muted-foreground">P95: {result.before_after_radiometry.p95_burn_probability.toFixed(2)}</span>
              </div>
              <div className="h-56 overflow-hidden rounded border border-border bg-black/90 flex items-center justify-center">
                <img
                  src={result.layers.burn_probability}
                  alt="Predicted Burn Probability Map"
                  className="max-h-full w-full object-contain transition-transform duration-150"
                  style={{ transform: `scale(${linkedZoom})` }}
                />
              </div>
            </figure>
          </div>
        </div>
      )}

      {compareMode === "swipe" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Right swipe layer">
              {(["post", "probability", "difference", "consensus"] as SwipeTarget[]).map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={swipeTarget === t ? "primary" : "secondary"}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setSwipeTarget(t)}
                >
                  {t === "post"
                    ? "Post-Fire VH"
                    : t === "probability"
                      ? "Burn Probability"
                      : t === "difference"
                        ? "ΔVH Change"
                        : "Model Consensus"}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2 font-medium">
              <span>Pre ← {swipePercent}% → Comparison</span>
              <input
                type="range"
                min={0}
                max={100}
                value={swipePercent}
                onChange={(e) => setSwipePercent(Number(e.target.value))}
                aria-label="Before and After wipe slider"
                className="w-40 accent-primary"
              />
            </label>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Left: Pre-Fire ({result.spatial_metadata.pre_date})</span>
            <span>Right: {swipeRight.label}</span>
          </div>

          <div className="relative mx-auto h-96 w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-black/95 select-none">
            <img
              src={preUrl}
              alt="Pre-Fire VH Overlay"
              className="absolute inset-0 h-full w-full object-contain"
            />
            <div
              className="absolute inset-0 h-full w-full overflow-hidden"
              style={{ clipPath: `inset(0 0 0 ${swipePercent}%)` }}
            >
              <img
                src={swipeRight.url}
                alt={swipeRight.alt}
                className="h-full w-full object-contain"
              />
            </div>
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow"
              style={{ left: `${swipePercent}%` }}
            >
              <div className="absolute top-1/2 -left-3 -translate-y-1/2 rounded-full border border-white bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
                ⇄
              </div>
            </div>
          </div>
        </div>
      )}

      {compareMode === "difference" && (
        <div className="grid gap-3 md:grid-cols-3">
          <figure className="space-y-1.5 rounded-lg border border-border p-2">
            <figcaption className="text-xs font-medium">Signed ΔVH (Post − Pre, dB)</figcaption>
            <img
              src={result.layers.delta_vh_db}
              alt="Signed Delta VH Backscatter Change"
              className="h-60 w-full rounded bg-black/90 object-contain"
            />
            <p className="text-[11px] text-muted-foreground">
              Negative shifts (blue) indicate structural canopy/vegetation backscatter loss.
            </p>
          </figure>
          <figure className="space-y-1.5 rounded-lg border border-border p-2">
            <figcaption className="text-xs font-medium">Burned Candidate Mask ({result.model_name})</figcaption>
            <img
              src={result.layers.predicted_burn_mask}
              alt="Predicted Burn Mask Overlay"
              className="h-60 w-full rounded bg-black/90 object-contain"
            />
            <p className="text-[11px] text-muted-foreground">
              Threshold {result.threshold_used} · {result.area_statistics.burned_area_km2.toFixed(2)} km² flagged.
            </p>
          </figure>
          <figure className="space-y-1.5 rounded-lg border border-border p-2">
            <figcaption className="text-xs font-medium">Multi-Model Consensus Heatmap</figcaption>
            <img
              src={result.layers.model_consensus ?? result.layers.burn_probability}
              alt="Multi-Model Agreement Consensus Heatmap"
              className="h-60 w-full rounded bg-black/90 object-contain"
            />
            <p className="text-[11px] text-muted-foreground">
              Brighter yellow/orange regions reflect stronger multi-model spatial agreement.
            </p>
          </figure>
        </div>
      )}

      {compareMode === "map" && (
        <BurnAnalysisMap
          boundsWgs84={result.spatial_metadata.bounds_wgs84}
          overlayOptions={mapOverlays}
          activeOverlayId={activeMapOverlay}
          onOverlayChange={setActiveMapOverlay}
          overlayOpacity={mapOpacity}
          onOpacityChange={setMapOpacity}
          showPolygons={showPolygons}
          onTogglePolygons={setShowPolygons}
          geojsonUrl={result.downloads.burned_polygons_geojson}
          geojsonFeatureCount={result.burned_polygons_feature_count}
        />
      )}

      {compareMode === "overview" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Server-rendered 6-panel Before/After + Prediction overview generated from this SAR acquisition pair.
          </p>
          <img
            src={result.layers.overview_png}
            alt="6-Panel SAR Wildfire Overview"
            className="w-full rounded border border-border object-contain"
          />
        </div>
      )}
    </Card>
  );
}
