/** Text shown for any missing value. Never replaced by an invented value. */
export const NOT_AVAILABLE = "Not available";

const MINUS = "−"; // true minus sign

function validDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026-07-30" (UTC). */
export function formatDateUtc(iso: string | null | undefined): string {
  const d = validDate(iso);
  return d ? d.toISOString().slice(0, 10) : NOT_AVAILABLE;
}

/** "2026-07-30 10:32 UTC". */
export function formatDateTimeUtc(iso: string | null | undefined): string {
  const d = validDate(iso);
  return d ? `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC` : NOT_AVAILABLE;
}

/** "2026-07-01 – 2026-08-31 (UTC)". */
export function formatWindow(window: { start: string; end: string } | null | undefined): string {
  if (!window) return NOT_AVAILABLE;
  const a = validDate(window.start);
  const b = validDate(window.end);
  if (!a || !b) return NOT_AVAILABLE;
  return `${formatDateUtc(window.start)} – ${formatDateUtc(window.end)} (UTC)`;
}

/** Number with a true minus sign and grouping; `digits` fraction digits. */
export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return NOT_AVAILABLE;
  const text = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return n < 0 && Number(text.replace(/,/g, "")) !== 0 ? `${MINUS}${text}` : text;
}

/** "38.512° N, 120.284° W". */
export function formatCoordinate(point: { lon: number; lat: number } | null | undefined): string {
  if (!point || !Number.isFinite(point.lon) || !Number.isFinite(point.lat)) return NOT_AVAILABLE;
  const lat = `${Math.abs(point.lat).toFixed(3)}° ${point.lat >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(point.lon).toFixed(3)}° ${point.lon >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

/** "−3.42 dB". */
export function formatDb(n: number | null | undefined, digits = 2): string {
  const v = formatNumber(n, digits);
  return v === NOT_AVAILABLE ? v : `${v} dB`;
}

/** "12,308.4 km²". */
export function formatArea(km2: number | null | undefined, digits = 1): string {
  const v = formatNumber(km2, digits);
  return v === NOT_AVAILABLE ? v : `${v} km²`;
}

export function formatPercent(n: number | null | undefined, digits = 0): string {
  const v = formatNumber(n, digits);
  return v === NOT_AVAILABLE ? v : `${v}%`;
}

export function formatCount(n: number | null | undefined): string {
  return formatNumber(n, 0);
}

/** Value with its unit ("18.4 km²", "−2.10 dB", "30 m"); null → "Not available". */
export function formatWithUnit(n: number | null | undefined, unit: string | null | undefined, digits = 1): string {
  if (unit === "dB") return formatDb(n, digits);
  if (unit === "km²") return formatArea(n, digits);
  if (unit === "%") return formatPercent(n, digits);
  const v = formatNumber(n, digits);
  return v === NOT_AVAILABLE || !unit ? v : `${v} ${unit}`;
}
