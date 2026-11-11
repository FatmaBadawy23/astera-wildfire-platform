import { useRef, useState } from "react";
import { Outlet } from "react-router";
import { getDataMode } from "@/app/env";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { MobileNav, type DrawerCloseReason } from "./MobileNav";
import { MockBanner } from "./MockBanner";
import { Sidebar } from "./Sidebar";
import { SkipLink } from "./SkipLink";
import { focusPageHeading } from "./useRouteFocus";
import { useShellMode } from "./useShellMode";
import { useSidebarState } from "./useSidebarState";

/** In the docked sidebar, the link for the current page. */
export const ACTIVE_DOCKED_ITEM_SELECTOR = '[data-sidebar="docked"] [aria-current="page"]';

/**
 * App frame (D.2 layout tokens):
 *   grid rows: [MOCK banner: auto] [header: 56px] [body: minmax(0, 1fr)], height 100dvh.
 *   The body row holds the docked sidebar and <main>, each with its own scroll. Nothing overlaps <main>,
 *   so the banner and header can never cover a focused element.
 *   Short screens (max-height 480px): normal page scrolling, all parts static.
 */
export function AppShell() {
  const mode = useShellMode();
  const isMobile = mode === "mobile";
  const { collapsed, toggle } = useSidebarState(mode);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeReason = useRef<DrawerCloseReason | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const showBanner = getDataMode() === "mock";

  // The drawer only exists in mobile mode; widening the window closes it.
  const drawerVisible = drawerOpen && isMobile;

  function closeDrawer(reason: DrawerCloseReason) {
    closeReason.current = reason;
    setDrawerOpen(false);
  }

  function handleDrawerCloseAutoFocus(event: Event) {
    const reason = closeReason.current;
    closeReason.current = null;
    if (!isMobile) {
      // Closed because the window became wider: the menu button is gone, so focus the active sidebar item.
      event.preventDefault();
      setDrawerOpen(false);
      window.setTimeout(() => document.querySelector<HTMLElement>(ACTIVE_DOCKED_ITEM_SELECTOR)?.focus(), 0);
    } else if (reason === "navigate") {
      // Closed by choosing a page: focus the new page's heading, not the menu button.
      event.preventDefault();
      window.setTimeout(() => focusPageHeading(), 0);
    } else {
      // Esc, close button, outside click: back to the menu button. (Without a Dialog.Trigger, Radix
      // can't restore focus itself, so the shell does it.)
      event.preventDefault();
      menuButtonRef.current?.focus();
    }
  }

  return (
    <div
      className={cn(
        "grid h-dvh grid-rows-[auto_var(--aw-size-header)_minmax(0,1fr)] bg-background",
        "[@media(max-height:480px)]:h-auto [@media(max-height:480px)]:min-h-dvh",
      )}
      data-shell-mode={mode}
    >
      <SkipLink />
      {showBanner ? <MockBanner /> : <div />}
      <Header mobile={isMobile} drawerOpen={drawerVisible} onOpenDrawer={() => setDrawerOpen(true)} menuButtonRef={menuButtonRef} />

      <div className="flex min-h-0">
        {!isMobile && <Sidebar collapsed={collapsed} onToggle={toggle} />}
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto scroll-py-4 focus:outline-none [@media(max-height:480px)]:overflow-visible"
        >
          <Outlet />
        </main>
      </div>

      <MobileNav open={drawerVisible} onClose={closeDrawer} onCloseAutoFocus={handleDrawerCloseAutoFocus} />
    </div>
  );
}
