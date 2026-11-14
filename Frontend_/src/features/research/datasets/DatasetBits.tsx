/** Small shared pieces for dataset pages: the class label and a value that may be "Not available". */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NOT_AVAILABLE } from "@/lib/format";
import { CLASS_LABELS, type DatasetClass } from "./datasetText";

/**
 * Real / Demo / Derived label. Text carries the meaning; the border style adds a second cue (solid for real data,
 * dashed for demo-based data). Neutral colours: orange stays reserved for fire data.
 */
export function DatasetClassTag({ value, className }: { value: DatasetClass; className?: string }) {
  const demo = value === "demo" || value === "derived-demo";
  return (
    <span
      data-dataset-class={value}
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full border-[1.5px] px-2.5 py-0.5 text-xs font-semibold",
        demo ? "border-dashed border-border-strong bg-surface-raised text-foreground" : "border-foreground bg-surface text-foreground",
        className,
      )}
    >
      {CLASS_LABELS[value]}
    </span>
  );
}

/** A metadata value, or "Not available" with the reason when it is missing. Never a guessed value. */
export function MaybeValue({ value, reason, children }: { value: unknown; reason?: string | null; children?: ReactNode }) {
  if (value === null || value === undefined || value === "") {
    return (
      <span data-not-available>
        {NOT_AVAILABLE}
        {reason && <span className="text-muted-foreground"> · {reason}</span>}
      </span>
    );
  }
  return <>{children ?? String(value)}</>;
}
