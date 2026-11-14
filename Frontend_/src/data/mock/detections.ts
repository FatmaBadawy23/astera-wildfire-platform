/**
 * SYNTHETIC FIRMS-style detections, generated deterministically from a fixed seed (same output on every
 * run). They are demonstration points, not satellite observations.
 */
import { SYNTHETIC_NOTE, type ActiveFireDetection, type GeoPoint, type Provenance } from "../types";

/** Mulberry32: small deterministic PRNG. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SYNTHETIC_FIRMS_PROVENANCE: Provenance = {
  origin: "synthetic",
  source: "firms",
  productType: null,
  bands: [],
  processing: [{ step: "Generated from a fixed seed for demonstration", at: null, detail: "Stage F3 mock fixtures" }],
  notes: [SYNTHETIC_NOTE, "FIRMS-style detection points; a detection is a point, not a burned area."],
};

export interface DetectionSeed {
  eventId: string | null;
  center: GeoPoint;
  /** Spread around the center, in degrees. */
  spread: number;
  start: string;
  end: string;
  count: number;
}

const SATELLITES = [
  ["Suomi NPP", "VIIRS"],
  ["NOAA-20", "VIIRS"],
  ["Aqua", "MODIS"],
] as const;
const CONFIDENCE = ["low", "nominal", "high"] as const;

export function generateDetections(seeds: DetectionSeed[], seed = 20260701): ActiveFireDetection[] {
  const rand = seededRandom(seed);
  const out: ActiveFireDetection[] = [];
  seeds.forEach((s, si) => {
    const t0 = Date.parse(s.start);
    const t1 = Date.parse(s.end);
    for (let i = 0; i < s.count; i++) {
      // Roughly clustered around the center (sum of two uniforms).
      const dx = (rand() + rand() - 1) * s.spread;
      const dy = (rand() + rand() - 1) * s.spread;
      const t = new Date(t0 + Math.floor(rand() * (t1 - t0)));
      t.setUTCSeconds(0, 0);
      const [satellite, instrument] = SATELLITES[Math.floor(rand() * SATELLITES.length)];
      const confidence = rand() < 0.08 ? null : CONFIDENCE[Math.floor(rand() * CONFIDENCE.length)];
      out.push({
        id: `SYN-D-${String(si + 1).padStart(2, "0")}-${String(i + 1).padStart(3, "0")}`,
        eventId: s.eventId,
        geometry: { type: "Point", coordinates: [round(s.center.lon + dx), round(s.center.lat + dy)] },
        acquiredAt: t.toISOString(),
        satellite,
        instrument,
        confidence,
        provenance: SYNTHETIC_FIRMS_PROVENANCE,
      });
    }
  });
  return out;
}

const round = (v: number) => Math.round(v * 10000) / 10000;
