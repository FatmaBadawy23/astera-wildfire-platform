import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "./ThemeProvider";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { THEME_STORAGE_KEY } from "./theme";

function setup() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("theme", () => {
  it("defaults to Light on a first visit", () => {
    setup();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "true");
  });

  it("defaults to Light even when the device prefers dark; 'Use system theme' then follows the device", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...original(q), matches: q === "(prefers-color-scheme: dark)" })) as typeof window.matchMedia;
    try {
      const user = userEvent.setup();
      setup();
      expect(document.documentElement.dataset.theme).toBe("light");
      await user.click(screen.getByRole("button", { name: "Use system theme" }));
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    } finally {
      window.matchMedia = original;
    }
  });

  it("switches to dark and light, and remembers the choice", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    await user.click(screen.getByRole("button", { name: "Light theme" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("restores a stored choice on load", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    setup();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("?theme= overrides the stored choice without storing it", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    window.history.replaceState(null, "", "/?theme=dark");
    setup();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    window.history.replaceState(null, "", "/");
  });
});
