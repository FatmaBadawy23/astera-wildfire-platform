import type { FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountsUnavailableNotice, NotAvailableBadge } from "./AccountsUnavailableNotice";

/** Never submits: accounts don't exist yet. No action, no field names, all fields disabled. */
export function preventSubmit(e: FormEvent) {
  e.preventDefault();
}

export function LoginPage() {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-page-heading tabIndex={-1} className="text-2xl font-bold">
          Log in
        </h1>
        <NotAvailableBadge />
      </div>
      <AccountsUnavailableNotice />

      <form noValidate onSubmit={preventSubmit} aria-label="Log in (not available yet)">
        <fieldset disabled className="grid gap-4">
          <legend className="sr-only">Login details, not available yet</legend>
          <div>
            <Label htmlFor="login-email">Email</Label>
            <Input id="login-email" type="email" autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="login-password">Password</Label>
            <Input id="login-password" type="password" autoComplete="current-password" />
          </div>
          <Button type="submit" variant="secondary" className="w-full">
            Log in (not available yet)
          </Button>
        </fieldset>
      </form>

      <Button asChild size="lg" className="w-full">
        <Link to="/explorer">Continue as guest</Link>
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link to="/register" className="font-medium text-primary underline underline-offset-2">
          Create account
        </Link>{" "}
        (also not available yet)
      </p>
    </div>
  );
}
