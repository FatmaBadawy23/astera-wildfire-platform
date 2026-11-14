/**
 * Dataset catalog: assembles the definitions (definitions/*) and checks them. The UI never hard-codes datasets; it
 * reads whatever the catalog repository returns. To add, update or remove a dataset, edit a definitions file (or, later,
 * the backend) and keep IDs stable: projects store dataset IDs.
 */
import type { DataSourceEntry, DatasetEntry } from "@/data/types";
import { demoDatasets } from "./definitions/demo";
import { NATURAL_EARTH_DATASETS } from "./definitions/naturalEarth";
import { NOT_CONNECTED_SOURCES } from "./definitions/sources";

/** Bump when the shape or meaning of catalog entries changes. */
export const CATALOG_VERSION = "r3-draft-1";

export interface Catalog {
  version: string;
  datasets: DatasetEntry[];
  sources: DataSourceEntry[];
}

/** The catalog for a data mode: reference data always; demo data only in demo mode; unconnected sources always. */
export function buildCatalog({ includeDemo }: { includeDemo: boolean }): Catalog {
  return {
    version: CATALOG_VERSION,
    datasets: [...NATURAL_EARTH_DATASETS, ...(includeDemo ? demoDatasets() : [])],
    sources: NOT_CONNECTED_SOURCES,
  };
}

export const DATASET_ID = /^[a-z0-9][a-z0-9._-]{1,99}$/i;

/**
 * Rules every catalog must follow (checked by unit tests and, in development, when the catalog is built). Returns the
 * problems found; an empty list means the catalog is consistent.
 */
export function validateCatalog(c: Catalog): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const datasetIds = new Set(c.datasets.map((d) => d.id));
  for (const d of [...c.datasets, ...c.sources]) {
    if (!DATASET_ID.test(d.id)) problems.push(`${d.id}: invalid ID`);
    if (ids.has(d.id)) problems.push(`${d.id}: duplicate ID`);
    ids.add(d.id);
  }
  for (const d of c.datasets) {
    const p = `${d.id}:`;
    if (!d.title.trim() || !d.description.trim()) problems.push(`${p} title and description are required`);
    if (d.origin === "synthetic" && (d.access !== "demo" || d.provenance?.origin !== "synthetic")) problems.push(`${p} synthetic data must be demo access with synthetic provenance`);
    if (d.origin === "real" && (d.access === "demo" || d.provenance?.origin === "synthetic")) problems.push(`${p} real data can't be demo or synthetic`);
    if (d.origin === "derived") {
      if (d.derivedFrom.length === 0) problems.push(`${p} derived data must name its inputs`);
      for (const i of d.derivedFrom) if (!datasetIds.has(i)) problems.push(`${p} input ${i} is not in the catalog`);
    } else if (d.derivedFrom.length) problems.push(`${p} only derived data has inputs`);
    if (d.acquisitionDate && d.acquisitionDate.kind !== "acquired") problems.push(`${p} acquisitionDate must be of kind "acquired"`);
    if (d.dates.some((x) => x.kind === "acquired")) problems.push(`${p} acquisition dates belong in acquisitionDate`);
    if (d.access === "demo" && d.origin === "real") problems.push(`${p} demo access must not be real data`);
    if (d.access === "demo" && d.licence) problems.push(`${p} demo data has no licence`);
  }
  for (const s of c.sources) if (s.status !== "not-connected") problems.push(`${s.id}: sources are listed only while not connected`);
  return problems;
}

/** True when a dataset is demo data itself or is derived (directly or indirectly) from demo data. */
export function isDemoBased(d: DatasetEntry, all: DatasetEntry[], seen = new Set<string>()): boolean {
  if (d.origin === "synthetic" || d.access === "demo") return true;
  if (seen.has(d.id)) return false;
  seen.add(d.id);
  return d.derivedFrom.some((id) => {
    const input = all.find((x) => x.id === id);
    return input ? isDemoBased(input, all, seen) : false;
  });
}
