import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { PAIR_REASON_TEXT } from "@/data/rules/availability";
import type { PairStatus, ScenePair } from "@/data/types";
import { cn } from "@/lib/utils";

const STATUS = {
  suitable: { text: "Suitable pair", Icon: CircleCheck, tone: "text-success" },
  unsuitable: { text: "Unsuitable pair", Icon: CircleX, tone: "text-danger" },
  missing: { text: "Scene missing", Icon: CircleDashed, tone: "text-muted-foreground" },
} satisfies Record<PairStatus, { text: string; Icon: typeof CircleCheck; tone: string }>;

/** Pre/post pair status with icon AND text (never colour alone), plus the reasons in plain language. */
export function AvailabilityStatus({ pair, className }: { pair: ScenePair; className?: string }) {
  const { text, Icon, tone } = STATUS[pair.status];
  return (
    <div className={cn("grid gap-1.5", className)} data-pair-status={pair.status}>
      <p className="flex items-center gap-2 font-semibold">
        <Icon className={cn("size-5 shrink-0", tone)} aria-hidden="true" />
        {text}
      </p>
      {pair.reasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-9 text-sm text-muted-foreground">
          {pair.reasons.map((r) => (
            <li key={r}>{PAIR_REASON_TEXT[r]}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
