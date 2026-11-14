import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_LAYERS } from "./layerHelp";

// The real component, in jsdom (no WebGL): it must not crash and must explain why there is no map.
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?url", () => ({ default: "worker.js" }));

describe("ExplorerMap without WebGL", () => {
  it("shows a plain fallback message instead of a broken map", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { default: ExplorerMap } = await import("./ExplorerMap");
    render(
      <ExplorerMap
        events={[]}
        detections={[]}
        detectionProvenance={null}
        window={{ start: "2026-07-01T00:00:00Z", end: "2026-08-31T23:59:59Z" }}
        layers={DEFAULT_LAYERS}
        selectedEventId={null}
        onSelectEvent={() => {}}
        onSelectDetection={() => {}}
        onDensityChange={() => {}}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("The map can't be shown in this browser (WebGL is not available).");
    expect(screen.getByRole("status")).toHaveTextContent("can be opened from the list");
    // The first test imports MapLibre (~1 MB); under full-suite load that alone can exceed the 5 s default.
  }, 20_000);
});

describe("marker keyboard reach (only what is visible inside the map)", () => {
  const rect = (left: number, top: number, w: number, h: number) =>
    ({ left, top, right: left + w, bottom: top + h, width: w, height: h, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

  /** Map frame 0..400 × 0..300 with a zoom-button overlay at the top right (360..392 × 8..72). */
  function setup(markers: Record<string, DOMRect>) {
    document.body.innerHTML = `<div data-map-frame><div data-explorer-map></div><div data-map-overlay></div></div>`;
    const container = document.querySelector<HTMLElement>("[data-explorer-map]")!;
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue(rect(0, 0, 400, 300));
    vi.spyOn(document.querySelector("[data-map-overlay]")!, "getBoundingClientRect").mockReturnValue(rect(360, 8, 32, 64));
    for (const [id, r] of Object.entries(markers)) {
      const b = document.createElement("button");
      b.dataset.eventMarker = id;
      vi.spyOn(b, "getBoundingClientRect").mockReturnValue(r);
      container.append(b);
    }
    return { getContainer: () => container } as never;
  }
  const marker = (id: string) => document.querySelector<HTMLElement>(`[data-event-marker="${id}"]`)!;

  it("inside and uncovered → Tab stop; outside, partly outside, or under an overlay → skipped and hidden", async () => {
    const { updateMarkerReach } = await import("./ExplorerMap");
    const map = setup({
      inside: rect(100, 100, 32, 32),
      outside: rect(410, 100, 32, 32), // beyond the right edge (the SYN-02 case at 1024 px)
      partly: rect(200, 280, 32, 32), // 12 px below the bottom edge (the 844×390 case)
      covered: rect(362, 20, 32, 32), // under the zoom buttons
    });
    updateMarkerReach(map);
    expect(marker("inside").tabIndex).toBe(0);
    expect(marker("inside")).not.toHaveAttribute("aria-hidden");
    for (const id of ["outside", "partly", "covered"]) {
      expect(marker(id).tabIndex).toBe(-1);
      expect(marker(id)).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("never changes the marker that currently has focus, and restores it when it is visible again", async () => {
    const { updateMarkerReach } = await import("./ExplorerMap");
    const map = setup({ a: rect(100, 100, 32, 32) });
    updateMarkerReach(map);
    marker("a").focus();
    vi.spyOn(marker("a"), "getBoundingClientRect").mockReturnValue(rect(500, 100, 32, 32));
    updateMarkerReach(map);
    expect(marker("a").tabIndex).toBe(0); // still focused: untouched
    marker("a").blur();
    updateMarkerReach(map);
    expect(marker("a").tabIndex).toBe(-1);
    vi.spyOn(marker("a"), "getBoundingClientRect").mockReturnValue(rect(100, 100, 32, 32));
    updateMarkerReach(map);
    expect(marker("a").tabIndex).toBe(0);
    expect(marker("a")).not.toHaveAttribute("aria-hidden");
  });

  it("a marker hidden by the 'Candidate events' layer switch is skipped", async () => {
    const { updateMarkerReach } = await import("./ExplorerMap");
    const map = setup({ a: rect(100, 100, 32, 32) });
    marker("a").style.display = "none";
    updateMarkerReach(map);
    expect(marker("a").tabIndex).toBe(-1);
  });
});
