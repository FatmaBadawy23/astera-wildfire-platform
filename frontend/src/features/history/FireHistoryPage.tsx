import { useId, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight, MapPin } from "lucide-react";
import { fireStoryPath } from "@/app/nav";
import { getDataMode } from "@/app/env";
import { SafetyNote } from "@/components/help/SafetyNote";
import { ProvenanceBadges } from "@/components/science/SourceBadges";
import { CountrySearch } from "@/components/search/CountrySearch";
import { QueryState } from "@/components/states/QueryState";
import { EmptyState } from "@/components/states/States";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCountryIndex } from "@/data/countryIndex";
import { useRepositories } from "@/data/DataProvider";
import { queryKeys, useEvents } from "@/data/hooks";
import type { AnalysisResult, FireEvent } from "@/data/types";
import { formatArea, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NotConfirmedChip } from "@/features/explorer/SelectionCard";
import { detectionCountText, formatDayRange, placeText, radarText } from "@/features/explorer/CandidateEventList";
import { RADAR_FILTERS, radarSources, type RadarFilter } from "@/features/explorer/useExplorerParams";

const RADAR_LABELS: Record<RadarFilter, string> = { nisar: "NISAR", "sentinel-1": "Sentinel-1" };
type Sort = "newest" | "oldest" | "spots";

const control = "h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground";

/** Plain summary of what the radar analysis says about surface change (never called burned area). */
export function analysisSummary(a: AnalysisResult | undefined): { text: string; hasResult: boolean } {
  if (!a) return { text: "Radar analysis: loading or not available.", hasResult: false };
  switch (a.status) {
    case "complete": {
      const area = a.changedArea;
      const range = area.uncertainty && area.uncertainty.lower !== null && area.uncertainty.upper !== null ? ` (range ${formatArea(area.uncertainty.lower)} to ${formatArea(area.uncertainty.upper)})` : "";
      return {
        text: area.value === null ? "Radar analysis complete; changed area not available." : `Estimated ${formatArea(area.value)} of radar surface change${range}. Not a burned-area measurement.`,
        hasResult: area.value !== null,
      };
    }
    case "locked":
      return { text: "No radar result: no suitable before/after image pair.", hasResult: false };
    case "failed":
      return { text: "No radar result: the analysis failed.", hasResult: false };
    case "running":
      return { text: "Radar analysis is running.", hasResult: false };
    default:
      return { text: "Radar analysis has not been run.", hasResult: false };
  }
}

function HistoryItem({ event, analysis, demo }: { event: FireEvent; analysis: AnalysisResult | undefined; demo: boolean }) {
  const radar = radarText(event);
  const summary = analysisSummary(analysis);
  const simulated = analysis?.provenance.origin === "synthetic" && summary.hasResult;
  return (
    <li data-history-item={event.id} className="grid gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <h3 className="text-lg font-semibold">
            {event.id} · {event.name}
          </h3>
          <p className="text-sm text-muted-foreground">{placeText(event)}</p>
        </div>
        <NotConfirmedChip />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">When</dt>
        <dd>{formatDayRange(event.firstDetection, event.lastDetection)}</dd>
        <dt className="text-muted-foreground">Heat spots</dt>
        <dd>{detectionCountText(event)}</dd>
        <dt className="text-muted-foreground">Radar data</dt>
        <dd>{radar ?? "None listed"}</dd>
      </dl>
      <ProvenanceBadges provenance={event.provenance} hideMock={demo} />
      <div className="grid gap-1.5 rounded-md border border-border bg-background p-3 text-sm" data-impacts>
        <p className="font-semibold text-foreground-strong">Effects and impacts</p>
        <p>
          {summary.text}
          {simulated && <span className="text-muted-foreground"> Simulated result.</span>}
        </p>
        <p className="text-muted-foreground">Impacts on land cover, people or property: not available (no impact data source is connected).</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to={fireStoryPath(event.id)} className={buttonVariants({ size: "sm" })}>
          Open the Fire Story<span className="sr-only"> of {event.id}</span>
          <ArrowRight aria-hidden="true" />
        </Link>
        <Link to={`/?event=${encodeURIComponent(event.id)}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-primary")}>
          <MapPin aria-hidden="true" />
          Show on the map<span className="sr-only"> ({event.id})</span>
        </Link>
      </div>
    </li>
  );
}

/** Fire History & Impacts: every possible fire in the data, filterable, with what is known about its effects. */
export function FireHistoryPage() {
  const id = useId();
  const demo = getDataMode() === "mock";
  const [search, setSearch] = useSearchParams();
  const country = search.get("country") || null;
  const radarParam = search.get("radar");
  const radar = (RADAR_FILTERS as readonly string[]).includes(radarParam ?? "") ? (radarParam as RadarFilter) : null;
  const onlyResults = search.get("result") === "1";
  const sortParam = search.get("sort");
  const sort: Sort = sortParam === "oldest" || sortParam === "spots" ? sortParam : "newest";
  const set = (key: string, value: string | null) =>
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );

  const { index } = useCountryIndex();
  const selectedCountry = index.find((c) => c.iso3 === country) ?? null;
  const eventsQuery = useEvents({ countryIso3: country ?? undefined, sources: radarSources(radar) });
  const repos = useRepositories();
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const analyses = useQueries({
    queries: events.map((e) => ({ queryKey: queryKeys.analysis(e.id), queryFn: () => repos.analysis.getAnalysis(e.id) })),
  });
  const analysisById = new Map(events.map((e, i) => [e.id, analyses[i]?.data]));

  const shown = [...events]
    .filter((e) => !onlyResults || analysisSummary(analysisById.get(e.id)).hasResult)
    .sort((a, b) => {
      if (sort === "spots") return (b.detectionCount.value ?? -1) - (a.detectionCount.value ?? -1);
      const d = Date.parse(b.lastDetection ?? "") - Date.parse(a.lastDetection ?? "");
      return sort === "oldest" ? -d : d;
    });
  const totalSpots = shown.reduce((n, e) => n + (e.detectionCount.value ?? 0), 0);
  const withResult = shown.filter((e) => analysisSummary(analysisById.get(e.id)).hasResult).length;
  const filtered = !!country || !!radar || onlyResults;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6">
      <div className="grid gap-3">
        <h1 data-page-heading tabIndex={-1} className="text-3xl font-bold">
          Fire History & Impacts
        </h1>
        <p className="max-w-prose text-muted-foreground">
          Look back at possible fires and what is known about their effects. Each one opens a Fire Story with the full details.
        </p>
      </div>

      <form role="search" aria-label="Filter fire history" onSubmit={(e) => e.preventDefault()} className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <CountrySearch
          index={index}
          selected={selectedCountry}
          onSelect={(c) => set("country", c.iso3)}
          onClear={() => set("country", null)}
          dataLabel={demo ? "in the demo data" : "in the data"}
        />
        <div className="grid content-start gap-1">
          <label htmlFor={`${id}-radar`} className="text-xs font-medium text-muted-foreground">
            Radar data
          </label>
          <select id={`${id}-radar`} className={control} value={radar ?? ""} onChange={(e) => set("radar", e.target.value || null)}>
            <option value="">Any radar</option>
            {RADAR_FILTERS.map((r) => (
              <option key={r} value={r}>
                {RADAR_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid content-start gap-1">
          <label htmlFor={`${id}-sort`} className="text-xs font-medium text-muted-foreground">
            Order
          </label>
          <select id={`${id}-sort`} className={control} value={sort} onChange={(e) => set("sort", e.target.value === "newest" ? null : e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="spots">Most heat spots first</option>
          </select>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm md:col-span-3">
          <input type="checkbox" checked={onlyResults} onChange={(e) => set("result", e.target.checked ? "1" : null)} className="size-[18px] accent-[var(--aw-color-primary)]" />
          Only possible fires with a radar surface-change result
        </label>
        {filtered && (
          <div className="md:col-span-3">
            <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setSearch(new URLSearchParams(), { replace: true })}>
              Clear filters
            </Button>
          </div>
        )}
      </form>

      <section aria-labelledby="history-list-heading" className="grid gap-3">
        <h2 id="history-list-heading" className="text-xl font-semibold">
          Possible fires
        </h2>
        <QueryState query={eventsQuery} loadingLabel="Loading fire history" isEmpty={() => false}>
          {() =>
            shown.length === 0 ? (
              <EmptyState title={selectedCountry ? `No possible fires for ${selectedCountry.name} with these filters` : "No possible fires match these filters"}>
                {demo ? "The demo data covers six invented possible fires in six countries." : null}
              </EmptyState>
            ) : (
              <>
                <p className="text-sm" aria-live="polite" data-history-summary>
                  {formatNumber(shown.length)} possible fire{shown.length === 1 ? "" : "s"} · {formatNumber(totalSpots)} heat spots · {formatNumber(withResult)} with a radar
                  surface-change result
                </p>
                <ul className="grid gap-3 md:grid-cols-2">
                  {shown.map((e) => (
                    <HistoryItem key={e.id} event={e} analysis={analysisById.get(e.id)} demo={demo} />
                  ))}
                </ul>
              </>
            )
          }
        </QueryState>
      </section>

      <SafetyNote />
    </div>
  );
}
