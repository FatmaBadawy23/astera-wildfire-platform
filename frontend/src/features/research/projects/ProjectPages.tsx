/**
 * Research projects (stage R2): the workspace list, create, edit, details and delete (with confirmation).
 * Projects are what the person enters; Astera Watch adds no example projects. Storage: this browser only, through
 * the project repository (src/data/research/), so a backend can replace it later.
 */
import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { AlertDialog } from "radix-ui";
import { ArrowLeft, ArrowRight, HardDrive, Pencil, Plus, Trash2 } from "lucide-react";
import { getDataMode } from "@/app/env";
import { usePageTitle } from "@/components/layout/useRouteFocus";
import { PageHeader } from "@/components/layout/Page";
import { EmptyState, ErrorState, LoadingState } from "@/components/states/States";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusTag } from "@/components/ui/status-tag";
import { useCountryIndex } from "@/data/countryIndex";
import { toDataError } from "@/data/errors";
import { useEvents } from "@/data/hooks";
import type { ProjectInput } from "@/data/research/projectRepository";
import { useDatasets } from "@/data/catalog/CatalogProvider";
import {
  useCreateProject,
  useDeleteProject,
  useProject,
  useProjectRepository,
  useProjects,
  useUnlinkDataset,
  useUpdateProject,
} from "@/data/research/ResearchProvider";
import { PROJECT_STATUS_LABELS, type ProjectStatus, type ResearchProject } from "@/data/types";
import { formatDateTimeUtc } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fireStoryPath } from "@/app/nav";
import { NotConfirmedChip } from "@/features/explorer/SelectionCard";
import { formatDayRange, placeText } from "@/features/explorer/CandidateEventList";
import { CAPABILITIES } from "../capabilities";
import { DatasetClassTag } from "../datasets/DatasetBits";
import { DATASETS_PATH, datasetClass, datasetPath } from "../datasets/datasetText";
import { ProjectForm, emptyProjectInput, projectToInput } from "./ProjectForm";
import { NEW_PROJECT_PATH, PROJECTS_PATH, editProjectPath, projectPath } from "./paths";

const link = "font-medium text-primary underline underline-offset-2";

/** The person's own status for the project: neutral chip with text (not an availability label). */
function ProjectStatusChip({ status }: { status: ProjectStatus }) {
  return (
    <span data-project-status={status} className="inline-flex w-fit items-center rounded-full border border-border-strong bg-surface-raised px-2.5 py-0.5 text-xs font-semibold">
      Status: {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

/** Where projects are kept, said plainly on every project page. */
function StorageNotice() {
  const repo = useProjectRepository();
  return (
    <p data-storage-notice className="flex gap-2 rounded-md border border-border bg-background p-3 text-sm">
      <HardDrive className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>
        {repo.persistent
          ? "Projects are saved in this browser on this device only. They are not sent anywhere, other people can't see them, and clearing this browser's data deletes them."
          : "This browser blocks storage, so projects last only until you close this page. Nothing is sent anywhere."}
      </span>
    </p>
  );
}

function useFlash(): string | null {
  const state = useLocation().state as { message?: string } | null;
  return state?.message ?? null;
}

function Flash({ message }: { message: string | null }) {
  return (
    <p role="status" data-flash className={cn("text-sm font-medium", !message && "sr-only")}>
      {message ?? ""}
    </p>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export function ProjectsPage() {
  const projects = useProjects();
  const flash = useFlash();
  const { index } = useCountryIndex();
  const nameOf = (iso: string) => index.find((c) => c.iso3 === iso)?.name ?? iso;

  return (
    <>
      <PageHeader
        title="Research projects"
        status={<StatusTag status="browser" />}
        description="Your research workspace: each project keeps a title, description, objectives, a study area and the possible fires you link to it."
      />
      <StorageNotice />
      <Flash message={flash} />
      <div>
        <Link to={NEW_PROJECT_PATH} className={buttonVariants()}>
          <Plus aria-hidden="true" />
          New project
        </Link>
      </div>

      <section aria-labelledby="projects-heading" className="grid gap-3">
        <h2 id="projects-heading" className="text-xl font-semibold">
          Your projects
          {projects.data && projects.data.length > 0 && <span className="font-normal text-muted-foreground"> · {projects.data.length}</span>}
        </h2>
        {projects.isPending ? (
          <LoadingState label="Loading your projects" />
        ) : projects.isError ? (
          <ErrorState
            title="Your projects couldn't be read"
            message={toDataError(projects.error).message}
            detail={toDataError(projects.error).detail}
            onRetry={() => void projects.refetch()}
          />
        ) : projects.data.length === 0 ? (
          <EmptyState title="No projects yet">Create your first research project with “New project”. Astera Watch doesn't add example projects.</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" data-project-list>
            {projects.data.map((p) => (
              <Card as="li" key={p.id} data-project={p.id}>
                <div className="grid gap-1.5">
                  <h3 className="text-lg font-semibold break-words">{p.title}</h3>
                  <ProjectStatusChip status={p.status} />
                </div>
                {p.description && <p className="line-clamp-3 text-sm">{p.description}</p>}
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Countries</dt>
                  <dd>{p.studyArea.countriesIso3.length ? p.studyArea.countriesIso3.map(nameOf).join(", ") : "None chosen"}</dd>
                  <dt className="text-muted-foreground">Possible fires</dt>
                  <dd>{p.linkedEventIds.length ? `${p.linkedEventIds.length} linked` : "None linked"}</dd>
                  <dt className="text-muted-foreground">Datasets</dt>
                  <dd>{p.datasetIds.length ? `${p.datasetIds.length} linked` : "None linked"}</dd>
                  <dt className="text-muted-foreground">Last changed</dt>
                  <dd>{formatDateTimeUtc(p.updatedAt)}</dd>
                </dl>
                <div>
                  <Link to={projectPath(p.id)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    Open project<span className="sr-only">: {p.title}</span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export function NewProjectPage() {
  const navigate = useNavigate();
  const create = useCreateProject();
  return (
    <>
      <BackLink to={PROJECTS_PATH} label="All projects" />
      <PageHeader title="New research project" description="Only the title is required. You can change everything later." />
      <StorageNotice />
      <ProjectForm
        initial={emptyProjectInput()}
        submitLabel="Create project"
        cancelTo={PROJECTS_PATH}
        saving={create.isPending}
        saveError={create.isError ? saveMessage(create.error) : null}
        onSubmit={(input: ProjectInput) =>
          create.mutate(input, { onSuccess: (p) => navigate(projectPath(p.id), { state: { message: `Project “${p.title}” created.` } }) })
        }
      />
    </>
  );
}

function saveMessage(error: unknown): string {
  const e = toDataError(error);
  return [e.message, ...e.detail].join(" ");
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className={cn("inline-flex min-h-9 w-fit items-center gap-1.5 text-sm", link)}>
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

/** Shared loading / not-found / error handling for one project. */
function ProjectLoader({ id, children }: { id: string; children: (p: ResearchProject) => ReactNode }) {
  const q = useProject(id);
  if (q.isPending) return <LoadingState label="Loading the project" />;
  if (q.isError) {
    const e = toDataError(q.error);
    if (e.kind === "not-found")
      return (
        <>
          <PageHeader title="Project not found" />
          <EmptyState title={`There is no project “${id}” in this browser`}>
            It may have been deleted, or created in another browser.{" "}
            <Link to={PROJECTS_PATH} className={link}>
              See your projects
            </Link>
          </EmptyState>
        </>
      );
    return (
      <>
        <PageHeader title="Research project" />
        <ErrorState title="The project couldn't be read" message={e.message} detail={e.detail} onRetry={() => void q.refetch()} />
      </>
    );
  }
  return <>{children(q.data)}</>;
}

export function EditProjectPage() {
  const { projectId = "" } = useParams();
  return (
    <>
      <BackLink to={projectPath(projectId)} label="Back to the project" />
      <ProjectLoader id={projectId}>{(p) => <EditProject project={p} />}</ProjectLoader>
    </>
  );
}

function EditProject({ project }: { project: ResearchProject }) {
  const navigate = useNavigate();
  const update = useUpdateProject(project.id);
  usePageTitle(`Edit ${project.title} · Research projects`);
  return (
    <>
      <PageHeader title={`Edit “${project.title}”`} />
      <StorageNotice />
      <ProjectForm
        initial={projectToInput(project)}
        submitLabel="Save changes"
        cancelTo={projectPath(project.id)}
        saving={update.isPending}
        saveError={update.isError ? saveMessage(update.error) : null}
        onSubmit={(input) => update.mutate(input, { onSuccess: (p) => navigate(projectPath(p.id), { state: { message: "Changes saved." } }) })}
      />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export function ProjectDetailsPage() {
  const { projectId = "" } = useParams();
  return (
    <>
      <BackLink to={PROJECTS_PATH} label="All projects" />
      <ProjectLoader id={projectId}>{(p) => <ProjectDetails project={p} />}</ProjectLoader>
    </>
  );
}

function ProjectDetails({ project: p }: { project: ResearchProject }) {
  const flash = useFlash();
  usePageTitle(`${p.title} · Research projects`);
  const { index } = useCountryIndex();
  const nameOf = (iso: string) => index.find((c) => c.iso3 === iso)?.name ?? iso;
  const eventsQ = useEvents();
  const demo = getDataMode() === "mock";
  const tools = CAPABILITIES.filter((c) => c.id !== "projects");

  return (
    <>
      <div className="grid gap-2">
        <p className="caps-heading text-xs font-semibold text-muted-foreground">Research project</p>
        <PageHeader title={p.title} />
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusChip status={p.status} />
          <StatusTag status="browser" />
        </div>
      </div>
      <Flash message={flash} />

      <div className="flex flex-wrap gap-2">
        <Link to={editProjectPath(p.id)} className={buttonVariants({ variant: "secondary" })}>
          <Pencil aria-hidden="true" />
          Edit project
        </Link>
        <DeleteProject project={p} />
      </div>

      <Card as="section" padding="lg" aria-labelledby="project-about">
        <CardHeader id="project-about" title="About" />
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Description</dt>
          <dd className="whitespace-pre-line break-words">{p.description ?? "None given"}</dd>
          <dt className="text-muted-foreground">Research objectives</dt>
          <dd>
            {p.objectives.length ? (
              <ol className="grid list-decimal gap-0.5 pl-5">
                {p.objectives.map((o, i) => (
                  <li key={i} className="break-words">
                    {o}
                  </li>
                ))}
              </ol>
            ) : (
              "None given"
            )}
          </dd>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{formatDateTimeUtc(p.createdAt)}</dd>
          <dt className="text-muted-foreground">Last changed</dt>
          <dd>{formatDateTimeUtc(p.updatedAt)}</dd>
          <dt className="text-muted-foreground">Saved in</dt>
          <dd>This browser on this device only</dd>
        </dl>
      </Card>

      <Card as="section" padding="lg" aria-labelledby="project-area">
        <CardHeader id="project-area" title="Study area" />
        {p.studyArea.countriesIso3.length ? (
          <ul className="grid gap-1 text-sm" data-project-countries>
            {p.studyArea.countriesIso3.map((iso) => (
              <li key={iso}>
                {nameOf(iso)} ·{" "}
                <Link to={`/history?country=${iso}`} className={link}>
                  Fire history<span className="sr-only"> of {nameOf(iso)}</span>
                </Link>{" "}
                ·{" "}
                <Link to={`/?country=${iso}`} className={link}>
                  Fire map<span className="sr-only"> ({nameOf(iso)})</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">No countries chosen.</p>
        )}
        <p className="text-sm whitespace-pre-line break-words">
          <span className="text-muted-foreground">Description: </span>
          {p.studyArea.description ?? "None given"}
        </p>
        <p className="text-xs text-muted-foreground">Drawing the study area on the map is not available yet.</p>
      </Card>

      <Card as="section" padding="lg" aria-labelledby="project-fires" data-project-fires>
        <CardHeader id="project-fires" title="Linked possible fires" />
        {p.linkedEventIds.length === 0 ? (
          <p className="text-sm">None linked. Edit the project to link possible fires from the current data.</p>
        ) : (
          <ul className="grid gap-3">
            {p.linkedEventIds.map((eid) => {
              const e = eventsQ.data?.find((x) => x.id === eid);
              return (
                <li key={eid} data-linked-event={eid} className="grid gap-1 rounded-md border border-border bg-background p-3 text-sm">
                  {eventsQ.isPending ? (
                    <p>{eid} · loading…</p>
                  ) : e ? (
                    <>
                      <p className="font-semibold">
                        {e.id} · {e.name}
                      </p>
                      <p className="text-muted-foreground">
                        {placeText(e)} · {formatDayRange(e.firstDetection, e.lastDetection)}
                      </p>
                      <NotConfirmedChip />
                      <Link to={fireStoryPath(e.id)} className={cn("w-fit", link)}>
                        Open the Fire Story<span className="sr-only"> of {e.id}</span>
                      </Link>
                    </>
                  ) : (
                    <p>
                      {eid}: not found in the current data{eventsQ.isError ? " (the data couldn't be loaded)" : ""}.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {demo && p.linkedEventIds.length > 0 && <p className="text-xs text-muted-foreground">These possible fires are demo data with invented locations.</p>}
      </Card>

      <ProjectDatasets project={p} />

      <Card as="section" padding="lg" aria-labelledby="project-tools" data-project-tools>
        <CardHeader id="project-tools" title="Project tools" />
        <p className="text-sm text-muted-foreground">What you can add to a project. Project details and datasets work today.</p>
        <ul className="grid gap-2 text-sm">
          {tools.filter((c) => c.id !== "data").map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <Link to={c.path} className={link}>
                {c.title}
              </Link>
              <StatusTag status={c.status} />
            </li>
          ))}
        </ul>
      </Card>

      <StorageNotice />
    </>
  );
}

/** Datasets linked to the project: catalog entries with their Real/Demo label; IDs no longer in the catalog are kept and say so. */
function ProjectDatasets({ project: p }: { project: ResearchProject }) {
  const datasetsQ = useDatasets();
  const unlink = useUnlinkDataset();
  const [message, setMessage] = useState("");
  const all = datasetsQ.data ?? [];
  return (
    <Card as="section" padding="lg" aria-labelledby="project-datasets" data-project-datasets>
      <CardHeader id="project-datasets" title="Datasets" />
      {p.datasetIds.length === 0 ? (
        <p className="text-sm">No datasets yet. Open a dataset in the catalog and choose “Add to project”.</p>
      ) : (
        <ul className="grid gap-2">
          {p.datasetIds.map((id) => {
            const d = all.find((x) => x.id === id);
            return (
              <li key={id} data-project-dataset={id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-3 text-sm">
                <div className="grid gap-1">
                  {datasetsQ.isPending ? (
                    <p>{id} · loading…</p>
                  ) : d ? (
                    <>
                      <Link to={datasetPath(d.id)} className={link}>
                        {d.title}
                      </Link>
                      <DatasetClassTag value={datasetClass(d, all)} />
                    </>
                  ) : (
                    <p>
                      {id}: not in the current catalog. The link is kept{datasetsQ.isError ? " (the catalog couldn't be loaded)" : ""}.
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={unlink.isPending}
                  onClick={() =>
                    unlink.mutate(
                      { projectId: p.id, datasetId: id },
                      { onSuccess: () => setMessage(`${d?.title ?? id} removed from the project.`), onError: (e) => setMessage(toDataError(e).message) },
                    )
                  }
                >
                  Remove<span className="sr-only"> {d?.title ?? id} from the project</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <p role="status" className="text-sm font-medium" data-dataset-message>
        {message}
      </p>
      <Link to={DATASETS_PATH} className={cn("w-fit text-sm", link)}>
        Find datasets
      </Link>
    </Card>
  );
}

function DeleteProject({ project }: { project: ResearchProject }) {
  const [open, setOpen] = useState(false);
  const del = useDeleteProject();
  const navigate = useNavigate();
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !del.isPending && setOpen(o)}>
      <AlertDialog.Trigger asChild>
        <Button type="button" variant="secondary" className="text-danger">
          <Trash2 aria-hidden="true" />
          Delete project
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[var(--aw-z-overlay)]" style={{ background: "var(--aw-scrim)", opacity: "var(--aw-opacity-scrim)" }} />
        <AlertDialog.Content
          data-delete-dialog
          className="fixed top-1/2 left-1/2 z-[var(--aw-z-dialog)] grid w-[min(28rem,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border-strong bg-surface p-5 shadow-lg"
        >
          <AlertDialog.Title className="font-heading text-lg font-semibold break-words">Delete “{project.title}”?</AlertDialog.Title>
          <AlertDialog.Description className="text-sm">
            This removes the project from this browser. It can't be undone. Possible fires and other data in Astera Watch are not affected.
          </AlertDialog.Description>
          {del.isError && (
            <p role="alert" className="text-sm font-medium text-danger">
              {toDataError(del.error).message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" disabled={del.isPending}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              variant="danger"
              disabled={del.isPending}
              onClick={() =>
                del.mutate(project.id, {
                  onSuccess: () => {
                    setOpen(false);
                    navigate(PROJECTS_PATH, { state: { message: `Project “${project.title}” deleted.` } });
                  },
                })
              }
            >
              {del.isPending ? "Deleting…" : "Delete project"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
