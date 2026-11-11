/**
 * @provisional Stage F frontend types. They describe what the pages need, not a backend API, and are
 * replaced/mapped once the Stage 1 contracts exist (docs/ROADMAP.md, Stage 1 and Stage 7).
 */
export const PROVISIONAL_CONTRACT_VERSION = "f3-provisional-1";

/** How a value was produced. Shown next to every scientific value. */
export type ValueKind = "measured" | "derived" | "estimated" | "placeholder";

export const VALUE_KIND_DEFINITIONS: Record<ValueKind, { label: string; definition: string }> = {
  measured: { label: "Measured", definition: "Taken directly from source metadata or an observation." },
  derived: { label: "Derived", definition: "Computed exactly from measured values, for example a dB difference or a detection count." },
  estimated: { label: "Estimated", definition: "Produced by a model or threshold, with uncertainty, for example changed area." },
  placeholder: { label: "Placeholder", definition: "Not produced yet. No value is shown." },
};

/** Uncertainty as a range in the same unit as the value. Unknown bounds stay null. */
export interface Uncertainty {
  lower: number | null;
  upper: number | null;
  description: string | null;
}

/**
 * A scientific value. `value: null` means not available and is shown as "Not available"; it is never
 * replaced by an invented number.
 */
export interface SciValue<T = number> {
  value: T | null;
  kind: ValueKind;
  unit: string | null;
  method?: string | null;
  uncertainty?: Uncertainty | null;
  /** Why the value is missing, when known. */
  missingReason?: string | null;
}
