import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";
import { axeViolations } from "@/test/axe";
import { routes } from "./router";
import { NAV_ITEMS } from "./nav";

// jsdom renders no CSS, so colour contrast is checked in real Edge by scripts/browser-checks.mjs.

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

function renderAt(path: string, theme: "light" | "dark") {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  expect(document.documentElement.dataset.theme).toBe(theme);
}

const PATHS = ["/", "/login", "/register", ...NAV_ITEMS.map((i) => i.path), "/events/E-1", "/no/such/page"];

describe.each(["light", "dark"] as const)("axe-core WCAG A/AA, %s theme", (theme) => {
  it.each(PATHS)("%s has no violations", async (path) => {
    renderAt(path, theme);
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("collapsed sidebar has no violations", async () => {
    const user = userEvent.setup();
    renderAt("/explorer", theme);
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("open mobile drawer has no violations", async () => {
    const user = userEvent.setup();
    width = 390;
    renderAt("/explorer", theme);
    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
    await screen.findByRole("dialog");
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
