import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { installViewport } from "@/test/viewport";

vi.mock("@/features/explorer/ExplorerMap", () => ({ default: () => <div data-testid="fake-map" /> }));

let viewport: ReturnType<typeof installViewport>;
beforeEach(() => {
  viewport = installViewport(1440);
});
afterEach(() => viewport.restore());

function renderAt(path = "/history") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

/** Accessible name of the focused element (aria-label, else text). */
function focusedName(): string {
  const el = document.activeElement as HTMLElement;
  return el.getAttribute("aria-label") ?? el.textContent?.trim().replace(/\s+/g, " ") ?? "";
}

const helpButton = () => document.querySelector<HTMLElement>("[data-help-trigger]")!;

describe("keyboard: App Shell at 1440px", () => {
  it("Tab order: skip link, demo bar, logo, the three destinations, How it works, Help, theme", async () => {
    const user = userEvent.setup();
    renderAt();
    const expected = [
      "Skip to main content",
      "What this means",
      "Astera Watch, go to the Fire map",
      "Fire map",
      "Fire history",
      "My places",
      "How it works",
      "Help",
      "Light theme",
      "Dark theme",
      "Use system theme",
    ];
    const seen: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      await user.tab();
      seen.push(focusedName());
    }
    expect(seen).toEqual(expected);
  });

  it("the skip link moves focus to <main>", async () => {
    const user = userEvent.setup();
    renderAt();
    await user.tab();
    expect(document.activeElement).toHaveTextContent("Skip to main content");
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(document.getElementById("main"));
  });

  it("Enter on a menu item navigates and focuses the new heading", async () => {
    const user = userEvent.setup();
    const router = renderAt();
    screen.getByRole("link", { name: /My places/ }).focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/places"));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 })));
  });

  it("Help: Enter opens the docked panel and focuses its heading; Esc closes it and returns focus", async () => {
    const user = userEvent.setup();
    renderAt();
    helpButton().focus();
    await user.keyboard("{Enter}");
    const panel = screen.getByRole("complementary", { name: "Help" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "Help" })));
    // Tabs: arrow keys move between Guide and Ask Astera.
    screen.getByRole("tab", { name: "Guide" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Ask Astera" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(panel).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(helpButton()));
  });

  it("the demo bar's 'What this means' opens Help at the demo-data topic", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.click(screen.getByRole("button", { name: "What this means" }));
    const topic = document.querySelector<HTMLDetailsElement>('[data-help-topic="demo"]')!;
    await waitFor(() => expect(topic.open).toBe(true));
    expect(document.activeElement).toBe(topic.querySelector("summary"));
    expect(topic).toHaveTextContent("not NASA observations and not real fires");
  });
});

describe("keyboard: Help sheet at 390px", () => {
  it("opens from the keyboard, traps Tab inside, and Esc returns focus to the Help tab", async () => {
    const user = userEvent.setup();
    viewport.set(390);
    renderAt();
    const help = helpButton();
    help.focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", { name: "Help" });

    for (let i = 0; i < 25; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 5; i++) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(help));
  });
});
