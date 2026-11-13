import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter, type NonIndexRouteObject, type RouteObject } from "react-router";
import { AppProviders } from "@/App";
import { AppShell } from "@/components/layout/AppShell";
import { routes } from "./router";

// jsdom has no WebGL: the MapLibre map is checked in the real-browser journey checks.
vi.mock("@/features/explorer/ExplorerMap", () => ({ default: () => <div data-testid="fake-map" /> }));

function renderAt(path: string, routeTable: RouteObject[] = routes) {
  const router = createMemoryRouter(routeTable, { initialEntries: [path] });
  const utils = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...utils };
}

const demoBar = () => screen.queryByRole("region", { name: "Data mode notice" });
const heading = () => screen.getByRole("heading", { level: 1 });

const SHELL_ROUTES = [
  { path: "/", h1: "Fire map", title: "Fire map" },
  { path: "/history", h1: "Fire History & Impacts", title: "Fire History & Impacts" },
  { path: "/places", h1: "My Places & Alerts", title: "My Places & Alerts" },
  { path: "/guide", h1: "User Guide", title: "User Guide" },
  { path: "/how-it-works", h1: "How It Works", title: "How It Works" },
  { path: "/planned", h1: "What's planned", title: "What's planned" },
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("routes: direct URL load", () => {
  it.each(SHELL_ROUTES)("$path renders inside the App Shell with the demo bar", async ({ path, h1, title }) => {
    const { router } = renderAt(path);
    expect(heading()).toHaveTextContent(h1);
    await waitFor(() => expect(document.title).toBe(`${title} · Astera Watch`));
    expect(demoBar()).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
    expect(document.activeElement).toBe(document.body); // focus not moved on direct load
  });

  it("a Fire Story is titled with the possible fire and shown in the App Shell", async () => {
    renderAt("/events/SYN-03");
    await waitFor(() => expect(heading()).toHaveTextContent("SYN-03 · Synthetic demo event 03"));
    await waitFor(() => expect(document.title).toBe("SYN-03 · Fire Story · Astera Watch"));
    expect(demoBar()).toBeInTheDocument();
    expect(screen.getByText("Possible fire · not confirmed")).toBeInTheDocument();
  });

  it("an unknown possible fire says so instead of inventing data", async () => {
    renderAt("/events/E-123");
    await waitFor(() => expect(heading()).toHaveTextContent("Possible fire not found"));
    expect(screen.getByText("There is no possible fire “E-123”")).toBeInTheDocument();
  });

  it("an unknown address is a standalone 404 page (no demo bar, no main menu)", async () => {
    renderAt("/no/such/page");
    expect(heading()).toHaveTextContent("Page not found");
    await waitFor(() => expect(document.title).toBe("Page not found · Astera Watch"));
    expect(demoBar()).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });

  it.each([
    ["/explorer?country=PRT&event=SYN-03", "/", "?country=PRT&event=SYN-03"],
    ["/events", "/history", ""],
    ["/availability", "/history", ""],
    ["/analysis", "/history", ""],
    ["/reports", "/history", ""],
    ["/methodology", "/how-it-works", ""],
    ["/assistant", "/guide", ""],
    ["/login", "/", ""],
    ["/register", "/", ""],
  ])("old address %s leads to %s", async (from, to, search) => {
    const { router } = renderAt(from);
    await waitFor(() => expect(router.state.location.pathname).toBe(to));
    expect(router.state.location.search).toBe(search);
    await new Promise((r) => setTimeout(r, 120));
    // Still a direct load: the redirect doesn't move focus to the page heading. (/assistant → /guide#ask focuses the
    // linked article, like a browser following an anchor.)
    expect(document.activeElement).not.toBe(heading());
    if (from !== "/assistant") expect(document.activeElement).toBe(document.body);
  });

  it("there are no login, sign-up or guest elements (accounts don't exist)", () => {
    renderAt("/");
    expect(screen.queryByText(/log in|sign in|sign up|guest/i)).not.toBeInTheDocument();
  });

  it("What's planned says nothing planned exists yet, including partnerships or approvals", () => {
    renderAt("/planned");
    for (const title of ["Mobile app experience", "Alerts and notifications", "Ask Astera (chatbot)", "Research Hub"])
      expect(screen.getByRole("heading", { level: 2, name: new RegExp(title.replace(/[()]/g, "\\$&")) })).toBeInTheDocument();
    expect(document.body).toHaveTextContent("does not mean that any partnership, review process or scientific approval is in place");
  });

  it("keeps the F1 foundation preview reachable in development builds", () => {
    renderAt("/dev/foundation");
    expect(screen.getByText("PROVISIONAL COLOURS")).toBeInTheDocument();
    expect(demoBar()).not.toBeInTheDocument();
  });

  it("hides the demo bar in http data mode", () => {
    vi.stubEnv("VITE_DATA_MODE", "http");
    renderAt("/");
    expect(heading()).toHaveTextContent("Fire map");
    expect(demoBar()).not.toBeInTheDocument();
  });
});

describe("error boundary", () => {
  function Boom(): never {
    throw new Error("Test failure inside a shell page");
  }

  it("shows the standalone error page (no demo bar) when a shell page throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const root = routes[0] as NonIndexRouteObject;
    const withBoom: RouteObject[] = [
      { ...root, children: [...(root.children ?? []), { element: <AppShell />, children: [{ path: "/boom", element: <Boom /> }] }] },
    ];
    renderAt("/boom", withBoom);
    expect(heading()).toHaveTextContent("Something went wrong");
    expect(demoBar()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(screen.getByText("Test failure inside a shell page")).toBeInTheDocument(); // dev-only details
    await waitFor(() => expect(document.title).toBe("Something went wrong · Astera Watch"));
  });
});
