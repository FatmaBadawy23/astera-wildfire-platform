import { useState } from "react";
import type { ActiveFireDetection } from "@/data/types";
import { formatNumber } from "@/lib/format";
import { formatDay } from "@/features/explorer/CandidateEventList";
import { detectionsPerDay } from "./report";

/**
 * Heat spots per day (single series, so no legend: the heading names it). Thin bars in the wildfire data colour on a
 * recessive baseline; hover or focus a bar for its value; the same numbers are available as a table.
 */
export function DetectionTimeline({ detections }: { detections: ActiveFireDetection[] }) {
  const days = detectionsPerDay(detections);
  const [hover, setHover] = useState<number | null>(null);
  if (days.length === 0) return <p className="text-sm text-muted-foreground">No heat spots recorded for this possible fire.</p>;
  const max = Math.max(...days.map((d) => d.count));
  const busiest = days.reduce((a, b) => (b.count > a.count ? b : a));
  const active = hover !== null ? days[hover] : null;

  return (
    <figure className="grid gap-2" data-timeline>
      <figcaption className="text-sm">
        Heat spots per day (UTC). Busiest day: <strong className="font-semibold text-foreground-strong">{formatDay(busiest.day)}</strong> with{" "}
        {formatNumber(busiest.count)}.
      </figcaption>
      <p className="h-5 text-sm text-muted-foreground" aria-hidden="true">
        {active ? `${formatDay(active.day)}: ${formatNumber(active.count)} heat spot${active.count === 1 ? "" : "s"}` : "Hover over a bar for its value."}
      </p>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2" aria-hidden="true">
        <div className="flex h-32 flex-col justify-between text-right font-mono text-xs text-muted-foreground">
          <span>{max}</span>
          <span>0</span>
        </div>
        <div className="flex h-32 items-end gap-0.5 border-b border-border-strong" onMouseLeave={() => setHover(null)}>
          {days.map((d, i) => (
            <div key={d.day} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
              <div
                className="w-full rounded-t-[3px]"
                style={{
                  height: d.count ? `${Math.max(3, (d.count / max) * 100)}%` : 0,
                  background: "var(--aw-data-fire-detection)",
                  opacity: hover === null || hover === i ? 1 : 0.55,
                }}
              />
            </div>
          ))}
        </div>
        <span />
        <div className="flex justify-between font-mono text-xs text-muted-foreground">
          <span>{formatDay(days[0].day)}</span>
          <span>{formatDay(days[days.length - 1].day)}</span>
        </div>
      </div>
      <details className="text-sm">
        <summary className="w-fit cursor-pointer font-medium text-primary">Show as a table</summary>
        <table className="mt-2 w-full max-w-sm text-left text-sm">
          <caption className="sr-only">Heat spots per day (UTC)</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-1 pr-3 font-medium">
                Day (UTC)
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Heat spots
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className="border-b border-border">
                <td className="py-1 pr-3">{formatDay(d.day)}</td>
                <td className="py-1 text-right font-mono">{formatNumber(d.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
