import { useCallback, useState } from "react";
import type { ShellMode } from "./useShellMode";

/** Only UI preference stored for the sidebar ("collapsed" | "expanded"). Never holds user data. */
export const SIDEBAR_STORAGE_KEY = "astera-sidebar";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed";
  } catch {
    return false; // storage blocked: default (expanded)
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    /* storage blocked: keep the in-memory state only */
  }
}

/**
 * Desktop: expanded by default; the collapse choice is remembered.
 * Rail: collapsed by default; expanding is temporary and not saved.
 * Mobile: the docked sidebar is not shown (drawer instead), so `collapsed` is irrelevant there.
 */
export function useSidebarState(mode: ShellMode) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(readCollapsed);
  const [railExpanded, setRailExpanded] = useState(false);

  const collapsed = mode === "rail" ? !railExpanded : desktopCollapsed;

  const toggle = useCallback(() => {
    if (mode === "rail") {
      setRailExpanded((v) => !v);
      return;
    }
    const next = !desktopCollapsed;
    setDesktopCollapsed(next);
    writeCollapsed(next);
  }, [mode, desktopCollapsed]);

  return { collapsed, toggle };
}
