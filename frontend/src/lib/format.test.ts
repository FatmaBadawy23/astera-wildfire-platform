import { describe, expect, it } from "vitest";
import {
  NOT_AVAILABLE,
  formatArea,
  formatCoordinate,
  formatCount,
  formatDateTimeUtc,
  formatDateUtc,
  formatDb,
  formatNumber,
  formatPercent,
  formatWindow,
  formatWithUnit,
} from "./format";

describe("formatters", () => {
  it("dates are UTC and say so", () => {
    expect(formatDateUtc("2026-07-30T23:30:00-05:00")).toBe("2026-07-31");
    expect(formatDateTimeUtc("2026-07-30T10:32:45Z")).toBe("2026-07-30 10:32 UTC");
    expect(formatWindow({ start: "2026-07-01T00:00:00Z", end: "2026-08-31T23:59:59Z" })).toBe("2026-07-01 – 2026-08-31 (UTC)");
  });

  it("coordinates use hemispheres and three decimals", () => {
    expect(formatCoordinate({ lon: -120.2843, lat: 38.5121 })).toBe("38.512° N, 120.284° W");
    expect(formatCoordinate({ lon: 150.31, lat: -33.62 })).toBe("33.620° S, 150.310° E");
  });

  it("numbers use a true minus sign and grouping", () => {
    expect(formatDb(-3.4217)).toBe("−3.42 dB");
    expect(formatDb(1.5)).toBe("1.50 dB");
    expect(formatNumber(-0.001, 2)).toBe("0.00");
    expect(formatArea(12308.44)).toBe("12,308.4 km²");
    expect(formatPercent(96)).toBe("96%");
    expect(formatCount(1234)).toBe("1,234");
    expect(formatWithUnit(20, "m", 0)).toBe("20 m");
    expect(formatWithUnit(-2.14, "dB", 2)).toBe("−2.14 dB");
  });

  it("missing or invalid values are 'Not available', never 0 or a guess", () => {
    for (const v of [
      formatDateUtc(null),
      formatDateTimeUtc("not a date"),
      formatWindow(null),
      formatCoordinate(null),
      formatDb(null),
      formatArea(undefined),
      formatPercent(Number.NaN),
      formatCount(null),
      formatWithUnit(null, "km²"),
    ]) {
      expect(v).toBe(NOT_AVAILABLE);
    }
  });
});
