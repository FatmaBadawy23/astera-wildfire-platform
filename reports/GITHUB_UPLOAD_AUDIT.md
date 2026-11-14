# GitHub Upload Audit — Astera Watch

Date: 2026-11-14
Local repository: `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`
Remote: `origin` → `https://github.com/FatmaBadawy23/astera-wildfire-platform.git`
Target branch: `feature/sar-ml-pipeline` (never `main`)

## 1. Repository state (read-only audit)

| Item | Value |
|---|---|
| Repository root | `C:/Users/asus/Desktop/Nasa/astera-wildfire-platform` (own `.git`, not the parent home-directory repo) |
| Local branch | `feature/sar-ml-pipeline` at `fd3eaeb` ("Add Stage 0 report"), same commit as local `main` |
| Remote branch `feature/sar-ml-pipeline` | **Does not exist yet** — the push creates it; nothing on the remote can be overwritten |
| `origin/main` | `4f544f9` — 1 teammate commit ahead of `fd3eaeb` (deletes the obsolete rules file, small edits to `docs/ROADMAP.md`, `docs/stages/STAGE-0-REPORT.md`) |
| `origin/stage-d-design` | `efcd64c` — teammate design docs and `docs/design/tokens.json` |
| `origin/stage-f-frontend` | `7a9d740` — teammate frontend (`frontend/`, 495 files) and handover docs |
| Tags on remote | `checkpoint-stage-0`, `checkpoint-stage-d`, `checkpoint-stage-f`, `checkpoint-research-r3` |
| Tracked files before upload | 33 |
| Git LFS | `git-lfs/3.6.1` installed, filters configured, `pre-push` hook present; no LFS objects anywhere on the remote yet |

All teammate branches and tags stay untouched: this upload only adds a new branch.

## 2. Files and directories to publish

1,640 new files and 4 modified tracked files (`.gitattributes`, `.gitignore`, `README.md`, and the rules file since removed), plus this report.

| Directory | Files | Size | Notes |
|---|---:|---:|---|
| `outputs/` | 826 | 1.58 GB | runs, analysis runs, uploads, geospatial products, evaluation |
| `models/` | 2 | 698 MB | `real_unet_resnet34_best.pt`, `unet_resnet34_best.pt` |
| `data/` | 192 | 659 MB | mock NISAR GCOV `.h5`, real acquisitions, prepared datasets, manifests |
| `Frontend_/` | 501 | 9.0 MB | teammate's Stage F frontend + live-inference features (see §5) |
| `backend/` | 37 | 0.4 MB | FastAPI app, processing pipeline, models, 9 test modules |
| `frontend/` | 20 | 0.3 MB | the second (React + Vite) frontend |
| `reports/` | 36 | 0.5 MB | audit and research reports |
| `scripts/` | 15 | 0.3 MB | pipeline, launcher and preflight scripts |
| `docs/` | 8 | 0.1 MB | architecture, model/dataset cards, plus `docs/design/tokens.json` (see §6) |
| root | 6 | — | `README.md`, `STARTUP_README.md`, `RUN.bat`, `STOP.bat`, `.gitignore`, `.gitattributes` |

Both `frontend/` and `Frontend_/` are published. Neither replaces the other.

## 3. Files that require Git LFS

`.gitattributes` gained LFS rules for: `*.pt *.pth *.bin *.pkl *.npz *.h5 *.hdf5 *.tif *.tiff`.

- 385 files go to LFS (2.60 GB on disk). Identical files share one LFS object, so this is **184 unique objects ≈ 2.09 GB (1.95 GiB)** of LFS storage.
- Four checkpoints are ~333 MiB each and **cannot** go into regular Git (100 MiB hard limit):
  - `models/checkpoints/real_unet_resnet34_best.pt`
  - `models/checkpoints/unet_resnet34_best.pt`
  - `outputs/runs/run_20261114_013500/checkpoints/real_unet_resnet34_water_free.pt`
  - `outputs/runs/run_20261114_025000_phase_g/checkpoints/real_unet_resnet34_phase_g.pt`

| LFS by directory | Files | Size on disk |
|---|---:|---:|
| `outputs/runs` | 102 | 847 MB |
| `models/checkpoints` | 2 | 698 MB |
| `data/acquisitions` | 12 | 351 MB |
| `data/real` | 14 | 275 MB |
| `outputs/uploads` | 62 | 203 MB |
| `outputs/analysis_runs` | 146 | 137 MB |
| `outputs/geospatial` | 32 | 43 MB |
| `outputs/sample_uploads` | 6 | 24 MB |
| `outputs/evaluation` | 3 | 13 MB |
| `data/mock` | 6 | 11 MB |

PNG, JPG, GeoJSON, CSV and JSON files stay in regular Git: 1,259 files, ~344 MB in total, largest 3.9 MB. PNG is deliberately **not** LFS-tracked because the teammate's `frontend/public` basemap tiles are regular-Git PNGs on `origin/stage-f-frontend`. Routing them through LFS would mix pointers and blobs on merge. None of the teammate branches contain any file with an LFS-tracked extension.

## 4. `.gitignore` changes (additive only)

The local uncommitted `.gitignore` excluded checkpoints and real-data arrays. Those must be published, so negation rules were **appended**. No existing rule was removed or edited:

```
!models/checkpoints/*.pt
!models/checkpoints/*.pth
!models/checkpoints/*.bin
!data/real/*/stack.npz
!data/real/*/qa_*.png
!data/real/dataset/*.npz
!data/real/dataset/prepared/
!outputs/evaluation/real_predictions/
!outputs/evaluation/real_test_maps.png
```

After the change, `git ls-files -o -i --exclude-standard` lists nothing except dependencies, build output and caches (§5).

## 5. Files excluded (dependencies, secrets, reproducible caches only)

| Excluded | Reason | Rule |
|---|---|---|
| `frontend/node_modules/`, `Frontend_/node_modules/` | dependencies, reproducible from `package.json` + `package-lock.json` (both lockfiles are published) | `node_modules/` |
| `frontend/dist/`, `Frontend_/dist/` | Vite build output, reproducible with `npm run build` | `frontend/dist/`, `Frontend_/.gitignore: dist/` |
| `__pycache__/`, `.pytest_cache/` | Python bytecode / test cache | existing rules |
| `.env`, `.env.*` (except `.env.example`) | secrets — **no real `.env` file exists**; only the two `.env.example` files, which are published | existing rules |
| Upload-audit test artifacts (§7) | created by this audit's own test run, not project work; left on disk, simply not staged | not ignored — excluded at staging time |

Nothing is excluded for being large. Nothing was deleted locally.

## 6. Secrets scan

- No `.env`, `.pem`, `.key`, `.netrc`, credential or key files in the project.
- Pattern scan over all text files to be published (AWS, GitHub, generic API-key formats, Slack tokens, private keys, `key/token/password = "..."` literals, credentials in URLs, SAS `sig=` tokens): **no hits**.
- Credential handling in code reads from environment variables (`NASA_API_KEY`, `EARTHDATA_*`, `FIRMS_MAP_KEY`). Recorded manifests and reports store only `<REDACTED_...>` placeholders. The only literal "secret" is the test fixture `secret123` in `backend/tests/test_preprocessing.py`.
- `.env.example` files hold placeholders only (`CHANGE_ME`, empty keys).

## 7. Readiness checks (Phase 3)

| Check | Result |
|---|---|
| Backend `pytest backend/tests` (system Python 3.13.7) | **65 passed**, 1 deprecation warning (starlette `multipart` import) |
| Backend routes | `backend.app.main:app` imports. Upload, sample upload, validate-pair, run, results, before/after, layers, GeoTIFF/GeoJSON and model-comparison routes are registered under `/api` and `/api/v1` |
| Model checkpoints referenced by code | Active run `run_20261114_025000_phase_g`: `real_unet_resnet34_phase_g.pt` and `lightgbm_phase_g.pkl` exist. Fallback `models/checkpoints/real_unet_resnet34_best.pt` exists. LightGBM fallback `outputs/runs/run_20261114_013500/checkpoints/lightgbm_pixel_spatial.pkl` does **not** exist (that run has `lightgbm_water_free.pkl`). It is only used when the active run's checkpoint is missing. Not changed. |
| `Frontend_` typecheck (`tsc -b --noEmit`) | pass |
| `Frontend_` lint (`eslint .`) | **2 errors, 1 warning** — `react-hooks/set-state-in-effect` in `src/features/live/BurnAnalysisMap.tsx:141` and `src/features/live/LiveInferenceStudioPage.tsx:89`; `exhaustive-deps` warning at `BurnAnalysisMap.tsx:223`. Code-quality rules, not build failures; left unchanged. |
| `Frontend_` production build | pass (built into a scratch directory so the local `dist/` was not overwritten) |
| `Frontend_` tests | First run: 27/28 files passed, `src/styles/tokens.test.ts` failed — `docs/design/tokens.json` was missing locally (it lives on the teammate's branches). Restored it byte-identically from `origin/stage-f-frontend` (new file, nothing overwritten). Re-run of that file: 4/4 pass. Combined: 28/28 files, 350 tests passing (346 in the full run + 4 in the re-run). |
| `frontend` typecheck / build / tests | pass / pass / **2 files, 4 tests** pass (incl. upload → validate pair → multi-model inference integration test) |
| API base URL | Both frontends proxy `/api` → `http://127.0.0.1:8000` in Vite. `VITE_API_BASE_URL` overrides it. |

Test artifacts created by the backend test run (left on disk, **not committed**):
`outputs/analysis_runs/ana_117f5f0ba1`, `outputs/analysis_runs/ana_bf2a9ad481`, `outputs/upload_pairs/pair_51a1628b49`, `pair_a5dde91e38`, `pair_ae907ca857`, `outputs/uploads/upl_3f3d087d64`, `upl_9a151bbee1`, `upl_a2d146bb38`, `upl_ac504ee4fa`, `upl_b4669b6af9`, `upl_db5d4ed329`.

## 8. GitHub quota and size risks

- **LFS storage ≈ 1.95 GiB.** The repository owner's LFS plan and billing status cannot be verified from this machine: `gh` is not installed and GitHub billing is not visible via Git. On GitHub Free, LFS storage and bandwidth are capped per account. If the account is on the older 1 GiB allowance, this upload exceeds it. On the current 10 GiB allowance, it fits, but **every full clone downloads ~2 GB of LFS bandwidth**, so a handful of clones a month uses up the free bandwidth. If the account has a payment method, overage may be **billed**. If not, uploads or downloads are blocked once the cap is reached.
- Regular Git: largest file 3.9 MB, total ~344 MB — well under the 100 MiB per-file limit and the 2 GB per-push limit.
- Duplicates: many `outputs/uploads/upl_*` directories contain the same sample GeoTIFFs. LFS stores each unique file once (385 files → 184 objects), so duplicates add no LFS storage.

## 9. Conflicts and risks for a later merge into `main`

These don't affect the push. They matter when the branch is later merged:

1. **`frontend/` add/add conflict.** The local `frontend/` (lightweight React app, 20 files) and the teammate's `frontend/` on `origin/stage-f-frontend` (495 files) are **different apps at the same path**. Overlapping paths: `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, `src/…`. The teammate's frontend is preserved locally as `Frontend_/`. Resolve this deliberately (for example rename one directory in a follow-up PR). Never accept one side blindly.
2. **Rules file modify/delete — resolved.** `origin/main` removed the obsolete rules file; the branch merged `main` and kept that deletion.
3. **`Frontend_/` vs teammate `frontend/`.** `Frontend_` = the teammate's Stage F tree with 6 added files (`src/data/http/liveInferenceClient.ts`, `src/features/live/*`) and 5 edited files (`src/app/router.tsx`, `src/features/explorer/ExplorerPage.tsx`, `src/features/research/ResearchPages.tsx`, `tsconfig.node.json`, `vite.config.ts`).
4. Recommended path: open a PR `feature/sar-ml-pipeline` → `main` and resolve these three items in review. No force-push is needed at any point.
