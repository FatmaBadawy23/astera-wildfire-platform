import { useHelp } from "@/components/help/HelpContext";

export const DEMO_BAR_TEXT = "invented locations for testing, not real fires or NASA observations.";

/**
 * The one demo-data label of the App Shell (mock data mode only). A slim bar in normal flow above the
 * header: never sticky or fixed, so it can't cover focused content; not dismissible. Uses the data-mode
 * colours, the same in both themes.
 */
export function DemoBar() {
  const { openHelp } = useHelp();
  return (
    <div
      role="region"
      aria-label="Data mode notice"
      data-demo-bar
      style={{ background: "var(--aw-banner-mock-background)", color: "var(--aw-banner-mock-text)" }}
    >
      <p className="px-4 py-1 text-[13px] leading-5">
        <strong className="font-bold">Demo data</strong> · {DEMO_BAR_TEXT}{" "}
        <button
          type="button"
          data-help-trigger-demo
          onClick={() => openHelp({ tab: "guide", topic: "demo" })}
          className="inline-flex min-h-6 items-center font-semibold underline underline-offset-2 focus-visible:[outline-color:var(--aw-banner-mock-focus-ring)]"
        >
          What this means
        </button>
      </p>
    </div>
  );
}
