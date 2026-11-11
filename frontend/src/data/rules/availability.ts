import type { AvailabilityReport, PairReason, SceneSummary } from "../types";

/**
 * Frontend scientific INVARIANTS only: conditions under which a pre/post pair can never be suitable.
 * Deciding that a pair IS suitable is the data source's job (backend in Stage 5+); the frontend only
 * refuses pairs that break these rules (PLAN §4.D; docs/design/README.md scientific rules).
 */
export function pairInvariantViolations(pre: SceneSummary, post: SceneSummary): PairReason[] {
  const reasons = new Set<PairReason>();

  // Different sensors (e.g. Sentinel-1 C-band vs NISAR L/S) are never compared directly.
  if (pre.sensor !== post.sensor) reasons.add("DIFFERENT_SENSOR");

  // NISAR bands must be stated and identical; a missing band is missing metadata, never a guess.
  if (pre.sensor === "NISAR" && post.sensor === "NISAR") {
    if (pre.bands.length === 0 || post.bands.length === 0) reasons.add("METADATA_MISSING");
    else if ([...pre.bands].sort().join() !== [...post.bands].sort().join()) reasons.add("DIFFERENT_BAND");
  }

  // GCOV and GSLC (or any different product types) are processed separately.
  const preProduct = pre.provenance.productType;
  const postProduct = post.provenance.productType;
  if (preProduct === null || postProduct === null) reasons.add("METADATA_MISSING");
  else if (preProduct !== postProduct) reasons.add("DIFFERENT_PRODUCT");

  // The post-fire scene must be acquired after the pre-fire scene.
  if (pre.acquiredAt === null || post.acquiredAt === null) reasons.add("METADATA_MISSING");
  else if (Date.parse(post.acquiredAt) <= Date.parse(pre.acquiredAt)) reasons.add("DATE_ORDER");

  // At least one polarization in common.
  if (pre.polarizations === null || post.polarizations === null) reasons.add("METADATA_MISSING");
  else if (!pre.polarizations.some((p) => post.polarizations!.includes(p))) reasons.add("POLARIZATION_MISMATCH");

  return [...reasons];
}

export function canPairBeSuitable(pre: SceneSummary, post: SceneSummary): boolean {
  return pairInvariantViolations(pre, post).length === 0;
}

/**
 * Analysis is allowed only if at least one pair is reported "suitable" AND both of its scenes exist
 * AND it breaks none of the invariants.
 */
export function isAnalysisAllowed(report: AvailabilityReport): boolean {
  const scenes = new Map([...report.preScenes, ...report.postScenes].map((s) => [s.id, s]));
  return report.pairs.some((pair) => {
    if (pair.status !== "suitable" || !pair.preSceneId || !pair.postSceneId) return false;
    const pre = scenes.get(pair.preSceneId);
    const post = scenes.get(pair.postSceneId);
    return !!pre && !!post && canPairBeSuitable(pre, post);
  });
}

/** Plain-language text for each reason code. */
export const PAIR_REASON_TEXT: Record<PairReason, string> = {
  NO_PRE_SCENE: "No pre-fire scene was found.",
  NO_POST_SCENE: "No post-fire scene was found.",
  DIFFERENT_SENSOR: "The scenes come from different sensors and can't be compared directly.",
  DIFFERENT_BAND: "The scenes use different frequency bands.",
  DIFFERENT_PRODUCT: "The scenes are different product types (for example GCOV and GSLC).",
  POLARIZATION_MISMATCH: "The scenes have no polarization in common.",
  INSUFFICIENT_COVERAGE: "The scenes don't cover enough of the event area.",
  METADATA_MISSING: "Required metadata is missing, so suitability can't be confirmed.",
  DATE_ORDER: "The post-fire scene isn't later than the pre-fire scene.",
  QUALITY_FLAG: "A quality flag marks a scene as unsuitable.",
};
