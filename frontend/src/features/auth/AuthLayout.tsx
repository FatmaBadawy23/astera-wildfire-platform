import type { ReactNode } from "react";
import { Link, Outlet } from "react-router";
import { ArrowLeft } from "lucide-react";
import { LogoLockup, TeamCredit } from "@/components/brand/Logo";
import { SkipLink } from "@/components/layout/SkipLink";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

/**
 * Frame for standalone pages (Welcome, Login, Register, 404, error): no sidebar, no header and
 * **no MOCK DATA banner** (the banner exists only inside the App Shell).
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

/**
 * Login and Register share this layout: stacked product lockup (not a link), a visible
 * "Back to welcome" text link, then the card.
 */
export function AuthLayout() {
  return (
    <StandaloneFrame>
      <div className="flex w-full max-w-md flex-col items-center gap-6 pt-2">
        <LogoLockup layout="stacked" />
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-md px-1 text-sm font-medium text-primary underline underline-offset-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to welcome
        </Link>
        <div className="-mt-3 w-full rounded-lg border border-border bg-surface p-6 shadow-sm">
          <Outlet />
        </div>
      </div>
    </StandaloneFrame>
  );
}
