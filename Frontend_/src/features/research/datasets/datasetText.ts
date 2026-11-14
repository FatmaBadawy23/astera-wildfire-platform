/** Plain-language text for dataset metadata (no components; shared by the catalog, details and project pages). */
import { isDemoBased } from "@/data/catalog/catalog";
import type { DatasetDate, DatasetEntry } from "@/data/types";
import { NOT_AVAILABLE, formatDateTimeUtc, formatDateUtc, formatWindow } from "@/lib/format";

export const DATASETS_PATH = "/research/data";
export const datasetPath = (id: string) => `${DATASETS_PATH}/${encodeURIComponent(id)}`;

/** The class a person sees first. "Derived from demo data" whenever any input is demo data. */
export type DatasetClass = "real" | "demo" | "derived-demo" | "derived";

export const CLASS_LABELS: Record<DatasetClass, string> = {
  real: "Real data",
  demo: "Demo data (invented)",
  "derived-demo": "Derived from demo data",
  derived: "Derived data",
};

export const CLASS_GROUP_TITLES: Record<DatasetClass, string> = {
  real: "Real data in the app",
  demo: "Demo data (invented)",
  "derived-demo": "Derived from demo data",
  derived: "Derived data",
};

export const CLASS_ORDER: DatasetClass[] = ["real", "derived", "demo", "derived-demo"];

export function datasetClass(d: DatasetEntry, all: DatasetEntry[]): DatasetClass {
  if (d.origin === "real") return "real";
  if (d.origin === "synthetic") return "demo";
  return isDemoBased(d, all) ? "derived-demo" : "derived";
}

const DATE_KIND_LABELS: Record<DatasetDate["kind"], string> = { acquired: "Acquired", downloaded: "Downloaded", generated: "Generated" };

/** "Downloaded 2026-11-13" / "Acquired 2026-07-03 13:42 UTC (Invented demo date)". */
export function dateText(d: DatasetDate): string {
  const value = d.value ? (d.value.length <= 10 ? formatDateUtc(d.value) : formatDateTimeUtc(d.value)) : NOT_AVAILABLE;
  return `${DATE_KIND_LABELS[d.kind]} ${value}${d.note ? ` (${d.note})` : ""}`;
}

export function coverageText(d: DatasetEntry, nameOf: (iso: string) => string): string | null {
  const parts = [d.spatialCoverage.description, d.spatialCoverage.countriesIso3.length ? d.spatialCoverage.countriesIso3.map(nameOf).join(", ") : null].filter(Boolean);
  return parts.length ? parts.join(": ") : null;
}

export function bboxText(d: DatasetEntry): string | null {
  const b = d.spatialCoverage.bbox;
  if (!b) return null;
  const f = (n: number) => n.toFixed(2);
  return `West ${f(b.west)}°, south ${f(b.south)}°, east ${f(b.east)}°, north ${f(b.north)}°`;
}

export const periodText = (d: DatasetEntry): string | null => (d.temporalCoverage ? formatWindow(d.temporalCoverage) : null);

/** Global datasets (no country list, world box) cover every country. */
export function coversCountry(d: DatasetEntry, iso3: string): boolean {
  return d.spatialCoverage.countriesIso3.length === 0 ? isGlobal(d) : d.spatialCoverage.countriesIso3.includes(iso3);
}

export const isGlobal = (d: DatasetEntry) => {
  const b = d.spatialCoverage.bbox;
  return !!b && b.west <= -180 && b.east >= 180 && b.south <= -85 && b.north >= 85;
};
