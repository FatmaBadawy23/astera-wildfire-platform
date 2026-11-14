import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDataMode } from "@/app/env";
import { createStaticCatalogRepository, type DatasetCatalogRepository } from "./datasetRepository";

const CatalogContext = createContext<DatasetCatalogRepository | null>(null);

/**
 * Provides the dataset catalog. Demo data mode: reference data + demo datasets. "http" mode: reference data only
 * (no backend catalog exists yet). Tests may pass their own repository; a backend adapter can be passed here later.
 */
export function CatalogProvider({ repository, children }: { repository?: DatasetCatalogRepository; children: ReactNode }) {
  const [repo] = useState(() => repository ?? createStaticCatalogRepository({ includeDemo: getDataMode() === "mock" }));
  return <CatalogContext.Provider value={repo}>{children}</CatalogContext.Provider>;
}

export function useCatalogRepository(): DatasetCatalogRepository {
  const repo = useContext(CatalogContext);
  if (!repo) throw new Error("useCatalogRepository must be used inside <CatalogProvider>");
  return repo;
}

export function useDatasets() {
  const repo = useCatalogRepository();
  return useQuery({ queryKey: ["catalog", "datasets"], queryFn: () => repo.listDatasets(), retry: false });
}

export function useDataset(id: string) {
  const repo = useCatalogRepository();
  return useQuery({ queryKey: ["catalog", "dataset", id], queryFn: () => repo.getDataset(id), retry: false });
}

export function useDataSources() {
  const repo = useCatalogRepository();
  return useQuery({ queryKey: ["catalog", "sources"], queryFn: () => repo.listSources(), retry: false });
}
