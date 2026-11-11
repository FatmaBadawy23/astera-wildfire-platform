import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CSS_PATH, TOKENS_PATH, generateCss } from "../../scripts/generate-tokens.mjs";

const tokens = JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
const css = readFileSync(CSS_PATH, "utf8").replace(/\r\n/g, "\n");

describe("design tokens", () => {
  it("tokens.css is exactly what docs/design/tokens.json generates (run `npm run tokens` if this fails)", () => {
    expect(css).toBe(generateCss(tokens));
  });

  it("uses the approved sampled and data colours", () => {
    expect(css).toContain("--aw-color-bg: #070E21;"); // dark bg, sampled (D.1)
    expect(css).toContain("--aw-color-bg: #F5F7FC;"); // light bg
    expect(css).toContain("--aw-data-fire-detection: #D94100;"); // FIRMS points (D.2)
    for (let i = 1; i <= 5; i++) expect(css).toContain(`--aw-data-density-${i}: `); // provisional heatmap levels
  });

  it("defines every light/dark theme colour for both themes", () => {
    const keys = Object.keys(tokens.color.theme.dark).filter((k) => !k.startsWith("$"));
    for (const k of keys) expect(css.match(new RegExp(`--aw-color-${k}: `, "g"))?.length).toBe(2);
  });

  it("token breakpoints match Tailwind's default breakpoints used for responsive classes", () => {
    const bp = Object.fromEntries(Object.entries(tokens.breakpoint).map(([k, t]) => [k, (t as { $value: string }).$value]));
    expect(bp).toEqual({ sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" });
  });
});
