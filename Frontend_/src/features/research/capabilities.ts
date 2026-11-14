/**
 * Research Center capabilities: the single source for every availability label in the section (stages R1–R2).
 *
 * Status meanings (same tags as the rest of the app):
 * - "browser" ("Works in this browser"): works now; its data is kept in this browser on this device only.
 * - "unavailable" ("Not available yet"): designed and scheduled; no part of it works yet.
 * - "planned" ("Planned"): an idea that first needs decisions, hosting or agreements.
 * Since R2 only research projects work. Features that already work elsewhere in Astera Watch are listed separately in
 * `worksToday`, with links.
 */
import { BrainCircuit, ChartLine, Database, FileText, FolderKanban, Handshake, PenTool, type LucideIcon } from "lucide-react";
import type { StatusKind } from "@/components/ui/status-tag";

export const RESEARCH_PATH = "/research";
export const RESEARCH_TITLE = "Research Center";

export type CapabilityId = "projects" | "data" | "annotation" | "models" | "analysis" | "reports" | "collaboration";

export interface WorksTodayLink {
  label: string;
  to: string;
  /** What actually works there today, in plain words (with its data limits). */
  detail: string;
}

export interface Capability {
  id: CapabilityId;
  path: string;
  /** Sub-menu label. */
  label: string;
  /** Page title (h1 and browser tab). */
  title: string;
  icon: LucideIcon;
  status: Extract<StatusKind, "browser" | "unavailable" | "planned">;
  /** One sentence: what it is for. */
  summary: string;
  /** What it will do once built (for a working capability: what it does now). */
  willDo: string[];
  /** What has to exist first (for a working capability: what is still missing). */
  missing: string[];
  /** When it is scheduled, in plain words. */
  schedule: string;
  /** Related features that already work elsewhere in Astera Watch. */
  worksToday: WorksTodayLink[];
}

const FIRE_STORY_HINT = "Open any possible fire from Fire history to reach its Fire Story.";

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "projects",
    path: `${RESEARCH_PATH}/projects`,
    label: "Projects",
    title: "Research projects",
    icon: FolderKanban,
    status: "browser",
    summary: "A workspace for your research: title, description, objectives, study area (countries) and linked possible fires.",
    willDo: [
      "Create, edit and delete research projects (deleting asks you to confirm).",
      "Choose countries for the study area and describe it in your own words.",
      "Link possible fires from the current data in those countries.",
    ],
    missing: [
      "Projects are kept in this browser on this device only. Saving on a server, accounts and sharing need the backend.",
      "Adding datasets, annotations, analyses and reports to a project: those tools are not available yet.",
    ],
    schedule: "Works now in this browser. Server storage comes with the backend.",
    worksToday: [{ label: "My places", to: "/places", detail: "Save the countries you care about in this browser and see their possible fires and heat spots." }],
  },
  {
    id: "data",
    path: `${RESEARCH_PATH}/data`,
    label: "Data",
    title: "Satellite and geospatial data",
    icon: Database,
    status: "browser",
    summary: "A catalog of the data the app actually has, with source, licence, coverage and dates, that you can add to your projects.",
    willDo: [
      "Browse the datasets in the app: real reference maps and invented demo data, always labelled.",
      "See each dataset's details; missing metadata is shown as “Not available”.",
      "Add datasets to your research projects (the links are kept in this browser).",
    ],
    missing: [
      "Real satellite data: NASA FIRMS, NISAR and Sentinel-1 are not connected (they need the backend).",
      "Adding your own files: needs file storage, uploads and file checks on the server (roadmap Stages 3 and 5).",
      "A dataset table in the database (no tables exist yet).",
    ],
    schedule: "Works now as an early draft. Real satellite data and uploads need the backend.",
    worksToday: [
      { label: "Fire history", to: "/history", detail: `Each Fire Story lists the radar scenes found for a possible fire and whether they can be compared (demo data). ${FIRE_STORY_HINT}` },
      { label: "User Guide: the map background", to: "/guide#basemap", detail: "The map background and country outlines come from Natural Earth (public domain)." },
    ],
  },
  {
    id: "annotation",
    path: `${RESEARCH_PATH}/annotation`,
    label: "Annotation",
    title: "Wildfire annotation",
    icon: PenTool,
    status: "unavailable",
    summary: "Tools to mark what you see on the map or on imagery, such as a fire front or visible smoke, as part of a project.",
    willDo: [
      "Draw points and areas on the map inside a project, with a type and a note.",
      "Download annotations as a GeoJSON file.",
      "Every annotation is labelled as your interpretation, never as a burned-area measurement.",
    ],
    missing: ["Research projects to hold the annotations.", "Saving annotations (browser first; a server needs the backend and accounts)."],
    schedule: "After projects, data, and analysis (browser-only first).",
    worksToday: [],
  },
  {
    id: "models",
    path: `${RESEARCH_PATH}/models`,
    label: "AI models",
    title: "AI models",
    icon: BrainCircuit,
    status: "planned",
    summary: "Access to AI models for wildfire research, each described by a model card, with results always labelled as estimates.",
    willDo: [
      "Describe each model with a model card: task, inputs, training data, validation and known limits.",
      "Run a model on a project's data, with its version and inputs recorded.",
      "Show results as estimates with uncertainty, never as confirmed facts.",
    ],
    missing: [
      "No AI model has been chosen, trained or validated. No model is connected to Astera Watch.",
      "A server to run models and a job system to track runs (backend not built).",
      "Agreement in the team on which models to use and how to validate them.",
    ],
    schedule: "Planned. The models page with an empty model-card template comes last in this round; running models needs the backend.",
    worksToday: [
      {
        label: "How It Works",
        to: "/how-it-works",
        detail: "Describes the planned radar change method (a log-ratio comparison, not an AI model). In the demo its results are simulated.",
      },
    ],
  },
  {
    id: "analysis",
    path: `${RESEARCH_PATH}/analysis`,
    label: "Analysis",
    title: "Statistics and time series",
    icon: ChartLine,
    status: "unavailable",
    summary: "Statistics and time series for a project's study area, such as heat spots per day or per country.",
    willDo: [
      "Count heat spots per day, week or country for a project's area and period.",
      "Show every chart with a table and its data source, and label demo data.",
      "Later: radar surface change over time, once the processing pipeline exists.",
    ],
    missing: ["Research projects to define the area and period.", "Radar change over time needs the processing pipeline (roadmap Stage 4)."],
    schedule: "After projects and data (first on the data the app already holds).",
    worksToday: [
      {
        label: "Fire history",
        to: "/history",
        detail: `Each Fire Story has a heat-spot timeline (per day) and the radar change analysis. Both use demo data; the analysis results are simulated. ${FIRE_STORY_HINT}`,
      },
    ],
  },
  {
    id: "reports",
    path: `${RESEARCH_PATH}/reports`,
    label: "Reports",
    title: "Scientific reports",
    icon: FileText,
    status: "unavailable",
    summary: "Reports that bring a project's question, data, annotations and results together, with every source listed.",
    willDo: [
      "Build a report from a project and download it (JSON, CSV) or print it.",
      "List every dataset, annotation and result used, so each statement can be traced.",
      "Carry the demo label on every page when any source is demo data.",
    ],
    missing: ["Research projects and their content.", "Saving reports on a server needs the backend."],
    schedule: "After annotation (download and print first).",
    worksToday: [{ label: "Fire history", to: "/history", detail: `Each Fire Story can be downloaded as JSON or CSV and printed. ${FIRE_STORY_HINT}` }],
  },
  {
    id: "collaboration",
    path: `${RESEARCH_PATH}/collaboration`,
    label: "Collaboration",
    title: "Research collaboration",
    icon: Handshake,
    status: "planned",
    summary: "Working on projects together with universities and research centers.",
    willDo: [
      "Invite people to a project with a role (researcher, reviewer, viewer).",
      "Show partner institutions, but only those with an agreement the team has verified.",
    ],
    missing: [
      "There are no partnerships with any university or research center. None is implied by this page.",
      "User accounts, roles and project membership (not built).",
      "A process for agreeing and verifying partnerships.",
    ],
    schedule: "Planned. It needs accounts, a backend and real agreements first.",
    worksToday: [],
  },
];

export const capabilityById = (id: CapabilityId): Capability => CAPABILITIES.find((c) => c.id === id)!;
