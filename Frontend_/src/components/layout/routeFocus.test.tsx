import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, type NonIndexRouteObject, type RouteObject } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { installViewport } from "@/test/viewport";
import { AppShell } from "./AppShell";
import { Page } from "./Page";

vi.mock("@/features/explorer/ExplorerMap", () => ({ default: () => <div data-testid="fake-map" /> }));

// Desktop width, so the header menu is present.
let viewport: ReturnType<typeof installViewport>;
beforeEach(() => {
  viewport = installViewport(1440);
});
afterEach(() => viewport.restore());

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
const menu = () => within(screen.getByRole("navigation", { name: "Main" }));
const helpButton = () => document.querySelector<HTMLElement>("[data-help-trigger]")!;

describe("route focus management", () => {
  it("does not move focus on a direct URL load", () => {
    renderAt("/how-it-works");
    expect(h1()).toHaveTextContent("How It Works");
    expect(document.activeElement).toBe(document.body);
  });

  it("moves focus to the new h1 and updates the title after a menu link click", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.click(menu().getByRole("link", { name: /Fire history/ }));
    await waitFor(() => expect(h1()).toHaveTextContent("Fire History & Impacts"));
    expect(document.activeElement).toBe(h1());
    await waitFor(() => expect(document.title).toBe("Fire History & Impacts · Astera Watch"));
  });

  it("handles browser Back and Forward", async () => {
    const user = userEvent.setup();
    const router = renderAt("/");
    await user.click(menu().getByRole("link", { name: /Fire history/ }));
    await waitFor(() => expect(document.activeElement).toBe(h1()));

    await act(() => router.navigate(-1));
    await waitFor(() => expect(h1()).toHaveTextContent("Fire map"));
    expect(document.activeElement).toBe(h1());
    await waitFor(() => expect(document.title).toBe("Fire map · Astera Watch"));

    await act(() => router.navigate(1));
    await waitFor(() => expect(h1()).toHaveTextContent("Fire History & Impacts"));
    expect(document.activeElement).toBe(h1());
    await waitFor(() => expect(document.title).toBe("Fire History & Impacts · Astera Watch"));
  });

  it("moves focus after links from a standalone page and from the header logo", async () => {
    const user = userEvent.setup();
    renderAt("/no/such/page");
    await user.click(screen.getByRole("link", { name: "Go to the Fire map" }));
    await waitFor(() => expect(h1()).toHaveTextContent("Fire map"));
    expect(document.activeElement).toBe(h1());

    await user.click(menu().getByRole("link", { name: /Research Center/ }));
    await waitFor(() => expect(h1()).toHaveTextContent("Research Center"));
    await user.click(screen.getByRole("link", { name: "Astera Watch, go to the Fire map" }));
    await waitFor(() => expect(h1()).toHaveTextContent("Fire map"));
    expect(document.activeElement).toBe(h1());
  });

  it("focuses <main> first, then the h1 when it renders late", async () => {
    const router = renderAt("/");
    await act(() => router.navigate("/slow"));
    expect(document.activeElement).toBe(document.getElementById("main"));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Slow page" })).toBe(document.activeElement), { timeout: 2000 });
  });

  it("does not take focus away if the user moved focus while the h1 was loading", async () => {
    const router = renderAt("/");
    await act(() => router.navigate("/slow"));
    const help = helpButton();
    act(() => help.focus());
    await screen.findByRole("heading", { level: 1, name: "Slow page" }, { timeout: 2000 });
    expect(document.activeElement).toBe(help);
  });

  it("does not move focus on a query-string-only change", async () => {
    const router = renderAt("/");
    const help = helpButton();
    act(() => help.focus());
    await act(() => router.navigate("/?event=E-1"));
    expect(router.state.location.search).toBe("?event=E-1");
    expect(document.activeElement).toBe(help);
  });
});
