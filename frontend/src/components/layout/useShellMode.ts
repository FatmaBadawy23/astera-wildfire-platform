import { useSyncExternalStore } from "react";

/** Layout mode from the D.2 breakpoints: desktop ≥ lg (1024), rail md–lg (768–1023), mobile < md. */
export type ShellMode = "desktop" | "rail" | "mobile";

export const DESKTOP_QUERY = "(min-width: 1024px)";
export const RAIL_QUERY = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const queries = [window.matchMedia(DESKTOP_QUERY), window.matchMedia(RAIL_QUERY)];
  queries.forEach((q) => q.addEventListener("change", onChange));
  return () => queries.forEach((q) => q.removeEventListener("change", onChange));
}

function getSnapshot(): ShellMode {
  if (typeof window.matchMedia !== "function") return "desktop";
  if (window.matchMedia(DESKTOP_QUERY).matches) return "desktop";
  if (window.matchMedia(RAIL_QUERY).matches) return "rail";
  return "mobile";
}

export function useShellMode(): ShellMode {
  return useSyncExternalStore(subscribe, getSnapshot, () => "desktop");
}
