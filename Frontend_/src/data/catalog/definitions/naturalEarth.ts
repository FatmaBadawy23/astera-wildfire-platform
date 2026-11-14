/**
 * Real reference data bundled with the app: Natural Earth (public domain). Every value here comes from
 * frontend/public/basemap/relief/SOURCE.txt and docs/data/DATA_SOURCES.md. Values that were not recorded stay null,
 * with the reason. To update an entry (e.g. after a re-download), change it here and keep its ID.
 */
import type { DatasetEntry } from "@/data/types";

const WORLD = { west: -180, south: -90, east: 180, north: 90 };
const NE_HOME = "https://www.naturalearthdata.com";

export const NATURAL_EARTH_DATASETS: DatasetEntry[] = [
  {
    id: "ne-110m-admin0-countries",
    title: "Natural Earth country outlines and names (1:110m)",
    description:
      "Simplified outlines, names and label positions of the world's countries. Astera Watch uses them for the map's borders and country names and for the country search.",
    kind: "vector-boundaries",
    origin: "real",
    access: "bundled",
    derivedFrom: [],
    provenance: null,
    provider: "Natural Earth",
    source: { name: "Natural Earth 1:110m Cultural Vectors, Admin 0 – Countries (ne_110m_admin_0_countries)", url: NE_HOME },
    format: "GeoJSON (outlines) and JSON (label points), in the app's files",
    licence: "Public domain",
    citation: null,
    version: null,
    spatialCoverage: { description: "Whole world", bbox: WORLD, countriesIso3: [] },
    temporalCoverage: null,
    acquisitionDate: null,
    dates: [{ kind: "downloaded", value: "2026-11-11", note: null }],
    recordCount: null,
    properties: [
      { label: "Scale", value: "1:110m (simplified)" },
      { label: "Fields kept", value: "ISO 3166-1 alpha-3 code, name, outline; label point and label ranks" },
    ],
    missingReasons: {
      version: "The Natural Earth release version was not recorded when the file was downloaded.",
      citation: "No citation text was recorded.",
      temporalCoverage: "Not applicable: a generalised map, not an observation of a date.",
      acquisitionDate: "Not applicable: a generalised map, not an observation of a date.",
      recordCount: "Not recorded in the catalog.",
    },
    canEstablish: ["General country outlines and names, for orientation and search."],
    cannotEstablish: ["Authoritative or disputed borders: outlines are simplified (1:110m).", "Anything about fires, land cover or damage."],
    processing: ["Reduced to ISO3 code and name", "Coordinates rounded to 2 decimals", "Label points and ranks kept in a separate file"],
    fileRef: null,
    validation: null,
  },
  {
    id: "ne-50m-shaded-relief",
    title: "Natural Earth I with Shaded Relief and Water (1:50m)",
    description:
      "A stylised, long-term picture of land cover with shaded relief and water, used as the map background. Green usually means vegetated, tan or brown dry or bare land, white ice.",
    kind: "raster-context",
    origin: "real",
    access: "bundled",
    derivedFrom: [],
    provenance: null,
    provider: "Natural Earth",
    source: { name: "Natural Earth I with Shaded Relief and Water, 1:50m (NE1_50M_SR_W)", url: "https://naciscdn.org/naturalearth/50m/raster/NE1_50M_SR_W.zip" },
    format: "JPEG map tiles, 512 px, zoom 0–4, Web Mercator (EPSG:3857), in the app's files",
    licence: "Public domain",
    citation: null,
    version: null,
    spatialCoverage: { description: "Whole world", bbox: WORLD, countriesIso3: [] },
    temporalCoverage: null,
    acquisitionDate: null,
    dates: [{ kind: "downloaded", value: "2026-11-13", note: null }],
    recordCount: null,
    properties: [
      { label: "Scale", value: "1:50m (looks soft when zoomed in beyond level 4)" },
      { label: "Colours", value: "Unchanged in the files; the app softens them per theme" },
    ],
    missingReasons: {
      version: "The Natural Earth release version was not recorded.",
      citation: "No citation text was recorded.",
      temporalCoverage: "Not applicable: a long-term generalised picture, not an observation of a date.",
      acquisitionDate: "Not applicable: a long-term generalised picture, not an observation of a date.",
      recordCount: "Not applicable: a map image.",
    },
    canEstablish: ["General geographic context: relief, water, and broadly vegetated or dry regions."],
    cannotEstablish: ["Current vegetation or land cover.", "Fire, burned land or damage: a green area may already have burned.", "Anything at a specific date."],
    processing: [
      "Reprojected from WGS84 to Web Mercator (EPSG:3857, bilinear, 8192 × 8192 px)",
      "Polar rows outside the source filled with the image's own ocean colour",
      "Cut into 512 px tiles for zoom 0–4 (box-average for lower zooms), JPEG quality 82",
    ],
    fileRef: null,
    validation: null,
  },
];
