/**
 * Country names on the Explorer map: which names may show at a zoom level, and where they fit.
 * Data: public/basemap/country-labels.json, from Natural Earth 1:110m admin-0 countries (public domain):
 * label point (LABEL_X/LABEL_Y), MIN_LABEL (zoom from which a name should appear) and LABELRANK (priority).
 */

export const COUNTRY_LABELS_URL_PATH = "basemap/country-labels.json";

export interface CountryLabel {
  iso3: string;
  name: string;
  lon: number;
  lat: number;
  /** Natural Earth MIN_LABEL. */
  minLabel: number;
  /** Natural Earth LABELRANK (lower = more important). */
  rank: number;
}

/** Natural Earth MIN_LABEL ≤ 2 are the major countries: shown a little larger. */
export const MAJOR_MIN_LABEL = 2;

/**
 * Approved zoom tiers (map zoom → largest MIN_LABEL shown). Below 1.5 (world view on every screen size):
 * no names.
 */
export function maxMinLabelForZoom(zoom: number): number | null {
  if (zoom < 1.5) return null;
  if (zoom < 2.5) return 2;
  if (zoom < 3.5) return 3;
  if (zoom < 4.5) return 4;
  return Infinity;
}

/** Names allowed at this zoom, most important first (LABELRANK, then MIN_LABEL, then name for stability). */
export function eligibleLabels(labels: readonly CountryLabel[], zoom: number): CountryLabel[] {
  const max = maxMinLabelForZoom(zoom);
  if (max === null) return [];
  return labels
    .filter((l) => l.minLabel <= max)
    .sort((a, b) => a.rank - b.rank || a.minLabel - b.minLabel || a.name.localeCompare(b.name));
}

/** Parses the compact file ({ columns, rows }). Rows with missing or invalid values are dropped. */
export function parseCountryLabels(json: unknown): CountryLabel[] {
  const data = json as { columns?: unknown; rows?: unknown };
  if (!Array.isArray(data?.columns) || !Array.isArray(data?.rows)) return [];
  const col = (name: string) => (data.columns as unknown[]).indexOf(name);
  const [iso3, name, lon, lat, minLabel, rank] = ["iso3", "name", "lon", "lat", "minLabel", "rank"].map(col);
  const out: CountryLabel[] = [];
  for (const r of data.rows as unknown[][]) {
    const l = { iso3: r[iso3], name: r[name], lon: r[lon], lat: r[lat], minLabel: r[minLabel], rank: r[rank] };
    if (typeof l.iso3 !== "string" || typeof l.name !== "string") continue;
    if (![l.lon, l.lat, l.minLabel, l.rank].every((v) => typeof v === "number" && Number.isFinite(v))) continue;
    out.push(l as CountryLabel);
  }
  return out;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Box, b: Box, gap = 0) =>
  a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;
const inside = (a: Box, frame: Box) => a.left >= frame.left && a.right <= frame.right && a.top >= frame.top && a.bottom <= frame.bottom;

/**
 * Greedy placement in priority order. A name is placed only if it is fully inside the map, does not touch
 * another placed name (gap in px), and does not cover an obstacle (FIRMS points, event markers, map controls,
 * DEMO chip, selection card). Density squares are NOT obstacles: names are drawn over them with a halo.
 */
export function placeLabels<T extends { id: string; box: Box }>(candidates: readonly T[], obstacles: readonly Box[], frame: Box, gap = 4): Set<string> {
  const placed: Box[] = [];
  const ids = new Set<string>();
  for (const c of candidates) {
    if (!inside(c.box, frame)) continue;
    if (obstacles.some((o) => overlaps(c.box, o))) continue;
    if (placed.some((p) => overlaps(c.box, p, gap))) continue;
    placed.push(c.box);
    ids.add(c.id);
  }
  return ids;
}
