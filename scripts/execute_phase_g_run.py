"""Phase G4 & G5: End-to-End Model Revalidation & Geospatial Quality Execution Script.

Creates a new immutable versioned run (`run_20261114_025000_phase_g`) that:
1. Preserves `run_20261114_013500` untouched and backs up `outputs/runs/latest_run.json`.
2. Builds `data/acquisitions/run_20261114_025000_phase_g/dataset/` with `nan_channel_stats`
   computed strictly on `valid > 0` land pixels of `TRAIN` (`CA_GANN_2026`).
3. Retrains and evaluates all 4 models with Phase G1–G3 scientific fixes:
   - U-Net ResNet-34 (`pretrained=False`, 5 SAR channels) trained with `SARPatchDataset(..., valid_masks=...)`
     and `MaskedBCEDiceLoss` (zero loss and zero gradient on invalid/water pixels) and valid-masked epoch IoU selection.
   - LightGBM Pixel-Spatial trained with the VAL-selected Phase G2 configuration (`D_unweighted_shallow_auc_es`:
     `scale_pos_weight=1.0`, `eval_metric="auc"`, `max_depth=4`, `num_leaves=15`, `min_child_samples=200`,
     `reg_alpha=2.0`, `reg_lambda=10.0`, `lr=0.03`, `stopping_rounds=25`).
   - Log-Ratio analytical baseline (`TRAIN`-calibrated threshold `-1.20 dB`, plus `VAL` threshold diagnostic).
   - CUSUM multi-temporal detector (`k=0.5`, `h` calibrated on `VAL` over `2.0..5.0`).
4. Evaluates models separately against:
   - Leaderboard 1: 20 m Sentinel-2 `dNBR >= 0.11` Optical Reference
   - Leaderboard 2: QA-Filtered NASA MODIS `MCD64A1.061` Reference (20 m & 500 m block-reconciled)
5. Exports all Phase G5 canonical GeoTIFFs, legacy alias GeoTIFFs, web-map RGBA PNG overlays,
   GeoJSONs, 6-panel overview PNGs, and runs a strict `rasterio` verification audit on every file.
"""

from __future__ import annotations

import hashlib
import json
import logging
import pickle
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import cm
import numpy as np
import rasterio
import torch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.processing.acquisition.event_specs import EVENTS
from backend.processing.change_detection.before_after import (
    compute_before_after_sar_features,
    compute_geospatial_burned_area,
    export_aoi_boundary_geojson,
    export_geotiff_layer,
    verify_before_after_alignment,
)
from backend.processing.models.dataset import GlobalSampleTracker, SARPatchDataset
from backend.processing.models.lightgbm_model import LightGBMBurnedAreaClassifier
from backend.processing.models.real_dataset import (
    extract_real_patches,
    fill_missing,
    nan_channel_stats,
)
from backend.processing.models.trainer import train_unet_model
from backend.processing.preprocessing.mcd64a1 import (
    decode_qa_bitmask,
    summarize_mcd64a1_layers,
)
from backend.processing.preprocessing.optical import (
    SCL_LAND_VALID_CLASSES,
    SCL_WATER_CLASS,
    calibrate_dnbr_threshold,
    compute_dnbr,
    compute_nbr,
    optical_agreement,
    valid_optical_mask,
    water_optical_mask,
)
from backend.processing.validation.metrics import (
    calculate_coarse_block_reconciliation_metrics,
    calculate_probability_auc_metrics,
    calculate_segmentation_metrics,
)
from scripts.generate_before_after_and_validation import export_before_after_overview_png
from scripts.run_real_pipeline import (
    FEATURE_NAMES,
    PIXEL_AREA_M2,
    block_bootstrap_f1,
    calibrate_log_ratio,
    features_from_scene,
    metrics_dict,
    predict_unet_scene,
    run_cusum,
    scene_stack,
    select_probability_threshold,
    temporal_stack_db,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("phase-g-runner")

REAL_ROOT = PROJECT_ROOT / "data" / "real"
BASELINE_RUN_ID = "run_20261114_013500"
PHASE_G_RUN_ID = "run_20261114_025000_phase_g"
PATCH_SIZE = 128
STRIDE = 64
MAX_SAMPLES = 10000


def compute_file_sha256(path: Path) -> Tuple[int, str]:
    raw = path.read_bytes()
    return len(raw), hashlib.sha256(raw).hexdigest()


def export_rgba_overlay_png(
    out_path: Path,
    array: np.ndarray,
    valid_mask: np.ndarray,
    cmap_name: str,
    vmin: float,
    vmax: float,
    is_binary_mask: bool = False,
    mask_rgb: Tuple[float, float, float] = (0.96, 0.62, 0.04),
) -> Path:
    """Render an 800x800 georeferenced raster array to a transparent RGBA PNG for web map display."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    h, w = array.shape
    rgba = np.zeros((h, w, 4), dtype=np.float32)
    valid = (valid_mask > 0) & np.isfinite(array)

    if is_binary_mask:
        pos = valid & (array > 0)
        rgba[pos, 0] = mask_rgb[0]
        rgba[pos, 1] = mask_rgb[1]
        rgba[pos, 2] = mask_rgb[2]
        rgba[pos, 3] = 0.78
    else:
        norm = np.clip((array - vmin) / max(vmax - vmin, 1e-6), 0.0, 1.0)
        cmap = matplotlib.colormaps[cmap_name]
        mapped = cmap(norm)
        rgba[valid, :3] = mapped[valid, :3]
        rgba[valid, 3] = 0.82

    plt.imsave(out_path, rgba)
    return out_path


def stage_1_prepare_versioned_dataset(acq_dir: Path) -> Dict[str, Any]:
    """Copy verified acquisition metadata from baseline run and build valid-masked dataset."""
    base_acq_dir = PROJECT_ROOT / "data" / "acquisitions" / BASELINE_RUN_ID
    acq_dir.mkdir(parents=True, exist_ok=True)
    for sub in ("eonet", "firms", "manifests", "modis", "nisar_metadata", "sentinel1", "sentinel2"):
        src = base_acq_dir / sub
        dst = acq_dir / sub
        if src.exists() and not dst.exists():
            shutil.copytree(src, dst)

    dataset_root = acq_dir / "dataset"
    prepared_dir = dataset_root / "prepared"
    dataset_root.mkdir(parents=True, exist_ok=True)
    prepared_dir.mkdir(parents=True, exist_ok=True)

    base_manifest = json.loads((REAL_ROOT / "acquisition_manifest.json").read_text(encoding="utf-8"))
    events = [ev for ev in EVENTS if ev.include_in_training and ev.event_id in base_manifest["events"]]

    prepared: Dict[str, Dict[str, np.ndarray]] = {}
    event_meta: Dict[str, Any] = {}
    water_audit: Dict[str, Any] = {}

    for event in events:
        record = base_manifest["events"][event.event_id]
        with np.load(REAL_ROOT / event.event_id / "stack.npz") as st:
            arrays = {k: st[k] for k in st.files}
        with np.load(REAL_ROOT / event.event_id / "mcd64a1_ancillary.npz") as anc:
            qa_arr = anc["qa"]
            qa_dec = decode_qa_bitmask(qa_arr)

        ordered = sorted(record["s1"], key=lambda entry: entry["datetime"])
        pre_entry, post_entry = ordered[0], ordered[-1]
        pre_role, post_role = pre_entry["role"], post_entry["role"]

        pre_vv = arrays[f"s1_{pre_role}_vv"]
        pre_vh = arrays[f"s1_{pre_role}_vh"]
        post_vv = arrays[f"s1_{post_role}_vv"]
        post_vh = arrays[f"s1_{post_role}_vh"]
        valid_s1 = (
            np.isfinite(pre_vv)
            & np.isfinite(pre_vh)
            & np.isfinite(post_vv)
            & np.isfinite(post_vh)
            & (pre_vv > 0)
            & (pre_vh > 0)
            & (post_vv > 0)
            & (post_vh > 0)
        )

        nbr_pre = compute_nbr(arrays["s2_pre_B08"], arrays["s2_pre_B12"])
        nbr_post = compute_nbr(arrays["s2_post_B08"], arrays["s2_post_B12"])
        dnbr = compute_dnbr(nbr_pre, nbr_post)

        water_mask = water_optical_mask(arrays["s2_pre_SCL"], arrays["s2_post_SCL"])
        opt_valid_land = valid_optical_mask(
            arrays["s2_pre_SCL"],
            arrays["s2_post_SCL"],
            arrays["s2_pre_B08"],
            arrays["s2_post_B08"],
            exclude_water=True,
        )
        valid = opt_valid_land & valid_s1 & np.isfinite(dnbr) & (~water_mask)
        remaining_water_in_valid = int(np.count_nonzero(valid & water_mask))
        assert remaining_water_in_valid == 0

        mcd_hq_burn = ((arrays["mcd_burn_mask"] > 0) & qa_dec["high_quality_land_mask"]).astype(np.uint8)

        prepared[event.event_id] = {
            "pre_vv": pre_vv,
            "pre_vh": pre_vh,
            "post_vv": post_vv,
            "post_vh": post_vh,
            "dnbr": dnbr,
            "valid": valid.astype(np.uint8),
            "water_mask": water_mask.astype(np.uint8),
            "mcd": mcd_hq_burn,
            "pre_date": np.array(pre_entry["datetime"]),
            "post_date": np.array(post_entry["datetime"]),
        }
        temporal_dates = sorted(record["s1"], key=lambda entry: entry["datetime"])
        prepared[event.event_id]["temporal_dates"] = np.array([entry["datetime"] for entry in temporal_dates])
        for index, entry in enumerate(temporal_dates):
            prepared[event.event_id][f"temporal_{index}_vv"] = arrays[f"s1_{entry['role']}_vv"]
            prepared[event.event_id][f"temporal_{index}_vh"] = arrays[f"s1_{entry['role']}_vh"]

        water_audit[event.event_id] = {
            "total_pixels": int(valid.size),
            "scl6_water_pixels_detected": int(np.count_nonzero(water_mask)),
            "scl6_water_pixels_in_valid_mask": remaining_water_in_valid,
            "valid_land_pixels": int(np.count_nonzero(valid)),
            "valid_land_fraction": round(float(valid.mean()), 6),
        }
        event_meta[event.event_id] = {
            "split": event.split,
            "name": event.name,
            "pre_datetime": pre_entry["datetime"],
            "post_datetime": post_entry["datetime"],
            "n_s1_dates": len(temporal_dates),
            "valid_fraction": float(valid.mean()),
            "water_pixels_excluded": int(np.count_nonzero(water_mask)),
            "mcd_fraction_valid": float(((mcd_hq_burn > 0) & valid).sum() / max(valid.sum(), 1)),
            "pre_item": pre_entry["item_id"],
            "post_item": post_entry["item_id"],
        }

    train_pool = [ev.event_id for ev in events if ev.split == "TRAIN"]
    combined_dnbr = np.concatenate([prepared[eid]["dnbr"].ravel() for eid in train_pool])
    combined_mcd = np.concatenate([prepared[eid]["mcd"].ravel() for eid in train_pool])
    combined_valid = np.concatenate([prepared[eid]["valid"].ravel() for eid in train_pool]).astype(bool)
    calibration = calibrate_dnbr_threshold(combined_dnbr, combined_mcd, combined_valid)
    threshold_calibrated = float(calibration["selected"]["threshold"])
    threshold_usgs_moderate = 0.27

    tracker = GlobalSampleTracker(max_limit=MAX_SAMPLES)
    split_accumulator = {
        split: {"patches": [], "labels": [], "mcd": [], "valid": [], "events": []}
        for split in ("TRAIN", "VAL", "TEST")
    }
    agreement: Dict[str, Any] = {}

    for event in events:
        data = prepared[event.event_id]
        dnbr = data["dnbr"]
        valid = data["valid"].astype(bool)
        label = ((dnbr >= threshold_calibrated) & valid).astype(np.uint8)
        label_usgs_027 = ((dnbr >= threshold_usgs_moderate) & valid).astype(np.uint8)
        mcd = data["mcd"] & valid.astype(np.uint8)
        data["label"] = label
        data["label_usgs_027"] = label_usgs_027

        agreement[event.event_id] = {
            "dnbr_calibrated_vs_mcd": optical_agreement(label, mcd, valid),
            "dnbr_usgs_027_vs_mcd": optical_agreement(label_usgs_027, mcd, valid),
            "label_calibrated_fraction_valid": float(label[valid].mean()) if valid.any() else 0.0,
            "label_usgs_027_fraction_valid": float(label_usgs_027[valid].mean()) if valid.any() else 0.0,
            "mcd_fraction_valid": float(mcd[valid].mean()) if valid.any() else 0.0,
            "valid_fraction": float(valid.mean()),
            "water_pixels_excluded": water_audit[event.event_id]["scl6_water_pixels_detected"],
        }

        patch_set = extract_real_patches(
            data["pre_vv"],
            data["pre_vh"],
            data["post_vv"],
            data["post_vh"],
            label,
            mcd,
            valid.astype(np.uint8),
            event_id=event.event_id,
            split=event.split,
            patch_size=PATCH_SIZE,
            stride=STRIDE,
            tracker=tracker,
        )
        bucket = split_accumulator[event.split]
        bucket["patches"].append(patch_set.patches)
        bucket["labels"].append(patch_set.labels)
        bucket["mcd"].append(patch_set.mcd)
        bucket["valid"].append(patch_set.valid)
        bucket["events"].extend(patch_set.event_ids)

    for split, bucket in split_accumulator.items():
        patches = np.concatenate(bucket["patches"], axis=0).astype(np.float32)
        labels_arr = np.concatenate(bucket["labels"], axis=0).astype(np.uint8)
        mcds = np.concatenate(bucket["mcd"], axis=0).astype(np.uint8)
        valids = np.concatenate(bucket["valid"], axis=0).astype(np.uint8)
        np.savez_compressed(
            dataset_root / f"{split.lower()}.npz",
            patches=patches,
            labels=labels_arr,
            mcd=mcds,
            valid=valids,
            events=np.array(bucket["events"]),
        )

    # Phase G1 remediation: Fit TRAIN channel normalization strictly over valid > 0 pixels
    with np.load(dataset_root / "train.npz") as train_npz:
        means, stds = nan_channel_stats(train_npz["patches"], valid=train_npz["valid"])

    split_files_info: Dict[str, Any] = {}
    for split in ("TRAIN", "VAL", "TEST"):
        p = dataset_root / f"{split.lower()}.npz"
        with np.load(p) as data:
            filled = fill_missing(data["patches"], means)
            labels_arr = data["labels"]
            mcds = data["mcd"]
            valids = data["valid"]
            ev_arr = data["events"]
        np.savez_compressed(
            p,
            patches=filled,
            labels=labels_arr,
            mcd=mcds,
            valid=valids,
            events=ev_arr,
        )
        f_bytes, f_sha = compute_file_sha256(p)
        split_files_info[split] = {
            "path": str(p.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "bytes": f_bytes,
            "sha256": f_sha,
            "samples": int(filled.shape[0]),
            "nominal_patch_pixels": int(valids.size),
            "valid_patch_pixels": int(np.count_nonzero(valids > 0)),
            "invalid_patch_pixels": int(np.count_nonzero(valids == 0)),
            "burned_valid_patch_pixels": int(np.count_nonzero((labels_arr > 0) & (valids > 0))),
            "unburned_valid_patch_pixels": int(np.count_nonzero((labels_arr == 0) & (valids > 0))),
            "positive_pixel_fraction_valid": round(
                float(labels_arr[valids > 0].mean()) if np.any(valids > 0) else 0.0, 4
            ),
        }

    prepared_files_info: Dict[str, Any] = {}
    for event_id, data in prepared.items():
        prep_p = prepared_dir / f"{event_id}.npz"
        np.savez_compressed(prep_p, **data)
        p_bytes, p_sha = compute_file_sha256(prep_p)
        prepared_files_info[event_id] = {
            "path": str(prep_p.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "bytes": p_bytes,
            "sha256": p_sha,
        }

    dataset_manifest = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_version": PHASE_G_RUN_ID,
        "data_origin": "CROSS_SENSOR_PROTOTYPE",
        "is_nisar": False,
        "sensors": [
            "sentinel-1-rtc (C-band, 20 m)",
            "sentinel-2-l2a (optical dNBR reference, SCL land classes {4,5,7}, water SCL=6 excluded)",
            "modis-64A1-061 (independent check, QA Bits 0=1, 1=1, 2=0 filtered)",
        ],
        "channels": ["vv_pre_db", "vh_pre_db", "vv_post_db", "vh_post_db", "delta_vh_db"],
        "scl_valid_land_classes": list(SCL_LAND_VALID_CLASSES),
        "scl_water_class_excluded": SCL_WATER_CLASS,
        "water_exclusion_audit": water_audit,
        "label_definition": (
            "Sentinel-2 dNBR >= threshold_calibrated (0.11, calibrated on TRAIN vs QA-filtered MCD64A1), "
            "masked by SCL land classes {4,5,7} (water SCL=6 excluded) and Sentinel-1 validity. "
            "USGS moderate-severity threshold (0.27) also tracked as sensitivity layer."
        ),
        "label_threshold": threshold_calibrated,
        "label_threshold_usgs_moderate": threshold_usgs_moderate,
        "label_calibration": calibration,
        "patch_size": PATCH_SIZE,
        "stride": STRIDE,
        "max_samples": MAX_SAMPLES,
        "samples": {split: split_files_info[split]["samples"] for split in ("TRAIN", "VAL", "TEST")},
        "total_samples": sum(split_files_info[split]["samples"] for split in ("TRAIN", "VAL", "TEST")),
        "split_files": split_files_info,
        "prepared_files": prepared_files_info,
        "normalization": {
            "mean": means.tolist(),
            "std": stds.tolist(),
            "fitted_on": "TRAIN (valid_mask > 0 land pixels only)",
        },
        "events": event_meta,
        "excluded_events": {
            "CA_TIMBER_2026": {
                "reason": (
                    "Excluded from supervised SAR training: C-band VH backscatter change is physically inverted "
                    "(delta_VH burned - unburned = +0.0668 dB, ROC-AUC = 0.4876 < 0.50) due to steep coastal "
                    "topography and overlapping Timber/Plaskett fire complex."
                ),
                "include_in_training": False,
            }
        },
        "agreement": agreement,
        "splits": {
            split: sorted({ev.event_id for ev in events if ev.split == split})
            for split in ("TRAIN", "VAL", "TEST")
        },
    }
    ds_manifest_path = dataset_root / "dataset_manifest.json"
    ds_manifest_path.write_text(json.dumps(dataset_manifest, indent=2), encoding="utf-8")
    (dataset_root / "norm_stats.json").write_text(
        json.dumps(dataset_manifest["normalization"], indent=2),
        encoding="utf-8",
    )
    logger.info("Stage 1 complete. Wrote Phase G dataset manifest -> %s", ds_manifest_path)
    return dataset_manifest


def stage_2_retrain_and_validate(
    acq_dir: Path,
    out_run_dir: Path,
    epochs: int = 6,
    seed: int = 42,
) -> Dict[str, Any]:
    """Retrain all 4 models with Phase G1/G2 fixes, export Phase G5 geospatial products, and validate."""
    started = time.time()
    dataset_root = acq_dir / "dataset"
    ckpt_dir = out_run_dir / "checkpoints"
    eval_dir = out_run_dir / "evaluation"
    pred_dir = eval_dir / "predictions"
    geo_dir = out_run_dir / "geospatial"
    for d in (ckpt_dir, eval_dir, pred_dir, geo_dir):
        d.mkdir(parents=True, exist_ok=True)

    manifest = json.loads((dataset_root / "dataset_manifest.json").read_text(encoding="utf-8"))
    means = np.asarray(manifest["normalization"]["mean"], dtype=np.float32)
    stds = np.asarray(manifest["normalization"]["std"], dtype=np.float32)
    threshold_dnbr = float(manifest["label_threshold"])
    splits = manifest["splits"]
    train_ids, val_ids, test_ids = splits["TRAIN"], splits["VAL"], splits["TEST"]
    eval_ids = train_ids + val_ids + test_ids
    split_of = {
        **{eid: "TRAIN" for eid in train_ids},
        **{eid: "VAL" for eid in val_ids},
        **{eid: "TEST" for eid in test_ids},
    }

    prepared: Dict[str, Dict[str, np.ndarray]] = {}
    labels: Dict[str, np.ndarray] = {}
    mcd_refs: Dict[str, np.ndarray] = {}
    stacks: Dict[str, np.ndarray] = {}
    for event_id in eval_ids:
        with np.load(dataset_root / "prepared" / f"{event_id}.npz") as data:
            prepared[event_id] = {k: data[k] for k in data.files}
        valid = prepared[event_id]["valid"].astype(bool)
        labels[event_id] = ((prepared[event_id]["dnbr"] >= threshold_dnbr) & valid).astype(np.uint8)
        mcd_refs[event_id] = ((prepared[event_id]["mcd"] > 0) & valid).astype(np.uint8)
        stacks[event_id] = scene_stack(prepared[event_id])

    # ---------------- Model 1: Analytical SAR VH Log-Ratio Baseline ----------------
    logger.info("Phase G4.1: Calibrating Analytical Model 1 (VH Log-Ratio Baseline) on TRAIN (%s)...", train_ids)
    train_delta = np.concatenate([stacks[eid][4][prepared[eid]["valid"].astype(bool)] for eid in train_ids])
    train_label = np.concatenate([labels[eid][prepared[eid]["valid"].astype(bool)] for eid in train_ids])
    baseline_cal = calibrate_log_ratio(train_delta, train_label, np.ones_like(train_label, dtype=bool))
    baseline_threshold = float(baseline_cal["selected"]["threshold_db"])
    val_delta = stacks[val_ids[0]][4][prepared[val_ids[0]]["valid"].astype(bool)]
    val_label_lr = labels[val_ids[0]][prepared[val_ids[0]]["valid"].astype(bool)]
    val_lr_cal = calibrate_log_ratio(val_delta, val_label_lr, np.ones_like(val_label_lr, dtype=bool))
    logger.info("Model 1 (Log-Ratio) threshold selected on TRAIN: %.2f dB", baseline_threshold)

    predictions: Dict[str, Dict[str, np.ndarray]] = {}
    for event_id in eval_ids:
        delta = stacks[event_id][4]
        predictions.setdefault(event_id, {})["log_ratio"] = (
            (delta <= baseline_threshold) & prepared[event_id]["valid"].astype(bool)
        ).astype(np.uint8)
        predictions[event_id]["log_ratio_score"] = (-delta).astype(np.float32)

    # ---------------- Model 2: LightGBM 10-Feature Spatial Classifier (Phase G2 Config D) ----------------
    logger.info("Phase G4.2: Training Model 2 (LightGBM Pixel-Spatial, Phase G2 Config D)...")
    train_features = features_from_scene(stacks[train_ids[0]], means)
    train_valid = prepared[train_ids[0]]["valid"].astype(bool)
    y_train = labels[train_ids[0]]
    X_train = train_features[::2, ::2, :].reshape(-1, len(FEATURE_NAMES))[train_valid[::2, ::2].ravel()]
    y_train_flat = y_train[::2, ::2].ravel()[train_valid[::2, ::2].ravel()]

    val_features = features_from_scene(stacks[val_ids[0]], means)
    val_valid = prepared[val_ids[0]]["valid"].astype(bool)
    X_val = val_features[::2, ::2, :].reshape(-1, len(FEATURE_NAMES))[val_valid[::2, ::2].ravel()]
    y_val_flat = labels[val_ids[0]][::2, ::2].ravel()[val_valid[::2, ::2].ravel()]

    lgb_started = time.time()
    lgb_classifier = LightGBMBurnedAreaClassifier(
        n_estimators=250,
        learning_rate=0.03,
        max_depth=4,
        num_leaves=15,
        min_child_samples=200,
        subsample=0.8,
        subsample_freq=1,
        colsample_bytree=0.8,
        reg_alpha=2.0,
        reg_lambda=10.0,
        scale_pos_weight=1.0,
        eval_metric="auc",
        stopping_rounds=25,
        random_state=seed,
        feature_names=FEATURE_NAMES,
    )
    importances = lgb_classifier.fit(X_train, y_train_flat, X_val, y_val_flat)
    lgb_time = time.time() - lgb_started
    lgb_best_iter = int(lgb_classifier.model.best_iteration_)

    val_prob_lgb = lgb_classifier.predict_spatial(val_features, threshold=0.5)[0]
    fine_candidates = tuple(np.round(np.arange(0.05, 0.91, 0.02), 2))
    lgb_threshold = float(
        select_probability_threshold(val_prob_lgb, labels[val_ids[0]], val_valid, candidates=fine_candidates)["selected"]["threshold"]
    )
    lgb_ckpt_path = ckpt_dir / "lightgbm_phase_g.pkl"
    with open(lgb_ckpt_path, "wb") as f:
        pickle.dump(
            {
                "classifier": lgb_classifier,
                "selected_probability_threshold": lgb_threshold,
                "best_iteration": lgb_best_iter,
                "feature_names": FEATURE_NAMES,
                "importances": importances,
                "seed": seed,
                "config_id": "D_unweighted_shallow_auc_es",
            },
            f,
        )
    lgb_ckpt_bytes, lgb_ckpt_sha = compute_file_sha256(lgb_ckpt_path)
    logger.info(
        "Model 2 (LightGBM) trained in %.2fs; best_iteration=%d; VAL threshold=%.2f",
        lgb_time,
        lgb_best_iter,
        lgb_threshold,
    )

    features_by_event = {
        train_ids[0]: train_features,
        val_ids[0]: val_features,
        **{event_id: features_from_scene(stacks[event_id], means) for event_id in test_ids},
    }
    for event_id in eval_ids:
        prob, mask = lgb_classifier.predict_spatial(
            features_by_event[event_id], threshold=lgb_threshold
        )
        predictions[event_id]["lightgbm_prob"] = prob
        predictions[event_id]["lightgbm"] = (
            mask.astype(np.uint8) & prepared[event_id]["valid"].astype(np.uint8)
        )

    # ---------------- Model 3: 5-Channel UNetResNet34 with MaskedBCEDiceLoss ----------------
    logger.info("Phase G4.3: Training Model 3 (5-channel UNetResNet34 with MaskedBCEDiceLoss) for %d epochs...", epochs)
    with np.load(dataset_root / "train.npz") as train_npz, np.load(dataset_root / "val.npz") as val_npz:
        train_ds = SARPatchDataset(
            patches=list(train_npz["patches"]),
            masks=list(train_npz["labels"].astype(np.float32)),
            valid_masks=list(train_npz["valid"].astype(np.float32)),
            is_train=True,
            norm_mean=means,
            norm_std=stds,
            event_ids=[str(v) for v in train_npz["events"]],
        )
        val_ds = SARPatchDataset(
            patches=list(val_npz["patches"]),
            masks=list(val_npz["labels"].astype(np.float32)),
            valid_masks=list(val_npz["valid"].astype(np.float32)),
            is_train=False,
            norm_mean=means,
            norm_std=stds,
            event_ids=[str(v) for v in val_npz["events"]],
        )

    torch.manual_seed(seed)
    np.random.seed(seed)
    unet_ckpt_name = "real_unet_resnet34_phase_g.pt"
    unet_model, training = train_unet_model(
        train_dataset=train_ds,
        val_dataset=val_ds,
        checkpoint_dir=ckpt_dir,
        num_epochs=epochs,
        batch_size=8,
        learning_rate=3e-4,
        device=None,
        seed=seed,
        in_channels=5,
        checkpoint_name=unet_ckpt_name,
    )
    unet_ckpt_path = ckpt_dir / unet_ckpt_name
    unet_ckpt_bytes, unet_ckpt_sha = compute_file_sha256(unet_ckpt_path)

    val_prob_unet = predict_unet_scene(
        unet_model, stacks[val_ids[0]], means, stds, tile=128, stride=64
    )
    unet_threshold = float(
        select_probability_threshold(val_prob_unet, labels[val_ids[0]], val_valid)["selected"]["threshold"]
    )
    logger.info(
        "Model 3 (UNetResNet34) best_epoch=%d, best_val_iou=%.4f, VAL threshold=%.2f",
        training.best_epoch,
        training.best_val_iou,
        unet_threshold,
    )

    unet_result = {
        "architecture": "UNetResNet34",
        "in_channels": 5,
        "channels": ["vv_pre_db", "vh_pre_db", "vv_post_db", "vh_post_db", "delta_vh_db"],
        "pretrained": False,
        "loss_function": "MaskedBCEDiceLoss(bce_weight=0.5, smooth=1.0)",
        "masked_loss_used": training.masked_loss_used,
        "epochs_trained": epochs,
        "batch_size": 8,
        "learning_rate": 3e-4,
        "seed": seed,
        "best_epoch": training.best_epoch,
        "best_val_iou": training.best_val_iou,
        "best_val_dice": training.best_val_dice,
        "train_losses": training.train_losses,
        "val_losses": training.val_losses,
        "val_ious": training.val_ious,
        "training_time_sec": training.total_training_time_sec,
        "checkpoint_path": str(unet_ckpt_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "checkpoint_bytes": unet_ckpt_bytes,
        "checkpoint_sha256": unet_ckpt_sha,
        "selected_probability_threshold": unet_threshold,
    }

    unet_prob_by_event = {val_ids[0]: val_prob_unet}
    for event_id in train_ids + test_ids:
        unet_prob_by_event[event_id] = predict_unet_scene(
            unet_model, stacks[event_id], means, stds, tile=128, stride=64
        )
    for event_id in eval_ids:
        prob = unet_prob_by_event[event_id]
        predictions[event_id]["unet_prob"] = prob
        predictions[event_id]["unet"] = (
            (prob >= unet_threshold) & prepared[event_id]["valid"].astype(bool)
        ).astype(np.uint8)

    # ---------------- Model 4: Multi-Temporal CUSUM Detector ----------------
    logger.info("Phase G4.4: Running multi-temporal CUSUM across 4 Sentinel-1 acquisitions...")
    temporal: Dict[str, Dict[str, Any]] = {}
    for event_id in eval_ids:
        stack_t, dates = temporal_stack_db(prepared[event_id])
        temporal[event_id] = {"stack": stack_t, "dates": dates}

    cusum_scores: Dict[str, List[Dict[str, Any]]] = {}
    for h_value in (2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0):
        _, mask = run_cusum(temporal[val_ids[0]]["stack"], val_valid, h_value)
        score_dict = metrics_dict(mask, labels[val_ids[0]], val_valid)
        cusum_scores.setdefault(val_ids[0], []).append({"h": h_value, "f1": score_dict["f1_score"]})
    best_h = float(max(cusum_scores[val_ids[0]], key=lambda item: (item["f1"], -item["h"]))["h"])
    cusum_meta: Dict[str, Any] = {
        "rule_based_parameters": {"k_allowance": 0.5, "baseline_indices": [0, 1]},
        "val_calibrated_parameters": {"selected_h": best_h},
        "selected_h": best_h,
        "k_allowance": 0.5,
        "val_scan": cusum_scores,
    }
    for event_id in eval_ids:
        score, mask = run_cusum(
            temporal[event_id]["stack"], prepared[event_id]["valid"].astype(bool), best_h
        )
        predictions[event_id]["cusum_score"] = score
        predictions[event_id]["cusum"] = mask
        cusum_meta[event_id] = {"dates": temporal[event_id]["dates"], "baseline": "first two acquisitions (0, 1)"}

    for event_id in eval_ids:
        valid = prepared[event_id]["valid"].astype(bool)
        predictions[event_id]["optical_reference"] = labels[event_id]
        predictions[event_id]["all_burned"] = valid.astype(np.uint8)

    # ---------------- Evaluate Models Separately vs. dNBR and vs. MCD64A1 ----------------
    model_specs = [
        ("Log_Ratio_Baseline", "log_ratio", "log_ratio_score", "Analytical VH log-ratio threshold calibrated on TRAIN", "analytical_baseline", baseline_threshold, None),
        ("LightGBM_Pixel_Spatial", "lightgbm", "lightgbm_prob", "LightGBM on 10 Sentinel-1 dB/change features (Phase G2 Config D)", "learned_ml", lgb_threshold, str(lgb_ckpt_path.relative_to(PROJECT_ROOT)).replace("\\", "/")),
        ("UNet_ResNet34", "unet", "unet_prob", "U-Net ResNet-34 trained from scratch with MaskedBCEDiceLoss on 5-channel SAR patches", "deep_learning", unet_threshold, str(unet_ckpt_path.relative_to(PROJECT_ROOT)).replace("\\", "/")),
        ("CUSUM_Temporal", "cusum", "cusum_score", "Multi-temporal CUSUM on four Sentinel-1 VH acquisitions", "temporal_rule_calibrated", best_h, None),
        ("All_Burned_Trivial", "all_burned", None, "Prevalence reference: predict every valid land pixel burned", "trivial_reference", 0.0, None),
    ]

    models_eval_dnbr: Dict[str, Any] = {}
    models_eval_mcd20m: Dict[str, Any] = {}
    models_eval_mcd500m: Dict[str, Any] = {}

    for name, key, score_key, description, category, thr_val, ckpt_rel in model_specs:
        entry_dnbr: Dict[str, Any] = {
            "description": description,
            "role": "baseline" if key in {"log_ratio", "all_burned"} else "candidate",
            "category": category,
            "reference_product": "Sentinel-2 L2A dNBR >= 0.11 (20 m)",
            "threshold_used": thr_val,
            "checkpoint_path": ckpt_rel,
            "independent_of_label": True,
            "metrics": {},
        }
        entry_mcd20m: Dict[str, Any] = {
            "description": description,
            "role": "baseline" if key in {"log_ratio", "all_burned"} else "candidate",
            "category": category,
            "reference_product": "NASA MODIS MCD64A1.061 QA-Filtered (warped to 20 m)",
            "threshold_used": thr_val,
            "checkpoint_path": ckpt_rel,
            "independent_of_label": True,
            "metrics": {},
        }
        entry_mcd500m: Dict[str, Any] = {
            "description": description,
            "role": "baseline" if key in {"log_ratio", "all_burned"} else "candidate",
            "category": category,
            "reference_product": "NASA MODIS MCD64A1.061 QA-Filtered (native 500 m / 25x25 px blocks)",
            "threshold_used": thr_val,
            "checkpoint_path": ckpt_rel,
            "independent_of_label": True,
            "metrics": {},
        }

        for event_id in eval_ids:
            split = split_of[event_id]
            valid = prepared[event_id]["valid"].astype(bool)
            prediction = predictions[event_id][key]
            score_arr = predictions[event_id].get(score_key) if score_key else None

            # 1. vs Sentinel-2 dNBR
            f1_ci_dnbr = block_bootstrap_f1(prediction, labels[event_id], valid)
            m_dnbr = metrics_dict(prediction, labels[event_id], valid, f1_ci_dnbr)
            if score_arr is not None:
                m_dnbr.update(calculate_probability_auc_metrics(score_arr, labels[event_id], valid_mask=valid))
            else:
                m_dnbr.update({"roc_auc": None, "pr_auc": None})
            m_dnbr["event_id"] = event_id
            if split == "TRAIN":
                m_dnbr["note"] = "resubstitution on single training event; not a generalisation estimate"
            entry_dnbr["metrics"][split] = m_dnbr

            # 2. vs QA-filtered MCD64A1 (20 m)
            f1_ci_mcd = block_bootstrap_f1(prediction, mcd_refs[event_id], valid)
            m_mcd = metrics_dict(prediction, mcd_refs[event_id], valid, f1_ci_mcd)
            if score_arr is not None:
                m_mcd.update(calculate_probability_auc_metrics(score_arr, mcd_refs[event_id], valid_mask=valid))
            else:
                m_mcd.update({"roc_auc": None, "pr_auc": None})
            m_mcd["event_id"] = event_id
            entry_mcd20m["metrics"][split] = m_mcd

            # 3. vs QA-filtered MCD64A1 (500 m blocks)
            blk_m = calculate_coarse_block_reconciliation_metrics(
                prediction, mcd_refs[event_id], valid_mask_20m=valid, block_size_px=25
            )
            blk_m["event_id"] = event_id
            entry_mcd500m["metrics"][split] = blk_m

        models_eval_dnbr[name] = entry_dnbr
        models_eval_mcd20m[name] = entry_mcd20m
        models_eval_mcd500m[name] = entry_mcd500m

    reference_layer: Dict[str, Any] = {
        "description": "Sentinel-2 dNBR threshold; defines the reference labels, not an independent model",
        "independent_of_label": False,
        "threshold_dnbr_calibrated": threshold_dnbr,
        "threshold_dnbr_usgs_moderate": 0.27,
        "metrics": {},
    }
    for event_id in eval_ids:
        split = split_of[event_id]
        data = prepared[event_id]
        valid = data["valid"].astype(bool)
        mcd = data["mcd"].astype(bool) & valid
        label_027 = data["label_usgs_027"].astype(bool) & valid
        reference_layer["metrics"][split] = {
            "event_id": event_id,
            "dnbr_calibrated_vs_mcd64a1": metrics_dict(labels[event_id], mcd, valid),
            "dnbr_usgs_027_vs_mcd64a1": metrics_dict(label_027.astype(np.uint8), mcd, valid),
            "label_calibrated_fraction_valid": float(labels[event_id][valid].mean()),
            "label_usgs_027_fraction_valid": float(label_027[valid].mean()),
            "mcd_fraction_valid": float(mcd[valid].mean()),
        }

    pred_files_info: Dict[str, Any] = {}
    for event_id in eval_ids:
        pred_p = pred_dir / f"{event_id}.npz"
        np.savez_compressed(
            pred_p,
            label=labels[event_id],
            label_usgs_027=prepared[event_id]["label_usgs_027"],
            valid=prepared[event_id]["valid"].astype(np.uint8),
            water_mask=prepared[event_id]["water_mask"].astype(np.uint8),
            mcd=prepared[event_id]["mcd"].astype(np.uint8),
            **predictions[event_id],
        )
        p_bytes, p_sha = compute_file_sha256(pred_p)
        pred_files_info[event_id] = {
            "path": str(pred_p.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "bytes": p_bytes,
            "sha256": p_sha,
        }

    comparison_report = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "run_id": out_run_dir.name,
        "previous_baseline_run_id": BASELINE_RUN_ID,
        "script": "scripts/execute_phase_g_run.py",
        "run_directory": str(out_run_dir.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "dataset_directory": str(dataset_root.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "data_origin": "CROSS_SENSOR_PROTOTYPE",
        "is_nisar": False,
        "nisar_status": {
            "NISAR_METADATA_DISCOVERED": True,
            "NISAR_AUTHENTICATION_REQUIRED": True,
            "NISAR_DOWNLOAD_BLOCKED": True,
            "NISAR_GRANULE_DOWNLOADED": False,
            "NISAR_PROCESSED": False,
            "NISAR_USED_IN_MODEL_TRAINING": False,
            "nisar_pixels_used": 0,
            "current_sar_model_input": "Sentinel-1A C-band RTC (VV/VH, 20 m)",
            "available": False,
            "reason": (
                "NISAR L2 GCOV science products require NASA Earthdata Login credentials with ASF EULA acceptance. "
                "Metadata and same-geometry pre/post pairs were discovered via NASA CMR, "
                "and unauthenticated download attempts were empirically verified as blocked (HTTP 401)."
            ),
        },
        "sensor_input": "Sentinel-1 RTC C-band (VV/VH), 20 m, Microsoft Planetary Computer",
        "reference_labels": {
            "definition": (
                "Sentinel-2 L2A dNBR >= 0.11 over SCL land-valid classes {4,5,7} (water SCL=6 excluded) "
                "and Sentinel-1 valid pixels; USGS moderate-severity dNBR >= 0.27 also evaluated"
            ),
            "threshold": threshold_dnbr,
            "threshold_usgs_moderate": 0.27,
            "threshold_calibration": manifest["label_calibration"],
            "independent_check": "NASA MODIS MCD64A1.061 burned area (500 m, QA Bits 0=1, 1=1, 2=0 filtered)",
            "scientific_disclaimer": (
                "Neither Sentinel-2 dNBR nor MODIS MCD64A1 nor FIRMS hotspots is pixel-level ground truth. "
                "dNBR (20 m) and MCD64A1 (500 m) are independent satellite reference products evaluated on separate leaderboards."
            ),
        },
        "splits": {"TRAIN": train_ids, "VAL": val_ids, "TEST": test_ids},
        "excluded_events": ["CA_TIMBER_2026"],
        "scientific_limitations": [
            "Only one wildfire event (CA_GANN_2026) contributed to supervised model training.",
            "Only one wildfire event (CA_DOME_2026) was used for validation and threshold selection.",
            "Only one wildfire event (CA_BUG_2026) was held out for testing; single-event test performance does not establish multi-event generalization.",
            "CA_TIMBER_2026 was excluded from supervised training due to inverted C-band VH backscatter physics (ROC-AUC 0.4876) and coastal complex overlap.",
            "Zero NISAR L-band pixels were used; all SAR model inputs are Sentinel-1A C-band (5.405 GHz) RTC.",
        ],
        "sample_cap": {"max": 10000, "generated": int(manifest["total_samples"])},
        "patch_dataset": {
            "patch_size": manifest["patch_size"],
            "stride": manifest["stride"],
            "samples": manifest["samples"],
            "normalization_fitted_on": "TRAIN (valid_mask > 0 land pixels only)",
            "water_exclusion_audit": manifest["water_exclusion_audit"],
        },
        "training": {
            "seed": seed,
            "lightgbm": {
                "config_id": "D_unweighted_shallow_auc_es",
                "training_time_sec": round(lgb_time, 2),
                "training_pixels": int(len(y_train_flat)),
                "validation_pixels": int(len(y_val_flat)),
                "best_iteration": lgb_best_iter,
                "total_splits": int(sum(importances.values())),
                "scale_pos_weight": 1.0,
                "eval_metric": "auc",
                "selected_probability_threshold": lgb_threshold,
                "checkpoint_path": str(lgb_ckpt_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
                "checkpoint_bytes": lgb_ckpt_bytes,
                "checkpoint_sha256": lgb_ckpt_sha,
                "top_features": sorted(importances.items(), key=lambda item: item[1], reverse=True)[:6],
            },
            "unet": unet_result,
            "cusum": cusum_meta,
            "log_ratio": {
                "role": "analytical_baseline",
                "threshold_db": baseline_threshold,
                "calibrated_on": train_ids,
                "train_calibration": baseline_cal["selected"],
                "val_diagnostic_calibration": val_lr_cal["selected"],
            },
        },
        "prediction_files": pred_files_info,
        "models": models_eval_dnbr,
        "leaderboards": {
            "vs_sentinel2_dnbr_20m": models_eval_dnbr,
            "vs_nasa_mcd64a1_20m": models_eval_mcd20m,
            "vs_nasa_mcd64a1_500m_blocks": models_eval_mcd500m,
        },
        "reference_label_layer": reference_layer,
        "elapsed_sec": round(time.time() - started, 2),
    }
    comp_out_path = eval_dir / "real_model_comparison.json"
    comp_out_path.write_text(json.dumps(comparison_report, indent=2), encoding="utf-8")

    # ---------------- Phase G5: Geospatial Export & Strict Rasterio Quality Validation ----------------
    logger.info("Phase G5: Exporting GeoTIFFs, RGBA web overlays, GeoJSONs, and validating every layer...")
    acq_manifest = json.loads((acq_dir / "manifests" / "acquisition_manifest.json").read_text(encoding="utf-8"))

    events_summaries: Dict[str, Any] = {}
    geospatial_quality_audit: Dict[str, Any] = {}

    for spec in EVENTS:
        ev_id = spec.event_id
        real_dir = REAL_ROOT / ev_id
        meta = json.loads((real_dir / "metadata.json").read_text(encoding="utf-8"))
        ordered_s1 = sorted(meta["s1"], key=lambda entry: entry["datetime"])
        pre_role, post_role = ordered_s1[0]["role"], ordered_s1[-1]["role"]

        with np.load(real_dir / "stack.npz") as st:
            stack_shapes = {k: st[k].shape for k in st.files}
            # Phase G0/G5 fix: use exact pre and post2 roles used by the models
            vv_pre = st[f"s1_{pre_role}_vv"].astype(np.float32)
            vh_pre = st[f"s1_{pre_role}_vh"].astype(np.float32)
            vv_post = st[f"s1_{post_role}_vv"].astype(np.float32)
            vh_post = st[f"s1_{post_role}_vh"].astype(np.float32)
            s2_b08_pre = st["s2_pre_B08"].astype(np.float32)
            s2_b12_pre = st["s2_pre_B12"].astype(np.float32)
            s2_scl_pre = st["s2_pre_SCL"].astype(np.uint8)
            s2_b08_post = st["s2_post_B08"].astype(np.float32)
            s2_b12_post = st["s2_post_B12"].astype(np.float32)
            s2_scl_post = st["s2_post_SCL"].astype(np.uint8)
            mcd_burn_mask = st["mcd_burn_mask"].astype(np.uint8)
            mcd_burn_date = st["mcd_burn_date"].astype(np.int16)

        verification = verify_before_after_alignment(meta, stack_shapes)
        sar_feats = compute_before_after_sar_features(vv_pre, vh_pre, vv_post, vh_post)
        nbr_pre = compute_nbr(s2_b08_pre, s2_b12_pre)
        nbr_post = compute_nbr(s2_b08_post, s2_b12_post)
        dnbr = compute_dnbr(nbr_pre, nbr_post)
        water_mask = water_optical_mask(s2_scl_pre, s2_scl_post)
        opt_valid_land = valid_optical_mask(
            s2_scl_pre, s2_scl_post, s2_b08_pre, s2_b08_post, exclude_water=True
        )
        valid_mask = (sar_feats["s1_valid_mask"] & opt_valid_land & np.isfinite(dnbr) & (~water_mask)).astype(np.uint8)
        assert int(np.count_nonzero((valid_mask > 0) & water_mask)) == 0

        dnbr_label_mask = ((dnbr >= threshold_dnbr) & (valid_mask > 0)).astype(np.uint8)
        dnbr_usgs_027_mask = ((dnbr >= 0.27) & (valid_mask > 0)).astype(np.uint8)

        with np.load(real_dir / "mcd64a1_ancillary.npz") as anc:
            unc_arr = anc["uncertainty"]
            qa_arr = anc["qa"]
            fd_arr = anc["first_day"]
            ld_arr = anc["last_day"]
            qa_dec = decode_qa_bitmask(qa_arr)
            qa_filtered_mcd_mask = (
                (mcd_burn_mask > 0) & qa_dec["high_quality_land_mask"] & (valid_mask > 0)
            )
            in_win_bd = np.where(
                (mcd_burn_date >= spec.mcd_burn_start_doy) & (mcd_burn_date <= spec.mcd_burn_end_doy),
                mcd_burn_date,
                np.where(mcd_burn_date > 0, 0, mcd_burn_date),
            ).astype(np.int16)

        model_masks: Dict[str, np.ndarray] = {}
        model_probs: Dict[str, np.ndarray] = {}
        pred_p = pred_dir / f"{ev_id}.npz"
        if pred_p.exists():
            with np.load(pred_p) as pr:
                valid_mask = ((pr["valid"] > 0) & (~water_mask)).astype(np.uint8)
                dnbr_label_mask = ((pr["label"] > 0) & (valid_mask > 0)).astype(np.uint8)
                for key in ("unet", "lightgbm", "log_ratio", "cusum", "all_burned"):
                    if key in pr:
                        model_masks[key] = ((pr[key] > 0) & (valid_mask > 0)).astype(np.uint8)
                if "unet_prob" in pr:
                    model_probs["unet"] = np.clip(pr["unet_prob"].astype(np.float32), 0.0, 1.0)
                if "lightgbm_prob" in pr:
                    model_probs["lightgbm"] = np.clip(pr["lightgbm_prob"].astype(np.float32), 0.0, 1.0)
                if "cusum_score" in pr:
                    model_probs["cusum"] = pr["cusum_score"].astype(np.float32)
                model_probs["log_ratio"] = (-sar_feats["delta_vh_db"]).astype(np.float32)
        else:
            model_masks["log_ratio"] = (
                (sar_feats["delta_vh_db"] <= baseline_threshold) & (valid_mask > 0)
            ).astype(np.uint8)
            model_probs["log_ratio"] = (-sar_feats["delta_vh_db"]).astype(np.float32)
            model_masks["all_burned"] = (valid_mask > 0).astype(np.uint8)

        primary_model_key = "unet" if "unet" in model_masks else "log_ratio"
        primary_burn_mask = model_masks[primary_model_key]
        if primary_model_key in ("unet", "lightgbm"):
            primary_burn_prob = np.clip(model_probs[primary_model_key], 0.0, 1.0)
        else:
            # Sigmoid-scaled change score in [0, 1] for excluded event fallback
            raw_sc = model_probs.get(primary_model_key, primary_burn_mask.astype(np.float32))
            primary_burn_prob = (1.0 / (1.0 + np.exp(-np.clip(raw_sc, -20.0, 20.0)))).astype(np.float32)

        # Mask out invalid pixels with nodata in probability and mask rasters
        prob_for_tiff = np.where(valid_mask > 0, primary_burn_prob, -9999.0).astype(np.float32)
        mask_for_tiff = np.where(valid_mask > 0, primary_burn_mask, 255).astype(np.uint8)
        dnbr_for_tiff = np.where(valid_mask > 0, dnbr, -9999.0).astype(np.float32)

        grid_info = meta["grid"]
        crs = str(grid_info["crs"])
        transform_tuple = tuple(float(x) for x in grid_info["transform"])
        bounds_utm = tuple(float(x) for x in grid_info["bounds"])
        pixel_area_m2 = float(abs(transform_tuple[0] * transform_tuple[4]))

        ev_geo_dir = geo_dir / ev_id
        ev_geo_dir.mkdir(parents=True, exist_ok=True)
        layers_png_dir = ev_geo_dir / "layers"
        layers_png_dir.mkdir(parents=True, exist_ok=True)

        products_exported: Dict[str, str] = {}
        # Export both Phase G5 canonical filenames and legacy alias keys/filenames
        tiffs = [
            # Phase G5 canonical names
            ("pre_fire_vh_db", "pre_fire_vh_db.tif", sar_feats["vh_pre_db"], "float32", -9999.0, "Pre-fire Sentinel-1 RTC VH gamma-0 (dB)"),
            ("post_fire_vh_db", "post_fire_vh_db.tif", sar_feats["vh_post_db"], "float32", -9999.0, "Post-fire Sentinel-1 RTC VH gamma-0 (dB)"),
            ("delta_vh_db", "delta_vh_db.tif", sar_feats["delta_vh_db"], "float32", -9999.0, "Post minus Pre Sentinel-1 RTC VH log-ratio change (dB)"),
            ("burn_probability", "burn_probability.tif", prob_for_tiff, "float32", -9999.0, f"Burned-area probability [0,1] ({primary_model_key})"),
            ("predicted_burn_mask", "predicted_burn_mask.tif", mask_for_tiff, "uint8", 255.0, f"Binary burned-area mask (1=burned, 0=unburned, 255=nodata, {primary_model_key})"),
            ("dnbr_reference", "dnbr_reference.tif", dnbr_for_tiff, "float32", -9999.0, "Sentinel-2 L2A differenced Normalized Burn Ratio (dNBR)"),
            ("mcd64a1_reference", "mcd64a1_reference.tif", in_win_bd, "int16", -1.0, "NASA MODIS MCD64A1.061 ordinal day of burn"),
            ("valid_land_mask", "valid_land_mask.tif", valid_mask, "uint8", 255.0, "Valid land observation mask (1=valid SAR+optical land, 0=invalid/cloud/water)"),
            # Legacy compatibility aliases
            ("pre_vh_db", "pre_vh_db.tif", sar_feats["vh_pre_db"], "float32", -9999.0, "Pre-fire Sentinel-1 RTC VH gamma-0 (dB)"),
            ("post_vh_db", "post_vh_db.tif", sar_feats["vh_post_db"], "float32", -9999.0, "Post-fire Sentinel-1 RTC VH gamma-0 (dB)"),
            ("burn_prob", "burn_prob.tif", prob_for_tiff, "float32", -9999.0, f"Burned-area probability [0,1] ({primary_model_key})"),
            ("burn_mask", "burn_mask.tif", mask_for_tiff, "uint8", 255.0, f"Binary burned-area mask (1=burned, 0=unburned, 255=nodata, {primary_model_key})"),
            ("dnbr", "dnbr.tif", dnbr_for_tiff, "float32", -9999.0, "Sentinel-2 L2A differenced Normalized Burn Ratio (dNBR)"),
            ("mcd64a1_burn_date", "mcd64a1_burn_date.tif", in_win_bd, "int16", -1.0, "NASA MODIS MCD64A1.061 ordinal day of burn"),
            ("valid_mask", "valid_mask.tif", valid_mask, "uint8", 255.0, "Valid land observation mask (1=valid SAR+optical land, 0=invalid/cloud/water)"),
        ]
        for key, fname, arr, dt, nodata_val, desc in tiffs:
            p = export_geotiff_layer(
                ev_geo_dir / fname,
                arr,
                crs=crs,
                transform_tuple=transform_tuple,
                dtype=dt,
                nodata=nodata_val,
                description=desc,
            )
            products_exported[key] = str(p.relative_to(PROJECT_ROOT)).replace("\\", "/")

        # Render web-ready RGBA PNG overlays for interactive map layers
        overlay_specs = [
            ("pre_fire_vh_db", sar_feats["vh_pre_db"], "viridis", -25.0, -8.0, False, (0, 0, 0)),
            ("post_fire_vh_db", sar_feats["vh_post_db"], "viridis", -25.0, -8.0, False, (0, 0, 0)),
            ("delta_vh_db", sar_feats["delta_vh_db"], "RdBu_r", -4.0, 4.0, False, (0, 0, 0)),
            ("burn_probability", primary_burn_prob, "inferno", 0.0, 1.0, False, (0, 0, 0)),
            ("predicted_burn_mask", primary_burn_mask.astype(np.float32), "Oranges", 0.0, 1.0, True, (0.96, 0.62, 0.04)),
            ("dnbr_reference", dnbr_label_mask.astype(np.float32), "Reds", 0.0, 1.0, True, (0.86, 0.15, 0.15)),
            ("mcd64a1_reference", qa_filtered_mcd_mask.astype(np.float32), "Purples", 0.0, 1.0, True, (0.58, 0.20, 0.92)),
            ("valid_land_mask", valid_mask.astype(np.float32), "Greens", 0.0, 1.0, True, (0.06, 0.72, 0.50)),
        ]
        overlay_pngs: Dict[str, str] = {}
        for ov_key, ov_arr, cmap_n, vmin, vmax, is_bin, rgb_col in overlay_specs:
            ov_p = export_rgba_overlay_png(
                layers_png_dir / f"{ov_key}.png",
                ov_arr,
                valid_mask=valid_mask if ov_key != "valid_land_mask" else np.ones_like(valid_mask),
                cmap_name=cmap_n,
                vmin=vmin,
                vmax=vmax,
                is_binary_mask=is_bin,
                mask_rgb=rgb_col,
            )
            overlay_pngs[ov_key] = str(ov_p.relative_to(PROJECT_ROOT)).replace("\\", "/")

        # Validate every canonical GeoTIFF with rasterio
        ev_audit: Dict[str, Any] = {}
        canonical_keys = (
            "pre_fire_vh_db",
            "post_fire_vh_db",
            "delta_vh_db",
            "burn_probability",
            "predicted_burn_mask",
            "dnbr_reference",
            "mcd64a1_reference",
            "valid_land_mask",
        )
        for c_key in canonical_keys:
            tif_p = PROJECT_ROOT / products_exported[c_key]
            with rasterio.open(tif_p) as src:
                band = src.read(1)
                nd = src.nodata
                valid_px = band != nd if nd is not None else np.isfinite(band)
                vals = band[valid_px]
                min_v = float(np.min(vals)) if vals.size else None
                max_v = float(np.max(vals)) if vals.size else None
                ev_audit[c_key] = {
                    "file": tif_p.name,
                    "exists": True,
                    "size_bytes": tif_p.stat().st_size,
                    "crs": str(src.crs),
                    "transform": list(src.transform)[:6],
                    "dimensions_hw": [src.height, src.width],
                    "resolution_m": [abs(src.transform.a), abs(src.transform.e)],
                    "dtype": str(src.dtypes[0]),
                    "nodata": nd,
                    "min_valid_value": round(min_v, 4) if min_v is not None else None,
                    "max_valid_value": round(max_v, 4) if max_v is not None else None,
                    "aligned_to_event_grid": (
                        str(src.crs) == crs
                        and (src.height, src.width) == (800, 800)
                        and abs(src.transform.a) == 20.0
                        and abs(src.transform.e) == 20.0
                    ),
                }
                assert ev_audit[c_key]["aligned_to_event_grid"] is True
                if c_key == "burn_probability" and min_v is not None and max_v is not None:
                    assert -1e-5 <= min_v <= max_v <= 1.0 + 1e-5
                if c_key == "predicted_burn_mask":
                    unique_vals = set(np.unique(band).tolist())
                    assert unique_vals.issubset({0, 1, 255})

        geospatial_quality_audit[ev_id] = {
            "event_id": ev_id,
            "crs": crs,
            "bounds_utm": list(bounds_utm),
            "water_pixels_in_valid_mask": int(np.count_nonzero((valid_mask > 0) & water_mask)),
            "all_rasters_valid_and_aligned": True,
            "layers": ev_audit,
        }

        ref_dnbr_area = compute_geospatial_burned_area(
            dnbr_label_mask, valid_mask, crs=crs, transform=transform_tuple,
            probability_or_score=dnbr, threshold_used=threshold_dnbr, threshold_delta=0.02,
        )
        ref_dnbr_027_area = compute_geospatial_burned_area(
            dnbr_usgs_027_mask, valid_mask, crs=crs, transform=transform_tuple,
            probability_or_score=dnbr, threshold_used=0.27, threshold_delta=0.02,
        )
        mcd_anc_summary = summarize_mcd64a1_layers(
            in_win_bd, uncertainty=unc_arr, qa=qa_arr, first_day=fd_arr, last_day=ld_arr, pixel_area_m2=pixel_area_m2,
        )
        ref_mcd_area = compute_geospatial_burned_area(
            qa_filtered_mcd_mask.astype(np.uint8), valid_mask, crs=crs, transform=transform_tuple,
        )

        model_area_estimates: Dict[str, Any] = {}
        for m_key, m_mask in model_masks.items():
            if m_key == "unet":
                t_used, t_delta, low_tail, score_arr = unet_threshold, 0.05, False, model_probs.get("unet")
            elif m_key == "lightgbm":
                t_used, t_delta, low_tail, score_arr = lgb_threshold, 0.02, False, model_probs.get("lightgbm")
            elif m_key == "log_ratio":
                t_used, t_delta, low_tail, score_arr = baseline_threshold, 0.25, True, sar_feats["delta_vh_db"]
            else:
                t_used, t_delta, low_tail, score_arr = None, 0.05, False, model_probs.get(m_key)
            model_area_estimates[m_key] = compute_geospatial_burned_area(
                m_mask, valid_mask, crs=crs, transform=transform_tuple,
                probability_or_score=score_arr, threshold_used=t_used, threshold_delta=t_delta, is_lower_tail=low_tail,
            ).to_dict()

        geojson_path = export_aoi_boundary_geojson(
            ev_geo_dir / "aoi_boundary.geojson",
            event_id=ev_id,
            fire_name=spec.name,
            crs=crs,
            bounds_utm=bounds_utm,
            extra_properties={
                "split": spec.split,
                "include_in_training": spec.include_in_training,
                "primary_model": primary_model_key,
                "predicted_burned_area_km2": model_area_estimates[primary_model_key]["burned_area_km2"],
                "dnbr_reference_burned_area_km2": ref_dnbr_area.burned_area_km2,
                "dnbr_usgs_027_burned_area_km2": ref_dnbr_027_area.burned_area_km2,
                "mcd64a1_burned_area_km2": ref_mcd_area.burned_area_km2,
                "firms_hotspots_count": acq_manifest["firms_wildfire_events"][ev_id]["buffered_aoi_summary"]["total_hotspots"],
            },
        )
        products_exported["aoi_boundary_geojson"] = str(geojson_path.relative_to(PROJECT_ROOT)).replace("\\", "/")

        aoi_gj_data = json.loads(geojson_path.read_text(encoding="utf-8"))
        bounds_wgs84 = aoi_gj_data["features"][0]["properties"]["bounds_wgs84"]

        src_firms_gj = PROJECT_ROOT / acq_manifest["firms_wildfire_events"][ev_id]["hotspots_geojson"]["path"]
        dst_firms_gj = ev_geo_dir / "firms_hotspots.geojson"
        if src_firms_gj.exists():
            shutil.copy2(src_firms_gj, dst_firms_gj)
            products_exported["firms_hotspots_geojson"] = str(dst_firms_gj.relative_to(PROJECT_ROOT)).replace("\\", "/")

        s1_pre_dt = ordered_s1[0]["datetime"][:10]
        s1_post_dt = ordered_s1[-1]["datetime"][:10]
        overview_png_path = export_before_after_overview_png(
            ev_geo_dir / "before_after_overview.png",
            event_id=ev_id,
            fire_name=spec.name,
            split=spec.split,
            crs=crs,
            bounds_utm=bounds_utm,
            pre_date=s1_pre_dt,
            post_date=s1_post_dt,
            vh_pre_db=sar_feats["vh_pre_db"],
            vh_post_db=sar_feats["vh_post_db"],
            delta_vh_db=sar_feats["delta_vh_db"],
            dnbr=dnbr,
            mcd_burn_mask=qa_filtered_mcd_mask.astype(np.uint8),
            pred_burn_mask=primary_burn_mask,
            valid_mask=valid_mask,
            primary_model_key=primary_model_key,
            pred_area_km2=model_area_estimates[primary_model_key]["burned_area_km2"],
            dnbr_area_km2=ref_dnbr_area.burned_area_km2,
            mcd_area_km2=ref_mcd_area.burned_area_km2,
        )
        products_exported["before_after_overview_png"] = str(overview_png_path.relative_to(PROJECT_ROOT)).replace("\\", "/")

        independent_validation_by_model: Dict[str, Any] = {}
        for m_key, m_mask in model_masks.items():
            vs_dnbr = calculate_segmentation_metrics(
                m_mask, dnbr_label_mask, valid_mask=valid_mask, pixel_area_m2=pixel_area_m2
            ).to_dict()
            vs_dnbr_027 = calculate_segmentation_metrics(
                m_mask, dnbr_usgs_027_mask, valid_mask=valid_mask, pixel_area_m2=pixel_area_m2
            ).to_dict()
            vs_mcd = calculate_segmentation_metrics(
                m_mask, qa_filtered_mcd_mask.astype(np.uint8), valid_mask=valid_mask, pixel_area_m2=pixel_area_m2
            ).to_dict()
            vs_mcd_500m_block = calculate_coarse_block_reconciliation_metrics(
                m_mask, qa_filtered_mcd_mask.astype(np.uint8), valid_mask_20m=valid_mask, block_size_px=25
            )
            score_for_auc = model_probs.get(m_key)
            if score_for_auc is not None:
                vs_dnbr.update(calculate_probability_auc_metrics(score_for_auc, dnbr_label_mask, valid_mask=valid_mask))
                vs_mcd.update(calculate_probability_auc_metrics(score_for_auc, qa_filtered_mcd_mask.astype(np.uint8), valid_mask=valid_mask))
            independent_validation_by_model[m_key] = {
                "vs_sentinel2_dnbr": vs_dnbr,
                "vs_sentinel2_dnbr_usgs_027": vs_dnbr_027,
                "vs_nasa_mcd64a1_qa_filtered": vs_mcd,
                "vs_nasa_mcd64a1_500m_block_reconciled": vs_mcd_500m_block,
            }

        dnbr_vs_mcd = calculate_segmentation_metrics(
            dnbr_label_mask, qa_filtered_mcd_mask.astype(np.uint8), valid_mask=valid_mask, pixel_area_m2=pixel_area_m2
        ).to_dict()
        dnbr_vs_mcd["block_reconciled_500m"] = calculate_coarse_block_reconciliation_metrics(
            dnbr_label_mask, qa_filtered_mcd_mask.astype(np.uint8), valid_mask_20m=valid_mask, block_size_px=25
        )

        valid_bool = valid_mask > 0
        prob_valid = primary_burn_prob[valid_bool]
        dvh_valid = sar_feats["delta_vh_db"][valid_bool]

        event_summary = {
            "event_id": ev_id,
            "run_id": out_run_dir.name,
            "fire_name": spec.name,
            "state_region": spec.region,
            "split": spec.split,
            "include_in_training": spec.include_in_training,
            "is_nisar": False,
            "data_origin": "CROSS_SENSOR_PROTOTYPE",
            "bounds_wgs84": bounds_wgs84,
            "water_pixels_excluded_scl6": int(np.count_nonzero(water_mask)),
            "water_pixels_remaining_in_valid": int(np.count_nonzero((valid_mask > 0) & water_mask)),
            "firms_active_fire_summary": acq_manifest["firms_wildfire_events"][ev_id]["buffered_aoi_summary"],
            "before_after_verification": verification,
            "sar_change_statistics": {
                "vh_pre_mean_db": round(float(np.nanmean(sar_feats["vh_pre_db"][valid_bool])), 4),
                "vh_post_mean_db": round(float(np.nanmean(sar_feats["vh_post_db"][valid_bool])), 4),
                "delta_vh_mean_db": round(float(np.nanmean(dvh_valid)), 4),
                "delta_vh_std_db": round(float(np.nanstd(dvh_valid)), 4),
                "delta_vh_p10_db": round(float(np.nanpercentile(dvh_valid, 10)), 4),
                "delta_vh_p90_db": round(float(np.nanpercentile(dvh_valid, 90)), 4),
            },
            "burn_probability_summary": {
                "model": primary_model_key,
                "threshold": unet_threshold if primary_model_key == "unet" else baseline_threshold,
                "mean_probability_valid": round(float(np.mean(prob_valid)), 4),
                "median_probability_valid": round(float(np.median(prob_valid)), 4),
                "p90_probability_valid": round(float(np.percentile(prob_valid, 90)), 4),
                "max_probability_valid": round(float(np.max(prob_valid)), 4),
                "min_probability_valid": round(float(np.min(prob_valid)), 4),
            },
            "primary_model": primary_model_key,
            "area_estimates": {
                "primary_model_burned_area": model_area_estimates[primary_model_key],
                "by_model": model_area_estimates,
                "sentinel2_dnbr_reference": ref_dnbr_area.to_dict(),
                "sentinel2_dnbr_usgs_027_reference": ref_dnbr_027_area.to_dict(),
                "nasa_mcd64a1_reference": ref_mcd_area.to_dict(),
            },
            "independent_validation": {
                "models": independent_validation_by_model,
                "sentinel2_dnbr_vs_nasa_mcd64a1": dnbr_vs_mcd,
                "mcd64a1_ancillary_summary": mcd_anc_summary,
            },
            "geospatial_products": products_exported,
            "web_overlay_pngs": overlay_pngs,
            "raster_quality_audit": geospatial_quality_audit[ev_id],
        }
        summary_path = ev_geo_dir / "before_after_summary.json"
        summary_path.write_text(json.dumps(event_summary, indent=2), encoding="utf-8")
        products_exported["before_after_summary_json"] = str(summary_path.relative_to(PROJECT_ROOT)).replace("\\", "/")
        events_summaries[ev_id] = event_summary

    geo_audit_path = eval_dir / "geospatial_quality_audit.json"
    geo_audit_path.write_text(json.dumps(geospatial_quality_audit, indent=2), encoding="utf-8")

    comp_val_report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "run_id": out_run_dir.name,
        "previous_baseline_run_id": BASELINE_RUN_ID,
        "run_directory": str(out_run_dir.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "acquisition_directory": str(acq_dir.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "data_origin": "CROSS_SENSOR_PROTOTYPE",
        "is_nisar": False,
        "nisar_completion_gates": {
            "NISAR_METADATA_DISCOVERED": True,
            "NISAR_AUTHENTICATION_REQUIRED": True,
            "NISAR_DOWNLOAD_BLOCKED": True,
            "NISAR_GRANULE_DOWNLOADED": False,
            "NISAR_PROCESSED": False,
            "NISAR_USED_IN_MODEL_TRAINING": False,
        },
        "splits": comparison_report["splits"],
        "excluded_events": ["CA_TIMBER_2026"],
        "stored_model_comparison": comparison_report["models"],
        "leaderboards": comparison_report["leaderboards"],
        "events_before_after_and_validation": events_summaries,
        "geospatial_quality_audit": geospatial_quality_audit,
        "processing_elapsed_sec": round(time.time() - started, 2),
    }
    comp_val_path = eval_dir / "comprehensive_validation_report.json"
    comp_val_path.write_text(json.dumps(comp_val_report, indent=2), encoding="utf-8")

    # Preserve previous latest_run.json before updating pointer
    latest_ptr_file = out_run_dir.parent / "latest_run.json"
    if latest_ptr_file.exists():
        backup_ptr = out_run_dir.parent / f"latest_run.previous_{BASELINE_RUN_ID}.json"
        if not backup_ptr.exists():
            shutil.copy2(latest_ptr_file, backup_ptr)

    latest_pointer = {
        "run_id": out_run_dir.name,
        "previous_baseline_run_id": BASELINE_RUN_ID,
        "generated_at_utc": comp_val_report["generated_at_utc"],
        "acquisition_dir": str(acq_dir.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "output_run_dir": str(out_run_dir.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "acquisition_manifest_path": str((acq_dir / "manifests" / "acquisition_manifest.json").relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "dataset_manifest_path": str((dataset_root / "dataset_manifest.json").relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "model_comparison_path": str(comp_out_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "comprehensive_validation_path": str(comp_val_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "geospatial_quality_audit_path": str(geo_audit_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
    }
    latest_ptr_file.write_text(json.dumps(latest_pointer, indent=2), encoding="utf-8")
    logger.info("Phase G4 & G5 complete in %.1fs. Updated latest_run.json -> %s", time.time() - started, out_run_dir.name)
    return comp_val_report


if __name__ == "__main__":
    acq_dir = PROJECT_ROOT / "data" / "acquisitions" / PHASE_G_RUN_ID
    out_run_dir = PROJECT_ROOT / "outputs" / "runs" / PHASE_G_RUN_ID
    stage_1_prepare_versioned_dataset(acq_dir)
    stage_2_retrain_and_validate(acq_dir, out_run_dir, epochs=6, seed=42)
