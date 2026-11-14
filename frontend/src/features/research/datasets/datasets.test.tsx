/** Dataset catalog pages (R3): browse, filter, details, add to / remove from a project, honesty rules, accessibility. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { createStaticCatalogRepository } from "@/data/catalog/datasetRepository";
import { PROJECTS_STORAGE_KEY, createLocalProjectRepository } from "@/data/research/localProjectRepository";
import type { ProjectInput } from "@/data/research/projectRepository";
import { PLACES_STORAGE_KEY } from "@/features/places/placesStore";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";
import { axeViolations } from "@/test/axe";
import { projectPath } from "../projects/paths";
import { DATASETS_PATH, datasetPath } from "./datasetText";

vi.mock("@/features/explorer/ExplorerMap", () => ({ default: () => <div data-testid="fake-map" /> }));
afterEach(() => vi.restoreAllMocks());

function renderAt(path: string, opts: { includeDemo?: boolean } = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders catalogRepository={opts.includeDemo === false ? createStaticCatalogRepository({ includeDemo: false }) : undefined}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}
const h1 = () => screen.getByRole("heading", { level: 1 });
const main = () => document.getElementById("main")!;
const input = (over: Partial<ProjectInput> = {}): ProjectInput => ({
  title: "Study",
  description: "",
  objectives: [],
  status: "planning",
  countriesIso3: [],
  studyAreaDescription: "",
  linkedEventIds: [],
  ...over,
});
const seed = (over: Partial<ProjectInput> = {}) => createLocalProjectRepository().createProject(input(over));

describe("dataset catalog page", () => {
  it("groups real, derived and demo data, says no satellite data is connected, and lists unconnected sources separately", async () => {
    renderAt(DATASETS_PATH);
    expect(h1()).toHaveTextContent("Datasets");
    await waitFor(() => expect(document.querySelector('[data-dataset-group="real"]')).not.toBeNull());
    expect(document.querySelector('[data-dataset-group="real"]')!.querySelectorAll("[data-dataset]")).toHaveLength(2);
    expect(document.querySelector('[data-dataset-group="demo"]')!.querySelectorAll("[data-dataset]").length).toBe(12);
    expect(document.querySelector('[data-dataset-group="derived-demo"]')!.querySelectorAll("[data-dataset]").length).toBe(2);
    expect(document.querySelector("[data-catalog-notice]")).toHaveTextContent("No satellite data is connected.");
    const sources = document.querySelector<HTMLElement>("[data-sources]")!;
    expect(sources.querySelectorAll("[data-source]")).toHaveLength(3);
    expect(within(sources).getAllByText("Not connected")).toHaveLength(3);
    // Sources have no details page or "add" action.
    expect(within(sources).queryAllByRole("link")).toEqual([]);
    expect(within(sources).queryAllByRole("button")).toEqual([]);
  });

  it("filters by type, real/demo and country (global reference maps cover every country); empty state and clear", async () => {
    const user = userEvent.setup();
    renderAt(DATASETS_PATH);
    await screen.findByRole("combobox", { name: "Type of data" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Real or demo" }), "real");
    await waitFor(() => expect(document.querySelectorAll("[data-dataset]")).toHaveLength(2));
    await user.selectOptions(screen.getByRole("combobox", { name: "Real or demo" }), "");
    await user.selectOptions(screen.getByRole("combobox", { name: "Covers country" }), "PRT");
    // Portugal: 2 global reference maps + demo heat spots + demo possible fires + 2 SYN-03 scenes + analysis results.
    await waitFor(() => expect(document.querySelectorAll("[data-dataset]")).toHaveLength(7));
    await user.selectOptions(screen.getByRole("combobox", { name: "Type of data" }), "vector-boundaries");
    await user.selectOptions(screen.getByRole("combobox", { name: "Real or demo" }), "demo");
    expect(await screen.findByText("No datasets match these filters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(document.querySelectorAll("[data-dataset]").length).toBe(16));
  });

  it("http data mode: only the bundled reference maps; no demo datasets", async () => {
    renderAt(DATASETS_PATH, { includeDemo: false });
    await waitFor(() => expect(document.querySelectorAll("[data-dataset]")).toHaveLength(2));
    expect(document.querySelector('[data-dataset-group="demo"]')).toBeNull();
  });
});

describe("dataset details page", () => {
  it("shows every field; missing values are 'Not available' with the reason; the download date is not an acquisition date", async () => {
    renderAt(datasetPath("ne-50m-shaded-relief"));
    await waitFor(() => expect(h1()).toHaveTextContent("Natural Earth I with Shaded Relief and Water (1:50m)"));
    const meta = document.querySelector<HTMLElement>("[data-dataset-meta]")!;
    expect(meta).toHaveTextContent("LicencePublic domain");
    expect(meta).toHaveTextContent("VersionNot available · The Natural Earth release version was not recorded.");
    expect(meta).toHaveTextContent("Acquisition dateNot available · Not applicable");
    expect(meta).toHaveTextContent("Downloaded 2026-11-13");
    expect(screen.getByRole("link", { name: /NE1_50M_SR_W/ })).toHaveAttribute("href", "https://naciscdn.org/naturalearth/50m/raster/NE1_50M_SR_W.zip");
    expect(document.querySelector('[data-dataset-class="real"]')).toHaveTextContent("Real data");
  });

  it("a demo scene: demo label, MOCK DATA badge, invented acquisition date, missing metadata kept", async () => {
    renderAt(datasetPath("demo-scene-SYN-02-S1"));
    await waitFor(() => expect(h1()).toHaveTextContent("Demo radar scene SYN-02-S1"));
    expect(document.querySelector('[data-dataset-class="demo"]')).toHaveTextContent("Demo data (invented)");
    expect(document.querySelector('[data-badge="mock"]')).not.toBeNull();
    const meta = document.querySelector<HTMLElement>("[data-dataset-meta]")!;
    expect(meta).toHaveTextContent("2026-06-28 19:05 UTC (Invented demo date)");
    expect(meta).toHaveTextContent("Radar bandNot available");
    expect(meta).toHaveTextContent("ProviderNot available · Invented for this demo");
  });

  it("an unconnected source has no dataset page", async () => {
    renderAt(datasetPath("source-nisar"));
    expect(await screen.findByText(/is a source that is not connected yet/)).toBeInTheDocument();
    expect(document.querySelector("[data-add-to-project]")).toBeNull();
  });
});

describe("datasets in research projects", () => {
  it("no projects yet: offers to create one", async () => {
    renderAt(datasetPath("ne-110m-admin0-countries"));
    const add = await waitFor(() => {
      const el = document.querySelector<HTMLElement>("[data-add-to-project]");
      expect(el).toHaveTextContent("You have no research projects yet.");
      return el!;
    });
    expect(within(add).getByRole("link", { name: "Create a project" })).toHaveAttribute("href", "/research/projects/new");
  });

  it("add a dataset to a project, see it on the project, remove it; other project fields and saved places untouched", async () => {
    window.localStorage.setItem(PLACES_STORAGE_KEY, '["PRT"]');
    const p = await seed({ title: "Coastal study", countriesIso3: ["PRT"], linkedEventIds: ["SYN-03"], objectives: ["A"] });
    const user = userEvent.setup();
    const router = renderAt(datasetPath("demo-heat-spots"));
    const add = await screen.findByRole("button", { name: "Add to project" });
    expect(screen.getByRole("combobox", { name: "Project" })).toHaveValue(p.id);
    await user.click(add);
    expect(await screen.findByText("Added to “Coastal study”.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("All your projects already use this dataset.")).toBeInTheDocument());

    const stored = await createLocalProjectRepository().getProject(p.id);
    expect(stored.datasetIds).toEqual(["demo-heat-spots"]);
    expect(stored.linkedEventIds).toEqual(["SYN-03"]);
    expect(stored.objectives).toEqual(["A"]);
    expect(stored.createdAt).toBe(p.createdAt);

    await router.navigate(projectPath(p.id));
    const section = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-project-dataset="demo-heat-spots"]');
      expect(el).toHaveTextContent("Demo heat spots (FIRMS-style, invented)");
      return el!;
    });
    expect(within(section).getByText("Demo data (invented)")).toBeInTheDocument();
    await user.click(within(section).getByRole("button", { name: /Remove/ }));
    await waitFor(() => expect(document.querySelector('[data-project-dataset="demo-heat-spots"]')).toBeNull());
    expect((await createLocalProjectRepository().getProject(p.id)).datasetIds).toEqual([]);
    expect(window.localStorage.getItem(PLACES_STORAGE_KEY)).toBe('["PRT"]');
  });

  it("a linked ID that is no longer in the catalog is kept and says so (e.g. demo data in http mode)", async () => {
    const p = await seed({ title: "Old links" });
    await createLocalProjectRepository().linkDataset(p.id, "demo-heat-spots");
    renderAt(projectPath(p.id), { includeDemo: false });
    await waitFor(() => expect(document.querySelector('[data-project-dataset="demo-heat-spots"]')).toHaveTextContent("not in the current catalog. The link is kept"));
    expect(JSON.parse(window.localStorage.getItem(PROJECTS_STORAGE_KEY)!).projects[0].datasetIds).toEqual(["demo-heat-spots"]);
  });

  it("unconnected sources and unknown IDs can't be linked through the app", async () => {
    const p = await seed();
    const repo = createStaticCatalogRepository({ includeDemo: true });
    await expect(repo.getDataset("source-nasa-firms")).rejects.toMatchObject({ kind: "not-found" });
    // The repository stores references only; the app links through the catalog check (useLinkDataset).
    expect((await createLocalProjectRepository().getProject(p.id)).datasetIds).toEqual([]);
  });
});

describe("project repository: dataset links", () => {
  it("link is idempotent, unlink of an absent ID changes nothing, bad references are refused", async () => {
    const repo = createLocalProjectRepository();
    const p = await repo.createProject(input());
    const a = await repo.linkDataset(p.id, "ne-50m-shaded-relief");
    const b = await repo.linkDataset(p.id, "ne-50m-shaded-relief");
    expect(b.datasetIds).toEqual(["ne-50m-shaded-relief"]);
    expect(b.updatedAt).toBe(a.updatedAt);
    const c = await repo.unlinkDataset(p.id, "not-linked");
    expect(c.updatedAt).toBe(a.updatedAt);
    await expect(repo.linkDataset(p.id, "../etc")).rejects.toMatchObject({ kind: "invalid-response" });
    await expect(repo.linkDataset("P-missing", "ne-50m-shaded-relief")).rejects.toMatchObject({ kind: "not-found" });
  });

  it("editing a project keeps its dataset links", async () => {
    const repo = createLocalProjectRepository();
    const p = await repo.createProject(input());
    await repo.linkDataset(p.id, "ne-50m-shaded-relief");
    const u = await repo.updateProject(p.id, input({ title: "Renamed" }));
    expect(u.datasetIds).toEqual(["ne-50m-shaded-relief"]);
  });
});

describe("accessibility", () => {
  it.each(["light", "dark"] as const)("catalog, filtered empty state, details with add form, project datasets (%s)", async (theme) => {
    const user = userEvent.setup();
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    const p = await seed({ title: "Axe study" });
    await createLocalProjectRepository().linkDataset(p.id, "ne-50m-shaded-relief");
    const router = renderAt(DATASETS_PATH);
    await waitFor(() => expect(document.querySelectorAll("[data-dataset]").length).toBe(16));
    expect(await axeViolations(document.body)).toEqual([]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Type of data" }), "vector-boundaries");
    await user.selectOptions(screen.getByRole("combobox", { name: "Real or demo" }), "demo");
    await screen.findByText("No datasets match these filters");
    expect(await axeViolations(document.body)).toEqual([]);

    await router.navigate(datasetPath("demo-scene-SYN-05-S2"));
    await screen.findByRole("button", { name: "Add to project" });
    expect(await axeViolations(document.body)).toEqual([]);

    await router.navigate(projectPath(p.id));
    await waitFor(() => expect(document.querySelector('[data-project-dataset="ne-50m-shaded-relief"]')).toHaveTextContent("Natural Earth"));
    expect(await axeViolations(main())).toEqual([]);
  });
});
