import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type HelpTab = "guide" | "ask";

export interface OpenHelpOptions {
  tab?: HelpTab;
  /** Guide topic to open and focus (see helpContent.tsx). */
  topic?: string;
  /** What "Ask" was opened about (e.g. a possible fire's name). */
  askAbout?: string;
}

interface HelpState {
  open: boolean;
  tab: HelpTab;
  topic: string | null;
  askAbout: string | null;
  /** Increases on every openHelp call, so the panel can react to repeated requests for the same topic. */
  request: number;
}

interface HelpApi extends HelpState {
  openHelp: (options?: OpenHelpOptions) => void;
  closeHelp: () => void;
  toggleHelp: () => void;
  setTab: (tab: HelpTab) => void;
  /** The element focused before Help opened (focus returns there on close). */
  openerRef: React.RefObject<HTMLElement | null>;
}

const HelpCtx = createContext<HelpApi | null>(null);

export const HELP_PANEL_ID = "help-panel";

/** Help panel state for the App Shell: one panel (Guide + Ask), opened from any screen. */
export function HelpProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HelpState>({ open: false, tab: "guide", topic: null, askAbout: null, request: 0 });
  const openerRef = useRef<HTMLElement | null>(null);

  const openHelp = useCallback((o: OpenHelpOptions = {}) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && !active.closest(`#${HELP_PANEL_ID}`)) openerRef.current = active;
    setState((s) => ({ open: true, tab: o.tab ?? "guide", topic: o.topic ?? null, askAbout: o.askAbout ?? null, request: s.request + 1 }));
  }, []);
  const closeHelp = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const toggleHelp = useCallback(() => {
    if (state.open) closeHelp();
    else openHelp();
  }, [state.open, closeHelp, openHelp]);
  const setTab = useCallback((tab: HelpTab) => setState((s) => ({ ...s, tab })), []);

  const api = useMemo(() => ({ ...state, openHelp, closeHelp, toggleHelp, setTab, openerRef }), [state, openHelp, closeHelp, toggleHelp, setTab]);
  return <HelpCtx.Provider value={api}>{children}</HelpCtx.Provider>;
}

/** Help panel controls. Outside the App Shell (standalone pages) it is a no-op. */
export function useHelp(): HelpApi {
  const ctx = useContext(HelpCtx);
  if (ctx) return ctx;
  return {
    open: false,
    tab: "guide",
    topic: null,
    askAbout: null,
    request: 0,
    openHelp: () => {},
    closeHelp: () => {},
    toggleHelp: () => {},
    setTab: () => {},
    openerRef: { current: null },
  };
}
