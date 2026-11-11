import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { NAV_ITEMS } from "@/app/nav";
import { ACTIVE_DOCKED_ITEM_SELECTOR } from "./AppShell";
import { SIDEBAR_STORAGE_KEY } from "./useSidebarState";

// --- controllable matchMedia: change the "window width" and notify listeners ---
let width = 1440;
const listeners = new Set<() => void>();
const originalMatchMedia = window.matchMedia;
const originalResizeObserver = globalThis.ResizeObserver;

function resizeTo(next: number) {
  act(() => {
    width = next;
    listeners.forEach((l) => l());
  });
}

beforeEach(() => {
  width = 1440;
  listeners.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1]);
      return {
        get matches() {
          return Number.isFinite(min) ? width >= min : false;
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, l: () => void) => listeners.add(l),
        removeEventListener: (_: string, l: () => void) => listeners.delete(l),
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      };
    },
  });
  // Radix tooltips (collapsed sidebar) measure their trigger; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: originalMatchMedia });
  globalThis.ResizeObserver = originalResizeObserver;
  vi.restoreAllMocks();
});

function renderAt(path = "/explorer") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...utils };
}

const docked = () => document.querySelector<HTMLElement>('[data-sidebar="docked"]');
// hidden: true — while the modal drawer is open, Radix hides the rest of the page from assistive tech.
const menuButton = () => screen.queryByRole("button", { name: "Open navigation menu", hidden: true });

describe("responsive sidebar", () => {
  it("1440px: docked sidebar, expanded by default, no menu button", () => {
    renderAt();
    expect(docked()).toHaveAttribute("data-collapsed", "false");
    expect(menuButton()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("aria-expanded", "true");
  });

  it("1440px: the collapse choice is saved and restored", async () => {
    const user = userEvent.setup();
    const first = renderAt();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(docked()).toHaveAttribute("data-collapsed", "true");
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("collapsed");
    first.unmount();

    renderAt();
    expect(docked()).toHaveAttribute("data-collapsed", "true");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
  });

  it("1024px (lg boundary): desktop mode, expanded", () => {
    width = 1024;
    renderAt();
    expect(docked()).toHaveAttribute("data-collapsed", "false");
    expect(menuButton()).not.toBeInTheDocument();
  });

  it("1023px: rail mode, collapsed by default; expanding is temporary (not saved)", async () => {
    const user = userEvent.setup();
    width = 1023;
    renderAt();
    expect(docked()).toHaveAttribute("data-collapsed", "true");
    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(docked()).toHaveAttribute("data-collapsed", "false");
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBeNull();
  });

  it("390px: no docked sidebar; the menu button opens a drawer with all seven areas", async () => {
    const user = userEvent.setup();
    width = 390;
    renderAt();
    expect(docked()).toBeNull();
    await user.click(menuButton()!);
    const dialog = await screen.findByRole("dialog", { name: "Navigation" });
    for (const item of NAV_ITEMS) expect(within(dialog).getByRole("link", { name: item.label })).toBeInTheDocument();
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
  });

  it("390px: Esc closes the drawer and focus returns to the menu button", async () => {
    const user = userEvent.setup();
    width = 390;
    renderAt();
    await user.click(menuButton()!);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(menuButton()));
  });

  it("390px: navigating from the drawer closes it and focuses the new page heading", async () => {
    const user = userEvent.setup();
    width = 390;
    const { router } = renderAt();
    await user.click(menuButton()!);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("link", { name: "Reports & Insights" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/reports"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Reports & Insights" })));
  });

  it("resizing 390 → 1024 with the drawer open closes it and focuses the active sidebar item", async () => {
    const user = userEvent.setup();
    width = 390;
    renderAt("/analysis");
    await user.click(menuButton()!);
    await screen.findByRole("dialog");

    resizeTo(1024);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(docked()).toHaveAttribute("data-collapsed", "false");
    const active = document.querySelector<HTMLElement>(ACTIVE_DOCKED_ITEM_SELECTOR)!;
    expect(active).toHaveAccessibleName("SAR Analysis");
    await waitFor(() => expect(document.activeElement).toBe(active));

    // Back to mobile: the drawer stays closed (it does not reopen by itself).
    resizeTo(390);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("1440 → 390 → 1440 keeps the saved collapse choice", async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    resizeTo(390);
    expect(docked()).toBeNull();
    resizeTo(1440);
    expect(docked()).toHaveAttribute("data-collapsed", "true");
  });

  it("works with browser storage blocked (defaults, no crash)", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderAt();
    expect(docked()).toHaveAttribute("data-collapsed", "false");
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(docked()).toHaveAttribute("data-collapsed", "true");
  });
});
