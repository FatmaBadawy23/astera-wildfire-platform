import { useState, type ReactNode } from "react";
import { RouterProvider } from "react-router/dom";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

/** App-wide providers (theme, tooltips). Also used by tests around a memory router. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
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
