/**
 * Mock adapter: serves the synthetic fixtures through the repository interfaces.
 * Development-only scenario switch (?mockScenario=error|empty|slow|unavailable) to review UI states;
 * it is compiled out of production builds (guarded by import.meta.env.DEV).
 */
import { BACKEND_UNAVAILABLE_MESSAGE, DataError } from "../errors";
import type { EventQuery, Repositories } from "../repositories";
import type { BBox, DetectionQuery, TimeWindow } from "../types";
import { assertValid, validateAnalysis, validateAvailability, validateDetection, validateEvent, validateScene } from "../validate";
import { ANALYSES, AVAILABILITY, COUNTRY_LIST, DETECTIONS, EVENTS, SCENES, detectionCountryIso3 } from "./fixtures";

export type MockScenario = "normal" | "error" | "empty" | "slow" | "unavailable";
const SCENARIOS: MockScenario[] = ["normal", "error", "empty", "slow", "unavailable"];
export const MOCK_SCENARIO_PARAM = "mockScenario";

/** Reads ?mockScenario= in development builds only. Production always returns "normal". */
export function readMockScenario(search: string = typeof window === "undefined" ? "" : window.location.search): MockScenario {
  if (!import.meta.env.DEV) return "normal";
  const value = new URLSearchParams(search).get(MOCK_SCENARIO_PARAM);
  return SCENARIOS.includes(value as MockScenario) ? (value as MockScenario) : "normal";
}

export interface MockOptions {
  /** Simulated latency in ms (0 in tests). */
  delayMs?: number;
  scenario?: MockScenario;
}

const SLOW_DELAY_MS = 3000;

const overlaps = (aStart: string | null, aEnd: string | null, w: TimeWindow) =>
  aStart !== null && aEnd !== null && Date.parse(aStart) <= Date.parse(w.end) && Date.parse(aEnd) >= Date.parse(w.start);

const inBox = ([lon, lat]: [number, number], b: BBox) => lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north;

export function createMockRepositories({ delayMs = 0, scenario = "normal" }: MockOptions = {}): Repositories {
  const wait = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

  /** Applies latency and the dev scenario; `collection` results become empty in the "empty" scenario. */
  async function respond<T>(produce: () => T, collection?: (value: T) => T): Promise<T> {
    await wait(scenario === "slow" ? SLOW_DELAY_MS : delayMs);
    if (scenario === "error") throw new DataError("network", "The data request failed (simulated error, development only).");
    if (scenario === "unavailable") throw new DataError("unavailable", BACKEND_UNAVAILABLE_MESSAGE);
    const value = produce();
    return scenario === "empty" && collection ? collection(value) : value;
  }

  function notFound(what: string, id: string): never {
    throw new DataError("not-found", `${what} "${id}" was not found.`);
  }

  function checked<T>(value: T, validate: (v: T) => string[], what: string): T {
    assertValid(validate(value), what);
    return value;
  }

  return {
    events: {
      listEvents: (q: EventQuery = {}) =>
        respond(
          () =>
            EVENTS.filter((e) => !q.window || overlaps(e.firstDetection, e.lastDetection, q.window))
              .filter((e) => !q.countryIso3 || e.country.iso3 === q.countryIso3)
              .filter((e) => !q.sources?.length || e.dataSources.some((s) => q.sources!.includes(s)))
              .filter((e) => !q.text || `${e.name} ${e.id}`.toLowerCase().includes(q.text.trim().toLowerCase()))
              .map((e) => checked(e, validateEvent, "event")),
          () => [],
        ),
      recentEvents: (limit: number) =>
        respond(
          () =>
            [...EVENTS]
              .sort((a, b) => Date.parse(b.lastDetection ?? "") - Date.parse(a.lastDetection ?? ""))
              .slice(0, limit)
              .map((e) => checked(e, validateEvent, "event")),
          () => [],
        ),
      getEvent: (id: string) =>
        respond(() => checked(EVENTS.find((e) => e.id === id) ?? notFound("Event", id), validateEvent, "event")),
      listCountries: () => respond(() => COUNTRY_LIST, () => []),
    },
    detections: {
      listDetections: (q: DetectionQuery) =>
        respond(
          () => ({
            window: q.window,
            detections: DETECTIONS.filter((d) => Date.parse(d.acquiredAt) >= Date.parse(q.window.start) && Date.parse(d.acquiredAt) <= Date.parse(q.window.end))
              .filter((d) => !q.eventId || d.eventId === q.eventId)
              .filter((d) => !q.bbox || inBox(d.geometry.coordinates, q.bbox))
              .filter((d) => !q.countryIso3 || detectionCountryIso3(d.id) === q.countryIso3)
              .map((d) => checked(d, validateDetection, "detection")),
          }),
          (set) => ({ ...set, detections: [] }),
        ),
    },
    scenes: {
      getScene: (id: string) => respond(() => checked(SCENES.find((s) => s.id === id) ?? notFound("Scene", id), validateScene, "scene")),
    },
    availability: {
      getAvailability: (eventId: string) =>
        respond(() =>
          checked(AVAILABILITY.find((r) => r.eventId === eventId) ?? notFound("Availability report for event", eventId), validateAvailability, "availability"),
        ),
    },
    analysis: {
      getAnalysis: (eventId: string) =>
        respond(() => checked(ANALYSES.find((a) => a.eventId === eventId) ?? notFound("Analysis for event", eventId), validateAnalysis, "analysis")),
    },
  };
}
