import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { DEMO_WINDOW } from "@/data/mock/fixtures";
import type { SourceKind, TimeWindow } from "@/data/types";

/** Radar sources an event can be filtered by (every candidate event has FIRMS detections). */
export const RADAR_FILTERS = ["nisar", "sentinel-1"] as const;
export type RadarFilter = (typeof RADAR_FILTERS)[number];

export interface ExplorerParams {
  /** "YYYY-MM-DD" (UTC days, inclusive). */
  from: string;
  to: string;
  country: string | null;
  radar: RadarFilter | null;
  q: string;
  /** Selected candidate event ID. */
  event: string | null;
}

/** Dates the data covers (the demo period in mock mode). Filters can only narrow it. */
export const DATA_PERIOD = { from: DEMO_WINDOW.start.slice(0, 10), to: DEMO_WINDOW.end.slice(0, 10) };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (v: string | null): v is string => !!v && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const clampDay = (v: string) => (v < DATA_PERIOD.from ? DATA_PERIOD.from : v > DATA_PERIOD.to ? DATA_PERIOD.to : v);

/** Reads the filters from the URL; invalid values fall back to defaults (never throw). */
export function parseExplorerParams(search: URLSearchParams): ExplorerParams {
  const rawFrom = search.get("from");
  const rawTo = search.get("to");
  const radar = search.get("radar");
  return {
    from: validDay(rawFrom) ? clampDay(rawFrom) : DATA_PERIOD.from,
    to: validDay(rawTo) ? clampDay(rawTo) : DATA_PERIOD.to,
    country: search.get("country") || null,
    radar: (RADAR_FILTERS as readonly string[]).includes(radar ?? "") ? (radar as RadarFilter) : null,
    q: search.get("q") ?? "",
    event: search.get("event") || null,
  };
}

/** True when the date range is usable (from ≤ to). */
export function isRangeValid(p: Pick<ExplorerParams, "from" | "to">): boolean {
  return p.from <= p.to;
}

/** The UTC time window for whole days from..to. */
export function toWindow(p: Pick<ExplorerParams, "from" | "to">): TimeWindow {
  return { start: `${p.from}T00:00:00Z`, end: `${p.to}T23:59:59Z` };
}

export function radarSources(radar: RadarFilter | null): SourceKind[] | undefined {
  return radar ? [radar] : undefined;
}

/** Filter state kept in the URL, so Back/Forward and shared links restore the same view. */
export function useExplorerParams() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseExplorerParams(search), [search]);

  const update = useCallback(
    (patch: Partial<ExplorerParams>, options?: { replace?: boolean }) => {
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            const isDefault =
              value === null ||
              value === "" ||
              (key === "from" && value === DATA_PERIOD.from) ||
              (key === "to" && value === DATA_PERIOD.to);
            if (isDefault) next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: options?.replace ?? true, preventScrollReset: true },
      );
    },
    [setSearch],
  );

  const reset = useCallback(() => setSearch(new URLSearchParams(), { replace: true, preventScrollReset: true }), [setSearch]);

  return { params, update, reset };
}
