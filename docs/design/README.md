# Astera Watch: Design Documentation (Stage D)

*Wildfire Surface-Change Monitoring with NASA NISAR Radar*

This folder holds the **design-only** output of Stage D: the visual identity, design
tokens, accessibility and scientific UI rules, component specifications, layouts,
wireframes and static mockups. Stage 7 builds the real frontend from these documents.

> **Scope:** documents and static design files only. No packages, no React app, no
> application code, and no changes to `frontend/`.

> **Update (Stage F0, 2026-11-11): Stage D was closed after D.2.** D.3–D.9 were **not completed**.
> Their requirements were transferred to **Stage F (Frontend application)**, where they are implemented
> and tested in the real app, or superseded by it. See [`docs/ROADMAP.md`](../ROADMAP.md), Stage D status
> and Stage F. Documents 03–08 were never created.

## Documents

| # | Document | Contents | Status |
|---|---|---|---|
| 01 | [Visual identity](01-visual-identity.md) | Logo analysis, sampled colours, name lockup, logo usage rules | ✅ D.1 |
| 02 | [Design tokens](02-design-tokens.md) + [`tokens.json`](tokens.json) | Light/dark themes, spacing, radius, elevation, motion, scientific data palette, WCAG contrast tables | ✅ D.2 · 🔄 Amendment 1 (F0: FIRMS detection-density palette) |
| 03 | Typography & accessibility *(not created)* | Fonts, type scale, units and number formats, WCAG 2.2 AA rules | ↪ Transferred to F1–F2 |
| 04 | Scientific UI rules *(not created)* | FIRMS vs burned area, estimates, missing metadata, data-source labelling | ↪ Transferred to F3 (components + automated tests) |
| 05 | Components *(not created)* | Component specifications with all states | ↪ Transferred to F2–F3 (implemented component library) |
| 06 | Layout & responsive *(not created)* | Collapsible sidebar, header, assistant panel, breakpoints | ↪ Transferred to F2 and F8 |
| 07 | Wireframes *(not created)* | Low-fidelity layout of every page and UI state | ✖ Superseded by implemented pages (F2–F7) |
| 08 | Mockups *(not created)* | High-fidelity static mockups, light and dark | ✖ Superseded by the real application |

Status: ⏳ not started · 🔄 in review · ✅ approved · ↪ transferred to Stage F (not completed in Stage D) · ✖ superseded

## Design decisions (approved)

- **Navigation:** collapsible left sidebar
- **Maps:** MapLibre in the final app; static placeholder maps in all design files
- **Headings:** Montserrat; body Inter; numbers and IDs in a monospace font
- **Themes:** light and dark, both required
- **Pages:** Dashboard, Fire Events, Event Detail, Before/After, Change Detection,
  Data & Methodology, Assistant panel, 404/Error. No separate Data Upload page.
  *(Original Stage D page list. Superseded at Stage F0 by the Stage F product structure: Welcome &
  Authentication, Global Fire Explorer, Fire Event Details, Data Availability, SAR Analysis,
  Reports & Insights, AI Scientific Assistant, Data & Methodology. Still no Data Upload page.)*
- **Review:** manual screenshot review by the team lead (no automated screenshot tools)

## Non-negotiable scientific rules (summary; doc 04 was not created, these rules are enforced in Stage F)

1. **FIRMS active-fire detections are not burned-area perimeters:** distinct styles, legend entries and wording.
2. **Changed area is an estimate:** always labelled "Estimated", with method, units and source.
3. **Missing metadata is never invented:** shown as "Not available".
4. **Every visualization has a clear source label** (Mock / Sentinel-1 C-band / NISAR L-band / NISAR S-band / FIRMS). Mixed-source tables identify provenance per row or column. Labels aren't repeated where one clear label covers the view.
5. **NISAR L-band and S-band are shown separately**, and only for bands a product actually provides.
6. **Mock data is always clearly labelled** and never presented as a real observation.
7. *(Added at F0)* **The FIRMS heatmap shows detection density only:** legend "FIRMS detection density, not
   burned area", numeric legend, text alternative; never fire intensity or burned-area extent
   ([02-design-tokens.md](02-design-tokens.md) §3.2).

## How to review

1. Read documents 01 and 02 (including Amendment 1).
2. *(Original D.8 step, superseded)* Static mockups were not produced; the real application is
   reviewed instead from Stage F onward (`npm run dev`, manual screenshots in both themes).
3. Check every page against the scientific rules above.

## Source of truth

- Visual reference: `frontend/public/astera-logo.jpg` (not modified in Stage D)
- Plan: [`docs/ROADMAP.md`](../ROADMAP.md), Stage D
