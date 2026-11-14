import { VALUE_KIND_DEFINITIONS, type SciValue, type ValueKind } from "@/data/types";
import { NOT_AVAILABLE, formatWithUnit } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "Not available" for a missing value, with the reason when known. Never replaced by a number. */
export function NotAvailable({ reason, className }: { reason?: string | null; className?: string }) {
  return (
    <span className={cn("text-muted-foreground", className)} data-not-available="">
      {NOT_AVAILABLE}
      {reason ? <span className="text-xs"> ({reason})</span> : null}
    </span>
  );
}

/** Small tag naming how a value was produced: Measured / Derived / Estimated / Placeholder. */
export function ValueKindTag({ kind }: { kind: ValueKind }) {
  return (
    <span className="rounded-sm border border-border-strong px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {VALUE_KIND_DEFINITIONS[kind].label}
    </span>
  );
}

/**
 * A scientific value with its unit and kind. Estimated values always read "Estimated …" and state their
 * uncertainty (or that it isn't available) and their method. A null value is shown as "Not available".
 */
export function ValueDisplay({
  value,
  digits = 1,
  showMethod = true,
  className,
}: {
  value: SciValue<number>;
  digits?: number;
  showMethod?: boolean;
  className?: string;
}) {
  const estimated = value.kind === "estimated";
  const u = value.uncertainty;
  const hasRange = !!u && u.lower !== null && u.upper !== null;

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <span className="inline-flex flex-wrap items-center gap-2">
        {value.value === null ? (
          <span>
            {estimated && <span className="font-medium">Estimated: </span>}
            <NotAvailable reason={value.missingReason} />
          </span>
        ) : (
          <span>
            {estimated && <span className="font-medium">Estimated </span>}
            <span className="font-mono">{formatWithUnit(value.value, value.unit, digits)}</span>
          </span>
        )}
        <ValueKindTag kind={value.kind} />
      </span>
      {estimated && value.value !== null && (
        <span className="text-sm text-muted-foreground">
          {hasRange ? (
            <>
              Uncertainty range: <span className="font-mono">{formatWithUnit(u!.lower, value.unit, digits)}</span> to{" "}
              <span className="font-mono">{formatWithUnit(u!.upper, value.unit, digits)}</span>
              {u!.description ? ` (${u!.description})` : null}
            </>
          ) : (
            "Uncertainty not available"
          )}
        </span>
      )}
      {showMethod && value.method && value.value !== null && <span className="text-sm text-muted-foreground">Method: {value.method}</span>}
    </span>
  );
}
