/**
 * Help panel "About this screen" topics: the User Guide articles that matter on the current screen
 * (features/guide/guideArticles.tsx is the single source of the text).
 */
import { ARTICLES, type ArticleId, type GuideArticle } from "@/features/guide/guideArticles";

export type HelpTopic = GuideArticle;

const pick = (...ids: ArticleId[]): HelpTopic[] => ids.map((id) => ARTICLES[id]);

/** Topics for a pathname. */
export function topicsFor(pathname: string): HelpTopic[] {
  if (pathname === "/") return pick("start", "heat-spot", "possible-fire", "three-kinds", "squares", "basemap", "search", "limits", "demo");
  if (pathname.startsWith("/events/")) return pick("fire-story", "radar", "analysis", "data-labels", "possible-fire", "demo");
  if (pathname === "/history") return pick("history", "analysis", "data-labels", "demo");
  if (pathname === "/places") return pick("places", "search", "demo");
  return pick("start", "heat-spot", "possible-fire", "demo");
}

/** Name of the screen, for "About this screen". */
export function screenName(pathname: string): string {
  if (pathname === "/") return "Fire map";
  if (pathname.startsWith("/events/")) return "Fire Story";
  if (pathname === "/history") return "Fire History & Impacts";
  if (pathname === "/places") return "My Places & Alerts";
  if (pathname === "/guide") return "User Guide";
  if (pathname === "/how-it-works") return "How It Works";
  if (pathname === "/planned") return "What's planned";
  return "this page";
}
