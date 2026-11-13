import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { ANALYSES, AVAILABILITY, EVENTS, SCENES } from "@/data/mock/fixtures";
import { SYNTHETIC_NOTE, type Provenance, type SciValue } from "@/data/types";
import { axeViolations } from "@/test/axe";
import { AvailabilityStatus } from "./AvailabilityStatus";
import {
  ChangeMaskLegendItem,
  ChangeScaleLegend,
  DetectionDensityLegend,
  FireDetectionLegendItem,
  LEGEND_TEXT,
  LegendList,
  NoDataLegendItem,
  ReferencePerimeterLegendItem,
  SceneFootprintLegendItem,
} from "./Legends";
import { MetadataList } from "./MetadataList";
import { ProvenancePanel } from "./ProvenancePanel";
import { ValueDisplay } from "./SciValue";
import { ProvenanceBadges } from "./SourceBadges";

const syn = (source: Provenance["source"], bands: Provenance["bands"] = []): Provenance => ({
  origin: "synthetic",
  source,
  productType: null,
  bands,
  processing: [],
  notes: [SYNTHETIC_NOTE],
});
const badgeTexts = (container: HTMLElement) => within(container).getAllByRole("listitem").map((li) => li.textContent);

afterEach(() => window.history.replaceState({}, "", "/"));

describe("source badges", () => {
  it.each([
    ["sentinel-1", [], ["MOCK DATA", "SENTINEL-1 · C-band"]],
    ["nisar", ["L"], ["MOCK DATA", "NISAR · L-band"]],
    ["nisar", ["S"], ["MOCK DATA", "NISAR · S-band"]],
    ["nisar", ["L", "S"], ["MOCK DATA", "NISAR · L-band", "NISAR · S-band"]],
    ["nisar", [], ["MOCK DATA", "NISAR · band not available"]],
    ["firms", [], ["MOCK DATA", "FIRMS"]],
    ["mock-sar", [], ["MOCK DATA"]],
  ] as const)("synthetic %s %j → %j", (source, bands, expected) => {
    const { container } = render(<ProvenanceBadges provenance={syn(source, [...bands])} />);
    expect(badgeTexts(container)).toEqual(expected);
  });

  it("observed Sentinel-1 is C-band only, never NISAR, and has no MOCK badge", () => {
    const { container } = render(<ProvenanceBadges provenance={{ ...syn("sentinel-1"), origin: "observed" }} />);
    expect(badgeTexts(container)).toEqual(["SENTINEL-1 · C-band"]);
  });

  it("every synthetic fixture record shows MOCK DATA first (mock data always labelled)", () => {
    const provenances = [...EVENTS, ...SCENES, ...AVAILABILITY, ...ANALYSES].map((r) => r.provenance);
    for (const p of provenances) {
      const { container, unmount } = render(<ProvenanceBadges provenance={p} />);
      expect(badgeTexts(container)[0]).toBe("MOCK DATA");
      unmount();
    }
  });
});

describe("values", () => {
  const show = (v: SciValue<number>, digits?: number) => render(<ValueDisplay value={v} digits={digits} />).container;

  it("a null value reads 'Not available' with its reason and never shows a number", () => {
    const c = show({ value: null, kind: "measured", unit: "m", missingReason: "not stated in the metadata" });
    expect(c).toHaveTextContent("Not available (not stated in the metadata)");
    expect(c.textContent).not.toMatch(/\d/);
  });

  it("an estimate always says 'Estimated', with its range and method", () => {
    const c = show({ value: 18.4, kind: "estimated", unit: "km²", method: "Mask × pixel area", uncertainty: { lower: 15.9, upper: 21.2, description: null } });
    expect(c).toHaveTextContent("Estimated 18.4 km²");
    expect(c).toHaveTextContent("Uncertainty range: 15.9 km² to 21.2 km²");
    expect(c).toHaveTextContent("Method: Mask × pixel area");
  });

  it("an estimate without uncertainty says so", () => {
    expect(show({ value: 9.7, kind: "estimated", unit: "km²", method: "m", uncertainty: null })).toHaveTextContent("Uncertainty not available");
  });

  it("a missing estimate still reads 'Estimated: Not available'", () => {
    expect(show({ value: null, kind: "estimated", unit: "km²" })).toHaveTextContent("Estimated: Not available");
  });

  it("shows the kind tag and a true minus sign", () => {
    const c = show({ value: -2.14, kind: "derived", unit: "dB" }, 2);
    expect(c).toHaveTextContent("−2.14 dB");
    expect(c).toHaveTextContent("Derived");
  });

  it("MetadataList shows 'Not available' for null, empty string and empty list", () => {
    render(
      <MetadataList
        items={[
          { label: "A", value: null },
          { label: "B", value: "" },
          { label: "C", value: [] },
          { label: "D", value: undefined, missingReason: "not stated" },
          { label: "E", value: "GCOV" },
        ]}
      />,
    );
    expect(screen.getAllByText("Not available")).toHaveLength(4);
    expect(screen.getByText("GCOV")).toBeInTheDocument();
  });
});

describe("provenance panel", () => {
  it("marks synthetic data as simulated and keeps unstated bands as 'Not available'", () => {
    const scene = SCENES.find((s) => s.id === "SYN-02-S1")!;
    render(<ProvenancePanel provenance={scene.provenance} />);
    expect(screen.getByText(/Synthetic data: simulated for demonstration, not a satellite observation/)).toBeInTheDocument();
    const simulated = screen.getByText("Simulated").nextElementSibling!;
    expect(simulated).toHaveTextContent("Yes");
    expect(screen.getByText("Frequency band").nextElementSibling).toHaveTextContent("Not available");
    expect(screen.getByText(/Simulated metadata for interface development/)).toBeInTheDocument();
  });
});

describe("legends: exact wording", () => {
  it("density legend: exact title, numeric classes, unit, window, FIRMS badge, provisional note", () => {
    render(<DetectionDensityLegend classes={[[1, 2], [3, 5], [6, 9], [10, 14], [15, 20]]} window={{ start: "2026-07-01T00:00:00Z", end: "2026-08-31T23:59:59Z" }} />);
    expect(screen.getByText(LEGEND_TEXT.density, { exact: false })).toBeInTheDocument();
    expect(LEGEND_TEXT.density).toBe("FIRMS detection density, not burned area");
    for (const label of ["1–2", "3–5", "6–9", "10–14", "15–20"]) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getAllByText("detections per cell")).toHaveLength(5);
    expect(screen.getByText(/2026-07-01 – 2026-08-31 \(UTC\)/)).toBeInTheDocument();
    expect(screen.getByText("FIRMS")).toBeInTheDocument();
    expect(screen.getByText("Provisional colours")).toBeInTheDocument();
  });

  it("change scale never calls either direction 'burned'", () => {
    const { container } = render(<ChangeScaleLegend />);
    expect(container).toHaveTextContent("Backscatter decrease (dB)");
    expect(container).toHaveTextContent("Backscatter increase (dB)");
    expect(container).toHaveTextContent("−6");
    expect(container.textContent).not.toMatch(/burn/i);
  });

  it("point / line / area items say what they are not", () => {
    render(
      <LegendList>
        <FireDetectionLegendItem />
        <ReferencePerimeterLegendItem source={null} />
        <SceneFootprintLegendItem />
        <ChangeMaskLegendItem />
        <NoDataLegendItem />
      </LegendList>,
    );
    expect(screen.getByText("Active-fire detection (FIRMS): a point, not burned area")).toBeInTheDocument();
    expect(screen.getByText("Reference burned-area perimeter (source: Not available)")).toBeInTheDocument();
    expect(screen.getByText("Change mask (analysis output, not burned area)")).toBeInTheDocument();
    expect(screen.getByText(/No data \(never shown as "no change"\)/)).toBeInTheDocument();
  });
});

describe("availability status", () => {
  it.each([
    ["SYN-01", "Suitable pair", []],
    ["SYN-04", "Scene missing", ["No pre-fire scene was found."]],
    ["SYN-05", "Unsuitable pair", ["The scenes use different frequency bands.", "The scenes are different product types (for example GCOV and GSLC)."]],
  ])("%s → %s with reasons in words", (eventId, text, reasons) => {
    const pair = AVAILABILITY.find((r) => r.eventId === eventId)!.pairs[0];
    const { container } = render(<AvailabilityStatus pair={pair} />);
    expect(container).toHaveTextContent(text);
    for (const r of reasons) expect(screen.getByText(r)).toBeInTheDocument();
  });
});

describe("development gallery /dev/science", () => {
  function renderGallery(theme: "light" | "dark") {
    window.localStorage.setItem("astera-theme", theme);
    const router = createMemoryRouter(routes, { initialEntries: ["/dev/science"] });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
  }

  it.each(["light", "dark"] as const)("renders inside the shell with the MOCK banner and has no axe violations (%s)", async (theme) => {
    renderGallery(theme);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Science components (development preview)");
    expect(screen.getByRole("region", { name: "Data mode notice" })).toBeInTheDocument();
    expect(await screen.findByText("Synthetic demo event 01")).toBeInTheDocument();
    expect(await screen.findAllByText(/Analysis allowed:/)).toHaveLength(6);
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
