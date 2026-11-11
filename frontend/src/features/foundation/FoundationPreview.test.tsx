import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { axeViolations } from "@/test/axe";
import { FoundationPreview } from "./FoundationPreview";

// Since F2, <App /> renders the router; the preview page is rendered directly (same assertions).
const Preview = () => (
  <ThemeProvider>
    <FoundationPreview />
  </ThemeProvider>
);

describe("foundation preview (Stage F1)", () => {
  it("renders the brand, theme switch and scientific legend wording", () => {
    render(<Preview />);
    expect(screen.getAllByText("Astera Watch").length).toBeGreaterThan(0);
    expect(screen.getByRole("group", { name: "Colour theme" })).toBeInTheDocument();
    expect(screen.getByText(/FIRMS detection density, not burned area/)).toBeInTheDocument();
    expect(screen.getByText("PROVISIONAL COLOURS")).toBeInTheDocument();
    expect(screen.getByText(/Active-fire detection \(FIRMS\): a point, not burned area/)).toBeInTheDocument();
  });

  it("has no axe-core WCAG A/AA violations", async () => {
    const { container } = render(<Preview />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
