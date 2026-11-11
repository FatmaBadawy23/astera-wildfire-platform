/**
 * SYNTHETIC FIXTURES (Stage F3). Every record is origin "synthetic", has a SYN- ID and the note
 * "Synthetic example, not a satellite observation." Locations are synthetic coordinates inside real
 * countries (needed for the country filter); they don't describe any real wildfire incident.
 * SAR scenes and analysis results are simulated for UI development only: they are not NISAR or
 * Sentinel-1 observations and not backend results.
 *
 * Six scenarios cover every UI state:
 *   SYN-01 NISAR L-band GCOV pair, suitable, analysis complete
 *   SYN-02 NISAR scenes without stated band / polarization / resolution → metadata missing, locked
 *   SYN-03 Sentinel-1 C-band pair, suitable, analysis complete (never shown as NISAR)
 *   SYN-04 no pre-fire scene → missing, locked
 *   SYN-05 L-band GCOV before, S-band GSLC after → different band and product, locked
 *   SYN-06 suitable NISAR L-band pair, analysis failed
 */
import {
  SYNTHETIC_NOTE,
  type AnalysisResult,
  type AvailabilityReport,
  type Country,
  type FireEvent,
  type GeoPoint,
  type NisarBand,
  type Provenance,
  type SceneSummary,
  type SciValue,
  type SensorName,
  type SourceKind,
  type TimeWindow,
} from "../types";
import { generateDetections, SYNTHETIC_FIRMS_PROVENANCE, type DetectionSeed } from "./detections";

/** Fixed demonstration period for all synthetic data. */
export const DEMO_WINDOW: TimeWindow = { start: "2026-07-01T00:00:00Z", end: "2026-08-31T23:59:59Z" };

export const SIMULATED_NOTE = "Simulated metadata for interface development; not from a real satellite product.";

const COUNTRIES = {
  USA: { iso3: "USA", name: "United States" },
  AUS: { iso3: "AUS", name: "Australia" },
  PRT: { iso3: "PRT", name: "Portugal" },
  CAN: { iso3: "CAN", name: "Canada" },
  GRC: { iso3: "GRC", name: "Greece" },
  BRA: { iso3: "BRA", name: "Brazil" },
} satisfies Record<string, Country>;

function synthetic(source: SourceKind, extra: Partial<Provenance> = {}): Provenance {
  return {
    origin: "synthetic",
    source,
    productType: null,
    bands: [],
    processing: [{ step: "Created as a Stage F3 synthetic fixture", at: null, detail: null }],
    notes: [SYNTHETIC_NOTE],
    ...extra,
  };
}

const val = <T,>(value: T | null, kind: SciValue<T>["kind"], unit: string | null, extra: Partial<SciValue<T>> = {}): SciValue<T> => ({
  value,
  kind,
  unit,
  ...extra,
});

// ------------------------------------------------------------------ events + detections
interface EventSeed {
  id: string;
  country: Country;
  center: GeoPoint;
  start: string;
  end: string;
  count: number;
  dataSources: SourceKind[];
}

const EVENT_SEEDS: EventSeed[] = [
  { id: "SYN-01", country: COUNTRIES.USA, center: { lon: -120.62, lat: 38.91 }, start: "2026-07-12T00:00:00Z", end: "2026-07-24T00:00:00Z", count: 120, dataSources: ["firms", "nisar"] },
  { id: "SYN-02", country: COUNTRIES.AUS, center: { lon: 150.31, lat: -33.62 }, start: "2026-07-05T00:00:00Z", end: "2026-07-15T00:00:00Z", count: 90, dataSources: ["firms", "nisar"] },
  { id: "SYN-03", country: COUNTRIES.PRT, center: { lon: -8.02, lat: 40.12 }, start: "2026-08-02T00:00:00Z", end: "2026-08-12T00:00:00Z", count: 110, dataSources: ["firms", "sentinel-1"] },
  { id: "SYN-04", country: COUNTRIES.CAN, center: { lon: -115.48, lat: 55.21 }, start: "2026-07-20T00:00:00Z", end: "2026-07-28T00:00:00Z", count: 80, dataSources: ["firms", "nisar"] },
  { id: "SYN-05", country: COUNTRIES.GRC, center: { lon: 23.41, lat: 38.29 }, start: "2026-08-10T00:00:00Z", end: "2026-08-18T00:00:00Z", count: 70, dataSources: ["firms", "nisar"] },
  { id: "SYN-06", country: COUNTRIES.BRA, center: { lon: -55.63, lat: -12.48 }, start: "2026-08-20T00:00:00Z", end: "2026-08-27T00:00:00Z", count: 100, dataSources: ["firms", "nisar"] },
];

/** Detections not assigned to any event (scattered single detections). */
const UNASSIGNED_SEEDS: DetectionSeed[] = Object.values(COUNTRIES).map((_country, i) => ({
  eventId: null,
  center: EVENT_SEEDS[i].center,
  spread: 1.5,
  start: DEMO_WINDOW.start,
  end: DEMO_WINDOW.end,
  count: 7,
}));

export const DETECTIONS = generateDetections([
  ...EVENT_SEEDS.map((e) => ({ eventId: e.id, center: e.center, spread: 0.12, start: e.start, end: e.end, count: e.count })),
  ...UNASSIGNED_SEEDS,
]);

/**
 * Country of a synthetic detection (mock-only helper for the country filter; FIRMS records themselves
 * carry no country). Seeds 1–6 are the events, 7–12 the unassigned detections, in COUNTRIES order.
 */
export function detectionCountryIso3(detectionId: string): string | null {
  const seedIndex = Number(detectionId.slice(6, 8)) - 1;
  if (seedIndex < EVENT_SEEDS.length) return EVENT_SEEDS[seedIndex]?.country.iso3 ?? null;
  return Object.values(COUNTRIES)[seedIndex - EVENT_SEEDS.length]?.iso3 ?? null;
}

function buildEvent(seed: EventSeed, n: number): FireEvent {
  const own = DETECTIONS.filter((d) => d.eventId === seed.id);
  const lons = own.map((d) => d.geometry.coordinates[0]);
  const lats = own.map((d) => d.geometry.coordinates[1]);
  const times = own.map((d) => d.acquiredAt).sort();
  return {
    id: seed.id,
    name: `Synthetic demo event ${String(n).padStart(2, "0")}`,
    country: seed.country,
    centroid: seed.center,
    bbox: { west: Math.min(...lons), south: Math.min(...lats), east: Math.max(...lons), north: Math.max(...lats) },
    firstDetection: times[0] ?? null,
    lastDetection: times[times.length - 1] ?? null,
    detectionCount: val(own.length, "derived", "detections", { method: "Count of synthetic FIRMS-style detections assigned to the event" }),
    status: "candidate",
    dataSources: seed.dataSources,
    description: "A cluster of synthetic FIRMS-style detections used to demonstrate the interface. Not a real fire.",
    provenance: synthetic("firms", { notes: [SYNTHETIC_NOTE, "Event grouping of synthetic detections; not a confirmed burned area."] }),
  };
}

export const EVENTS: FireEvent[] = EVENT_SEEDS.map((s, i) => buildEvent(s, i + 1));
export const COUNTRY_LIST: Country[] = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name));

// ------------------------------------------------------------------ scenes
interface SceneSpec {
  id: string;
  sensor: SensorName;
  bands: NisarBand[];
  productType: string | null;
  polarizations: string[] | null;
  acquiredAt: string | null;
  center: GeoPoint;
  coverage: number | null;
  resolution: number | null;
  orbit: "ascending" | "descending" | null;
  crs: string | null;
  quality: string[] | null;
}

function scene(s: SceneSpec): SceneSummary {
  const source: SourceKind = s.sensor === "NISAR" ? "nisar" : s.sensor === "Sentinel-1" ? "sentinel-1" : "mock-sar";
  const d = 0.5;
  return {
    id: s.id,
    sensor: s.sensor,
    bands: s.bands,
    polarizations: s.polarizations,
    acquiredAt: s.acquiredAt,
    orbitDirection: s.orbit,
    footprint: {
      type: "Polygon",
      coordinates: [[
        [s.center.lon - d, s.center.lat - d],
        [s.center.lon + d, s.center.lat - d],
        [s.center.lon + d, s.center.lat + d],
        [s.center.lon - d, s.center.lat + d],
        [s.center.lon - d, s.center.lat - d],
      ]],
    },
    eventCoverage: val(s.coverage, "derived", "%", s.coverage === null ? { missingReason: "Footprint or event area not available" } : { method: "Share of the event bounding box inside the scene footprint" }),
    resolution: val(s.resolution, "measured", "m", s.resolution === null ? { missingReason: "Not stated in the product metadata" } : {}),
    crs: s.crs,
    qualityFlags: s.quality,
    provenance: synthetic(source, {
      productType: s.productType,
      bands: s.bands,
      notes: [SYNTHETIC_NOTE, SIMULATED_NOTE],
    }),
  };
}

const c = (id: string) => EVENT_SEEDS.find((e) => e.id === id)!.center;

export const SCENES: SceneSummary[] = [
  // SYN-01: suitable NISAR L-band GCOV pair
  scene({ id: "SYN-01-S1", sensor: "NISAR", bands: ["L"], productType: "GCOV", polarizations: ["HH", "HV"], acquiredAt: "2026-07-03T13:42:00Z", center: c("SYN-01"), coverage: 100, resolution: 20, orbit: "ascending", crs: "EPSG:32610", quality: [] }),
  scene({ id: "SYN-01-S2", sensor: "NISAR", bands: ["L"], productType: "GCOV", polarizations: ["HH", "HV"], acquiredAt: "2026-07-27T13:42:00Z", center: c("SYN-01"), coverage: 100, resolution: 20, orbit: "ascending", crs: "EPSG:32610", quality: [] }),
  // SYN-02: band, polarization and resolution not stated
  scene({ id: "SYN-02-S1", sensor: "NISAR", bands: [], productType: "GCOV", polarizations: null, acquiredAt: "2026-06-28T19:05:00Z", center: c("SYN-02"), coverage: null, resolution: null, orbit: null, crs: null, quality: null }),
  scene({ id: "SYN-02-S2", sensor: "NISAR", bands: [], productType: "GCOV", polarizations: null, acquiredAt: "2026-07-22T19:05:00Z", center: c("SYN-02"), coverage: null, resolution: null, orbit: null, crs: null, quality: null }),
  // SYN-03: Sentinel-1 C-band pair
  scene({ id: "SYN-03-S1", sensor: "Sentinel-1", bands: [], productType: "RTC", polarizations: ["VV", "VH"], acquiredAt: "2026-07-27T18:21:00Z", center: c("SYN-03"), coverage: 96, resolution: 30, orbit: "descending", crs: "EPSG:32629", quality: [] }),
  scene({ id: "SYN-03-S2", sensor: "Sentinel-1", bands: [], productType: "RTC", polarizations: ["VV", "VH"], acquiredAt: "2026-08-20T18:21:00Z", center: c("SYN-03"), coverage: 96, resolution: 30, orbit: "descending", crs: "EPSG:32629", quality: [] }),
  // SYN-04: post-fire scene only
  scene({ id: "SYN-04-S2", sensor: "NISAR", bands: ["L"], productType: "GCOV", polarizations: ["HH", "HV"], acquiredAt: "2026-08-03T02:10:00Z", center: c("SYN-04"), coverage: 88, resolution: 20, orbit: "descending", crs: "EPSG:32611", quality: [] }),
  // SYN-05: L-band GCOV before, S-band GSLC after
  scene({ id: "SYN-05-S1", sensor: "NISAR", bands: ["L"], productType: "GCOV", polarizations: ["HH", "HV"], acquiredAt: "2026-08-01T04:30:00Z", center: c("SYN-05"), coverage: 100, resolution: 20, orbit: "ascending", crs: "EPSG:32634", quality: [] }),
  scene({ id: "SYN-05-S2", sensor: "NISAR", bands: ["S"], productType: "GSLC", polarizations: ["HH", "HV"], acquiredAt: "2026-08-24T04:30:00Z", center: c("SYN-05"), coverage: 74, resolution: 10, orbit: "ascending", crs: "EPSG:32634", quality: [] }),
  // SYN-06: suitable pair (analysis fails)
  scene({ id: "SYN-06-S1", sensor: "NISAR", bands: ["L"], productType: "GCOV", polarizations: ["HH", "HV"], acquiredAt: "2026-08-11T09:15:00Z", center: c("SYN-06"), coverage: 100, resolution: 20, orbit: "descending", crs: "EPSG:32721", quality: [] }),
  scene({ id: "SYN-06-S2", sensor: "NISAR", bands: ["L"], productType: "GCOV", polarizations: ["HH", "HV"], acquiredAt: "2026-08-30T09:15:00Z", center: c("SYN-06"), coverage: 100, resolution: 20, orbit: "descending", crs: "EPSG:32721", quality: [] }),
];

const sceneById = (id: string) => SCENES.find((s) => s.id === id)!;

// ------------------------------------------------------------------ availability
function windows(eventId: string): { preWindow: TimeWindow; postWindow: TimeWindow } {
  const e = EVENTS.find((x) => x.id === eventId)!;
  const first = Date.parse(e.firstDetection!);
  const last = Date.parse(e.lastDetection!);
  const day = 86_400_000;
  return {
    preWindow: { start: new Date(first - 30 * day).toISOString(), end: new Date(first).toISOString() },
    postWindow: { start: new Date(last).toISOString(), end: new Date(last + 30 * day).toISOString() },
  };
}

function report(eventId: string, pre: string[], post: string[], pairs: AvailabilityReport["pairs"]): AvailabilityReport {
  return {
    eventId,
    ...windows(eventId),
    preScenes: pre.map(sceneById),
    postScenes: post.map(sceneById),
    pairs,
    checkedAt: "2026-09-01T00:00:00Z",
    provenance: synthetic("mock-sar", { notes: [SYNTHETIC_NOTE, "Simulated availability check for interface development."] }),
  };
}

export const AVAILABILITY: AvailabilityReport[] = [
  report("SYN-01", ["SYN-01-S1"], ["SYN-01-S2"], [{ id: "SYN-01-P1", preSceneId: "SYN-01-S1", postSceneId: "SYN-01-S2", status: "suitable", reasons: [] }]),
  report("SYN-02", ["SYN-02-S1"], ["SYN-02-S2"], [{ id: "SYN-02-P1", preSceneId: "SYN-02-S1", postSceneId: "SYN-02-S2", status: "unsuitable", reasons: ["METADATA_MISSING"] }]),
  report("SYN-03", ["SYN-03-S1"], ["SYN-03-S2"], [{ id: "SYN-03-P1", preSceneId: "SYN-03-S1", postSceneId: "SYN-03-S2", status: "suitable", reasons: [] }]),
  report("SYN-04", [], ["SYN-04-S2"], [{ id: "SYN-04-P1", preSceneId: null, postSceneId: "SYN-04-S2", status: "missing", reasons: ["NO_PRE_SCENE"] }]),
  report("SYN-05", ["SYN-05-S1"], ["SYN-05-S2"], [{ id: "SYN-05-P1", preSceneId: "SYN-05-S1", postSceneId: "SYN-05-S2", status: "unsuitable", reasons: ["DIFFERENT_BAND", "DIFFERENT_PRODUCT"] }]),
  report("SYN-06", ["SYN-06-S1"], ["SYN-06-S2"], [{ id: "SYN-06-P1", preSceneId: "SYN-06-S1", postSceneId: "SYN-06-S2", status: "suitable", reasons: [] }]),
];

// ------------------------------------------------------------------ analysis
const SIMULATED_RESULT_NOTE = "Simulated analysis result for interface development; not produced by the processing pipeline.";

const LIMITATIONS = [
  "Synthetic example: the numbers demonstrate the interface only.",
  "Backscatter change depends on vegetation, soil moisture, roughness, viewing geometry, frequency and polarization; it is not a direct measure of burned area.",
  "The change threshold is data-driven for each scene pair; no universal threshold is applied.",
];

function noResult(eventId: string, status: AnalysisResult["status"], reason: string, pairId: string | null, sourceKind: SourceKind, bands: NisarBand[]): AnalysisResult {
  return {
    id: `${eventId}-A1`,
    eventId,
    pairId,
    status,
    statusReason: reason,
    method: null,
    meanChangeDb: val<number>(null, "derived", "dB", { missingReason: reason }),
    changedArea: val<number>(null, "estimated", "km²", { missingReason: reason }),
    confidence: { level: null, explanation: null },
    limitations: [],
    layers: { differenceMap: null, changeMask: null },
    provenance: synthetic(sourceKind, { bands, notes: [SYNTHETIC_NOTE, SIMULATED_RESULT_NOTE] }),
  };
}

function complete(
  eventId: string,
  pairId: string,
  sourceKind: SourceKind,
  bands: NisarBand[],
  productType: string,
  polarization: string,
  thresholdDb: number,
  meanDb: number,
  areaKm2: number,
  range: [number, number],
): AnalysisResult {
  return {
    id: `${eventId}-A1`,
    eventId,
    pairId,
    status: "complete",
    statusReason: null,
    method: {
      name: "Log-ratio backscatter change with a data-driven threshold (simulated)",
      polarization,
      threshold: val(thresholdDb, "derived", "dB", { method: "Chosen from the scene pair's change distribution (simulated)" }),
    },
    meanChangeDb: val(meanDb, "derived", "dB", { method: "Mean of post − pre backscatter inside the event area (simulated)" }),
    changedArea: val(areaKm2, "estimated", "km²", {
      method: "Change-mask pixels × pixel area in an equal-area projection (simulated)",
      uncertainty: { lower: range[0], upper: range[1], description: "Range from varying the threshold (simulated)" },
    }),
    confidence: { level: "moderate", explanation: "Simulated: one scene pair, no independent reference data." },
    limitations: LIMITATIONS,
    layers: { differenceMap: null, changeMask: null },
    provenance: synthetic(sourceKind, {
      productType,
      bands,
      processing: [
        { step: "Created as a Stage F3 synthetic fixture", at: null, detail: null },
        { step: "Simulated: log-ratio change and threshold", at: null, detail: "No real processing was run" },
      ],
      notes: [SYNTHETIC_NOTE, SIMULATED_RESULT_NOTE],
    }),
  };
}

export const ANALYSES: AnalysisResult[] = [
  complete("SYN-01", "SYN-01-P1", "nisar", ["L"], "GCOV", "HV", -2.6, -2.14, 18.4, [15.9, 21.2]),
  noResult("SYN-02", "locked", "Locked: no suitable pre/post scene pair (required metadata is missing).", null, "nisar", []),
  complete("SYN-03", "SYN-03-P1", "sentinel-1", [], "RTC", "VH", -3.1, -2.87, 9.7, [8.1, 11.6]),
  noResult("SYN-04", "locked", "Locked: no pre-fire scene is available.", null, "nisar", ["L"]),
  noResult("SYN-05", "locked", "Locked: the scenes use different bands and product types.", null, "nisar", ["L", "S"]),
  noResult("SYN-06", "failed", "Processing failed (simulated failure for interface development). No result was produced.", "SYN-06-P1", "nisar", ["L"]),
];

export { SYNTHETIC_FIRMS_PROVENANCE };
