/**
 * Runtime checks for records returned by any adapter. Problems are reported, never repaired:
 * a record that fails becomes a DataError("invalid-response").
 */
import { DataError } from "./errors";
import { pairInvariantViolations } from "./rules/availability";
import type {
  ActiveFireDetection,
  AnalysisResult,
  AvailabilityReport,
  FireEvent,
  Provenance,
  SceneSummary,
  SciValue,
} from "./types";

const ORIGINS = ["synthetic", "observed"];
const SOURCES = ["mock-sar", "sentinel-1", "nisar", "firms", "reference"];
const KINDS = ["measured", "derived", "estimated", "placeholder"];

const isIso = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));

export function validateProvenance(p: Provenance | undefined, at: string): string[] {
  const issues: string[] = [];
  if (!p) return [`${at}: provenance missing`];
  if (!ORIGINS.includes(p.origin)) issues.push(`${at}: invalid origin "${p.origin}"`);
  if (!SOURCES.includes(p.source)) issues.push(`${at}: invalid source "${p.source}"`);
  if (!Array.isArray(p.bands) || p.bands.some((b) => b !== "L" && b !== "S")) issues.push(`${at}: NISAR bands must be L and/or S`);
  if (p.source !== "nisar" && p.bands.length > 0) issues.push(`${at}: bands are only valid for NISAR`);
  if (new Set(p.bands).size !== p.bands.length) issues.push(`${at}: duplicate band`);
  return issues;
}

export function validateSciValue(v: SciValue<unknown> | undefined, at: string): string[] {
  if (!v) return [`${at}: value missing`];
  const issues: string[] = [];
  if (!KINDS.includes(v.kind)) issues.push(`${at}: invalid kind "${v.kind}"`);
  if (v.kind === "placeholder" && v.value !== null) issues.push(`${at}: a placeholder must not carry a value`);
  if (v.kind === "estimated" && v.value !== null && !v.method) issues.push(`${at}: an estimated value needs a method`);
  if (typeof v.value === "number" && !Number.isFinite(v.value)) issues.push(`${at}: value is not a finite number`);
  return issues;
}

export function validateEvent(e: FireEvent): string[] {
  const at = `event ${e.id}`;
  const issues = [...validateProvenance(e.provenance, at), ...validateSciValue(e.detectionCount, `${at}.detectionCount`)];
  if (e.status !== "candidate") issues.push(`${at}: status must be "candidate" (never a confirmed burned area)`);
  if (e.firstDetection !== null && !isIso(e.firstDetection)) issues.push(`${at}: invalid firstDetection`);
  if (e.lastDetection !== null && !isIso(e.lastDetection)) issues.push(`${at}: invalid lastDetection`);
  if (!/^[A-Z]{3}$/.test(e.country.iso3)) issues.push(`${at}: country must be ISO alpha-3`);
  return issues;
}

export function validateDetection(d: ActiveFireDetection): string[] {
  const at = `detection ${d.id}`;
  const issues = validateProvenance(d.provenance, at);
  if (d.provenance.source !== "firms") issues.push(`${at}: detections must come from FIRMS`);
  if (d.geometry?.type !== "Point") issues.push(`${at}: a FIRMS detection must be a Point (never an area)`);
  const [lon, lat] = d.geometry?.coordinates ?? [NaN, NaN];
  if (!(lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90)) issues.push(`${at}: coordinates out of range`);
  if (!isIso(d.acquiredAt)) issues.push(`${at}: invalid acquiredAt`);
  if ("frp" in d) issues.push(`${at}: intensity (FRP) must not be carried into the UI`);
  return issues;
}

export function validateScene(s: SceneSummary): string[] {
  const at = `scene ${s.id}`;
  const issues = [
    ...validateProvenance(s.provenance, at),
    ...validateSciValue(s.eventCoverage, `${at}.eventCoverage`),
    ...validateSciValue(s.resolution, `${at}.resolution`),
  ];
  const expected = { NISAR: "nisar", "Sentinel-1": "sentinel-1", "Mock SAR": "mock-sar" }[s.sensor];
  if (s.provenance.source !== expected) issues.push(`${at}: sensor ${s.sensor} must have source ${expected}`);
  if (s.sensor !== "NISAR" && s.bands.length > 0) issues.push(`${at}: only NISAR scenes list L/S bands (Sentinel-1 is C-band)`);
  if (s.bands.join() !== s.provenance.bands.join()) issues.push(`${at}: bands differ from provenance`);
  if (s.acquiredAt !== null && !isIso(s.acquiredAt)) issues.push(`${at}: invalid acquiredAt`);
  return issues;
}

export function validateAvailability(r: AvailabilityReport): string[] {
  const at = `availability ${r.eventId}`;
  const issues = [...validateProvenance(r.provenance, at), ...[...r.preScenes, ...r.postScenes].flatMap(validateScene)];
  const scenes = new Map([...r.preScenes, ...r.postScenes].map((s) => [s.id, s]));
  for (const p of r.pairs) {
    for (const id of [p.preSceneId, p.postSceneId]) {
      if (id !== null && !scenes.has(id)) issues.push(`${at}: pair ${p.id} references unknown scene ${id}`);
    }
    if (p.status === "suitable") {
      const pre = p.preSceneId ? scenes.get(p.preSceneId) : undefined;
      const post = p.postSceneId ? scenes.get(p.postSceneId) : undefined;
      if (!pre || !post) issues.push(`${at}: suitable pair ${p.id} needs both scenes`);
      else {
        const broken = pairInvariantViolations(pre, post);
        if (broken.length) issues.push(`${at}: pair ${p.id} is marked suitable but breaks ${broken.join(", ")}`);
      }
      if (p.reasons.length) issues.push(`${at}: suitable pair ${p.id} must not list reasons`);
    } else if (p.reasons.length === 0) {
      issues.push(`${at}: ${p.status} pair ${p.id} needs at least one reason`);
    }
  }
  return issues;
}

export function validateAnalysis(a: AnalysisResult): string[] {
  const at = `analysis ${a.id}`;
  const issues = [
    ...validateProvenance(a.provenance, at),
    ...validateSciValue(a.meanChangeDb, `${at}.meanChangeDb`),
    ...validateSciValue(a.changedArea, `${at}.changedArea`),
  ];
  if (a.changedArea.kind !== "estimated") issues.push(`${at}: changed area must be kind "estimated"`);
  if (a.changedArea.unit !== "km²") issues.push(`${at}: changed area must be in km²`);
  if (a.status !== "complete" && (a.changedArea.value !== null || a.meanChangeDb.value !== null))
    issues.push(`${at}: only a complete analysis may carry result values`);
  if ((a.status === "locked" || a.status === "failed") && !a.statusReason) issues.push(`${at}: ${a.status} needs a reason`);
  return issues;
}

/** Throws DataError("invalid-response") listing every problem. */
export function assertValid(issues: string[], what: string): void {
  if (issues.length) throw new DataError("invalid-response", `Invalid ${what} data`, issues);
}
