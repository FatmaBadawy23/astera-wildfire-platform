import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { eligibleLabels, maxMinLabelForZoom, parseCountryLabels, placeLabels, type Box } from "./countryLabels";

// Vitest runs from the frontend folder (npm test → scripts/run-vitest.mjs).
const read = (path: string) => JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
const labels = parseCountryLabels(read("public/basemap/country-labels.json"));
const basemap = read("public/basemap/countries-110m.geojson") as {
  features: { properties: { iso3: string; name: string } }[];
};

describe("country label data (Natural Earth 1:110m)", () => {
  it("has one valid label per basemap country, with the same ISO3 code and name", () => {
    expect(labels).toHaveLength(177);
    const key = (o: { iso3: string; name: string }) => `${o.iso3}|${o.name}`;
    expect(new Set(labels.map(key))).toEqual(new Set(basemap.features.map((f) => key(f.properties))));
    for (const l of labels) {
      expect(l.lon).toBeGreaterThanOrEqual(-180);
      expect(l.lon).toBeLessThanOrEqual(180);
      expect(l.lat).toBeGreaterThanOrEqual(-90);
      expect(l.lat).toBeLessThanOrEqual(90);
    }
  });

  it("drops malformed rows instead of guessing", () => {
    const parsed = parseCountryLabels({ columns: ["iso3", "name", "lon", "lat", "minLabel", "rank"], rows: [["AAA", "A", 1, 2, 3, 4], ["BBB", "B", null, 2, 3, 4], ["CCC", 7, 1, 2, 3, 4]] });
    expect(parsed.map((l) => l.iso3)).toEqual(["AAA"]);
    expect(parseCountryLabels(null)).toEqual([]);
  });
});

describe("zoom tiers (approved)", () => {
  it.each([
    [-0.52, null], // world view, phone
    [0.6, null], // world view, desktop
    [1.49, null],
    [1.5, 2],
    [2.49, 2],
    [2.5, 3],
    [3.5, 4],
    [4.5, Infinity],
    [11, Infinity],
  ])("zoom %s → largest MIN_LABEL %s", (zoom, max) => expect(maxMinLabelForZoom(zoom)).toBe(max));

  it("number of eligible names per tier: 0 → 31 → 104 → 151 → all 177", () => {
    expect(eligibleLabels(labels, 0.6)).toHaveLength(0);
    expect(eligibleLabels(labels, 2)).toHaveLength(31);
    expect(eligibleLabels(labels, 3)).toHaveLength(104);
    expect(eligibleLabels(labels, 4)).toHaveLength(151);
    expect(eligibleLabels(labels, 5)).toHaveLength(177);
  });

  it("orders by LABELRANK, then MIN_LABEL (placement priority)", () => {
    const order = eligibleLabels(labels, 5);
    for (let i = 1; i < order.length; i++) {
      const [a, b] = [order[i - 1], order[i]];
      expect(a.rank < b.rank || (a.rank === b.rank && a.minLabel <= b.minLabel)).toBe(true);
    }
  });
});

describe("label placement", () => {
  const frame: Box = { left: 0, top: 0, right: 400, bottom: 300 };
  const box = (left: number, top: number, w = 60, h = 14): Box => ({ left, top, right: left + w, bottom: top + h });

  it("skips a name that overlaps a higher-priority name (with a 4 px gap)", () => {
    const placed = placeLabels([{ id: "A", box: box(100, 100) }, { id: "B", box: box(130, 105) }, { id: "C", box: box(100, 117) }, { id: "D", box: box(100, 140) }], [], frame);
    expect([...placed]).toEqual(["A", "D"]); // C is 3 px below A: inside the gap
  });

  it("skips names covering obstacles (points, markers, controls, DEMO chip, selection card) or leaving the map", () => {
    const obstacles = [box(200, 200, 12, 12)];
    const placed = placeLabels([{ id: "onPoint", box: box(190, 195) }, { id: "outside", box: box(380, 20) }, { id: "free", box: box(20, 20) }], obstacles, frame);
    expect([...placed]).toEqual(["free"]);
  });

  it("density squares are not obstacles: only the listed obstacles block a name", () => {
    expect(placeLabels([{ id: "A", box: box(50, 50) }], [], frame).has("A")).toBe(true);
  });
});
