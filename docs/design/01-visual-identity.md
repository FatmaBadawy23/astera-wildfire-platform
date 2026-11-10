# 01: Visual Identity

**Stage:** D.1 · **Status:** 🔄 in review
**Scope:** logo analysis, colours sampled from the logo, name lockup, logo usage rules.
Final UI colour tokens (light/dark, contrast-checked) are defined in **D.2**
([02-design-tokens.md](02-design-tokens.md)). Nothing in this document modifies the logo.

---

## 1. Source file

| Property | Value |
|---|---|
| Path | `frontend/public/astera-logo.jpg` (read-only reference, unchanged) |
| SHA-256 | `3fe2d557e38744b905a28d42794c833d3b383696eeefd7e553c7cc5f645fe06f` |
| File size | 146,497 bytes |
| Format | JPEG (lossy compression) |
| Dimensions | **1000 × 1000 px** |
| Colour mode | **RGB**, 8 bits per channel |
| Embedded colour profile | ICC profile **"sRGB"**, so all values below are **sRGB** |
| Transparency | **None.** JPEG has no alpha channel; the badge sits on a dark square background (see §6). |

## 2. Logo anatomy

The logo is a circular badge centred at pixel **(500, 500)**:

| Element | Description | Approx. radius from centre (px)* |
|---|---|---|
| Outer background | Dark navy square, not uniform (subtle gradient and JPEG noise) | outside the badge |
| Badge outer edge | Edge of the circular badge | ≈ 318–324 |
| Outer ring | Blue ring, the brightest blue element | ≈ 290–303 |
| Lettering band | "ASTERA" (top arc), "M·N·F·Y·S" (bottom arc), ◆ ornaments left and right, all in white | between the rings |
| Inner ring | Second, darker blue ring | ≈ 207–219 |
| Inner disc | Deep navy field with small stars | inside the inner ring |
| Star and orbit | White faceted star, blue-violet outline, purple orbit strokes | ≲ 200 |

\*Measured from horizontal and vertical pixel profiles through the centre. These are approximations, not design specifications.

## 3. Sampled logo colours (measured)

All values in this section were **measured from the file** with a read-only Python script
run via `conda run -n astera` (Pillow + NumPy; the image was opened, converted in memory
to RGB and never written). Two kinds of values are reported, and they are **not interchangeable**:

- **Median sample:** the per-channel **median** of all pixels in a defined region or colour mask.
  This is the *representative* colour. JPEG compression and anti-aliasing mean individual
  pixels vary, so the 10th–90th percentile range is given.
- **Exact pixel:** the colour of **one single pixel** at the given coordinate. Shown for
  verification only, because single pixels can be affected by compression noise.

Coordinates: origin (0, 0) is the top-left corner; *x* to the right, *y* downward.
`r` = distance from the centre (500, 500). Masks use HSV: H = hue in degrees, S = saturation, V = value (0–1).

### 3.1 Median samples (representative colours)

| Logo element | Sampling region / mask | Pixels (n) | **Median RGB** | **HEX** | 10th–90th percentile range |
|---|---|---:|---|---|---|
| Outer background | Four 60 × 60 px corner boxes: (0–59, 0–59), (940–999, 0–59), (0–59, 940–999), (940–999, 940–999) | 14,400 | (7, 14, 33) | `#070E21` | R 4–9 · G 10–19 · B 22–45 |
| Badge inner disc (left) | Box x = 338–356, y = 496–504 | 171 | (11, 22, 52) | `#0B1634` | R 9–13 · G 21–24 · B 51–54 |
| Badge inner disc (below star) | Box x = 497–503, y = 600–632 | 231 | (6, 16, 45) | `#06102D` | R 4–8 · G 14–19 · B 42–47 |
| Outer ring (blue) | Annulus r = 290–303; H 200–245, S > 0.30, V > 0.40 | 17,956 | (81, 108, 163) | `#516CA3` | R 54–111 · G 73–144 · B 124–195 |
| Outer ring highlight | Same ring pixels, brightest 20 % by V | 3,982 | (110, 144, 194) | `#6E90C2` | R 104–116 · G 138–149 · B 190–199 |
| Inner ring (blue) | Annulus r = 207–219; H 200–245, S > 0.30, V > 0.40 | 6,820 | (68, 81, 137) | `#445189` | R 48–96 · G 56–119 · B 111–177 |
| Purple (orbit / star facets) | r < 200; H 245–280, S > 0.35, V > 0.45 | 2,142 | (106, 88, 176) | `#6A58B0` | R 79–132 · G 69–115 · B 140–207 |
| White (star / lettering) | Whole image; S < 0.12, V > 0.90 | 27,510 | (250, 252, 252) | `#FAFCFC` | R 236–255 · G 241–255 · B 244–255 |

### 3.2 Exact pixels (verification spot checks)

| Element | Pixel (x, y) | RGB | HEX |
|---|---|---|---|
| Outer background | (30, 30) | (8, 15, 34) | `#080F22` |
| Badge inner disc | (347, 500) | (13, 24, 54) | `#0D1836` |
| Outer ring | (203, 500) | (83, 116, 170) | `#5374AA` |
| Inner ring | (287, 500) | (88, 110, 170) | `#586EAA` |
| Star outline (blue-violet) | (389, 500) | (105, 113, 188) | `#6971BC` |
| Purple orbit stroke | (425, 500) | (106, 108, 191) | `#6A6CBF` |
| Purple orbit stroke | (500, 554) | (99, 88, 182) | `#6358B6` |
| White star | (500, 584) | (253, 254, 246) | `#FDFEF6` |
| White lettering | (500, 754) | (249, 251, 250) | `#F9FBFA` |

The exact pixels agree with the medians within normal JPEG variation. The inner-ring pixel
(287, 500) is brighter than the inner-ring median because it lies on the ring's lit centre line.

### 3.3 Overall colour distribution (median-cut quantisation)

The whole image reduced to 8 representative colours (Pillow median-cut), as a share of all 1,000,000 pixels:

| Share | RGB | HEX | Interpretation |
|---:|---|---|---|
| 28.1 % | (6, 13, 32) | `#060D20` | Outer background |
| 24.9 % | (9, 20, 47) | `#09142F` | Badge field |
| 10.7 % | (3, 10, 22) | `#030A16` | Darkest background areas (lower part) |
| 9.7 % | (5, 16, 38) | `#051026` | Background / badge transition |
| 7.9 % | (72, 86, 119) | `#485677` | Mixed ring, outline and lettering edge pixels |
| 7.5 % | (7, 15, 35) | `#070F23` | Outer background |
| 6.1 % | (5, 12, 32) | `#050C20` | Outer background |
| 5.1 % | (4, 10, 27) | `#040A1B` | Outer background |

**What this shows:** about 92 % of the image is navy background. The brand's *accent* colours
(blue rings, purple, white) occupy small areas, so the quantisation averages them into one
mixed colour (`#485677`). That's why the accent colours in §3.1 were sampled with targeted masks.

## 4. Sampled vs earlier estimates

The roadmap originally listed colours **estimated by eye**. They are superseded by the measured values:

| Role | Earlier visual estimate (superseded) | **Measured (median)** |
|---|---|---|
| Background | `#0A1028` | `#070E21` |
| Surface / badge field | `#121A3D` | `#0B1634` |
| Primary blue | `#4B63B8` | `#516CA3` (outer ring) |
| Accent purple | `#7B5CD6` | `#6A58B0` |
| Text white | `#F1F3FA` | `#FAFCFC` |

The measured colours are **darker and less saturated** than the estimates.

## 5. Proposed UI colour directions (NOT sampled values)

> ⚠️ **Proposals, not measurements.** This section describes *how* the sampled colours are
> intended to be used. The final UI values, including any lightened or darkened variants,
> are defined and contrast-tested in **D.2**. No value below should be cited as "from the logo".

| UI role (proposed) | Based on sampled colour | Direction for D.2 |
|---|---|---|
| Dark theme: page background | Outer background `#070E21` | Use as the base, or a very close navy |
| Dark theme: cards / surfaces | Badge field `#0B1634` | Use as the base; may need a slightly lighter step so cards separate from the page |
| Primary (brand blue) | Outer ring `#516CA3` | A **lighter** variant is likely needed for text or icons on dark backgrounds, and a **darker** variant for text on light backgrounds |
| Accent (brand purple) | Purple `#6A58B0` | Same: tint or shade per theme as contrast requires |
| Text on dark | White `#FAFCFC` | Primary text in the dark theme |
| Light theme: page background | *(no light colour in the logo)* | Off-white with a slight blue tint, to be defined in D.2 |
| Light theme: text | Badge field navy `#0B1634` | Candidate for primary text in the light theme |

Two rules carry forward into D.2:
1. **Brand colours are not data colours.** Fire detections, perimeters, change scales, masks and
   no-data get a separate, fixed scientific palette (D.2), so brand blue and purple never carry data meaning.
2. **Every colour pairing is contrast-checked** (WCAG 2.2 AA: text, UI components, graphical
   objects and focus indicators) before it's approved.

## 6. Known limitation: JPG background

The logo file is a **JPEG with a built-in dark square background** and no transparency.

| Issue | Effect |
|---|---|
| No alpha channel | The badge can't sit directly on the light theme; the dark square would show as a visible box. |
| Background isn't uniform | The square has a subtle gradient and JPEG noise (corner median `#070E21`, darkest lower areas around `#030A16`). Even in the dark theme, a flat page colour won't match it exactly, so a faint square edge may be visible. |
| Lossy compression | Edges of fine elements (lettering, thin rings) show compression artefacts, especially when enlarged. |
| Fixed resolution (1000 px) | It can't be enlarged beyond 1000 px without blurring. |
| Small sizes | The arc lettering ("ASTERA", "M·N·F·Y·S") becomes illegible at small sizes. |

**Design workaround (no file changes):** show the logo inside a **circular crop** that follows
the badge edge (radius ≈ 32 % of the image width, centred). The square background corners are
hidden, and the badge reads as a round emblem on both light and dark themes. This is a
display rule for D.5/D.8, not an edit to the file.

**Recommended team action:** create a **transparent PNG** (and ideally an **SVG**) version of the
badge, plus a simplified small mark (e.g. the star only) for favicons and the collapsed sidebar.
Until then, the original JPG stays the only source, and the team must not redraw or alter it.

## 7. Name lockup

### 7.1 Text (fixed wording)

| Element | Text | Notes |
|---|---|---|
| Product name | **ASTERA WATCH** | Always this spelling; uppercase in the wordmark |
| Subtitle | **Wildfire Surface-Change Monitoring with NASA NISAR Radar** | Exact wording, including "Surface-Change" with a hyphen |
| Credit line | **Team Astera · NASA Space Apps Challenge** | Footer / about areas |

In running text, write the name as "Astera Watch" (title case).

### 7.2 Typography (direction, finalised in D.3)

- Wordmark: **Montserrat**, uppercase, wide letter spacing, echoing the arc lettering of the badge.
- Subtitle: the body font (Inter), sentence case as written above, smaller and lower emphasis.

### 7.3 Lockup variants

| Variant | Composition | Intended use |
|---|---|---|
| **Horizontal** | Badge (circular crop) · ASTERA WATCH · subtitle below the name | Expanded sidebar header, about page |
| **Stacked** | Badge centred above ASTERA WATCH, subtitle below | Splash / title areas, 404 page |
| **Compact** | Badge · ASTERA WATCH, no subtitle | Narrow headers, mobile top bar |
| **Mark only** | Badge alone | Collapsed sidebar, very small spaces; illegible lettering is acceptable here |

The badge and the name keep a fixed relationship: the badge height matches the cap-height
block of name plus subtitle in the horizontal lockup. Exact sizes are defined in D.5/D.6.

### 7.4 Use of "NASA" and "NISAR"

"NASA" and "NISAR" appear in the subtitle because they describe the **data source**.
The design must **not** imply that Astera Watch is an official NASA product:
- No NASA logos, insignia or mission graphics in the lockup or UI chrome.
- Keep the credit line ("NASA Space Apps Challenge") to describe the context.

## 8. Logo usage rules

**Clear space:** keep empty space around the badge of at least **¼ of the badge diameter** on all sides.

**Minimum sizes (proposed, confirmed in D.6):**

| Use | Minimum badge diameter |
|---|---|
| Arc lettering must be readable | ≈ 120 px |
| Mark only (lettering not required) | 32 px |

**Backgrounds:**
- **Dark theme:** circular crop on the page background.
- **Light theme:** circular crop only. The square JPG must never appear on a light background.
- **Over maps or imagery:** only on a solid backing (header or panel), never directly over data.

**Don't:**
- Stretch, squash, rotate or skew the logo.
- Recolour it, apply filters, or add shadows, glows or outlines.
- Crop into the badge itself; only the background square may be hidden.
- Redraw or trace it unofficially (see the team action in §6).
- Place text or UI elements inside the clear space.
- Use brand blue or purple from the logo to encode data on maps or charts.

## 9. Reproducing the sampling

The sampling scripts were kept **outside the repository** to respect Stage D's
"no application code" scope. To reproduce, in the `astera` environment:

1. Open `frontend/public/astera-logo.jpg` with Pillow and convert it **in memory** to RGB.
   Don't save it.
2. Build masks exactly as listed in §3.1 (regions, annuli around (500, 500), HSV thresholds).
3. Take the per-channel median and the 10th/90th percentiles of each mask.
4. Read the exact pixels listed in §3.2.
5. Quantise to 8 colours with median-cut (§3.3).
6. Confirm the file's SHA-256 is unchanged afterwards (§1).

## 10. Open items

| # | Item | Owner | When |
|---|---|---|---|
| 1 | Transparent PNG / SVG version of the badge + simplified small mark | Team (design) | Before Stage 7 |
| 2 | Final light/dark UI colours with contrast checks | D.2 | Next |
| 3 | Font sizes for the lockup variants | D.3 / D.6 | — |
