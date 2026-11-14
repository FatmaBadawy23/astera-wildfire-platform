/**
 * Repository interfaces: what the pages need, independent of any backend API.
 * Adapters: mock (synthetic fixtures, now) and http (stub that reports "unavailable" until Stage 7).
 * Errors are thrown as DataError (see errors.ts). Getters throw DataError("not-found") for unknown IDs.
 */
import type {
  AnalysisResult,
  AvailabilityReport,
  Country,
  DetectionQuery,
  DetectionSet,
  FireEvent,
  SceneSummary,
  SourceKind,
  TimeWindow,
} from "./types";

export interface EventQuery {
  /** Events whose detection period overlaps this window. */
  window?: TimeWindow;
  countryIso3?: string;
  /** Events with data from at least one of these sources. */
  sources?: SourceKind[];
  /** Case-insensitive match on event name or ID. */
  text?: string;
}

export interface FireEventRepository {
  listEvents(query?: EventQuery): Promise<FireEvent[]>;
  recentEvents(limit: number): Promise<FireEvent[]>;
  getEvent(id: string): Promise<FireEvent>;
  listCountries(): Promise<Country[]>;
}

export interface DetectionRepository {
  listDetections(query: DetectionQuery): Promise<DetectionSet>;
}

export interface SceneRepository {
  getScene(id: string): Promise<SceneSummary>;
}

export interface AvailabilityRepository {
  getAvailability(eventId: string): Promise<AvailabilityReport>;
}

export interface AnalysisRepository {
  getAnalysis(eventId: string): Promise<AnalysisResult>;
}

export interface Repositories {
  events: FireEventRepository;
  detections: DetectionRepository;
  scenes: SceneRepository;
  availability: AvailabilityRepository;
  analysis: AnalysisRepository;
}
