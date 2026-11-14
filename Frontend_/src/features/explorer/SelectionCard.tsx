import { ArrowRight, Bell, MessageCircleQuestion, Star, StarOff, X } from "lucide-react";
import { Link } from "react-router";
import { useHelp } from "@/components/help/HelpContext";
import { SafetyNote } from "@/components/help/SafetyNote";
import { ProvenanceBadges } from "@/components/science/SourceBadges";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusTag } from "@/components/ui/status-tag";
import type { ActiveFireDetection, FireEvent } from "@/data/types";
import { NOT_AVAILABLE, formatCoordinate, formatDateTimeUtc, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePlaces } from "@/features/places/placesStore";
import { fireStoryPath, formatDayRange, placeText, radarText } from "./CandidateEventList";

const card = "grid gap-3 rounded-lg border border-border-strong bg-surface p-4 text-sm shadow-md";

function CloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label={label} className="-mt-1 -mr-1">
      <X aria-hidden="true" />
    </Button>
  );
}

/** "Possible fire · not confirmed": the same dashed outline as the map marker. */
export function NotConfirmedChip() {
  return <p className="w-fit rounded-full border-[1.5px] border-dashed border-border-strong px-2.5 py-0.5 text-xs font-semibold">Possible fire · not confirmed</p>;
}

/** "Save this country": a real, browser-only list (My places). Alerts themselves are not available yet. */
function SaveCountry({ event }: { event: FireEvent }) {
  const { has, add, remove } = usePlaces();
  const saved = has(event.country.iso3);
  return (
    <div className="grid gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-pressed={saved}
        onClick={() => (saved ? remove(event.country.iso3) : add(event.country.iso3))}
        className="justify-start"
      >
        {saved ? <StarOff aria-hidden="true" /> : <Star aria-hidden="true" />}
        {saved ? `${event.country.name} saved (remove)` : `Save ${event.country.name} to My places`}
      </Button>
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Bell className="size-3.5" aria-hidden="true" />
        Alerts <StatusTag status="unavailable" /> ·{" "}
        <Link to="/places" className="font-medium text-primary underline underline-offset-2">
          My places
        </Link>
      </p>
    </div>
  );
}

/** The selected possible fire: plain summary, what is known and not known, and the next actions. */
export function EventSelectionCard({
  event,
  onClose,
  hideMockBadge = false,
  className,
}: {
  event: FireEvent;
  onClose: () => void;
  hideMockBadge?: boolean;
  className?: string;
}) {
  const { openHelp } = useHelp();
  const radar = radarText(event);
  const n = event.detectionCount.value;
  return (
    <section aria-label={`Selected possible fire ${event.id}`} data-selection="event" className={cn(card, className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-1.5">
          <NotConfirmedChip />
          <h2 className="text-lg font-semibold">
            {event.id} · {event.name}
          </h2>
          <p className="text-muted-foreground">{placeText(event)}</p>
        </div>
        <CloseButton onClose={onClose} label="Close possible fire summary" />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">When</dt>
        <dd>{formatDayRange(event.firstDetection, event.lastDetection)}</dd>
        <dt className="text-muted-foreground">Heat spots</dt>
        <dd>{n === null ? NOT_AVAILABLE : `${formatNumber(n)} recorded by satellite (NASA FIRMS)`}</dd>
        <dt className="text-muted-foreground">Radar data</dt>
        <dd>{radar ?? "None listed"}</dd>
      </dl>
      <ProvenanceBadges provenance={event.provenance} hideMock={hideMockBadge} />

      <div className="grid gap-2">
        <div className="rounded-md border border-border bg-background p-3">
          <p className="font-semibold">What we know</p>
          <ul className="mt-1 grid list-disc gap-0.5 pl-4">
            <li>Satellites recorded heat spots here during these dates.</li>
            <li>They are close together, so they are grouped as one possible fire.</li>
          </ul>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <p className="font-semibold">What we don't know yet</p>
          <ul className="mt-1 grid list-disc gap-0.5 pl-4">
            <li>Whether it was a wildfire: nobody has checked it on the ground.</li>
            <li>The size of any burned area: heat spots do not show it.</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-2">
        <Link to={fireStoryPath(event.id)} className={cn(buttonVariants({ size: "sm" }), "w-full")}>
          See the full story
          <span className="sr-only"> of {event.id}</span>
          <ArrowRight aria-hidden="true" />
        </Link>
        <SaveCountry event={event} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-start text-primary"
          onClick={() => openHelp({ tab: "ask", askAbout: `${event.id} · ${event.name}` })}
        >
          <MessageCircleQuestion aria-hidden="true" />
          Ask about this fire
        </Button>
      </div>
      <SafetyNote />
    </section>
  );
}

/** One clicked heat spot: what it is and what it is not. */
export function DetectionSelectionCard({
  detection,
  onClose,
  hideMockBadge = false,
  className,
}: {
  detection: ActiveFireDetection;
  onClose: () => void;
  hideMockBadge?: boolean;
  className?: string;
}) {
  const [lon, lat] = detection.geometry.coordinates;
  return (
    <section aria-label="Selected heat spot" data-selection="detection" className={cn(card, className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <h2 className="text-lg font-semibold">Heat spot</h2>
          <p className="text-xs text-muted-foreground">One NASA FIRMS active-fire detection</p>
        </div>
        <CloseButton onClose={onClose} label="Close heat spot details" />
      </div>
      <p>A satellite sensed unusual heat at this point. It is not a confirmed wildfire and not burned area.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Detected</dt>
        <dd>{formatDateTimeUtc(detection.acquiredAt)}</dd>
        <dt className="text-muted-foreground">Location</dt>
        <dd>{formatCoordinate({ lon, lat })}</dd>
        <dt className="text-muted-foreground">Satellite</dt>
        <dd>{[detection.satellite, detection.instrument].filter(Boolean).join(" · ") || NOT_AVAILABLE}</dd>
        <dt className="text-muted-foreground">Confidence</dt>
        <dd>
          {detection.confidence ?? NOT_AVAILABLE} <span className="text-muted-foreground">(as reported)</span>
        </dd>
        <dt className="text-muted-foreground">Possible fire</dt>
        <dd>{detection.eventId ?? "None (not grouped)"}</dd>
      </dl>
      <ProvenanceBadges provenance={detection.provenance} hideMock={hideMockBadge} />
      {detection.eventId && (
        <Link to={fireStoryPath(detection.eventId)} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "w-full")}>
          Full story of {detection.eventId}
          <ArrowRight aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
