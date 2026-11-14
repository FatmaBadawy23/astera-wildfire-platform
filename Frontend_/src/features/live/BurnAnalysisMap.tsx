/**
 * Interactive Georeferenced Wildfire Burn Analysis Map.
 * - Basemap: local Natural Earth vector countries + shaded relief raster (`mapStyle.ts`).
 * - Overlays: georeferenced PNG raster image source (burn probability, delta-VH, predicted mask,
 *   multi-model consensus, pre-fire / post-fire SAR) pinned strictly to `bounds_wgs84`.
 * - Vector Polygons: GeoJSON detected burned-area candidate perimeters (`burned_polygons.geojson`).
 * - Falls back cleanly in headless / non-WebGL browsers with spatial bounds & image preview.
 */
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, ImageSource, Map as MLMap } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { Minus, Plus, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COUNTRIES_URL_PATH,
  EMPTY_FC,
  RELIEF_TILES_URL_PATH,
  buildStyle,
  readMapColors,
} from "@/features/explorer/mapStyle";

maplibregl.setWorkerUrl(workerUrl);

export interface BurnMapOverlayOption {
  id: string;
  label: string;
  url: string;
}

export interface BurnAnalysisMapProps {
  boundsWgs84?: [number, number, number, number] | null;
  overlayOptions: BurnMapOverlayOption[];
  activeOverlayId: string;
  onOverlayChange: (id: string) => void;
  overlayOpacity: number;
  onOpacityChange: (opacity: number) => void;
  showPolygons: boolean;
  onTogglePolygons: (show: boolean) => void;
  geojsonUrl: string;
  geojsonFeatureCount: number;
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function toImageCoordinates(b: [number, number, number, number]): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  const [west, south, east, north] = b;
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

export function BurnAnalysisMap({
  boundsWgs84,
  overlayOptions,
  activeOverlayId,
  onOverlayChange,
  overlayOpacity,
  onOpacityChange,
  showPolygons,
  onTogglePolygons,
  geojsonUrl,
  geojsonFeatureCount,
}: BurnAnalysisMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [webglSupported] = useState(() => webglAvailable());
  const [mapFailed, setMapFailed] = useState(false);
  const [geojsonCountLoaded, setGeojsonCountLoaded] = useState<number | null>(null);

  const activeOverlay = overlayOptions.find((o) => o.id === activeOverlayId) ?? overlayOptions[0];
  const effectiveBounds: [number, number, number, number] =
    boundsWgs84 && boundsWgs84.length === 4 ? boundsWgs84 : [-122.0, 39.8, -121.6, 40.2];

  // Fetch GeoJSON polygon count & geometry to verify vector availability and attach source
  const [geojsonData, setGeojsonData] = useState<unknown>(EMPTY_FC);
  useEffect(() => {
    let active = true;
    fetch(geojsonUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setGeojsonData(data);
        setGeojsonCountLoaded(Array.isArray(data.features) ? data.features.length : 0);
      })
      .catch(() => {
        // Keep empty feature collection cleanly
      });
    return () => {
      active = false;
    };
  }, [geojsonUrl]);

  // Initialize MapLibre instance
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !webglSupported) return;

    let map: MLMap;
    try {
      const [w, s, e, n] = effectiveBounds;
      map = new maplibregl.Map({
        container,
        style: buildStyle(
          readMapColors(),
          new URL(`${import.meta.env.BASE_URL}${COUNTRIES_URL_PATH}`, window.location.origin).href,
          14,
          14,
          `${window.location.origin}${import.meta.env.BASE_URL}${RELIEF_TILES_URL_PATH}`
        ),
        bounds: [
          [w, s],
          [e, n],
        ],
        fitBoundsOptions: { padding: 36 },
        minZoom: 1,
        maxZoom: 14,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
      });
    } catch {
      setMapFailed(true);
      return;
    }

    mapRef.current = map;
    map.on("load", () => {
      if (activeOverlay) {
        map.addSource("sar-overlay", {
          type: "image",
          url: activeOverlay.url,
          coordinates: toImageCoordinates(effectiveBounds),
        });
        map.addLayer({
          id: "sar-overlay-layer",
          type: "raster",
          source: "sar-overlay",
          paint: { "raster-opacity": overlayOpacity, "raster-fade-duration": 0 },
        });
      }

      map.addSource("burned-polygons", {
        type: "geojson",
        data: (geojsonData as never) ?? (EMPTY_FC as never),
      });
      map.addLayer({
        id: "burned-polygons-fill",
        type: "fill",
        source: "burned-polygons",
        paint: {
          "fill-color": "#fb923c",
          "fill-opacity": 0.22,
        },
        layout: {
          visibility: showPolygons ? "visible" : "none",
        },
      });
      map.addLayer({
        id: "burned-polygons-outline",
        type: "line",
        source: "burned-polygons",
        paint: {
          "line-color": "#f97316",
          "line-width": 1.6,
          "line-opacity": 0.92,
        },
        layout: {
          visibility: showPolygons ? "visible" : "none",
        },
      });
      map.fitBounds(
        [
          [effectiveBounds[0], effectiveBounds[1]],
          [effectiveBounds[2], effectiveBounds[3]],
        ],
        { padding: 36, duration: 0 }
      );
      setReady(true);
    });

    return () => {
      setReady(false);
      map.remove();
      mapRef.current = null;
    };
    // Intentionally recreate map only when scene footprint changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webglSupported, effectiveBounds[0], effectiveBounds[1], effectiveBounds[2], effectiveBounds[3]]);

  // Update active raster image overlay & opacity reactively
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !activeOverlay) return;
    const src = map.getSource("sar-overlay") as ImageSource | undefined;
    if (src && typeof src.updateImage === "function") {
      src.updateImage({
        url: activeOverlay.url,
        coordinates: toImageCoordinates(effectiveBounds),
      });
    }
    if (map.getLayer("sar-overlay-layer")) {
      map.setPaintProperty("sar-overlay-layer", "raster-opacity", overlayOpacity);
    }
  }, [ready, activeOverlay?.url, overlayOpacity, effectiveBounds]);

  // Update GeoJSON burned polygons source & visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("burned-polygons") as GeoJSONSource | undefined;
    if (src) src.setData(geojsonData as never);
    const vis = showPolygons ? "visible" : "none";
    if (map.getLayer("burned-polygons-fill")) map.setLayoutProperty("burned-polygons-fill", "visibility", vis);
    if (map.getLayer("burned-polygons-outline")) map.setLayoutProperty("burned-polygons-outline", "visibility", vis);
  }, [ready, geojsonData, showPolygons]);

  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(
      [
        [effectiveBounds[0], effectiveBounds[1]],
        [effectiveBounds[2], effectiveBounds[3]],
      ],
      { padding: 36, duration: 250 }
    );
  };

  return (
    <div className="space-y-3" data-testid="burn-analysis-map">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Map raster overlay">
          {overlayOptions.map((opt) => (
            <Button
              key={opt.id}
              type="button"
              size="sm"
              variant={activeOverlayId === opt.id ? "primary" : "secondary"}
              className="h-7 px-2.5 text-xs"
              onClick={() => onOverlayChange(opt.id)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 font-medium">
            <span>Opacity {Math.round(overlayOpacity * 100)}%</span>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={Math.round(overlayOpacity * 100)}
              onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
              aria-label="Raster overlay opacity"
              className="w-20 accent-primary"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 font-medium">
            <input
              type="checkbox"
              checked={showPolygons}
              onChange={(e) => onTogglePolygons(e.target.checked)}
            />
            <span>Burned Polygons ({geojsonCountLoaded ?? geojsonFeatureCount})</span>
          </label>
        </div>
      </div>

      <div className="relative h-[420px] w-full overflow-hidden rounded-lg border border-border bg-background">
        {webglSupported && !mapFailed ? (
          <>
            <div ref={containerRef} className="h-full w-full" aria-label="Interactive SAR Burn Analysis Map" />
            <div className="absolute right-3 bottom-3 z-[4] flex flex-col gap-1">
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                aria-label="Zoom in"
                onClick={() => mapRef.current?.zoomIn()}
              >
                <Plus className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                aria-label="Zoom out"
                onClick={() => mapRef.current?.zoomOut()}
              >
                <Minus className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                aria-label="Fit scene bounds"
                onClick={handleRecenter}
              >
                <LocateFixed className="size-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            {activeOverlay && (
              <img
                src={activeOverlay.url}
                alt={activeOverlay.label}
                className="max-h-72 rounded border border-border object-contain"
                style={{ opacity: overlayOpacity }}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Georeferenced extent (WGS84): [{effectiveBounds.map((v) => v.toFixed(4)).join(", ")}] ·{" "}
              {geojsonCountLoaded ?? geojsonFeatureCount} detected change polygons
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
