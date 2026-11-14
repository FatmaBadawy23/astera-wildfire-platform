import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router";
import { fireStoryPath } from "@/app/nav";
import { ProvenanceBadges } from "@/components/science/SourceBadges";
import { Button, buttonVariants } from "@/components/ui/button";
import { SOURCE_NAMES, type FireEvent } from "@/data/types";
import { NOT_AVAILABLE, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Jul 2026" in UTC; "Not available" for missing dates. */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return NOT_AVAILABLE;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NOT_AVAILABLE;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "12 Jul – 23 Jul 2026 (UTC)". */
export function formatDayRange(a: string | null, b: string | null): string {
  if (!a || !b) return NOT_AVAILABLE;
  const [, , yearA] = formatDay(a).split(" ");
  const [, , yearB] = formatDay(b).split(" ");
  const start = yearA === yearB ? formatDay(a).replace(` ${yearA}`, "") : formatDay(a);
  return `${start} – ${formatDay(b)} (UTC)`;
}

/** "110 heat spots" (the event's FIRMS detection count; "Not available" when missing). */
export function detectionCountText(e: FireEvent): string {
  const n = e.detectionCount.value;
  return n === null ? `Heat spots: ${NOT_AVAILABLE}` : `${formatNumber(n)} heat spot${n === 1 ? "" : "s"}`;
}

export function radarText(e: FireEvent): string | null {
  const radar = e.dataSources.filter((s) => s !== "firms").map((s) => SOURCE_NAMES[s]);
  return radar.length ? radar.join(", ") : null;
}

export function isSynthetic(e: FireEvent): boolean {
  return e.provenance.origin === "synthetic";
}

/** Where the possible fire is; invented locations say so. */
export function placeText(e: FireEvent): string {
  return isSynthetic(e) ? `Invented location placed in ${e.country.name}` : e.country.name;
}

export { fireStoryPath };

/** Possible fires (candidate events: groups of nearby FIRMS detections, never confirmed wildfires). */
export function CandidateEventList({
  events,
  selectedId,
  onSelect,
  hideMockBadge = false,
}: {
  events: FireEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The screen already shows the one demo label (demo bar); each item still says it is invented. */
  hideMockBadge?: boolean;
}) {
  return (
    <ul className="grid gap-2" aria-label="Possible fires">
      {events.map((e) => {
        const selected = e.id === selectedId;
        const radar = radarText(e);
        return (
          <li
            key={e.id}
            data-event-item={e.id}
            className={cn("grid gap-2 rounded-lg border bg-surface p-3", selected ? "border-primary ring-1 ring-primary" : "border-border")}
          >
            <div className="flex items-start gap-3">
              <svg width="22" height="22" viewBox="0 0 30 30" aria-hidden="true" className="mt-0.5 shrink-0">
                <circle cx="15" cy="15" r="11" fill="none" stroke="var(--aw-data-line-casing-light)" strokeWidth="4" />
                <circle cx="15" cy="15" r="11" fill="none" stroke="var(--aw-data-line-casing-dark)" strokeWidth="2" strokeDasharray="4 3" />
                <circle cx="15" cy="15" r="3" fill="var(--aw-data-line-casing-dark)" />
              </svg>
              <div className="grid min-w-0 gap-0.5">
                <h3 className="text-base font-semibold">
                  {e.id} · {e.name}
                </h3>
                <p className="text-sm text-muted-foreground">{placeText(e)}</p>
                <p className="text-sm">
                  {detectionCountText(e)} · {formatDayRange(e.firstDetection, e.lastDetection)}
                </p>
                {radar && <p className="text-sm text-muted-foreground">Radar data: {radar}</p>}
              </div>
            </div>
            <ProvenanceBadges provenance={e.provenance} hideMock={hideMockBadge} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={selected ? "primary" : "secondary"} size="sm" aria-pressed={selected} onClick={() => onSelect(e.id)}>
                <MapPin aria-hidden="true" />
                Show on map
                <span className="sr-only"> ({e.id})</span>
              </Button>
              <Link to={fireStoryPath(e.id)} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-primary")}>
                Full story
                <span className="sr-only"> of {e.id}</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
