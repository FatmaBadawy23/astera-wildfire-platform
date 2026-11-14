/** Dataset catalog (R3): the definitions follow the rules, nothing is invented, sources are never datasets. */
import { describe, expect, it } from "vitest";
import { DETECTIONS, EVENTS, SCENES } from "@/data/mock/fixtures";
import { buildCatalog, isDemoBased, validateCatalog, type Catalog } from "./catalog";
import { createStaticCatalogRepository } from "./datasetRepository";
import { NATURAL_EARTH_DATASETS } from "./definitions/naturalEarth";

const demo = buildCatalog({ includeDemo: true });
const reference = buildCatalog({ includeDemo: false });

describe("catalog definitions", () => {
  it("are consistent in both data modes", () => {
    expect(validateCatalog(demo)).toEqual([]);
    expect(validateCatalog(reference)).toEqual([]);
  });

  it("real data is only the two bundled Natural Earth datasets; the rest is demo or derived from demo", () => {
    expect(demo.datasets.filter((d) => d.origin === "real").map((d) => d.id)).toEqual(["ne-110m-admin0-countries", "ne-50m-shaded-relief"]);
    for (const d of demo.datasets.filter((x) => x.origin !== "real")) expect(isDemoBased(d, demo.datasets)).toBe(true);
  });

  it("demo datasets mirror the fixtures exactly (no extra records)", () => {
    expect(demo.datasets.find((d) => d.id === "demo-heat-spots")!.recordCount).toBe(DETECTIONS.length);
    expect(demo.datasets.find((d) => d.id === "demo-possible-fires")!.recordCount).toBe(EVENTS.length);
    const scenes = demo.datasets.filter((d) => d.kind === "sar-scene");
    expect(scenes.map((d) => d.id)).toEqual(SCENES.map((s) => `demo-scene-${s.id}`));
    for (const s of SCENES) {
      const d = scenes.find((x) => x.id === `demo-scene-${s.id}`)!;
      expect(d.acquisitionDate).toEqual({ kind: "acquired", value: s.acquiredAt, note: "Invented demo date" });
      expect(d.provenance?.origin).toBe("synthetic");
    }
  });

  it("missing scene metadata stays missing (SYN-02: band, polarizations, resolution not stated)", () => {
    const d = demo.datasets.find((x) => x.id === "demo-scene-SYN-02-S1")!;
    const prop = (label: string) => d.properties.find((p) => p.label === label)!;
    expect(prop("Radar band").value).toBeNull();
    expect(prop("Polarizations").value).toBeNull();
    expect(prop("Resolution").value).toBeNull();
    expect(prop("Radar band").missingReason).toBeTruthy();
    expect(d.title).toContain("band not stated");
  });

  it("Sentinel-1 demo scenes are C-band and never called NISAR", () => {
    const d = demo.datasets.find((x) => x.id === "demo-scene-SYN-03-S1")!;
    expect(d.title).toContain("Sentinel-1 C-band");
    expect(d.title).not.toContain("NISAR");
    expect(d.properties.find((p) => p.label === "Radar band")!.value).toBe("C-band");
  });

  it("Natural Earth: no invented version, acquisition date or citation; download dates are not acquisition dates", () => {
    for (const d of NATURAL_EARTH_DATASETS) {
      expect(d.licence).toBe("Public domain");
      expect(d.version).toBeNull();
      expect(d.missingReasons.version).toMatch(/not recorded/);
      expect(d.acquisitionDate).toBeNull();
      expect(d.citation).toBeNull();
      expect(d.dates.every((x) => x.kind === "downloaded")).toBe(true);
    }
    expect(NATURAL_EARTH_DATASETS.map((d) => d.dates[0].value)).toEqual(["2026-11-11", "2026-11-13"]);
  });

  it("demo data has no provider or licence, with the reason", () => {
    for (const d of demo.datasets.filter((x) => x.access === "demo")) {
      expect(d.provider).toBeNull();
      expect(d.licence).toBeNull();
      expect(d.missingReasons.licence).toBeTruthy();
    }
  });

  it("http mode: reference data only, no demo datasets", () => {
    expect(reference.datasets.map((d) => d.id)).toEqual(["ne-110m-admin0-countries", "ne-50m-shaded-relief"]);
  });

  it("unconnected sources are listed separately, never as datasets", () => {
    expect(demo.sources.map((s) => s.id)).toEqual(["source-nasa-firms", "source-nisar", "source-sentinel-1"]);
    expect(demo.sources.every((s) => s.status === "not-connected")).toBe(true);
    const datasetIds = new Set(demo.datasets.map((d) => d.id));
    for (const s of demo.sources) expect(datasetIds.has(s.id)).toBe(false);
  });

  it("validation catches broken entries (future edits stay safe)", () => {
    const d0 = demo.datasets[0];
    const bad: Catalog = {
      version: "x",
      datasets: [
        { ...d0, id: "dup" },
        { ...d0, id: "dup" },
        { ...d0, id: "fake-real", origin: "real", access: "demo" },
        { ...d0, id: "orphan", origin: "derived", derivedFrom: ["missing-input"] },
        { ...d0, id: "bad-date", dates: [{ kind: "acquired", value: "2026-01-01", note: null }] },
        { ...demo.datasets.find((x) => x.access === "demo")!, id: "demo-licensed", licence: "CC-BY" },
      ],
      sources: [],
    };
    const problems = validateCatalog(bad).join("\n");
    expect(problems).toMatch(/dup: duplicate ID/);
    expect(problems).toMatch(/fake-real: real data can't be demo/);
    expect(problems).toMatch(/orphan: input missing-input is not in the catalog/);
    expect(problems).toMatch(/bad-date: acquisition dates belong in acquisitionDate/);
    expect(problems).toMatch(/demo-licensed: demo data has no licence/);
  });
});

describe("catalog repository", () => {
  it("lists datasets and sources; getDataset refuses sources and unknown IDs", async () => {
    const repo = createStaticCatalogRepository({ includeDemo: true });
    expect(repo.includesDemo).toBe(true);
    expect((await repo.listDatasets()).length).toBe(demo.datasets.length);
    expect((await repo.getDataset("ne-50m-shaded-relief")).title).toMatch(/Shaded Relief/);
    await expect(repo.getDataset("source-nisar")).rejects.toMatchObject({ kind: "not-found", message: expect.stringContaining("not connected") });
    await expect(repo.getDataset("nope")).rejects.toMatchObject({ kind: "not-found" });
  });

  it("accepts a different catalog (future backend or updated definitions) without code changes", async () => {
    const repo = createStaticCatalogRepository({ includeDemo: false, catalog: { version: "next", datasets: [NATURAL_EARTH_DATASETS[1]], sources: [] } });
    expect(repo.version).toBe("next");
    expect((await repo.listDatasets()).map((d) => d.id)).toEqual(["ne-50m-shaded-relief"]);
  });
});
