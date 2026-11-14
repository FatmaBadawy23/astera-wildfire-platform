import type { ReactNode } from "react";
import { CircleAlert, Lock, RefreshCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const frame = "flex gap-3 rounded-lg border p-4 text-sm";

/** Loading: announced politely; the skeleton keeps the layout from jumping. */
export function LoadingState({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("grid gap-3", className)} data-state="loading">
      <p className="text-sm text-muted-foreground">{label} …</p>
      <div className="grid gap-2" aria-hidden="true">
        <span className="h-4 w-3/4 animate-pulse rounded bg-surface-raised" />
        <span className="h-4 w-1/2 animate-pulse rounded bg-surface-raised" />
        <span className="h-4 w-2/3 animate-pulse rounded bg-surface-raised" />
      </div>
    </div>
  );
}

/** Empty: the request worked but returned nothing. */
export function EmptyState({ title = "No results", children, className }: { title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role="status" className={cn(frame, "border-dashed border-border-strong bg-surface", className)} data-state="empty">
      <SearchX className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="grid gap-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

/** Error: something failed; offers Retry. Technical detail only in development builds. */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  detail = [],
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  detail?: string[];
  className?: string;
}) {
  return (
    <div role="alert" className={cn(frame, "border-danger bg-surface", className)} data-state="error">
      <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
      <div className="grid gap-2">
        <p className="font-semibold">{title}</p>
        <p>{message}</p>
        {onRetry && (
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}
        {import.meta.env.DEV && detail.length > 0 && (
          <details>
            <summary className="cursor-pointer text-muted-foreground">Technical details (development only)</summary>
            <ul className="mt-1 list-disc pl-5 font-mono text-xs">
              {detail.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Unavailable: not an error. The data or feature doesn't exist yet (backend not connected) or is locked
 * (e.g. analysis without a suitable pair). No Retry, only an explanation.
 */
export function UnavailableState({
  title = "Not available yet",
  message,
  children,
  className,
}: {
  title?: string;
  message: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" className={cn(frame, "border-border-strong bg-surface-raised", className)} data-state="unavailable">
      <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="grid gap-1">
        <p className="font-semibold">{title}</p>
        <p>{message}</p>
        {children}
      </div>
    </div>
  );
}
