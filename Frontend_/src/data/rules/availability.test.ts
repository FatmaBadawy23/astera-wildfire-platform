import { describe, expect, it } from "vitest";
import { AVAILABILITY, SCENES } from "../mock/fixtures";
import type { AvailabilityReport, SceneSummary } from "../types";
import { canPairBeSuitable, isAnalysisAllowed, pairInvariantViolations, PAIR_REASON_TEXT } from "./availability";

const base = (id: string) => structuredClone(SCENES.find((s) => s.id === id)!);
const pre = () => base("SYN-01-S1");
const post = () => base("SYN-01-S2");

describe("pair invariants (frontend never accepts impossible pairs)", () => {
  it("a matching NISAR L-band GCOV pair has no violations", () => {
    expect(pairInvariantViolations(pre(), post())).toEqual([]);
    expect(canPairBeSuitable(pre(), post())).toBe(true);
  });

  it("different sensors (Sentinel-1 C-band vs NISAR) are never comparable", () => {
    expect(pairInvariantViolations(base("SYN-03-S1"), post())).toContain("DIFFERENT_SENSOR");
  });

  it("different NISAR bands (L vs S) are never comparable", () => {
    const s = post();
    s.bands = ["S"];
    s.provenance.bands = ["S"];
    expect(pairInvariantViolations(pre(), s)).toContain("DIFFERENT_BAND");
  });

  it("GCOV and GSLC are never mixed", () => {
    const s = post();
    s.provenance.productType = "GSLC";
    expect(pairInvariantViolations(pre(), s)).toContain("DIFFERENT_PRODUCT");
  });

  it("the post-fire scene must be later than the pre-fire scene", () => {
    expect(pairInvariantViolations(post(), pre())).toContain("DATE_ORDER");
  });

  it("no common polarization is a mismatch", () => {
    const s = post();
    s.polarizations = ["VV"];
    expect(pairInvariantViolations(pre(), s)).toContain("POLARIZATION_MISMATCH");
  });

  it("missing band, product, date or polarization is missing metadata, never a guess", () => {
    for (const mutate of [
      (s: SceneSummary) => ((s.bands = []), (s.provenance.bands = [])),
      (s: SceneSummary) => (s.provenance.productType = null),
      (s: SceneSummary) => (s.acquiredAt = null),
      (s: SceneSummary) => (s.polarizations = null),
    ]) {
      const s = post();
      mutate(s);
      expect(pairInvariantViolations(pre(), s)).toContain("METADATA_MISSING");
    }
  });
});

describe("isAnalysisAllowed", () => {
  it.each([
    ["SYN-01", true],
    ["SYN-02", false],
    ["SYN-03", true],
    ["SYN-04", false],
    ["SYN-05", false],
    ["SYN-06", true],
  ])("%s → %s", (eventId, allowed) => {
    expect(isAnalysisAllowed(AVAILABILITY.find((r) => r.eventId === eventId)!)).toBe(allowed);
  });

  it("refuses a pair reported 'suitable' that breaks an invariant", () => {
    const r: AvailabilityReport = structuredClone(AVAILABILITY.find((x) => x.eventId === "SYN-05")!);
    r.pairs[0] = { ...r.pairs[0], status: "suitable", reasons: [] };
    expect(isAnalysisAllowed(r)).toBe(false);
  });

  it("refuses a 'suitable' pair with a missing scene", () => {
    const r: AvailabilityReport = structuredClone(AVAILABILITY.find((x) => x.eventId === "SYN-01")!);
    r.postScenes = [];
    expect(isAnalysisAllowed(r)).toBe(false);
  });

  it("every reason code has plain-language text", () => {
    for (const text of Object.values(PAIR_REASON_TEXT)) expect(text).toMatch(/\.$/);
  });
});
