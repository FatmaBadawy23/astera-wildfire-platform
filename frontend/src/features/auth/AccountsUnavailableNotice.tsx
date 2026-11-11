import { Info } from "lucide-react";

export const ACCOUNTS_UNAVAILABLE_TEXT =
  "Accounts aren't available yet. Continue as a guest: every feature is available. Nothing entered here is sent or stored.";

/** Shown on Login and Register until backend authentication exists. Authentication is never simulated. */
export function AccountsUnavailableNotice() {
  return (
    <div role="status" className="flex gap-3 rounded-md border border-border-strong bg-surface-raised p-3 text-sm">
      <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <p>{ACCOUNTS_UNAVAILABLE_TEXT}</p>
    </div>
  );
}

export function NotAvailableBadge() {
  return (
    <span className="rounded-sm border border-border-strong px-2 py-0.5 align-middle text-xs font-semibold text-muted-foreground">
      Not available yet
    </span>
  );
}
