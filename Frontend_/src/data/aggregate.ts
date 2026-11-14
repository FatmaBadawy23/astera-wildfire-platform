import type { ActiveFireDetection, BBox, Provenance, TimeWindow } from "./types";

/** One grid cell of FIRMS detection density (a count of detections, not burned area, not intensity). */
export interface DensityCell {
  cellId: string;
  bbox: BBox;
  count: number;
}

export interface DensityGrid {
  kind: "derived";
  cellSizeDeg: number;
  window: TimeWindow;
  cells: DensityCell[];
  total: number;
  provenance: Provenance;
}

function inWindow(iso: string, window: TimeWindow) {
  const t = Date.parse(iso);
  return t >= Date.parse(window.start) && t <= Date.parse(window.end);
}

/**
 * Counts detections per square grid cell (in degrees) inside the time window. Derived exactly from the
 * points: the sum of all cells equals the number of detections in the window.
 */
export function aggregateDensity(
  detections: ActiveFireDetection[],
  window: TimeWindow,
  provenance: Provenance,
  cellSizeDeg = 0.1,
): DensityGrid {
  const cells = new Map<string, DensityCell>();
  for (const d of detections) {
    if (!inWindow(d.acquiredAt, window)) continue;
    const [lon, lat] = d.geometry.coordinates;
    const ix = Math.floor(lon / cellSizeDeg);
    const iy = Math.floor(lat / cellSizeDeg);
    const id = `${ix}:${iy}`;
    let cell = cells.get(id);
    if (!cell) {
      cell = {
        cellId: id,
        bbox: { west: ix * cellSizeDeg, south: iy * cellSizeDeg, east: (ix + 1) * cellSizeDeg, north: (iy + 1) * cellSizeDeg },
        count: 0,
      };
      cells.set(id, cell);
    }
    cell.count += 1;
  }
  const list = [...cells.values()].sort((a, b) => b.count - a.count || a.cellId.localeCompare(b.cellId));
  return { kind: "derived", cellSizeDeg, window, cells: list, total: list.reduce((n, c) => n + c.count, 0), provenance };
}

/**
 * Five class ranges for the density legend (D.2 §3.2: numeric breaks for all 5 levels).
 * Equal-interval over 1..max; returns [from, to] per level. Empty grid → empty list.
 */
export function densityClasses(grid: DensityGrid): [number, number][] {
  const max = grid.cells.reduce((m, c) => Math.max(m, c.count), 0);
  if (max === 0) return [];
  const classes: [number, number][] = [];
  const step = max / 5;
  let from = 1;
  for (let i = 1; i <= 5; i++) {
    const to = i === 5 ? max : Math.max(from, Math.round(step * i));
    classes.push([from, to]);
    from = to + 1;
    if (from > max) break;
  }
  return classes;
}

/** Level 1..5 for a count, given the classes from densityClasses (0 = no detections). */
export function densityLevel(count: number, classes: [number, number][]): number {
  if (count <= 0) return 0;
  const i = classes.findIndex(([, to]) => count <= to);
  return i === -1 ? classes.length : i + 1;
}
