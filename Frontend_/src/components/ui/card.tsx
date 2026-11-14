import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CardTag = "div" | "section" | "li" | "article";

/**
 * The one card style of the app: surface background, subtle border, large radius. `padding="lg"` for page
 * sections, the default for items in a list. Cards are not clickable themselves; their buttons and links are.
 */
export function Card({
  as = "div",
  padding = "md",
  className,
  ...props
}: ComponentProps<"div"> & { as?: CardTag; padding?: "md" | "lg" }) {
  const Comp = as as "div";
  return <Comp className={cn("grid gap-3 rounded-lg border border-border bg-surface", padding === "lg" ? "p-5" : "p-4", className)} {...props} />;
}

/** Card heading row: optional icon, the heading, an optional status tag, optional actions on the right. */
export function CardHeader({
  title,
  id,
  level = 2,
  icon,
  status,
  actions,
  className,
}: {
  title: ReactNode;
  id?: string;
  level?: 2 | 3;
  icon?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {icon}
        <Heading id={id} className="text-lg font-semibold">
          {title}
        </Heading>
        {status}
      </div>
      {actions}
    </div>
  );
}

/**
 * A single headline number with its label (use inside a <dl>). The value is in text colour, never a data colour,
 * and is shown exactly as given: tiles never estimate or animate numbers.
 */
export function StatTile({ label, value, tone = "surface", className }: { label: ReactNode; value: ReactNode; tone?: "surface" | "inset"; className?: string }) {
  return (
    <div
      data-stat-tile
      className={cn(
        "grid content-start gap-0.5 rounded-lg border border-border px-3 py-2.5",
        tone === "inset" ? "bg-background" : "bg-surface",
        className,
      )}
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="font-heading text-2xl font-bold text-foreground-strong tabular-nums">{value}</dd>
    </div>
  );
}
