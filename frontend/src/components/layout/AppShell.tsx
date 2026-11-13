import { Outlet } from "react-router";
import { getDataMode } from "@/app/env";
import { HelpProvider, useHelp } from "@/components/help/HelpContext";
import { HelpAside, HelpDialog } from "@/features/help/HelpPanel";
import { cn } from "@/lib/utils";
import { DemoBar } from "./DemoBar";
import { Header } from "./Header";
import { BottomNav } from "./PrimaryNav";
import { SkipLink } from "./SkipLink";
import { useShellMode } from "./useShellMode";

/**
 * App frame (Stage 1 redesign):
 *   grid rows: [demo bar: auto] [header: 56px] [body: minmax(0, 1fr)] [phone tab bar: auto], height 100dvh.
 *   The body row holds <main> and, on desktop, the docked Help panel; each scrolls on its own. Nothing overlaps
 *   <main>, so the bars can never cover a focused element. Below 1024 px Help is a modal sheet instead.
 *   Short screens (max-height 480px): normal page scrolling, all parts static.
 */
function Frame() {
  const mode = useShellMode();
  const { open } = useHelp();
  const isMobile = mode === "mobile";
  const docked = mode === "desktop";
  const showDemoBar = getDataMode() === "mock";

  return (
    <div
      className={cn(
        "grid h-dvh grid-rows-[auto_var(--aw-size-header)_minmax(0,1fr)_auto] bg-background",
        "[@media(max-height:480px)]:h-auto [@media(max-height:480px)]:min-h-dvh",
      )}
      data-shell-mode={mode}
    >
      <SkipLink />
      {showDemoBar ? <DemoBar /> : <div />}
      <Header mobile={isMobile} wide={docked} />

      <div className="flex min-h-0">
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto scroll-py-4 focus:outline-none [@media(max-height:480px)]:overflow-visible"
        >
          <Outlet />
        </main>
        {docked && open && <HelpAside />}
      </div>

      {isMobile ? <BottomNav /> : <div />}
      {!docked && <HelpDialog />}
    </div>
  );
}

export function AppShell() {
  return (
    <HelpProvider>
      <Frame />
    </HelpProvider>
  );
}
