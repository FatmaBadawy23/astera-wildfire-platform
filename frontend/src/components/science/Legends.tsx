import { useId, type ReactNode } from "react";
import type { TimeWindow } from "@/data/types";
import { formatNumber, formatWindow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SourceBadge } from "./SourceBadges";

/** Exact legend titles (D.2 §3). */
export const LEGEND_TEXT = {
  fireDetection: "Active-fire detection (FIRMS): a point, not burned area",
  density: "FIRMS detection density, not burned area",
  densityUnit: "detections per cell",
  referencePerimeter: "Reference burned-area perimeter",
  sceneFootprint: "SAR scene footprint (coverage, not a result)",
  changeMask: "Change mask (analysis output, not burned area)",
  noData: "No data",
  changeScale: "Backscatter change (dB, post − pre)",
  decrease: "Backscatter decrease (dB)",
  increase: "Backscatter increase (dB)",
} as const;

function LegendRow({ symbol, children }: { symbol: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="inline-flex w-7 shrink-0 justify-center" aria-hidden="true">
        {symbol}
      </span>
      <span>{children}</span>
    </li>
  );
}

/** Heat-spot symbol exactly as on the map: fire-coloured dot, light ring, outer dark ring (same in both themes). */
export function HeatSpotSymbol({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7" fill="var(--aw-data-line-casing-dark)" />
      <circle cx="9" cy="9" r="5.25" fill="var(--aw-data-line-casing-light)" />
      <circle cx="9" cy="9" r="3.75" fill="var(--aw-data-fire-detection)" />
    </svg>
  );
}

export function FireDetectionLegendItem() {
  return <LegendRow symbol={<HeatSpotSymbol />}>{LEGEND_TEXT.fireDetection}</LegendRow>;
}

function DoubleLine({ dash, cap }: { dash: string; cap?: "round" }) {
  return (
    <svg width="28" height="20">
      <line x1="2" y1="10" x2="26" y2="10" stroke="var(--aw-data-line-casing-dark)" strokeWidth="3.5" />
      <line x1="2" y1="10" x2="26" y2="10" stroke="var(--aw-data-line-casing-light)" strokeWidth="1.5" strokeDasharray={dash} strokeLinecap={cap} />
    </svg>
  );
}

export function ReferencePerimeterLegendItem({ source }: { source?: string | null }) {
  return (
    <LegendRow symbol={<DoubleLine dash="6 4" />}>
      {LEGEND_TEXT.referencePerimeter} (source: {source ?? "Not available"})
    </LegendRow>
  );
}

export function SceneFootprintLegendItem() {
  return <LegendRow symbol={<DoubleLine dash="1 4" cap="round" />}>{LEGEND_TEXT.sceneFootprint}</LegendRow>;
}

export function ChangeMaskLegendItem() {
  return (
    <LegendRow
      symbol={
        <svg width="28" height="20">
          <rect x="3" y="3" width="22" height="14" fill="var(--aw-data-change-mask-fill)" fillOpacity="0.4" stroke="var(--aw-data-line-casing-dark)" strokeWidth="3" />
          <rect x="3" y="3" width="22" height="14" fill="none" stroke="var(--aw-data-line-casing-light)" strokeWidth="1.2" />
        </svg>
      }
    >
      {LEGEND_TEXT.changeMask}
    </LegendRow>
  );
}

export function NoDataLegendItem() {
  const id = useId();
  return (
    <LegendRow
      symbol={
        <svg width="28" height="20">
          <defs>
            <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--aw-data-no-data-hatch)" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect x="3" y="3" width="22" height="14" fill={`url(#${id})`} stroke="var(--aw-color-border-strong)" />
        </svg>
      }
    >
      {LEGEND_TEXT.noData} (never shown as "no change")
    </LegendRow>
  );
}

const CHANGE_STEPS = ["decrease-strong", "decrease", "decrease-weak", "neutral", "increase-weak", "increase", "increase-strong"] as const;

/**
 * 7-step BrBG change scale. `limitDb` is the symmetric range shown at the ends. Neither direction is
 * labelled "burned" (D.2 §3.1).
 */
export function ChangeScaleLegend({ limitDb = 6, className }: { limitDb?: number; className?: string }) {
  return (
    <figure className={cn("grid gap-2", className)}>
      <figcaption className="text-sm font-medium">{LEGEND_TEXT.changeScale}</figcaption>
      <div className="flex" aria-hidden="true">
        {CHANGE_STEPS.map((s) => (
          <span key={s} className="h-5 flex-1 border border-border-strong" style={{ background: `var(--aw-data-change-${s})` }} />
        ))}
      </div>
      <div className="flex justify-between font-mono text-xs">
        <span>{formatNumber(-limitDb, 0)}</span>
        <span>0</span>
        <span>+{formatNumber(limitDb, 0)}</span>
      </div>
      <div className="flex justify-between gap-4 text-xs text-muted-foreground">
        <span>← {LEGEND_TEXT.decrease}</span>
        <span className="text-right">{LEGEND_TEXT.increase} →</span>
      </div>
    </figure>
  );
}

/**
 * FIRMS detection-density legend (D.2 §3.2): exact title, numeric classes for every level with the unit and
 * time window, FIRMS badge, outlined swatches with text labels. Colours remain PROVISIONAL.
 */
export function DetectionDensityLegend({
  classes,
  window,
  levelNames,
  className,
}: {
  classes: [number, number][];
  window: TimeWindow;
  /** Optional word per level (e.g. Lowest … Highest), shown before the numeric range; level i uses levelNames[i]. */
  levelNames?: readonly string[];
  className?: string;
}) {
  return (
    <figure className={cn("grid gap-2", className)}>
      <figcaption className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {LEGEND_TEXT.density}
        <SourceBadge badge="firms" />
        <span className="rounded-sm border border-border-strong px-1.5 py-px text-[11px] font-semibold text-muted-foreground">Provisional colours</span>
      </figcaption>
      <p className="text-xs text-muted-foreground">Time window: {formatWindow(window)}</p>
      {classes.length === 0 ? (
        <p className="text-sm">No detections in this time window.</p>
      ) : (
        <ul className="grid gap-1.5">
          {classes.map(([from, to], i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden="true"
                className="h-4 w-7 shrink-0 border border-border-strong"
                style={{ background: `var(--aw-data-density-${i + 1})` }}
              />
              {levelNames?.[i] && <span className="w-16 shrink-0 font-medium">{levelNames[i]}</span>}
              <span className="font-mono">
                {from === to ? formatNumber(from) : `${formatNumber(from)}–${formatNumber(to)}`}
              </span>
              <span className="text-muted-foreground">{LEGEND_TEXT.densityUnit}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/** Wrapper list for the point/line/area legend items. */
export function LegendList({ children, label = "Map legend" }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="grid gap-2">
      {children}
    </ul>
  );
}
