import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, BellOff, History, MapPin, Trash2 } from "lucide-react";
import { getDataMode } from "@/app/env";
import { fireStoryPath } from "@/app/nav";
import { SafetyNote } from "@/components/help/SafetyNote";
import { CountrySearch } from "@/components/search/CountrySearch";
import { EmptyState, LoadingState } from "@/components/states/States";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusTag } from "@/components/ui/status-tag";
import { useCountryIndex, type CountryOption } from "@/data/countryIndex";
import { useDetections, useEvents } from "@/data/hooks";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatDayRange } from "@/features/explorer/CandidateEventList";
import { DATA_PERIOD, toWindow } from "@/features/explorer/useExplorerParams";
import { usePlaces } from "./placesStore";

const WINDOW = toWindow(DATA_PERIOD);

/** What the data holds for one saved country (counts come straight from the dataset; nothing is estimated). */
function PlaceCard({ place, onRemove }: { place: CountryOption; onRemove: () => void }) {
  const events = useEvents({ countryIso3: place.iso3, window: WINDOW });
  const detections = useDetections({ window: WINDOW, countryIso3: place.iso3 });
  const loading = events.isPending || detections.isPending;
  const nEvents = events.data?.length ?? 0;
  const nSpots = detections.data?.detections.length ?? 0;
  const latest = [...(events.data ?? [])].sort((a, b) => Date.parse(b.lastDetection ?? "") - Date.parse(a.lastDetection ?? ""))[0];

  return (
    <li data-place={place.iso3} className="grid gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">{place.name}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove ${place.name}`}>
          <Trash2 aria-hidden="true" />
          Remove
        </Button>
      </div>
      {loading ? (
        <LoadingState label={`Loading ${place.name}`} />
      ) : events.isError || detections.isError ? (
        <p className="text-sm">The data for {place.name} couldn't be loaded.</p>
      ) : nEvents === 0 && nSpots === 0 ? (
        <p className="text-sm text-muted-foreground">No possible fires or heat spots for {place.name} in the current data ({formatDayRange(WINDOW.start, WINDOW.end)}).</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Possible fires</dt>
          <dd className="font-semibold text-foreground-strong">{formatNumber(nEvents)}</dd>
          <dt className="text-muted-foreground">Heat spots</dt>
          <dd className="font-semibold text-foreground-strong">{formatNumber(nSpots)}</dd>
          <dt className="text-muted-foreground">Period</dt>
          <dd>{formatDayRange(WINDOW.start, WINDOW.end)}</dd>
          {latest && (
            <>
              <dt className="text-muted-foreground">Most recent</dt>
              <dd>
                <Link to={fireStoryPath(latest.id)} className="font-medium text-primary underline underline-offset-2">
                  {latest.id} · {latest.name}
                </Link>
              </dd>
            </>
          )}
        </dl>
      )}
      <div className="flex flex-wrap gap-2">
        <Link to={`/?country=${place.iso3}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <MapPin aria-hidden="true" />
          Show on the Fire map<span className="sr-only"> ({place.name})</span>
        </Link>
        <Link to={`/history?country=${place.iso3}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-primary")}>
          <History aria-hidden="true" />
          Fire history<span className="sr-only"> of {place.name}</span>
        </Link>
      </div>
    </li>
  );
}

/** My Places & Alerts: save countries (this browser only) and see what the data holds for them. Alerts: not available yet. */
export function MyPlacesPage() {
  const { index, isLoading } = useCountryIndex();
  const { places, add, remove, has, max } = usePlaces();
  const [message, setMessage] = useState("");
  const demo = getDataMode() === "mock";
  const saved = places.map((iso) => index.find((c) => c.iso3 === iso) ?? { iso3: iso, name: iso, aliases: [], bbox: null, hasData: false });

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-8 sm:px-6">
      <div className="grid gap-3">
        <h1 data-page-heading tabIndex={-1} className="text-3xl font-bold">
          My Places & Alerts
        </h1>
        <p className="max-w-prose text-muted-foreground">
          Keep an eye on the countries you care about. Your list is saved in this browser on this device only: no account, and nothing is sent
          anywhere.
        </p>
      </div>

      <section aria-labelledby="add-heading" className="grid gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 id="add-heading" className="text-lg font-semibold">
          Add a place
        </h2>
        <CountrySearch
          index={index}
          label="Search for a country to save"
          hint={isLoading ? "Loading the country list…" : `Countries only. Up to ${max} places.`}
          dataLabel={demo ? "in the demo data" : "in the data"}
          onSelect={(c) => {
            if (has(c.iso3)) setMessage(`${c.name} is already in your places.`);
            else if (places.length >= max) setMessage(`You can save up to ${max} places. Remove one first.`);
            else {
              add(c.iso3);
              setMessage(`${c.name} saved to your places.`);
            }
          }}
        />
        <p role="status" className="text-sm font-medium" data-places-message>
          {message}
        </p>
      </section>

      <section aria-labelledby="saved-heading" className="grid gap-3">
        <h2 id="saved-heading" className="text-xl font-semibold">
          Your places{places.length > 0 && <span className="font-normal text-muted-foreground"> · {places.length}</span>}
        </h2>
        {places.length === 0 ? (
          <EmptyState title="No places saved yet">
            Search for a country above, or use “Save this country” on any possible fire on the Fire map.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {saved.map((p) => (
              <PlaceCard
                key={p.iso3}
                place={p}
                onRemove={() => {
                  remove(p.iso3);
                  setMessage(`${p.name} removed from your places.`);
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="alerts-heading" className="grid gap-3 rounded-lg border border-border bg-surface p-5" data-alerts>
        <div className="flex flex-wrap items-center gap-2">
          <BellOff className="size-5 text-muted-foreground" aria-hidden="true" />
          <h2 id="alerts-heading" className="text-lg font-semibold">
            Alerts
          </h2>
          <StatusTag status="unavailable" />
        </div>
        <p className="text-sm">
          Astera Watch can't send alerts yet, so it doesn't ask for your email or phone number. How alerts would work: you choose a place, and Astera
          Watch tells you when new heat spots appear there.
        </p>
        <details className="text-sm">
          <summary className="w-fit cursor-pointer font-medium text-primary">What is still missing</summary>
          <ul className="mt-2 grid list-disc gap-1 pl-5">
            <li>User accounts, so your places can follow you to other devices.</li>
            <li>A live connection to satellite heat data{demo ? " (today the site shows demo data)" : ""}.</li>
            <li>A way to send notifications.</li>
          </ul>
        </details>
      </section>

      <SafetyNote />
      <div>
        <Link to="/" className={buttonVariants()}>
          Go to the Fire map
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
