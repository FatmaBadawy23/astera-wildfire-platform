import { Link, useLocation } from "react-router";
import { LogoLockup } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { StandaloneFrame } from "@/features/auth/AuthLayout";

/** Standalone 404 page (no sidebar, no MOCK banner). */
export function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <StandaloneFrame>
      <div className="flex w-full max-w-xl flex-col items-center gap-6 pt-6 text-center">
        <LogoLockup layout="stacked" />
        <h1 data-page-heading tabIndex={-1} className="text-3xl font-bold">
          Page not found
        </h1>
        <p className="text-muted-foreground">
          There is no page at <code className="break-all font-mono text-foreground">{pathname}</code>.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/explorer">Go to the Explorer</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/">Back to welcome</Link>
          </Button>
        </div>
      </div>
    </StandaloneFrame>
  );
}
