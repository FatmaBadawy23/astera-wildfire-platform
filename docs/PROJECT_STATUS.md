# Project status

*Last updated: 2026-11-13. Frontend scope frozen at this point.*

## Stages

| Stage ([roadmap](ROADMAP.md)) | Status |
|---|---|
| 0: Environment and repository | ✅ Done. Tag `checkpoint-stage-0` on `main` (report: [stages/STAGE-0-REPORT.md](stages/STAGE-0-REPORT.md)) |
| D: Design system | ✅ Closed after D.2 (visual identity, design tokens); later steps moved into Stage F |
| F: Frontend application | 🔄 **Built, in review.** Committed on `stage-f-frontend`; tag `checkpoint-stage-f` |
| 1–11: Contracts, mock data generator, adapters, processing, database and API, data discovery, integration, chatbot, notebooks, demo | ⏳ Not started |
| C: Competition (real NISAR data) | ⏳ Waiting |

## What is real, demo-only, planned or unavailable

| Feature | Status |
|---|---|
| Fire map: country search, possible-fire markers, density squares, heat spots, layers, map key | **Works**, on **demo data** |
| Natural geographic map background (Natural Earth) | **Works** (real, public-domain context data) |
| Fire Story: summary, known/unknown, heat-spot map and chart, radar images, radar analysis, report downloads (JSON, CSV), print | **Works**, on **demo data** (radar scenes and results are simulated) |
| Fire History & Impacts | **Works**, on demo data. Impact information: **not available** (no impact data source) |
| My places (save countries) | **Works**, saved in this browser only |
| Alerts | **Not available yet** (needs accounts, live data, notifications); no sign-up is offered |
| Ask Astera (chatbot) | **Coming soon**; the Help panel links common questions to User Guide articles |
| User Guide, How It Works, What's planned | **Works** (static content) |
| Light and Dark themes (Light is the default) | **Works** |
| Live FIRMS, NISAR or Sentinel-1 data | **Not connected** |
| Backend API, database tables | **Not built** |
| Accounts / login | **Not built**; there are no login pages |
| Mobile app, Research Hub | **Planned** ideas only |

## Branches and tags

| Ref | Contents |
|---|---|
| `main` | Stage 0 (environment, setup docs) |
| `stage-d-design` | Stage D design documents (visual identity, design tokens); tag `checkpoint-stage-d` |
| `stage-f-frontend` | The frontend (Stage F) and this documentation; tag `checkpoint-stage-f` |
| `checkpoint-stage-0` | Tag at the end of Stage 0 |

The stage branches aren't merged into `main` yet; merging them is the next review step. Run `git branch -r` and
`git tag` to see what is on GitHub.

## Known issues

| # | Issue | Impact | Suggested fix |
|---|---|---|---|
| 1 | Two browser checks fail (Greece terrain, Light and Dark): 61 heat spots vs 62 rings counted, because one spot's ring is on screen while its centre isn't | Test only; the map is correct | Count only heat spots fully inside the view (test-only change, needs approval) |
| 2 | `frontend/scripts/browser-checks.mjs` (older browser test) expects old page names | Fails by design | Retire it, or update it to the new routes; keep its map-specific checks |
| 3 | `frontend/.env.example` says `VITE_DATA_MODE=api`, but `src/app/env.ts` only recognises `http` | Setting `api` silently keeps demo data | Change the example to `http` (or the code to accept `api`) |
| 4 | `VITE_BASEMAP_STYLE_URL` in `frontend/.env.example` isn't read by any code | Misleading setting | Remove it, or implement it |
| 5 | `recharts` and `axios` are dependencies, but no source file imports them | Unused packages | Remove, or use them in Stage 7 (Axios for the HTTP adapter) |
| 6 | Production build warns that chunks exceed 500 kB (main ≈ 636 kB; map chunk ≈ 1.08 MB) | Slower first load | Route-level code splitting (`React.lazy`) |
| 7 | The relief background looks soft above zoom 4 (1:50m source) | Visual only; fire symbols stay sharp | A higher-resolution source would be a new data decision |
| 8 | Dark theme: the fire colour's colour difference from the terrain under simulated protanopia falls to 6.1 (advisory) | The rings carry identification (contrast ≥ 5.32:1) | None required; recorded in `docs/design/02-design-tokens.md` §14.2 |
| 9 | The print layout of the Fire Story wasn't checked in a browser | Unknown | Print-preview check |
| 10 | Roadmap Stage F and the design README describe the original plan (sidebar, login pages, separate analysis pages) | Can confuse readers | Notes in both files point here; the implemented structure is described in [architecture/FRONTEND.md](architecture/FRONTEND.md) |
| 11 | Natural Earth 1:110m countries: release version and download URL not recorded; processing scripts not in the repository | Rebuilding the files is not reproducible exactly | Record them on the next rebuild |

## Provisional decisions waiting for the project owner

1. **Density colours.** The team's proposed ramp (`#FFE0B2 #FFAB91 #FF7043 #F4511E #BF360C`) was **not applied**:
   Middle and High are too close (ΔE 6.2 normal, 5.7 deuteranopia, 5.9 tritanopia; the project floor is 6 and the
   target is 8). Darkening High to `#D84315` would collide with the FIRMS point colour `#D94100` (ΔE 0.6). The
   provisional ColorBrewer Oranges ramp is in use, and the legend says "Provisional colours".
2. Approve the test-only fix for issue 1, and decide on the older browser test (issue 2).
3. When to merge `stage-d-design` and `stage-f-frontend` into `main`.

## Next steps (roadmap order)

1. Review Stage F and merge the stage branches into `main`.
2. **Stage 1:** data contracts (internal SAR model, adapter interface, database schema document, API schemas). The
   frontend's provisional types in `frontend/src/data/types/` are an input.
3. Stage 2 (deterministic mock data generator) and Stage 5 (database models, migrations, FastAPI endpoints), then
   Stage 7 (connect the frontend's HTTP adapter).
