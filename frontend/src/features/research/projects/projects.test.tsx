/**
 * Research projects (R2): the browser repository, and create / list / details / edit / delete in the pages.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { DataError } from "@/data/errors";
import { PROJECTS_STORAGE_KEY, createLocalProjectRepository } from "@/data/research/localProjectRepository";
import type { ProjectInput } from "@/data/research/projectRepository";
import { PLACES_STORAGE_KEY } from "@/features/places/placesStore";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";
import { axeViolations } from "@/test/axe";
import { NEW_PROJECT_PATH, PROJECTS_PATH, projectPath } from "./paths";

vi.mock("@/features/explorer/ExplorerMap", () => ({ default: () => <div data-testid="fake-map" /> }));

afterEach(() => vi.restoreAllMocks());

const input = (over: Partial<ProjectInput> = {}): ProjectInput => ({
  title: "Fire fronts in coastal hills",
  description: "",
  objectives: [],
  status: "planning",
  countriesIso3: [],
  studyAreaDescription: "",
  linkedEventIds: [],
  ...over,
});

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(initial));
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("local project repository", () => {
  const fixedNow = () => new Date("2026-11-13T10:00:00Z");
  let n = 0;
  const ids = () => `P-test-${++n}`;

  it("starts empty: no example projects", async () => {
    const repo = createLocalProjectRepository({ storage: memoryStorage() });
    expect(await repo.listProjects()).toEqual([]);
    expect(repo.storage).toBe("browser");
    expect(repo.persistent).toBe(true);
  });

  it("creates, reads, updates and deletes; trims text and drops blank objectives", async () => {
    const storage = memoryStorage();
    const repo = createLocalProjectRepository({ storage, now: fixedNow, newId: ids });
    const p = await repo.createProject(input({ title: "  Smoke study  ", objectives: ["Map smoke", " ", "Compare dates"], countriesIso3: ["PRT", "PRT"] }));
    expect(p.title).toBe("Smoke study");
    expect(p.objectives).toEqual(["Map smoke", "Compare dates"]);
    expect(p.studyArea.countriesIso3).toEqual(["PRT"]);
    expect(p.description).toBeNull();
    expect(p.datasetIds).toEqual([]);
    expect(await repo.getProject(p.id)).toEqual(p);

    const u = await repo.updateProject(p.id, input({ title: "Smoke study 2", status: "in-progress", studyAreaDescription: "Hills" }));
    expect(u.createdAt).toBe(p.createdAt);
    expect(u.status).toBe("in-progress");
    expect(u.studyArea.description).toBe("Hills");
    expect(JSON.parse(storage.getItem(PROJECTS_STORAGE_KEY)!).version).toBe(1);

    await repo.deleteProject(p.id);
    expect(await repo.listProjects()).toEqual([]);
    await expect(repo.getProject(p.id)).rejects.toMatchObject({ kind: "not-found" });
  });

  it("rejects invalid input with field messages and saves nothing", async () => {
    const storage = memoryStorage();
    const repo = createLocalProjectRepository({ storage });
    await expect(repo.createProject(input({ title: "   " }))).rejects.toMatchObject({ kind: "invalid-response", detail: ["Enter a project title."] });
    await expect(repo.createProject(input({ title: "x".repeat(121) }))).rejects.toBeInstanceOf(DataError);
    await expect(repo.createProject(input({ countriesIso3: ["portugal"] }))).rejects.toBeInstanceOf(DataError);
    expect(storage.getItem(PROJECTS_STORAGE_KEY)).toBeNull();
  });

  it("never overwrites stored data it can't read", async () => {
    const storage = memoryStorage({ [PROJECTS_STORAGE_KEY]: "{not json" });
    const repo = createLocalProjectRepository({ storage });
    await expect(repo.listProjects()).rejects.toMatchObject({ kind: "invalid-response" });
    await expect(repo.createProject(input())).rejects.toMatchObject({ kind: "invalid-response" });
    expect(storage.getItem(PROJECTS_STORAGE_KEY)).toBe("{not json");
  });

  it("keeps records in an unknown format untouched when saving", async () => {
    const odd = { id: "X", something: "else" };
    const storage = memoryStorage({ [PROJECTS_STORAGE_KEY]: JSON.stringify({ version: 1, projects: [odd] }) });
    const repo = createLocalProjectRepository({ storage, newId: ids });
    expect(await repo.listProjects()).toEqual([]);
    await repo.createProject(input());
    expect(JSON.parse(storage.getItem(PROJECTS_STORAGE_KEY)!).projects).toContainEqual(odd);
  });

  it("without storage, keeps projects for this visit only and says so", async () => {
    const repo = createLocalProjectRepository({ storage: null });
    expect(repo.persistent).toBe(false);
    const p = await repo.createProject(input());
    expect((await repo.listProjects()).map((x) => x.id)).toEqual([p.id]);
  });

  it("touches only its own key (My places and other keys are left alone)", async () => {
    const storage = memoryStorage({ [PLACES_STORAGE_KEY]: '["PRT"]', "astera-theme": "dark" });
    const repo = createLocalProjectRepository({ storage });
    const p = await repo.createProject(input());
    await repo.updateProject(p.id, input({ title: "Changed" }));
    await repo.deleteProject(p.id);
    expect(storage.getItem(PLACES_STORAGE_KEY)).toBe('["PRT"]');
    expect(storage.getItem("astera-theme")).toBe("dark");
  });
});

// ---------------------------------------------------------------------------------------------------------------

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}
const h1 = () => screen.getByRole("heading", { level: 1 });
const stored = () => JSON.parse(window.localStorage.getItem(PROJECTS_STORAGE_KEY) ?? '{"projects":[]}').projects as { id: string; title: string }[];

async function seed(over: Partial<ProjectInput> = {}) {
  return createLocalProjectRepository().createProject(input(over));
}

describe("research project pages", () => {
  it("the workspace starts empty, says where projects are kept, and offers New project", async () => {
    renderAt(PROJECTS_PATH);
    expect(h1()).toHaveTextContent("Research projects");
    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    expect(document.querySelector("[data-storage-notice]")).toHaveTextContent("saved in this browser on this device only");
    expect(screen.getByRole("link", { name: /New project/ })).toHaveAttribute("href", NEW_PROJECT_PATH);
  });

  it("create: title required (error summary takes focus), then saved and shown on its details page", async () => {
    const user = userEvent.setup();
    const router = renderAt(NEW_PROJECT_PATH);
    await user.click(screen.getByRole("button", { name: "Create project" }));
    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("Title: Enter a project title.");
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(screen.getByRole("textbox", { name: /Title/ })).toHaveAttribute("aria-invalid", "true");
    expect(stored()).toEqual([]);

    await user.type(screen.getByRole("textbox", { name: /Title/ }), "Smoke over Portugal");
    await user.type(screen.getByRole("textbox", { name: /Description/ }), "Looking at smoke plumes.");
    await user.type(screen.getByRole("textbox", { name: /Research objectives/ }), "Map smoke{Enter}Compare with heat spots");
    await user.selectOptions(screen.getByRole("combobox", { name: "Project status" }), "in-progress");
    await user.type(screen.getByRole("combobox", { name: "Add a country" }), "Portug");
    await user.keyboard("{Enter}");
    expect(within(document.querySelector<HTMLElement>("[data-project-countries]")!).getByText("Portugal")).toBeInTheDocument();
    // Possible fires in the chosen country come from the current (demo) data.
    const option = await screen.findByRole("checkbox", { name: /SYN-03/ });
    await user.click(option);
    await user.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/research\/projects\/P-/));
    await waitFor(() => expect(h1()).toHaveTextContent("Smoke over Portugal"));
    expect(screen.getByText("Project “Smoke over Portugal” created.")).toBeInTheDocument();
    expect(document.querySelector("[data-project-status]")).toHaveTextContent("Status: In progress");
    expect(screen.getByText("Compare with heat spots")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[data-linked-event="SYN-03"]')).toHaveTextContent("Possible fire · not confirmed"));
    expect(stored().map((p) => p.title)).toEqual(["Smoke over Portugal"]);
    // The other tools are shown with their real status.
    const tools = document.querySelector<HTMLElement>("[data-project-tools]")!;
    expect(within(tools).getAllByText("Not available yet").length).toBeGreaterThan(0);
    expect(within(tools).getAllByText("Planned").length).toBe(2);
  });

  it("the list shows saved projects and opens one", async () => {
    const p = await seed({ title: "Grass fires", countriesIso3: ["GRC"] });
    const user = userEvent.setup();
    const router = renderAt(PROJECTS_PATH);
    await waitFor(() => expect(document.querySelector(`[data-project="${p.id}"]`)).not.toBeNull());
    const card = document.querySelector<HTMLElement>(`[data-project="${p.id}"]`)!;
    expect(card).toHaveTextContent("Grass fires");
    await waitFor(() => expect(card).toHaveTextContent("Greece"));
    await user.click(within(card).getByRole("link", { name: /Open project/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(projectPath(p.id)));
  });

  it("edit: changes are saved; links outside the chosen countries are dropped with a notice", async () => {
    const p = await seed({ title: "Two countries", countriesIso3: ["PRT", "GRC"], linkedEventIds: ["SYN-03", "SYN-05"] });
    const user = userEvent.setup();
    const router = renderAt(`${projectPath(p.id)}/edit`);
    const title = await screen.findByRole("textbox", { name: /Title/ });
    expect(title).toHaveValue("Two countries");
    await user.click(await screen.findByRole("button", { name: "Remove Greece" }));
    await waitFor(() => expect(document.querySelector("[data-dropped-links]")).toHaveTextContent("1 linked possible fire is outside the chosen countries"));
    await user.clear(title);
    await user.type(title, "Portugal only");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(router.state.location.pathname).toBe(projectPath(p.id)));
    await waitFor(() => expect(h1()).toHaveTextContent("Portugal only"));
    const saved = await createLocalProjectRepository().getProject(p.id);
    expect(saved.studyArea.countriesIso3).toEqual(["PRT"]);
    expect(saved.linkedEventIds).toEqual(["SYN-03"]);
    expect(saved.createdAt).toBe(p.createdAt);
  });

  it("delete asks for confirmation; Cancel keeps the project, Delete removes it", async () => {
    const keep = await seed({ title: "Keep me" });
    const p = await seed({ title: "Delete me" });
    const user = userEvent.setup();
    const router = renderAt(projectPath(p.id));
    await user.click(await screen.findByRole("button", { name: "Delete project" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete “Delete me”?" });
    expect(dialog).toHaveTextContent("It can't be undone");
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" })));
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(stored().map((x) => x.id).sort()).toEqual([keep.id, p.id].sort());

    await user.click(screen.getByRole("button", { name: "Delete project" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete project" }));
    await waitFor(() => expect(router.state.location.pathname).toBe(PROJECTS_PATH));
    await waitFor(() => expect(screen.getByText("Project “Delete me” deleted.")).toBeInTheDocument());
    expect(stored().map((x) => x.id)).toEqual([keep.id]);
  });

  it("an unknown project says so instead of showing anything invented", async () => {
    renderAt(projectPath("P-nope"));
    expect(await screen.findByText("There is no project “P-nope” in this browser")).toBeInTheDocument();
  });

  it("unreadable stored projects: an error, nothing overwritten", async () => {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, "{broken");
    renderAt(PROJECTS_PATH);
    expect(await screen.findByText("Your projects couldn't be read")).toBeInTheDocument();
    expect(window.localStorage.getItem(PROJECTS_STORAGE_KEY)).toBe("{broken");
  });

  it("saved places are untouched by creating and deleting projects", async () => {
    window.localStorage.setItem(PLACES_STORAGE_KEY, '["PRT","GRC"]');
    const repo = createLocalProjectRepository();
    const p = await repo.createProject(input());
    await repo.deleteProject(p.id);
    expect(window.localStorage.getItem(PLACES_STORAGE_KEY)).toBe('["PRT","GRC"]');
  });

  it.each(["light", "dark"] as const)("axe: list, form, details and the delete dialog have no violations (%s)", async (theme) => {
    const user = userEvent.setup();
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    const p = await seed({ title: "Axe project", objectives: ["One"], countriesIso3: ["PRT"], linkedEventIds: ["SYN-03"] });
    const router = renderAt(PROJECTS_PATH);
    expect(document.documentElement.dataset.theme).toBe(theme);
    await screen.findByText("Axe project");
    expect(await axeViolations(document.body)).toEqual([]);

    await router.navigate(`${projectPath(p.id)}/edit`);
    await screen.findByRole("checkbox", { name: /SYN-03/ });
    await user.click(await screen.findByRole("button", { name: "Remove Portugal" }));
    await user.clear(screen.getByRole("textbox", { name: /Title/ }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByRole("alert");
    expect(await axeViolations(document.body)).toEqual([]); // form with errors

    await router.navigate(projectPath(p.id));
    await waitFor(() => expect(document.querySelector('[data-linked-event="SYN-03"]')).toHaveTextContent("SYN-03 ·"));
    expect(await axeViolations(document.body)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Delete project" }));
    await screen.findByRole("alertdialog");
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
