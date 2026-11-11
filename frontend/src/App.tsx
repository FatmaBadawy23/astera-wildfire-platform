import { useState, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "react-router/dom";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataProvider } from "@/data/DataProvider";
import { createQueryClient } from "@/data/hooks";
import type { Repositories } from "@/data/repositories";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

/**
 * App-wide providers (theme, data cache, data adapter, tooltips). Also used by tests around a memory
 * router; tests may inject their own repositories or query client.
 */
export function AppProviders({
  children,
  repositories,
  queryClient,
}: {
  children: ReactNode;
  repositories?: Repositories;
  queryClient?: QueryClient;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <DataProvider repositories={repositories}>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
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
