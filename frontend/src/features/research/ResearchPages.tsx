/**
 * Research Center: overview and one page per capability that doesn't work yet (stage R1). Research projects work
 * since R2 and have their own pages (projects/). The other pages have no forms or controls, and there are no example
 * projects, datasets, institutions or model results. Every label comes from capabilities.ts.
 */
import { Link, NavLink, Outlet } from "react-router";
import { ArrowRight, CircleCheck, Info } from "lucide-react";
import { SafetyNote } from "@/components/help/SafetyNote";
import { PageHeader } from "@/components/layout/Page";
import { UnavailableState } from "@/components/states/States";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusTag } from "@/components/ui/status-tag";
import { cn } from "@/lib/utils";
import { CAPABILITIES, RESEARCH_PATH, RESEARCH_TITLE, capabilityById, type Capability, type CapabilityId } from "./capabilities";

const SUB_NAV = [{ path: RESEARCH_PATH, label: "Overview", end: true }, ...CAPABILITIES.map((c) => ({ path: c.path, label: c.label, end: false }))];

/** Section frame: the Research Center sub-menu (side list from 1024 px, a wrapping row of links below), then the page. */
export function ResearchLayout() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8 lg:py-8">
      <nav aria-label={RESEARCH_TITLE} data-research-nav className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 hidden text-xs font-semibold tracking-wide text-muted-foreground uppercase lg:block">{RESEARCH_TITLE}</p>
        <ul className="flex flex-wrap gap-1.5 lg:grid lg:gap-0.5">
          {SUB_NAV.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:-outline-offset-2",
                    "border border-border lg:border-transparent",
                    isActive && "border-primary bg-surface-raised text-foreground lg:shadow-[inset_3px_0_0_var(--aw-color-primary)]",
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid min-w-0 content-start gap-6">
        <Outlet />
      </div>
    </div>
  );
}

/** Explains the two labels, so "planned" is never mistaken for "works". */
function StatusLegend() {
  return (
    <Card as="section" aria-labelledby="research-labels-heading">
      <CardHeader id="research-labels-heading" title="What the labels mean" icon={<Info className="size-5 text-muted-foreground" aria-hidden="true" />} />
      <dl className="grid gap-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
        <dt>
          <StatusTag status="browser" />
        </dt>
        <dd>Works now. What you create is kept in this browser on this device only; nothing is sent anywhere.</dd>
        <dt>
          <StatusTag status="unavailable" />
        </dt>
        <dd>Designed and scheduled, but no part of it works yet. There is no data in it.</dd>
        <dt>
          <StatusTag status="planned" />
        </dt>
        <dd>An idea that first needs decisions, hosting or agreements. Nothing about it exists yet.</dd>
      </dl>
    </Card>
  );
}

/** Links to features that already work elsewhere in Astera Watch. */
function WorksTodayList({ links }: { links: Capability["worksToday"] }) {
  return (
    <ul className="grid gap-2 text-sm">
      {links.map((l) => (
        <li key={l.to + l.label} className="grid gap-0.5">
          <Link to={l.to} className="inline-flex w-fit items-center gap-1.5 font-medium text-primary underline underline-offset-2">
            {l.label}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
          <span className="text-muted-foreground">{l.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export function ResearchOverviewPage() {
  const worksToday = [
    { label: "Fire map", to: "/", detail: "Explore heat spots and possible fires, search by country (demo data)." },
    { label: "Fire history", to: "/history", detail: "Every possible fire with its Fire Story: heat-spot timeline, radar data, radar analysis (simulated), JSON/CSV downloads." },
    { label: "My places", to: "/places", detail: "Countries you save in this browser, with their possible fires and heat spots." },
    { label: "How It Works", to: "/how-it-works", detail: "The method, step by step, and how values are labelled." },
  ];
  return (
    <>
      <PageHeader
        title={RESEARCH_TITLE}
        description="A workspace for wildfire research, being built step by step. Research projects work now, in this browser only. The other tools don't work yet: their pages show what each one will do and what it needs first. Astera Watch provides no example projects, datasets, models, partners or results."
      />

      <section aria-labelledby="research-tools-heading" className="grid gap-3">
        <h2 id="research-tools-heading" className="text-xl font-semibold">
          Research tools
        </h2>
        <ul className="grid gap-3 md:grid-cols-2" data-capabilities>
          {CAPABILITIES.map((c) => {
            const Icon = c.icon;
            return (
              <Card as="li" key={c.id} data-capability={c.id} data-status={c.status}>
                <CardHeader level={3} title={c.title} icon={<Icon className="size-5 text-primary" aria-hidden="true" />} status={<StatusTag status={c.status} />} />
                <p className="text-sm">{c.summary}</p>
                <Link to={c.path} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-2">
                  {c.status === "browser" ? "Open" : "What it will do and what it needs"}
                  <span className="sr-only">: {c.title}</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </Card>
            );
          })}
        </ul>
      </section>

      <StatusLegend />

      <Card as="section" padding="lg" aria-labelledby="research-today-heading" data-works-today>
        <CardHeader id="research-today-heading" title="Works today, elsewhere in Astera Watch" icon={<CircleCheck className="size-5 text-success" aria-hidden="true" />} />
        <p className="text-sm text-muted-foreground">These features work now, on demo data. They are not part of the Research Center.</p>
        <WorksTodayList links={worksToday} />
      </Card>

      <SafetyNote />
    </>
  );
}

/** One capability: status, what it will do, what's missing, schedule, related working features. Nothing interactive. */
export function CapabilityPage({ id }: { id: CapabilityId }) {
  const c = capabilityById(id);
  return (
    <>
      <PageHeader title={c.title} status={<StatusTag status={c.status} />} description={c.summary} />

      <UnavailableState
        title={c.status === "planned" ? "Planned: nothing here works yet" : "Not available yet: nothing here works yet"}
        message={`This page has no ${id === "collaboration" ? "partners or members" : id === "models" ? "models or results" : "data"} and no controls. It describes what is planned.`}
      />

      <Card as="section" padding="lg" aria-labelledby={`${id}-will-heading`}>
        <CardHeader id={`${id}-will-heading`} title="What it will do" />
        <ul className="grid list-disc gap-1 pl-5 text-sm">
          {c.willDo.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Card>

      <Card as="section" padding="lg" aria-labelledby={`${id}-missing-heading`} data-missing>
        <CardHeader id={`${id}-missing-heading`} title="What it needs first" />
        <ul className="grid list-disc gap-1 pl-5 text-sm">
          {c.missing.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="text-sm">
          <span className="font-semibold">When: </span>
          {c.schedule}
        </p>
      </Card>

      {c.worksToday.length > 0 && (
        <Card as="section" padding="lg" aria-labelledby={`${id}-today-heading`}>
          <CardHeader id={`${id}-today-heading`} title="Related features that work today" icon={<CircleCheck className="size-5 text-success" aria-hidden="true" />} />
          <WorksTodayList links={c.worksToday} />
        </Card>
      )}

      <div>
        <Link to={RESEARCH_PATH} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-2">
          All research tools
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
