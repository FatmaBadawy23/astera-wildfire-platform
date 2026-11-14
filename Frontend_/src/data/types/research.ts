/**
 * @provisional Research Center types (stages R0 and R2). Only `ResearchProject` is used so far: R2 keeps projects in
 * this browser through `src/data/research/` (a repository that a backend adapter can replace). The other types are
 * not created, stored or fetched by any code yet. They are an input to the Stage 1 contracts and will be replaced or
 * mapped then (docs/architecture/RESEARCH_CENTER.md).
 *
 * Rules carried by the types:
 * - Missing values are null, never invented.
 * - Every dataset, annotation and model output has provenance; synthetic data stays labelled as synthetic.
 * - Annotations are a person's interpretation, never a burned-area measurement.
 * - Model outputs are estimates with uncertainty and name the model version that produced them.
 * - Institutions appear only with a verified agreement.
 */
import type { BBox, PolygonGeometry, TimeWindow } from "./domain";
import type { Provenance } from "./provenance";
import type { SciValue } from "./values";

export const RESEARCH_CONTRACT_VERSION = "r2-provisional-1";

/** ISO 8601 timestamp (UTC). */
export type IsoDateTime = string;

/** Where a record is kept. Since R2, research projects are kept in this browser ("browser"); nothing uses "server" yet. */
export type ResearchStorage = "none" | "browser" | "server";

// ---------------------------------------------------------------------------------------------------------------
// Projects and study areas
// ---------------------------------------------------------------------------------------------------------------

export interface StudyArea {
  /** Drawn by the researcher (annotation stage, not built). Null until defined. */
  geometry: PolygonGeometry | null;
  bbox: BBox | null;
  /** ISO 3166-1 alpha-3 codes of countries the project covers. */
  countriesIso3: string[];
  /** The area in the researcher's own words, e.g. "coastal hills north of the river". Null when not given. */
  description: string | null;
}

/** Where the researcher says the project stands. Set by the person, never inferred. */
export type ProjectStatus = "planning" | "in-progress" | "on-hold" | "completed";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  "in-progress": "In progress",
  "on-hold": "On hold",
  completed: "Completed",
};

export interface ResearchProject {
  id: string;
  title: string;
  description: string | null;
  /** Research objectives in the researcher's own words, one per entry. */
  objectives: string[];
  status: ProjectStatus;
  studyArea: StudyArea;
  period: TimeWindow | null;
  /** Possible-fire IDs linked from the existing data (they keep their own provenance). */
  linkedEventIds: string[];
  datasetIds: string[];
  annotationIds: string[];
  modelRunIds: string[];
  reportIds: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  storage: ResearchStorage;
}

// ---------------------------------------------------------------------------------------------------------------
// Datasets (satellite imagery, environmental and geospatial data)
// ---------------------------------------------------------------------------------------------------------------

export type DatasetKind =
  | "sar-scene"
  | "optical-scene"
  | "active-fire-points"
  | "fire-events"
  | "analysis-results"
  | "vector-boundaries"
  | "raster-context"
  | "environmental-series"
  | "other";

export const DATASET_KIND_LABELS: Record<DatasetKind, string> = {
  "sar-scene": "Radar scene",
  "optical-scene": "Optical image",
  "active-fire-points": "Heat spots (points)",
  "fire-events": "Possible fires (groups of heat spots)",
  "analysis-results": "Analysis results",
  "vector-boundaries": "Boundaries (vector)",
  "raster-context": "Background map (raster)",
  "environmental-series": "Environmental time series",
  other: "Other",
};

/**
 * Where a dataset's content comes from. Always shown, never inferred from the title.
 * - "real": real-world data from a named provider (today: Natural Earth reference maps only).
 * - "synthetic": invented for demonstration; never a satellite observation.
 * - "derived": computed from other catalog datasets (`derivedFrom`); it is demo data if any input is.
 */
export type DatasetOrigin = "real" | "synthetic" | "derived";

/** How the app holds a dataset today. Only accessible datasets are catalog entries; unconnected sources are `DataSourceEntry`. */
export type DatasetAccess = "bundled" | "demo" | "backend";

/** What a date means. A download date is never an acquisition date. */
export type DatasetDateKind = "acquired" | "downloaded" | "generated";

export interface DatasetDate {
  kind: DatasetDateKind;
  /** ISO 8601; null = not available. */
  value: IsoDateTime | null;
  note: string | null;
}

/** Metadata fields a dataset page shows; used to record why a value is missing. */
export type DatasetField =
  | "provider"
  | "source"
  | "format"
  | "licence"
  | "citation"
  | "version"
  | "spatialCoverage"
  | "temporalCoverage"
  | "acquisitionDate"
  | "recordCount";

export interface DatasetEntry {
  /** Stable ID: projects store it. Never reuse an ID for different content. */
  id: string;
  title: string;
  description: string;
  kind: DatasetKind;
  origin: DatasetOrigin;
  access: DatasetAccess;
  /** For derived datasets: the catalog IDs it was computed from. */
  derivedFrom: string[];
  /** Per-record provenance where the records carry one (demo data); null for reference maps. */
  provenance: Provenance | null;
  provider: string | null;
  source: { name: string | null; url: string | null };
  format: string | null;
  /** Licence exactly as stated by the provider; null = not stated (shown as "Not available"). */
  licence: string | null;
  /** Provider's citation text, if it asks for one. */
  citation: string | null;
  version: string | null;
  spatialCoverage: { description: string | null; bbox: BBox | null; countriesIso3: string[] };
  temporalCoverage: TimeWindow | null;
  /** Acquisition date of an observation (one scene). Null for collections and maps that have none. */
  acquisitionDate: DatasetDate | null;
  /** Other dates that matter (download, generation), each with its kind. */
  dates: DatasetDate[];
  recordCount: number | null;
  /**
   * Further metadata specific to the data type (e.g. sensor, band, polarizations, resolution for a radar scene), so new
   * kinds of data need no type change. A null value is shown as "Not available" with its reason.
   */
  properties: { label: string; value: string | null; missingReason?: string | null }[];
  /** Why a field is empty, when known (e.g. "Not recorded when the file was downloaded"). */
  missingReasons: Partial<Record<DatasetField, string>>;
  canEstablish: string[];
  cannotEstablish: string[];
  processing: string[];
  /** File reference on the server (files stay on disk; the database keeps references). Null until uploaded. */
  fileRef: string | null;
  /** Result of the roadmap Stage 3 validation; null = not validated. */
  validation: { valid: boolean; warnings: string[] } | null;
}

/**
 * A data source Astera Watch plans to use but is NOT connected to. It is not a dataset: it has no records or dates,
 * and it can't be linked to a project. When a source is connected, its data appears as `DatasetEntry`s instead.
 */
export interface DataSourceEntry {
  id: string;
  name: string;
  provider: string;
  kind: DatasetKind;
  status: "not-connected";
  /** What it would provide, in plain words. */
  provides: string;
  /** What has to exist before it can be used. */
  needs: string[];
  /** Terms as documented by the team (docs/data/DATA_SOURCES.md); null = not documented. */
  terms: string | null;
  notes: string[];
}

// ---------------------------------------------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------------------------------------------

/**
 * What a researcher marked. Deliberately no "burned area" kind: an annotation is a person's interpretation of
 * imagery, not a measurement.
 */
export type AnnotationKind = "observed-fire-front" | "visible-smoke" | "surface-change-interpretation" | "no-change-reference" | "note";

export interface Annotation {
  id: string;
  projectId: string;
  kind: AnnotationKind;
  geometry: { type: "Point"; coordinates: [number, number] } | PolygonGeometry;
  /** The image or dataset the annotation was drawn on; null when drawn on the map background only. */
  basedOnDatasetId: string | null;
  note: string | null;
  /** Always "interpretation": shown as "Your annotation, not a burned-area measurement". */
  nature: "interpretation";
  createdAt: IsoDateTime;
}

// ---------------------------------------------------------------------------------------------------------------
// Models and model runs
// ---------------------------------------------------------------------------------------------------------------

/** Model card: what a model is, what it was trained on and where it must not be used. */
export interface ModelCard {
  id: string;
  name: string;
  version: string;
  task: string;
  /** Input product types it accepts, e.g. "Sentinel-1 RTC". It is never used on products it wasn't validated for. */
  inputs: string[];
  trainingData: string | null;
  validation: string | null;
  knownLimitations: string[];
  licence: string | null;
}

export type ModelRunStatus = "not-run" | "queued" | "running" | "complete" | "failed";

export interface ModelRun {
  id: string;
  projectId: string;
  modelId: string;
  modelVersion: string;
  inputDatasetIds: string[];
  status: ModelRunStatus;
  /** Outputs are estimates: every value is kind "estimated" with an uncertainty, or null when not produced. */
  outputs: Record<string, SciValue>;
  provenance: Provenance | null;
  startedAt: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
  failureReason: string | null;
}

// ---------------------------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------------------------

export interface ResearchReport {
  id: string;
  projectId: string;
  title: string;
  /** Every dataset, model run and annotation the report uses, so each statement can be traced. */
  sources: { datasetIds: string[]; modelRunIds: string[]; annotationIds: string[]; eventIds: string[] };
  /** True if any source is synthetic; the report then carries the demo label on every page. */
  containsSyntheticData: boolean;
  createdAt: IsoDateTime;
  formats: ("json" | "csv" | "print")[];
}

// ---------------------------------------------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------------------------------------------

export interface Institution {
  id: string;
  name: string;
  /** Institutions are listed only with an agreement the team has verified; there are none today. */
  agreement: { verified: true; reference: string; since: IsoDateTime };
}

export type MemberRole = "owner" | "researcher" | "reviewer" | "viewer";

export interface ProjectMember {
  projectId: string;
  /** Needs user accounts (not built). */
  userId: string;
  role: MemberRole;
  institutionId: string | null;
}
