import { CalendarDays, ChevronDown, Search } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { CountrySearch } from "@/components/search/CountrySearch";
import { Button } from "@/components/ui/button";
import type { CountryOption } from "@/data/countryIndex";
import { cn } from "@/lib/utils";
import { formatDayRange } from "./CandidateEventList";
import { DATA_PERIOD, RADAR_FILTERS, isRangeValid, toWindow, type ExplorerParams, type RadarFilter } from "./useExplorerParams";

const RADAR_LABELS: Record<RadarFilter, string> = { nisar: "NISAR", "sentinel-1": "Sentinel-1" };

// Native date fields keep focus inside the browser's own sub-fields, where :focus-visible does not reach the
// <input>; they get the same token ring on :focus.
// :focus-within also covers the calendar button inside the field (its own Tab stop in Edge/Chrome).
const dateFocus =
  "focus:outline-solid focus:outline-[length:var(--aw-focus-width)] focus:outline-[var(--aw-color-focus-ring)] focus:outline-offset-[var(--aw-focus-offset)] focus-within:outline-solid focus-within:outline-[length:var(--aw-focus-width)] focus-within:outline-[var(--aw-color-focus-ring)] focus-within:outline-offset-[var(--aw-focus-offset)]";

const control =
  "h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground disabled:opacity-50 aria-[invalid=true]:border-danger";

function Field({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid content-start gap-1", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Fire map filters. Country search first (the question most people ask: "is anything happening in my country?"),
 * the period always visible, dates / radar / search one step away. Dates and country apply to heat spots and
 * possible fires; radar data and search apply to the list of possible fires.
 */
export function ExplorerFilters({
  params,
  countryIndex,
  onChange,
  onReset,
  demoPeriod,
}: {
  params: ExplorerParams;
  /** Every country that can be searched (basemap + dataset). */
  countryIndex: CountryOption[];
  onChange: (patch: Partial<ExplorerParams>) => void;
  onReset: () => void;
  /** The data covers only the demo period (mock mode). */
  demoPeriod: boolean;
}) {
  const id = useId();
  const rangeOk = isRangeValid(params);
  const datesChanged = params.from !== DATA_PERIOD.from || params.to !== DATA_PERIOD.to;
  const moreChanged = datesChanged || !!params.radar || !!params.q;
  const changed = moreChanged || !!params.country;
  // Open when the URL already sets one of these filters (or the range is invalid), so nothing is hidden.
  const [moreOpen, setMoreOpen] = useState(moreChanged || !rangeOk);
  const showMore = moreOpen || !rangeOk;
  const period = formatDayRange(toWindow(rangeOk ? params : DATA_PERIOD).start, toWindow(rangeOk ? params : DATA_PERIOD).end);

  return (
    <form role="search" aria-label="Filter the map and the list" onSubmit={(e) => e.preventDefault()} className="grid gap-3">
      <CountrySearch
        index={countryIndex}
        selected={countryIndex.find((c) => c.iso3 === params.country) ?? null}
        onSelect={(c) => onChange({ country: c.iso3, event: null })}
        onClear={() => onChange({ country: null })}
        hint="Countries only. The map moves to the country you choose."
        dataLabel={demoPeriod ? "in the demo data" : "in the data"}
      />

      <div className="flex flex-wrap items-center gap-2">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm" data-period>
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>
            <span className="sr-only">Period: </span>
            {demoPeriod && !datesChanged ? "Demo period · " : ""}
            {period}
          </span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={showMore}
          aria-controls={`${id}-more`}
          onClick={() => setMoreOpen((o) => !o)}
          className="text-primary"
        >
          Dates and more filters
          <ChevronDown className={cn("transition-transform", showMore && "rotate-180")} aria-hidden="true" />
        </Button>
      </div>

      <div id={`${id}-more`} hidden={!showMore} className="grid gap-3 rounded-md border border-border p-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From (UTC)" htmlFor={`${id}-from`}>
            <input
              id={`${id}-from`}
              type="date"
              className={cn(control, dateFocus)}
              value={params.from}
              min={DATA_PERIOD.from}
              max={DATA_PERIOD.to}
              aria-invalid={!rangeOk}
              aria-describedby={rangeOk ? undefined : `${id}-range`}
              onChange={(e) => e.target.value && onChange({ from: e.target.value })}
            />
          </Field>
          <Field label="To (UTC)" htmlFor={`${id}-to`}>
            <input
              id={`${id}-to`}
              type="date"
              className={cn(control, dateFocus)}
              value={params.to}
              min={DATA_PERIOD.from}
              max={DATA_PERIOD.to}
              aria-invalid={!rangeOk}
              aria-describedby={rangeOk ? undefined : `${id}-range`}
              onChange={(e) => e.target.value && onChange({ to: e.target.value })}
            />
          </Field>
        </div>
        {!rangeOk && (
          <p id={`${id}-range`} role="alert" className="text-sm font-medium text-danger">
            The "From" date must be on or before the "To" date.
          </p>
        )}
        <Field label="Radar data" htmlFor={`${id}-radar`}>
          <select
            id={`${id}-radar`}
            className={control}
            value={params.radar ?? ""}
            onChange={(e) => onChange({ radar: (e.target.value || null) as RadarFilter | null })}
          >
            <option value="">Any radar</option>
            {RADAR_FILTERS.map((r) => (
              <option key={r} value={r}>
                {RADAR_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Search possible fires" htmlFor={`${id}-q`}>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id={`${id}-q`}
              type="search"
              className={cn(control, "pl-9")}
              placeholder="Name or ID, e.g. SYN-01"
              value={params.q}
              onChange={(e) => onChange({ q: e.target.value })}
            />
          </div>
        </Field>
        <p className="text-xs text-muted-foreground">Dates and country filter the map and the list. Radar data and search filter the list of possible fires.</p>
      </div>

      {changed && (
        <div>
          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={onReset}>
            Clear filters
          </Button>
        </div>
      )}
    </form>
  );
}
