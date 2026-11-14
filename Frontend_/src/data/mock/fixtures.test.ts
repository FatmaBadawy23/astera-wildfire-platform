import { describe, expect, it } from "vitest";
import { provenanceBadges, SYNTHETIC_NOTE } from "../types";
import { validateAnalysis, validateAvailability, validateDetection, validateEvent, validateScene } from "../validate";
import { generateDetections } from "./detections";
import { ANALYSES, AVAILABILITY, DETECTIONS, EVENTS, SCENES, SIMULATED_NOTE } from "./fixtures";

const ALL_PROVENANCES = [
  ...EVENTS.map((e) => e.provenance),
  ...DETECTIONS.map((d) => d.provenance),
  ...SCENES.map((s) => s.provenance),
  ...AVAILABILITY.map((a) => a.provenance),
  ...ANALYSES.map((a) => a.provenance),
];

describe("synthetic fixtures are always labelled", () => {
  it("every record is synthetic, carries the synthetic note and shows MOCK DATA first", () => {
    for (const p of ALL_PROVENANCES) {
      expect(p.origin).toBe("synthetic");
      expect(p.notes).toContain(SYNTHETIC_NOTE);
      expect(provenanceBadges(p)[0]).toBe("mock");
    }
  });

  it("every ID starts with SYN- and every event name says 'Synthetic demo event'", () => {
    const ids = [...EVENTS, ...DETECTIONS, ...SCENES, ...ANALYSES].map((r) => r.id);
    for (const id of ids) expect(id).toMatch(/^SYN-/);
    for (const e of EVENTS) expect(e.name).toMatch(/^Synthetic demo event \d{2}$/);
  });

  it("all SAR scenes carry the 'Simulated metadata' note", () => {
    for (const s of SCENES) expect(s.provenance.notes).toContain(SIMULATED_NOTE);
  });
});

describe("fixture contents pass the runtime validators", () => {
  it.each([
    ["events", EVENTS, validateEvent],
    ["detections", DETECTIONS, validateDetection],
    ["scenes", SCENES, validateScene],
    ["availability", AVAILABILITY, validateAvailability],
    ["analyses", ANALYSES, validateAnalysis],
  ] as const)("%s: no issues", (_name, records, validate) => {
    const issues = (records as readonly unknown[]).flatMap((r) => (validate as (x: unknown) => string[])(r));
    expect(issues).toEqual([]);
  });
});

describe("events and detections", () => {
  it("has six candidate events (never confirmed burned areas)", () => {
    expect(EVENTS.map((e) => e.id)).toEqual(["SYN-01", "SYN-02", "SYN-03", "SYN-04", "SYN-05", "SYN-06"]);
    for (const e of EVENTS) expect(e.status).toBe("candidate");
  });

  it("detection counts are derived exactly from the assigned detections", () => {
    for (const e of EVENTS) {
      expect(e.detectionCount.kind).toBe("derived");
      expect(e.detectionCount.value).toBe(DETECTIONS.filter((d) => d.eventId === e.id).length);
    }
  });

  it("FIRMS detections are points without intensity (FRP)", () => {
    for (const d of DETECTIONS) {
      expect(d.geometry.type).toBe("Point");
      expect(d).not.toHaveProperty("frp");
      expect(d.provenance.source).toBe("firms");
    }
  });

  it("detections are deterministic (same seed, same output)", () => {
    const seeds = [{ eventId: "SYN-X", center: { lon: 0, lat: 0 }, spread: 1, start: "2026-07-01T00:00:00Z", end: "2026-07-02T00:00:00Z", count: 25 }];
    expect(generateDetections(seeds)).toEqual(generateDetections(seeds));
    expect(DETECTIONS).toHaveLength(612);
  });
});

describe("scenes: bands and missing metadata", () => {
  it("Sentinel-1 scenes have no NISAR bands and are badged C-band, never NISAR", () => {
    for (const s of SCENES.filter((x) => x.sensor === "Sentinel-1")) {
      expect(s.bands).toEqual([]);
      const badges = provenanceBadges(s.provenance);
      expect(badges).toContain("sentinel-1-c-band");
      expect(badges.some((b) => b.startsWith("nisar"))).toBe(false);
    }
  });

  it("a NISAR product without a stated band shows 'band not available' (never guessed)", () => {
    const s = SCENES.find((x) => x.id === "SYN-02-S1")!;
    expect(s.bands).toEqual([]);
    expect(provenanceBadges(s.provenance)).toEqual(["mock", "nisar-band-not-available"]);
  });

  it("missing metadata stays null (never filled in)", () => {
    const s = SCENES.find((x) => x.id === "SYN-02-S1")!;
    expect(s.polarizations).toBeNull();
    expect(s.resolution.value).toBeNull();
    expect(s.eventCoverage.value).toBeNull();
    expect(s.crs).toBeNull();
    expect(s.qualityFlags).toBeNull();
    expect(s.orbitDirection).toBeNull();
  });

  it("L-band and S-band scenes are separate badges", () => {
    expect(provenanceBadges(SCENES.find((x) => x.id === "SYN-05-S1")!.provenance)).toEqual(["mock", "nisar-l-band"]);
    expect(provenanceBadges(SCENES.find((x) => x.id === "SYN-05-S2")!.provenance)).toEqual(["mock", "nisar-s-band"]);
  });
});

describe("six scenarios", () => {
  const status = (id: string) => AVAILABILITY.find((a) => a.eventId === id)!.pairs.map((p) => [p.status, p.reasons]);
  const analysis = (id: string) => ANALYSES.find((a) => a.eventId === id)!;

  it("availability per scenario", () => {
    expect(status("SYN-01")).toEqual([["suitable", []]]);
    expect(status("SYN-02")).toEqual([["unsuitable", ["METADATA_MISSING"]]]);
    expect(status("SYN-03")).toEqual([["suitable", []]]);
    expect(status("SYN-04")).toEqual([["missing", ["NO_PRE_SCENE"]]]);
    expect(status("SYN-05")).toEqual([["unsuitable", ["DIFFERENT_BAND", "DIFFERENT_PRODUCT"]]]);
    expect(status("SYN-06")).toEqual([["suitable", []]]);
  });

  it("analysis per scenario: changed area is always an estimate; no values without a complete run", () => {
    expect(ANALYSES.map((a) => [a.eventId, a.status])).toEqual([
      ["SYN-01", "complete"],
      ["SYN-02", "locked"],
      ["SYN-03", "complete"],
      ["SYN-04", "locked"],
      ["SYN-05", "locked"],
      ["SYN-06", "failed"],
    ]);
    for (const a of ANALYSES) {
      expect(a.changedArea.kind).toBe("estimated");
      expect(a.changedArea.unit).toBe("km²");
      if (a.status === "complete") {
        expect(a.changedArea.method).toBeTruthy();
        expect(a.changedArea.uncertainty?.lower).not.toBeNull();
      } else {
        expect(a.changedArea.value).toBeNull();
        expect(a.meanChangeDb.value).toBeNull();
        expect(a.statusReason).toBeTruthy();
      }
    }
    expect(analysis("SYN-03").provenance.source).toBe("sentinel-1");
  });
});
