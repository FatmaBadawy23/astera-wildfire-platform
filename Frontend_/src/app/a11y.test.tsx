import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";
import { axeViolations } from "@/test/axe";
import { installViewport } from "@/test/viewport";
import { routes } from "./router";

// jsdom renders no CSS, so colour contrast is checked in real Edge by scripts/journey-checks.mjs.
// jsdom has no WebGL: the Fire map's MapLibre canvas is checked in the browser checks.
vi.mock("@/features/explorer/ExplorerMap", () => ({ default: () => <div data-testid="fake-map" /> }));

let viewport: ReturnType<typeof installViewport>;
beforeEach(() => {
  viewport = installViewport(1440);
});
afterEach(() => viewport.restore());

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

const PATHS = ["/", "/history", "/places", "/guide", "/how-it-works", "/planned", "/research", "/research/projects", "/research/projects/new", "/research/collaboration", "/events/SYN-01", "/events/SYN-04", "/events/E-1", "/no/such/page"];

describe.each(["light", "dark"] as const)("axe-core WCAG A/AA, %s theme", (theme) => {
  it.each(PATHS)("%s has no violations", async (path) => {
    renderAt(path, theme);
    // Let the page's data load (mock repositories answer immediately in tests).
    await screen.findAllByRole("heading", { level: 2 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 50));
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("docked Help panel (desktop) has no violations, Guide and Ask", async () => {
    const user = userEvent.setup();
    renderAt("/", theme);
    await user.click(document.querySelector<HTMLElement>("[data-help-trigger]")!);
    expect(await axeViolations(document.body)).toEqual([]);
    await user.click(screen.getByRole("tab", { name: "Ask Astera" }));
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("phone layout with the Help sheet open has no violations", async () => {
    const user = userEvent.setup();
    viewport.set(390);
    renderAt("/", theme);
    expect(await axeViolations(document.body)).toEqual([]);
    await user.click(document.querySelector<HTMLElement>("[data-help-trigger]")!);
    await screen.findByRole("dialog");
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
