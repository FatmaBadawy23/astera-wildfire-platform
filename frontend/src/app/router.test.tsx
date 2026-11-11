import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter, type NonIndexRouteObject, type RouteObject } from "react-router";
import { AppProviders } from "@/App";
import { AppShell } from "@/components/layout/AppShell";
import { routes } from "./router";
import { NAV_ITEMS } from "./nav";

function renderAt(path: string, routeTable: RouteObject[] = routes) {
  const router = createMemoryRouter(routeTable, { initialEntries: [path] });
  const utils = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...utils };
}

const banner = () => screen.queryByRole("region", { name: "Data mode notice" });
const heading = () => screen.getByRole("heading", { level: 1 });

const SHELL_ROUTES = [
  ...NAV_ITEMS.map((i) => ({ path: i.path, h1: i.title })),
  { path: "/events/E-123", h1: "Fire Event Details" },
];
const STANDALONE_ROUTES = [
  { path: "/", h1: "Monitor wildfire surface change with satellite radar", title: "Welcome" },
  { path: "/login", h1: "Log in", title: "Log in" },
  { path: "/register", h1: "Create account", title: "Create account" },
  { path: "/no/such/page", h1: "Page not found", title: "Page not found" },
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("routes: direct URL load as a guest", () => {
  it.each(SHELL_ROUTES)("$path renders inside the App Shell with the MOCK banner", async ({ path, h1 }) => {
    const { router } = renderAt(path);
    expect(heading()).toHaveTextContent(h1);
    await waitFor(() => expect(document.title).toBe(`${h1} · Astera Watch`));
    expect(banner()).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path); // no redirect to a login page
    expect(document.activeElement).toBe(document.body); // focus not moved on direct load
  });

  it.each(STANDALONE_ROUTES)("$path is standalone: no MOCK banner, no sidebar", async ({ path, h1, title }) => {
    const { router } = renderAt(path);
    expect(heading()).toHaveTextContent(h1);
    await waitFor(() => expect(document.title).toBe(`${title} · Astera Watch`));
    expect(banner()).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
    expect(document.activeElement).toBe(document.body);
  });

  it("shows the requested event ID on /events/:eventId without inventing data", () => {
    renderAt("/events/E-123");
    expect(screen.getByText("E-123")).toBeInTheDocument();
    expect(screen.getByText("This page is a placeholder. No data is shown yet.")).toBeInTheDocument();
  });

  it("keeps the F1 foundation preview reachable in development builds", () => {
    renderAt("/dev/foundation");
    expect(screen.getByText("PROVISIONAL COLOURS")).toBeInTheDocument();
    expect(banner()).not.toBeInTheDocument();
  });

  it("hides the MOCK banner in http data mode", () => {
    vi.stubEnv("VITE_DATA_MODE", "http");
    renderAt("/explorer");
    expect(heading()).toHaveTextContent("Global Fire Explorer");
    expect(banner()).not.toBeInTheDocument();
  });
});

describe("error boundary", () => {
  function Boom(): never {
    throw new Error("Test failure inside a shell page");
  }

  it("shows the standalone error page (no banner) when a shell page throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const root = routes[0] as NonIndexRouteObject;
    const withBoom: RouteObject[] = [
      { ...root, children: [...(root.children ?? []), { element: <AppShell />, children: [{ path: "/boom", element: <Boom /> }] }] },
    ];
    renderAt("/boom", withBoom);
    expect(heading()).toHaveTextContent("Something went wrong");
    expect(banner()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(screen.getByText("Test failure inside a shell page")).toBeInTheDocument(); // dev-only details
    await waitFor(() => expect(document.title).toBe("Something went wrong · Astera Watch"));
  });
});
