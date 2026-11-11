import { Link } from "react-router";

export const MOCK_BANNER_TEXT = "synthetic examples for demonstration, not NASA observations.";

/**
 * MOCK DATA banner (App Shell only, VITE_DATA_MODE=mock). Sits in normal flow above the header,
 * never sticky or fixed, so it can't cover focused content. Not dismissible.
 */
export function MockBanner() {
  return (
    <div
      role="region"
      aria-label="Data mode notice"
      className="relative"
      style={{ background: "var(--aw-banner-mock-background)", color: "var(--aw-banner-mock-text)" }}
    >
      <p className="px-4 py-2 text-sm">
        <strong className="font-semibold tracking-wide">MOCK DATA:</strong> {MOCK_BANNER_TEXT}{" "}
        <Link
          to="/methodology"
          className="inline-block font-semibold underline underline-offset-2 focus-visible:[outline-color:var(--aw-banner-mock-focus-ring)]"
        >
          About mock data
        </Link>
      </p>
      <div
        aria-hidden="true"
        className="h-1"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, var(--aw-banner-mock-stripe) 0 6px, transparent 6px 12px)",
        }}
      />
    </div>
  );
}
