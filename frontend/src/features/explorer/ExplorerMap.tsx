/**
 * Interactive Explorer map (MapLibre, loaded lazily so the rest of the app stays small).
 * - Basemap: local Natural Earth country outlines and names; no external tiles, glyphs or sprites.
 * - Density: exact detection counts per grid square (cell size follows the zoom level).
 * - Points: individual FIRMS detections from POINTS_MIN_ZOOM.
 * - Candidate events: real <button> markers (keyboard reachable), labelled as demo data.
 * Falls back to a message (and the event list stays usable) when WebGL is not available.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap, Marker } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActiveFireDetection, BBox, FireEvent, Provenance, TimeWindow } from "@/data/types";
import { attachCountryLabels, type CountryLabelLayer } from "./countryLabelLayer";
import { COUNTRY_LABELS_URL_PATH, parseCountryLabels } from "./countryLabels";
import { DENSITY_MIN_ZOOM, POINTS_MIN_ZOOM, type LayerVisibility } from "./layerHelp";
import {
  COUNTRIES_URL_PATH,
  RELIEF_TILES_URL_PATH,
  buildDensity,
  buildStyle,
  cellSizeForZoom,
  detectionsGeoJSON,
  readMapColors,
  themedPaint,
  type DensityView,
} from "./mapStyle";

maplibregl.setWorkerUrl(workerUrl);

export interface DensitySummary {
  cellDeg: number;
  /** Squares are drawn on the map at the current zoom (regional scale). */
  shown: boolean;
  classes: [number, number][];
  cells: DensityView["grid"]["cells"];
  total: number;
}

export interface ExplorerMapProps {
  events: FireEvent[];
  detections: ActiveFireDetection[];
  detectionProvenance: Provenance | null;
  window: TimeWindow;
  layers: LayerVisibility;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  onSelectDetection: (id: string | null) => void;
  onDensityChange: (summary: DensitySummary) => void;
  /** Area to bring into view (e.g. a searched country); the map moves whenever it changes. */
  focusBounds?: BBox | null;
  className?: string;
}

const WORLD: [[number, number], [number, number]] = [
  [-170, -58],
  [180, 78],
];

/** WebGL is required by MapLibre; without it the page shows a message and the list. */
function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const bboxBounds = (e: FireEvent): [[number, number], [number, number]] => [
  [e.bbox.west, e.bbox.south],
  [e.bbox.east, e.bbox.north],
];

const mapContainer = (map: MLMap) => map.getContainer();

const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * Keyboard reach of event markers: only a marker that is fully inside the visible map and not under an
 * overlay (zoom buttons, demo chip, selection card) is in the Tab order and exposed to assistive technology.
 * Markers outside the current view are skipped, so focus never lands on something the user cannot see and
 * the map never moves on focus. Every event stays reachable from the candidate list ("Show on map").
 * A marker that currently has focus keeps its state until it loses focus.
 */
export function updateMarkerReach(map: MLMap) {
  const container = mapContainer(map);
  const box = container.getBoundingClientRect();
  const frame = container.closest("[data-map-frame]") ?? container;
  const overlays = [...frame.querySelectorAll("[data-map-overlay]")].map((o) => o.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  for (const el of container.querySelectorAll<HTMLElement>("[data-event-marker]")) {
    if (el === document.activeElement) continue;
    const r = el.getBoundingClientRect();
    const shown = el.style.display !== "none" && r.width > 0;
    const inside = r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
    const reachable = shown && inside && !overlays.some((o) => overlaps(r, o));
    el.tabIndex = reachable ? 0 : -1;
    if (reachable) el.removeAttribute("aria-hidden");
    else el.setAttribute("aria-hidden", "true");
    el.dataset.reachable = String(reachable);
  }
}

/**
 * Padding for fitting an area into view: keeps clear of tall panels floating over the map (the desktop map key), so
 * a searched country or a selected possible fire is never placed underneath them.
 */
export function fitPadding(map: MLMap, base: number) {
  const container = mapContainer(map);
  const box = container.getBoundingClientRect();
  const frame = container.closest("[data-map-frame]") ?? container;
  const padding = { top: base, bottom: base, left: base, right: base };
  for (const o of frame.querySelectorAll("[data-map-overlay]")) {
    const r = o.getBoundingClientRect();
    if (r.width === 0 || r.height < box.height * 0.4) continue; // small controls: ignore
    if (r.left > box.left + box.width / 2) padding.right = Math.max(padding.right, Math.min(box.right - r.left + base / 2, box.width / 2));
  }
  return padding;
}

const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function markerElement(e: FireEvent): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.eventMarker = e.id;
  button.className = "aw-event-marker group relative grid size-8 place-items-center rounded-full";
  const demo = e.provenance.origin === "synthetic" ? " Demo data, invented location." : "";
  button.setAttribute("aria-label", `${e.id}: ${e.name}. Possible fire (candidate event), not a confirmed wildfire.${demo}`);
  button.innerHTML = `
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <circle cx="15" cy="15" r="11" fill="none" stroke="var(--aw-data-line-casing-light)" stroke-width="4"/>
      <circle cx="15" cy="15" r="11" fill="none" stroke="var(--aw-data-line-casing-dark)" stroke-width="2" stroke-dasharray="4 3"/>
      <circle cx="15" cy="15" r="3" fill="var(--aw-data-line-casing-dark)"/>
    </svg>
    <span class="aw-marker-label pointer-events-none absolute hidden group-hover:block group-focus-visible:block group-data-[selected=true]:block top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[11px] font-bold shadow-sm"
      style="background:var(--aw-color-surface);color:var(--aw-color-text);border-color:var(--aw-color-border-strong)">${e.id}</span>`;
  return button;
}

export default function ExplorerMap({
  events,
  detections,
  detectionProvenance,
  window: timeWindow,
  layers,
  selectedEventId,
  onSelectEvent,
  onSelectDetection,
  onDensityChange,
  focusBounds = null,
  className,
}: ExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const labelsRef = useRef<CountryLabelLayer | null>(null);
  const bordersVisibleRef = useRef(layers.borders);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(() => !webglAvailable());
  const [basemapError, setBasemapError] = useState(false);
  const [zoomBucket, setZoomBucket] = useState(1);
  const eventsRef = useRef(events);
  const [zoomLimits, setZoomLimits] = useState({ atMin: false, atMax: false });

  // Keep the latest callbacks without re-creating the map.
  const cb = useRef({ onSelectEvent, onSelectDetection, onDensityChange });
  useLayoutEffect(() => {
    cb.current = { onSelectEvent, onSelectDetection, onDensityChange };
    eventsRef.current = events;
  });

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || failed) return;
    let map: MLMap;
    try {
      map = new maplibregl.Map({
        container,
        style: buildStyle(
          readMapColors(),
          new URL(`${import.meta.env.BASE_URL}${COUNTRIES_URL_PATH}`, window.location.origin).href,
          POINTS_MIN_ZOOM,
          DENSITY_MIN_ZOOM,
          // {z}/{x}/{y} must stay literal (URL() would percent-encode the braces).
          `${window.location.origin}${import.meta.env.BASE_URL}${RELIEF_TILES_URL_PATH}`,
        ),
        bounds: WORLD,
        fitBoundsOptions: { padding: 8 },
        renderWorldCopies: false,
        minZoom: -1,
        maxZoom: 11,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        // Credit is shown as text in the page legend; zoom buttons are project buttons (token focus ring).
        attributionControl: false,
        locale: { "Map.Title": "Interactive map. Use the arrow keys to move and the plus or minus keys to zoom." },
      });
    } catch {
      // Reported asynchronously (the map is an external system); the list stays usable.
      void Promise.resolve().then(() => setFailed(true));
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    mapRef.current = map;
    // Development builds only: lets the real-browser checks click a detection point (compiled out of production).
    if (import.meta.env.DEV) (container as HTMLDivElement & { __awMap?: MLMap }).__awMap = map;

    map.on("load", () => {
      // The container may have been resized after creation (lazy load, layout): show the whole world.
      map.resize();
      map.fitBounds(WORLD, { padding: 8, duration: 0 });
      markZoom();
      updateMarkerReach(map);
      setReady(true);
      setZoomBucket(Math.floor(map.getZoom()));
    });
    const markZoom = () => {
      container.dataset.zoom = map.getZoom().toFixed(2);
      setZoomLimits({ atMin: map.getZoom() <= map.getMinZoom() + 0.01, atMax: map.getZoom() >= map.getMaxZoom() - 0.01 });
    };
    map.on("zoomend", () => {
      markZoom();
      setZoomBucket(Math.floor(map.getZoom()));
    });
    // Keyboard reach of markers follows what is actually visible (never moves the map on focus).
    map.on("moveend", () => updateMarkerReach(map));
    map.on("resize", () => updateMarkerReach(map));
    map.on("idle", () => updateMarkerReach(map));
    // Overlays (selection card) appear and disappear without the map moving.
    const frame = container.closest("[data-map-frame]");
    const overlayObserver = new MutationObserver(() => {
      updateMarkerReach(map);
      labelsRef.current?.update();
    });
    if (frame) overlayObserver.observe(frame, { childList: true });

    // Country names (local file; if it can't be loaded the map simply shows no names).
    let cancelled = false;
    const labelsLoaded = fetch(new URL(`${import.meta.env.BASE_URL}${COUNTRY_LABELS_URL_PATH}`, window.location.origin).href)
      .then((r) => (r.ok ? r.json() : null))
      .then(parseCountryLabels)
      .catch(() => []);
    map.once("load", () => {
      void labelsLoaded.then((labels) => {
        if (cancelled || !labels.length) return;
        labelsRef.current = attachCountryLabels(map, labels, { pointsLayer: "detection-points", pointsMinZoom: POINTS_MIN_ZOOM });
        labelsRef.current.setVisible(bordersVisibleRef.current);
      });
    });
    map.on("error", (e) => {
      if ((e as { sourceId?: string }).sourceId === "countries") setBasemapError(true);
    });
    map.on("click", "detection-points", (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") cb.current.onSelectDetection(id);
    });
    map.on("mouseenter", "detection-points", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "detection-points", () => (map.getCanvas().style.cursor = ""));

    // Re-apply token colours when the theme changes.
    const observer = new MutationObserver(() => {
      if (!map.isStyleLoaded()) return;
      const paint = themedPaint(readMapColors());
      for (const [layer, props] of Object.entries(paint)) {
        for (const [prop, value] of Object.entries(props)) map.setPaintProperty(layer, prop as "fill-color", value as never);
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const markers = markersRef.current;
    return () => {
      cancelled = true;
      labelsRef.current?.destroy();
      labelsRef.current = null;
      observer.disconnect();
      overlayObserver.disconnect();
      markers.forEach((m) => m.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create the map once; `failed` only matters initially
  }, []);

  // Detection points + density squares (recomputed when data or zoom level changes).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("detections") as GeoJSONSource | undefined)?.setData(detectionsGeoJSON(detections) as never);
    const cellDeg = cellSizeForZoom(zoomBucket);
    if (!detectionProvenance) {
      (map.getSource("density") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: [] });
      cb.current.onDensityChange({ cellDeg, shown: zoomBucket >= DENSITY_MIN_ZOOM, classes: [], cells: [], total: 0 });
      return;
    }
    const view = buildDensity(detections, timeWindow, detectionProvenance, cellDeg);
    (map.getSource("density") as GeoJSONSource | undefined)?.setData(view.geojson as never);
    cb.current.onDensityChange({ cellDeg, shown: zoomBucket >= DENSITY_MIN_ZOOM, classes: view.classes, cells: view.grid.cells, total: view.grid.total });
  }, [ready, detections, detectionProvenance, timeWindow, zoomBucket]);

  // Layer visibility.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const set = (id: string, on: boolean) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    set("density-fill", layers.density);
    set("density-outline", layers.density);
    set("detection-points", layers.detections);
    set("detection-casing", layers.detections);
    set("country-border", layers.borders);
    // "Country borders and names": the same switch controls the names.
    bordersVisibleRef.current = layers.borders;
    labelsRef.current?.setVisible(layers.borders);
    markersRef.current.forEach((m) => (m.getElement().style.display = layers.events ? "" : "none"));
    updateMarkerReach(map);
  }, [ready, layers]);

  // Candidate event markers (one per visible event).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const wanted = new Set(events.map((e) => e.id));
    for (const [id, m] of markers) {
      if (!wanted.has(id)) {
        m.remove();
        markers.delete(id);
      }
    }
    for (const e of events) {
      if (markers.has(e.id)) continue;
      const el = markerElement(e);
      // Re-check reachability when focus leaves (a marker is never removed from the Tab order while focused).
      el.addEventListener("blur", () => updateMarkerReach(map));
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        cb.current.onSelectEvent(e.id);
      });
      const marker = new maplibregl.Marker({ element: el }).setLngLat([e.centroid.lon, e.centroid.lat]).addTo(map);
      markers.set(e.id, marker);
    }
    markers.forEach((m) => (m.getElement().style.display = layers.events ? "" : "none"));
    updateMarkerReach(map);
    labelsRef.current?.update();
  }, [events, layers.events]);

  // Selection: highlight the selected marker.
  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const el = m.getElement();
      const selected = id === selectedEventId;
      el.setAttribute("aria-pressed", String(selected));
      el.dataset.selected = String(selected);
      el.style.zIndex = selected ? "2" : "";
    });
    // The selected marker shows its ID tag: names must not cover it.
    labelsRef.current?.update();
  }, [selectedEventId, events]);

  // Selection: bring the event into view once the map is ready and the event is listed (also for ?event=).
  // Waiting for `ready` (not map.loaded(), which is false while sources update) makes the zoom reliable on
  // slow renderers; covered by the browser check "Enter selects, zooms in".
  const selectedListed = events.some((e) => e.id === selectedEventId);
  useEffect(() => {
    const map = mapRef.current;
    const event = eventsRef.current.find((e) => e.id === selectedEventId);
    if (!map || !ready || !event) return;
    map.fitBounds(bboxBounds(event), { padding: fitPadding(map, 60), maxZoom: 8, duration: reducedMotion() ? 0 : 900 });
  }, [selectedEventId, ready, selectedListed]);

  // A searched country: bring it into view (the selected possible fire, if any, takes over afterwards).
  const focusKey = focusBounds ? `${focusBounds.west},${focusBounds.south},${focusBounds.east},${focusBounds.north}` : "";
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focusBounds) return;
    map.fitBounds(
      [
        [focusBounds.west, focusBounds.south],
        [focusBounds.east, focusBounds.north],
      ],
      { padding: fitPadding(map, 40), maxZoom: 6, duration: reducedMotion() ? 0 : 900 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- move only when the area itself changes
  }, [ready, focusKey]);

  if (failed) {
    return (
      <div role="status" className="grid h-full place-items-center bg-map p-6 text-center text-sm">
        <p className="max-w-sm">
          The map can't be shown in this browser (WebGL is not available). All possible fires are still listed and can be opened from the
          list.
        </p>
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "relative", height: "100%" }}>
      <div
        ref={containerRef}
        data-explorer-map
        className="h-full w-full [&_.maplibregl-canvas:focus-visible]:outline-[3px] [&_.maplibregl-canvas:focus-visible]:outline-offset-[-3px] [&_.maplibregl-canvas:focus-visible]:outline-[var(--aw-color-focus-ring)]"
        onKeyDown={(e) => {
          if (e.key === "Escape" && selectedEventId) {
            const el = markersRef.current.get(selectedEventId)?.getElement();
            onSelectEvent(null);
            el?.focus();
          }
        }}
      />
      {ready && (
        <div data-map-overlay className="absolute top-2 right-2 z-[3] grid gap-1 rounded-md border border-border-strong bg-surface p-1 shadow-sm">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom in" disabled={zoomLimits.atMax} onClick={() => mapRef.current?.zoomIn({ duration: reducedMotion() ? 0 : 300 })}>
            <Plus aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom out" disabled={zoomLimits.atMin} onClick={() => mapRef.current?.zoomOut({ duration: reducedMotion() ? 0 : 300 })}>
            <Minus aria-hidden="true" />
          </Button>
        </div>
      )}
      {basemapError && (
        <p role="status" className="absolute bottom-2 left-2 rounded-md bg-surface px-2 py-1 text-xs shadow-sm">
          Country outlines couldn't be loaded. Detections and events are still shown.
        </p>
      )}
    </div>
  );
}
