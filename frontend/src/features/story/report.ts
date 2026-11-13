/**
 * Fire Story report: exactly the records shown on the page, exported as JSON (everything, with provenance) or CSV
 * (the heat spots). Nothing is added or estimated here; synthetic records keep their "synthetic" origin and notes.
 */
import type { ActiveFireDetection, AnalysisResult, AvailabilityReport, FireEvent } from "@/data/types";

export interface StoryData {
  event: FireEvent;
  detections: ActiveFireDetection[];
  availability: AvailabilityReport | null;
  analysis: AnalysisResult | null;
}

export const REPORT_NOTICE =
  "Astera Watch Fire Story export. A possible fire (candidate event) is a group of NASA FIRMS active-fire detections; it is not a confirmed wildfire and the detections are not burned area. Radar changed area is an estimate, not a burned-area measurement.";

export function storyJson(data: StoryData, generatedAt: string): string {
  const synthetic = data.event.provenance.origin === "synthetic";
  return JSON.stringify(
    {
      notice: REPORT_NOTICE,
      dataOrigin: synthetic ? "synthetic (demo data, not satellite observations)" : "observed",
      generatedAt,
      event: data.event,
      detections: data.detections,
      availability: data.availability,
      analysis: data.analysis,
    },
    null,
    2,
  );
}

const csvCell = (v: string | number | null) => {
  if (v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function detectionsCsv(detections: ActiveFireDetection[]): string {
  const header = ["detection_id", "event_id", "acquired_at_utc", "longitude", "latitude", "satellite", "instrument", "confidence_as_reported", "data_origin"];
  const rows = detections.map((d) =>
    [d.id, d.eventId, d.acquiredAt, d.geometry.coordinates[0], d.geometry.coordinates[1], d.satellite, d.instrument, d.confidence, d.provenance.origin].map(csvCell).join(","),
  );
  return [header.join(","), ...rows].join("\n") + "\n";
}

/** Heat spots per UTC day across [first, last] (days without detections are 0). */
export function detectionsPerDay(detections: ActiveFireDetection[]): { day: string; count: number }[] {
  if (detections.length === 0) return [];
  const counts = new Map<string, number>();
  for (const d of detections) {
    const day = d.acquiredAt.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const days = [...counts.keys()].sort();
  const out: { day: string; count: number }[] = [];
  for (let t = Date.parse(`${days[0]}T00:00:00Z`); t <= Date.parse(`${days[days.length - 1]}T00:00:00Z`); t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push({ day, count: counts.get(day) ?? 0 });
  }
  return out;
}

/** Starts a file download in the browser (no server involved). */
export function downloadText(filename: string, text: string, type: string) {
  if (typeof URL.createObjectURL !== "function") return;
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
