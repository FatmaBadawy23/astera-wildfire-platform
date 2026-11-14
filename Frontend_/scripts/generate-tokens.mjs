// Generates src/styles/tokens.css from the approved design tokens (docs/design/tokens.json).
// No dependencies. Run: npm run tokens   (the tokens test fails if the CSS is out of date)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const TOKENS_PATH = resolve(here, "../../docs/design/tokens.json");
export const CSS_PATH = resolve(here, "../src/styles/tokens.css");

const v = (t) => t.$value;
const shadow = (s) => `${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${s.color}`;
const family = (list) => list.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(", ");

export function generateCss(tokens) {
  const c = tokens.color;
  const out = [];
  out.push("/* AUTO-GENERATED from docs/design/tokens.json by scripts/generate-tokens.mjs. Do not edit by hand. */");

  const themeBlock = (name) => {
    const lines = [];
    for (const [k, t] of Object.entries(c.theme[name])) if (!k.startsWith("$")) lines.push(`  --aw-color-${k}: ${v(t)};`);
    for (const [k, t] of Object.entries(tokens.shadow[name])) lines.push(`  --aw-shadow-${k}: ${shadow(v(t))};`);
    lines.push(`  --aw-scrim: ${v(c.scrim[name])};`);
    lines.push(`  color-scheme: ${name};`);
    return lines;
  };
  out.push(":root,", ':root[data-theme="light"] {', ...themeBlock("light"), "}");
  out.push(':root[data-theme="dark"] {', ...themeBlock("dark"), "}");

  const g = [];
  const d = c.data;
  g.push(`  --aw-data-fire-detection: ${v(d["fire-detection"])};`);
  g.push(`  --aw-data-line-casing-light: ${v(d["line-casing-light"])};`);
  g.push(`  --aw-data-line-casing-dark: ${v(d["line-casing-dark"])};`);
  g.push(`  --aw-data-change-mask-fill: ${v(d["change-mask-fill"])};`);
  g.push(`  --aw-data-no-data-hatch: ${v(d["no-data-hatch"])};`);
  for (const [k, t] of Object.entries(d["change-scale"])) if (!k.startsWith("$")) g.push(`  --aw-data-change-${k}: ${v(t)};`);
  for (const [k, t] of Object.entries(d["detection-density"])) if (!k.startsWith("$")) g.push(`  --aw-data-density-${k.replace("level-", "")}: ${v(t)};`);
  for (const [k, b] of Object.entries(c.badge)) {
    g.push(`  --aw-badge-${k}-bg: ${v(b.background)};`);
    g.push(`  --aw-badge-${k}-fg: ${v(b.text)};`);
  }
  for (const [k, t] of Object.entries(c.banner.mock)) g.push(`  --aw-banner-mock-${k}: ${v(t)};`);
  for (const [k, t] of Object.entries(tokens.opacity)) g.push(`  --aw-opacity-${k}: ${v(t)};`);
  for (const [k, t] of Object.entries(tokens.font.family)) g.push(`  --aw-font-family-${k}: ${family(v(t))};`);
  for (const [k, t] of Object.entries(tokens.font.size)) g.push(`  --aw-font-size-${k}: ${v(t)};`);
  for (const [k, t] of Object.entries(tokens.font.weight)) g.push(`  --aw-font-weight-${k}: ${v(t)};`);
  for (const [k, t] of Object.entries(tokens.font["line-height"])) g.push(`  --aw-line-height-${k}: ${v(t)};`);
  for (const [k, t] of Object.entries(tokens.font["letter-spacing"])) g.push(`  --aw-letter-spacing-${k}: ${v(t)};`);
  for (const [k, t] of Object.entries(tokens.space)) g.push(`  --aw-space-${k}: ${v(t)};`);
  for (const [k, t] of Object.entries(tokens.radius)) g.push(`  --aw-radius-${k}: ${v(t)};`);
  for (const [k, t] of Object.entries(tokens.motion.duration)) g.push(`  --aw-duration-${k}: ${v(t)};`);
  g.push(`  --aw-ease-standard: cubic-bezier(${v(tokens.motion.easing.standard).join(", ")});`);
  for (const [k, t] of Object.entries(tokens["z-index"])) g.push(`  --aw-z-${k}: ${v(t)};`);
  for (const [k, t] of Object.entries(tokens.size)) g.push(`  --aw-size-${k}: ${v(t)};`);
  for (const [k, t] of Object.entries(tokens.focus)) g.push(`  --aw-focus-${k}: ${v(t)};`);
  out.push(":root {", ...g, "}");
  return out.join("\n") + "\n";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tokens = JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
  writeFileSync(CSS_PATH, generateCss(tokens), "utf8");
  console.log(`tokens.css written from ${TOKENS_PATH}`);
}
