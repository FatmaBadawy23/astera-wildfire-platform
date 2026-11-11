import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { NAV_ITEMS } from "@/app/nav";

// --- controllable matchMedia ---
let width = 1440;
const originalMatchMedia = window.matchMedia;
const originalResizeObserver = globalThis.ResizeObserver;
beforeEach(() => {
  width = 1440;
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
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      };
    },
  });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: originalMatchMedia });
  globalThis.ResizeObserver = originalResizeObserver;
});

function renderAt(path = "/explorer") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

/** Accessible name of the focused element (aria-label, else text). */
function focusedName(): string {
  const el = document.activeElement as HTMLElement;
  return el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "";
}

describe("keyboard: App Shell at 1440px", () => {
  it("Tab order: skip link, banner link, header, sidebar, collapse button", async () => {
    const user = userEvent.setup();
    renderAt();
    const expected = [
      "Skip to main content",
      "About mock data",
      "Light theme",
      "Dark theme",
      "Use system theme",
      "AI Assistant",
      "Log in",
      "Astera Watch, go to Explorer",
      ...NAV_ITEMS.map((i) => i.label),
      "Collapse sidebar",
    ];
    const seen: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      await user.tab();
      seen.push(focusedName());
    }
    expect(seen).toEqual(expected);
  });

  it("the skip link moves focus to <main>", async () => {
    const user = userEvent.setup();
    renderAt();
    await user.tab();
    expect(document.activeElement).toHaveTextContent("Skip to main content");
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(document.getElementById("main"));
  });

  it("Enter on a sidebar item navigates and focuses the new heading", async () => {
    const user = userEvent.setup();
    const router = renderAt();
    screen.getByRole("link", { name: "Data & Methodology" }).focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/methodology"));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 })));
  });

  it("the collapse button works with Enter and Space and updates aria-expanded", async () => {
    const user = userEvent.setup();
    renderAt();
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAccessibleName("Expand sidebar");
    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("collapsed: every item keeps its name and shows a tooltip on keyboard focus", async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const item of NAV_ITEMS) expect(within(nav).getByRole("link", { name: item.label })).toBeInTheDocument();

    within(nav).getByRole("link", { name: "Explorer" }).focus();
    await user.tab(); // keyboard focus on "Event Details"
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Event Details");
  });
});

describe("keyboard: mobile drawer at 390px", () => {
  it("opens from the keyboard, traps Tab inside, and Esc returns focus to the menu button", async () => {
    const user = userEvent.setup();
    width = 390;
    renderAt();
    const menu = screen.getByRole("button", { name: "Open navigation menu" });
    menu.focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", { name: "Navigation" });

    for (let i = 0; i < 25; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 5; i++) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(menu));
  });
});
