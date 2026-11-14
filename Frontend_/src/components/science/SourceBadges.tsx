import { BADGE_LABELS, provenanceBadges, type BadgeKey, type Provenance } from "@/data/types";
import { cn } from "@/lib/utils";

/** One source badge (D.2 §4 colours, fixed in both themes). The text is always shown. */
export function SourceBadge({ badge, className }: { badge: BadgeKey; className?: string }) {
  return (
    <span
      data-badge={badge}
      className={cn("inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold tracking-wide", className)}
      style={{ background: `var(--aw-badge-${badge}-bg)`, color: `var(--aw-badge-${badge}-fg)` }}
    >
      {BADGE_LABELS[badge]}
    </span>
  );
}

/**
 * Badges for a record's provenance: MOCK DATA first for synthetic data, then the source
 * (Sentinel-1 always C-band; NISAR L and S separate; "band not available" when not stated).
 */
export function ProvenanceBadges({
  provenance,
  hideMock = false,
  className,
}: {
  provenance: Provenance;
  /**
   * Leave out the MOCK DATA badge where the screen already carries one visible demo label (the App Shell demo
   * bar) and the item itself says it is invented. The source badges are always shown.
   */
  hideMock?: boolean;
  className?: string;
}) {
  const badges = provenanceBadges(provenance).filter((key) => !(hideMock && key === "mock"));
  if (badges.length === 0) return null;
  return (
    <ul aria-label="Data source" className={cn("flex flex-wrap gap-1.5", className)}>
      {badges.map((key) => (
        <li key={key}>
          <SourceBadge badge={key} />
        </li>
      ))}
    </ul>
  );
}
