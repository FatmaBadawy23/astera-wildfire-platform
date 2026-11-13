import { BookOpen, History, Map as MapIcon, Star, Telescope, Workflow, type LucideIcon } from "lucide-react";

export const APP_NAME = "Astera Watch";

/** One of the three main destinations. Help (User Guide + Ask) is a panel, not a destination. */
export interface NavItem {
  path: string;
  /** Menu label (header). */
  label: string;
  /** Short label for the phone tab bar. */
  shortLabel: string;
  /** Page title (h1 and browser tab). */
  title: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: "/", label: "Fire map", shortLabel: "Map", title: "Fire map", icon: MapIcon },
  { path: "/history", label: "Fire history", shortLabel: "History", title: "Fire History & Impacts", icon: History },
  { path: "/places", label: "My places", shortLabel: "My places", title: "My Places & Alerts", icon: Star },
];

/** Secondary information pages: linked from the header's "Learn" menu, the Help panel and the page footers. */
export interface InfoPage {
  path: string;
  label: string;
  title: string;
  icon: LucideIcon;
}

export const GUIDE_PATH = "/guide";
export const HOW_PATH = "/how-it-works";
export const PLANNED_PATH = "/planned";

export const INFO_PAGES: readonly InfoPage[] = [
  { path: HOW_PATH, label: "How it works", title: "How It Works", icon: Workflow },
  { path: GUIDE_PATH, label: "User Guide", title: "User Guide", icon: BookOpen },
  { path: PLANNED_PATH, label: "What's planned", title: "What's planned", icon: Telescope },
];

/** Address of a possible fire's Fire Story. */
export function fireStoryPath(id: string): string {
  return `/events/${encodeURIComponent(id)}`;
}
