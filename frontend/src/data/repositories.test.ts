import { afterEach, describe, expect, it, vi } from "vitest";
import { createRepositories } from "./DataProvider";
import { DataError } from "./errors";
import { createMockRepositories, readMockScenario } from "./mock/mockRepositories";
import { DEMO_WINDOW } from "./mock/fixtures";
import type { Repositories } from "./repositories";
import { validateAnalysis, validateAvailability, validateDetection, validateEvent, validateScene } from "./validate";
import type { ActiveFireDetection, AnalysisResult, AvailabilityReport, SceneSummary } from "./types";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const repos = () => createMockRepositories();
const errorOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as DataError;
  }
  throw new Error("expected a rejection");
};

describe("mock repositories", () => {
  it("lists all six events and filters by window, country, source and text", async () => {
    const { events } = repos();
    expect(await events.listEvents()).toHaveLength(6);
    expect((await events.listEvents({ window: { start: "2026-08-01T00:00:00Z", end: "2026-08-31T23:59:59Z" } })).map((e) => e.id)).toEqual([
      "SYN-03",
      "SYN-05",
      "SYN-06",
    ]);
    expect((await events.listEvents({ countryIso3: "PRT" })).map((e) => e.id)).toEqual(["SYN-03"]);
    expect((await events.listEvents({ sources: ["sentinel-1"] })).map((e) => e.id)).toEqual(["SYN-03"]);
    expect((await events.listEvents({ text: "event 04" })).map((e) => e.id)).toEqual(["SYN-04"]);
    expect(await events.listEvents({ countryIso3: "FRA" })).toEqual([]);
  });

  it("returns recent events, newest last detection first", async () => {
    const recent = await repos().events.recentEvents(3);
    expect(recent.map((e) => e.id)).toEqual(["SYN-06", "SYN-05", "SYN-03"]);
  });

  it("throws not-found for unknown IDs", async () => {
    const r = repos();
    for (const p of [r.events.getEvent("NOPE"), r.scenes.getScene("NOPE"), r.availability.getAvailability("NOPE"), r.analysis.getAnalysis("NOPE")]) {
      const e = await errorOf(p);
      expect(e).toBeInstanceOf(DataError);
      expect(e.kind).toBe("not-found");
    }
  });

  it("filters detections by window, event, country and bounding box", async () => {
    const { detections } = repos();
    const all = await detections.listDetections({ window: DEMO_WINDOW });
    expect(all.detections).toHaveLength(612);
    const ev = await detections.listDetections({ window: DEMO_WINDOW, eventId: "SYN-01" });
    expect(ev.detections.every((d) => d.eventId === "SYN-01")).toBe(true);
    expect(ev.detections).toHaveLength(120);
    const short = await detections.listDetections({ window: { start: "2026-07-12T00:00:00Z", end: "2026-07-13T00:00:00Z" } });
    expect(short.detections.every((d) => d.acquiredAt >= "2026-07-12" && d.acquiredAt <= "2026-07-13T00:00:00Z")).toBe(true);
    const prt = await detections.listDetections({ window: DEMO_WINDOW, countryIso3: "PRT" });
    expect(prt.detections.length).toBeGreaterThan(110);
    const box = await detections.listDetections({ window: DEMO_WINDOW, bbox: { west: -121, south: 38.5, east: -120.2, north: 39.3 } });
    expect(box.detections.length).toBeGreaterThan(0);
    expect(box.detections.every(({ geometry: { coordinates: [lon, lat] } }) => lon >= -121 && lon <= -120.2 && lat >= 38.5 && lat <= 39.3)).toBe(true);
  });

  it("passes null values through unchanged", async () => {
    const s = await repos().scenes.getScene("SYN-02-S1");
    expect(s.polarizations).toBeNull();
    expect(s.resolution.value).toBeNull();
    expect(s.bands).toEqual([]);
  });

  it("lists countries of the synthetic events", async () => {
    expect((await repos().events.listCountries()).map((c) => c.iso3)).toEqual(["AUS", "BRA", "CAN", "GRC", "PRT", "USA"]);
  });
});

describe("http mode (no backend contract yet)", () => {
  it("every repository method reports 'unavailable' and assumes no endpoint", async () => {
    const r: Repositories = createRepositories("http");
    const calls = [
      r.events.listEvents(),
      r.events.recentEvents(5),
      r.events.getEvent("SYN-01"),
      r.events.listCountries(),
      r.detections.listDetections({ window: DEMO_WINDOW }),
      r.scenes.getScene("SYN-01-S1"),
      r.availability.getAvailability("SYN-01"),
      r.analysis.getAnalysis("SYN-01"),
    ];
    for (const p of calls) expect((await errorOf(p)).kind).toBe("unavailable");
  });
});

describe("development scenario switch", () => {
  it("reads ?mockScenario= in development", () => {
    expect(readMockScenario("?mockScenario=error")).toBe("error");
    expect(readMockScenario("?mockScenario=empty")).toBe("empty");
    expect(readMockScenario("?mockScenario=slow")).toBe("slow");
    expect(readMockScenario("?mockScenario=unavailable")).toBe("unavailable");
    expect(readMockScenario("?mockScenario=bogus")).toBe("normal");
    expect(readMockScenario("")).toBe("normal");
  });

  it("can't be enabled in production builds", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    expect(readMockScenario("?mockScenario=error")).toBe("normal");
    expect(readMockScenario("?mockScenario=unavailable")).toBe("normal");
  });

  it("error / unavailable / empty / slow behave as described", async () => {
    expect((await errorOf(createMockRepositories({ scenario: "error" }).events.listEvents())).kind).toBe("network");
    expect((await errorOf(createMockRepositories({ scenario: "unavailable" }).events.listEvents())).kind).toBe("unavailable");
    const empty = createMockRepositories({ scenario: "empty" });
    expect(await empty.events.listEvents()).toEqual([]);
    expect((await empty.detections.listDetections({ window: DEMO_WINDOW })).detections).toEqual([]);

    vi.useFakeTimers();
    let done = false;
    const slow = createMockRepositories({ scenario: "slow" }).events.listEvents().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(2900);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    await slow;
    expect(done).toBe(true);
  });
});

describe("validators reject invalid records (never repaired)", () => {
  it("rejects a FIRMS detection drawn as an area or carrying intensity", async () => {
    const d = (await repos().detections.listDetections({ window: DEMO_WINDOW })).detections[0];
    const polygon = { ...d, geometry: { type: "Polygon", coordinates: [] } } as unknown as ActiveFireDetection;
    expect(validateDetection(polygon).join()).toMatch(/must be a Point/);
    expect(validateDetection({ ...d, frp: 12 } as ActiveFireDetection).join()).toMatch(/FRP/);
  });

  it("rejects an estimate without a method and a changed area that isn't an estimate", async () => {
    const a = await repos().analysis.getAnalysis("SYN-01");
    expect(validateAnalysis({ ...a, changedArea: { ...a.changedArea, method: null } }).join()).toMatch(/needs a method/);
    expect(validateAnalysis({ ...a, changedArea: { ...a.changedArea, kind: "measured" } } as AnalysisResult).join()).toMatch(/must be kind "estimated"/);
    const locked = await repos().analysis.getAnalysis("SYN-04");
    expect(validateAnalysis({ ...locked, changedArea: { ...locked.changedArea, value: 5 } }).join()).toMatch(/only a complete analysis/);
  });

  it("rejects a pair marked suitable that breaks an invariant", async () => {
    const r = await repos().availability.getAvailability("SYN-05");
    const forged: AvailabilityReport = { ...r, pairs: [{ ...r.pairs[0], status: "suitable", reasons: [] }] };
    expect(validateAvailability(forged).join()).toMatch(/marked suitable but breaks DIFFERENT_BAND, DIFFERENT_PRODUCT/);
  });

  it("rejects Sentinel-1 with NISAR bands and a non-candidate event", async () => {
    const s = await repos().scenes.getScene("SYN-03-S1");
    const bad = { ...s, bands: ["L"], provenance: { ...s.provenance, bands: ["L"] } } as SceneSummary;
    expect(validateScene(bad).join()).toMatch(/only NISAR scenes list L\/S bands/);
    const e = await repos().events.getEvent("SYN-01");
    expect(validateEvent({ ...e, status: "confirmed" } as unknown as typeof e).join()).toMatch(/never a confirmed burned area/);
  });
});
