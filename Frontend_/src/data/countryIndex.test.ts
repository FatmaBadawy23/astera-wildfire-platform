import { describe, expect, it } from "vitest";
import { detectionsCsv, detectionsPerDay } from "@/features/story/report";
import { DETECTIONS } from "./mock/fixtures";
import { buildCountryIndex, largestPolygonBBox, parseCountryShapes, searchCountries } from "./countryIndex";

const shapes = parseCountryShapes({
  type: "FeatureCollection",
  features: [
    { properties: { iso3: "USA", name: "United States of America" }, geometry: { type: "MultiPolygon", coordinates: [[[[-125, 25], [-67, 25], [-67, 49], [-125, 49], [-125, 25]]], [[[-170, 52], [-160, 52], [-160, 55], [-170, 55], [-170, 52]]]] } },
    { properties: { iso3: "PRT", name: "Portugal" }, geometry: { type: "Polygon", coordinates: [[[-9.5, 37], [-6.2, 37], [-6.2, 42.1], [-9.5, 42.1], [-9.5, 37]]] } },
    { properties: { iso3: "PNG", name: "Papua New Guinea" }, geometry: { type: "Polygon", coordinates: [[[141, -10], [150, -10], [150, -2], [141, -2], [141, -10]]] } },
    { properties: { name: "no code" }, geometry: null },
  ],
});

describe("country index", () => {
  it("uses the largest land area for the zoom box (islands far away don't stretch it)", () => {
    expect(shapes.find((s) => s.iso3 === "USA")!.bbox).toEqual({ west: -125, south: 25, east: -67, north: 49 });
    expect(largestPolygonBBox(null)).toBeNull();
    expect(shapes).toHaveLength(3); // features without a code are skipped
  });

  it("merges the dataset's countries: dataset name shown, basemap name kept as an alias, data marked", () => {
    const index = buildCountryIndex(shapes, [{ iso3: "USA", name: "United States" }, { iso3: "PRT", name: "Portugal" }]);
    const usa = index.find((c) => c.iso3 === "USA")!;
    expect(usa).toMatchObject({ name: "United States", aliases: ["United States of America"], hasData: true });
    expect(index.find((c) => c.iso3 === "PNG")!.hasData).toBe(false);
  });

  it("search: name start first, then ISO code, then any word; countries with data first; empty text → data countries", () => {
    const index = buildCountryIndex(shapes, [{ iso3: "PRT", name: "Portugal" }]);
    expect(searchCountries(index, "por").map((c) => c.iso3)).toEqual(["PRT"]);
    expect(searchCountries(index, "guinea").map((c) => c.iso3)).toEqual(["PNG"]);
    expect(searchCountries(index, "usa").map((c) => c.iso3)).toEqual(["USA"]);
    expect(searchCountries(index, "america").map((c) => c.iso3)).toEqual(["USA"]);
    expect(searchCountries(index, "").map((c) => c.iso3)).toEqual(["PRT"]);
    expect(searchCountries(index, "springfield")).toEqual([]);
  });
});

describe("Fire Story report helpers", () => {
  const own = DETECTIONS.filter((d) => d.eventId === "SYN-01");

  it("counts heat spots per UTC day, including days without any", () => {
    const days = detectionsPerDay(own);
    expect(days.reduce((n, d) => n + d.count, 0)).toBe(own.length);
    for (let i = 1; i < days.length; i++) expect(Date.parse(days[i].day) - Date.parse(days[i - 1].day)).toBe(86_400_000);
    expect(detectionsPerDay([])).toEqual([]);
  });

  it("CSV has one row per heat spot and keeps the data origin", () => {
    const lines = detectionsCsv(own).trim().split("\n");
    expect(lines).toHaveLength(own.length + 1);
    expect(lines[1].endsWith(",synthetic")).toBe(true);
  });
});
