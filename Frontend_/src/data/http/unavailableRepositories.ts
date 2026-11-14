/**
 * HTTP adapter placeholder (VITE_DATA_MODE=http). No backend API contract exists yet (Stage 1), so no
 * endpoint, URL or response shape is assumed here: every call reports "unavailable". Stage 7 replaces
 * this with a real adapter plus one mapping layer from the Stage 1 contracts to the frontend types.
 */
import { BACKEND_UNAVAILABLE_MESSAGE, DataError } from "../errors";
import type { Repositories } from "../repositories";

const unavailable = (): Promise<never> => Promise.reject(new DataError("unavailable", BACKEND_UNAVAILABLE_MESSAGE));

export function createUnavailableRepositories(): Repositories {
  return {
    events: { listEvents: unavailable, recentEvents: unavailable, getEvent: unavailable, listCountries: unavailable },
    detections: { listDetections: unavailable },
    scenes: { getScene: unavailable },
    availability: { getAvailability: unavailable },
    analysis: { getAnalysis: unavailable },
  };
}
