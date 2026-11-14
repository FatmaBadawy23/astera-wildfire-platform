import type { ReactNode } from "react";
import { Page } from "@/components/layout/Page";
import { AvailabilityStatus } from "@/components/science/AvailabilityStatus";
import {
  ChangeMaskLegendItem,
  ChangeScaleLegend,
  DetectionDensityLegend,
  FireDetectionLegendItem,
  LegendList,
  NoDataLegendItem,
  ReferencePerimeterLegendItem,
  SceneFootprintLegendItem,
} from "@/components/science/Legends";
import { MetadataList } from "@/components/science/MetadataList";
import { ProvenancePanel } from "@/components/science/ProvenancePanel";
import { ValueDisplay } from "@/components/science/SciValue";
import { ProvenanceBadges, SourceBadge } from "@/components/science/SourceBadges";
import { QueryState } from "@/components/states/QueryState";
import { EmptyState, ErrorState, LoadingState, UnavailableState } from "@/components/states/States";
import { aggregateDensity, densityClasses } from "@/data/aggregate";
import { useAnalysis, useAvailability, useDetections, useEvents, useScene } from "@/data/hooks";
import { isAnalysisAllowed } from "@/data/rules/availability";
import { BADGE_LABELS, SYNTHETIC_NOTE, type BadgeKey, type Provenance, type TimeWindow } from "@/data/types";
import { formatCoordinate, formatDateTimeUtc, formatPercent } from "@/lib/format";

/** Development only (route /dev/science, excluded from production builds). */

const DEMO_WINDOW: TimeWindow = { start: "2026-07-01T00:00:00Z", end: "2026-08-31T23:59:59Z" };
const EVENT_IDS = ["SYN-01", "SYN-02", "SYN-03", "SYN-04", "SYN-05", "SYN-06"];

const syn = (source: Provenance["source"], bands: Provenance["bands"] = []): Provenance => ({
  origin: "synthetic",
  source,
  productType: null,
  bands,
  processing: [],
  notes: [SYNTHETIC_NOTE],
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border border-border bg-surface p-5" aria-label={title}>
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function LiveEvents() {
  const query = useEvents();
  return (
    <QueryState query={query} loadingLabel="Loading synthetic events" isEmpty={(d) => d.length === 0} empty={<EmptyState title="No events">No events match the current filters.</EmptyState>}>
      {(events) => (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.id} className="grid gap-2 rounded-md border border-border p-3">
              <p className="font-semibold">
                {e.name} <span className="font-mono text-sm text-muted-foreground">{e.id}</span>
              </p>
              <ProvenanceBadges provenance={e.provenance} />
              <MetadataList
                items={[
                  { label: "Country", value: e.country.name },
                  { label: "Centroid", value: <span className="font-mono">{formatCoordinate(e.centroid)}</span> },
                  { label: "First detection", value: <span className="font-mono">{formatDateTimeUtc(e.firstDetection)}</span> },
                  { label: "Detections", value: <ValueDisplay value={e.detectionCount} digits={0} showMethod={false} /> },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
    </QueryState>
  );
}

function EventAvailability({ eventId }: { eventId: string }) {
  const query = useAvailability(eventId);
  return (
    <QueryState query={query} loadingLabel={`Loading availability for ${eventId}`}>
      {(report) => (
        <div className="grid gap-2 rounded-md border border-border p-3">
          <p className="font-mono text-sm">{eventId}</p>
          {report.pairs.map((p) => (
            <AvailabilityStatus key={p.id} pair={p} />
          ))}
          <p className="text-sm">
            Analysis allowed: <strong>{isAnalysisAllowed(report) ? "Yes" : "No"}</strong>
          </p>
        </div>
      )}
    </QueryState>
  );
}

function SceneMetadata({ sceneId }: { sceneId: string }) {
  const query = useScene(sceneId);
  return (
    <QueryState query={query} loadingLabel="Loading scene">
      {(s) => (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <h3 className="text-base font-semibold">
              Scene <span className="font-mono">{s.id}</span>
            </h3>
            <ProvenanceBadges provenance={s.provenance} />
            <MetadataList
              items={[
                { label: "Sensor", value: s.sensor },
                { label: "Product type", value: s.provenance.productType },
                { label: "Polarizations", value: s.polarizations?.join(", "), missingReason: "not stated" },
                { label: "Acquired", value: s.acquiredAt && <span className="font-mono">{formatDateTimeUtc(s.acquiredAt)}</span> },
                { label: "Resolution", value: <ValueDisplay value={s.resolution} digits={0} showMethod={false} /> },
                { label: "Event coverage", value: s.eventCoverage.value === null ? null : formatPercent(s.eventCoverage.value), missingReason: s.eventCoverage.missingReason },
                { label: "CRS", value: s.crs },
                { label: "Quality flags", value: s.qualityFlags?.length ? s.qualityFlags.join(", ") : s.qualityFlags ? "None" : null },
              ]}
            />
          </div>
          <ProvenancePanel provenance={s.provenance} />
        </div>
      )}
    </QueryState>
  );
}

function AnalysisExample({ eventId }: { eventId: string }) {
  const query = useAnalysis(eventId);
  return (
    <QueryState query={query} loadingLabel="Loading analysis">
      {(a) => (
        <div className="grid gap-2 rounded-md border border-border p-3">
          <p className="font-mono text-sm">
            {a.id} · status: {a.status}
          </p>
          {a.statusReason && <p className="text-sm">{a.statusReason}</p>}
          <MetadataList
            items={[
              { label: "Changed area", value: <ValueDisplay value={a.changedArea} /> },
              { label: "Mean change", value: <ValueDisplay value={a.meanChangeDb} digits={2} /> },
            ]}
          />
        </div>
      )}
    </QueryState>
  );
}

function DensityExample() {
  const query = useDetections({ window: DEMO_WINDOW });
  return (
    <QueryState query={query} loadingLabel="Loading detections">
      {(set) => {
        const grid = aggregateDensity(set.detections, set.window, syn("firms"), 0.1);
        return <DetectionDensityLegend classes={densityClasses(grid)} window={set.window} />;
      }}
    </QueryState>
  );
}

export function SciencePreview() {
  return (
    <Page
      title="Science components (development preview)"
      description="Development only, not part of the product. Every value below is synthetic. Add ?mockScenario=error, empty, slow or unavailable to the URL to see the other states."
    >
      <div className="grid gap-6">
        <Section title="Mock query: synthetic events">
          <LiveEvents />
        </Section>

        <Section title="Source badges">
          <ul className="flex flex-wrap gap-2" aria-label="All badges">
            {(Object.keys(BADGE_LABELS) as BadgeKey[]).map((k) => (
              <li key={k}>
                <SourceBadge badge={k} />
              </li>
            ))}
          </ul>
          <MetadataList
            items={[
              { label: "Synthetic Sentinel-1", value: <ProvenanceBadges provenance={syn("sentinel-1")} /> },
              { label: "Synthetic NISAR L-band", value: <ProvenanceBadges provenance={syn("nisar", ["L"])} /> },
              { label: "Synthetic NISAR L + S", value: <ProvenanceBadges provenance={syn("nisar", ["L", "S"])} /> },
              { label: "NISAR, band not stated", value: <ProvenanceBadges provenance={syn("nisar")} /> },
              { label: "Synthetic FIRMS", value: <ProvenanceBadges provenance={syn("firms")} /> },
            ]}
          />
        </Section>

        <Section title="Values and missing values">
          <MetadataList
            items={[
              { label: "Measured", value: <ValueDisplay value={{ value: 20, kind: "measured", unit: "m" }} digits={0} /> },
              { label: "Derived", value: <ValueDisplay value={{ value: -2.14, kind: "derived", unit: "dB", method: "Mean of post − pre (simulated)" }} digits={2} /> },
              {
                label: "Estimated with range",
                value: <ValueDisplay value={{ value: 18.4, kind: "estimated", unit: "km²", method: "Change-mask pixels × pixel area (simulated)", uncertainty: { lower: 15.9, upper: 21.2, description: null } }} />,
              },
              { label: "Estimated, no uncertainty", value: <ValueDisplay value={{ value: 9.7, kind: "estimated", unit: "km²", method: "Simulated", uncertainty: null }} /> },
              { label: "Missing value", value: <ValueDisplay value={{ value: null, kind: "measured", unit: "m", missingReason: "not stated in the metadata" }} /> },
              { label: "Placeholder", value: <ValueDisplay value={{ value: null, kind: "placeholder", unit: null }} /> },
            ]}
          />
        </Section>

        <Section title="Scene metadata with missing fields (SYN-02)">
          <SceneMetadata sceneId="SYN-02-S1" />
        </Section>

        <Section title="Availability for all six scenarios">
          <div className="grid gap-3 md:grid-cols-2">
            {EVENT_IDS.map((id) => (
              <EventAvailability key={id} eventId={id} />
            ))}
          </div>
        </Section>

        <Section title="Analysis results (complete, locked, failed)">
          <div className="grid gap-3">
            <AnalysisExample eventId="SYN-01" />
            <AnalysisExample eventId="SYN-04" />
            <AnalysisExample eventId="SYN-06" />
          </div>
        </Section>

        <Section title="Legends">
          <div className="grid gap-6 lg:grid-cols-2">
            <LegendList>
              <FireDetectionLegendItem />
              <ReferencePerimeterLegendItem source={null} />
              <SceneFootprintLegendItem />
              <ChangeMaskLegendItem />
              <NoDataLegendItem />
            </LegendList>
            <div className="grid gap-6">
              <ChangeScaleLegend />
              <DensityExample />
            </div>
          </div>
        </Section>

        <Section title="States">
          <div className="grid gap-3 md:grid-cols-2">
            <LoadingState label="Loading example" />
            <EmptyState title="No events">No events match these filters.</EmptyState>
            <ErrorState message="Example error message." onRetry={() => {}} detail={["example technical detail"]} />
            <UnavailableState message="Example: analysis is locked until a suitable pre/post pair exists." />
          </div>
        </Section>
      </div>
    </Page>
  );
}
