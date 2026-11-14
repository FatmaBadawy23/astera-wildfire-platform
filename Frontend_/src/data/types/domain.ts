/** @provisional See values.ts. All times are ISO 8601 strings in UTC. */
import type { NisarBand, Provenance, SourceKind } from "./provenance";
import type { SciValue } from "./values";

export interface GeoPoint {
  lon: number;
  lat: number;
}

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Country {
  /** ISO 3166-1 alpha-3. */
  iso3: string;
  name: string;
}

export interface TimeWindow {
  start: string;
  end: string;
}

/** A candidate fire event discovered from FIRMS detections. Never a confirmed burned area. */
export interface FireEvent {
  id: string;
  name: string;
  country: Country;
  centroid: GeoPoint;
  bbox: BBox;
  firstDetection: string | null;
  lastDetection: string | null;
  detectionCount: SciValue<number>;
  status: "candidate";
  /** Sources with data for this event (FIRMS detections, SAR sensors). */
  dataSources: SourceKind[];
  description: string | null;
  provenance: Provenance;
}

/** FIRMS active-fire detection: a thermal detection POINT, never an area. No intensity (FRP) field. */
export interface ActiveFireDetection {
  id: string;
  eventId: string | null;
  geometry: { type: "Point"; coordinates: [lon: number, lat: number] };
  acquiredAt: string;
  satellite: string | null;
  instrument: string | null;
  /** Confidence exactly as provided by the source, or null. */
  confidence: string | null;
  provenance: Provenance;
}

export interface DetectionSet {
  window: TimeWindow;
  detections: ActiveFireDetection[];
}

export interface DetectionQuery {
  window: TimeWindow;
  bbox?: BBox;
  countryIso3?: string;
  eventId?: string;
}

export type SensorName = "NISAR" | "Sentinel-1" | "Mock SAR";

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: [number, number][][];
}

export interface SceneSummary {
  id: string;
  sensor: SensorName;
  /** NISAR bands stated by the product (empty = not stated). Sentinel-1 is C-band by definition. */
  bands: NisarBand[];
  polarizations: string[] | null;
  acquiredAt: string | null;
  orbitDirection: "ascending" | "descending" | null;
  footprint: PolygonGeometry | null;
  /** Share of the event area covered by the scene, in percent. */
  eventCoverage: SciValue<number>;
  resolution: SciValue<number>;
  crs: string | null;
  qualityFlags: string[] | null;
  provenance: Provenance;
}

export type PairStatus = "suitable" | "unsuitable" | "missing";

export type PairReason =
  | "NO_PRE_SCENE"
  | "NO_POST_SCENE"
  | "DIFFERENT_SENSOR"
  | "DIFFERENT_BAND"
  | "DIFFERENT_PRODUCT"
  | "POLARIZATION_MISMATCH"
  | "INSUFFICIENT_COVERAGE"
  | "METADATA_MISSING"
  | "DATE_ORDER"
  | "QUALITY_FLAG";

export interface ScenePair {
  id: string;
  preSceneId: string | null;
  postSceneId: string | null;
  status: PairStatus;
  reasons: PairReason[];
}

export interface AvailabilityReport {
  eventId: string;
  preWindow: TimeWindow;
  postWindow: TimeWindow;
  preScenes: SceneSummary[];
  postScenes: SceneSummary[];
  pairs: ScenePair[];
  checkedAt: string | null;
  provenance: Provenance;
}

export type AnalysisStatus = "locked" | "not-run" | "running" | "complete" | "failed";

export interface AnalysisResult {
  id: string;
  eventId: string;
  pairId: string | null;
  status: AnalysisStatus;
  statusReason: string | null;
  method: { name: string | null; polarization: string | null; threshold: SciValue<number> } | null;
  meanChangeDb: SciValue<number>;
  /** Always kind "estimated", with method and units. */
  changedArea: SciValue<number>;
  confidence: { level: "low" | "moderate" | "high" | null; explanation: string | null };
  limitations: string[];
  layers: { differenceMap: string | null; changeMask: string | null };
  provenance: Provenance;
}
