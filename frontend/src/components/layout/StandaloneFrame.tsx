import type { ReactNode } from "react";
import { TeamCredit } from "@/components/brand/Logo";
import { SkipLink } from "./SkipLink";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Frame for standalone pages (404, error): no header menu and
 * **no demo bar** (the demo-data label exists only inside the App Shell).
 */
export function StandaloneFrame({ children, credit = false }: { children: ReactNode; credit?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <div className="flex justify-end px-4 py-3">
        <ThemeToggle />
      </div>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col items-center px-4 pb-12 focus:outline-none">
        {children}
      </main>
      {credit && (
        <footer className="flex flex-col items-center gap-2 border-t border-border px-4 py-5 text-center">
          <TeamCredit />
          <p className="text-xs text-muted-foreground">
            Not an official NASA product. NASA and NISAR are named only as data sources.
          </p>
        </footer>
      )}
    </div>
  );
}
