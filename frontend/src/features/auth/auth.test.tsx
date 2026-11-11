import { afterEach, describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { ACCOUNTS_UNAVAILABLE_TEXT } from "./AccountsUnavailableNotice";

/** Only UI preferences may ever be stored. */
const ALLOWED_STORAGE_KEYS = new Set(["astera-theme", "astera-sidebar"]);
const SECRET = "secret-P4ssword@example.com";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe.each([
  { path: "/login", heading: "Log in", fields: ["Email", "Password"], submit: "Log in (not available yet)" },
  { path: "/register", heading: "Create account", fields: ["Name", "Email", "Password", "Confirm password"], submit: "Create account (not available yet)" },
])("$path is explicitly unavailable", ({ path, heading, fields, submit }) => {
  it("states that accounts are not available and offers guest access", async () => {
    const user = userEvent.setup();
    const router = renderAt(path);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(heading);
    expect(screen.getByText("Not available yet")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(ACCOUNTS_UNAVAILABLE_TEXT);
    expect(screen.getByRole("button", { name: submit })).toBeDisabled();

    // The logo is not a link; a visible "Back to welcome" text link sits above the card (WCAG 2.5.3).
    expect(screen.getByText("Wildfire Surface-Change Monitoring with NASA NISAR Radar").closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to welcome" })).toHaveAttribute("href", "/");

    await user.click(screen.getByRole("link", { name: "Continue as guest" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/explorer"));
  });

  it("has disabled fields, no field names and no form action", () => {
    renderAt(path);
    for (const label of fields) {
      const input = screen.getByLabelText(label);
      expect(input).toBeDisabled();
      expect(input).not.toHaveAttribute("name");
    }
    const form = screen.getByRole("form");
    expect(form).not.toHaveAttribute("action");
    expect(form.querySelector("fieldset")).toBeDisabled();
  });

  it("stores nothing and sends nothing when the user types and tries to submit", async () => {
    const user = userEvent.setup();
    const router = renderAt(path);

    // Spies start AFTER the page has rendered: only requests caused by form interaction are counted,
    // not normal application asset or module loading.
    const fetchSpy = vi.fn(() => Promise.reject(new Error("network disabled in test")));
    vi.stubGlobal("fetch", fetchSpy);
    const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, "open");
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    for (const label of fields) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      await user.type(input, SECRET);
      expect(input.value).toBe("");
    }
    await user.keyboard("{Enter}");

    const form = screen.getByRole("form");
    const submitEvent = createEvent.submit(form);
    fireEvent(form, submitEvent);
    expect(submitEvent.defaultPrevented).toBe(true);
    expect(router.state.location.pathname).toBe(path);

    // Storage: only allowed preference keys, never anything typed.
    for (const [key, value] of setItem.mock.calls) {
      expect(ALLOWED_STORAGE_KEYS).toContain(key);
      expect(value).not.toContain(SECRET);
    }
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)!;
        expect(ALLOWED_STORAGE_KEYS).toContain(key);
        expect(storage.getItem(key)).not.toContain(SECRET);
      }
    }
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");

    // Network: nothing caused by form interaction.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
  });
});
