/**
 * Demo datasets: built from the synthetic fixtures the app already uses (src/data/mock/), so the catalog always
 * matches the demo data and never adds anything. Every entry is synthetic or derived from synthetic data, and says
 * so. These entries exist in demo mode only (VITE_DATA_MODE other than "http").
 */
import { ANALYSES, AVAILABILITY, DEMO_WINDOW, DETECTIONS, EVENTS, SCENES, SYNTHETIC_FIRMS_PROVENANCE, detectionCountryIso3 } from "@/data/mock/fixtures";
import { SOURCE_NAMES, type BBox, type DatasetEntry, type SceneSummary } from "@/data/types";

const DEMO_PROVIDER_REASON = "Invented for this demo: there is no data provider.";
const DEMO_LICENCE_REASON = "Project-made demo data: no licence applies.";

function bboxOf(points: [number, number][]): BBox | null {
  if (points.length === 0) return null;
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return { west: Math.min(...lons), south: Math.min(...lats), east: Math.max(...lons), north: Math.max(...lats) };
}

const unique = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();

const base = {
  access: "demo" as const,
  provider: null,
  licence: null,
  citation: null,
  version: null,
  dates: [],
  fileRef: null,
  validation: null,
};

const eventOfScene = (sceneId: string) => EVENTS.find((e) => sceneId.startsWith(`${e.id}-`)) ?? null;

export const DEMO_HEAT_SPOTS_ID = "demo-heat-spots";
export const DEMO_POSSIBLE_FIRES_ID = "demo-possible-fires";
export const DEMO_ANALYSES_ID = "demo-analysis-results";
export const demoSceneId = (sceneId: string) => `demo-scene-${sceneId}`;

function heatSpots(): DatasetEntry {
  const times = DETECTIONS.map((d) => d.acquiredAt).sort();
  return {
    ...base,
    id: DEMO_HEAT_SPOTS_ID,
    title: "Demo heat spots (FIRMS-style, invented)",
    description: "Invented heat-spot points in the style of NASA FIRMS active-fire detections, used to demonstrate the Fire map. Not satellite observations.",
    kind: "active-fire-points",
    origin: "synthetic",
    derivedFrom: [],
    provenance: SYNTHETIC_FIRMS_PROVENANCE,
    source: { name: "Synthetic fixtures in this app", url: null },
    format: "Records generated in the app",
    spatialCoverage: {
      description: "Invented locations inside these countries",
      bbox: bboxOf(DETECTIONS.map((d) => d.geometry.coordinates)),
      countriesIso3: unique(DETECTIONS.map((d) => detectionCountryIso3(d.id))),
    },
    temporalCoverage: times.length ? { start: times[0], end: times[times.length - 1] } : null,
    acquisitionDate: null,
    recordCount: DETECTIONS.length,
    properties: [{ label: "Demo period", value: `${DEMO_WINDOW.start.slice(0, 10)} to ${DEMO_WINDOW.end.slice(0, 10)}` }],
    missingReasons: {
      provider: DEMO_PROVIDER_REASON,
      licence: DEMO_LICENCE_REASON,
      acquisitionDate: "A collection: each heat spot has its own (invented) time.",
    },
    canEstablish: ["How the app shows heat spots, density squares and possible fires."],
    cannotEstablish: ["Anything about real fires: the locations and times are invented.", "Burned area: heat spots are points, never burned-area outlines."],
    processing: ["Generated with a fixed random seed around invented centres (src/data/mock/detections.ts)"],
  };
}

function sceneTitle(s: SceneSummary): string {
  const band = s.sensor === "NISAR" ? (s.bands.length ? ` ${s.bands.join("+")}-band` : " (band not stated)") : s.sensor === "Sentinel-1" ? " C-band" : "";
  const product = s.provenance.productType ? ` ${s.provenance.productType}` : "";
  return `Demo radar scene ${s.id} (simulated ${s.sensor}${band}${product})`;
}

function scene(s: SceneSummary): DatasetEntry {
  const ev = eventOfScene(s.id);
  const missing = (label: string, value: string | null, reason: string) => ({ label, value, missingReason: value === null ? reason : null });
  return {
    ...base,
    id: demoSceneId(s.id),
    title: sceneTitle(s),
    description: `A simulated radar scene${ev ? ` for the demo possible fire ${ev.id}` : ""}. Its metadata is invented to show how the app handles real products, including missing values. Not a satellite observation.`,
    kind: "sar-scene",
    origin: "synthetic",
    derivedFrom: [],
    provenance: s.provenance,
    source: { name: `Synthetic fixtures in this app (simulating ${SOURCE_NAMES[s.provenance.source]})`, url: null },
    format: null,
    spatialCoverage: {
      description: "Invented footprint",
      bbox: bboxOf(s.footprint?.coordinates[0] ?? []),
      countriesIso3: ev ? [ev.country.iso3] : [],
    },
    temporalCoverage: null,
    acquisitionDate: { kind: "acquired", value: s.acquiredAt, note: "Invented demo date" },
    recordCount: null,
    properties: [
      { label: "Sensor (simulated)", value: s.sensor },
      missing("Radar band", s.sensor === "Sentinel-1" ? "C-band" : s.bands.length ? s.bands.map((b) => `${b}-band`).join(", ") : null, "Not stated in the (simulated) product"),
      missing("Product type", s.provenance.productType, "Not stated in the (simulated) product"),
      missing("Polarizations", s.polarizations?.join(", ") ?? null, "Not stated in the (simulated) product"),
      missing("Resolution", s.resolution.value === null ? null : `${s.resolution.value} m`, s.resolution.missingReason ?? "Not stated"),
      missing("Orbit direction", s.orbitDirection, "Not stated in the (simulated) product"),
      missing("Coordinate system", s.crs, "Not stated in the (simulated) product"),
      missing("Quality flags", s.qualityFlags === null ? null : s.qualityFlags.length ? s.qualityFlags.join(", ") : "None set", "Not stated in the (simulated) product"),
    ],
    missingReasons: {
      provider: DEMO_PROVIDER_REASON,
      licence: DEMO_LICENCE_REASON,
      format: "No file exists: the scene is a simulated metadata record.",
      temporalCoverage: "A single scene: see the acquisition date.",
      recordCount: "Not applicable: one scene.",
      acquisitionDate: "Not stated in the (simulated) product.",
    },
    canEstablish: ["How the app checks whether two radar scenes can be compared."],
    cannotEstablish: ["Anything about the real ground surface: no image exists.", s.sensor === "Sentinel-1" ? "Anything about NISAR: this simulates Sentinel-1 (C-band)." : "Anything about real NISAR products, whose file layout is not yet verified."],
    processing: ["Created as a synthetic fixture (src/data/mock/fixtures.ts)"],
  };
}

function possibleFires(): DatasetEntry {
  const first = EVENTS.map((e) => e.firstDetection).filter(Boolean).sort() as string[];
  const last = EVENTS.map((e) => e.lastDetection).filter(Boolean).sort() as string[];
  return {
    ...base,
    id: DEMO_POSSIBLE_FIRES_ID,
    title: "Demo possible fires (grouped demo heat spots)",
    description: "Groups of nearby demo heat spots, shown as possible fires on the Fire map and in Fire history. Derived from invented data; not confirmed fires.",
    kind: "fire-events",
    origin: "derived",
    derivedFrom: [DEMO_HEAT_SPOTS_ID],
    provenance: EVENTS[0]?.provenance ?? null,
    source: { name: "Computed from the demo heat spots in this app", url: null },
    format: "Records in the app",
    spatialCoverage: { description: "Invented locations inside these countries", bbox: bboxOf(EVENTS.map((e) => [e.centroid.lon, e.centroid.lat])), countriesIso3: unique(EVENTS.map((e) => e.country.iso3)) },
    temporalCoverage: first.length && last.length ? { start: first[0], end: last[last.length - 1] } : null,
    acquisitionDate: null,
    recordCount: EVENTS.length,
    properties: [{ label: "Status of every possible fire", value: "Candidate (not confirmed)" }],
    missingReasons: { provider: DEMO_PROVIDER_REASON, licence: DEMO_LICENCE_REASON, acquisitionDate: "A collection: see the temporal coverage." },
    canEstablish: ["That demo heat spots cluster in space and time."],
    cannotEstablish: ["That any fire happened: the input is invented, and possible fires are never confirmed."],
    processing: ["Demo heat spots grouped by invented event (fixtures)"],
  };
}

function analyses(): DatasetEntry {
  const sceneIds = unique(AVAILABILITY.flatMap((r) => r.pairs.flatMap((p) => [p.preSceneId, p.postSceneId])));
  return {
    ...base,
    id: DEMO_ANALYSES_ID,
    title: "Demo radar change analysis results (simulated)",
    description: "Simulated results of the radar change analysis for the demo possible fires, including locked and failed cases. No real processing was run.",
    kind: "analysis-results",
    origin: "derived",
    derivedFrom: sceneIds.map(demoSceneId),
    provenance: ANALYSES[0]?.provenance ?? null,
    source: { name: "Simulated results in this app", url: null },
    format: "Records in the app",
    spatialCoverage: { description: "The demo possible fires", bbox: null, countriesIso3: unique(EVENTS.map((e) => e.country.iso3)) },
    temporalCoverage: null,
    acquisitionDate: null,
    recordCount: ANALYSES.length,
    properties: [{ label: "Results with an estimated changed area", value: String(ANALYSES.filter((a) => a.status === "complete").length) }],
    missingReasons: {
      provider: DEMO_PROVIDER_REASON,
      licence: DEMO_LICENCE_REASON,
      temporalCoverage: "Each result refers to its own (invented) scene pair.",
      acquisitionDate: "Not applicable: results, not observations.",
    },
    canEstablish: ["How results, uncertainty and locked or failed analyses are shown."],
    cannotEstablish: ["Any real surface change or burned area: the results are simulated."],
    processing: ["Simulated log-ratio change and threshold (no real processing)"],
  };
}

/** All demo datasets, in display order. */
export function demoDatasets(): DatasetEntry[] {
  return [heatSpots(), possibleFires(), ...SCENES.map(scene), analyses()];
}
