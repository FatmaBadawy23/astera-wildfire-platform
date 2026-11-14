/**
 * Research projects kept in this browser (localStorage), behind ResearchProjectRepository.
 *
 * - Key `astera-watch-research-projects`, a versioned envelope { version: 1, projects: [...] }. Nothing is sent anywhere.
 * - Records that don't match the format are not shown, but they are kept unchanged in storage on every save.
 * - If the stored value can't be read at all, nothing is written over it: reading and saving fail with a message, so a
 *   person's data is never silently replaced.
 * - When storage is blocked (private windows, browser settings), projects are kept in memory for this visit only and
 *   `persistent` is false, so the page can say so.
 * - It touches no other key (My places, theme and welcome-card keys are left alone).
 */
import { DataError } from "@/data/errors";
import type { ProjectStatus, ResearchProject } from "@/data/types";
import {
  PROJECT_LIMITS,
  PROJECT_STATUSES,
  normalizeProjectInput,
  validateProjectInput,
  type ProjectInput,
  type ResearchProjectRepository,
} from "./projectRepository";

export const PROJECTS_STORAGE_KEY = "astera-watch-research-projects";
/** Shape of a dataset reference (catalog IDs follow it; see data/catalog/catalog.ts). */
const DATASET_REF = /^[a-z0-9][a-z0-9._-]{1,99}$/i;
const VERSION = 1;

interface Envelope {
  version: number;
  projects: unknown[];
}

const isString = (v: unknown): v is string => typeof v === "string";
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);
const isNullableString = (v: unknown): v is string | null => v === null || isString(v);

/** Shape check for one stored record (the format this adapter writes). */
export function isStoredProject(v: unknown): v is ResearchProject {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  const area = p.studyArea as Record<string, unknown> | null | undefined;
  return (
    isString(p.id) &&
    isString(p.title) &&
    p.title.trim() !== "" &&
    isNullableString(p.description) &&
    isStringArray(p.objectives) &&
    PROJECT_STATUSES.includes(p.status as ProjectStatus) &&
    !!area &&
    typeof area === "object" &&
    isStringArray(area.countriesIso3) &&
    isNullableString(area.description) &&
    isStringArray(p.linkedEventIds) &&
    isString(p.createdAt) &&
    isString(p.updatedAt)
  );
}

function defaultStorage(): Storage | null {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function defaultId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `P-${crypto.randomUUID()}`;
  } catch {
    /* fall through */
  }
  return `P-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const UNREADABLE =
  "Your saved research projects in this browser can't be read, so nothing was changed. They may have been edited outside Astera Watch.";

export function createLocalProjectRepository(
  options: { storage?: Storage | null; now?: () => Date; newId?: () => string } = {},
): ResearchProjectRepository {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? defaultId;
  let memory: ResearchProject[] = [];
  /** Stored records in an unknown format: not shown, but written back unchanged. */
  let unknown: unknown[] = [];

  function read(): ResearchProject[] {
    if (!storage) return memory;
    let raw: string | null;
    try {
      raw = storage.getItem(PROJECTS_STORAGE_KEY);
    } catch {
      return memory;
    }
    unknown = [];
    if (raw === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new DataError("invalid-response", UNREADABLE, ["Stored value is not JSON."]);
    }
    const env = parsed as Envelope;
    if (!env || typeof env !== "object" || env.version !== VERSION || !Array.isArray(env.projects)) {
      throw new DataError("invalid-response", UNREADABLE, ["Unknown storage format or version."]);
    }
    const ok = env.projects.filter(isStoredProject);
    unknown = env.projects.filter((p) => !isStoredProject(p));
    return ok.map((p) => ({ ...p, datasetIds: isStringArray(p.datasetIds) ? p.datasetIds : [], storage: "browser" as const }));
  }

  function write(projects: ResearchProject[]) {
    if (!storage) {
      memory = projects;
      return;
    }
    try {
      storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify({ version: VERSION, projects: [...projects, ...unknown] } satisfies Envelope));
    } catch {
      throw new DataError("unavailable", "The project couldn't be saved: this browser's storage is full or blocked.");
    }
  }

  function checked(input: ProjectInput): ProjectInput {
    const clean = normalizeProjectInput(input);
    const errors = validateProjectInput(clean);
    const messages = Object.values(errors);
    if (messages.length) throw new DataError("invalid-response", "The project has errors.", messages);
    return clean;
  }

  function toRecord(clean: ProjectInput, base: { id: string; createdAt: string }, at: string): ResearchProject {
    return {
      id: base.id,
      title: clean.title,
      description: clean.description || null,
      objectives: clean.objectives,
      status: clean.status,
      studyArea: { geometry: null, bbox: null, countriesIso3: clean.countriesIso3, description: clean.studyAreaDescription || null },
      period: null,
      linkedEventIds: clean.linkedEventIds,
      datasetIds: [],
      annotationIds: [],
      modelRunIds: [],
      reportIds: [],
      createdAt: base.createdAt,
      updatedAt: at,
      storage: "browser",
    };
  }

  const byNewest = (a: ResearchProject, b: ResearchProject) => b.updatedAt.localeCompare(a.updatedAt);

  /** Changes only a project's dataset references (and its "last changed" time); everything else stays as stored. */
  function changeDatasets(projectId: string, change: (ids: string[]) => string[]): ResearchProject {
    const all = read();
    const i = all.findIndex((x) => x.id === projectId);
    if (i < 0) throw new DataError("not-found", `There is no research project “${projectId}” in this browser.`);
    const next = change(all[i].datasetIds);
    if (next === all[i].datasetIds) return all[i];
    const record = { ...all[i], datasetIds: next, updatedAt: now().toISOString() };
    write(all.map((x, j) => (j === i ? record : x)));
    return record;
  }

  return {
    storage: "browser",
    persistent: !!storage,
    async listProjects() {
      return [...read()].sort(byNewest);
    },
    async getProject(id) {
      const p = read().find((x) => x.id === id);
      if (!p) throw new DataError("not-found", `There is no research project “${id}” in this browser.`);
      return p;
    },
    async createProject(input) {
      const clean = checked(input);
      const all = read();
      if (all.length >= PROJECT_LIMITS.maxProjects) {
        throw new DataError("invalid-response", `You can keep up to ${PROJECT_LIMITS.maxProjects} projects in this browser. Delete one first.`);
      }
      const at = now().toISOString();
      const record = toRecord(clean, { id: newId(), createdAt: at }, at);
      write([...all, record]);
      return record;
    },
    async updateProject(id, input) {
      const clean = checked(input);
      const all = read();
      const i = all.findIndex((x) => x.id === id);
      if (i < 0) throw new DataError("not-found", `There is no research project “${id}” in this browser.`);
      const record = { ...all[i], ...toRecord(clean, all[i], now().toISOString()) };
      // Fields R2 doesn't edit (geometry, period, datasets, …) are kept as stored.
      record.studyArea = { ...all[i].studyArea, countriesIso3: clean.countriesIso3, description: clean.studyAreaDescription || null };
      record.period = all[i].period;
      record.datasetIds = all[i].datasetIds;
      record.annotationIds = all[i].annotationIds;
      record.modelRunIds = all[i].modelRunIds;
      record.reportIds = all[i].reportIds;
      write(all.map((x, j) => (j === i ? record : x)));
      return record;
    },
    async deleteProject(id) {
      const all = read();
      if (!all.some((x) => x.id === id)) throw new DataError("not-found", `There is no research project “${id}” in this browser.`);
      write(all.filter((x) => x.id !== id));
    },
    async linkDataset(projectId, datasetId) {
      if (!DATASET_REF.test(datasetId)) throw new DataError("invalid-response", `“${datasetId}” is not a valid dataset reference.`);
      return changeDatasets(projectId, (ids) => {
        if (ids.includes(datasetId)) return ids;
        if (ids.length >= PROJECT_LIMITS.datasets) {
          throw new DataError("invalid-response", `A project can have up to ${PROJECT_LIMITS.datasets} datasets. Remove one first.`);
        }
        return [...ids, datasetId];
      });
    },
    async unlinkDataset(projectId, datasetId) {
      return changeDatasets(projectId, (ids) => (ids.includes(datasetId) ? ids.filter((x) => x !== datasetId) : ids));
    },
    subscribe(listener) {
      const onStorage = (e: StorageEvent) => {
        if (e.key === PROJECTS_STORAGE_KEY || e.key === null) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  };
}
