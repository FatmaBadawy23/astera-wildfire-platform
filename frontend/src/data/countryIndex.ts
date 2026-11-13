/**
 * Country search index. Sources, both local:
 *  - public/basemap/countries-110m.geojson (Natural Earth 1:110m, public domain): every country's name and outline,
 *    used to zoom the map to a country;
 *  - the dataset's own country list (the countries that have records), which marks where data exists.
 * Country level only: there is no town or address search, because no approved place-name source exists.
 */
import { useQuery } from "@tanstack/react-query";
import { useCountries } from "./hooks";
import type { BBox, Country } from "./types";

export const COUNTRY_SHAPES_URL_PATH = "basemap/countries-110m.geojson";

export interface CountryOption {
  iso3: string;
  /** Display name (the dataset's name when the dataset has the country). */
  name: string;
  /** Other names that also match a search (e.g. the Natural Earth name). */
  aliases: string[];
  /** Box around the country's largest land area, for zooming the map; null when unknown. */
  bbox: BBox | null;
  /** The dataset has records for this country. */
  hasData: boolean;
}

type Ring = [number, number][];
interface ShapeFeature {
  properties: { iso3?: string; name?: string };
  geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] } | null;
}

function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2);
}

/**
 * Bounding box of the largest polygon (by planar area). Using the largest part keeps the zoom sensible for countries
 * with far-away islands or parts across the antimeridian (e.g. the United States, Russia, Fiji).
 */
export function largestPolygonBBox(geometry: ShapeFeature["geometry"]): BBox | null {
  if (!geometry) return null;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let best: Ring | null = null;
  let bestArea = -1;
  for (const poly of polygons) {
    const outer = poly[0];
    if (!outer?.length) continue;
    const area = ringArea(outer);
    if (area > bestArea) {
      bestArea = area;
      best = outer;
    }
  }
  if (!best) return null;
  const lons = best.map((p) => p[0]);
  const lats = best.map((p) => p[1]);
  return { west: Math.min(...lons), south: Math.min(...lats), east: Math.max(...lons), north: Math.max(...lats) };
}

export function parseCountryShapes(json: unknown): { iso3: string; name: string; bbox: BBox | null }[] {
  const features = (json as { features?: ShapeFeature[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  return features
    .filter((f) => typeof f.properties?.iso3 === "string" && typeof f.properties?.name === "string")
    .map((f) => ({ iso3: f.properties.iso3!, name: f.properties.name!, bbox: largestPolygonBBox(f.geometry) }));
}

/** Merges the basemap countries with the dataset's countries (dataset name first, basemap name as an alias). */
export function buildCountryIndex(shapes: { iso3: string; name: string; bbox: BBox | null }[], dataset: Country[]): CountryOption[] {
  const byIso = new Map<string, CountryOption>();
  for (const s of shapes) byIso.set(s.iso3, { iso3: s.iso3, name: s.name, aliases: [], bbox: s.bbox, hasData: false });
  for (const c of dataset) {
    const existing = byIso.get(c.iso3);
    if (existing) {
      if (existing.name !== c.name) existing.aliases.push(existing.name);
      existing.name = c.name;
      existing.hasData = true;
    } else {
      byIso.set(c.iso3, { iso3: c.iso3, name: c.name, aliases: [], bbox: null, hasData: true });
    }
  }
  return [...byIso.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Matches by the start of any word of the name or an alias, or by the ISO code; data countries first. */
export function searchCountries(index: CountryOption[], text: string, limit = 8): CountryOption[] {
  const q = text.trim().toLowerCase();
  if (!q) return index.filter((c) => c.hasData).slice(0, limit);
  const score = (c: CountryOption): number => {
    const names = [c.name, ...c.aliases].map((n) => n.toLowerCase());
    if (names.some((n) => n.startsWith(q))) return 0;
    if (c.iso3.toLowerCase() === q) return 1;
    if (names.some((n) => n.split(/[\s.,'()-]+/).some((w) => w.startsWith(q)))) return 2;
    return -1;
  };
  return index
    .map((c) => ({ c, s: score(c) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || Number(b.c.hasData) - Number(a.c.hasData) || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}

async function loadShapes(): Promise<{ iso3: string; name: string; bbox: BBox | null }[]> {
  try {
    const url = new URL(`${import.meta.env.BASE_URL}${COUNTRY_SHAPES_URL_PATH}`, window.location.origin).href;
    const response = await fetch(url);
    return response.ok ? parseCountryShapes(await response.json()) : [];
  } catch {
    // Basemap file not reachable: search still works for the dataset's countries (without zooming).
    return [];
  }
}

/** The merged country index (basemap + dataset). Never fails: falls back to the dataset's countries. */
export function useCountryIndex() {
  const countries = useCountries();
  const shapes = useQuery({ queryKey: ["country-shapes"], queryFn: loadShapes, staleTime: Infinity, retry: false });
  const index = buildCountryIndex(shapes.data ?? [], countries.data ?? []);
  return { index, isLoading: countries.isPending || shapes.isPending };
}
