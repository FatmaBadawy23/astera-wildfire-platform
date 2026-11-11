import { Link } from "react-router";
import { LogoLockup } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { StandaloneFrame } from "@/features/auth/AuthLayout";

/** Entry page. Guest-first: "Continue as guest" opens the app with full access; no account is needed. */
export function WelcomePage() {
  return (
    <StandaloneFrame credit>
      <div className="flex w-full max-w-2xl flex-col items-center gap-8 pt-6 text-center sm:pt-12">
        <LogoLockup layout="stacked" />
        <div className="grid gap-3">
          <h1 data-page-heading tabIndex={-1} className="text-3xl font-bold sm:text-4xl">
            Monitor wildfire surface change with satellite radar
          </h1>
          <p className="mx-auto max-w-prose text-muted-foreground">
            Explore active-fire detections, check which radar scenes exist before and after a fire, and review
            estimated surface change, with every value labelled by its source and how it was produced.
          </p>
        </div>

        <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Button asChild size="lg">
            <Link to="/explorer">Continue as guest</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/register">Create account</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Guests have full access to every feature. Accounts aren't available yet.</p>
      </div>
    </StandaloneFrame>
  );
}
