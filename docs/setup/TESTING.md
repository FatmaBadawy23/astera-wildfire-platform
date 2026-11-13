# Testing

All automated checks today are **frontend** checks. The backend has no tests yet, because it has no code.

## Authoritative checks (run all before handing work over)

Run from `frontend/`:

| Command | What it checks | Expected |
|---|---|---|
| `npm run typecheck` | TypeScript, whole project | exit 0 |
| `npm run lint` | ESLint (typescript-eslint, react-hooks) | exit 0, no warnings |
| `npm test` | Vitest unit and component tests in jsdom, including **axe-core WCAG 2.2 A/AA** on every page in both themes, routing, keyboard and focus, data-layer rules, design tokens in sync with `tokens.json` | 23 files, 280 tests pass |
| `npm run build` | Production build | Succeeds. **Known warning:** chunks over 500 kB (main ≈ 636 kB; the lazily loaded map chunk ≈ 1.08 MB is MapLibre) |

`npm test` runs `node scripts/run-vitest.mjs run`. Use it instead of calling `npx vitest` directly on Windows (see
[DEVELOPMENT.md](DEVELOPMENT.md#7-troubleshooting)). Use `npm run test:watch` while developing.

Notes:
- jsdom can't render CSS or WebGL. Expect console lines like "HTMLCanvasElement's getContext() … not implemented"
  during `npm test`; they are harmless. In jsdom, the map is replaced by a stand-in (`vi.mock` of `ExplorerMap`).
- Colour contrast and the real map are checked in a browser (next section).
- If `tokens.json` changes, run `npm run tokens`. The tokens test fails until `tokens.css` is regenerated.

## Browser checks (real Microsoft Edge)

```powershell
cd frontend
npm run dev                                   # terminal 1: must be running on http://localhost:5173
node scripts/journey-checks.mjs .\shots       # terminal 2: optional folder for screenshots
```

`journey-checks.mjs` starts headless Edge over the DevTools protocol (no extra packages) and checks, in Light and
Dark at 1440, 1024 and 390 px:

- layout: no sideways scrolling, exactly one demo label, the right menu for the screen size;
- **axe-core WCAG A/AA including colour contrast** on every page;
- the journeys: country search, map zoom, density squares, selecting a possible fire, Fire Story (including the
  "no usable pair" case), Fire History, My places, User Guide, How It Works, What's planned, and Help (Guide and Ask);
- real Tab-key focus rings;
- a first visit opens in Light, even with a dark device setting, and the chosen theme is remembered;
- relief tiles load and are softened per theme; heat spots are drawn with both rings over four terrain types.

It needs a development server (it reads the map through a development-only hook), and it takes several minutes.
Every DevTools command has a time limit, so a stuck page fails a step instead of hanging the run.

**Last result (2026-11-13): 278 / 280.** Both failures are the same check, in Light and Dark: over Greece it counted
61 heat spots and 62 rings. One heat spot at the screen edge has its ring on screen but its centre just off it, so
the strict count fails. This is a test that is too strict, not a map fault. A test-only fix is proposed but not
applied (see [../PROJECT_STATUS.md](../PROJECT_STATUS.md)).

`scripts/browser-checks.mjs` is the **older** browser test (Stage F4). It checks old page names and pages that no
longer exist, so it fails by design. It is kept until the team decides to retire it or update it.

## Environment and database checks (Python)

```powershell
conda run -n astera python docs/setup/verify_env.py   # RESULT: PASS
conda run -n astera python docs/setup/verify_db.py    # RESULT: PASS (27/27); needs .env and the local databases
```

`verify_db.py` only reads. Both scripts print no secrets.

## Backend tests (future)

`conda run -n astera pytest` (from `backend/`) once tests exist. `backend/tests/` is empty today, and the roadmap
plans for tests to use the separate `astera_watch_test` database.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| A Vitest test times out only in the full run | The full suite runs in parallel. Page renders can take more than 1 s, and `waitFor` defaults to 1 s. Give the specific wait a longer `timeout` instead of weakening the check |
| `journey-checks.mjs`: "Microsoft Edge not found" | Install Edge, or adjust the `EDGE` paths at the top of the script |
| `journey-checks.mjs` times out on the first page | The dev server isn't running on port 5173 |
| Browser check counts differ by one at the screen edge | See the known failure above |
