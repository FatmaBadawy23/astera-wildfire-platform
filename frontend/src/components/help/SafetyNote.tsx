import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export const SAFETY_TEXT = "Astera Watch is not an emergency service. If you are near a fire, follow your local authorities.";

/** Shown in the App Shell (the standalone Welcome page that used to carry it is gone). */
export const NOT_NASA_TEXT = "Team Astera · NASA Space Apps Challenge. Not an official NASA product: NASA and NISAR are named only as data sources.";

/** Shown wherever a user might act on fire information. Never gives evacuation advice itself. */
export function SafetyNote({ className }: { className?: string }) {
  return (
    <p data-safety-note className={cn("flex gap-2 rounded-md border border-border bg-background p-3 text-sm", className)}>
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>{SAFETY_TEXT}</span>
    </p>
  );
}
