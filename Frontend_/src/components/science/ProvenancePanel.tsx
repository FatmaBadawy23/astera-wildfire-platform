import { SOURCE_NAMES, type Provenance } from "@/data/types";
import { cn } from "@/lib/utils";
import { MetadataList } from "./MetadataList";
import { ProvenanceBadges } from "./SourceBadges";

function bandsText(p: Provenance): string | null {
  if (p.source === "sentinel-1") return "C-band";
  if (p.source !== "nisar") return null;
  return p.bands.length ? p.bands.map((b) => `${b}-band`).join(", ") : null;
}

/** Where a record comes from: origin (synthetic/observed), source, product, bands, processing, notes. */
export function ProvenancePanel({
  provenance,
  title = "Data source and provenance",
  headingLevel = 3,
  className,
}: {
  provenance: Provenance;
  title?: string;
  headingLevel?: 2 | 3 | 4;
  className?: string;
}) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const synthetic = provenance.origin === "synthetic";
  const showBands = provenance.source === "nisar" || provenance.source === "sentinel-1";
  return (
    <section className={cn("grid gap-3 rounded-lg border border-border bg-surface p-4", className)} aria-label={title}>
      <Heading className="text-base font-semibold">{title}</Heading>
      <ProvenanceBadges provenance={provenance} />
      {synthetic && (
        <p className="text-sm font-medium">Synthetic data: simulated for demonstration, not a satellite observation.</p>
      )}
      <MetadataList
        items={[
          { label: "Origin", value: synthetic ? "Synthetic" : "Observed" },
          { label: "Simulated", value: synthetic ? "Yes" : "No" },
          { label: "Source", value: SOURCE_NAMES[provenance.source] },
          { label: "Product type", value: provenance.productType, missingReason: "not stated" },
          ...(showBands ? [{ label: "Frequency band", value: bandsText(provenance), missingReason: "not stated in the metadata" }] : []),
          {
            label: "Processing history",
            value: provenance.processing.length ? (
              <ol className="list-decimal space-y-1 pl-5">
                {provenance.processing.map((s, i) => (
                  <li key={i}>
                    {s.step}
                    {s.detail ? <span className="text-muted-foreground"> ({s.detail})</span> : null}
                  </li>
                ))}
              </ol>
            ) : null,
          },
          {
            label: "Notes",
            value: provenance.notes.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {provenance.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null,
          },
        ]}
      />
    </section>
  );
}
