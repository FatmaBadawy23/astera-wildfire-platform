/**
 * Research projects: the repository interface the pages use, and the input rules shared by every adapter.
 * Today the only adapter keeps projects in this browser (localProjectRepository.ts). A backend adapter can replace it
 * later without changing any page: pages only see this interface and DataError.
 */
import type { ProjectStatus, ResearchProject, ResearchStorage } from "@/data/types";

/** What a person enters. IDs, timestamps and storage are set by the repository. */
export interface ProjectInput {
  title: string;
  description: string;
  /** One objective per entry; blank entries are dropped. */
  objectives: string[];
  status: ProjectStatus;
  countriesIso3: string[];
  studyAreaDescription: string;
  /** Possible-fire IDs from the current data. */
  linkedEventIds: string[];
}

export interface ResearchProjectRepository {
  /** Where projects are kept, shown to the person ("browser" today). */
  readonly storage: ResearchStorage;
  /** False when the browser blocks storage: projects then last only until the page is closed. */
  readonly persistent: boolean;
  listProjects(): Promise<ResearchProject[]>;
  /** Throws DataError("not-found") for unknown IDs. */
  getProject(id: string): Promise<ResearchProject>;
  /** Throws DataError("invalid-response") with field messages when the input breaks the rules. */
  createProject(input: ProjectInput): Promise<ResearchProject>;
  updateProject(id: string, input: ProjectInput): Promise<ResearchProject>;
  deleteProject(id: string): Promise<void>;
  /**
   * Adds a dataset ID to a project (no change if already linked). The repository only stores the reference; callers
   * must check that the dataset is an accessible catalog entry first (see linkDatasetToProject).
   */
  linkDataset(projectId: string, datasetId: string): Promise<ResearchProject>;
  /** Removes a dataset ID from a project (no change if not linked). Works for IDs no longer in the catalog. */
  unlinkDataset(projectId: string, datasetId: string): Promise<ResearchProject>;
  /** Called when another tab changes the projects. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export const PROJECT_LIMITS = {
  maxProjects: 50,
  title: 120,
  description: 2000,
  objectives: 10,
  objective: 300,
  countries: 20,
  studyAreaDescription: 500,
  linkedEvents: 50,
  datasets: 50,
} as const;

export const PROJECT_STATUSES: readonly ProjectStatus[] = ["planning", "in-progress", "on-hold", "completed"];

const ISO3 = /^[A-Z]{3}$/;

export type ProjectField = "title" | "description" | "objectives" | "status" | "countries" | "studyAreaDescription" | "linkedEvents";
export type ProjectErrors = Partial<Record<ProjectField, string>>;

/** Trims text, drops blank objectives and duplicate IDs. */
export function normalizeProjectInput(input: ProjectInput): ProjectInput {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    objectives: input.objectives.map((o) => o.trim()).filter(Boolean),
    status: input.status,
    countriesIso3: [...new Set(input.countriesIso3)],
    studyAreaDescription: input.studyAreaDescription.trim(),
    linkedEventIds: [...new Set(input.linkedEventIds)],
  };
}

/** Field messages for a normalized input; an empty object means valid. */
export function validateProjectInput(input: ProjectInput): ProjectErrors {
  const e: ProjectErrors = {};
  const L = PROJECT_LIMITS;
  if (!input.title) e.title = "Enter a project title.";
  else if (input.title.length > L.title) e.title = `Use at most ${L.title} characters for the title.`;
  if (input.description.length > L.description) e.description = `Use at most ${L.description} characters for the description.`;
  if (input.objectives.length > L.objectives) e.objectives = `List at most ${L.objectives} objectives.`;
  else if (input.objectives.some((o) => o.length > L.objective)) e.objectives = `Keep each objective under ${L.objective} characters.`;
  if (!PROJECT_STATUSES.includes(input.status)) e.status = "Choose a project status.";
  if (input.countriesIso3.length > L.countries) e.countries = `Choose at most ${L.countries} countries.`;
  else if (input.countriesIso3.some((c) => !ISO3.test(c))) e.countries = "A chosen country isn't recognised.";
  if (input.studyAreaDescription.length > L.studyAreaDescription) e.studyAreaDescription = `Use at most ${L.studyAreaDescription} characters for the study area.`;
  if (input.linkedEventIds.length > L.linkedEvents) e.linkedEvents = `Link at most ${L.linkedEvents} possible fires.`;
  return e;
}
