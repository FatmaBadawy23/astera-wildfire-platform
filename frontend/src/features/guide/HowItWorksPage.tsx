import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { getDataMode } from "@/app/env";
import { GUIDE_PATH, PLANNED_PATH } from "@/app/nav";
import { NOT_NASA_TEXT, SafetyNote } from "@/components/help/SafetyNote";
import { SourceBadge } from "@/components/science/SourceBadges";
import { PageHeader } from "@/components/layout/Page";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VALUE_KIND_DEFINITIONS } from "@/data/types";
import { cn } from "@/lib/utils";

interface Step {
  title: string;
  plain: ReactNode;
  technical: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Satellites sense heat",
    plain: "Satellites carrying heat sensors pass over every part of the world several times a day and record places that are unusually hot.",
    technical: (
      <p>
        NASA FIRMS active-fire detections (MODIS, VIIRS). Each detection is a point with a time, a satellite and a confidence value exactly as the
        source reports it. Detections are never treated as burned-area polygons or ground truth.
      </p>
    ),
  },
  {
    title: "Heat spots are grouped into possible fires",
    plain: "Heat spots close together in place and time are grouped into one possible fire, so you can look at them together.",
    technical: <p>The groups are candidate events. Their status is always “candidate”: Astera Watch does not confirm fires.</p>,
  },
  {
    title: "Radar images from before and after are looked up",
    plain: "For each possible fire, Astera Watch looks for radar images of the same area from before and after the heat spots.",
    technical: (
      <p>
        Products: NISAR GCOV and GSLC (L-band and S-band, kept separate) and Sentinel-1 (C-band). Scene footprints, dates, polarizations, resolution and
        coverage come from the product metadata. Missing metadata stays “Not available”; it is never guessed.
      </p>
    ),
  },
  {
    title: "The images are checked before any comparison",
    plain: "Two images are compared only if they really can be compared. If not, the Fire Story says why, and no result is made up.",
    technical: (
      <p>
        A pair is unsuitable when the sensors, bands or product types differ, no polarization is shared, the dates are in the wrong order, coverage is
        too low, a quality flag is set, or required metadata is missing.
      </p>
    ),
  },
  {
    title: "Surface change is estimated",
    plain: "For a suitable pair, the analysis measures how much the radar signal changed and estimates where the ground changed a lot.",
    technical: (
      <p>
        Log-ratio backscatter change (dB, after minus before) with a threshold chosen from each pair's own change distribution; changed area = pixels
        beyond the threshold × pixel area in an equal-area projection, reported as an estimate with an uncertainty range. No universal thresholds;
        Sentinel-1 thresholds are never reused for NISAR.
      </p>
    ),
  },
  {
    title: "Everything is labelled",
    plain: "Every value says whether it was measured, calculated or estimated, where it comes from, and whether it is demo data.",
    technical: <p>Provenance (origin, source, product type, band, processing steps) travels with every record and is shown in each Fire Story.</p>,
  },
];

export function HowItWorksPage() {
  const demo = getDataMode() === "mock";
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="How It Works"
        description="From a satellite sensing heat to a radar estimate of surface change, in six steps. Open “Technical details” in any step for the method."
      />

      <ol className="grid gap-4" aria-label="Steps">
        {STEPS.map((s, i) => (
          <Card as="li" padding="lg" key={s.title} className="grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-full border border-primary bg-planned font-heading text-lg font-bold text-primary">
              {i + 1}
            </span>
            <div className="grid gap-2">
              <h2 className="text-lg font-semibold">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h2>
              <p className="text-sm">{s.plain}</p>
              <details className="rounded-md border border-border bg-background px-3 py-1 text-sm">
                <summary className="min-h-9 cursor-pointer py-1.5 font-medium text-primary">Technical details</summary>
                <div className="grid gap-2 pb-2">{s.technical}</div>
              </details>
            </div>
          </Card>
        ))}
      </ol>

      <section aria-labelledby="labels-heading" className="grid gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 id="labels-heading" className="text-lg font-semibold">
          How values are labelled
        </h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
          {Object.values(VALUE_KIND_DEFINITIONS)
            .filter((k) => k.label !== "Placeholder")
            .map((k) => (
              <div key={k.label} className="contents">
                <dt className="font-semibold text-foreground-strong">{k.label}</dt>
                <dd>{k.definition}</dd>
              </div>
            ))}
          <dt className="font-semibold text-foreground-strong">Demo</dt>
          <dd>Synthetic data invented for testing. Never a satellite observation.</dd>
        </dl>
      </section>

      <section aria-labelledby="sources-heading" className="grid gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 id="sources-heading" className="text-lg font-semibold">
          Data sources
        </h2>
        <ul className="grid gap-2 text-sm">
          <li className="flex flex-wrap items-center gap-2">
            <SourceBadge badge="firms" /> NASA FIRMS active-fire detections (heat spots).
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <SourceBadge badge="nisar-l-band" /> <SourceBadge badge="nisar-s-band" /> NISAR radar (NASA–ISRO), L-band and S-band.
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <SourceBadge badge="sentinel-1-c-band" /> Sentinel-1 radar (ESA Copernicus), C-band.
          </li>
          <li>Basemap: Natural Earth (public domain), simplified country outlines and names.</li>
        </ul>
        {demo && (
          <p className="text-sm text-muted-foreground">
            Today the site runs on demo data: no satellite source is connected yet. These are the sources the real data connection will use.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/" className={buttonVariants()}>
          Explore the Fire map
          <ArrowRight aria-hidden="true" />
        </Link>
        <Link to={GUIDE_PATH} className={cn(buttonVariants({ variant: "secondary" }))}>
          Read the User Guide
        </Link>
        <Link to={PLANNED_PATH} className={cn(buttonVariants({ variant: "ghost" }), "text-primary")}>
          What's planned
        </Link>
      </div>
      <SafetyNote />
      <p className="text-xs text-muted-foreground">{NOT_NASA_TEXT}</p>
    </div>
  );
}
