import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "@/App";
import { axeViolations } from "@/test/axe";

describe("foundation preview (Stage F1)", () => {
  it("renders the brand, theme switch and scientific legend wording", () => {
    render(<App />);
    expect(screen.getAllByText("Astera Watch").length).toBeGreaterThan(0);
    expect(screen.getByRole("group", { name: "Colour theme" })).toBeInTheDocument();
    expect(screen.getByText(/FIRMS detection density, not burned area/)).toBeInTheDocument();
    expect(screen.getByText("PROVISIONAL COLOURS")).toBeInTheDocument();
    expect(screen.getByText(/Active-fire detection \(FIRMS\): a point, not burned area/)).toBeInTheDocument();
  });

  it("has no axe-core WCAG A/AA violations", async () => {
    const { container } = render(<App />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
