export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "astera-theme";

/** Reads the stored preference. Storage can be unavailable (private mode, blocked), so never throw. */
export function readStoredPreference(): ThemePreference {
  try {
    const s = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (s === "light" || s === "dark" || s === "system") return s;
  } catch {
    /* storage unavailable: fall back to system */
  }
  return "system";
}

export function storePreference(pref: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* ignore: the theme still works for this session */
  }
}

/** A `?theme=light|dark` URL parameter overrides the preference without storing it (demos, screenshots). */
export function readUrlOverride(): ResolvedTheme | null {
  try {
    const q = new URLSearchParams(window.location.search).get("theme");
    return q === "light" || q === "dark" ? q : null;
  } catch {
    return null;
  }
}

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
}
