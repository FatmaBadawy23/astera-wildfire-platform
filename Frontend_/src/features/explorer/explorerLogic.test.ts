import { describe, expect, it } from "vitest";
import { DETECTIONS, DEMO_WINDOW } from "@/data/mock/fixtures";
import { buildDensity, cellSizeForZoom, cellSizeKm } from "./mapStyle";
import { DATA_PERIOD, isRangeValid, parseExplorerParams, toWindow } from "./useExplorerParams";
import { formatDay, formatDayRange } from "./CandidateEventList";

const provenance = DETECTIONS[0].provenance;

describe("density grid", () => {
  it("cell size gets finer as the zoom increases and stays ≥ 10 px on screen", () => {
    const sizes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(cellSizeForZoom);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
    for (let z = 0; z <= 10; z++) expect(cellSizeForZoom(z) * ((512 * 2 ** z) / 360)).toBeGreaterThanOrEqual(10);
    expect(cellSizeKm(1)).toBe(111);
  });

  it.each([4, 1, 0.25, 0.05])("exact counts, never smoothed: squares sum to the number of detections (%s°)", (cell) => {
    const view = buildDensity(DETECTIONS, DEMO_WINDOW, provenance, cell);
    expect(view.grid.total).toBe(DETECTIONS.length);
    expect(view.geojson.features.reduce((n, f) => n + f.properties.count, 0)).toBe(DETECTIONS.length);
    expect(view.grid.kind).toBe("derived");
    for (const f of view.geojson.features) expect(f.properties.level).toBeGreaterThanOrEqual(1);
  });

  it("detections outside the window are not counted", () => {
    const window = { start: "2026-08-01T00:00:00Z", end: "2026-08-31T23:59:59Z" };
    const inside = DETECTIONS.filter((d) => d.acquiredAt >= window.start && d.acquiredAt <= window.end).length;
    expect(buildDensity(DETECTIONS, window, provenance, 1).grid.total).toBe(inside);
  });
});

describe("URL parameters", () => {
  it("defaults to the full data period", () => {
    const p = parseExplorerParams(new URLSearchParams());
    expect(p).toEqual({ from: DATA_PERIOD.from, to: DATA_PERIOD.to, country: null, radar: null, q: "", event: null });
    expect(toWindow(p)).toEqual({ start: "2026-07-01T00:00:00Z", end: "2026-08-31T23:59:59Z" });
  });

  it("clamps dates to the data period and rejects unknown values", () => {
    const p = parseExplorerParams(new URLSearchParams("from=2020-01-01&to=2030-01-01&radar=sonar&country=PRT&q=x&event=SYN-02"));
    expect(p).toMatchObject({ from: DATA_PERIOD.from, to: DATA_PERIOD.to, radar: null, country: "PRT", q: "x", event: "SYN-02" });
    expect(parseExplorerParams(new URLSearchParams("from=2026-02-30")).from).toBe(DATA_PERIOD.from);
  });

  it("detects an inverted range", () => {
    expect(isRangeValid({ from: "2026-08-02", to: "2026-08-01" })).toBe(false);
    expect(isRangeValid({ from: "2026-08-01", to: "2026-08-01" })).toBe(true);
  });
});

describe("plain dates (UTC)", () => {
  it("formats days and ranges, and never invents missing dates", () => {
    expect(formatDay("2026-07-12T23:30:00Z")).toBe("12 Jul 2026");
    expect(formatDayRange("2026-07-12T00:00:00Z", "2026-07-23T00:00:00Z")).toBe("12 Jul – 23 Jul 2026 (UTC)");
    expect(formatDay(null)).toBe("Not available");
    expect(formatDayRange(null, "2026-07-23T00:00:00Z")).toBe("Not available");
  });
});
