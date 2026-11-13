/**
 * Country names drawn as HTML text over the map (the style has no glyphs, so nothing is downloaded).
 * - Inserted right after the map canvas: above density squares and outlines, below event markers and the
 *   map controls, DEMO chip and selection card.
 * - Visual context only: aria-hidden, never focusable, pointer-events: none (clicks reach points/markers).
 * - Positions follow every map movement; which names fit is re-decided when the map settles.
 */
import type { Map as MLMap } from "maplibre-gl";
import { MAJOR_MIN_LABEL, eligibleLabels, placeLabels, type Box, type CountryLabel } from "./countryLabels";

/** FIRMS points: radius 4.5 + 1.5 halo (mapStyle.ts). */
const POINT_RADIUS = 6;

const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

/** Halo in the land colour so names stay readable over borders, ocean and density squares in both themes. */
const HALO = [
  "1px 0 0", "-1px 0 0", "0 1px 0", "0 -1px 0", "1px 1px 0", "-1px -1px 0", "1px -1px 0", "-1px 1px 0", "0 0 3px",
].map((s) => `${s} var(--aw-color-surface-raised)`).join(", ");

export interface CountryLabelLayer {
  /** Re-decide which names fit (after the map settles, layers or overlays change). */
  update(): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

export function attachCountryLabels(map: MLMap, labels: readonly CountryLabel[], options: { pointsLayer: string; pointsMinZoom: number }): CountryLabelLayer {
  const container = map.getContainer();
  const layer = document.createElement("div");
  layer.dataset.countryLabels = "";
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden";
  map.getCanvasContainer().insertBefore(layer, map.getCanvas().nextSibling);

  const spans = new Map<string, HTMLSpanElement>();
  for (const l of labels) {
    const s = document.createElement("span");
    s.dataset.countryLabel = l.iso3;
    s.dataset.minLabel = String(l.minLabel);
    s.textContent = l.name;
    const major = l.minLabel <= MAJOR_MIN_LABEL;
    s.style.cssText = [
      // The app's body font (MapLibre's own CSS would otherwise set Helvetica Neue/Arial on the map).
      "position:absolute;left:0;top:0;display:none;white-space:nowrap;line-height:1.2;font-family:var(--aw-font-family-body)",
      `font-size:${major ? 13 : 12}px;font-weight:${major ? 600 : 500}`,
      "color:var(--aw-color-text)",
      `text-shadow:${HALO}`,
    ].join(";");
    layer.append(s);
    spans.set(l.iso3, s);
  }

  const sizes = new Map<string, { w: number; h: number }>();
  const size = (iso3: string) => {
    let s = sizes.get(iso3);
    if (!s) {
      const el = spans.get(iso3)!;
      const prev = el.style.display;
      el.style.visibility = "hidden";
      el.style.display = "block";
      s = { w: el.offsetWidth, h: el.offsetHeight };
      el.style.display = prev;
      el.style.visibility = "";
      if (s.w > 0) sizes.set(iso3, s);
    }
    return s;
  };

  let visible = true;
  let shown: CountryLabel[] = [];

  /** Moves the names currently shown (cheap; runs on every frame of a pan or zoom). */
  const position = () => {
    for (const l of shown) {
      const p = map.project([l.lon, l.lat]);
      const { w, h } = size(l.iso3);
      spans.get(l.iso3)!.style.transform = `translate(${Math.round(p.x - w / 2)}px, ${Math.round(p.y - h / 2)}px)`;
    }
  };

  const obstacles = (): Box[] => {
    const out: Box[] = [];
    const frame = container.closest("[data-map-frame]") ?? container;
    // Map controls, DEMO chip, selection card.
    for (const o of frame.querySelectorAll("[data-map-overlay]")) {
      const r = o.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push(toBox(r));
    }
    // Candidate-event markers, including their visible ID tag.
    for (const m of container.querySelectorAll<HTMLElement>("[data-event-marker]")) {
      if (m.style.display === "none") continue;
      for (const el of [m, ...m.querySelectorAll<HTMLElement>("*")]) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push(toBox(r));
      }
    }
    // FIRMS detection points (only drawn from pointsMinZoom).
    if (map.getZoom() >= options.pointsMinZoom && map.getLayer(options.pointsLayer) && map.getLayoutProperty(options.pointsLayer, "visibility") !== "none") {
      const c = container.getBoundingClientRect();
      for (const f of map.queryRenderedFeatures({ layers: [options.pointsLayer] })) {
        const [lon, lat] = (f.geometry as { coordinates: [number, number] }).coordinates;
        const p = map.project([lon, lat]);
        out.push({ left: c.left + p.x - POINT_RADIUS, top: c.top + p.y - POINT_RADIUS, right: c.left + p.x + POINT_RADIUS, bottom: c.top + p.y + POINT_RADIUS });
      }
    }
    return out;
  };

  const update = () => {
    const candidates = visible ? eligibleLabels(labels, map.getZoom()) : [];
    const c = container.getBoundingClientRect();
    const boxes = candidates.map((l) => {
      const p = map.project([l.lon, l.lat]);
      const { w, h } = size(l.iso3);
      const left = c.left + p.x - w / 2;
      const top = c.top + p.y - h / 2;
      return { id: l.iso3, label: l, box: { left, top, right: left + w, bottom: top + h } };
    });
    const placed = candidates.length ? placeLabels(boxes, obstacles(), toBox(c)) : new Set<string>();
    shown = candidates.filter((l) => placed.has(l.iso3));
    for (const [iso3, el] of spans) {
      const on = placed.has(iso3);
      el.style.display = on ? "block" : "none";
      el.dataset.placed = String(on);
    }
    position();
  };

  map.on("move", position);
  map.on("moveend", update);
  map.on("resize", update);
  map.on("idle", update);
  update();

  return {
    update,
    setVisible(v) {
      visible = v;
      update();
    },
    destroy() {
      map.off("move", position);
      map.off("moveend", update);
      map.off("resize", update);
      map.off("idle", update);
      layer.remove();
    },
  };
}
