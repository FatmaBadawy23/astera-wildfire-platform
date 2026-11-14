/**
 * Research Center (R0 + R1): honest availability labels, no invented content, navigation, and My places still
 * working outside the main menu (Phase A).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { NAV_ITEMS } from "@/app/nav";
import { STATUS_TEXT } from "@/components/ui/status-tag";
import { PLACES_STORAGE_KEY } from "@/features/places/placesStore";
import { installViewport } from "@/test/viewport";
import { CAPABILITIES, RESEARCH_PATH } from "./capabilities";

vi.mock("@/features/explorer/ExplorerMap", () => ({ default: () => <div data-testid="fake-map" /> }));

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

const main = () => document.getElementById("main")!;
const h1 = () => screen.getByRole("heading", { level: 1 });

afterEach(() => vi.restoreAllMocks());

describe("Research Center capabilities (single source of the labels)", () => {
  it("lists the seven capabilities; research projects and datasets work (in this browser), the rest don't yet", () => {
    expect(CAPABILITIES.map((c) => c.id)).toEqual(["projects", "data", "annotation", "models", "analysis", "reports", "collaboration"]);
    expect(CAPABILITIES.filter((c) => c.status === "browser").map((c) => c.id)).toEqual(["projects", "data"]);
    for (const c of CAPABILITIES) {
      expect(["browser", "unavailable", "planned"]).toContain(c.status);
      expect(c.willDo.length).toBeGreaterThan(0);
      expect(c.missing.length).toBeGreaterThan(0);
      expect(c.schedule).not.toBe("");
      expect(c.path.startsWith(`${RESEARCH_PATH}/`)).toBe(true);
    }
  });

  it("AI models and collaboration are 'Planned' and say that no model or partnership exists", () => {
    const models = CAPABILITIES.find((c) => c.id === "models")!;
    const collab = CAPABILITIES.find((c) => c.id === "collaboration")!;
    expect(models.status).toBe("planned");
    expect(collab.status).toBe("planned");
    expect(models.missing.join(" ")).toMatch(/No model is connected/);
    expect(collab.missing.join(" ")).toMatch(/no partnerships with any university or research center/);
  });

  it("links to working features only point at routes that exist", () => {
    const known = ["/", "/history", "/places", "/how-it-works", "/guide"];
    for (const c of CAPABILITIES) for (const l of c.worksToday) expect(known).toContain(l.to.split("#")[0]);
  });
});

describe("Research Center pages", () => {
  it("overview: every capability with its status label and a link; no controls, no invented content", () => {
    renderAt(RESEARCH_PATH);
    expect(h1()).toHaveTextContent("Research Center");
    for (const c of CAPABILITIES) {
      const card = document.querySelector<HTMLElement>(`[data-capability="${c.id}"]`)!;
      expect(within(card).getByRole("heading", { level: 3, name: c.title })).toBeInTheDocument();
      expect(within(card).getByText(STATUS_TEXT[c.status])).toBeInTheDocument();
      expect(within(card).getByRole("link", { name: new RegExp(c.title) })).toHaveAttribute("href", c.path);
    }
    expect(main()).toHaveTextContent("Astera Watch provides no example projects, datasets, models, partners or results.");
    expect(main().querySelector("form, input, textarea, select, [type=file]")).toBeNull();
    expect(within(main()).queryAllByRole("button")).toEqual([]);
    // Planned and working are kept apart: working features are listed separately, as not part of the Research Center.
    const today = document.querySelector<HTMLElement>("[data-works-today]")!;
    expect(today).toHaveTextContent("They are not part of the Research Center.");
  });

  it.each(CAPABILITIES.filter((c) => c.status !== "browser").map((c) => [c.path, c] as const))("%s: title, status, what's missing; nothing interactive", async (path, c) => {
    renderAt(path);
    expect(h1()).toHaveTextContent(c.title);
    await waitFor(() => expect(document.title).toBe(`${c.title} · Research Center · Astera Watch`));
    expect(within(main()).getAllByText(STATUS_TEXT[c.status]).length).toBeGreaterThan(0);
    expect(within(main()).getByText(/nothing here works yet/)).toBeInTheDocument();
    const missing = document.querySelector<HTMLElement>("[data-missing]")!;
    for (const m of c.missing) expect(missing).toHaveTextContent(m);
    expect(main().querySelector("form, input, textarea, select, [type=file]")).toBeNull();
    expect(within(main()).queryAllByRole("button")).toEqual([]);
  });

  it("the Research Center sub-menu marks the current page; the main menu stays on Research Center", () => {
    const viewport = installViewport(1440);
    renderAt(`${RESEARCH_PATH}/data`);
    const sub = screen.getByRole("navigation", { name: "Research Center" });
    expect(within(sub).getByRole("link", { name: "Data" })).toHaveAttribute("aria-current", "page");
    expect(within(sub).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Research Center" })).toHaveAttribute("aria-current", "page");
    viewport.restore();
  });

  it("moving between Research Center pages focuses the new heading", async () => {
    const user = userEvent.setup();
    const router = renderAt(RESEARCH_PATH);
    await user.click(within(screen.getByRole("navigation", { name: "Research Center" })).getByRole("link", { name: "Reports" }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${RESEARCH_PATH}/reports`));
    await waitFor(() => expect(document.activeElement).toBe(h1()));
    expect(h1()).toHaveTextContent("Scientific reports");
  });

  it("What's planned: the Research Center card links to the section", () => {
    renderAt("/planned");
    const card = screen.getByRole("heading", { level: 2, name: /Research Center/ }).closest("section")!;
    expect(within(card).getByText("Planned")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Research Center" })).toHaveAttribute("href", RESEARCH_PATH);
    expect(screen.queryByText(/Research Hub/)).toBeNull();
  });
});

describe("My places after leaving the main menu (Phase A)", () => {
  it("is no longer in the main menu, header or footer lists of destinations", () => {
    expect(NAV_ITEMS.map((i) => i.path)).toEqual(["/", "/history", "/research"]);
    renderAt("/history");
    expect(within(screen.getByRole("navigation", { name: "Main" })).queryByRole("link", { name: /My places/ })).toBeNull();
    expect(within(screen.getByRole("navigation", { name: "Site pages" })).queryByRole("link", { name: /My places/ })).toBeNull();
  });

  it("/places still works and the saved list is kept unchanged across the Research Center", async () => {
    window.localStorage.setItem(PLACES_STORAGE_KEY, JSON.stringify(["PRT", "GRC"]));
    renderAt("/places");
    expect(h1()).toHaveTextContent("My Places & Alerts");
    await waitFor(() => expect(document.querySelectorAll("[data-place]")).toHaveLength(2));
    expect(window.localStorage.getItem(PLACES_STORAGE_KEY)).toBe(JSON.stringify(["PRT", "GRC"]));
  });

  it("visiting the Research Center doesn't read, change or clear saved places", () => {
    window.localStorage.setItem(PLACES_STORAGE_KEY, JSON.stringify(["PRT"]));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    const clear = vi.spyOn(Storage.prototype, "clear");
    for (const c of [{ path: RESEARCH_PATH }, ...CAPABILITIES]) {
      const router = renderAt(c.path);
      router.dispose();
    }
    expect(setItem.mock.calls.filter(([k]) => k === PLACES_STORAGE_KEY)).toEqual([]);
    expect(removeItem).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PLACES_STORAGE_KEY)).toBe(JSON.stringify(["PRT"]));
  });
});
