import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AppProviders } from "@/App";
import { routes } from "@/app/router";
import { createUnavailableRepositories } from "@/data/http/unavailableRepositories";
import type { Repositories } from "@/data/repositories";
import { axeViolations } from "@/test/axe";
import { DetectionDensityLegend } from "@/components/science/Legends";
import { SAFETY_TEXT } from "@/components/help/SafetyNote";
import type { ExplorerMapProps } from "./ExplorerMap";
import { WELCOME_STORAGE_KEY } from "./ExplorerPage";
import { DENSITY_LEVEL_NAMES } from "./layerHelp";

// jsdom has no WebGL: replace the MapLibre map with a stand-in that exposes the same props.
// (The real map is exercised in the browser checks.)
vi.mock("./ExplorerMap", () => ({
  default: function FakeMap(props: ExplorerMapProps) {
    return (
      <div data-testid="fake-map" data-layers={JSON.stringify(props.layers)} data-detections={props.detections.length}>
        {props.layers.events &&
          props.events.map((e) => (
            <button key={e.id} type="button" aria-pressed={props.selectedEventId === e.id} aria-label={`${e.id} marker`} onClick={() => props.onSelectEvent(e.id)}>
              {e.id}
            </button>
          ))}
        <button type="button" onClick={() => props.onSelectDetection(props.detections[0]?.id ?? null)}>
          pick first detection
        </button>
      </div>
    );
  },
}));

// The Fire map is the homepage ("/"). No matchMedia width is set here, so the page uses the stacked
// (phone/tablet) layout; the shell tests cover the desktop layout.
function renderAt(path = "/", options: { repositories?: Repositories; theme?: "light" | "dark" } = {}) {
  if (options.theme) window.localStorage.setItem("astera-theme", options.theme);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders repositories={options.repositories}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

const list = () => screen.getByRole("list", { name: "Possible fires" });
const listedIds = () => within(list()).getAllByRole("heading", { level: 3 }).map((h) => h.textContent?.split(" · ")[0]);
const params = (router: ReturnType<typeof renderAt>) => new URLSearchParams(router.state.location.search);
const openMoreFilters = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Dates and more filters" }));

afterEach(() => vi.restoreAllMocks());

describe("Fire map: content and wording", () => {
  it("explains the page in plain language and lists the 6 synthetic possible fires", async () => {
    renderAt();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Fire map");
    expect(screen.getByText("Where satellites sensed heat that may come from fires. Possible fires are not confirmed wildfires.")).toBeInTheDocument();
    expect(await screen.findByText("SYN-01 · Synthetic demo event 01")).toBeInTheDocument();
    expect(listedIds()).toEqual(["SYN-01", "SYN-02", "SYN-03", "SYN-04", "SYN-05", "SYN-06"]);
    expect(await screen.findByText(/^6 possible fires and 612 heat spots, 1 Jul – 31 Aug 2026 \(UTC\)\.$/)).toBeInTheDocument();
  });

  it("one visible demo label (the demo bar) instead of repeated badges; every item still says it is invented", async () => {
    renderAt();
    await screen.findByText("SYN-01 · Synthetic demo event 01");
    const bar = screen.getByRole("region", { name: "Data mode notice" });
    expect(bar).toHaveTextContent("Demo data · invented locations for testing, not real fires or NASA observations.");
    expect(document.querySelectorAll("[data-demo-bar]")).toHaveLength(1);
    expect(screen.queryByText(/MOCK DATA/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^DEMO/)).not.toBeInTheDocument();
    for (const item of within(list()).getAllByRole("listitem").filter((li) => li.hasAttribute("data-event-item"))) {
      expect(item).toHaveTextContent(/Invented location placed in/);
      // Source badges stay (FIRMS, radar band), without the MOCK DATA badge.
      expect(within(item).getByRole("list", { name: "Data source" })).not.toHaveTextContent("MOCK DATA");
    }
  });

  it("distinguishes heat spots, possible fires and confirmed fires; never presents detections as confirmed or density as burned area", async () => {
    renderAt();
    await screen.findByText("SYN-01 · Synthetic demo event 01");
    const text = document.body.textContent ?? "";
    expect(text).toContain("A possible fire is not a confirmed wildfire");
    expect(text).toContain("FIRMS detection density, not burned area");
    expect(text).toContain("Confirmed fires are not shown: Astera Watch does not confirm fires.");
    // Every mention of "confirmed" or "burned" is negated.
    for (const m of text.matchAll(/[^.:]*\b(confirmed|burned)\b[^.]*/gi)) expect(m[0]).toMatch(/\bnot\b|\bnobody\b|\bnever\b/i);
  });

  it("first visit: a welcome card; 'Explore the map' hides it and it stays hidden", async () => {
    const user = userEvent.setup();
    renderAt();
    const welcome = screen.getByRole("region", { name: "Welcome to Astera Watch" });
    // The journey: search, select, read what is known, open the Fire Story, save places.
    expect(welcome).toHaveTextContent("Search for a country");
    expect(welcome).toHaveTextContent("Open its Fire Story");
    expect(within(welcome).getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/how-it-works");
    await user.click(within(welcome).getByRole("button", { name: "Explore the map" }));
    expect(screen.queryByRole("region", { name: "Welcome to Astera Watch" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(WELCOME_STORAGE_KEY)).toBe("1");
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("the welcome card works with browser storage blocked", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderAt();
    await user.click(screen.getByRole("button", { name: "Explore the map" }));
    expect(screen.queryByRole("region", { name: "Welcome to Astera Watch" })).not.toBeInTheDocument();
  });
});

describe("Fire map: filters and search (kept in the URL)", () => {
  it("country search is always visible; the period chip shows the demo period", async () => {
    renderAt();
    expect(await screen.findByRole("combobox", { name: "Search for a country" })).toBeVisible();
    expect(document.querySelector("[data-period]")).toHaveTextContent("Period: Demo period · 1 Jul – 31 Aug 2026 (UTC)");
    expect(screen.getByRole("button", { name: "Dates and more filters" })).toHaveAttribute("aria-expanded", "false");
  });

  it("search by ID narrows the list", async () => {
    const router = renderAt();
    const user = userEvent.setup();
    await screen.findByText("SYN-01 · Synthetic demo event 01");
    await openMoreFilters(user);
    await user.type(screen.getByRole("searchbox", { name: "Search possible fires" }), "syn-03");
    await waitFor(() => expect(listedIds()).toEqual(["SYN-03"]));
    expect(params(router).get("q")).toBe("syn-03");
  });

  it("country search: typing suggests countries (keyboard), choosing one narrows possible fires and heat spots", async () => {
    const router = renderAt();
    await screen.findByText("SYN-01 · Synthetic demo event 01");
    const user = userEvent.setup();
    const box = screen.getByRole("combobox", { name: "Search for a country" });
    await user.type(box, "portu");
    expect(box).toHaveAttribute("aria-expanded", "true");
    const option = screen.getByRole("option", { name: /Portugal/ });
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(box).toHaveAttribute("aria-activedescendant", option.id);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(listedIds()).toEqual(["SYN-03"]));
    expect(params(router).get("country")).toBe("PRT");
    expect(box).toHaveValue("Portugal");
    await waitFor(() => expect(Number(screen.getByTestId("fake-map").dataset.detections)).toBeLessThan(612));
    await user.click(screen.getByRole("button", { name: "Clear country (Portugal)" }));
    await waitFor(() => expect(params(router).get("country")).toBeNull());
  });

  it("country search only offers countries (no towns), and says so when nothing matches", async () => {
    renderAt();
    const user = userEvent.setup();
    await user.type(await screen.findByRole("combobox", { name: "Search for a country" }), "Springfield");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(document.body).toHaveTextContent("Only country names can be searched, not towns or addresses.");
  });

  it("radar filter: Sentinel-1 → only the Sentinel-1 possible fire", async () => {
    renderAt();
    const user = userEvent.setup();
    await screen.findByText("SYN-01 · Synthetic demo event 01");
    await openMoreFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: "Radar data" }), "Sentinel-1");
    await waitFor(() => expect(listedIds()).toEqual(["SYN-03"]));
  });

  it("date range from the URL narrows by overlap, and the filters open to show it", async () => {
    renderAt("/?from=2026-08-15");
    await waitFor(() => expect(listedIds()).toEqual(["SYN-05", "SYN-06"]));
    expect(screen.getByRole("button", { name: "Dates and more filters" })).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelector("[data-period]")).toHaveTextContent("15 Aug – 31 Aug 2026 (UTC)");
  });

  it("an inverted date range shows an error and does not filter", async () => {
    renderAt("/?from=2026-08-20&to=2026-08-01");
    expect(await screen.findByRole("alert")).toHaveTextContent('The "From" date must be on or before the "To" date.');
    expect(screen.getByLabelText("From (UTC)")).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(listedIds()).toHaveLength(6));
  });

  it("no matches → empty state whose 'Clear filters' restores the list", async () => {
    const router = renderAt("/?q=nothing-matches");
    expect(await screen.findByText("No possible fires match these filters")).toBeInTheDocument();
    await userEvent.setup().click(within(screen.getByText("No possible fires match these filters").closest("[data-state]")!).getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(listedIds()).toHaveLength(6));
    expect(router.state.location.search).toBe("");
  });

  it("invalid URL values fall back to defaults", async () => {
    renderAt("/?from=yesterday&radar=sonar");
    await waitFor(() => expect(listedIds()).toHaveLength(6));
    expect(screen.getByLabelText("From (UTC)")).toHaveValue("2026-07-01");
    expect(screen.getByLabelText("Radar data")).toHaveValue("");
  });
});

describe("Fire map: selection and next steps", () => {
  it("'Show on map' selects the possible fire: pressed state, URL, one summary with what is known and not known", async () => {
    const router = renderAt();
    const user = userEvent.setup();
    const item = (await screen.findByText("SYN-02 · Synthetic demo event 02")).closest("li")!;
    await user.click(within(item).getByRole("button", { name: /Show on map/ }));
    expect(within(item).getByRole("button", { name: /Show on map/ })).toHaveAttribute("aria-pressed", "true");
    expect(params(router).get("event")).toBe("SYN-02");
    const card = screen.getByRole("region", { name: "Selected possible fire SYN-02" });
    expect(card).toHaveTextContent("Possible fire · not confirmed");
    expect(card).toHaveTextContent("What we know");
    expect(card).toHaveTextContent("What we don't know yet");
    expect(card).toHaveTextContent("Whether it was a wildfire: nobody has checked it on the ground.");
    expect(card).toHaveTextContent(SAFETY_TEXT);
    expect(within(card).getByRole("link", { name: /See the full story/ })).toHaveAttribute("href", "/events/SYN-02");
    expect(screen.getByRole("button", { name: "SYN-02 marker" })).toHaveAttribute("aria-pressed", "true");
  });

  it("'Save … to My places' really saves the country (this browser only); alerts stay 'Not available yet', no sign-up", async () => {
    renderAt("/?event=SYN-01");
    const user = userEvent.setup();
    const card = await screen.findByRole("region", { name: "Selected possible fire SYN-01" });
    const save = within(card).getByRole("button", { name: "Save United States to My places" });
    expect(save).toHaveAttribute("aria-pressed", "false");
    await user.click(save);
    expect(within(card).getByRole("button", { name: "United States saved (remove)" })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(window.localStorage.getItem("astera-watch-places") ?? "[]")).toEqual(["USA"]);
    expect(card).toHaveTextContent("Not available yet");
    expect(within(card).queryByRole("textbox")).toBeNull();
    expect(within(card).getByRole("link", { name: "My places" })).toHaveAttribute("href", "/places");
  });

  it("'Ask about this fire' opens Help at Ask Astera, labelled 'Coming soon', with the fire named", async () => {
    renderAt("/?event=SYN-03");
    const user = userEvent.setup();
    const card = await screen.findByRole("region", { name: "Selected possible fire SYN-03" });
    await user.click(within(card).getByRole("button", { name: "Ask about this fire" }));
    const help = await screen.findByRole("dialog", { name: "Help" });
    expect(within(help).getByRole("tab", { name: "Ask Astera", selected: true })).toBeInTheDocument();
    expect(help).toHaveTextContent("Coming soon");
    expect(help).toHaveTextContent("You wanted to ask about: SYN-03 · Synthetic demo event 03");
  });

  it("selecting a marker selects the same possible fire; Close clears it", async () => {
    const router = renderAt();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "SYN-04 marker" }));
    expect(params(router).get("event")).toBe("SYN-04");
    await user.click(screen.getByRole("button", { name: "Close possible fire summary" }));
    expect(params(router).get("event")).toBeNull();
    expect(screen.queryByRole("region", { name: /Selected possible fire/ })).not.toBeInTheDocument();
  });

  it("'Full story' opens the possible fire's Fire Story", async () => {
    const router = renderAt();
    const item = (await screen.findByText("SYN-01 · Synthetic demo event 01")).closest("li")!;
    await userEvent.setup().click(within(item).getByRole("link", { name: /Full story/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/events/SYN-01"));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("SYN-01 · Synthetic demo event 01"));
  });

  it("?event= preselects", async () => {
    renderAt("/?event=SYN-05");
    expect(await screen.findByRole("region", { name: "Selected possible fire SYN-05" })).toBeInTheDocument();
  });

  it("an unknown ?event= shows a notice with 'Clear selection' instead of guessing", async () => {
    const router = renderAt("/?event=E-1");
    expect(await screen.findByText(/Possible fire “E-1” isn't in the current results/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Clear selection" }));
    expect(params(router).get("event")).toBeNull();
  });

  it("a clicked heat spot shows what it is and is not (one card at a time)", async () => {
    renderAt("/?event=SYN-01");
    const user = userEvent.setup();
    await screen.findByRole("region", { name: "Selected possible fire SYN-01" });
    await user.click(screen.getByRole("button", { name: "pick first detection" }));
    const card = screen.getByRole("region", { name: "Selected heat spot" });
    expect(card).toHaveTextContent("It is not a confirmed wildfire and not burned area.");
    expect(card).toHaveTextContent("One NASA FIRMS active-fire detection");
    expect(card).toHaveTextContent("UTC");
    expect(screen.queryByRole("region", { name: /Selected possible fire/ })).not.toBeInTheDocument();
  });
});

describe("Fire map: layers and explanations", () => {
  it("each layer has an explanation with 'Shows' and 'Does not show'; Esc closes and returns focus", async () => {
    renderAt();
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "About the layer: Shaded squares (heat spot density)" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Shaded squares (heat spot density)" });
    expect(dialog).toHaveTextContent("Shows:");
    expect(dialog).toHaveTextContent("NASA FIRMS active-fire detections");
    expect(dialog).toHaveTextContent("Does not show: Confirmed wildfires, fire size, fire intensity, or burned land.");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    for (const name of ["Heat spots (individual detections)", "Possible fires (candidate events)", "Country borders and names"])
      expect(screen.getAllByRole("button", { name: `About the layer: ${name}` }).length).toBeGreaterThan(0);
  });

  it("layer switches are checkboxes that update the map", async () => {
    renderAt();
    const user = userEvent.setup();
    await screen.findByText("SYN-01 · Synthetic demo event 01");
    await user.click(screen.getByRole("checkbox", { name: "Shaded squares (heat spot density)" }));
    await user.click(screen.getByRole("checkbox", { name: "Possible fires (candidate events)" }));
    const layers = JSON.parse(screen.getByTestId("fake-map").dataset.layers!);
    expect(layers).toEqual({ density: false, detections: true, events: false, borders: true });
    expect(screen.queryByRole("button", { name: "SYN-01 marker" })).not.toBeInTheDocument();
  });

  it("one switch, 'Country borders and names', controls borders and names", async () => {
    renderAt();
    const user = userEvent.setup();
    await screen.findByText("SYN-01 · Synthetic demo event 01");
    await user.click(screen.getByRole("checkbox", { name: "Country borders and names" }));
    expect(JSON.parse(screen.getByTestId("fake-map").dataset.layers!).borders).toBe(false);
    await user.click(screen.getByRole("button", { name: "About the layer: Country borders and names" }));
    expect(await screen.findByRole("dialog", { name: "Country borders and names" })).toHaveTextContent("country names");
  });

  it("the 'Dates and more filters' disclosure reports its state", async () => {
    renderAt();
    const user = userEvent.setup();
    const more = screen.getByRole("button", { name: "Dates and more filters" });
    expect(screen.queryByRole("combobox", { name: "Radar data" })).toBeNull(); // hidden while closed
    await user.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("combobox", { name: "Radar data" })).toBeVisible();
  });
});

describe("Fire map: key (“What am I seeing?”) in plain language", () => {
  it("keeps the exact density title, the permanent explanation, the relative-level note, and names each symbol", async () => {
    renderAt();
    await screen.findByText("SYN-01 · Synthetic demo event 01");
    expect(screen.getByRole("heading", { level: 2, name: "What am I seeing?" })).toBeInTheDocument();
    const legend = document.querySelector<HTMLElement>("[data-density-legend]")!;
    expect(legend).toHaveTextContent("FIRMS detection density, not burned area");
    expect(legend).toHaveTextContent(
      "Stronger colours indicate more FIRMS detections within an area during the selected period. They do not show the size or intensity of a burned area.",
    );
    expect(legend).toHaveTextContent(/Time window:/);
    const relative = within(legend).getByText("What do “low” and “high” mean?").closest("details")!;
    expect(relative).not.toHaveAttribute("open");
    expect(relative).toHaveTextContent("not fixed thresholds");
    expect(relative).toHaveTextContent("busiest square, the selected period and the current grid size");
    const kinds = screen.getByRole("list", { name: "Markers, points and squares" });
    expect(within(kinds).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Possible fire · candidate event: a group of heat spots, not a confirmed wildfire. Shown at every zoom level.",
      "Heat spot · Active-fire detection (FIRMS): a point, not burned area",
      "Shaded square · how many heat spots fall inside one grid square during the selected period, not burned area. Shown when you zoom in to a region.",
    ]);
    expect(document.body).toHaveTextContent("Not an official NASA product");
  });

  it("names each level next to its numeric range and unit (not colour alone)", () => {
    render(
      <DetectionDensityLegend
        classes={[[1, 25], [26, 50], [51, 76], [77, 101], [102, 126]]}
        window={{ start: "2026-07-01T00:00:00Z", end: "2026-08-31T23:59:59Z" }}
        levelNames={DENSITY_LEVEL_NAMES}
      />,
    );
    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual([
      "Lowest1–25detections per cell",
      "Low26–50detections per cell",
      "Middle51–76detections per cell",
      "High77–101detections per cell",
      "Highest102–126detections per cell",
    ]);
  });
});

describe("Fire map: states and accessibility", () => {
  it("backend not connected (http mode) → 'Not available yet', no invented data", async () => {
    renderAt("/", { repositories: createUnavailableRepositories() });
    expect(await screen.findByText("Not available yet")).toBeInTheDocument();
    expect(screen.queryByText(/SYN-0/)).not.toBeInTheDocument();
  });

  it.each(["light", "dark"] as const)("no axe violations with a selection open (%s)", async (theme) => {
    renderAt("/?event=SYN-01", { theme });
    await screen.findByRole("region", { name: "Selected possible fire SYN-01" });
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
