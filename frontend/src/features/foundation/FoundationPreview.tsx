import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoLockup, LogoMark } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useTheme } from "@/lib/theme/ThemeProvider";

const THEME_SWATCHES = [
  "bg", "surface", "surface-raised", "text", "text-muted", "primary", "on-primary", "accent",
  "border-subtle", "border-strong", "focus-ring", "success", "warning", "danger", "map-placeholder",
];
const CHANGE_STEPS = ["decrease-strong", "decrease", "decrease-weak", "neutral", "increase-weak", "increase", "increase-strong"];
const BADGES: { key: string; label: string }[] = [
  { key: "mock", label: "MOCK DATA" },
  { key: "sentinel-1-c-band", label: "SENTINEL-1 · C-band" },
  { key: "nisar-l-band", label: "NISAR · L-band" },
  { key: "nisar-s-band", label: "NISAR · S-band" },
  { key: "nisar-band-not-available", label: "NISAR · band not available" },
  { key: "firms", label: "FIRMS" },
  { key: "reference", label: "REFERENCE" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h2 className="caps-heading mb-4 text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** Stage F1 checkpoint page: shows the approved tokens rendered in the real app. Not a product page. */
export function FoundationPreview() {
  const { resolved } = useTheme();
  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4">
        <LogoLockup />
        <ThemeToggle />
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6">
        <div role="note" className="rounded-md border border-border-strong bg-surface-raised px-4 py-3 text-sm">
          <strong className="font-semibold">Stage F1 foundation preview.</strong> Not a product page: it shows the approved
          design tokens, fonts and components rendered in the real application. Current theme: <span className="font-mono">{resolved}</span>.
        </div>

        <Section title="Brand">
          <div className="flex flex-wrap items-end gap-6">
            <LogoMark size={96} />
            <LogoMark size={44} />
            <LogoMark size={32} />
            <LogoLockup compact />
          </div>
        </Section>

        <Section title={`Theme colours (${resolved})`}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {THEME_SWATCHES.map((k) => (
              <li key={k} className="flex items-center gap-3">
                <span className="size-9 shrink-0 rounded-md border border-border-strong" style={{ background: `var(--aw-color-${k})` }} />
                <span className="font-mono text-xs">{k}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Typography">
          <div className="grid gap-3">
            <p className="font-wordmark text-3xl font-bold">Astera Watch</p>
            <h1 className="text-4xl font-bold">Global Fire Explorer</h1>
            <h2 className="text-2xl font-semibold">Fire Event Details</h2>
            <h3 className="text-xl font-semibold">Data Availability</h3>
            <p className="max-w-prose text-base">
              Inter body text. Backscatter change is computed as post minus pre in decibels. Changed area is always an
              estimate, shown with its method, units and uncertainty.
            </p>
            <p className="text-sm text-muted-foreground">Muted secondary text for captions and metadata labels.</p>
            <p className="font-mono text-sm">
              −3.42 dB · 12,308 km² · 2026-08-14T10:32:00Z · 38.512° N, 120.284° W · scene_id MOCK-0001
            </p>
          </div>
        </Section>

        <Section title="Buttons (tab through to see focus rings)">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Run analysis</Button>
            <Button variant="secondary"><Search />Search events</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="danger">Remove</Button>
            <Button variant="secondary" size="sm"><Download />Export CSV</Button>
            <Button size="icon" variant="secondary" aria-label="Search"><Search /></Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Source badges">
          <ul className="flex flex-wrap gap-2">
            {BADGES.map(({ key, label }) => (
              <li
                key={key}
                className="rounded-sm px-2 py-1 text-xs font-semibold tracking-wide"
                style={{ background: `var(--aw-badge-${key}-bg)`, color: `var(--aw-badge-${key}-fg)` }}
              >
                {label}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Scientific data palette (identical in both themes)">
          <div className="grid gap-6 lg:grid-cols-2">
            <ul className="grid gap-3 text-sm">
              <li className="flex items-center gap-3">
                <svg width="28" height="20" aria-hidden="true"><circle cx="14" cy="10" r="5" fill="var(--aw-data-fire-detection)" stroke="var(--aw-color-bg)" strokeWidth="1" /></svg>
                Active-fire detection (FIRMS): a point, not burned area
              </li>
              <li className="flex items-center gap-3">
                <svg width="28" height="20" aria-hidden="true">
                  <line x1="2" y1="10" x2="26" y2="10" stroke="var(--aw-data-line-casing-dark)" strokeWidth="3.5" />
                  <line x1="2" y1="10" x2="26" y2="10" stroke="var(--aw-data-line-casing-light)" strokeWidth="1.5" strokeDasharray="6 4" />
                </svg>
                Reference burned-area perimeter
              </li>
              <li className="flex items-center gap-3">
                <svg width="28" height="20" aria-hidden="true">
                  <line x1="2" y1="10" x2="26" y2="10" stroke="var(--aw-data-line-casing-dark)" strokeWidth="3.5" />
                  <line x1="2" y1="10" x2="26" y2="10" stroke="var(--aw-data-line-casing-light)" strokeWidth="1.5" strokeDasharray="1 4" strokeLinecap="round" />
                </svg>
                SAR scene footprint
              </li>
              <li className="flex items-center gap-3">
                <svg width="28" height="20" aria-hidden="true">
                  <rect x="3" y="3" width="22" height="14" fill="var(--aw-data-change-mask-fill)" fillOpacity="0.4" stroke="var(--aw-data-line-casing-dark)" strokeWidth="3" />
                  <rect x="3" y="3" width="22" height="14" fill="none" stroke="var(--aw-data-line-casing-light)" strokeWidth="1.2" />
                </svg>
                Change mask (analysis output, not burned area)
              </li>
              <li className="flex items-center gap-3">
                <svg width="28" height="20" aria-hidden="true">
                  <defs>
                    <pattern id="hatch-preview" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="5" stroke="var(--aw-data-no-data-hatch)" strokeWidth="1.5" />
                    </pattern>
                  </defs>
                  <rect x="3" y="3" width="22" height="14" fill="url(#hatch-preview)" stroke="var(--aw-color-border-strong)" />
                </svg>
                No data
              </li>
            </ul>

            <div className="grid gap-5">
              <figure>
                <figcaption className="mb-2 text-sm font-medium">Backscatter change (dB, post − pre)</figcaption>
                <div className="flex">
                  {CHANGE_STEPS.map((s) => (
                    <span key={s} className="h-5 flex-1 border border-border-strong" style={{ background: `var(--aw-data-change-${s})` }} title={s} />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>← Backscatter decrease</span><span>0</span><span>Backscatter increase →</span>
                </div>
              </figure>

              <figure>
                <figcaption className="mb-2 text-sm font-medium">
                  FIRMS detection density, not burned area{" "}
                  <span className="ml-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: "var(--aw-badge-mock-bg)", color: "var(--aw-badge-mock-fg)" }}>
                    PROVISIONAL COLOURS
                  </span>
                </figcaption>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className="h-5 flex-1 border border-border-strong" style={{ background: `var(--aw-data-density-${i})` }} />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>Fewer detections per cell</span><span>More detections per cell</span>
                </div>
              </figure>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
