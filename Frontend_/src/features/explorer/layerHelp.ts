/**
 * Plain-language text for the Explorer map layers. Every layer says what it shows AND what it does not
 * show, so FIRMS detections are never read as confirmed wildfires and density never as burned area.
 */
export type LayerKey = "density" | "detections" | "events" | "borders";

export interface LayerHelp {
  key: LayerKey;
  label: string;
  shows: string;
  doesNotShow: string;
  note?: string;
}

// Everyday words first (heat spot, possible fire, shaded squares), the scientific term next to them.
export const LAYER_HELP: Record<LayerKey, LayerHelp> = {
  density: {
    key: "density",
    label: "Shaded squares (heat spot density)",
    shows: "How many heat spots (NASA FIRMS active-fire detections) satellites recorded in each square of the map grid, for the selected dates.",
    doesNotShow: "Confirmed wildfires, fire size, fire intensity, or burned land.",
    note: "Squares appear when you zoom in to a region (at world scale each possible fire is shown by its marker). The grid gets finer as you zoom in.",
  },
  detections: {
    key: "detections",
    label: "Heat spots (individual detections)",
    shows: "Each point is one place and time where a satellite sensed unusual heat: one NASA FIRMS active-fire detection.",
    doesNotShow: "Whether there was a wildfire, or how much ground burned. Heat can also come from industry, gas flares or volcanoes.",
    note: "Points appear when you zoom in close.",
  },
  events: {
    key: "events",
    label: "Possible fires (candidate events)",
    shows: "Groups of nearby heat spots, shown as one dashed-circle marker per group.",
    doesNotShow: "Confirmed wildfires. A possible fire has not been checked by fire services.",
  },
  borders: {
    key: "borders",
    label: "Country borders and names",
    shows: "Simplified country outlines and country names to help you find your way (Natural Earth, public domain).",
    doesNotShow: "Exact borders. They are simplified for a world view.",
    note: "Names appear as you zoom in: the largest countries first, more as you get closer. A name is left out where it would cover a heat spot, a possible-fire marker or the map controls.",
  },
};

export const LAYER_ORDER: LayerKey[] = ["density", "detections", "events", "borders"];

export type LayerVisibility = Record<LayerKey, boolean>;

export const DEFAULT_LAYERS: LayerVisibility = { density: true, detections: true, events: true, borders: true };

/**
 * Words for the five density levels (lowest first). Levels are relative: equal steps from 1 up to the busiest
 * square for the selected period at the current grid size (data/aggregate.ts densityClasses), not fixed thresholds.
 */
export const DENSITY_LEVEL_NAMES = ["Lowest", "Low", "Middle", "High", "Highest"] as const;

/** Plain-language explanation shown permanently next to the density legend. */
export const DENSITY_EXPLANATION =
  "Stronger colours indicate more FIRMS detections within an area during the selected period. They do not show the size or intensity of a burned area.";

/** Zoom level from which the density squares are drawn (below it, world scale: possible-fire markers only). */
export const DENSITY_MIN_ZOOM = 3;

/** Zoom level from which individual detection points are drawn. */
export const POINTS_MIN_ZOOM = 9;
