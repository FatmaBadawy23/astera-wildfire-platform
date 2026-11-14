/**
 * Dataset catalog (stage R3, initial draft): browse the datasets that are actually accessible in the app, see each
 * one's metadata, and add it to a research project. Sources that are known but not connected are listed separately
 * and can't be added. Everything shown comes from the catalog repository (src/data/catalog/); nothing is hard-coded.
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, ExternalLink, PlugZap } from "lucide-react";
import { usePageTitle } from "@/components/layout/useRouteFocus";
import { PageHeader } from "@/components/layout/Page";
import { ProvenanceBadges } from "@/components/science/SourceBadges";
import { EmptyState, ErrorState, LoadingState } from "@/components/states/States";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusTag } from "@/components/ui/status-tag";
import { useCatalogRepository, useDataSources, useDataset, useDatasets } from "@/data/catalog/CatalogProvider";
import { useCountryIndex } from "@/data/countryIndex";
import { toDataError } from "@/data/errors";
import { useLinkDataset, useProjects } from "@/data/research/ResearchProvider";
import { DATASET_KIND_LABELS, type DataSourceEntry, type DatasetEntry, type DatasetKind } from "@/data/types";
import { cn } from "@/lib/utils";
import { NEW_PROJECT_PATH, projectPath } from "../projects/paths";
import { DatasetClassTag, MaybeValue } from "./DatasetBits";
import {
  CLASS_GROUP_TITLES,
  CLASS_LABELS,
  CLASS_ORDER,
  DATASETS_PATH,
  bboxText,
  coverageText,
  coversCountry,
  datasetClass,
  datasetPath,
  dateText,
  periodText,
  type DatasetClass,
} from "./datasetText";

const link = "font-medium text-primary underline underline-offset-2";
const control = "h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground";

function useCountryName() {
  const { index } = useCountryIndex();
  return (iso: string) => index.find((c) => c.iso3 === iso)?.name ?? iso;
}

// ---------------------------------------------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------------------------------------------

export function DatasetCatalogPage() {
  const id = useId();
  const repo = useCatalogRepository();
  const datasetsQ = useDatasets();
  const sourcesQ = useDataSources();
  const nameOf = useCountryName();
  const [search, setSearch] = useSearchParams();
  const set = (key: string, value: string) =>
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );

  const all = useMemo(() => datasetsQ.data ?? [], [datasetsQ.data]);
  const classOf = (d: DatasetEntry) => datasetClass(d, all);
  // Filter options come from the catalog itself, so new kinds and countries appear without code changes.
  const kinds = [...new Set(all.map((d) => d.kind))];
  const classes = CLASS_ORDER.filter((c) => all.some((d) => classOf(d) === c));
  const countries = [...new Set(all.flatMap((d) => d.spatialCoverage.countriesIso3))].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  const kind = (search.get("kind") ?? "") as DatasetKind | "";
  const cls = (search.get("class") ?? "") as DatasetClass | "";
  const country = search.get("country") ?? "";
  const shown = all.filter((d) => (!kind || d.kind === kind) && (!cls || classOf(d) === cls) && (!country || coversCountry(d, country)));
  const filtered = !!(kind || cls || country);

  return (
    <>
      <PageHeader
        title="Datasets"
        status={<StatusTag status="browser" />}
        description="The data Astera Watch actually has today, with where it comes from and what it can and can't tell you. Add any of it to your research projects. This catalog is an early draft and will change as real data is connected."
      />
      <p data-catalog-notice className="rounded-md border border-border bg-background p-3 text-sm">
        {repo.includesDemo
          ? "Today only two real datasets exist in the app (Natural Earth reference maps). Everything about fires and radar is invented demo data. No satellite data is connected."
          : "Only the bundled reference maps are available. A backend catalog is not connected yet."}{" "}
        Adding your own files is not available yet.
      </p>

      {datasetsQ.isPending ? (
        <LoadingState label="Loading the catalog" />
      ) : datasetsQ.isError ? (
        <ErrorState message={toDataError(datasetsQ.error).message} onRetry={() => void datasetsQ.refetch()} />
      ) : (
        <>
          <form role="search" aria-label="Filter datasets" onSubmit={(e) => e.preventDefault()} className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-3">
            <div className="grid content-start gap-1">
              <label htmlFor={`${id}-kind`} className="text-xs font-medium text-muted-foreground">
                Type of data
              </label>
              <select id={`${id}-kind`} className={control} value={kind} onChange={(e) => set("kind", e.target.value)}>
                <option value="">All types</option>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {DATASET_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid content-start gap-1">
              <label htmlFor={`${id}-class`} className="text-xs font-medium text-muted-foreground">
                Real or demo
              </label>
              <select id={`${id}-class`} className={control} value={cls} onChange={(e) => set("class", e.target.value)}>
                <option value="">Real and demo</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {CLASS_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid content-start gap-1">
              <label htmlFor={`${id}-country`} className="text-xs font-medium text-muted-foreground">
                Covers country
              </label>
              <select id={`${id}-country`} className={control} value={country} onChange={(e) => set("country", e.target.value)}>
                <option value="">Any country</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {nameOf(c)}
                  </option>
                ))}
              </select>
            </div>
            {filtered && (
              <div className="md:col-span-3">
                <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setSearch(new URLSearchParams(), { replace: true })}>
                  Clear filters
                </Button>
              </div>
            )}
          </form>

          <p aria-live="polite" className="text-sm" data-catalog-count>
            {shown.length} of {all.length} dataset{all.length === 1 ? "" : "s"} shown
          </p>

          {shown.length === 0 ? (
            <EmptyState title="No datasets match these filters">Clear a filter to see more.</EmptyState>
          ) : (
            CLASS_ORDER.filter((c) => shown.some((d) => classOf(d) === c)).map((c) => (
              <section key={c} aria-labelledby={`${id}-${c}`} className="grid gap-3" data-dataset-group={c}>
                <h2 id={`${id}-${c}`} className="text-xl font-semibold">
                  {CLASS_GROUP_TITLES[c]}
                </h2>
                <ul className="grid gap-3 md:grid-cols-2">
                  {shown
                    .filter((d) => classOf(d) === c)
                    .map((d) => (
                      <DatasetCard key={d.id} d={d} cls={c} nameOf={nameOf} />
                    ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}

      <section aria-labelledby={`${id}-sources`} className="grid gap-3" data-sources>
        <h2 id={`${id}-sources`} className="text-xl font-semibold">
          Sources not connected yet
        </h2>
        <p className="text-sm text-muted-foreground">
          Real data sources the project plans to use. They are not connected, so they have no data here and can't be added to a project.
        </p>
        {sourcesQ.data && sourcesQ.data.length > 0 ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {sourcesQ.data.map((s) => (
              <SourceCard key={s.id} s={s} />
            ))}
          </ul>
        ) : (
          sourcesQ.isSuccess && <p className="text-sm">None listed.</p>
        )}
      </section>
    </>
  );
}

function DatasetCard({ d, cls, nameOf }: { d: DatasetEntry; cls: DatasetClass; nameOf: (iso: string) => string }) {
  const date = d.acquisitionDate ?? d.dates[0] ?? null;
  return (
    <Card as="li" data-dataset={d.id}>
      <div className="grid gap-1.5">
        <h3 className="text-lg font-semibold break-words">{d.title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <DatasetClassTag value={cls} />
          <span className="text-xs text-muted-foreground">{DATASET_KIND_LABELS[d.kind]}</span>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Provider</dt>
        <dd>
          <MaybeValue value={d.provider} />
        </dd>
        <dt className="text-muted-foreground">Coverage</dt>
        <dd>
          <MaybeValue value={coverageText(d, nameOf)} />
        </dd>
        <dt className="text-muted-foreground">Date</dt>
        <dd>
          <MaybeValue value={date}>{date && dateText(date)}</MaybeValue>
        </dd>
        <dt className="text-muted-foreground">Licence</dt>
        <dd>
          <MaybeValue value={d.licence} />
        </dd>
      </dl>
      <div>
        <Link to={datasetPath(d.id)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Details<span className="sr-only">: {d.title}</span>
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}

function SourceCard({ s }: { s: DataSourceEntry }) {
  return (
    <Card as="li" data-source={s.id}>
      <div className="grid gap-1.5">
        <h3 className="text-lg font-semibold">{s.name}</h3>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border-strong bg-surface-raised px-2.5 py-0.5 text-xs font-semibold">
          <PlugZap className="size-3.5" aria-hidden="true" />
          Not connected
        </span>
      </div>
      <p className="text-sm">{s.provides}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Provider</dt>
        <dd>{s.provider}</dd>
        <dt className="text-muted-foreground">Terms</dt>
        <dd>
          <MaybeValue value={s.terms} />
        </dd>
      </dl>
      <details className="text-sm">
        <summary className="w-fit cursor-pointer font-medium text-primary">What it needs before it can be used</summary>
        <ul className="mt-2 grid list-disc gap-1 pl-5">
          {s.needs.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        {s.notes.length > 0 && (
          <ul className="mt-2 grid gap-1 text-muted-foreground">
            {s.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </details>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------------------------------------------

export function DatasetDetailsPage() {
  const { datasetId = "" } = useParams();
  const q = useDataset(datasetId);
  return (
    <>
      <Link to={DATASETS_PATH} className={cn("inline-flex min-h-9 w-fit items-center gap-1.5 text-sm", link)}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        All datasets
      </Link>
      {q.isPending ? (
        <LoadingState label="Loading the dataset" />
      ) : q.isError ? (
        <>
          <PageHeader title="Dataset not found" />
          <EmptyState title={toDataError(q.error).message}>
            <Link to={DATASETS_PATH} className={link}>
              See the datasets that are available
            </Link>
          </EmptyState>
        </>
      ) : (
        <DatasetDetails d={q.data} />
      )}
    </>
  );
}

function DatasetDetails({ d }: { d: DatasetEntry }) {
  usePageTitle(`${d.title} · Datasets`);
  const all = useDatasets().data ?? [d];
  const cls = datasetClass(d, all);
  const nameOf = useCountryName();
  const m = d.missingReasons;
  const titleOf = (id: string) => all.find((x) => x.id === id)?.title ?? id;

  const rows: { label: string; value: unknown; reason?: string | null; render?: ReactNode }[] = [
    { label: "Type of data", value: DATASET_KIND_LABELS[d.kind] },
    { label: "Provider", value: d.provider, reason: m.provider },
    {
      label: "Source",
      value: d.source.name,
      reason: m.source,
      render: d.source.url ? (
        <a href={d.source.url} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-1 break-all", link)}>
          {d.source.name ?? d.source.url}
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : undefined,
    },
    { label: "Format", value: d.format, reason: m.format },
    { label: "Licence", value: d.licence, reason: m.licence },
    { label: "Citation", value: d.citation, reason: m.citation },
    { label: "Version", value: d.version, reason: m.version },
    { label: "Spatial coverage", value: coverageText(d, nameOf), reason: m.spatialCoverage },
    { label: "Bounding box", value: bboxText(d), reason: m.spatialCoverage },
    { label: "Temporal coverage", value: periodText(d), reason: m.temporalCoverage },
    {
      label: "Acquisition date",
      value: d.acquisitionDate?.value ?? null,
      reason: m.acquisitionDate,
      render: d.acquisitionDate?.value ? dateText(d.acquisitionDate).replace(/^Acquired /, "") : undefined,
    },
    ...d.dates.map((x) => ({ label: "Other date", value: x.value, render: dateText(x) })),
    { label: "Records", value: d.recordCount, reason: m.recordCount, render: d.recordCount?.toLocaleString("en-US") },
    ...d.properties.map((p) => ({ label: p.label, value: p.value, reason: p.missingReason })),
    { label: "Available in the app", value: d.access === "bundled" ? "Yes: files included with the app" : d.access === "demo" ? "Yes: demo data in this app" : "Yes: from the backend" },
  ];

  return (
    <>
      <div className="grid gap-2">
        <p className="caps-heading text-xs font-semibold text-muted-foreground">Dataset</p>
        <PageHeader title={d.title} description={d.description} />
        <div className="flex flex-wrap items-center gap-2">
          <DatasetClassTag value={cls} />
          {d.provenance && <ProvenanceBadges provenance={d.provenance} />}
        </div>
      </div>

      <AddToProject d={d} />

      <Card as="section" padding="lg" aria-labelledby="dataset-meta">
        <CardHeader id="dataset-meta" title="Details" />
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]" data-dataset-meta>
          {rows.map((r, i) => (
            <div key={`${r.label}-${i}`} className="contents">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="break-words">
                <MaybeValue value={r.value} reason={r.reason}>
                  {r.render}
                </MaybeValue>
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {d.derivedFrom.length > 0 && (
        <Card as="section" padding="lg" aria-labelledby="dataset-inputs">
          <CardHeader id="dataset-inputs" title="Derived from" />
          <ul className="grid gap-1 text-sm">
            {d.derivedFrom.map((id) => (
              <li key={id}>
                <Link to={datasetPath(id)} className={link}>
                  {titleOf(id)}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card as="section" padding="lg" aria-labelledby="dataset-meaning">
        <CardHeader id="dataset-meaning" title="What this data can and can't tell you" />
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="grid content-start gap-1">
            <p className="font-semibold">It can show</p>
            <ul className="grid list-disc gap-1 pl-5">
              {d.canEstablish.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-1">
            <p className="font-semibold">It can't show</p>
            <ul className="grid list-disc gap-1 pl-5">
              {d.cannotEstablish.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {d.processing.length > 0 && (
        <Card as="section" padding="lg" aria-labelledby="dataset-processing">
          <CardHeader id="dataset-processing" title="How it was prepared" />
          <ol className="grid list-decimal gap-1 pl-5 text-sm">
            {d.processing.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </Card>
      )}
    </>
  );
}

/** "Add to a project": pick one of your projects. Shows which projects already use the dataset. */
function AddToProject({ d }: { d: DatasetEntry }) {
  const id = useId();
  const projects = useProjects();
  const link_ = useLinkDataset();
  const [projectId, setProjectId] = useState("");
  const [message, setMessage] = useState("");
  const list = projects.data ?? [];
  const using = list.filter((p) => p.datasetIds.includes(d.id));
  const options = list.filter((p) => !p.datasetIds.includes(d.id));
  const chosen = options.find((p) => p.id === projectId) ?? options[0] ?? null;

  return (
    <Card as="section" padding="lg" aria-labelledby={`${id}-h`} data-add-to-project>
      <CardHeader id={`${id}-h`} title="Use in a research project" />
      {projects.isPending ? (
        <LoadingState label="Loading your projects" />
      ) : projects.isError ? (
        <p className="text-sm">Your projects couldn't be read: {toDataError(projects.error).message}</p>
      ) : list.length === 0 ? (
        <p className="text-sm">
          You have no research projects yet.{" "}
          <Link to={NEW_PROJECT_PATH} className={link}>
            Create a project
          </Link>{" "}
          to add this dataset to it.
        </p>
      ) : (
        <>
          {options.length > 0 ? (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!chosen) return;
                setMessage("");
                link_.mutate(
                  { projectId: chosen.id, datasetId: d.id },
                  { onSuccess: (p) => setMessage(`Added to “${p.title}”.`), onError: (err) => setMessage(`Not added: ${toDataError(err).message}`) },
                );
              }}
            >
              <div className="grid min-w-[14rem] flex-1 gap-1">
                <label htmlFor={`${id}-project`} className="text-xs font-medium text-muted-foreground">
                  Project
                </label>
                <select id={`${id}-project`} className={control} value={chosen?.id ?? ""} onChange={(e) => setProjectId(e.target.value)}>
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={link_.isPending}>
                {link_.isPending ? "Adding…" : "Add to project"}
              </Button>
            </form>
          ) : (
            <p className="text-sm">All your projects already use this dataset.</p>
          )}
          <p role="status" className="text-sm font-medium" data-add-message>
            {message}
          </p>
          {using.length > 0 && (
            <div className="grid gap-1 text-sm">
              <p className="font-semibold">Used in</p>
              <ul className="grid gap-0.5">
                {using.map((p) => (
                  <li key={p.id}>
                    <Link to={projectPath(p.id)} className={link}>
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">The link is saved with the project, in this browser only. The dataset itself is not copied.</p>
    </Card>
  );
}
