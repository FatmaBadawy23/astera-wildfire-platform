import { cn } from "@/lib/utils";

/** Fixed wording (docs/design/01-visual-identity.md §7.1). */
export const PRODUCT_NAME = "Astera Watch";
export const PRODUCT_SUBTITLE = "Wildfire Surface-Change Monitoring with NASA NISAR Radar";
export const TEAM_CREDIT = "Team Astera · NASA Space Apps Challenge";

/** Product logo files (D.1 §11). C2 = primary circular badge, C1 = simplified small mark. */
export const PRODUCT_MARK_SRC = "/brand/astera-watch-mark.svg";
export const PRODUCT_MARK_SMALL_SRC = "/brand/astera-watch-mark-small.svg";
/** At or above this size the primary badge (C2) is used; below it, the small mark (C1). */
export const MARK_SWITCH_PX = 48;

export type MarkVariant = "auto" | "badge" | "small";

interface ProductMarkProps {
  size?: number;
  variant?: MarkVariant;
  /** Accessible name. Omit when the product name is already shown next to the mark (decorative). */
  label?: string;
  className?: string;
}

/** The Astera Watch product mark. Identical in light and dark themes; never recoloured. */
export function ProductMark({ size = 40, variant = "auto", label, className }: ProductMarkProps) {
  const useBadge = variant === "badge" || (variant === "auto" && size >= MARK_SWITCH_PX);
  return (
    <img
      src={useBadge ? PRODUCT_MARK_SRC : PRODUCT_MARK_SMALL_SRC}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      draggable={false}
      data-mark={useBadge ? "c2" : "c1"}
      className={cn("block select-none", className)}
      style={{ width: size, height: size, minWidth: size, flexShrink: 0 }}
    />
  );
}

export type LockupLayout = "horizontal" | "stacked" | "compact";

interface LogoLockupProps {
  layout?: LockupLayout;
  /** @deprecated Use `layout="compact"`. Kept for backward compatibility. */
  compact?: boolean;
  className?: string;
}

/** Product mark + name (+ subtitle). Name is written in title case and set in capitals with CSS. */
export function LogoLockup({ layout, compact, className }: LogoLockupProps) {
  const l: LockupLayout = layout ?? (compact ? "compact" : "horizontal");

  if (l === "compact") {
    return (
      <span className={cn("flex items-center gap-2.5", className)}>
        <ProductMark size={32} />
        <span className="font-wordmark text-base font-bold text-foreground">{PRODUCT_NAME}</span>
      </span>
    );
  }

  const stacked = l === "stacked";
  return (
    <span className={cn("flex items-center gap-4", stacked && "flex-col gap-3 text-center", className)}>
      <ProductMark size={stacked ? 96 : 56} />
      <span className="flex flex-col leading-tight">
        <span className={cn("font-wordmark font-bold uppercase tracking-[0.14em] text-foreground", stacked ? "text-3xl" : "text-2xl")}>
          {PRODUCT_NAME.split(" ")[0]} <span className="text-primary">{PRODUCT_NAME.split(" ")[1]}</span>
        </span>
        <span className="mt-1.5 text-xs text-muted-foreground">{PRODUCT_SUBTITLE}</span>
      </span>
    </span>
  );
}

/**
 * The Team Astera badge (team credit only). The source is a JPG with a dark square background,
 * so it is always shown in a circular crop that follows the badge edge (D.1 §6). The file is never modified.
 */
export function TeamLogo({ size = 32, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <span
      className={cn("inline-block shrink-0 overflow-hidden rounded-full bg-[#070E21]", className)}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <img
        src="/astera-logo.jpg"
        alt=""
        draggable={false}
        // The badge spans ~64% of the image width; scale so its edge meets the circular crop.
        style={{ width: "156%", height: "156%", maxWidth: "none", marginLeft: "-28%", marginTop: "-28%" }}
      />
    </span>
  );
}

/** @deprecated Renamed to `TeamLogo`. Kept so older imports keep rendering the team badge (old default size 40). */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return <TeamLogo size={size} className={className} />;
}

/** "Team Astera · NASA Space Apps Challenge" credit with the team badge. */
export function TeamCredit({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <TeamLogo size={32} />
      <span>{TEAM_CREDIT}</span>
    </span>
  );
}
