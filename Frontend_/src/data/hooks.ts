import { QueryClient, useQuery } from "@tanstack/react-query";
import { useRepositories } from "./DataProvider";
import { toDataError } from "./errors";
import type { EventQuery } from "./repositories";
import type { DetectionQuery } from "./types";

/** Only network errors are retried; "unavailable", "not-found" and "invalid-response" never are. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return toDataError(error).kind === "network" && failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 60_000, refetchOnWindowFocus: false },
    },
  });
}

export const queryKeys = {
  events: (q: EventQuery) => ["events", q] as const,
  recentEvents: (limit: number) => ["events", "recent", limit] as const,
  event: (id: string) => ["event", id] as const,
  countries: () => ["countries"] as const,
  detections: (q: DetectionQuery) => ["detections", q] as const,
  scene: (id: string) => ["scene", id] as const,
  availability: (eventId: string) => ["availability", eventId] as const,
  analysis: (eventId: string) => ["analysis", eventId] as const,
};

export function useEvents(query: EventQuery = {}) {
  const { events } = useRepositories();
  return useQuery({ queryKey: queryKeys.events(query), queryFn: () => events.listEvents(query) });
}

export function useRecentEvents(limit = 5) {
  const { events } = useRepositories();
  return useQuery({ queryKey: queryKeys.recentEvents(limit), queryFn: () => events.recentEvents(limit) });
}

export function useEvent(id: string | undefined) {
  const { events } = useRepositories();
  return useQuery({ queryKey: queryKeys.event(id ?? ""), queryFn: () => events.getEvent(id!), enabled: !!id });
}

export function useCountries() {
  const { events } = useRepositories();
  return useQuery({ queryKey: queryKeys.countries(), queryFn: () => events.listCountries() });
}

export function useDetections(query: DetectionQuery) {
  const { detections } = useRepositories();
  return useQuery({ queryKey: queryKeys.detections(query), queryFn: () => detections.listDetections(query) });
}

export function useScene(id: string | undefined) {
  const { scenes } = useRepositories();
  return useQuery({ queryKey: queryKeys.scene(id ?? ""), queryFn: () => scenes.getScene(id!), enabled: !!id });
}

export function useAvailability(eventId: string | undefined) {
  const { availability } = useRepositories();
  return useQuery({ queryKey: queryKeys.availability(eventId ?? ""), queryFn: () => availability.getAvailability(eventId!), enabled: !!eventId });
}

export function useAnalysis(eventId: string | undefined) {
  const { analysis } = useRepositories();
  return useQuery({ queryKey: queryKeys.analysis(eventId ?? ""), queryFn: () => analysis.getAnalysis(eventId!), enabled: !!eventId });
}
