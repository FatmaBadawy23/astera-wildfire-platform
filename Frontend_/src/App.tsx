import { useState, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "react-router/dom";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataProvider } from "@/data/DataProvider";
import { createQueryClient } from "@/data/hooks";
import { CatalogProvider } from "@/data/catalog/CatalogProvider";
import type { DatasetCatalogRepository } from "@/data/catalog/datasetRepository";
import type { Repositories } from "@/data/repositories";
import type { ResearchProjectRepository } from "@/data/research/projectRepository";
import { ResearchProvider } from "@/data/research/ResearchProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

/**
 * App-wide providers (theme, data cache, data adapter, tooltips). Also used by tests around a memory
 * router; tests may inject their own repositories or query client.
 */
export function AppProviders({
  children,
  repositories,
  queryClient,
  projectRepository,
  catalogRepository,
}: {
  children: ReactNode;
  repositories?: Repositories;
  queryClient?: QueryClient;
  projectRepository?: ResearchProjectRepository;
  catalogRepository?: DatasetCatalogRepository;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <DataProvider repositories={repositories}>
          <CatalogProvider repository={catalogRepository}>
            <ResearchProvider repository={projectRepository}>
              <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
            </ResearchProvider>
          </CatalogProvider>
        </DataProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export function App() {
  const [router] = useState(createAppRouter);
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
