/** @provisional See values.ts. */

/** "synthetic" = generated for demonstration, never a satellite observation. */
export type DataOrigin = "synthetic" | "observed";

export type SourceKind = "mock-sar" | "sentinel-1" | "nisar" | "firms" | "reference";

/** NISAR frequency bands. Only bands a product actually states are listed; an empty list = not stated. */
export type NisarBand = "L" | "S";

export interface ProcessingStep {
  step: string;
  at: string | null;
  detail: string | null;
}

export interface Provenance {
  origin: DataOrigin;
  source: SourceKind;
  /** Product type exactly as stated by the source (e.g. "GCOV", "GSLC", "RTC"), or null if not stated. */
  productType: string | null;
  /** NISAR only. Empty = the band is not stated (shown as "band not available"; never guessed). */
  bands: NisarBand[];
  processing: ProcessingStep[];
  notes: string[];
}

export const SYNTHETIC_NOTE = "Synthetic example, not a satellite observation.";

/** Badge keys match the D.2 badge tokens (--aw-badge-<key>-bg / -fg). */
export type BadgeKey =
  | "mock"
  | "sentinel-1-c-band"
  | "nisar-l-band"
  | "nisar-s-band"
  | "nisar-band-not-available"
  | "firms"
  | "reference";

export const BADGE_LABELS: Record<BadgeKey, string> = {
  mock: "MOCK DATA",
  "sentinel-1-c-band": "SENTINEL-1 · C-band",
  "nisar-l-band": "NISAR · L-band",
  "nisar-s-band": "NISAR · S-band",
  "nisar-band-not-available": "NISAR · band not available",
  firms: "FIRMS",
  reference: "REFERENCE",
};

export const SOURCE_NAMES: Record<SourceKind, string> = {
  "mock-sar": "Mock SAR (synthetic)",
  "sentinel-1": "Sentinel-1 (C-band)",
  nisar: "NISAR",
  firms: "NASA FIRMS",
  reference: "Reference data",
};

/**
 * Source badges for a record (D.2 §4): MOCK DATA always first for synthetic data; Sentinel-1 is always
 * C-band and never NISAR; NISAR L and S are separate badges; a NISAR product without a stated band gets
 * "band not available".
 */
export function provenanceBadges(p: Provenance): BadgeKey[] {
  const keys: BadgeKey[] = [];
  if (p.origin === "synthetic") keys.push("mock");
  switch (p.source) {
    case "sentinel-1":
      keys.push("sentinel-1-c-band");
      break;
    case "nisar":
      if (p.bands.length === 0) keys.push("nisar-band-not-available");
      if (p.bands.includes("L")) keys.push("nisar-l-band");
      if (p.bands.includes("S")) keys.push("nisar-s-band");
      break;
    case "firms":
      keys.push("firms");
      break;
    case "reference":
      keys.push("reference");
      break;
    case "mock-sar":
      if (!keys.includes("mock")) keys.push("mock");
      break;
  }
  return keys;
}
