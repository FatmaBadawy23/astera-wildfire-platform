import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { NAV_ITEMS } from "@/app/nav";
import { installViewport } from "@/test/viewport";

// The Fire map loads MapLibre lazily; shell tests don't need it.
vi.mock("@/features/explorer/ExplorerMap", () => ({ default: () => <div data-testid="fake-map" /> }));

let viewport: ReturnType<typeof installViewport>;
beforeEach(() => {
  viewport = installViewport(1440);
});
afterEach(() => {
  viewport.restore();
  vi.restoreAllMocks();
});

function renderAt(path = "/") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...utils };
}

const mainNav = () => screen.queryByRole("navigation", { name: "Main" });
const helpButton = () => document.querySelector<HTMLElement>("[data-help-trigger]")!;
const bottomNav = () => document.querySelector("[data-bottom-nav]");

describe("responsive shell", () => {
  it.each([1440, 1024])("%ipx: the three destinations in the header, Help docked beside the page (not modal)", async (w) => {
    const user = userEvent.setup();
    viewport.set(w);
    renderAt("/history");
    const nav = mainNav()!;
    expect(within(screen.getByRole("banner")).getByRole("navigation", { name: "Main" })).toBe(nav);
    expect(within(nav).getAllByRole("link").map((l) => l.textContent)).toEqual(["Fire map", "Fire history", "Research Center"]);
    expect(within(nav).getByRole("link", { name: /Fire history/ })).toHaveAttribute("aria-current", "page");
    expect(bottomNav()).toBeNull();

    await user.click(helpButton());
    const panel = screen.getByRole("complementary", { name: "Help" });
    expect(panel).toHaveAttribute("data-help-panel", "docked");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(helpButton()).toHaveAttribute("aria-expanded", "true");
    expect(helpButton()).toHaveAttribute("aria-controls", panel.id);
    // The page stays usable next to it.
    expect(screen.getByRole("heading", { level: 1, name: "Fire History & Impacts" })).toBeVisible();
  });

  it("1023px (tablet): header menu stays; Help opens as a modal sheet", async () => {
    const user = userEvent.setup();
    viewport.set(1023);
    renderAt();
    expect(mainNav()).toBeInTheDocument();
    await user.click(helpButton());
    expect(await screen.findByRole("dialog", { name: "Help" })).toHaveAttribute("data-help-panel", "sheet");
  });

  it("390px: a tab bar with Map, History, Research and Help; the header keeps only logo and theme", async () => {
    viewport.set(390);
    renderAt();
    const tabs = bottomNav()!;
    expect(tabs).not.toBeNull();
    expect(within(screen.getByRole("banner")).queryByRole("navigation")).toBeNull();
    const links = within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Map", "History", "Research"]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual(NAV_ITEMS.map((i) => i.path));
    expect(within(tabs as HTMLElement).getByRole("button", { name: "Help" })).toBeInTheDocument();
  });

  it("390px: Help opens a sheet; Esc closes it and focus returns to the Help tab", async () => {
    const user = userEvent.setup();
    viewport.set(390);
    renderAt();
    await user.click(helpButton());
    const dialog = await screen.findByRole("dialog", { name: "Help" });
    expect(within(dialog).getByRole("tab", { name: "Guide", selected: true })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(helpButton()));
  });

  it("navigating from the tab bar moves focus to the new page heading", async () => {
    const user = userEvent.setup();
    viewport.set(390);
    const { router } = renderAt();
    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Research" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/research"));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Research Center" })));
  });

  it("resizing 1440 → 390 with Help open keeps it open (docked panel becomes a sheet), and back", async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(helpButton());
    expect(screen.getByRole("complementary", { name: "Help" })).toBeInTheDocument();
    viewport.resizeTo(390);
    expect(await screen.findByRole("dialog", { name: "Help" })).toBeInTheDocument();
    viewport.resizeTo(1440);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("complementary", { name: "Help" })).toBeInTheDocument();
  });

  it("Help shows topics for the current screen and changes with the route", async () => {
    const user = userEvent.setup();
    const { router } = renderAt();
    await user.click(helpButton());
    const panel = screen.getByRole("complementary", { name: "Help" });
    expect(panel).toHaveTextContent("About this screen: Fire map");
    expect(within(panel).getByText("What is a heat spot?")).toBeInTheDocument();
    await user.click(within(mainNav()!).getByRole("link", { name: /Research Center/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/research"));
    expect(screen.getByRole("complementary", { name: "Help" })).toHaveTextContent("About this screen: Research Center");
  });

  it("Ask Astera is labelled 'Coming soon', lists the chatbot's rules and offers Guide answers; there is no question box", async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(helpButton());
    await user.click(screen.getByRole("tab", { name: "Ask Astera" }));
    const panel = screen.getByRole("complementary", { name: "Help" });
    expect(within(panel).getByText("Coming soon")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /Is a possible fire a real wildfire\?/ })).toHaveAttribute("href", "/guide#possible-fire");
    expect(panel).toHaveTextContent("never give evacuation instructions");
    expect(panel).toHaveTextContent("answer only from verified Astera Watch data and this User Guide");
    expect(within(panel).queryByRole("textbox")).toBeNull();
  });
});
