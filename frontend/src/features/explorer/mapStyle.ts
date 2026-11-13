/**
 * Map style and data shaping for the Explorer. Colours come from the approved design tokens (read from
 * CSS custom properties at runtime, so both themes work). No external tiles, glyphs or sprites: every
 * label is HTML; the basemap is local and public domain (Natural Earth relief raster + country outlines).
 */
import { aggregateDensity, densityClasses, densityLevel, type DensityGrid } from "@/data/aggregate";
import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import type { ActiveFireDetection, Provenance, TimeWindow } from "@/data/types";

/** Minimal GeoJSON shapes used here (kept local: no extra type package). */
interface Feature<G, P> {
  type: "Feature";
  id?: string;
  properties: P;
  geometry: G;
}
export interface FeatureCollection<G = unknown, P = Record<string, unknown>> {
  type: "FeatureCollection";
  features: Feature<G, P>[];
}
type PolygonGeom = { type: "Polygon"; coordinates: [number, number][][] };
type PointGeom = { type: "Point"; coordinates: [number, number] };

export const COUNTRIES_URL_PATH = "basemap/countries-110m.geojson";
/** Natural Earth I with Shaded Relief and Water, 1:50m, as 512 px Web Mercator tiles (see public/basemap/relief/SOURCE.txt). */
export const RELIEF_TILES_URL_PATH = "basemap/relief/{z}/{x}/{y}.jpg";
export const RELIEF_MAX_ZOOM = 4;

/**
 * How the relief raster is softened per theme (MapLibre raster paint). Chosen by measuring the fire symbols against
 * every pixel of the rendered raster: Light keeps natural colours but muted and lifted; Dark is a dimmed, night-toned
 * version (not an inversion). Fire symbols are never tinted.
 */
export const RELIEF_PAINT = {
  light: { saturation: -0.3, brightnessMin: 0.25, brightnessMax: 1 },
  // Dark: dimmed to 42 % brightness (keeps the light outline ≥ 4.32:1) with saturation raised so green, brown and blue
  // stay distinguishable at that low brightness.
  dark: { saturation: 0.4, brightnessMin: 0, brightnessMax: 0.42 },
} as const;

/** Representative raw colours of the relief raster (median of a 20 px block at each place, NE1_50M_SR_W). */
export const RELIEF_SAMPLES = {
  vegetated: "#A6C6AB", // Amazon basin
  dry: "#E2D6B9", // interior Australia
  ice: "#E7EDF4", // Greenland
  water: "#70A2C6", // central Atlantic
} as const;

/** A raw relief colour as the map draws it in a theme (same saturation/brightness steps as the raster layer). */
export function reliefSwatch(hex: string, paint: (typeof RELIEF_PAINT)[keyof typeof RELIEF_PAINT]): string {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const grey = (c[0] + c[1] + c[2]) / 3;
  return (
    "#" +
    c
      .map((v) => Math.min(1, Math.max(0, grey + (v - grey) * (1 + paint.saturation))))
      .map((v) => paint.brightnessMin + v * (paint.brightnessMax - paint.brightnessMin))
      .map((v) => Math.round(v * 255).toString(16).padStart(2, "0").toUpperCase())
      .join("")
  );
}

export interface MapColors {
  /** Water shown before the relief tiles load (and the map container's own background). */
  background: string;
  /** Land fallback under the relief raster. */
  land: string;
  /** Density-square outlines and country borders (≥ 4.32:1 against every relief pixel). */
  outline: string;
  fire: string;
  /** Heat-spot rings: inner light ring, outer dark ring (fixed data colours, same in both themes). */
  casingLight: string;
  casingDark: string;
  density: [string, string, string, string, string];
  relief: (typeof RELIEF_PAINT)[keyof typeof RELIEF_PAINT];
}

const FALLBACK = {
  background: "#A6C0D2",
  land: "#E8E1CF",
  outline: "#0B1634",
  fire: "#D94100",
  casingLight: "#FFFFFF",
  casingDark: "#0B1634",
  density: ["#FEEDDE", "#FDBE85", "#FD8D3C", "#E6550D", "#A63603"],
};

/** Current token values (they change with the theme). */
export function readMapColors(el: Element = document.documentElement): MapColors {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const dark = (el as HTMLElement).dataset?.theme === "dark";
  return {
    background: v("--aw-color-map-placeholder", FALLBACK.background),
    land: v("--aw-color-map-land", FALLBACK.land),
    outline: v("--aw-color-map-outline", FALLBACK.outline),
    fire: v("--aw-data-fire-detection", FALLBACK.fire),
    casingLight: v("--aw-data-line-casing-light", FALLBACK.casingLight),
    casingDark: v("--aw-data-line-casing-dark", FALLBACK.casingDark),
    density: [1, 2, 3, 4, 5].map((i) => v(`--aw-data-density-${i}`, FALLBACK.density[i - 1])) as MapColors["density"],
    relief: dark ? RELIEF_PAINT.dark : RELIEF_PAINT.light,
  };
}

// 8° covers zoom ≤ 0 (whole world on a phone), where 4° squares would be only ~6 px wide.
// Covered by explorerLogic.test.ts ("stays ≥ 10 px on screen").
const CELL_SIZES = [8, 4, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.025];
/** Smallest grid square still at least this many pixels wide on screen. */
const MIN_CELL_PX = 10;

/**
 * Grid cell size (degrees) for a zoom level: the finest grid whose squares are still visible
 * (≥ 10 px). Map tiles are 512 px wide, so 1° ≈ 512·2^zoom / 360 px.
 */
export function cellSizeForZoom(zoom: number): number {
  const pxPerDegree = (512 * 2 ** Math.floor(Math.max(0, zoom))) / 360;
  const fitting = CELL_SIZES.filter((c) => c * pxPerDegree >= MIN_CELL_PX);
  return fitting.length ? Math.min(...fitting) : CELL_SIZES[0];
}

/** Approximate north–south size of a grid square in km (1° of latitude ≈ 111 km). */
export function cellSizeKm(cellDeg: number): number {
  return Math.round(cellDeg * 111);
}

export interface DensityView {
  grid: DensityGrid;
  classes: [number, number][];
  geojson: FeatureCollection<PolygonGeom, { count: number; level: number }>;
}

/** Counts detections per grid square and classifies them for the legend (exact counts, never smoothed). */
export function buildDensity(detections: ActiveFireDetection[], window: TimeWindow, provenance: Provenance, cellDeg: number): DensityView {
  const grid = aggregateDensity(detections, window, provenance, cellDeg);
  const classes = densityClasses(grid);
  return {
    grid,
    classes,
    geojson: {
      type: "FeatureCollection",
      features: grid.cells.map((c) => ({
        type: "Feature",
        id: c.cellId,
        properties: { count: c.count, level: densityLevel(c.count, classes) },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [c.bbox.west, c.bbox.south],
              [c.bbox.east, c.bbox.south],
              [c.bbox.east, c.bbox.north],
              [c.bbox.west, c.bbox.north],
              [c.bbox.west, c.bbox.south],
            ],
          ],
        },
      })),
    },
  };
}

export function detectionsGeoJSON(detections: ActiveFireDetection[]): FeatureCollection<PointGeom, { id: string }> {
  return {
    type: "FeatureCollection",
    features: detections.map((d) => ({ type: "Feature", properties: { id: d.id }, geometry: d.geometry })),
  };
}

export const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

/** Paint values that depend on the theme (applied again when the theme changes). */
export function themedPaint(c: MapColors): Record<string, Record<string, string | number | ExpressionSpecification>> {
  const level: ExpressionSpecification = ["match", ["get", "level"], 1, c.density[0], 2, c.density[1], 3, c.density[2], 4, c.density[3], c.density[4]];
  return {
    background: { "background-color": c.background },
    "country-fill": { "fill-color": c.land },
    relief: { "raster-saturation": c.relief.saturation, "raster-brightness-min": c.relief.brightnessMin, "raster-brightness-max": c.relief.brightnessMax },
    "country-border": { "line-color": c.outline },
    "density-fill": { "fill-color": level },
    "density-outline": { "line-color": c.outline },
    "detection-casing": { "circle-color": c.casingDark },
    "detection-points": { "circle-color": c.fire, "circle-stroke-color": c.casingLight },
  };
}

/** MapLibre style: water, land fallback, relief raster, density squares, borders, detection points. */
export function buildStyle(c: MapColors, countriesUrl: string, pointsMinZoom: number, densityMinZoom = 0, reliefUrl: string | null = null): StyleSpecification {
  const level: ExpressionSpecification = ["match", ["get", "level"], 1, c.density[0], 2, c.density[1], 3, c.density[2], 4, c.density[3], c.density[4]];
  return {
    version: 8,
    sources: {
      countries: { type: "geojson", data: countriesUrl },
      ...(reliefUrl ? { relief: { type: "raster" as const, tiles: [reliefUrl], tileSize: 512, minzoom: 0, maxzoom: RELIEF_MAX_ZOOM } } : {}),
      density: { type: "geojson", data: EMPTY_FC as never },
      detections: { type: "geojson", data: EMPTY_FC as never },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": c.background } },
      { id: "country-fill", type: "fill", source: "countries", paint: { "fill-color": c.land } },
      // Natural geographic background (opaque once loaded; water and land fallbacks show until then).
      ...(reliefUrl
        ? [
            {
              id: "relief",
              type: "raster" as const,
              source: "relief",
              paint: {
                "raster-saturation": c.relief.saturation,
                "raster-brightness-min": c.relief.brightnessMin,
                "raster-brightness-max": c.relief.brightnessMax,
                "raster-fade-duration": 0,
              },
            },
          ]
        : []),
      // Opaque fill, so the map shows exactly the legend colours (no mixing with land or ocean).
      { id: "density-fill", type: "fill", source: "density", minzoom: densityMinZoom, paint: { "fill-color": level, "fill-opacity": 1 } },
      // 1 px map-outline (≥ 4.32:1 against every relief pixel in both themes) keeps every square findable, including
      // the near-white lowest class over pale terrain.
      { id: "density-outline", type: "line", source: "density", minzoom: densityMinZoom, paint: { "line-color": c.outline, "line-width": 1, "line-opacity": 1 } },
      // Borders and coastlines: drawn above the density squares so geographic context stays visible; thin at
      // world view, a little stronger once zoomed in. Detection points stay on top.
      { id: "country-border", type: "line", source: "countries", paint: { "line-color": c.outline, "line-opacity": 0.75, "line-width": ["step", ["zoom"], 0.7, 4, 1.1] } },
      // Heat spot: fire-coloured dot, a light ring (dot vs ring 4.46:1) and an outer dark ring, so one ring always
      // stands out (≥ 5.01:1 Light, ≥ 5.32:1 Dark) on green, brown, white or blue terrain.
      {
        id: "detection-casing",
        type: "circle",
        source: "detections",
        minzoom: pointsMinZoom,
        paint: { "circle-color": c.casingDark, "circle-radius": 7 },
      },
      {
        id: "detection-points",
        type: "circle",
        source: "detections",
        minzoom: pointsMinZoom,
        paint: { "circle-color": c.fire, "circle-stroke-color": c.casingLight, "circle-radius": 4.5, "circle-stroke-width": 1.5 },
      },
    ],
  };
}
