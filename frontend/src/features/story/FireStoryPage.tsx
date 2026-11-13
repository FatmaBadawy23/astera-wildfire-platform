import { Suspense, lazy, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Download, FileJson, MapPin, MessageCircleQuestion, Printer, Star, StarOff } from "lucide-react";
import { GUIDE_PATH, HOW_PATH } from "@/app/nav";
import { getDataMode } from "@/app/env";
import { useHelp } from "@/components/help/HelpContext";
import { SafetyNote } from "@/components/help/SafetyNote";
import { usePageTitle } from "@/components/layout/useRouteFocus";
import { AvailabilityStatus } from "@/components/science/AvailabilityStatus";
import { ChangeScaleLegend, HeatSpotSymbol, LEGEND_TEXT } from "@/components/science/Legends";
import { MetadataList } from "@/components/science/MetadataList";
import { ProvenancePanel } from "@/components/science/ProvenancePanel";
import { ValueDisplay } from "@/components/science/SciValue";
import { ProvenanceBadges } from "@/components/science/SourceBadges";
import { QueryState } from "@/components/states/QueryState";
import { EmptyState, LoadingState, UnavailableState } from "@/components/states/States";
import { Button, buttonVariants } from "@/components/ui/button";
import { toDataError } from "@/data/errors";
import { useAnalysis, useAvailability, useDetections, useEvent } from "@/data/hooks";
import type { ActiveFireDetection, AnalysisResult, AvailabilityReport, FireEvent, SceneSummary } from "@/data/types";
import { formatDateTimeUtc, formatNumber, formatPercent, formatWithUnit } from "@/lib/format";
import { formatDay, formatDayRange, isSynthetic, placeText, radarText } from "@/features/explorer/CandidateEventList";
import { DEFAULT_LAYERS } from "@/features/explorer/layerHelp";
import { DetectionSelectionCard, NotConfirmedChip } from "@/features/explorer/SelectionCard";
import { DATA_PERIOD, toWindow } from "@/features/explorer/useExplorerParams";
import { ArticleContent } from "@/features/guide/ArticleContent";
import { ARTICLES } from "@/features/guide/guideArticles";
import { usePlaces } from "@/features/places/placesStore";
import { DetectionTimeline } from "./DetectionTimeline";
import { detectionsCsv, downloadText, storyJson } from "./report";

const ExplorerMap = lazy(() => import("@/features/explorer/ExplorerMap"));
const WINDOW = toWindow(DATA_PERIOD);
const noop = () => {};

const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "known", label: "What we know" },
  { id: "heat-spots", label: "Heat spots" },
  { id: "radar-data", label: "Radar images" },
  { id: "analysis", label: "Radar analysis" },
  { id: "report", label: "Report" },
  { id: "learn", label: "Learn more" },
] as const;

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="grid scroll-mt-4 gap-3 rounded-lg border border-border bg-surface p-5" data-story-section={id}>
      <h2 id={`${id}-heading`} className="text-xl font-semibold">
        {title}
      </h2>
      {intro && <p className="max-w-prose text-sm text-muted-foreground">{intro}</p>}
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-0.5 rounded-md border border-border bg-background p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-foreground-strong">{children}</dd>
    </div>
  );
}

function suitablePair(a: AvailabilityReport | undefined) {
  return a?.pairs.find((p) => p.status === "suitable") ?? null;
}

function radarImagesText(a: AvailabilityReport | undefined, loading: boolean): string {
  if (loading) return "Checking…";
  if (!a) return "Not available";
  if (suitablePair(a)) return "Before and after: usable pair";
  if (a.preScenes.length + a.postScenes.length === 0) return "None found";
  return "No usable before/after pair";
}

function analysisStatusText(a: AnalysisResult | undefined, loading: boolean): string {
  if (loading) return "Checking…";
  if (!a) return "Not available";
  return { complete: "Result available", locked: "Not possible (no usable pair)", "not-run": "Not run yet", running: "Running", failed: "Failed, no result" }[a.status];
}

/** "What we know" / "What we don't know yet", built only from the records that exist. */
function KnownUnknown({ event, availability, analysis }: { event: FireEvent; availability?: AvailabilityReport; analysis?: AnalysisResult }) {
  const n = event.detectionCount.value;
  const pair = suitablePair(availability);
  const scenes = availability ? [...availability.preScenes, ...availability.postScenes] : [];
  const sceneDate = (id: string | null) => formatDay(scenes.find((s) => s.id === id)?.acquiredAt ?? null);
  const complete = analysis?.status === "complete";
  const known: ReactNode[] = [
    n === null ? "Satellites recorded heat spots here (the number is not available)." : `Satellites recorded ${formatNumber(n)} heat spots here, ${formatDayRange(event.firstDetection, event.lastDetection)}.`,
    "They are close together in place and time, so they are grouped as one possible fire.",
  ];
  if (pair) known.push(`Radar images exist from before (${sceneDate(pair.preSceneId)}) and after (${sceneDate(pair.postSceneId)}) that can be compared.`);
  else if (scenes.length) known.push("Some radar images of this area exist, but no before/after pair can be compared (see Radar images).");
  if (complete && analysis.changedArea.value !== null) {
    known.push(
      `The radar signal changed: estimated ${formatWithUnit(analysis.changedArea.value, analysis.changedArea.unit)} of strong surface change, average change ${formatWithUnit(analysis.meanChangeDb.value, "dB", 2)}.`,
    );
  }
  const unknown: ReactNode[] = [
    "Whether it was a wildfire: nobody has checked it on the ground.",
    "How much land burned: heat spots and radar change don't measure burned area directly.",
  ];
  if (!complete) unknown.push(`What changed on the ground: there is no radar result${analysis?.statusReason ? ` (${analysis.statusReason.replace(/\.$/, "")})` : ""}.`);
  else unknown.push("Whether the radar change was caused by fire: vegetation, soil moisture and other factors also change the radar signal.");
  unknown.push(`Whether it is still burning: the data ends on ${formatDay(event.lastDetection)}.`);
  if (isSynthetic(event)) unknown.push("Anything about a real place: this is demo data with an invented location.");

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-md border border-border bg-background p-4" data-known>
        <h3 className="text-base font-semibold">What we know</h3>
        <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm">
          {known.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-md border border-dashed border-border-strong bg-background p-4" data-unknown>
        <h3 className="text-base font-semibold">What we don't know yet</h3>
        <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm">
          {unknown.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SceneCard({ scene, role }: { scene: SceneSummary; role: "Before" | "After" }) {
  return (
    <div className="grid content-start gap-2 rounded-md border border-border bg-background p-3 text-sm" data-scene={scene.id}>
      <p className="font-semibold text-foreground-strong">
        {role} the heat spots · {formatDay(scene.acquiredAt)}
      </p>
      <ProvenanceBadges provenance={scene.provenance} hideMock />
      <p>
        {scene.sensor} radar image, covering {scene.eventCoverage.value === null ? "an unknown share" : formatPercent(scene.eventCoverage.value)} of the area.
      </p>
      <details>
        <summary className="w-fit cursor-pointer font-medium text-primary">Technical details</summary>
        <MetadataList
          className="mt-2"
          items={[
            { label: "Scene ID", value: <span className="font-mono">{scene.id}</span> },
            { label: "Acquired", value: scene.acquiredAt ? formatDateTimeUtc(scene.acquiredAt) : null },
            { label: "Product type", value: scene.provenance.productType, missingReason: "not stated" },
            { label: "Polarizations", value: scene.polarizations?.join(", "), missingReason: "not stated in the metadata" },
            { label: "Resolution", value: scene.resolution.value === null ? null : formatWithUnit(scene.resolution.value, scene.resolution.unit, 0), missingReason: scene.resolution.missingReason },
            { label: "Orbit", value: scene.orbitDirection },
            { label: "Coordinate system", value: scene.crs },
          ]}
        />
      </details>
    </div>
  );
}

function RadarImages({ report }: { report: AvailabilityReport }) {
  const scenes = new Map([...report.preScenes, ...report.postScenes].map((s) => [s.id, s]));
  return (
    <div className="grid gap-4">
      <p className="text-sm">
        Searched for images from {formatDayRange(report.preWindow.start, report.preWindow.end)} (before) and {formatDayRange(report.postWindow.start, report.postWindow.end)}{" "}
        (after).
      </p>
      {report.pairs.map((pair) => {
        const pre = pair.preSceneId ? scenes.get(pair.preSceneId) : undefined;
        const post = pair.postSceneId ? scenes.get(pair.postSceneId) : undefined;
        return (
          <div key={pair.id} className="grid gap-3" data-pair={pair.id}>
            <div className="grid gap-3 md:grid-cols-2">
              {pre ? <SceneCard scene={pre} role="Before" /> : <EmptyState title="No image from before">No radar image of this area was found before the heat spots.</EmptyState>}
              {post ? <SceneCard scene={post} role="After" /> : <EmptyState title="No image from after">No radar image of this area was found after the heat spots.</EmptyState>}
            </div>
            <div className="rounded-md border border-border-strong p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Can these images be compared?</p>
              <AvailabilityStatus pair={pair} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Analysis({ analysis }: { analysis: AnalysisResult }) {
  if (analysis.status === "locked") {
    return (
      <UnavailableState title="Radar analysis is not possible" message={analysis.statusReason ?? "There is no usable before/after radar image pair."}>
        <p className="text-sm text-muted-foreground">No result is shown, and none is estimated in its place.</p>
      </UnavailableState>
    );
  }
  if (analysis.status !== "complete") {
    return (
      <UnavailableState title={analysis.status === "failed" ? "The radar analysis failed" : "No radar result yet"} message={analysis.statusReason ?? "No result was produced."} />
    );
  }
  return (
    <div className="grid gap-4">
      <dl className="grid gap-3 md:grid-cols-2">
        <div className="grid content-start gap-1 rounded-md border border-border bg-background p-3">
          <dt className="text-sm font-medium">Area of strong surface change</dt>
          <dd className="text-sm">
            <ValueDisplay value={analysis.changedArea} showMethod={false} />
          </dd>
          <dd className="text-xs text-muted-foreground">Not a burned-area measurement.</dd>
        </div>
        <div className="grid content-start gap-1 rounded-md border border-border bg-background p-3">
          <dt className="text-sm font-medium">Average radar signal change</dt>
          <dd className="text-sm">
            <ValueDisplay value={analysis.meanChangeDb} digits={2} showMethod={false} />
          </dd>
          <dd className="text-xs text-muted-foreground">Negative = the signal got weaker after the heat spots.</dd>
        </div>
      </dl>
      <p className="text-sm">
        <span className="font-semibold text-foreground-strong">Confidence: {analysis.confidence.level ?? "not available"}.</span> {analysis.confidence.explanation}
      </p>
      <div className="grid gap-2 rounded-md border border-border bg-background p-3">
        <ChangeScaleLegend />
        <p className="text-xs text-muted-foreground">The change map image itself is not available in this data, so only the numbers are shown.</p>
      </div>
      {analysis.limitations.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold text-foreground-strong">Limitations</p>
          <ul className="mt-1 grid list-disc gap-1 pl-5">
            {analysis.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      <details className="text-sm">
        <summary className="w-fit cursor-pointer font-medium text-primary">Technical details: method and provenance</summary>
        <div className="mt-2 grid gap-3">
          <MetadataList
            items={[
              { label: "Method", value: analysis.method?.name },
              { label: "Polarization", value: analysis.method?.polarization },
              { label: "Change threshold", value: analysis.method ? <ValueDisplay value={analysis.method.threshold} digits={1} /> : null },
              { label: "Area method", value: analysis.changedArea.method },
              { label: "Average change method", value: analysis.meanChangeDb.method },
            ]}
          />
          <ProvenancePanel provenance={analysis.provenance} title="Analysis provenance" />
        </div>
      </details>
    </div>
  );
}

function StoryMap({ event, detections }: { event: FireEvent; detections: ActiveFireDetection[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const detection = detections.find((d) => d.id === selected) ?? null;
  return (
    <div className="grid gap-3">
      <div data-map-frame className="relative h-[320px] overflow-hidden rounded-md border border-border-strong bg-map">
        <Suspense fallback={<LoadingState label="Loading the map" className="p-6" />}>
          <ExplorerMap
            events={[event]}
            detections={detections}
            detectionProvenance={detections[0]?.provenance ?? null}
            window={WINDOW}
            layers={DEFAULT_LAYERS}
            selectedEventId={event.id}
            onSelectEvent={noop}
            onSelectDetection={setSelected}
            onDensityChange={noop}
          />
        </Suspense>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Map key">
        <li className="flex items-center gap-1.5">
          <HeatSpotSymbol size={16} />
          Heat spot ({LEGEND_TEXT.fireDetection.split(":")[1]?.trim()})
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-4 border border-border-strong" style={{ background: "var(--aw-data-density-3)" }} aria-hidden="true" />
          Shaded square: heat spots per square, not burned area
        </li>
        <li>Background: long-term land cover and relief (Natural Earth), not current vegetation.</li>
        <li>Click a heat spot to see when it was detected.</li>
      </ul>
      {detection && <DetectionSelectionCard detection={detection} onClose={() => setSelected(null)} hideMockBadge />}
    </div>
  );
}

function SaveCountryButton({ event }: { event: FireEvent }) {
  const { has, add, remove } = usePlaces();
  const saved = has(event.country.iso3);
  return (
    <Button type="button" variant="secondary" size="sm" aria-pressed={saved} onClick={() => (saved ? remove(event.country.iso3) : add(event.country.iso3))}>
      {saved ? <StarOff aria-hidden="true" /> : <Star aria-hidden="true" />}
      {saved ? `${event.country.name} is in My places (remove)` : `Save ${event.country.name} to My places`}
    </Button>
  );
}

function Story({ event }: { event: FireEvent }) {
  const demo = getDataMode() === "mock";
  const { openHelp } = useHelp();
  const detectionsQ = useDetections({ window: WINDOW, eventId: event.id });
  const availabilityQ = useAvailability(event.id);
  const analysisQ = useAnalysis(event.id);
  const detections = detectionsQ.data?.detections ?? [];
  const radar = radarText(event);
  const fileBase = `astera-watch-${event.id.toLowerCase()}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/?event=${encodeURIComponent(event.id)}`} className={buttonVariants({ size: "sm" })}>
          <MapPin aria-hidden="true" />
          Show on the Fire map
        </Link>
        <SaveCountryButton event={event} />
        <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={() => openHelp({ tab: "ask", askAbout: `${event.id} · ${event.name}` })}>
          <MessageCircleQuestion aria-hidden="true" />
          Ask about this fire
        </Button>
      </div>

      <nav aria-label="On this page" className="print:hidden">
        <ul className="flex flex-wrap gap-x-1 gap-y-1 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-primary hover:bg-surface-raised">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="summary" title="Summary">
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          <Fact label="When">{formatDayRange(event.firstDetection, event.lastDetection)}</Fact>
          <Fact label="Where">{event.country.name}</Fact>
          <Fact label="Heat spots">{event.detectionCount.value === null ? "Not available" : formatNumber(event.detectionCount.value)}</Fact>
          <Fact label="Radar images">{radarImagesText(availabilityQ.data, availabilityQ.isPending)}</Fact>
          <Fact label="Radar analysis">{analysisStatusText(analysisQ.data, analysisQ.isPending)}</Fact>
        </dl>
        <p className="text-sm">{event.description}</p>
        <ProvenanceBadges provenance={event.provenance} hideMock={demo} />
        {radar && <p className="text-sm text-muted-foreground">Radar data listed for this possible fire: {radar}.</p>}
      </Section>

      <Section id="known" title="What we know and what we don't know yet">
        <KnownUnknown event={event} availability={availabilityQ.data} analysis={analysisQ.data} />
      </Section>

      <Section id="heat-spots" title="Heat spots" intro="Each heat spot is one satellite detection of heat (NASA FIRMS). Together they show when and where heat was seen, not how much land burned.">
        <QueryState query={detectionsQ} loadingLabel="Loading heat spots">
          {(set) => (
            <div className="grid gap-5 lg:grid-cols-2">
              <StoryMap event={event} detections={set.detections} />
              <DetectionTimeline detections={set.detections} />
            </div>
          )}
        </QueryState>
      </Section>

      <Section id="radar-data" title="Radar images from before and after" intro="Radar sees through smoke and clouds. Two images can only be compared when they come from the same sensor, band and product type.">
        <QueryState query={availabilityQ} loadingLabel="Checking radar images">
          {(report) => <RadarImages report={report} />}
        </QueryState>
      </Section>

      <Section id="analysis" title="Radar analysis: surface change" intro="When a usable pair exists, the analysis estimates where the ground surface changed. It can't say on its own that fire caused the change.">
        {analysisQ.isError && toDataError(analysisQ.error).kind === "not-found" ? (
          <UnavailableState title="No radar analysis" message="No analysis exists for this possible fire." />
        ) : (
          <QueryState query={analysisQ} loadingLabel="Loading the radar analysis">
            {(a) => <Analysis analysis={a} />}
          </QueryState>
        )}
      </Section>

      <Section id="report" title="Report" intro="Download exactly the data shown on this page, with its source labels, or print the page.">
        {demo && <p className="text-sm">The files say that the records are demo data (synthetic), not satellite observations.</p>}
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!detectionsQ.isSuccess}
            onClick={() =>
              downloadText(
                `${fileBase}.json`,
                storyJson({ event, detections, availability: availabilityQ.data ?? null, analysis: analysisQ.data ?? null }, new Date().toISOString()),
                "application/json",
              )
            }
          >
            <FileJson aria-hidden="true" />
            Download all data (JSON)
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={!detectionsQ.isSuccess} onClick={() => downloadText(`${fileBase}-heat-spots.csv`, detectionsCsv(detections), "text/csv")}>
            <Download aria-hidden="true" />
            Download heat spots (CSV)
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            Print this page
          </Button>
        </div>
        <details className="text-sm">
          <summary className="w-fit cursor-pointer font-medium text-primary">Where this possible fire's data comes from</summary>
          <ProvenancePanel provenance={event.provenance} title="Possible fire provenance" className="mt-2" />
        </details>
      </Section>

      <Section id="learn" title="Learn more">
        <div className="grid gap-3 md:grid-cols-2">
          {(["possible-fire", "radar", "analysis", "data-labels"] as const).map((id) => (
            <details key={id} className="rounded-md border border-border bg-background px-3 py-1 text-sm">
              <summary className="min-h-10 cursor-pointer py-2 font-medium">{ARTICLES[id].question}</summary>
              <div className="pb-3">
                <ArticleContent article={ARTICLES[id]} />
              </div>
            </details>
          ))}
        </div>
        <p className="text-sm">
          <Link to={GUIDE_PATH} className="font-medium text-primary underline underline-offset-2">
            User Guide
          </Link>{" "}
          ·{" "}
          <Link to={HOW_PATH} className="font-medium text-primary underline underline-offset-2">
            How it works
          </Link>
        </p>
      </Section>

      <SafetyNote />
    </>
  );
}

/** Fire Story: everything about one possible fire, opened from the map, the list, history or My places. */
export function FireStoryPage() {
  const { eventId = "" } = useParams();
  const eventQ = useEvent(eventId);
  const event = eventQ.data;
  usePageTitle(event ? `${event.id} · Fire Story` : null);
  const notFound = eventQ.isError && toDataError(eventQ.error).kind === "not-found";

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-6 sm:px-6">
      <Link to="/history" className="inline-flex min-h-9 w-fit items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-2 print:hidden">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Fire history
      </Link>
      <div className="grid gap-2">
        <p className="caps-heading text-xs font-semibold text-muted-foreground">Fire Story</p>
        {event && <NotConfirmedChip />}
        <h1 data-page-heading tabIndex={-1} className="text-3xl font-bold">
          {event ? `${event.id} · ${event.name}` : notFound ? "Possible fire not found" : "Fire Story"}
        </h1>
        {event && <p className="text-muted-foreground">{placeText(event)}</p>}
      </div>
      {notFound ? (
        <EmptyState title={`There is no possible fire “${eventId}”`}>
          <Link to="/history" className="font-medium text-primary underline underline-offset-2">
            See all possible fires
          </Link>
        </EmptyState>
      ) : (
        <QueryState query={eventQ} loadingLabel="Loading the possible fire">
          {(e) => <Story event={e} />}
        </QueryState>
      )}
    </div>
  );
}
