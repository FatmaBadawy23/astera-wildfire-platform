import { cn } from "@/lib/utils";

export const STATUS_TEXT = { planned: "Planned", unavailable: "Not available yet", soon: "Coming soon" } as const;
export type StatusKind = keyof typeof STATUS_TEXT;

/**
 * "Planned" / "Not available yet" / "Coming soon" label for features that don't work yet. Approved badge colours:
 * planned background, primary text and border (never orange, which is reserved for wildfire data). The text is
 * always shown, so the meaning never depends on colour.
 */
export function StatusTag({ status, className }: { status: StatusKind; className?: string }) {
  return (
    <span
      data-status-tag={status}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border border-primary bg-planned px-2 py-px text-[11px] leading-4 font-semibold text-primary",
        className,
      )}
    >
      {STATUS_TEXT[status]}
    </span>
  );
}
