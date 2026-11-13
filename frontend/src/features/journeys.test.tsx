/**
 * Fire Story, Fire History & Impacts, My Places & Alerts, User Guide and How It Works: content, honesty rules and
 * the links between them. (The real map and the full journeys in a browser: scripts/journey-checks.mjs.)
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { PLACES_STORAGE_KEY } from "@/features/places/placesStore";

vi.mock("@/features/explorer/ExplorerMap", () => ({ default: () => <div data-testid="fake-map" /> }));

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

const h1 = () => screen.getByRole("heading", { level: 1 });
const section = (id: string) => document.querySelector<HTMLElement>(`[data-story-section="${id}"]`)!;

afterEach(() => vi.restoreAllMocks());

describe("Fire Story", () => {
  it("brings the possible fire's information together in one page, in order", async () => {
    renderAt("/events/SYN-01");
    // The whole suite runs in parallel, so loading can take over a second here: allow up to 5 s.
    await waitFor(() => expect(h1()).toHaveTextContent("SYN-01 · Synthetic demo event 01"), { timeout: 5000 });
    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Summary",
      "What we know",
      "Heat spots",
      "Radar images",
      "Radar analysis",
      "Report",
      "Learn more",
    ]);
    for (const id of ["summary", "known", "heat-spots", "radar-data", "analysis", "report", "learn"]) expect(section(id)).toBeInTheDocument();
    expect(screen.getByText("Possible fire · not confirmed")).toBeInTheDocument();
  });

  it("states what is known and what isn't, from the records that exist", async () => {
    renderAt("/events/SYN-01");
    const known = await waitFor(() => {
      const el = document.querySelector<HTMLElement>("[data-known]");
      expect(el).toHaveTextContent("Radar images exist from before");
      return el!;
    });
    expect(known).toHaveTextContent("Satellites recorded 120 heat spots here");
    await waitFor(() => expect(known).toHaveTextContent("estimated 18.4 km² of strong surface change"));
    const unknown = document.querySelector<HTMLElement>("[data-unknown]")!;
    expect(unknown).toHaveTextContent("Whether it was a wildfire: nobody has checked it on the ground.");
    expect(unknown).toHaveTextContent("How much land burned");
    expect(unknown).toHaveTextContent("Whether the radar change was caused by fire");
    expect(unknown).toHaveTextContent("this is demo data with an invented location");
  });

  it("a complete analysis shows an estimate with its range and kind, never as burned area", async () => {
    renderAt("/events/SYN-01");
    const analysis = await waitFor(() => {
      expect(section("analysis")).toHaveTextContent("Area of strong surface change");
      return section("analysis");
    });
    expect(analysis).toHaveTextContent("Estimated 18.4 km²");
    expect(analysis).toHaveTextContent("Uncertainty range: 15.9 km² to 21.2 km²");
    expect(analysis).toHaveTextContent("Not a burned-area measurement.");
    expect(analysis).toHaveTextContent("−2.14 dB");
    expect(analysis).toHaveTextContent("The change map image itself is not available in this data");
  });

  it("no usable radar pair: says why, shows no result and estimates none", async () => {
    renderAt("/events/SYN-04");
    await waitFor(() => expect(section("analysis")).toHaveTextContent("Radar analysis is not possible"));
    expect(section("analysis")).not.toHaveTextContent("km²");
    expect(section("radar-data")).toHaveTextContent("No image from before");
    expect(section("radar-data")).toHaveTextContent("No pre-fire scene was found.");
  });

  it("different bands and products are never compared", async () => {
    renderAt("/events/SYN-05");
    await waitFor(() => expect(section("radar-data")).toHaveTextContent("The scenes use different frequency bands."));
    expect(section("radar-data")).toHaveTextContent("The scenes are different product types");
    expect(within(section("radar-data")).getByText("NISAR · L-band")).toBeInTheDocument();
    expect(within(section("radar-data")).getByText("NISAR · S-band")).toBeInTheDocument();
  });

  it("a failed analysis says so", async () => {
    renderAt("/events/SYN-06");
    await waitFor(() => expect(section("analysis")).toHaveTextContent("The radar analysis failed"));
  });

  it("Report: downloads exactly the shown data, labelled synthetic", async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return "blob:test";
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    renderAt("/events/SYN-03");
    const json = await screen.findByRole("button", { name: "Download all data (JSON)" });
    await waitFor(() => expect(json).toBeEnabled());
    await user.click(json);
    const data = JSON.parse(await created[0].text());
    expect(data.dataOrigin).toMatch(/^synthetic/);
    expect(data.event.id).toBe("SYN-03");
    expect(data.detections).toHaveLength(110);
    expect(data.notice).toContain("not a confirmed wildfire");
    await user.click(screen.getByRole("button", { name: "Download heat spots (CSV)" }));
    const csv = await created[1].text();
    expect(csv.split("\n")[0]).toBe("detection_id,event_id,acquired_at_utc,longitude,latitude,satellite,instrument,confidence_as_reported,data_origin");
    expect(csv.trim().split("\n")).toHaveLength(111);
  });

  it("links onward: map, My places (real save), Ask Astera (coming soon)", async () => {
    const user = userEvent.setup();
    renderAt("/events/SYN-03");
    await waitFor(() => expect(h1()).toHaveTextContent("SYN-03"));
    expect(screen.getByRole("link", { name: "Show on the Fire map" })).toHaveAttribute("href", "/?event=SYN-03");
    await user.click(screen.getByRole("button", { name: "Save Portugal to My places" }));
    expect(JSON.parse(window.localStorage.getItem(PLACES_STORAGE_KEY)!)).toEqual(["PRT"]);
    await user.click(screen.getByRole("button", { name: "Ask about this fire" }));
    expect(await screen.findByRole("tab", { name: "Ask Astera", selected: true })).toBeInTheDocument();
  });
});

describe("Fire History & Impacts", () => {
  it("lists every possible fire, newest first, with effects and impacts stated honestly", async () => {
    renderAt("/history");
    await waitFor(() => expect(document.querySelectorAll("[data-history-item]")).toHaveLength(6));
    const ids = [...document.querySelectorAll("[data-history-item]")].map((el) => el.getAttribute("data-history-item"));
    expect(ids).toEqual(["SYN-06", "SYN-05", "SYN-03", "SYN-04", "SYN-01", "SYN-02"]);
    const syn01 = document.querySelector<HTMLElement>('[data-history-item="SYN-01"]')!;
    await waitFor(() => expect(syn01).toHaveTextContent("Estimated 18.4 km² of radar surface change"));
    expect(syn01).toHaveTextContent("Not a burned-area measurement.");
    expect(syn01).toHaveTextContent("Simulated result.");
    expect(syn01).toHaveTextContent("Impacts on land cover, people or property: not available");
    expect(document.querySelector('[data-history-item="SYN-04"]')).toHaveTextContent("No radar result: no suitable before/after image pair.");
  });

  it("filters by country (from the URL) and by 'has a radar result'", async () => {
    const user = userEvent.setup();
    const router = renderAt("/history?country=PRT");
    await waitFor(() => expect([...document.querySelectorAll("[data-history-item]")].map((e) => e.getAttribute("data-history-item"))).toEqual(["SYN-03"]));
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(document.querySelectorAll("[data-history-item]")).toHaveLength(6));
    await user.click(screen.getByRole("checkbox", { name: /Only possible fires with a radar surface-change result/ }));
    await waitFor(() => expect([...document.querySelectorAll("[data-history-item]")].map((e) => e.getAttribute("data-history-item"))).toEqual(["SYN-03", "SYN-01"]));
    expect(new URLSearchParams(router.state.location.search).get("result")).toBe("1");
  });

  it("each item opens its Fire Story", async () => {
    const user = userEvent.setup();
    const router = renderAt("/history");
    await waitFor(() => expect(document.querySelector('[data-history-item="SYN-02"]')).not.toBeNull());
    const item = document.querySelector<HTMLElement>('[data-history-item="SYN-02"]')!;
    await user.click(within(item).getByRole("link", { name: /Open the Fire Story/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/events/SYN-02"));
  });
});

describe("My Places & Alerts", () => {
  it("saving a country works in this browser; the card shows what the data holds; remove works", async () => {
    const user = userEvent.setup();
    renderAt("/places");
    expect(screen.getByText("No places saved yet")).toBeInTheDocument();
    await user.type(screen.getByRole("combobox", { name: "Search for a country to save" }), "Gree");
    await user.keyboard("{Enter}");
    expect(screen.getByText("Greece saved to your places.")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[data-place="GRC"]')).toHaveTextContent("Possible fires1"));
    const card = document.querySelector<HTMLElement>('[data-place="GRC"]')!;
    expect(within(card).getByRole("link", { name: /Show on the Fire map/ })).toHaveAttribute("href", "/?country=GRC");
    expect(JSON.parse(window.localStorage.getItem(PLACES_STORAGE_KEY)!)).toEqual(["GRC"]);
    await user.click(within(card).getByRole("button", { name: "Remove Greece" }));
    expect(screen.getByText("No places saved yet")).toBeInTheDocument();
  });

  it("alerts are 'Not available yet' and nothing asks for contact details", () => {
    renderAt("/places");
    const alerts = document.querySelector<HTMLElement>("[data-alerts]")!;
    expect(within(alerts).getByText("Not available yet")).toBeInTheDocument();
    expect(alerts).toHaveTextContent("doesn't ask for your email or phone number");
    expect(document.querySelector('input[type="email"], input[type="tel"]')).toBeNull();
  });
});

describe("User Guide and How It Works", () => {
  it("the User Guide has every article, plain words first, technical details collapsed; the chatbot is 'Coming soon'", async () => {
    const user = userEvent.setup();
    renderAt("/guide");
    expect(h1()).toHaveTextContent("User Guide");
    expect(document.querySelectorAll("[data-guide-article]").length).toBeGreaterThanOrEqual(15);
    const squares = document.getElementById("squares")!;
    expect(within(squares).getByText("Technical details").closest("details")).not.toHaveAttribute("open");
    expect(squares).toHaveTextContent("Density is not burned area.");
    const ask = document.getElementById("ask")!;
    expect(within(ask).getByText("Coming soon")).toBeInTheDocument();
    await user.click(within(ask).getByRole("button", { name: "Open Ask Astera" }));
    expect(await screen.findByRole("tab", { name: "Ask Astera", selected: true })).toBeInTheDocument();
  });

  it("How It Works explains the six steps with technical details on demand", () => {
    renderAt("/how-it-works");
    const steps = screen.getByRole("list", { name: "Steps" });
    expect(within(steps).getAllByRole("heading", { level: 2 })).toHaveLength(6);
    expect(steps).toHaveTextContent("Detections are never treated as burned-area polygons or ground truth.");
    expect(steps).toHaveTextContent("Sentinel-1 thresholds are never reused for NISAR.");
  });
});
