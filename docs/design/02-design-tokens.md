# 02: Design Tokens

**Stage:** D.2 (approved) · **Amendment 1:** Stage F0 (FIRMS detection-density heatmap palette) · **Amendment 2:** integrated frontend palette, natural basemap, Light default (§14)
**Machine-readable source:** [`tokens.json`](tokens.json) (W3C Design Tokens / DTCG format).
Every value in this document is generated from the same data as `tokens.json`, and the two are
cross-checked by validation test V6.

> Implemented in code: `frontend/src/styles/tokens.css` is generated from `tokens.json` (`npm run tokens`).

## 1. Origins

Every colour token records where it comes from (`$extensions.astera.origin` in `tokens.json`):

| Origin | Meaning |
|---|---|
| **sampled** | Exactly a value measured from the logo in D.1 ([01-visual-identity.md](01-visual-identity.md) §3.1) |
| **derived** | A tint or shade of a sampled colour, adjusted for contrast. Not measured. |
| **proposed** | A new design choice (no source in the logo) |

## 2. Theme colour tokens

Paths in `tokens.json`: `color.theme.dark.<token>` and `color.theme.light.<token>`.

| Token | Dark | Dark origin | Light | Light origin | Role |
|---|---|---|---|---|---|
| `bg` | `#0A1128` | derived | `#F5F7FB` | derived | Page background |
| `surface` | `#16203A` | derived | `#FFFFFF` | proposed | Cards, panels, header |
| `surface-raised` | `#1E2A47` | derived | `#EDF1F8` | derived | Hover and raised controls |
| `text` | `#CBD5E1` | derived | `#27324D` | derived | Normal text |
| `text-muted` | `#8A93A8` | derived | `#58627C` | derived | Secondary text, captions |
| `primary` | `#A9BEE8` | derived | `#2F4275` | derived | Links, primary button fill, active nav |
| `on-primary` | `#0A1128` | derived | `#FFFFFF` | proposed | Text/icons on primary fill |
| `accent` | `#B8A6EE` | derived | `#5E4A9E` | derived | Highlights |
| `border-subtle` | `#24304F` | derived | `#DCE2EE` | derived | Card edges and dividers (decorative only) |
| `border-strong` | `#6B7899` | derived | `#6F7B9E` | derived | Input/control boundaries, legend swatch outlines |
| `focus-ring` | `#A9BEE8` | derived | `#2F4275` | derived | Default focus indicator |
| `success` | `#4ADE80` | proposed | `#15803D` | proposed | Success text and icons |
| `warning` | `#FBBF24` | proposed | `#A15C07` | proposed | Warning text and icons |
| `danger` | `#F87171` | proposed | `#B91C1C` | proposed | Error text and icons |
| `map-placeholder` | `#3A4851` | derived | `#A6C0D2` | derived | Map water (shown until relief tiles load) and map container |
| `text-strong` | `#FFFFFF` | derived | `#0A1128` | derived | Headings and key figures |
| `map-land` | `#3B3A33` | derived | `#E8E1CF` | derived | Map land fallback under the relief raster |
| `planned-bg` | `#16203A` | derived | `#EEF2FA` | derived | 'Planned' / 'Coming soon' badge fill (text and border: primary) |
| `map-outline` | `#E2E8F0` | derived | `#0B1634` | derived | Density-square outlines and country borders on the map |

Notes:
- `border-subtle` is **decorative only** and is never the only way to identify a control.
- `map-placeholder`, `map-land` and `map-outline` belong to the natural basemap (§14.2). Current values: Amendment 2.

## 3. Scientific data palette

Data colours are **defined once** (`color.data.*`) and are **identical in both themes**.
Brand colours (blue, purple) are **never** used to encode data.

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `color.data.fire-detection` | `#D94100` | proposed | Orange-red chosen for >=3.5:1 on all six backgrounds |
| `color.data.line-casing-light` | `#FFFFFF` | proposed | White |
| `color.data.line-casing-dark` | `#0B1634` | sampled | Badge inner disc median (01 §3.1) |
| `color.data.change-mask-fill` | `#D81B8C` | proposed | Magenta, distinct from fire, brand and BrBG hues |
| `color.data.no-data-hatch` | `#6B7280` | proposed | Neutral grey |
| `color.data.change-scale.decrease-strong` | `#8C510A` | proposed | ColorBrewer BrBG 7-class (colour-blind safe) |
| `color.data.change-scale.decrease` | `#D8B365` | proposed | ColorBrewer BrBG 7-class (colour-blind safe) |
| `color.data.change-scale.decrease-weak` | `#F6E8C3` | proposed | ColorBrewer BrBG 7-class (colour-blind safe) |
| `color.data.change-scale.neutral` | `#F5F5F5` | proposed | ColorBrewer BrBG 7-class (colour-blind safe) |
| `color.data.change-scale.increase-weak` | `#C7EAE5` | proposed | ColorBrewer BrBG 7-class (colour-blind safe) |
| `color.data.change-scale.increase` | `#5AB4AC` | proposed | ColorBrewer BrBG 7-class (colour-blind safe) |
| `color.data.change-scale.increase-strong` | `#01665E` | proposed | ColorBrewer BrBG 7-class (colour-blind safe) |
| `color.data.detection-density.level-1` | `#FEEDDE` | proposed | ColorBrewer Oranges 5-class (sequential, single fire hue) |
| `color.data.detection-density.level-2` | `#FDBE85` | proposed | ColorBrewer Oranges 5-class (sequential, single fire hue) |
| `color.data.detection-density.level-3` | `#FD8D3C` | proposed | ColorBrewer Oranges 5-class (sequential, single fire hue) |
| `color.data.detection-density.level-4` | `#E6550D` | proposed | ColorBrewer Oranges 5-class (sequential, single fire hue) |
| `color.data.detection-density.level-5` | `#A63603` | proposed | ColorBrewer Oranges 5-class (sequential, single fire hue) |

### 3.1 Meanings and rules

| Layer | Symbol | Rule |
|---|---|---|
| **FIRMS active-fire detection** | Filled circle `color.data.fire-detection`, diameter `size.fire-detection-point`, 1 px halo in the page background colour | A satellite **thermal detection point**, **not** a burned area. Legend wording: "Active-fire detection (FIRMS)". Never drawn as an area. |
| **Reference burned-area perimeter** | Dashed double line (`stroke.reference-perimeter`): `line-casing-dark` casing (`size.data-casing`) under a `line-casing-light` dashed line (`size.data-line`). **No fill.** | Independent reference data only. Legend wording: "Reference burned-area perimeter (source: …)". |
| **SAR scene footprint** | Dotted double line (`stroke.scene-footprint`), same colours | Acquisition coverage, not a result. |
| **Backscatter change (dB)** | 7-step BrBG scale (`color.data.change-scale.*`) | Post minus pre, in dB, diverging around 0. Legend: "Backscatter decrease (dB)" ← neutral → "Backscatter increase (dB)". **Neither direction is labelled "burned"**: fire effects on backscatter depend on vegetation, moisture, roughness, geometry, frequency and polarization. Legend swatches always have a 1 px `border-strong` outline and numeric labels. |
| **Change mask** | Solid double-line boundary (`stroke.change-mask-boundary`) + `change-mask-fill` at `opacity.change-mask-fill` | An analysis output (threshold-based), **not** a confirmed burned area. The **boundary** identifies it; the fill adds meaning but is **not relied on** for visibility (composited fill contrast is only 1.03–1.93, see §8.5). |
| **No data** | Diagonal hatch, `no-data-hatch` lines on transparent | Pixels without valid data. Never shown as "no change". |
| **FIRMS detection density** *(Amendment 1)* | Heatmap, 5-level sequential palette `color.data.detection-density.level-1…5` | Aggregated count of FIRMS detections in the selected time window. Legend wording, exactly: **"FIRMS detection density, not burned area"**. See §3.2. |

Distinguishing features never rely on colour alone (WCAG 1.4.1): **shape** (point vs line vs area),
**line pattern** (dashed vs dotted vs solid), **pattern** (hatch) and **legend text**.

### 3.2 FIRMS detection-density heatmap (Amendment 1, Stage F0)

**What it represents:** the **aggregated number of FIRMS active-fire detections** per grid cell within the
**selected time window**. Nothing else.

**What it must never imply:**
- **Not burned area.** Density is not an area burned and is never drawn as, converted to, or labelled as burned-area polygons.
- **Not fire intensity.** Density counts detections; it doesn't use or show Fire Radiative Power (FRP) or any intensity measure.
- **Not a confirmed fire event.** Detections are thermal anomalies; clusters are candidates for investigation.

**Palette:** ColorBrewer **Oranges 5-class** (sequential, single fire hue): light = fewer detections, dark = more.
Lightness decreases strictly from level 1 to level 5 in normal vision and in all three colour-vision
simulations, and adjacent levels differ by ΔE ≥ 10 (§10.1).

**Legend (mandatory, every time the heatmap is shown):**
- Title, exactly: **"FIRMS detection density, not burned area"**
- **Numeric** class breaks for all 5 levels, with the unit "detections per cell" and the selected time window (dates)
- The FIRMS source badge
- Each swatch has a 1 px `border-strong` outline (≥ 3:1, rows C-N) and a text label

**Accessibility of the map layer itself:** against the map placeholder, the palette is below 3:1 at one end
in each theme (rows C-D19 to C-D28: the darkest level on the dark map, the lightest levels on the light map).
A sequential palette can't reach 3:1 against both a dark and a light background at both ends. Because the
heatmap's information must not depend on colour contrast alone, these are **mandatory** for Stage F:
1. The numeric legend above.
2. A **text alternative**: an accessible table (or list) of detection counts for the visible area and time
   window, reachable by keyboard and screen readers.
3. Values available on hover/focus (tooltip with the count and the time window).

**Zoom rule:** at low zoom the heatmap is shown; at high zoom it switches to individual detection points
(`fire-detection`). Both are never shown at full strength at the same time, and the legend switches with them.
Level 4 (`#E6550D`) is close to the point colour (ΔE ≈ 6.5), which is acceptable because both represent FIRMS
detections; the legend always says which one is shown.

## 4. Source badges and banner

Badge colours are fixed in both themes. Every badge **always shows its text**; colour is never the only cue.

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `color.badge.mock.background` | `#FFD60A` | proposed | 'MOCK DATA' badge background |
| `color.badge.mock.text` | `#1A1A1A` | proposed | 'MOCK DATA' badge text |
| `color.badge.sentinel-1-c-band.background` | `#3F5E5A` | proposed | 'SENTINEL-1 · C-band' badge background |
| `color.badge.sentinel-1-c-band.text` | `#FFFFFF` | proposed | 'SENTINEL-1 · C-band' badge text |
| `color.badge.nisar-l-band.background` | `#3A5594` | proposed | 'NISAR · L-band' badge background |
| `color.badge.nisar-l-band.text` | `#FFFFFF` | proposed | 'NISAR · L-band' badge text |
| `color.badge.nisar-s-band.background` | `#5A47A3` | proposed | 'NISAR · S-band' badge background |
| `color.badge.nisar-s-band.text` | `#FFFFFF` | proposed | 'NISAR · S-band' badge text |
| `color.badge.nisar-band-not-available.background` | `#5B6170` | proposed | 'NISAR · band not available' badge background |
| `color.badge.nisar-band-not-available.text` | `#FFFFFF` | proposed | 'NISAR · band not available' badge text |
| `color.badge.firms.background` | `#B23C06` | proposed | 'FIRMS' badge background |
| `color.badge.firms.text` | `#FFFFFF` | proposed | 'FIRMS' badge text |
| `color.badge.reference.background` | `#4A5578` | proposed | 'REFERENCE' badge background |
| `color.badge.reference.text` | `#FFFFFF` | proposed | 'REFERENCE' badge text |

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `color.banner.mock.background` | `#FFD60A` | proposed | MOCK DATA banner background (both themes) |
| `color.banner.mock.text` | `#1A1A1A` | proposed | MOCK DATA banner text (both themes) |
| `color.banner.mock.stripe` | `#1A1A1A` | proposed | MOCK DATA banner striped edge (both themes) |
| `color.banner.mock.focus-ring` | `#1A1A1A` | proposed | Focus ring for links/buttons inside the MOCK banner |

Rules:
- **NISAR L-band and NISAR S-band are separate badges.** Show only the band(s) a product actually provides.
- If the product metadata doesn't state the band, show **"NISAR · band not available"**. The band is **never guessed**.
- Sentinel-1 is always labelled **C-band** and never presented as NISAR.
- There is **no** generic "NISAR" colour token.
- **MOCK DATA** uses the same yellow as the MOCK banner, which has a striped edge (`stripe`).

## 5. Other tokens

### 5.1 Typography values
Usage rules (hierarchy, units, number formats) follow in D.3. All three families are SIL Open Font
License fonts, to be bundled locally in Stage 7 (no CDN).

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `font.family.heading` | `Montserrat, Segoe UI, Arial, sans-serif` | - | Headings and wordmark (SIL OFL; bundle locally in Stage 7) |
| `font.family.body` | `Inter, Segoe UI, Arial, sans-serif` | - | Body text (SIL OFL; bundle locally in Stage 7) |
| `font.family.mono` | `JetBrains Mono, Consolas, monospace` | - | Numbers, coordinates, IDs (SIL OFL; bundle locally in Stage 7) |
| `font.size.xs` | `12px` | - | Font size xs |
| `font.size.sm` | `14px` | - | Font size sm |
| `font.size.base` | `16px` | - | Font size base |
| `font.size.lg` | `18px` | - | Font size lg |
| `font.size.xl` | `20px` | - | Font size xl |
| `font.size.2xl` | `24px` | - | Font size 2xl |
| `font.size.3xl` | `30px` | - | Font size 3xl |
| `font.size.4xl` | `36px` | - | Font size 4xl |
| `font.weight.regular` | `400` | - | Font weight regular |
| `font.weight.medium` | `500` | - | Font weight medium |
| `font.weight.semibold` | `600` | - | Font weight semibold |
| `font.weight.bold` | `700` | - | Font weight bold |
| `font.line-height.tight` | `1.2` | - | Line height tight |
| `font.line-height.snug` | `1.35` | - | Line height snug |
| `font.line-height.normal` | `1.5` | - | Line height normal |
| `font.letter-spacing.wordmark` | `0.12em` | - | ASTERA WATCH wordmark |
| `font.letter-spacing.caps-heading` | `0.06em` | - | Uppercase headings |
| `font.letter-spacing.normal` | `0em` | - | Default |

### 5.2 Spacing, radius, sizes, focus geometry

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `space.0` | `0px` | - | Spacing step 0 |
| `space.0-5` | `2px` | - | Spacing step 0-5 |
| `space.1` | `4px` | - | Spacing step 1 |
| `space.2` | `8px` | - | Spacing step 2 |
| `space.3` | `12px` | - | Spacing step 3 |
| `space.4` | `16px` | - | Spacing step 4 |
| `space.5` | `20px` | - | Spacing step 5 |
| `space.6` | `24px` | - | Spacing step 6 |
| `space.8` | `32px` | - | Spacing step 8 |
| `space.10` | `40px` | - | Spacing step 10 |
| `space.12` | `48px` | - | Spacing step 12 |
| `space.16` | `64px` | - | Spacing step 16 |

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `radius.sm` | `4px` | - | Corner radius sm |
| `radius.md` | `8px` | - | Corner radius md |
| `radius.lg` | `12px` | - | Corner radius lg |
| `radius.xl` | `16px` | - | Corner radius xl |
| `radius.full` | `9999px` | - | Corner radius full |

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `size.sidebar-expanded` | `240px` | - | Sidebar width, expanded |
| `size.sidebar-collapsed` | `72px` | - | Sidebar width, collapsed |
| `size.header` | `56px` | - | Header height |
| `size.target-min` | `24px` | - | WCAG 2.2 SC 2.5.8 (AA) minimum target size, CSS px |
| `size.target-preferred` | `44px` | - | Preferred target size (matches SC 2.5.5, AAA) |
| `size.fire-detection-point` | `8px` | - | FIRMS point diameter |
| `size.data-line` | `1.5px` | - | Inner line of double-line symbols |
| `size.data-casing` | `3.5px` | - | Outer casing of double-line symbols |

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `focus.width` | `2px` | - | Focus ring thickness |
| `focus.offset` | `2px` | - | Gap between component and outset ring |
| `focus.inset` | `2px` | - | Inset ring distance inside items where no gap is possible |

### 5.3 Shadows, overlays and opacity

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `shadow.light.sm` | `{"color": "#0B163414", "offsetX": "0px", "offsetY": "1px", "blur": "2px", "spread": "0px"}` | - | Elevation sm (light theme) |
| `shadow.light.md` | `{"color": "#0B16341A", "offsetX": "0px", "offsetY": "4px", "blur": "12px", "spread": "0px"}` | - | Elevation md (light theme) |
| `shadow.light.lg` | `{"color": "#0B163424", "offsetX": "0px", "offsetY": "12px", "blur": "32px", "spread": "0px"}` | - | Elevation lg (light theme) |
| `shadow.dark.sm` | `{"color": "#00000066", "offsetX": "0px", "offsetY": "1px", "blur": "2px", "spread": "0px"}` | - | Elevation sm (dark theme) |
| `shadow.dark.md` | `{"color": "#00000080", "offsetX": "0px", "offsetY": "4px", "blur": "12px", "spread": "0px"}` | - | Elevation md (dark theme) |
| `shadow.dark.lg` | `{"color": "#00000099", "offsetX": "0px", "offsetY": "12px", "blur": "32px", "spread": "0px"}` | - | Elevation lg (dark theme) |

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `color.scrim.dark` | `#070E21` | sampled | Outer background median (01 §3.1) |
| `color.scrim.light` | `#0B1634` | sampled | Badge inner disc median (01 §3.1) |

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `opacity.disabled` | `0.5` | - | Disabled controls (exempt from contrast requirements) |
| `opacity.change-mask-fill` | `0.4` | - | Change-mask fill opacity |
| `opacity.scrim` | `0.6` | - | Dialog overlay scrim opacity |

### 5.4 Motion, layers, breakpoints, strokes

When the user has `prefers-reduced-motion: reduce`, **every** duration uses `motion.duration.reduced` (0 ms).

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `motion.duration.fast` | `120ms` | - | Hover, small state changes |
| `motion.duration.normal` | `200ms` | - | Panels, menus |
| `motion.duration.slow` | `320ms` | - | Sidebar collapse, assistant slide-over |
| `motion.duration.reduced` | `0ms` | - | All motion when prefers-reduced-motion: reduce |
| `motion.easing.standard` | `0, 0, 0.2, 1` | - | Standard ease-out |

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `z-index.base` | `0` | - | Layer: base |
| `z-index.sticky` | `10` | - | Layer: sticky |
| `z-index.sidebar` | `20` | - | Layer: sidebar |
| `z-index.header` | `30` | - | Layer: header |
| `z-index.overlay` | `40` | - | Layer: overlay |
| `z-index.dialog` | `50` | - | Layer: dialog |
| `z-index.toast` | `60` | - | Layer: toast |
| `z-index.tooltip` | `70` | - | Layer: tooltip |

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `breakpoint.sm` | `640px` | - | Breakpoint sm (confirmed in D.6) |
| `breakpoint.md` | `768px` | - | Breakpoint md (confirmed in D.6) |
| `breakpoint.lg` | `1024px` | - | Breakpoint lg (confirmed in D.6) |
| `breakpoint.xl` | `1280px` | - | Breakpoint xl (confirmed in D.6) |
| `breakpoint.2xl` | `1536px` | - | Breakpoint 2xl (confirmed in D.6) |

| Token | Value | Origin | Basis / description |
|---|---|---|---|
| `stroke.reference-perimeter` | `{"dashArray": ["6px", "4px"], "lineCap": "butt"}` | - | Reference burned-area perimeter: dashed double line, no fill |
| `stroke.scene-footprint` | `{"dashArray": ["1px", "4px"], "lineCap": "round"}` | - | SAR scene footprint: dotted double line, no fill |
| `stroke.change-mask-boundary` | `solid` | - | Change-mask boundary: solid double line + magenta fill |

## 6. WCAG 2.2 method

**Formula:** WCAG 2.2 relative luminance of sRGB colours (linearisation threshold 0.04045;
L = 0.2126 R + 0.7152 G + 0.0722 B) and contrast ratio (L1 + 0.05) / (L2 + 0.05).
Pass/fail uses the unrounded ratio; tables show 2 decimals.

| Success criterion | Level | How it's applied |
|---|---|---|
| 1.4.3 Contrast (Minimum) | **AA** | Text ≥ 4.5:1; large text (≥ 24 px, or ≥ 18.66 px bold) ≥ 3:1. This project checks all text at 4.5:1. |
| 1.4.11 Non-text Contrast | **AA** | ≥ 3:1 against adjacent colours for UI component boundaries and states, and for graphical objects needed to understand content (map symbols, legend swatches, chart marks, meaningful icons). |
| 1.4.1 Use of Color | **A** | Meaning is never carried by colour alone (shape, pattern, line style, text). |
| 2.4.7 Focus Visible | **AA** | Every focusable element shows a focus indicator (§7). |
| 2.4.11 Focus Not Obscured (Minimum) | **AA** | Focused elements are not fully hidden by sticky headers, the MOCK banner or the assistant panel. A **layout** rule, checked in D.6. |
| 2.4.13 Focus Appearance | **AAA** | **Not required for AA.** Kept as an **additional project target**: indicator at least as large as a 2 CSS px perimeter of the component, with ≥ 3:1 between focused and unfocused states. |
| 2.5.8 Target Size (Minimum) | **AA** | See §9. |

**Transparent colours** are always **composited** (alpha-blended in sRGB, as rendered) over each real
background before contrast is computed: change-mask fill, dialog scrim. Shadows don't carry information
and aren't contrast-checked.

**Exempt** (by WCAG definition, documented, never used as an excuse): disabled controls,
decorative dividers (`border-subtle`), the logo.

**Double-line symbols and rings** (white + navy): against **any** background colour, at least one of the
two lines reaches √(contrast between the two lines) = √17.82 = **4.22:1**.
This worst case is used for map symbols and for focus rings over maps and imagery, whose content is unknown.

## 7. Focus indicators

| Variant | Geometry | Colour | Used for |
|---|---|---|---|
| **Outset (default)** | `focus.width` 2 px ring, `focus.offset` 2 px gap | `color.theme.<theme>.focus-ring` | Buttons, inputs, tabs, toggles, links |
| **Inset** | 2 px ring, `focus.inset` 2 px inside the item | `color.theme.<theme>.focus-ring` | Sidebar nav items, menu items, table rows (no room for a gap) |
| **Media (double ring)** | White 2 px + navy 2 px | `line-casing-light` + `line-casing-dark` | Map controls, comparison slider handle, anything over map/imagery |
| **Banner** | Outset 2 px | `color.banner.mock.focus-ring` | Links/buttons inside the MOCK banner |

**How adjacency is checked:** with the 2 px gap, the ring's neighbouring colour on both sides is the
**container background** (the gap shows the container), so each component is checked against the
background it actually sits on, per theme. For inset rings, the neighbour is the **item's own fill**.
The ring vs the primary button fill is **not adjacent** (the gap separates them) and is reported for information only.

## 8. Contrast results

All ratios are recomputed from `tokens.json` by validation test V5.

### 8.1 Text (1.4.3, min 4.5:1)
| ID | Check | Foreground | Background | Ratio | Min | Result |
|---|---|---|---|---:|---|---|
| C-T01 | text on bg (dark) | `color.theme.dark.text` → `#FAFCFC` | `color.theme.dark.bg` → `#070E21` | 18.65 | 4.5 | PASS |
| C-T02 | text-muted on bg (dark) | `color.theme.dark.text-muted` → `#A9B4D0` | `color.theme.dark.bg` → `#070E21` | 9.26 | 4.5 | PASS |
| C-T03 | primary on bg (dark) | `color.theme.dark.primary` → `#6E90C2` | `color.theme.dark.bg` → `#070E21` | 5.88 | 4.5 | PASS |
| C-T04 | accent on bg (dark) | `color.theme.dark.accent` → `#A393E6` | `color.theme.dark.bg` → `#070E21` | 7.20 | 4.5 | PASS |
| C-T05 | success on bg (dark) | `color.theme.dark.success` → `#4ADE80` | `color.theme.dark.bg` → `#070E21` | 11.02 | 4.5 | PASS |
| C-T06 | warning on bg (dark) | `color.theme.dark.warning` → `#FBBF24` | `color.theme.dark.bg` → `#070E21` | 11.50 | 4.5 | PASS |
| C-T07 | danger on bg (dark) | `color.theme.dark.danger` → `#F87171` | `color.theme.dark.bg` → `#070E21` | 6.94 | 4.5 | PASS |
| C-T08 | text on surface (dark) | `color.theme.dark.text` → `#FAFCFC` | `color.theme.dark.surface` → `#0B1634` | 17.30 | 4.5 | PASS |
| C-T09 | text-muted on surface (dark) | `color.theme.dark.text-muted` → `#A9B4D0` | `color.theme.dark.surface` → `#0B1634` | 8.59 | 4.5 | PASS |
| C-T10 | primary on surface (dark) | `color.theme.dark.primary` → `#6E90C2` | `color.theme.dark.surface` → `#0B1634` | 5.46 | 4.5 | PASS |
| C-T11 | accent on surface (dark) | `color.theme.dark.accent` → `#A393E6` | `color.theme.dark.surface` → `#0B1634` | 6.68 | 4.5 | PASS |
| C-T12 | success on surface (dark) | `color.theme.dark.success` → `#4ADE80` | `color.theme.dark.surface` → `#0B1634` | 10.23 | 4.5 | PASS |
| C-T13 | warning on surface (dark) | `color.theme.dark.warning` → `#FBBF24` | `color.theme.dark.surface` → `#0B1634` | 10.67 | 4.5 | PASS |
| C-T14 | danger on surface (dark) | `color.theme.dark.danger` → `#F87171` | `color.theme.dark.surface` → `#0B1634` | 6.44 | 4.5 | PASS |
| C-T15 | text on surface-raised (dark) | `color.theme.dark.text` → `#FAFCFC` | `color.theme.dark.surface-raised` → `#14224A` | 15.02 | 4.5 | PASS |
| C-T16 | text-muted on surface-raised (dark) | `color.theme.dark.text-muted` → `#A9B4D0` | `color.theme.dark.surface-raised` → `#14224A` | 7.46 | 4.5 | PASS |
| C-T17 | primary on surface-raised (dark) | `color.theme.dark.primary` → `#6E90C2` | `color.theme.dark.surface-raised` → `#14224A` | 4.74 | 4.5 | PASS |
| C-T18 | accent on surface-raised (dark) | `color.theme.dark.accent` → `#A393E6` | `color.theme.dark.surface-raised` → `#14224A` | 5.80 | 4.5 | PASS |
| C-T19 | success on surface-raised (dark) | `color.theme.dark.success` → `#4ADE80` | `color.theme.dark.surface-raised` → `#14224A` | 8.88 | 4.5 | PASS |
| C-T20 | warning on surface-raised (dark) | `color.theme.dark.warning` → `#FBBF24` | `color.theme.dark.surface-raised` → `#14224A` | 9.27 | 4.5 | PASS |
| C-T21 | danger on surface-raised (dark) | `color.theme.dark.danger` → `#F87171` | `color.theme.dark.surface-raised` → `#14224A` | 5.59 | 4.5 | PASS |
| C-T22 | on-primary text on primary fill (dark) | `color.theme.dark.on-primary` → `#070E21` | `color.theme.dark.primary` → `#6E90C2` | 5.88 | 4.5 | PASS |
| C-T23 | text on bg (light) | `color.theme.light.text` → `#0B1634` | `color.theme.light.bg` → `#F5F7FC` | 16.62 | 4.5 | PASS |
| C-T24 | text-muted on bg (light) | `color.theme.light.text-muted` → `#4A5578` | `color.theme.light.bg` → `#F5F7FC` | 6.85 | 4.5 | PASS |
| C-T25 | primary on bg (light) | `color.theme.light.primary` → `#3A5594` | `color.theme.light.bg` → `#F5F7FC` | 6.74 | 4.5 | PASS |
| C-T26 | accent on bg (light) | `color.theme.light.accent` → `#5A47A3` | `color.theme.light.bg` → `#F5F7FC` | 6.84 | 4.5 | PASS |
| C-T27 | success on bg (light) | `color.theme.light.success` → `#15803D` | `color.theme.light.bg` → `#F5F7FC` | 4.68 | 4.5 | PASS |
| C-T28 | warning on bg (light) | `color.theme.light.warning` → `#A15C07` | `color.theme.light.bg` → `#F5F7FC` | 4.84 | 4.5 | PASS |
| C-T29 | danger on bg (light) | `color.theme.light.danger` → `#B91C1C` | `color.theme.light.bg` → `#F5F7FC` | 6.04 | 4.5 | PASS |
| C-T30 | text on surface (light) | `color.theme.light.text` → `#0B1634` | `color.theme.light.surface` → `#FFFFFF` | 17.82 | 4.5 | PASS |
| C-T31 | text-muted on surface (light) | `color.theme.light.text-muted` → `#4A5578` | `color.theme.light.surface` → `#FFFFFF` | 7.34 | 4.5 | PASS |
| C-T32 | primary on surface (light) | `color.theme.light.primary` → `#3A5594` | `color.theme.light.surface` → `#FFFFFF` | 7.22 | 4.5 | PASS |
| C-T33 | accent on surface (light) | `color.theme.light.accent` → `#5A47A3` | `color.theme.light.surface` → `#FFFFFF` | 7.33 | 4.5 | PASS |
| C-T34 | success on surface (light) | `color.theme.light.success` → `#15803D` | `color.theme.light.surface` → `#FFFFFF` | 5.02 | 4.5 | PASS |
| C-T35 | warning on surface (light) | `color.theme.light.warning` → `#A15C07` | `color.theme.light.surface` → `#FFFFFF` | 5.19 | 4.5 | PASS |
| C-T36 | danger on surface (light) | `color.theme.light.danger` → `#B91C1C` | `color.theme.light.surface` → `#FFFFFF` | 6.47 | 4.5 | PASS |
| C-T37 | text on surface-raised (light) | `color.theme.light.text` → `#0B1634` | `color.theme.light.surface-raised` → `#FFFFFF` | 17.82 | 4.5 | PASS |
| C-T38 | text-muted on surface-raised (light) | `color.theme.light.text-muted` → `#4A5578` | `color.theme.light.surface-raised` → `#FFFFFF` | 7.34 | 4.5 | PASS |
| C-T39 | primary on surface-raised (light) | `color.theme.light.primary` → `#3A5594` | `color.theme.light.surface-raised` → `#FFFFFF` | 7.22 | 4.5 | PASS |
| C-T40 | accent on surface-raised (light) | `color.theme.light.accent` → `#5A47A3` | `color.theme.light.surface-raised` → `#FFFFFF` | 7.33 | 4.5 | PASS |
| C-T41 | success on surface-raised (light) | `color.theme.light.success` → `#15803D` | `color.theme.light.surface-raised` → `#FFFFFF` | 5.02 | 4.5 | PASS |
| C-T42 | warning on surface-raised (light) | `color.theme.light.warning` → `#A15C07` | `color.theme.light.surface-raised` → `#FFFFFF` | 5.19 | 4.5 | PASS |
| C-T43 | danger on surface-raised (light) | `color.theme.light.danger` → `#B91C1C` | `color.theme.light.surface-raised` → `#FFFFFF` | 6.47 | 4.5 | PASS |
| C-T44 | on-primary text on primary fill (light) | `color.theme.light.on-primary` → `#FFFFFF` | `color.theme.light.primary` → `#3A5594` | 7.22 | 4.5 | PASS |

### 8.2 Non-text UI components and states (1.4.11, min 3:1)
| ID | Check | Foreground | Background | Ratio | Min | Result |
|---|---|---|---|---:|---|---|
| C-N01 | border-strong (inputs, toggle/slider track, legend swatch outline) on bg (dark) | `color.theme.dark.border-strong` → `#6A7AA8` | `color.theme.dark.bg` → `#070E21` | 4.54 | 3 | PASS |
| C-N02 | border-strong (inputs, toggle/slider track, legend swatch outline) on surface (dark) | `color.theme.dark.border-strong` → `#6A7AA8` | `color.theme.dark.surface` → `#0B1634` | 4.21 | 3 | PASS |
| C-N03 | border-strong (inputs, toggle/slider track, legend swatch outline) on surface-raised (dark) | `color.theme.dark.border-strong` → `#6A7AA8` | `color.theme.dark.surface-raised` → `#14224A` | 3.66 | 3 | PASS |
| C-N04 | primary fill (checked box, slider thumb, icon button) on surface (dark) | `color.theme.dark.primary` → `#6E90C2` | `color.theme.dark.surface` → `#0B1634` | 5.46 | 3 | PASS |
| C-N05 | accent selected-state bar on surface-raised (dark) | `color.theme.dark.accent` → `#A393E6` | `color.theme.dark.surface-raised` → `#14224A` | 5.80 | 3 | PASS |
| C-N06 | border-strong (inputs, toggle/slider track, legend swatch outline) on bg (light) | `color.theme.light.border-strong` → `#7A86A8` | `color.theme.light.bg` → `#F5F7FC` | 3.38 | 3 | PASS |
| C-N07 | border-strong (inputs, toggle/slider track, legend swatch outline) on surface (light) | `color.theme.light.border-strong` → `#7A86A8` | `color.theme.light.surface` → `#FFFFFF` | 3.62 | 3 | PASS |
| C-N08 | border-strong (inputs, toggle/slider track, legend swatch outline) on surface-raised (light) | `color.theme.light.border-strong` → `#7A86A8` | `color.theme.light.surface-raised` → `#FFFFFF` | 3.62 | 3 | PASS |
| C-N09 | primary fill (checked box, slider thumb, icon button) on surface (light) | `color.theme.light.primary` → `#3A5594` | `color.theme.light.surface` → `#FFFFFF` | 7.22 | 3 | PASS |
| C-N10 | accent selected-state bar on surface-raised (light) | `color.theme.light.accent` → `#5A47A3` | `color.theme.light.surface-raised` → `#FFFFFF` | 7.33 | 3 | PASS |

### 8.3 Focus indicators per component and theme (2.4.7 + 1.4.11, min 3:1)
| ID | Check | Foreground | Background | Ratio | Min | Result |
|---|---|---|---|---:|---|---|
| C-F01 | Button on page background (dark) | `color.theme.dark.focus-ring` → `#9DBBF0` | `color.theme.dark.bg` → `#070E21` | 9.87 | 3 | PASS |
| C-F02 | Button in card (dark) | `color.theme.dark.focus-ring` → `#9DBBF0` | `color.theme.dark.surface` → `#0B1634` | 9.16 | 3 | PASS |
| C-F03 | Button in popover (dark) | `color.theme.dark.focus-ring` → `#9DBBF0` | `color.theme.dark.surface-raised` → `#14224A` | 7.96 | 3 | PASS |
| C-F04 | Primary button in card (ring vs gap) (dark) | `color.theme.dark.focus-ring` → `#9DBBF0` | `color.theme.dark.surface` → `#0B1634` | 9.16 | 3 | PASS |
| C-F05 | Input in card (dark) | `color.theme.dark.focus-ring` → `#9DBBF0` | `color.theme.dark.surface` → `#0B1634` | 9.16 | 3 | PASS |
| C-F06 | Sidebar nav item, default (inset ring vs item fill) (dark) | `color.theme.dark.focus-ring` → `#9DBBF0` | `color.theme.dark.surface` → `#0B1634` | 9.16 | 3 | PASS |
| C-F07 | Sidebar nav item, active (inset ring vs item fill) (dark) | `color.theme.dark.focus-ring` → `#9DBBF0` | `color.theme.dark.surface-raised` → `#14224A` | 7.96 | 3 | PASS |
| C-F08 | Menu item (inset ring vs item fill) (dark) | `color.theme.dark.focus-ring` → `#9DBBF0` | `color.theme.dark.surface-raised` → `#14224A` | 7.96 | 3 | PASS |
| C-F09 | Theme toggle / tabs in header (dark) | `color.theme.dark.focus-ring` → `#9DBBF0` | `color.theme.dark.surface` → `#0B1634` | 9.16 | 3 | PASS |
| C-F10 | Primary button: ring vs button fill - NOT adjacent (2px gap), reported for information (dark) | `color.theme.dark.focus-ring` → `#9DBBF0` | `color.theme.dark.primary` → `#6E90C2` | 1.68 | info | INFO |
| C-F11 | Button on page background (light) | `color.theme.light.focus-ring` → `#3A5594` | `color.theme.light.bg` → `#F5F7FC` | 6.74 | 3 | PASS |
| C-F12 | Button in card (light) | `color.theme.light.focus-ring` → `#3A5594` | `color.theme.light.surface` → `#FFFFFF` | 7.22 | 3 | PASS |
| C-F13 | Button in popover (light) | `color.theme.light.focus-ring` → `#3A5594` | `color.theme.light.surface-raised` → `#FFFFFF` | 7.22 | 3 | PASS |
| C-F14 | Primary button in card (ring vs gap) (light) | `color.theme.light.focus-ring` → `#3A5594` | `color.theme.light.surface` → `#FFFFFF` | 7.22 | 3 | PASS |
| C-F15 | Input in card (light) | `color.theme.light.focus-ring` → `#3A5594` | `color.theme.light.surface` → `#FFFFFF` | 7.22 | 3 | PASS |
| C-F16 | Sidebar nav item, default (inset ring vs item fill) (light) | `color.theme.light.focus-ring` → `#3A5594` | `color.theme.light.surface` → `#FFFFFF` | 7.22 | 3 | PASS |
| C-F17 | Sidebar nav item, active (inset ring vs item fill) (light) | `color.theme.light.focus-ring` → `#3A5594` | `color.theme.light.surface-raised` → `#FFFFFF` | 7.22 | 3 | PASS |
| C-F18 | Menu item (inset ring vs item fill) (light) | `color.theme.light.focus-ring` → `#3A5594` | `color.theme.light.surface-raised` → `#FFFFFF` | 7.22 | 3 | PASS |
| C-F19 | Theme toggle / tabs in header (light) | `color.theme.light.focus-ring` → `#3A5594` | `color.theme.light.surface` → `#FFFFFF` | 7.22 | 3 | PASS |
| C-F20 | Primary button: ring vs button fill - NOT adjacent (2px gap), reported for information (light) | `color.theme.light.focus-ring` → `#3A5594` | `color.theme.light.primary` → `#3A5594` | 1.00 | info | INFO |
| C-F21 | Map control over map / comparison slider over imagery: double ring (both themes) | `color.data.line-casing-light + color.data.line-casing-dark` → `#FFFFFF + #0B1634` | any colour (worst case) | 4.22 | 3 | PASS |
| C-F22 | Link or button inside MOCK banner (both themes) | `color.banner.mock.focus-ring` → `#1A1A1A` | `color.banner.mock.background` → `#FFD60A` | 12.33 | 3 | PASS |

### 8.4 Data symbols on backgrounds (1.4.11, min 3:1; FIRMS project target 3.5:1)
| ID | Check | Foreground | Background | Ratio | Min | Result |
|---|---|---|---|---:|---|---|
| C-D01 | FIRMS detection point on bg (dark) - project target 3.5 | `color.data.fire-detection` → `#D94100` | `color.theme.dark.bg` → `#070E21` | 4.30 | 3.5 | PASS |
| C-D02 | FIRMS detection point on surface (dark) - project target 3.5 | `color.data.fire-detection` → `#D94100` | `color.theme.dark.surface` → `#0B1634` | 3.99 | 3.5 | PASS |
| C-D03 | FIRMS detection point on map-placeholder (dark) - project target 3.5 | `color.data.fire-detection` → `#D94100` | `color.theme.dark.map-placeholder` → `#141C38` | 3.76 | 3.5 | PASS |
| C-D04 | FIRMS detection point on bg (light) - project target 3.5 | `color.data.fire-detection` → `#D94100` | `color.theme.light.bg` → `#F5F7FC` | 4.16 | 3.5 | PASS |
| C-D05 | FIRMS detection point on surface (light) - project target 3.5 | `color.data.fire-detection` → `#D94100` | `color.theme.light.surface` → `#FFFFFF` | 4.46 | 3.5 | PASS |
| C-D06 | FIRMS detection point on map-placeholder (light) - project target 3.5 | `color.data.fire-detection` → `#D94100` | `color.theme.light.map-placeholder` → `#E8ECF3` | 3.77 | 3.5 | PASS |
| C-D07 | No-data hatch on bg (dark) | `color.data.no-data-hatch` → `#6B7280` | `color.theme.dark.bg` → `#070E21` | 3.97 | 3 | PASS |
| C-D08 | No-data hatch on surface (dark) | `color.data.no-data-hatch` → `#6B7280` | `color.theme.dark.surface` → `#0B1634` | 3.69 | 3 | PASS |
| C-D09 | No-data hatch on map-placeholder (dark) | `color.data.no-data-hatch` → `#6B7280` | `color.theme.dark.map-placeholder` → `#141C38` | 3.47 | 3 | PASS |
| C-D10 | No-data hatch on bg (light) | `color.data.no-data-hatch` → `#6B7280` | `color.theme.light.bg` → `#F5F7FC` | 4.51 | 3 | PASS |
| C-D11 | No-data hatch on surface (light) | `color.data.no-data-hatch` → `#6B7280` | `color.theme.light.surface` → `#FFFFFF` | 4.83 | 3 | PASS |
| C-D12 | No-data hatch on map-placeholder (light) | `color.data.no-data-hatch` → `#6B7280` | `color.theme.light.map-placeholder` → `#E8ECF3` | 4.08 | 3 | PASS |
| C-D13 | Double line (perimeter, footprint, mask boundary) vs any background: worst case | `color.data.line-casing-light + color.data.line-casing-dark` → `#FFFFFF + #0B1634` | any colour (worst case) | 4.22 | 3 | PASS |
| C-D14 | Double line: light vs dark line (mutual separation) | `color.data.line-casing-light` → `#FFFFFF` | `color.data.line-casing-dark` → `#0B1634` | 17.82 | 3 | PASS |
| C-D15 | Change-scale end step 'decrease-strong' legend swatch vs surface (dark) - outline required where < 3 | `color.data.change-scale.decrease-strong` → `#8C510A` | `color.theme.dark.surface` → `#0B1634` | 2.80 | info | INFO |
| C-D16 | Change-scale end step 'increase-strong' legend swatch vs surface (dark) - outline required where < 3 | `color.data.change-scale.increase-strong` → `#01665E` | `color.theme.dark.surface` → `#0B1634` | 2.60 | info | INFO |
| C-D17 | Change-scale end step 'decrease-strong' legend swatch vs surface (light) - outline required where < 3 | `color.data.change-scale.decrease-strong` → `#8C510A` | `color.theme.light.surface` → `#FFFFFF` | 6.37 | info | INFO |
| C-D18 | Change-scale end step 'increase-strong' legend swatch vs surface (light) - outline required where < 3 | `color.data.change-scale.increase-strong` → `#01665E` | `color.theme.light.surface` → `#FFFFFF` | 6.85 | info | INFO |
| C-D19 | Detection-density level-1 vs map-placeholder (dark) - heatmap; see §3.2 for mitigations | `color.data.detection-density.level-1` → `#FEEDDE` | `color.theme.dark.map-placeholder` → `#141C38` | 14.67 | info | INFO |
| C-D20 | Detection-density level-2 vs map-placeholder (dark) - heatmap; see §3.2 for mitigations | `color.data.detection-density.level-2` → `#FDBE85` | `color.theme.dark.map-placeholder` → `#141C38` | 10.28 | info | INFO |
| C-D21 | Detection-density level-3 vs map-placeholder (dark) - heatmap; see §3.2 for mitigations | `color.data.detection-density.level-3` → `#FD8D3C` | `color.theme.dark.map-placeholder` → `#141C38` | 7.22 | info | INFO |
| C-D22 | Detection-density level-4 vs map-placeholder (dark) - heatmap; see §3.2 for mitigations | `color.data.detection-density.level-4` → `#E6550D` | `color.theme.dark.map-placeholder` → `#141C38` | 4.53 | info | INFO |
| C-D23 | Detection-density level-5 vs map-placeholder (dark) - heatmap; see §3.2 for mitigations | `color.data.detection-density.level-5` → `#A63603` | `color.theme.dark.map-placeholder` → `#141C38` | 2.51 | info | INFO |
| C-D24 | Detection-density level-1 vs map-placeholder (light) - heatmap; see §3.2 for mitigations | `color.data.detection-density.level-1` → `#FEEDDE` | `color.theme.light.map-placeholder` → `#E8ECF3` | 1.04 | info | INFO |
| C-D25 | Detection-density level-2 vs map-placeholder (light) - heatmap; see §3.2 for mitigations | `color.data.detection-density.level-2` → `#FDBE85` | `color.theme.light.map-placeholder` → `#E8ECF3` | 1.38 | info | INFO |
| C-D26 | Detection-density level-3 vs map-placeholder (light) - heatmap; see §3.2 for mitigations | `color.data.detection-density.level-3` → `#FD8D3C` | `color.theme.light.map-placeholder` → `#E8ECF3` | 1.96 | info | INFO |
| C-D27 | Detection-density level-4 vs map-placeholder (light) - heatmap; see §3.2 for mitigations | `color.data.detection-density.level-4` → `#E6550D` | `color.theme.light.map-placeholder` → `#E8ECF3` | 3.13 | info | INFO |
| C-D28 | Detection-density level-5 vs map-placeholder (light) - heatmap; see §3.2 for mitigations | `color.data.detection-density.level-5` → `#A63603` | `color.theme.light.map-placeholder` → `#E8ECF3` | 5.63 | info | INFO |

The light change-scale steps (`decrease-weak`, `neutral`, `increase-weak`) are near-white and the dark end
steps are close to the dark surface, so **every legend swatch has a 1 px `border-strong` outline** (C-N rows)
plus a text label. Raster pixels on the map are read through the labelled legend, not against the page.

### 8.5 Composited transparent overlays (informational)
| ID | Check | Foreground | Background | Ratio | Min | Result |
|---|---|---|---|---:|---|---|
| C-O01 | Change-mask fill @0.40 over bg (dark) - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#5B134C (composited)` | `color.theme.dark.bg` → `#070E21` | 1.50 | info | INFO |
| C-O02 | Change-mask fill @0.40 over surface (dark) - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#5D1857 (composited)` | `color.theme.dark.surface` → `#0B1634` | 1.47 | info | INFO |
| C-O03 | Change-mask fill @0.40 over map-placeholder (dark) - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#621C5A (composited)` | `color.theme.dark.map-placeholder` → `#141C38` | 1.46 | info | INFO |
| C-O04 | Change-mask fill @0.40 over bg (light) - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#E99FCF (composited)` | `color.theme.light.bg` → `#F5F7FC` | 1.90 | info | INFO |
| C-O05 | Change-mask fill @0.40 over surface (light) - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#EFA4D1 (composited)` | `color.theme.light.surface` → `#FFFFFF` | 1.93 | info | INFO |
| C-O06 | Change-mask fill @0.40 over map-placeholder (light) - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#E298CA (composited)` | `color.theme.light.map-placeholder` → `#E8ECF3` | 1.85 | info | INFO |
| C-O07 | Change-mask fill @0.40 over change-scale 'decrease-strong' - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#AA3B3E (composited)` | `color.data.change-scale.decrease-strong` → `#8C510A` | 1.03 | info | INFO |
| C-O08 | Change-mask fill @0.40 over change-scale 'decrease' - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#D87675 (composited)` | `color.data.change-scale.decrease` → `#D8B365` | 1.56 | info | INFO |
| C-O09 | Change-mask fill @0.40 over change-scale 'decrease-weak' - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#EA96AD (composited)` | `color.data.change-scale.decrease-weak` → `#F6E8C3` | 1.82 | info | INFO |
| C-O10 | Change-mask fill @0.40 over change-scale 'neutral' - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#E99ECB (composited)` | `color.data.change-scale.neutral` → `#F5F5F5` | 1.89 | info | INFO |
| C-O11 | Change-mask fill @0.40 over change-scale 'increase-weak' - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#CE97C1 (composited)` | `color.data.change-scale.increase-weak` → `#C7EAE5` | 1.85 | info | INFO |
| C-O12 | Change-mask fill @0.40 over change-scale 'increase' - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#8C779F (composited)` | `color.data.change-scale.increase` → `#5AB4AC` | 1.63 | info | INFO |
| C-O13 | Change-mask fill @0.40 over change-scale 'increase-strong' - fill not relied on | `color.data.change-mask-fill @ opacity.change-mask-fill` → `#574870 (composited)` | `color.data.change-scale.increase-strong` → `#01665E` | 1.19 | info | INFO |
| C-O14 | Dialog surface vs page under scrim @0.60 (dark) - dialog also has border-subtle + shadow | `color.theme.dark.surface` → `#0B1634` | `color.scrim.dark @ opacity.scrim OVER color.theme.dark.bg` → `#070E21 (composited)` | 1.08 | info | INFO |
| C-O15 | Dialog surface vs page under scrim @0.60 (light) - dialog also has border-subtle + shadow | `color.theme.light.surface` → `#FFFFFF` | `color.scrim.light @ opacity.scrim OVER color.theme.light.bg` → `#697084 (composited)` | 4.94 | info | INFO |

The composited change-mask fill stays below 3:1 everywhere (1.03–1.93), which confirms the rule in §3.1:
the **double-line boundary** (C-D double-line rows, ≥ 4.22:1) identifies the mask, not the fill.

### 8.6 Badges and banner (1.4.3, min 4.5:1)
| ID | Check | Foreground | Background | Ratio | Min | Result |
|---|---|---|---|---:|---|---|
| C-B01 | Badge 'mock' text on badge background | `color.badge.mock.text` → `#1A1A1A` | `color.badge.mock.background` → `#FFD60A` | 12.33 | 4.5 | PASS |
| C-B02 | Badge 'sentinel-1-c-band' text on badge background | `color.badge.sentinel-1-c-band.text` → `#FFFFFF` | `color.badge.sentinel-1-c-band.background` → `#3F5E5A` | 7.09 | 4.5 | PASS |
| C-B03 | Badge 'nisar-l-band' text on badge background | `color.badge.nisar-l-band.text` → `#FFFFFF` | `color.badge.nisar-l-band.background` → `#3A5594` | 7.22 | 4.5 | PASS |
| C-B04 | Badge 'nisar-s-band' text on badge background | `color.badge.nisar-s-band.text` → `#FFFFFF` | `color.badge.nisar-s-band.background` → `#5A47A3` | 7.33 | 4.5 | PASS |
| C-B05 | Badge 'nisar-band-not-available' text on badge background | `color.badge.nisar-band-not-available.text` → `#FFFFFF` | `color.badge.nisar-band-not-available.background` → `#5B6170` | 6.20 | 4.5 | PASS |
| C-B06 | Badge 'firms' text on badge background | `color.badge.firms.text` → `#FFFFFF` | `color.badge.firms.background` → `#B23C06` | 5.93 | 4.5 | PASS |
| C-B07 | Badge 'reference' text on badge background | `color.badge.reference.text` → `#FFFFFF` | `color.badge.reference.background` → `#4A5578` | 7.34 | 4.5 | PASS |
| C-B08 | MOCK banner text on banner background | `color.banner.mock.text` → `#1A1A1A` | `color.banner.mock.background` → `#FFD60A` | 12.33 | 4.5 | PASS |

### 8.7 FIRMS detection colour: final

`color.data.fire-detection` = **`#D94100`**, lowest ratio **3.76:1**
across the six backgrounds (page, surface and map placeholder in both themes): ≥ 3:1 (WCAG) and
≥ 3.5:1 (project target). With the earlier map placeholder values, no orange-red reached 3.5:1 on all
backgrounds, which is why `map-placeholder` was adjusted.

## 9. Target size (WCAG 2.2)

| Rule | Value |
|---|---|
| **SC 2.5.8 Target Size (Minimum), Level AA** | Pointer targets are at least **24 × 24 CSS px** (`size.target-min`) |
| **Preferred design target** | **44 × 44 CSS px** (`size.target-preferred`), matching SC 2.5.5 Target Size (Enhanced), Level AAA |

SC 2.5.8 exceptions (a smaller target is allowed only if one applies):
1. **Spacing:** the undersized target is positioned so that a 24 CSS px diameter circle centred on it
   doesn't intersect another target or the 24 px circle of another undersized target.
2. **Equivalent:** the same function is available through another control on the same page that meets 24 × 24.
3. **Inline:** the target is in a sentence or its size is otherwise constrained by the line height of non-target text.
4. **User agent control:** the size is determined by the browser and not modified by the author.
5. **Essential:** a particular presentation is essential or legally required.

Project rule: design every control at 44 × 44 unless layout makes that impossible; never go below 24 × 24
without documenting which exception applies. Map symbols in static design files aren't interactive targets.

## 10. Colour-vision-deficiency check (advisory)

Not a WCAG requirement. Colours were simulated with the **Machado et al. (2009)** matrices at full
severity (in linear RGB) and compared with **CIE76 ΔE** in CIELAB (D65). Pairs with ΔE < 20 are marked
"CLOSE"; those pairs must remain distinguishable by shape, pattern or text (which §3.1 already requires).

| Simulation | Colour A | Colour B | ΔE | Note |
|---|---|---|---:|---|
| normal vision | `fire-detection` | `change-mask-fill` | 76.8 | OK |
| normal vision | `fire-detection` | `no-data-hatch` | 90.3 | OK |
| normal vision | `fire-detection` | `change-scale.decrease-strong` | 41.5 | OK |
| normal vision | `fire-detection` | `change-scale.increase-strong` | 106.7 | OK |
| normal vision | `change-mask-fill` | `no-data-hatch` | 74.2 | OK |
| normal vision | `change-mask-fill` | `change-scale.decrease-strong` | 81.4 | OK |
| normal vision | `change-mask-fill` | `change-scale.increase-strong` | 102.7 | OK |
| normal vision | `no-data-hatch` | `change-scale.decrease-strong` | 58.9 | OK |
| normal vision | `no-data-hatch` | `change-scale.increase-strong` | 29.8 | OK |
| normal vision | `change-scale.decrease-strong` | `change-scale.increase-strong` | 68.0 | OK |
| protanopia | `fire-detection` | `change-mask-fill` | 78.2 | OK |
| protanopia | `fire-detection` | `no-data-hatch` | 57.3 | OK |
| protanopia | `fire-detection` | `change-scale.decrease-strong` | 5.9 | CLOSE |
| protanopia | `fire-detection` | `change-scale.increase-strong` | 47.5 | OK |
| protanopia | `change-mask-fill` | `no-data-hatch` | 22.8 | OK |
| protanopia | `change-mask-fill` | `change-scale.decrease-strong` | 74.5 | OK |
| protanopia | `change-mask-fill` | `change-scale.increase-strong` | 30.8 | OK |
| protanopia | `no-data-hatch` | `change-scale.decrease-strong` | 54.3 | OK |
| protanopia | `no-data-hatch` | `change-scale.increase-strong` | 12.3 | CLOSE |
| protanopia | `change-scale.decrease-strong` | `change-scale.increase-strong` | 43.8 | OK |
| deuteranopia | `fire-detection` | `change-mask-fill` | 65.3 | OK |
| deuteranopia | `fire-detection` | `no-data-hatch` | 69.3 | OK |
| deuteranopia | `fire-detection` | `change-scale.decrease-strong` | 18.2 | CLOSE |
| deuteranopia | `fire-detection` | `change-scale.increase-strong` | 67.5 | OK |
| deuteranopia | `change-mask-fill` | `no-data-hatch` | 6.6 | CLOSE |
| deuteranopia | `change-mask-fill` | `change-scale.decrease-strong` | 53.1 | OK |
| deuteranopia | `change-mask-fill` | `change-scale.increase-strong` | 16.3 | CLOSE |
| deuteranopia | `no-data-hatch` | `change-scale.decrease-strong` | 55.8 | OK |
| deuteranopia | `no-data-hatch` | `change-scale.increase-strong` | 11.4 | CLOSE |
| deuteranopia | `change-scale.decrease-strong` | `change-scale.increase-strong` | 52.1 | OK |
| tritanopia | `fire-detection` | `change-mask-fill` | 18.6 | CLOSE |
| tritanopia | `fire-detection` | `no-data-hatch` | 93.2 | OK |
| tritanopia | `fire-detection` | `change-scale.decrease-strong` | 48.4 | OK |
| tritanopia | `fire-detection` | `change-scale.increase-strong` | 113.9 | OK |
| tritanopia | `change-mask-fill` | `no-data-hatch` | 85.7 | OK |
| tritanopia | `change-mask-fill` | `change-scale.decrease-strong` | 42.0 | OK |
| tritanopia | `change-mask-fill` | `change-scale.increase-strong` | 107.5 | OK |
| tritanopia | `no-data-hatch` | `change-scale.decrease-strong` | 46.6 | OK |
| tritanopia | `no-data-hatch` | `change-scale.increase-strong` | 23.3 | OK |
| tritanopia | `change-scale.decrease-strong` | `change-scale.increase-strong` | 66.6 | OK |

**BrBG lightness ordering** (L* of the 7 steps, from `decrease-strong` to `increase-strong`; must rise to
the neutral centre and fall again):

| Simulation | L* per step | Order |
|---|---|---|
| normal vision | 40.4 / 74.7 / 92.2 / 96.5 / 90.2 / 67.9 / 38.4 | OK |
| protanopia | 36.9 / 72.5 / 91.4 / 96.5 / 91.2 / 70.3 / 40.5 | OK |
| deuteranopia | 42.4 / 76.0 / 92.8 / 96.5 / 89.4 / 66.2 / 36.9 | OK |
| tritanopia | 40.1 / 74.3 / 92.0 / 96.5 / 90.1 / 67.8 / 39.5 | OK |

### 10.1 Detection-density palette (Amendment 1): mandatory criteria

Pass criteria: lightness (L*) **strictly decreasing** from level 1 to level 5, and the **smallest ΔE between
adjacent levels ≥ 10**, in normal vision and all three simulations.

| Simulation | L* level 1 → 5 | Strictly decreasing | Min adjacent ΔE | Result |
|---|---|---|---:|---|
| normal vision | 94.7 / 81.5 / 69.7 / 55.4 / 39.2 | yes | 22.4 | PASS |
| protanopia | 93.9 / 78.4 / 63.8 / 47.2 / 32.4 | yes | 16.6 | PASS |
| deuteranopia | 95.2 / 83.4 / 73.1 / 59.9 / 42.9 | yes | 13.4 | PASS |
| tritanopia | 94.2 / 79.4 / 66.1 / 55.2 / 39.0 | yes | 22.5 | PASS |

## 11. Validation

**Original D.2 validation (2026-11-10, before Amendment 1), kept unchanged as a historical record:**

<!-- VALIDATION-RESULTS -->
Validation was run on 2026-11-10 with a read-only script outside the repository, which reads only
`tokens.json`, this document, `01-visual-identity.md` and the Git state, and recomputes every value
independently. **All tests passed.**

| Test | What it checks | Result |
|---|---|---|
| V1 | `tokens.json` parses; every token has `$value`, `$type` and `$description` | ✅ PASS: 141 tokens, no problems |
| V2 | Value formats (colours, dimensions, durations, font families and weights, shadows, strokes, opacity range) | ✅ PASS: no invalid values |
| V3 | Light and dark themes define the same tokens; shadows and scrim exist for both | ✅ PASS: 15 / 15 theme tokens, no differences |
| V4 | Every colour token has an origin; every **sampled** value appears exactly in `01-visual-identity.md` §3 | ✅ PASS: 9 sampled tokens, all found |
| V5 | Every contrast row recomputed from `tokens.json` (including composited overlays and the double-line worst case) | ✅ PASS: **117 contrast rows, 0 failures**, 0 differences between the document and recomputed values |
| V6 | Every token value and origin in this document equals `tokens.json`; every JSON token is documented | ✅ PASS: **141 / 141 tokens documented**, 0 differences |
| V7 | Data palette defined once (not per theme); separate NISAR L-band and S-band badges; no generic NISAR colour | ✅ PASS |
| V8 | Colour-vision-deficiency simulation (advisory) | ✅ Ran: 7 close pairs, listed below |
| V9 | Scope: only the three approved D.2 files changed; all other files, tags and branches unchanged; nothing committed or pushed at validation time | ✅ PASS |

**FIRMS detection colour (final):** `#D94100`, minimum contrast **3.76:1** (on the dark map placeholder);
3.76–4.46:1 across all six backgrounds, meeting both WCAG 1.4.11 (3:1) and the project target (3.5:1).

**Close colour-vision pairs (ΔE < 20) and how the design keeps them apart:**

| Simulation | Pair | ΔE | Distinguished by |
|---|---|---:|---|
| Protanopia | FIRMS fire detection vs strongest backscatter decrease step | 5.9 | **Shape:** fire is a small point with a halo; the change scale is a continuous raster read through its labelled legend |
| Protanopia | No-data hatch vs strongest backscatter increase step | 12.3 | **Pattern:** no-data is a diagonal hatch, never a solid fill |
| Deuteranopia | FIRMS fire detection vs strongest backscatter decrease step | 18.2 | **Shape:** point vs raster, plus legend text |
| Deuteranopia | Change-mask fill vs no-data hatch | 6.6 | **Pattern and line:** the mask has a solid double-line boundary; no-data is a hatch without a boundary |
| Deuteranopia | Change-mask fill vs strongest backscatter increase step | 16.3 | **Line:** solid double-line mask boundary over the raster, plus the "Change mask" legend entry |
| Deuteranopia | No-data hatch vs strongest backscatter increase step | 11.4 | **Pattern:** hatch vs solid raster |
| Tritanopia | FIRMS fire detection vs change-mask fill | 18.6 | **Shape:** point vs bounded area, plus legend text |

In every case colour is supported by shape, pattern or line style **and** a text label (WCAG 1.4.1).
The BrBG change scale keeps its lightness order (dark → light → dark) in all four simulations.
<!-- /VALIDATION-RESULTS -->

**Amendment 1 re-validation (Stage F0):**

<!-- AMENDMENT-1-RESULTS -->
Run on 2026-11-11 with the same read-only, independent validator (outside the repository), extended with
mandatory test V10 for the heatmap palette. **All mandatory tests passed.**

| Test | Result |
|---|---|
| V1 JSON structure | ✅ PASS: 146 tokens (141 + 5 detection-density levels) |
| V2 value formats | ✅ PASS |
| V3 light/dark token parity | ✅ PASS: 15 / 15 |
| V4 origins and sampled values | ✅ PASS: 9 sampled tokens, unchanged |
| V5 contrast recomputed from JSON | ✅ PASS: **127 contrast rows** (117 original + 10 informational density rows), **0 failures**, 0 differences; FIRMS detection minimum unchanged at 3.76:1 |
| V6 document ↔ JSON | ✅ PASS: **146 / 146 tokens documented**, 0 differences |
| V7 data palette and band rules | ✅ PASS |
| V8 colour-vision check (advisory) | ✅ Ran: the same 7 close pairs as in the original validation; no new close pairs |
| **V10 detection-density palette** (new, mandatory) | ✅ PASS: 5 levels; L* strictly decreasing and minimum adjacent ΔE ≥ 10 in normal vision and all three simulations (§10.1, lowest 13.4 in deuteranopia); exact legend text present in `tokens.json` and in §3.1 and §3.2; no intensity or burned-area naming; numeric legend and text alternative required |
| V9 scope | ✅ PASS: only the four Stage F0 files changed; no other file, tag or branch changed; nothing committed, pushed or installed at validation time |

No existing token value or contrast figure changed (the only removed line in this document is the old status header).
<!-- /AMENDMENT-1-RESULTS -->

## 12. Open items

| # | Item | When |
|---|---|---|
| 1 | Typography usage, units and number formats | D.3 |
| 2 | Focus-not-obscured layout checks (2.4.11) and breakpoint confirmation | D.6 |
| 3 | Transparent PNG/SVG logo (team action from D.1) | Before Stage 7 |
| 4 | ~~Check contrast of real basemap styles against these data colours~~ Done for the Natural Earth relief basemap (§14.2) | Done |

## 13. Changelog

| Version | Date | Stage | Change |
|---|---|---|---|
| 1.0 | 2026-11-10 | D.2 | Initial design tokens, themes, scientific palette and WCAG checks (commit `accb77f`) |
| 1.1 | 2026-11-11 | F0 | **Amendment 1:** added `color.data.detection-density.level-1…5` (FIRMS detection-density heatmap, ColorBrewer Oranges 5-class), §3.1 row, §3.2, contrast rows C-D19 to C-D28, §10.1 and the Amendment 1 validation. No existing token value or contrast figure changed. |
| 1.2 | 2026-11-13 | F (frontend) | **Amendment 2:** theme palette (team's dark palette, coordinated Light), new theme tokens `text-strong`, `map-land`, `planned-bg`, `map-outline`; natural relief basemap and map rendering (§14.2); heat-spot double ring; Light as default theme. Proposed density ramp not applied (§14.1). Data colours unchanged. |

<!-- AMENDMENT-2 -->
## 14. Amendment 2: integrated frontend palette, natural basemap, Light default (2026-11-13)

Implemented in code (Stage F frontend cycle). §2 shows the current theme values; §8 keeps the D.2 contrast record of
the original values, and the checks for the current values are below. Data colours (§3, §4) are unchanged.

### 14.1 Theme palette

- **Dark** uses the team's proposed palette: background `#0A1128`, cards `#16203A`, card border `#24304F`, headings
  `#FFFFFF`, text `#CBD5E1`, muted `#8A93A8`, primary button `#A9BEE8` with `#0A1128` text, Planned badge `#16203A`
  fill with `#A9BEE8` text and border. Control outlines use `border-strong` `#6B7899`; the card border is decorative only.
- **Light** is designed alongside it, not inverted: cool off-white page, white cards, navy-tinted text, deep logo blue
  `#2F4275` for actions and focus.
- **Light is the default** for first visits (`DEFAULT_PREFERENCE` in `src/lib/theme/theme.ts`, mirrored in `index.html`),
  even when the device prefers dark. Dark and "Use system theme" remain one click away and the choice is remembered
  (`localStorage` key `astera-theme`).
- **Density colours:** the proposed ramp `#FFE0B2 #FFAB91 #FF7043 #F4511E #BF360C` was **not applied**: Middle vs High
  differ by ΔE 6.2 (deuteranopia 5.7, tritanopia 5.9), below the V10 floor. Darkening High to fix it (`#D84315`) would make
  it almost identical to the FIRMS point colour `#D94100` (ΔE 0.6). The provisional ramp of §3.2 stays until a new pair is
  chosen.

| Theme | Pair | Requirement | Ratio | |
|---|---|---|---|---|
| light | `text-strong` #0A1128 on `bg` #F5F7FB | text ≥ 4.5 | 17.42 | ✅ |
| light | `text` #27324D on `bg` #F5F7FB | text ≥ 4.5 | 11.87 | ✅ |
| light | `text` #27324D on `surface` #FFFFFF | text ≥ 4.5 | 12.73 | ✅ |
| light | `text-muted` #58627C on `surface` #FFFFFF | text ≥ 4.5 | 6.08 | ✅ |
| light | `text-muted` #58627C on `surface-raised` #EDF1F8 | text ≥ 4.5 | 5.37 | ✅ |
| light | `primary` #2F4275 on `surface` #FFFFFF | text ≥ 4.5 | 9.74 | ✅ |
| light | `on-primary` #FFFFFF on `primary` #2F4275 | text ≥ 4.5 | 9.74 | ✅ |
| light | `primary` #2F4275 on `planned-bg` #EEF2FA | text ≥ 4.5 | 8.68 | ✅ |
| light | `border-strong` #6F7B9E on `surface` #FFFFFF | non-text ≥ 3 | 4.20 | ✅ |
| light | `focus-ring` #2F4275 on `surface` #FFFFFF | non-text ≥ 3 | 9.74 | ✅ |
| light | `focus-ring` #2F4275 on `bg` #F5F7FB | non-text ≥ 3 | 9.08 | ✅ |
| dark | `text-strong` #FFFFFF on `bg` #0A1128 | text ≥ 4.5 | 18.69 | ✅ |
| dark | `text` #CBD5E1 on `bg` #0A1128 | text ≥ 4.5 | 12.59 | ✅ |
| dark | `text` #CBD5E1 on `surface` #16203A | text ≥ 4.5 | 10.87 | ✅ |
| dark | `text-muted` #8A93A8 on `surface` #16203A | text ≥ 4.5 | 5.24 | ✅ |
| dark | `text-muted` #8A93A8 on `surface-raised` #1E2A47 | text ≥ 4.5 | 4.62 | ✅ |
| dark | `primary` #A9BEE8 on `surface` #16203A | text ≥ 4.5 | 8.62 | ✅ |
| dark | `on-primary` #0A1128 on `primary` #A9BEE8 | text ≥ 4.5 | 9.98 | ✅ |
| dark | `primary` #A9BEE8 on `planned-bg` #16203A | text ≥ 4.5 | 8.62 | ✅ |
| dark | `border-strong` #6B7899 on `surface` #16203A | non-text ≥ 3 | 3.67 | ✅ |
| dark | `focus-ring` #A9BEE8 on `surface` #16203A | non-text ≥ 3 | 8.62 | ✅ |
| dark | `focus-ring` #A9BEE8 on `bg` #0A1128 | non-text ≥ 3 | 9.98 | ✅ |

### 14.2 Natural geographic basemap

| Layer | Source / token | Notes |
|---|---|---|
| Relief and land cover | Natural Earth I with Shaded Relief and Water, 1:50m (public domain) | Web Mercator JPEG tiles, zoom 0–4, `frontend/public/basemap/relief/` (see `SOURCE.txt`). Green = vegetated, tan/brown = dry or bare, white = ice, blue = water. A long-term, generalised picture: **not current vegetation, not fire or burn-scar data**. The map key says so. |
| Theme rendering (MapLibre raster paint) | Light: saturation −0.3, brightness 0.25–1 · Dark: saturation +0.4, brightness 0–0.42 | Muted and lifted in Light; dimmed, night-toned in Dark, with saturation raised so green, brown and blue stay distinguishable at low brightness. Fire symbols are never tinted. |
| Water / land fallbacks | `map-placeholder`, `map-land` | Shown only until tiles load. Water = the raster's own median water colour after theme rendering. |
| Density outlines, country borders | `map-outline` | Light `#0B1634`, Dark `#E2E8F0` (borders at 0.75 opacity). |
| Heat spot (FIRMS point) | `data.fire-detection` + `data.line-casing-light` + `data.line-casing-dark` | Dot, 1.5 px light ring, outer dark ring (radius 7 px). Same in both themes. Beyond zoom 4 the relief raster is enlarged and looks soft; the fire symbols stay sharp. |
| Possible-fire marker | unchanged | Dashed navy ring on a white casing. |

**Measured against every 8th pixel of the rendered 8192 × 8192 raster (1,048,576 pixels per theme):**

| Check | Light | Dark | Requirement |
|---|---|---|---|
| Heat-spot dot vs its light ring | 4.46:1 | 4.46:1 | ≥ 3 (1.4.11) |
| Heat-spot outer edge (better of light/dark ring) vs map | ≥ 5.01:1 everywhere | ≥ 5.32:1 everywhere | ≥ 3 |
| Fire colour vs map, colour difference ΔE (min, normal / protan / deutan / tritan) | 20.8 / 18.4 / 12.9 / 24.8 | 20.2 / 6.1 / 13.0 / 24.1 (protan ≥ 15 on 59% of pixels) | advisory; the rings carry identification |
| Possible-fire marker (white casing or navy ring) vs map | ≥ 5.01:1 | ≥ 5.32:1 | ≥ 3 |
| Density-square outline (`map-outline`) vs map | min 5.01:1 | min 5.32:1 (white); `#E2E8F0` min 4.32:1 | ≥ 3 |
| Fire dot alone vs map (for reference; the rings carry the contrast) | ≥ 3:1 on 32% of pixels | ≥ 3:1 on 0% (dark map) | not relied on |

The fire colour, density colours, detection values, density calculation and class breaks are unchanged.
<!-- /AMENDMENT-2 -->
