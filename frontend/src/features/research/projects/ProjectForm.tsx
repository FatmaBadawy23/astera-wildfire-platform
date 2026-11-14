/**
 * Create / edit form for a research project. Plain HTML controls with visible labels; errors are listed in a summary
 * that takes focus, and each field points to its message (aria-invalid + aria-describedby).
 * Possible fires can only be linked from the current data, in the chosen countries.
 */
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { X } from "lucide-react";
import { getDataMode } from "@/app/env";
import { CountrySearch } from "@/components/search/CountrySearch";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCountryIndex } from "@/data/countryIndex";
import { useEvents } from "@/data/hooks";
import {
  PROJECT_LIMITS,
  PROJECT_STATUSES,
  normalizeProjectInput,
  validateProjectInput,
  type ProjectErrors,
  type ProjectField,
  type ProjectInput,
} from "@/data/research/projectRepository";
import { PROJECT_STATUS_LABELS, type ResearchProject } from "@/data/types";
import { cn } from "@/lib/utils";
import { formatDayRange } from "@/features/explorer/CandidateEventList";

const control = "w-full rounded-md border border-border-strong bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground aria-[invalid=true]:border-danger";
const labelCls = "text-sm font-medium";
const hintCls = "text-xs text-muted-foreground";

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  return message ? (
    <p id={id} className="text-sm font-medium text-danger">
      {message}
    </p>
  ) : null;
}

export function emptyProjectInput(): ProjectInput {
  return { title: "", description: "", objectives: [], status: "planning", countriesIso3: [], studyAreaDescription: "", linkedEventIds: [] };
}

export function projectToInput(p: ResearchProject): ProjectInput {
  return {
    title: p.title,
    description: p.description ?? "",
    objectives: p.objectives,
    status: p.status,
    countriesIso3: p.studyArea.countriesIso3,
    studyAreaDescription: p.studyArea.description ?? "",
    linkedEventIds: p.linkedEventIds,
  };
}

const FIELD_ORDER: ProjectField[] = ["title", "description", "objectives", "status", "countries", "studyAreaDescription", "linkedEvents"];
const FIELD_LABELS: Record<ProjectField, string> = {
  title: "Title",
  description: "Description",
  objectives: "Research objectives",
  status: "Project status",
  countries: "Countries",
  studyAreaDescription: "Study area description",
  linkedEvents: "Linked possible fires",
};

export function ProjectForm({
  initial,
  submitLabel,
  cancelTo,
  saving,
  saveError,
  onSubmit,
}: {
  initial: ProjectInput;
  submitLabel: string;
  cancelTo: string;
  saving: boolean;
  saveError: string | null;
  onSubmit: (input: ProjectInput) => void;
}) {
  const id = useId();
  const demo = getDataMode() === "mock";
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [objectives, setObjectives] = useState(initial.objectives.join("\n"));
  const [status, setStatus] = useState(initial.status);
  const [countries, setCountries] = useState<string[]>(initial.countriesIso3);
  const [areaText, setAreaText] = useState(initial.studyAreaDescription);
  const [linked, setLinked] = useState<string[]>(initial.linkedEventIds);
  const [errors, setErrors] = useState<ProjectErrors>({});
  const [countryMessage, setCountryMessage] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);

  const { index, isLoading: indexLoading } = useCountryIndex();
  const nameOf = (iso: string) => index.find((c) => c.iso3 === iso)?.name ?? iso;
  const eventsQ = useEvents();
  const inArea = useMemo(() => (eventsQ.data ?? []).filter((e) => countries.includes(e.country.iso3)), [eventsQ.data, countries]);
  // Links outside the chosen countries (or no longer in the data) are dropped on save; the list below says so.
  const keptLinks = linked.filter((eid) => inArea.some((e) => e.id === eid));
  const droppedLinks = linked.length - keptLinks.length;

  const fid = (f: ProjectField) => `${id}-${f}`;
  const errId = (f: ProjectField) => `${id}-${f}-error`;
  const describedBy = (f: ProjectField, hint?: boolean) => [hint ? `${fid(f)}-hint` : null, errors[f] ? errId(f) : null].filter(Boolean).join(" ") || undefined;

  function submit(e: FormEvent) {
    e.preventDefault();
    const input = normalizeProjectInput({
      title,
      description,
      objectives: objectives.split("\n"),
      status,
      countriesIso3: countries,
      studyAreaDescription: areaText,
      linkedEventIds: eventsQ.isSuccess ? keptLinks : linked,
    });
    const found = validateProjectInput(input);
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    onSubmit(input);
  }

  const errorList = FIELD_ORDER.filter((f) => errors[f]);

  return (
    <form noValidate onSubmit={submit} className="grid gap-5" aria-describedby={`${id}-storage`}>
      <p id={`${id}-storage`} className="sr-only">
        The project is saved in this browser on this device only.
      </p>

      {errorList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" data-form-errors className="grid gap-1 rounded-lg border border-danger bg-surface p-4 text-sm">
          <p className="font-semibold">Please fix {errorList.length === 1 ? "this" : `these ${errorList.length}`} before saving:</p>
          <ul className="grid list-disc gap-0.5 pl-5">
            {errorList.map((f) => (
              <li key={f}>
                <a href={`#${fid(f)}`} className="text-primary underline underline-offset-2">
                  {FIELD_LABELS[f]}: {errors[f]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {saveError && (
        <div role="alert" className="rounded-lg border border-danger bg-surface p-4 text-sm" data-save-error>
          <p className="font-semibold">The project wasn't saved</p>
          <p>{saveError}</p>
        </div>
      )}

      <Card as="section" padding="lg" aria-labelledby={`${id}-about`}>
        <CardHeader id={`${id}-about`} title="About the project" />
        <div className="grid gap-1">
          <label htmlFor={fid("title")} className={labelCls}>
            Title <span className="text-muted-foreground">(required)</span>
          </label>
          <input
            id={fid("title")}
            className={cn(control, "h-11")}
            value={title}
            required
            aria-required="true"
            aria-invalid={!!errors.title}
            aria-describedby={describedBy("title")}
            onChange={(e) => setTitle(e.target.value)}
          />
          <FieldError id={errId("title")} message={errors.title} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={fid("description")} className={labelCls}>
            Description <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id={fid("description")}
            className={cn(control, "min-h-24 py-2")}
            value={description}
            aria-invalid={!!errors.description}
            aria-describedby={describedBy("description")}
            onChange={(e) => setDescription(e.target.value)}
          />
          <FieldError id={errId("description")} message={errors.description} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={fid("objectives")} className={labelCls}>
            Research objectives <span className="text-muted-foreground">(optional)</span>
          </label>
          <p id={`${fid("objectives")}-hint`} className={hintCls}>
            One objective per line, up to {PROJECT_LIMITS.objectives}.
          </p>
          <textarea
            id={fid("objectives")}
            className={cn(control, "min-h-24 py-2")}
            value={objectives}
            aria-invalid={!!errors.objectives}
            aria-describedby={describedBy("objectives", true)}
            onChange={(e) => setObjectives(e.target.value)}
          />
          <FieldError id={errId("objectives")} message={errors.objectives} />
        </div>
        <div className="grid gap-1 sm:max-w-xs">
          <label htmlFor={fid("status")} className={labelCls}>
            Project status
          </label>
          <select
            id={fid("status")}
            className={cn(control, "h-11 text-sm")}
            value={status}
            aria-invalid={!!errors.status}
            aria-describedby={describedBy("status")}
            onChange={(e) => setStatus(e.target.value as ProjectInput["status"])}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <FieldError id={errId("status")} message={errors.status} />
        </div>
      </Card>

      <Card as="section" padding="lg" aria-labelledby={`${id}-area`}>
        <CardHeader id={`${id}-area`} title="Study area" />
        <div className="grid gap-2" id={fid("countries")} tabIndex={-1}>
          <CountrySearch
            index={index}
            label="Add a country"
            hint={indexLoading ? "Loading the country list…" : `Countries only, up to ${PROJECT_LIMITS.countries}.`}
            dataLabel={demo ? "in the demo data" : "in the data"}
            onSelect={(c) => {
              if (countries.includes(c.iso3)) setCountryMessage(`${c.name} is already in the study area.`);
              else if (countries.length >= PROJECT_LIMITS.countries) setCountryMessage(`You can choose up to ${PROJECT_LIMITS.countries} countries.`);
              else {
                setCountries([...countries, c.iso3]);
                setCountryMessage(`${c.name} added to the study area.`);
              }
            }}
          />
          <p role="status" className="text-sm" data-country-message>
            {countryMessage}
          </p>
          {countries.length > 0 ? (
            <ul aria-label="Countries in the study area" className="flex flex-wrap gap-2" data-project-countries>
              {countries.map((iso) => (
                <li key={iso} className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-raised py-0.5 pr-0.5 pl-3 text-sm">
                  {nameOf(iso)}
                  <button
                    type="button"
                    aria-label={`Remove ${nameOf(iso)}`}
                    onClick={() => {
                      setCountries(countries.filter((x) => x !== iso));
                      setCountryMessage(`${nameOf(iso)} removed from the study area.`);
                    }}
                    className="inline-grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={hintCls}>No countries chosen yet.</p>
          )}
          <FieldError id={errId("countries")} message={errors.countries} />
        </div>
        <div className="grid gap-1">
          <label htmlFor={fid("studyAreaDescription")} className={labelCls}>
            Study area description <span className="text-muted-foreground">(optional)</span>
          </label>
          <p id={`${fid("studyAreaDescription")}-hint`} className={hintCls}>
            In your own words, e.g. a region or landscape. Drawing the area on the map is not available yet.
          </p>
          <textarea
            id={fid("studyAreaDescription")}
            className={cn(control, "min-h-20 py-2")}
            value={areaText}
            aria-invalid={!!errors.studyAreaDescription}
            aria-describedby={describedBy("studyAreaDescription", true)}
            onChange={(e) => setAreaText(e.target.value)}
          />
          <FieldError id={errId("studyAreaDescription")} message={errors.studyAreaDescription} />
        </div>
      </Card>

      <Card as="section" padding="lg" aria-labelledby={`${id}-fires`}>
        <CardHeader id={`${id}-fires`} title="Linked possible fires" />
        <p className="text-sm text-muted-foreground">
          Possible fires from the current data{demo ? " (demo data: invented locations)" : ""} in the chosen countries. A possible fire is a group of
          heat spots, not a confirmed wildfire.
        </p>
        <fieldset id={fid("linkedEvents")} tabIndex={-1} className="grid gap-2" aria-describedby={describedBy("linkedEvents")}>
          <legend className="sr-only">Possible fires to link</legend>
          {countries.length === 0 ? (
            <p className="text-sm">Choose at least one country to see its possible fires.</p>
          ) : eventsQ.isPending ? (
            <p className="text-sm">Loading possible fires…</p>
          ) : eventsQ.isError ? (
            <p className="text-sm">The possible fires couldn't be loaded, so links can't be changed now. Existing links are kept.</p>
          ) : inArea.length === 0 ? (
            <p className="text-sm">The current data has no possible fires in the chosen countries.</p>
          ) : (
            <ul className="grid gap-1" data-link-options>
              {inArea.map((e) => (
                <li key={e.id}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-1 py-2 text-sm hover:bg-surface-raised">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-[18px] accent-[var(--aw-color-primary)]"
                      checked={linked.includes(e.id)}
                      onChange={(ev) => setLinked(ev.target.checked ? [...linked, e.id] : linked.filter((x) => x !== e.id))}
                    />
                    <span className="grid">
                      <span className="font-medium">
                        {e.id} · {e.name}
                      </span>
                      <span className="text-muted-foreground">
                        {e.country.name} · {formatDayRange(e.firstDetection, e.lastDetection)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {eventsQ.isSuccess && droppedLinks > 0 && (
            <p className="text-sm" data-dropped-links>
              {droppedLinks === 1 ? "1 linked possible fire is" : `${droppedLinks} linked possible fires are`} outside the chosen countries or no
              longer in the data, and will be unlinked when you save.
            </p>
          )}
          <FieldError id={errId("linkedEvents")} message={errors.linkedEvents} />
        </fieldset>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
        <Link to={cancelTo} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
