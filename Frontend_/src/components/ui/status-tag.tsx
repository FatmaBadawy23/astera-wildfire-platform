import { cn } from "@/lib/utils";

export const STATUS_TEXT = { planned: "Planned", unavailable: "Not available yet", soon: "Coming soon", browser: "Works in this browser" } as const;
export type StatusKind = keyof typeof STATUS_TEXT;

/**
 * Availability label. "Planned" / "Not available yet" / "Coming soon" mark features that don't work yet: approved
 * badge colours (planned background, primary text and border; never orange, which is reserved for wildfire data).
 * "Works in this browser" marks a feature that works but keeps its data in this browser only: neutral surface with a
 * solid text-colour border, so it can't be mistaken for a "not yet" label. The text is always shown, so the meaning
 * never depends on colour.
 */
export function StatusTag({ status, className }: { status: StatusKind; className?: string }) {
  return (
    <span
      data-status-tag={status}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-px text-[11px] leading-4 font-semibold",
        status === "browser" ? "border-foreground bg-surface text-foreground" : "border-primary bg-planned text-primary",
        className,
      )}
    >
      {STATUS_TEXT[status]}
    </span>
  );
}
