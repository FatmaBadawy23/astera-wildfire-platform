# Astera Watch: Design Documentation (Stage D)

*Wildfire Surface-Change Monitoring with NASA NISAR Radar*

This folder holds the **design-only** output of Stage D: the visual identity, design
tokens, accessibility and scientific UI rules, component specifications, layouts,
wireframes and static mockups. Stage 7 builds the real frontend from these documents.

> **Scope:** documents and static design files only. No packages, no React app, no
> application code, and no changes to `frontend/`.

## Documents

| # | Document | Contents | Status |
|---|---|---|---|
| 01 | [Visual identity](01-visual-identity.md) | Logo analysis, sampled colours, name lockup, logo usage rules | ⏳ D.1 |
| 02 | [Design tokens](02-design-tokens.md) + [`tokens.json`](tokens.json) | Light/dark themes, spacing, radius, elevation, motion, scientific data palette, WCAG contrast tables | ⏳ D.2 |
| 03 | [Typography & accessibility](03-typography-accessibility.md) | Fonts, type scale, units and number formats, WCAG 2.2 AA rules | ⏳ D.3 |
| 04 | [Scientific UI rules](04-scientific-ui-rules.md) | FIRMS vs burned area, estimates, missing metadata, data-source labelling | ⏳ D.4 |
| 05 | [Components](05-components.md) | Component specifications with all states | ⏳ D.5 |
| 06 | [Layout & responsive](06-layout-responsive.md) | Collapsible sidebar, header, assistant panel, breakpoints | ⏳ D.6 |
| 07 | [Wireframes](07-wireframes.md) | Low-fidelity layout of every page and UI state | ⏳ D.7 |
| 08 | [Mockups](mockups/) | High-fidelity static mockups, light and dark | ⏳ D.8 |

Status: ⏳ not started · 🔄 in review · ✅ approved

## Design decisions (approved)

- **Navigation:** collapsible left sidebar
- **Maps:** MapLibre in the final app; static placeholder maps in all design files
- **Headings:** Montserrat; body Inter; numbers and IDs in a monospace font
- **Themes:** light and dark, both required
- **Pages:** Dashboard, Fire Events, Event Detail, Before/After, Change Detection,
  Data & Methodology, Assistant panel, 404/Error. No separate Data Upload page.
- **Review:** manual screenshot review by the team lead (no automated screenshot tools)

## Non-negotiable scientific rules (summary, full version in doc 04)

1. **FIRMS active-fire detections are not burned-area perimeters:** distinct styles, legend entries and wording.
2. **Changed area is an estimate:** always labelled "Estimated", with method, units and source.
3. **Missing metadata is never invented:** shown as "Not available".
4. **Every visualization has a clear source label** (Mock / Sentinel-1 C-band / NISAR L-band / NISAR S-band / FIRMS). Mixed-source tables identify provenance per row or column. Labels aren't repeated where one clear label covers the view.
5. **NISAR L-band and S-band are shown separately**, and only for bands a product actually provides.
6. **Mock data is always clearly labelled** and never presented as a real observation.

## How to review

1. Read each document in order. Each sub-stage (D.1–D.8) is approved separately.
2. Mockups (D.8): open the HTML files in `mockups/` in a browser, check light and
   dark themes, and take screenshots for review.
3. Check every page against the scientific rules (doc 04).

## Source of truth

- Visual reference: `frontend/public/astera-logo.jpg` (not modified in Stage D)
- Plan: [`docs/ROADMAP.md`](../ROADMAP.md), Stage D
