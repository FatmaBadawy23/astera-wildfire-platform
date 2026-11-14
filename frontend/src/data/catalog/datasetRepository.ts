/**
 * Dataset catalog repository: what the pages use to read the catalog. Today one adapter serves the catalog built
 * from the definitions in this folder. A backend adapter (a datasets API) can replace it without changing any page.
 */
import { DataError } from "@/data/errors";
import type { DataSourceEntry, DatasetEntry } from "@/data/types";
import { buildCatalog, validateCatalog, type Catalog } from "./catalog";

export interface DatasetCatalogRepository {
  /** Catalog version, shown on the catalog page. */
  readonly version: string;
  /** True when demo datasets are included (demo data mode). */
  readonly includesDemo: boolean;
  listDatasets(): Promise<DatasetEntry[]>;
  /** Throws DataError("not-found") for IDs that are not accessible datasets (unconnected sources included). */
  getDataset(id: string): Promise<DatasetEntry>;
  /** Known sources that are not connected: never datasets, never linkable. */
  listSources(): Promise<DataSourceEntry[]>;
}

export function createStaticCatalogRepository({ includeDemo, catalog }: { includeDemo: boolean; catalog?: Catalog }): DatasetCatalogRepository {
  const c = catalog ?? buildCatalog({ includeDemo });
  if (import.meta.env.DEV) {
    const problems = validateCatalog(c);
    if (problems.length) console.error(`Dataset catalog has ${problems.length} problem(s):\n${problems.join("\n")}`);
  }
  return {
    version: c.version,
    includesDemo: c.datasets.some((d) => d.access === "demo"),
    async listDatasets() {
      return c.datasets;
    },
    async getDataset(id) {
      const d = c.datasets.find((x) => x.id === id);
      if (!d) {
        const source = c.sources.find((s) => s.id === id);
        throw new DataError(
          "not-found",
          source ? `“${source.name}” is a source that is not connected yet, so it has no datasets to use.` : `There is no dataset “${id}” in the current catalog.`,
        );
      }
      return d;
    },
    async listSources() {
      return c.sources;
    },
  };
}
