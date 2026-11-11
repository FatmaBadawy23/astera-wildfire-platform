import { useEffect } from "react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router";
import { APP_NAME } from "@/app/nav";
import { LogoLockup } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { StandaloneFrame } from "@/features/auth/AuthLayout";

function describe(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Standalone error page for any route error (no sidebar, no MOCK banner). Details only in development. */
export function RouteErrorPage() {
  const error = useRouteError();

  useEffect(() => {
    document.title = `Something went wrong · ${APP_NAME}`;
  }, []);

  return (
    <StandaloneFrame>
      <div className="flex w-full max-w-xl flex-col items-center gap-6 pt-6 text-center">
        <LogoLockup layout="stacked" />
        <h1 data-page-heading tabIndex={-1} className="text-3xl font-bold">
          Something went wrong
        </h1>
        <p className="text-muted-foreground">This page couldn't be displayed. Reloading usually helps.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button asChild variant="secondary">
            <Link to="/explorer" reloadDocument>
              Go to the Explorer
            </Link>
          </Button>
        </div>
        {import.meta.env.DEV && (
          <details className="w-full rounded-md border border-border bg-surface p-3 text-left text-sm">
            <summary className="cursor-pointer font-medium">Technical details (development only)</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs">{describe(error)}</pre>
          </details>
        )}
      </div>
    </StandaloneFrame>
  );
}
