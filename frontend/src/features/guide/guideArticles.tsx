/**
 * User Guide articles: one source for the User Guide page and the Help panel's "About this screen" topics.
 * Everyday words first; the scientific term and technical details sit in an expandable "Technical details" part.
 * Nothing here claims more than the data supports (FIRMS detections are points, never burned area; possible fires
 * are never confirmed; radar change is an estimate, never "burned area").
 */
import type { ReactNode } from "react";
import { DENSITY_EXPLANATION } from "@/features/explorer/layerHelp";

export interface GuideArticle {
  id: string;
  question: string;
  body: ReactNode;
  /** Scientific background, shown collapsed. */
  technical?: ReactNode;
}

export const ARTICLES = {
  start: {
    id: "start",
    question: "What does Astera Watch do?",
    body: (
      <>
        <p>
          Astera Watch shows where satellites have sensed heat that may come from wildfires, groups that heat into possible fires, and explains
          what radar satellites can (and can't) tell you about the ground before and after.
        </p>
        <ol className="grid list-decimal gap-1 pl-5">
          <li>Explore the Fire map.</li>
          <li>Search for a country.</li>
          <li>Select a possible fire.</li>
          <li>Read what is known and what isn't known yet.</li>
          <li>Open its Fire Story to see the radar data and analysis that exist.</li>
          <li>Learn how the data works.</li>
          <li>Save the places you care about.</li>
        </ol>
      </>
    ),
  },
  "heat-spot": {
    id: "heat-spot",
    question: "What is a heat spot?",
    body: (
      <p>
        A place where a satellite sensed unusual heat at one moment. It can come from a wildfire, but also from a factory, a gas flare or a volcano.
        Each one is a point: it does not show how much land burned.
      </p>
    ),
    technical: (
      <p>
        Scientific name: an <strong>active-fire detection</strong> from NASA FIRMS (Fire Information for Resource Management System), produced from
        thermal infrared instruments such as MODIS and VIIRS. Confidence values are shown exactly as the source reports them.
      </p>
    ),
  },
  "possible-fire": {
    id: "possible-fire",
    question: "What is a possible fire?",
    body: (
      <p>
        A group of heat spots close together in place and time, shown on the map as a dashed circle. Nobody has checked it on the ground, so it is not
        a confirmed wildfire.
      </p>
    ),
    technical: (
      <p>
        Scientific name: a <strong>candidate event</strong>. It is a grouping of detections, not a burned-area polygon and not ground truth.
      </p>
    ),
  },
  "three-kinds": {
    id: "three-kinds",
    question: "Heat spot, possible fire, confirmed fire: what's the difference?",
    body: (
      <ul className="grid list-disc gap-1 pl-5">
        <li>Heat spot: one satellite detection of heat.</li>
        <li>Possible fire: a group of heat spots, still unchecked.</li>
        <li>Confirmed fire: one that fire services have checked. Astera Watch does not confirm fires and does not show any.</li>
      </ul>
    ),
  },
  search: {
    id: "search",
    question: "How do I find a country?",
    body: (
      <p>
        Type a country name in the search box on the Fire map. The map moves to that country and the list shows its possible fires. Search works for
        countries only, not towns or addresses, because Astera Watch has no approved source of place names yet.
      </p>
    ),
  },
  squares: {
    id: "squares",
    question: "What do the shaded squares mean?",
    body: (
      <>
        <p>
          When you zoom in to a region, the map is divided into squares. Each square counts the heat spots inside it for the selected dates.{" "}
          {DENSITY_EXPLANATION}
        </p>
        <p>At world scale the squares are hidden and each possible fire is shown by its marker, so the map stays readable.</p>
      </>
    ),
    technical: (
      <p>
        Scientific name: <strong>FIRMS detection density</strong>. Counts are exact, never smoothed. The five levels are relative: equal steps from 1
        detection up to the busiest square for the selected period at the current grid size, so they change when you zoom or change the dates.
        Density is not burned area.
      </p>
    ),
  },
  basemap: {
    id: "basemap",
    question: "What do the green, brown and blue areas mean?",
    body: (
      <p>
        The background map shows the land in natural colours: green where land is usually covered by vegetation, tan and brown where it is dry or
        bare, white for ice and blue for water. It is a long-term, generalised picture. It does not show today's vegetation, fires or burned land, so
        a green area can already have burned.
      </p>
    ),
    technical: (
      <p>
        Natural Earth I with Shaded Relief and Water (1:50m, public domain), reprojected to Web Mercator. Colours are softened in Light and dimmed in
        Dark so the fire symbols (orange dot with light and dark rings, dashed possible-fire markers, outlined squares) stay the strongest marks
        on the map.
      </p>
    ),
  },
  "fire-story": {
    id: "fire-story",
    question: "What is a Fire Story?",
    body: (
      <p>
        Everything about one possible fire on one page: when and where heat spots were recorded, what is known and not known, which radar images exist
        from before and after, the radar analysis when it can be done, a report you can download, and explanations.
      </p>
    ),
  },
  radar: {
    id: "radar",
    question: "What does radar add?",
    body: (
      <p>
        Radar satellites see through smoke and clouds, day and night. Comparing a radar image from before a fire with one from after can show where
        the ground surface changed. It can't say on its own that the change was caused by fire.
      </p>
    ),
    technical: (
      <>
        <p>
          NISAR (NASA–ISRO) carries an L-band and an S-band radar; Sentinel-1 (ESA) is C-band. Images are compared only when they come from the same
          sensor, the same band and the same product type (GCOV covariance and GSLC complex products are processed separately), share a
          polarization, and the "after" image is later than the "before" image.
        </p>
        <p>Thresholds from one radar (for example Sentinel-1 C-band) are never reused for another (NISAR L- or S-band).</p>
      </>
    ),
  },
  analysis: {
    id: "analysis",
    question: "How is surface change estimated?",
    body: (
      <p>
        When a suitable before/after pair exists, the analysis measures how much the radar signal changed and estimates the area where it changed a lot.
        That area is an estimate with a range, not a measurement of burned land.
      </p>
    ),
    technical: (
      <ul className="grid list-disc gap-1 pl-5">
        <li>Backscatter change in decibels (dB): after minus before, from a log ratio of the two images.</li>
        <li>Changed area: pixels beyond a threshold chosen from each pair's own change distribution (no universal threshold), times pixel area in an equal-area projection.</li>
        <li>Backscatter also changes with vegetation, soil moisture, roughness, viewing geometry, frequency and polarization.</li>
      </ul>
    ),
  },
  "data-labels": {
    id: "data-labels",
    question: "Measured, derived, estimated, demo: what do the labels mean?",
    body: (
      <ul className="grid list-disc gap-1 pl-5">
        <li>Measured: taken directly from a satellite product or its metadata.</li>
        <li>Derived: calculated exactly from measured values, for example a count of heat spots.</li>
        <li>Estimated: produced by a method with uncertainty, for example a changed area. Always shown with its range.</li>
        <li>Demo (synthetic): invented for testing. Never a satellite observation.</li>
        <li>Not available: the value doesn't exist; it is never filled in with a guess.</li>
      </ul>
    ),
  },
  history: {
    id: "history",
    question: "What does Fire history show?",
    body: (
      <p>
        All possible fires in the data, newest first, with filters. For each one it shows what is available about its effects. Impact information
        (for example on land cover or people) needs other data sources that are not connected, so it is shown as not available.
      </p>
    ),
  },
  places: {
    id: "places",
    question: "What are My places? Do I get alerts?",
    body: (
      <>
        <p>
          You can save countries you care about. Astera Watch then shows their possible fires and heat spots in one place. Your list is kept in this
          browser on this device only: there is no account and nothing is sent anywhere.
        </p>
        <p>Alerts are not available yet. They need accounts, a live data connection and a way to send notifications, which don't exist yet.</p>
      </>
    ),
  },
  ask: {
    id: "ask",
    question: "Ask Astera (chatbot): when can I use it?",
    body: (
      <>
        <p>The chatbot is coming soon. It isn't connected yet, so it can't answer questions. When it is built, it will:</p>
        <ul className="grid list-disc gap-1 pl-5">
          <li>answer only from verified Astera Watch data and this User Guide, and say “I don't know” otherwise;</li>
          <li>show which data or article each answer is based on;</li>
          <li>say when data is demo data;</li>
          <li>never call a possible fire confirmed, and never present heat spots as burned area;</li>
          <li>never give evacuation instructions, and point you to your local authorities instead.</li>
        </ul>
      </>
    ),
  },
  demo: {
    id: "demo",
    question: "What does “Demo data” mean?",
    body: (
      <>
        <p>
          The possible fires, heat spots, radar scenes and analysis results shown today are invented examples (synthetic data), made for testing while
          the real data connection is being built. They are not NASA observations and not real fires. Their locations are invented, placed inside
          real countries so country search can be tried.
        </p>
        <p>The slim yellow bar at the top says so on every screen. It stays until real data is connected.</p>
      </>
    ),
  },
  limits: {
    id: "limits",
    question: "What can't Astera Watch tell you?",
    body: (
      <p>
        Whether a fire is burning right now, how big or intense it is, how much land burned, or whether you are safe. Astera Watch is not an emergency
        service. If you are near a fire, follow your local authorities.
      </p>
    ),
  },
} satisfies Record<string, GuideArticle>;

export type ArticleId = keyof typeof ARTICLES;

/** Order and grouping on the User Guide page. */
export const GUIDE_SECTIONS: { title: string; articles: ArticleId[] }[] = [
  { title: "Getting started", articles: ["start", "search", "demo", "limits"] },
  { title: "Reading the map", articles: ["heat-spot", "possible-fire", "three-kinds", "squares", "basemap"] },
  { title: "Fire Stories and radar", articles: ["fire-story", "radar", "analysis", "data-labels"] },
  { title: "History, places and help", articles: ["history", "places", "ask"] },
];

/** Questions offered in Help → Ask while the chatbot is coming soon: each opens the Guide article that answers it. */
export const SUGGESTED_QUESTIONS: { question: string; article: ArticleId }[] = [
  { question: "Is a possible fire a real wildfire?", article: "possible-fire" },
  { question: "Do the shaded squares show burned area?", article: "squares" },
  { question: "What can radar tell me after a fire?", article: "radar" },
  { question: "Can I get alerts for my area?", article: "places" },
];
