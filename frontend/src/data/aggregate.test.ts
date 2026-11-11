import { describe, expect, it } from "vitest";
import { aggregateDensity, densityClasses, densityLevel } from "./aggregate";
import { DEMO_WINDOW, DETECTIONS, SYNTHETIC_FIRMS_PROVENANCE } from "./mock/fixtures";

const WINDOW = { start: "2026-07-12T00:00:00Z", end: "2026-07-20T00:00:00Z" };

describe("FIRMS detection density (derived count, not burned area)", () => {
  it("the cell counts add up to the number of detections in the window", () => {
    const grid = aggregateDensity(DETECTIONS, WINDOW, SYNTHETIC_FIRMS_PROVENANCE);
    const inWindow = DETECTIONS.filter((d) => d.acquiredAt >= WINDOW.start && d.acquiredAt <= WINDOW.end).length;
    expect(grid.kind).toBe("derived");
    expect(grid.total).toBe(inWindow);
    expect(grid.cells.reduce((n, c) => n + c.count, 0)).toBe(inWindow);
  });

  it("covers every detection over the full demo window and is deterministic", () => {
    const a = aggregateDensity(DETECTIONS, DEMO_WINDOW, SYNTHETIC_FIRMS_PROVENANCE);
    expect(a.total).toBe(DETECTIONS.length);
    expect(aggregateDensity(DETECTIONS, DEMO_WINDOW, SYNTHETIC_FIRMS_PROVENANCE)).toEqual(a);
  });

  it("places each detection inside its cell", () => {
    const grid = aggregateDensity(DETECTIONS.slice(0, 50), DEMO_WINDOW, SYNTHETIC_FIRMS_PROVENANCE, 0.25);
    for (const d of DETECTIONS.slice(0, 50)) {
      const [lon, lat] = d.geometry.coordinates;
      expect(grid.cells.some((c) => lon >= c.bbox.west && lon < c.bbox.east && lat >= c.bbox.south && lat < c.bbox.north)).toBe(true);
    }
  });

  it("five contiguous numeric classes from 1 to the maximum", () => {
    const grid = aggregateDensity(DETECTIONS, DEMO_WINDOW, SYNTHETIC_FIRMS_PROVENANCE);
    const classes = densityClasses(grid);
    const max = Math.max(...grid.cells.map((c) => c.count));
    expect(classes).toHaveLength(5);
    expect(classes[0][0]).toBe(1);
    expect(classes[4][1]).toBe(max);
    for (let i = 1; i < classes.length; i++) expect(classes[i][0]).toBe(classes[i - 1][1] + 1);
    expect(densityLevel(0, classes)).toBe(0);
    expect(densityLevel(1, classes)).toBe(1);
    expect(densityLevel(max, classes)).toBe(5);
  });

  it("an empty window has no classes", () => {
    const grid = aggregateDensity(DETECTIONS, { start: "2020-01-01T00:00:00Z", end: "2020-01-02T00:00:00Z" }, SYNTHETIC_FIRMS_PROVENANCE);
    expect(grid.total).toBe(0);
    expect(densityClasses(grid)).toEqual([]);
  });
});
