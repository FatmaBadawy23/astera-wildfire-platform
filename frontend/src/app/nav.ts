import { BookOpen, Bot, Database, FileChartColumn, Flame, Map as MapIcon, Radar, type LucideIcon } from "lucide-react";

export interface NavItem {
  /** Route path. */
  path: string;
  /** Short label for the sidebar. */
  label: string;
  /** Page title (h1 and browser tab). */
  title: string;
  /** One-line purpose of the area. */
  description: string;
  /** Stage F step in which the page content is built. */
  stage: "F4" | "F5" | "F6" | "F7";
  icon: LucideIcon;
}

/** The seven application areas in the sidebar (Welcome & Authentication are standalone pages). */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    path: "/explorer",
    label: "Explorer",
    title: "Global Fire Explorer",
    description: "Map of FIRMS active-fire detections and detection density, with date, country and data-source filters, search and recent events.",
    stage: "F4",
    icon: MapIcon,
  },
  {
    path: "/events",
    label: "Event Details",
    title: "Fire Event Details",
    description: "Location, timeline, detection dates, data sources and scene metadata for a selected fire event.",
    stage: "F5",
    icon: Flame,
  },
  {
    path: "/availability",
    label: "Data Availability",
    title: "Data Availability",
    description: "Pre- and post-fire scene availability by product type (NISAR GCOV, NISAR GSLC, Sentinel-1), with clear missing and unsuitable states.",
    stage: "F5",
    icon: Database,
  },
  {
    path: "/analysis",
    label: "SAR Analysis",
    title: "SAR Analysis",
    description: "Before/after comparison, backscatter change, change map and estimated changed area, available only after the availability check passes.",
    stage: "F6",
    icon: Radar,
  },
  {
    path: "/reports",
    label: "Reports & Insights",
    title: "Reports & Insights",
    description: "Event summaries and charts, with JSON/CSV export and browser print-to-PDF.",
    stage: "F7",
    icon: FileChartColumn,
  },
  {
    path: "/assistant",
    label: "AI Assistant",
    title: "AI Scientific Assistant",
    description: "Answers questions about the selected event and its available results. It never invents data.",
    stage: "F7",
    icon: Bot,
  },
  {
    path: "/methodology",
    label: "Data & Methodology",
    title: "Data & Methodology",
    description: "Data sources, processing steps, assumptions and known limitations, including how mock data is labelled.",
    stage: "F7",
    icon: BookOpen,
  },
];

export const APP_NAME = "Astera Watch";
