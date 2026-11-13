import { Suspense, lazy, useCallback, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Info, X } from "lucide-react";
import { Link } from "react-router";
import { GUIDE_PATH, HOW_PATH } from "@/app/nav";
import { getDataMode } from "@/app/env";
import { NOT_NASA_TEXT } from "@/components/help/SafetyNote";
import { useShellMode } from "@/components/layout/useShellMode";
import { DetectionDensityLegend, HeatSpotSymbol, LEGEND_TEXT, LegendList } from "@/components/science/Legends";
import { EmptyState, LoadingState } from "@/components/states/States";
import { QueryState } from "@/components/states/QueryState";
import { Button } from "@/components/ui/button";
import { densityLevel } from "@/data/aggregate";
import { useCountryIndex } from "@/data/countryIndex";
import { useDetections, useEvents } from "@/data/hooks";
import type { ActiveFireDetection, FireEvent } from "@/data/types";
import { formatCoordinate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CandidateEventList, formatDayRange } from "./CandidateEventList";
import { ExplorerFilters } from "./ExplorerFilters";
import type { DensitySummary } from "./ExplorerMap";
import { LayerInfo, LayerPanel } from "./LayerPanel";
import { DEFAULT_LAYERS, DENSITY_EXPLANATION, DENSITY_LEVEL_NAMES, DENSITY_MIN_ZOOM, POINTS_MIN_ZOOM, type LayerVisibility } from "./layerHelp";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { RELIEF_PAINT, RELIEF_SAMPLES, cellSizeKm, reliefSwatch } from "./mapStyle";
import { DetectionSelectionCard, EventSelectionCard } from "./SelectionCard";
import { DATA_PERIOD, isRangeValid, radarSources, toWindow, useExplorerParams } from "./useExplorerParams";

const ExplorerMap = lazy(() => import("./ExplorerMap"));

const EMPTY_EVENTS: FireEvent[] = [];
const EMPTY_DETECTIONS: ActiveFireDetection[] = [];

/** First-visit welcome: remembered in this browser only (per-viewer convenience; works without storage). */
export const WELCOME_STORAGE_KEY = "astera-watch-welcome-dismissed";
function readWelcomeDismissed(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function LegendRow({ symbol, term, children }: { symbol: ReactNode; term: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="inline-flex h-5 w-7 shrink-0 items-center justify-center" aria-hidden="true">
        {symbol}
      </span>
      <span>
        <strong className="font-semibold">{term}</strong> · {children}
      </span>
    </li>
  );
}

const MARKER_SYMBOL = (
  <svg width="22" height="22" viewBox="0 0 30 30">
    <circle cx="15" cy="15" r="11" fill="none" stroke="var(--aw-data-line-casing-light)" strokeWidth="4" />
    <circle cx="15" cy="15" r="11" fill="none" stroke="var(--aw-data-line-casing-dark)" strokeWidth="2" strokeDasharray="4 3" />
    <circle cx="15" cy="15" r="3" fill="var(--aw-data-line-casing-dark)" />
  </svg>
);

/** "What am I seeing?": every symbol in plain words with its scientific name, the density levels, layers, credits. */
function MapKey({ density, timeWindow, layers, onLayersChange }: { density: DensitySummary | null; timeWindow: { start: string; end: string }; layers: LayerVisibility; onLayersChange: (l: LayerVisibility) => void }) {
  const { resolved } = useTheme();
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-sm font-medium">Markers, points and squares</p>
        <LegendList label="Markers, points and squares">
          <LegendRow term="Possible fire" symbol={MARKER_SYMBOL}>
            candidate event: a group of heat spots, not a confirmed wildfire. Shown at every zoom level.
          </LegendRow>
          <LegendRow term="Heat spot" symbol={<HeatSpotSymbol />}>
            {LEGEND_TEXT.fireDetection}
          </LegendRow>
          <LegendRow term="Shaded square" symbol={<span className="h-4 w-5 border border-border-strong" style={{ background: "var(--aw-data-density-3)" }} />}>
            how many heat spots fall inside one grid square during the selected period, not burned area. Shown when you zoom in to a region.
          </LegendRow>
        </LegendList>
        <p className="text-xs text-muted-foreground">Confirmed fires are not shown: Astera Watch does not confirm fires.</p>
      </div>

      <div className="grid gap-2 border-t border-border pt-4" data-basemap-key>
        <p className="text-sm font-medium">Background map</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm" aria-label="Background map colours">
          {(
            [
              ["vegetated", "Green: vegetated land"],
              ["dry", "Tan and brown: dry or bare land"],
              ["ice", "White: ice"],
              ["water", "Blue: water"],
            ] as const
          ).map(([k, t]) => (
            <li key={t} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3.5 w-5 rounded-sm border border-border-strong" style={{ background: reliefSwatch(RELIEF_SAMPLES[k], RELIEF_PAINT[resolved]) }} />
              {t}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          A long-term, generalised picture of land cover and relief (Natural Earth). It is not current vegetation and does not show fires or burned
          land.
        </p>
      </div>

      <div className="grid content-start gap-2 border-t border-border pt-4" data-density-legend>
        {density && !density.shown ? (
          <div className="grid gap-1.5" data-density-hidden>
            <p className="text-sm font-medium">{LEGEND_TEXT.density}</p>
            <p className="text-sm">
              You are looking at the whole world, so each possible fire is shown by its marker. Zoom in to a region (or search for a country) to see
              shaded squares.
            </p>
          </div>
        ) : (
          <DetectionDensityLegend classes={density?.classes ?? []} window={timeWindow} levelNames={DENSITY_LEVEL_NAMES} />
        )}
        <p className="text-sm">{DENSITY_EXPLANATION}</p>
        {density?.shown && (
          <p className="text-xs text-muted-foreground">
            Each square is {density.cellDeg}° (about {cellSizeKm(density.cellDeg)} km north–south) at this zoom. The grid gets finer as you zoom in.
          </p>
        )}
        <details className="text-sm">
          <summary className="w-fit cursor-pointer font-medium text-primary">What do “low” and “high” mean?</summary>
          <div className="mt-2 grid max-w-prose gap-1.5 text-muted-foreground">
            <p>
              The levels are not fixed thresholds. They are five equal steps from 1 detection up to the busiest square, and they depend on the
              busiest square, the selected period and the current grid size. They change when you zoom or change the dates.
            </p>
            <p>A high level means many detections close together. It is not a confirmed wildfire and not a larger burned area.</p>
          </div>
        </details>
      </div>

      <div className="border-t border-border pt-4">
        <LayerPanel layers={layers} onChange={onLayersChange} />
      </div>

      <div className="grid gap-2 border-t border-border pt-4">
        <p className="flex gap-2 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          Shaded squares appear from zoom level {DENSITY_MIN_ZOOM} and individual heat spots from zoom level {POINTS_MIN_ZOOM}. Click a heat spot to see
          when it was detected.
        </p>
        <p className="text-xs text-muted-foreground">
          Basemap: Natural Earth I with Shaded Relief and Water, and simplified country outlines and names (Natural Earth, public domain).
        </p>
        <p className="text-xs text-muted-foreground">{NOT_NASA_TEXT}</p>
        {density?.shown && density.cells.length > 0 && (
          <details className="text-sm">
            <summary className="w-fit cursor-pointer font-medium text-primary">Show density as a table</summary>
            <table className="mt-2 w-full text-left text-sm">
              <caption className="mb-1 text-left text-xs text-muted-foreground">
                Squares with the most heat spots (top 10 of {formatNumber(density.cells.length)}), {density.cellDeg}° grid
              </caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-1 pr-3 font-medium">
                    Square centre
                  </th>
                  <th scope="col" className="py-1 pr-3 text-right font-medium">
                    Heat spots
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    Level
                  </th>
                </tr>
              </thead>
              <tbody>
                {density.cells.slice(0, 10).map((c) => (
                  <tr key={c.cellId} className="border-b border-border">
                    <td className="py-1 pr-3 font-mono text-xs">
                      {formatCoordinate({ lon: (c.bbox.west + c.bbox.east) / 2, lat: (c.bbox.south + c.bbox.north) / 2 })}
                    </td>
                    <td className="py-1 pr-3 text-right font-mono">{formatNumber(c.count)}</td>
                    <td className="py-1">{DENSITY_LEVEL_NAMES[densityLevel(c.count, density.classes) - 1] ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>
    </div>
  );
}

function WelcomeCard({ onDismiss, demo }: { onDismiss: () => void; demo: boolean }) {
  return (
    <section aria-labelledby="welcome-heading" data-welcome className="grid gap-3 rounded-lg border border-border bg-background p-4 text-sm">
      <h2 id="welcome-heading" className="text-base font-semibold">
        Welcome to Astera Watch
      </h2>
      <p>See where satellites sensed heat that may come from wildfires, and what radar can tell about the ground before and after.</p>
      <ol className="grid list-decimal gap-1 pl-5">
        <li>Search for a country, or explore the map.</li>
        <li>Select a possible fire to see what is known and what isn't.</li>
        <li>Open its Fire Story for the radar data and analysis.</li>
        <li>Save the countries you care about in My places.</li>
      </ol>
      {demo && <p className="text-muted-foreground">You are looking at demo data with invented locations while the real data connection is being built.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={onDismiss}>
          Explore the map
        </Button>
        <Link to={HOW_PATH} className="inline-flex min-h-9 items-center px-2 text-sm font-medium text-primary underline underline-offset-2">
          How it works
        </Link>
        <Link to={GUIDE_PATH} className="inline-flex min-h-9 items-center px-2 text-sm font-medium text-primary underline underline-offset-2">
          User Guide
        </Link>
      </div>
    </section>
  );
}

/**
 * Fire map (homepage): where satellites detected heat that may come from fires, and the possible fires to open.
 * Desktop: search and list on the left, the map filling the rest, the key floating over the map.
 * Smaller screens: search, map, list, key, one after the other.
 */
export function ExplorerPage() {
  const { params, update, reset } = useExplorerParams();
  const desktop = useShellMode() === "desktop";
  const demoMode = getDataMode() === "mock";
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [keyOpen, setKeyOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 1280);
  const [welcomeDismissed, setWelcomeDismissed] = useState(readWelcomeDismissed);
  const [detectionId, setDetectionId] = useState<string | null>(null);
  const [density, setDensity] = useState<DensitySummary | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const rangeOk = isRangeValid(params);
  const timeWindow = useMemo(() => toWindow(rangeOk ? params : DATA_PERIOD), [rangeOk, params]);
  const countryIso3 = params.country ?? undefined;

  const eventsQuery = useEvents({ window: timeWindow, countryIso3, sources: radarSources(params.radar), text: params.q.trim() || undefined });
  const detectionsQuery = useDetections({ window: timeWindow, countryIso3 });
  const { index: countryIndex } = useCountryIndex();
  const selectedCountry = countryIndex.find((c) => c.iso3 === params.country) ?? null;

  const events = eventsQuery.data ?? EMPTY_EVENTS;
  const detections = detectionsQuery.data?.detections ?? EMPTY_DETECTIONS;
  const selectedEvent = events.find((e) => e.id === params.event) ?? null;
  const selectedDetection = detections.find((d) => d.id === detectionId) ?? null;

  const selectEvent = useCallback(
    (id: string | null) => {
      setDetectionId(null);
      update({ event: id });
      setAnnouncement(id ? `${id} selected and shown on the map. Its summary is shown above the list.` : "Selection cleared.");
    },
    [update],
  );
  const selectDetection = useCallback(
    (id: string | null) => {
      setDetectionId(id);
      if (id) update({ event: null });
    },
    [update],
  );

  function dismissWelcome() {
    try {
      window.localStorage.setItem(WELCOME_STORAGE_KEY, "1");
    } catch {
      /* storage blocked: dismissed for this visit only */
    }
    setWelcomeDismissed(true);
    document.querySelector<HTMLElement>("[data-page-heading]")?.focus();
  }

  const selection = selectedDetection ? (
    <DetectionSelectionCard detection={selectedDetection} onClose={() => setDetectionId(null)} hideMockBadge={demoMode} />
  ) : selectedEvent ? (
    <EventSelectionCard event={selectedEvent} onClose={() => selectEvent(null)} hideMockBadge={demoMode} />
  ) : null;

  const summary =
    eventsQuery.isSuccess && detectionsQuery.isSuccess
      ? `${formatNumber(events.length)} possible fire${events.length === 1 ? "" : "s"} and ${formatNumber(detections.length)} heat spot${detections.length === 1 ? "" : "s"}, ${formatDayRange(timeWindow.start, timeWindow.end)}.`
      : "";

  const key = <MapKey density={density} timeWindow={timeWindow} layers={layers} onLayersChange={setLayers} />;
  const panelColumn = "bg-surface lg:col-start-1 lg:border-r lg:border-border";

  return (
    <div
      data-map-frame
      className={cn(
        "relative flex flex-col",
        "lg:grid lg:h-full lg:grid-cols-[minmax(340px,380px)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden",
        "[@media(max-height:480px)]:lg:h-auto",
      )}
    >
      {/* 1. Title, first-visit welcome, search. */}
      <div className={cn(panelColumn, "grid content-start gap-4 border-b border-border p-4 lg:row-start-1")}>
        <div className="grid gap-1">
          <h1 data-page-heading tabIndex={-1} className="text-2xl font-bold">
            Fire map
          </h1>
          <p className="text-sm text-muted-foreground">Where satellites sensed heat that may come from fires. Possible fires are not confirmed wildfires.</p>
        </div>
        {!welcomeDismissed && <WelcomeCard onDismiss={dismissWelcome} demo={demoMode} />}
        <ExplorerFilters params={params} countryIndex={countryIndex} onChange={(patch) => update(patch)} onReset={reset} demoPeriod={demoMode} />
      </div>

      {/* 2. The map. */}
      <section aria-labelledby="map-heading" className="relative h-[55dvh] max-h-[600px] min-h-[300px] bg-map lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto lg:max-h-none">
        <h2 id="map-heading" className="sr-only">
          Map
        </h2>
        <Suspense fallback={<LoadingState label="Loading the map" className="p-6" />}>
          <ExplorerMap
            events={layers.events ? events : EMPTY_EVENTS}
            detections={detections}
            detectionProvenance={detections[0]?.provenance ?? null}
            window={timeWindow}
            layers={layers}
            selectedEventId={selectedEvent?.id ?? null}
            onSelectEvent={selectEvent}
            onSelectDetection={selectDetection}
            onDensityChange={setDensity}
            focusBounds={params.event ? null : (selectedCountry?.bbox ?? null)}
          />
        </Suspense>
      </section>

      {/* 3. What was found: summary, the selected item, the list. */}
      <div className={cn(panelColumn, "grid content-start gap-4 p-4 lg:row-start-2 lg:overflow-y-auto")} data-results>
        <p className="text-sm font-medium" aria-live="polite" data-results-summary>
          {summary}
        </p>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
        {params.event && !selectedEvent && eventsQuery.isSuccess && (
          <p role="status" className="rounded-md border border-dashed border-border-strong p-3 text-sm">
            Possible fire “{params.event}” isn't in the current results.{" "}
            <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => selectEvent(null)}>
              Clear selection
            </Button>
          </p>
        )}
        {selection}

        <section aria-labelledby="events-heading" className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 id="events-heading" className="text-lg font-semibold">
              Possible fires{eventsQuery.isSuccess && <span className="font-normal text-muted-foreground"> · {events.length}</span>}
            </h2>
            <LayerInfo layer="events" />
          </div>
          <p className="text-sm text-muted-foreground">Groups of nearby heat spots. A possible fire is not a confirmed wildfire.</p>
          <QueryState
            query={eventsQuery}
            loadingLabel="Loading possible fires"
            isEmpty={(d) => d.length === 0}
            empty={
              <EmptyState title={selectedCountry ? `No possible fires in ${selectedCountry.name} for these filters` : "No possible fires match these filters"}>
                <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={reset}>
                  Clear filters
                </Button>
              </EmptyState>
            }
          >
            {(list) => <CandidateEventList events={list} selectedId={selectedEvent?.id ?? null} onSelect={selectEvent} hideMockBadge={demoMode} />}
          </QueryState>
        </section>
      </div>

      {/* 4. Map key: floating over the map on desktop (collapsible), in the page flow on smaller screens. */}
      {desktop ? (
        keyOpen ? (
          <section
            key="key-open"
            aria-labelledby="key-heading"
            data-map-overlay
            data-map-key
            className="absolute right-3 bottom-3 z-[4] flex max-h-[calc(100%-7.5rem)] w-[360px] flex-col rounded-lg border border-border-strong bg-surface shadow-lg"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border py-1 pr-1 pl-4">
              <h2 id="key-heading" className="text-base font-semibold">
                What am I seeing?
              </h2>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Hide the map key" aria-expanded="true" onClick={() => setKeyOpen(false)}>
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 overflow-y-auto p-4">{key}</div>
          </section>
        ) : (
          <Button
            key="key-closed"
            type="button"
            variant="secondary"
            data-map-overlay
            aria-expanded="false"
            onClick={() => setKeyOpen(true)}
            className="absolute right-3 bottom-3 z-[4] shadow-md"
          >
            What am I seeing?
            <ChevronDown className="rotate-180" aria-hidden="true" />
          </Button>
        )
      ) : (
        <section aria-labelledby="key-heading" data-map-key className="grid gap-3 border-t border-border bg-surface p-4">
          <h2 id="key-heading" className="text-lg font-semibold">
            What am I seeing?
          </h2>
          {key}
        </section>
      )}
    </div>
  );
}
