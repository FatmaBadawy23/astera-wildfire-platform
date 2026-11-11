import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountsUnavailableNotice, NotAvailableBadge } from "./AccountsUnavailableNotice";
import { preventSubmit } from "./LoginPage";

export function RegisterPage() {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-page-heading tabIndex={-1} className="text-2xl font-bold">
          Create account
        </h1>
        <NotAvailableBadge />
      </div>
      <AccountsUnavailableNotice />

      <form noValidate onSubmit={preventSubmit} aria-label="Create account (not available yet)">
        <fieldset disabled className="grid gap-4">
          <legend className="sr-only">Account details, not available yet</legend>
          <div>
            <Label htmlFor="register-name">Name</Label>
            <Input id="register-name" autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="register-email">Email</Label>
            <Input id="register-email" type="email" autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="register-password">Password</Label>
            <Input id="register-password" type="password" autoComplete="new-password" />
          </div>
          <div>
            <Label htmlFor="register-confirm">Confirm password</Label>
            <Input id="register-confirm" type="password" autoComplete="new-password" />
          </div>
          <Button type="submit" variant="secondary" className="w-full">
            Create account (not available yet)
          </Button>
        </fieldset>
      </form>

      <Button asChild size="lg" className="w-full">
        <Link to="/explorer">Continue as guest</Link>
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary underline underline-offset-2">
          Log in
        </Link>{" "}
        (also not available yet)
      </p>
    </div>
  );
}
