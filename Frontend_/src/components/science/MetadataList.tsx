import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NotAvailable } from "./SciValue";

export interface MetadataItem {
  label: string;
  /** null / undefined / "" / [] → "Not available" (never filled in). */
  value: ReactNode | null | undefined;
  missingReason?: string | null;
}

function isMissing(v: MetadataItem["value"]) {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Accessible term/value list for metadata. Missing values read "Not available". */
export function MetadataList({ items, className }: { items: MetadataItem[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(10rem,auto)_1fr]", className)}>
      {items.map(({ label, value, missingReason }) => (
        <div key={label} className="contents">
          <dt className="font-medium text-muted-foreground">{label}</dt>
          <dd className="mb-2 sm:mb-0">{isMissing(value) ? <NotAvailable reason={missingReason} /> : value}</dd>
        </div>
      ))}
    </dl>
  );
}
