import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, type NonIndexRouteObject, type RouteObject } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { AppShell } from "./AppShell";
import { Page } from "./Page";

// --- controllable matchMedia (desktop width, so the docked sidebar is present) ---
const originalMatchMedia = window.matchMedia;
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1]);
      return {
        matches: Number.isFinite(min) ? 1440 >= min : false,
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
});
afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: originalMatchMedia });
});

/** A page whose h1 appears 300 ms after it mounts (stands in for a lazy/slow page). */
function SlowPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 300);
    return () => window.clearTimeout(t);
  }, []);
  return ready ? <Page title="Slow page" /> : <p>Loading…</p>;
}

function renderAt(path: string) {
  const root = routes[0] as NonIndexRouteObject;
  const table: RouteObject[] = [
    {
      ...root,
      children: [
        ...(root.children ?? []),
        { element: <AppShell />, children: [{ path: "/slow", element: <SlowPage />, handle: { title: "Slow page" } }] },
      ],
    },
  ];
  const router = createMemoryRouter(table, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

const h1 = () => screen.getByRole("heading", { level: 1 });

describe("route focus management", () => {
  it("does not move focus on a direct URL load", () => {
    renderAt("/reports");
    expect(h1()).toHaveTextContent("Reports & Insights");
    expect(document.activeElement).toBe(document.body);
  });

  it("moves focus to the new h1 and updates the title after a sidebar link click", async () => {
    const user = userEvent.setup();
    renderAt("/explorer");
    await user.click(screen.getByRole("link", { name: "Reports & Insights" }));
    await waitFor(() => expect(h1()).toHaveTextContent("Reports & Insights"));
    expect(document.activeElement).toBe(h1());
    await waitFor(() => expect(document.title).toBe("Reports & Insights · Astera Watch"));
  });

  it("handles browser Back and Forward", async () => {
    const user = userEvent.setup();
    const router = renderAt("/explorer");
    await user.click(screen.getByRole("link", { name: "Reports & Insights" }));
    await waitFor(() => expect(document.activeElement).toBe(h1()));

    await act(() => router.navigate(-1));
    await waitFor(() => expect(h1()).toHaveTextContent("Global Fire Explorer"));
    expect(document.activeElement).toBe(h1());
    await waitFor(() => expect(document.title).toBe("Global Fire Explorer · Astera Watch"));

    await act(() => router.navigate(1));
    await waitFor(() => expect(h1()).toHaveTextContent("Reports & Insights"));
    expect(document.activeElement).toBe(h1());
    await waitFor(() => expect(document.title).toBe("Reports & Insights · Astera Watch"));
  });

  it("moves focus after header and Welcome links", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.click(screen.getByRole("link", { name: "Continue as guest" }));
    await waitFor(() => expect(h1()).toHaveTextContent("Global Fire Explorer"));
    expect(document.activeElement).toBe(h1());

    // The header and the sidebar both have an "AI Assistant" link; use the header one.
    await user.click(within(screen.getByRole("banner")).getByRole("link", { name: "AI Assistant" }));
    await waitFor(() => expect(h1()).toHaveTextContent("AI Scientific Assistant"));
    expect(document.activeElement).toBe(h1());
  });

  it("focuses <main> first, then the h1 when it renders late", async () => {
    const router = renderAt("/explorer");
    await act(() => router.navigate("/slow"));
    expect(document.activeElement).toBe(document.getElementById("main"));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Slow page" })).toBe(document.activeElement), { timeout: 2000 });
  });

  it("does not take focus away if the user moved focus while the h1 was loading", async () => {
    const router = renderAt("/explorer");
    await act(() => router.navigate("/slow"));
    const collapse = screen.getByRole("button", { name: "Collapse sidebar" });
    act(() => collapse.focus());
    await screen.findByRole("heading", { level: 1, name: "Slow page" }, { timeout: 2000 });
    expect(document.activeElement).toBe(collapse);
  });

  it("does not move focus on a query-string-only change", async () => {
    const router = renderAt("/explorer");
    const collapse = screen.getByRole("button", { name: "Collapse sidebar" });
    act(() => collapse.focus());
    await act(() => router.navigate("/explorer?event=E-1"));
    expect(router.state.location.search).toBe("?event=E-1");
    expect(document.activeElement).toBe(collapse);
  });
});
