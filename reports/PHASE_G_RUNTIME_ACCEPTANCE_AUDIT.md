# ASTERA WATCH — GATE R1: REPOSITORY AND ARTIFACT VERIFICATION AUDIT

**Repository:** `C:\Users\asus\Desktop\Nasa\astera-wildfire-platform`  
**Active Versioned Run:** `run_20261114_025000_phase_g`  
**Audit Timestamp (UTC):** `2026-11-14T01:26:44Z`  
**Audit Mode:** Strictly Read-Only

---

## 1. Pointer & Run Directory Verification (`outputs/runs/latest_run.json`)

`outputs/runs/latest_run.json` exists and resolves to the latest Phase G run without any demo fallback:

| Pointer Key | Resolved Relative Path | Exists | Size (Bytes) | Verified SHA-256 |
|---|---|---|---:|---|
| `run_id` | `run_20261114_025000_phase_g` | — | — | — |
| `previous_baseline_run_id` | `run_20261114_013500` (preserved untouched) | `True` | — | — |
| `acquisition_manifest_path` | `data/acquisitions/run_20261114_025000_phase_g/manifests/acquisition_manifest.json` | `True` | `75,234` | `67277da4d8262ba64f24f6eba0b96de62bcdafb447f3c0114ebd65b35a3c9151` |
| `dataset_manifest_path` | `data/acquisitions/run_20261114_025000_phase_g/dataset/dataset_manifest.json` | `True` | `15,957` | `33194f0c0f02cabae7c7622a40aa7c431da7cfdfbf4098f382acb74659d2819f` |
| `model_comparison_path` | `outputs/runs/run_20261114_025000_phase_g/evaluation/real_model_comparison.json` | `True` | `86,714` | `441065f7147e990e66f6a073d05b4dcb4653e297789b7eb0a8a75ae7e90a1d53` |
| `comprehensive_validation_path` | `outputs/runs/run_20261114_025000_phase_g/evaluation/comprehensive_validation_report.json` | `True` | `240,769` | `278b6585ffecf97c68dbf05884a967c37d751b0546fd105ccf8cea8e7cf350dc` |
| `geospatial_quality_audit_path` | `outputs/runs/run_20261114_025000_phase_g/evaluation/geospatial_quality_audit.json` | `True` | `20,927` | `4fd35b044be516dba247103afc088a8bd249c871af4b09b9a771d5a7d3e55106` |

---

## 2. Checkpoints & Split Dataset Tensor Verification

All model checkpoints and dataset split `.npz` files exist and match their recorded SHA-256 hashes bit-for-bit:

| Artifact | Path | Exists | Size (Bytes) | Computed SHA-256 | Matches Manifest |
|---|---|---|---:|---|---|
| U-Net ResNet-34 Checkpoint | `outputs/runs/run_20261114_025000_phase_g/checkpoints/real_unet_resnet34_phase_g.pt` | `True` | `349,206,898` | `025f136b09a584c6ba3657198b9e50c6b53b1058b081c1dac8d1a0a685e863bc` | **YES** |
| LightGBM Checkpoint | `outputs/runs/run_20261114_025000_phase_g/checkpoints/lightgbm_phase_g.pkl` | `True` | `16,758` | `ef3099395e2918c3daa8f5f134d832fe63ba4749c51f061dc2f55b9dadb837e1` | **YES** |
| `TRAIN` Patch Tensor (`121` patches) | `data/acquisitions/run_20261114_025000_phase_g/dataset/train.npz` | `True` | `34,437,165` | `16a7f674bea7adf8eb19748b51d5f7701bba62442ac8fa271094aca9391e71f7` | **YES** |
| `VAL` Patch Tensor (`121` patches) | `data/acquisitions/run_20261114_025000_phase_g/dataset/val.npz` | `True` | `34,556,746` | `efa65e140180545782b3596835a0f695b1621a7909f46e85ef2641732f111d56` | **YES** |
| `TEST` Patch Tensor (`94` patches) | `data/acquisitions/run_20261114_025000_phase_g/dataset/test.npz` | `True` | `24,679,116` | `03e68a2a9e5339a86e82de5f7d47d4c426ff43e48f4a2fd1206a6bf2ee4d0817` | **YES** |

---

## 3. Geospatial Output Artifacts Verification (`outputs/runs/run_20261114_025000_phase_g/geospatial/`)

For each of the 4 wildfire events, all 8 required GeoTIFFs (`pre_fire_vh_db.tif`, `post_fire_vh_db.tif`, `delta_vh_db.tif`, `burn_probability.tif`, `predicted_burn_mask.tif`, `dnbr_reference.tif`, `mcd64a1_reference.tif`, `valid_land_mask.tif` + 7 legacy aliases = 15 `.tif` files), all 8 transparent RGBA web overlay PNGs (`layers/*.png`), both GeoJSONs (`aoi_boundary.geojson`, `firms_hotspots.geojson`), `before_after_overview.png`, and `before_after_summary.json` exist on disk:

| Event ID | GeoTIFFs (`.tif`) | RGBA Layer Overlays (`layers/*.png`) | GeoJSONs (`.geojson`) | `before_after_overview.png` | `before_after_summary.json` |
|---|---:|---:|---:|---:|---:|
| `CA_GANN_2026` | `15` (`8` canonical + `7` aliases) | `8` | `2` | `2,743,952 B` | `36,494 B` |
| `CA_DOME_2026` | `15` (`8` canonical + `7` aliases) | `8` | `2` | `2,965,455 B` | `36,464 B` |
| `CA_BUG_2026` | `15` (`8` canonical + `7` aliases) | `8` | `2` | `2,137,900 B` | `36,536 B` |
| `CA_TIMBER_2026` | `15` (`8` canonical + `7` aliases) | `8` | `2` | `2,903,631 B` | `24,732 B` |

---

## 4. Backend & Frontend Source Tree Verification

- **Backend Entry & Service Files:** `backend/app/main.py`, `backend/app/api/endpoints.py`, `backend/app/services/analysis_service.py`, `backend/app/schemas/api_schemas.py` — **VERIFIED PRESENT** (`use_mock_data` defaults to `False`; no demo fallback active).
- **Frontend Entry & Component Files:** `frontend/package.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/src/types.ts`, `frontend/src/index.css`, `frontend/src/components/WildfireMapView.tsx`, `frontend/src/components/EventDetailsView.tsx`, `frontend/src/components/ModelPerformanceView.tsx`, `frontend/src/components/DatasetExplorerView.tsx`, `frontend/src/components/NisarStatusView.tsx` — **VERIFIED PRESENT**.

**Gate R1 Status:** **VERIFIED**.
