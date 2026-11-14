"""Run the honest, event-grouped experiments on the acquired real-data stacks.

This script deliberately does **not** use any synthetic scene. Inputs are Sentinel-1 RTC
(C-band) and the Sentinel-2/MCD64A1 reference layers acquired by
``scripts/acquire_real_data.py``. The reference labels are Sentinel-2 dNBR masks with a
threshold calibrated on the TRAIN event only; MCD64A1 is kept as an independent, coarse
cross-check. Therefore every model here is a **cross-sensor prototype**, not a NISAR
model.

Models / analyses
-----------------
1. Calibrated VH log-ratio baseline (threshold fitted on TRAIN only).
2. LightGBM pixel classifier (trained on TRAIN, early-stopped on VAL, threshold on VAL).
3. U-Net ResNet-34 (trained on TRAIN patches, checkpointed on VAL).
4. CUSUM on the four real Sentinel-1 dates (``h`` selected on VAL only).
5. Sentinel-2 dNBR reference layer (not an independent model).
6. All-burned trivial baseline (context for imbalanced test prevalence).

Outputs
-------
``outputs/evaluation/real_model_comparison.json`` plus probability/score maps and a QA
figure for the held-out TEST event.
"""

from __future__ import annotations

import argparse
import json
import logging
import platform
import sys
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import torch
from scipy.ndimage import uniform_filter

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.processing.change_detection.cusum import CUSUMDetector
from backend.processing.models.dataset import SARPatchDataset
from backend.processing.models.lightgbm_model import LightGBMBurnedAreaClassifier
from backend.processing.models.trainer import train_unet_model
from backend.processing.models.unet_resnet import UNetResNet34
from backend.processing.validation.metrics import calculate_segmentation_metrics

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("run-real-pipeline")

REAL_ROOT = PROJECT_ROOT / "data" / "real"
DATASET_ROOT = REAL_ROOT / "dataset"
OUTPUT_ROOT = PROJECT_ROOT / "outputs" / "evaluation"
MAP_ROOT = OUTPUT_ROOT / "real_predictions"
CHECKPOINT_DIR = PROJECT_ROOT / "models" / "checkpoints"
PIXEL_AREA_M2 = 400.0  # 20 m x 20 m

FEATURE_NAMES = [
    "vv_pre_db",
    "vh_pre_db",
    "vv_post_db",
    "vh_post_db",
    "delta_vv_db",
    "delta_vh_db",
    "delta_diff_db",
    "local_mean_delta_vh",
    "local_std_delta_vh",
    "post_vv_minus_vh_db",
]


# ---------------------------------------------------------------------------
# Loading and array helpers
# ---------------------------------------------------------------------------
def load_manifest() -> Dict[str, Any]:
    with open(DATASET_ROOT / "dataset_manifest.json", "r", encoding="utf-8") as handle:
        return json.load(handle)


def load_prepared(event_id: str) -> Dict[str, np.ndarray]:
    path = DATASET_ROOT / "prepared" / f"{event_id}.npz"
    if not path.exists():
        raise FileNotFoundError(f"Missing prepared scene {path}; run build_real_dataset.py first.")
    with np.load(path, allow_pickle=False) as data:
        return {key: data[key] for key in data.files}


def power_to_db(power: np.ndarray) -> np.ndarray:
    """dB conversion that preserves missing pixels as NaN (no epsilon floor)."""
    out = np.full(power.shape, np.nan, dtype=np.float32)
    ok = np.isfinite(power) & (power > 0)
    out[ok] = 10.0 * np.log10(power[ok])
    return out


def edge_aware_positions(size: int, tile: int, stride: int) -> List[int]:
    if size < tile:
        return [0]
    positions = list(range(0, size - tile + 1, stride))
    if positions[-1] != size - tile:
        positions.append(size - tile)
    return sorted(set(positions))


def scene_stack(prepared: Dict[str, np.ndarray]) -> np.ndarray:
    """(5, H, W) dB stack identical in definition to the real patch dataset."""
    vv_pre = power_to_db(prepared["pre_vv"])
    vh_pre = power_to_db(prepared["pre_vh"])
    vv_post = power_to_db(prepared["post_vv"])
    vh_post = power_to_db(prepared["post_vh"])
    delta_vh = vh_post - vh_pre
    return np.stack([vv_pre, vh_pre, vv_post, vh_post, delta_vh], axis=0).astype(np.float32)


def fill_scene_missing(stack: np.ndarray, means: np.ndarray) -> np.ndarray:
    filled = stack.copy()
    for channel in range(stack.shape[0]):
        values = filled[channel]
        values[~np.isfinite(values)] = float(means[channel])
        filled[channel] = values
    return filled


def extract_features_db(
    vv_pre_db: np.ndarray,
    vh_pre_db: np.ndarray,
    vv_post_db: np.ndarray,
    vh_post_db: np.ndarray,
) -> np.ndarray:
    """10 physical change features derived from the dB stack."""
    delta_vv = vv_post_db - vv_pre_db
    delta_vh = vh_post_db - vh_pre_db
    delta_diff = delta_vh - delta_vv

    mean_dvh = uniform_filter(delta_vh, size=5, mode="nearest")
    mean_sq_dvh = uniform_filter(delta_vh**2, size=5, mode="nearest")
    std_dvh = np.sqrt(np.maximum(mean_sq_dvh - mean_dvh**2, 0.0))
    post_ratio = vv_post_db - vh_post_db

    return np.stack(
        [
            vv_pre_db,
            vh_pre_db,
            vv_post_db,
            vh_post_db,
            delta_vv,
            delta_vh,
            delta_diff,
            mean_dvh,
            std_dvh,
            post_ratio,
        ],
        axis=-1,
    ).astype(np.float32)


def features_from_scene(stack_db: np.ndarray, means: np.ndarray) -> np.ndarray:
    filled = fill_scene_missing(stack_db, means)
    return extract_features_db(filled[0], filled[1], filled[2], filled[3])


# ---------------------------------------------------------------------------
# Metrics and uncertainty
# ---------------------------------------------------------------------------
def metrics_dict(
    prediction: np.ndarray,
    reference: np.ndarray,
    valid: np.ndarray,
    f1_ci: Optional[Tuple[float, float]] = None,
) -> Dict[str, Any]:
    result = calculate_segmentation_metrics(
        prediction, reference, valid_mask=valid, pixel_area_m2=PIXEL_AREA_M2
    ).to_dict()
    result["valid_pixels"] = int(np.count_nonzero(valid))
    if f1_ci is not None:
        result["f1_ci95_block_bootstrap"] = [round(float(f1_ci[0]), 4), round(float(f1_ci[1]), 4)]
    return result


def block_bootstrap_f1(
    prediction: np.ndarray,
    reference: np.ndarray,
    valid: np.ndarray,
    block: int = 64,
    iterations: int = 400,
    seed: int = 2026,
) -> Tuple[float, float]:
    """Spatially blocked bootstrap CI, because neighbouring pixels are correlated."""
    pred = (prediction > 0).astype(np.uint8)
    ref = (reference > 0).astype(np.uint8)
    rows = edge_aware_positions(pred.shape[0], block, block)
    cols = edge_aware_positions(pred.shape[1], block, block)
    blocks = []
    for row in rows:
        for col in cols:
            v = valid[row : row + block, col : col + block]
            if not v.any():
                continue
            p = pred[row : row + block, col : col + block][v]
            r = ref[row : row + block, col : col + block][v]
            tp = int(np.count_nonzero(p & r))
            fp = int(np.count_nonzero(p & ~r))
            fn = int(np.count_nonzero(~p & r))
            blocks.append((tp, fp, fn))
    if not blocks:
        return 0.0, 0.0
    rng = np.random.default_rng(seed)
    values = np.empty(iterations, dtype=np.float64)
    for i in range(iterations):
        indices = rng.integers(0, len(blocks), size=len(blocks))
        tp = sum(blocks[j][0] for j in indices)
        fp = sum(blocks[j][1] for j in indices)
        fn = sum(blocks[j][2] for j in indices)
        values[i] = 2.0 * tp / max(2 * tp + fp + fn, 1e-7)
    return float(np.percentile(values, 2.5)), float(np.percentile(values, 97.5))


# ---------------------------------------------------------------------------
# Baseline
# ---------------------------------------------------------------------------
def calibrate_log_ratio(
    delta_vh: np.ndarray,
    label: np.ndarray,
    valid: np.ndarray,
) -> Dict[str, Any]:
    """Choose a VH log-ratio threshold on TRAIN by maximising pixel F1."""
    candidates = np.round(np.arange(-10.0, 0.45, 0.05), 2)
    best = {"threshold_db": -1.0, "f1": -1.0, "precision": 0.0, "recall": 0.0}
    curve = []
    ref = (label > 0) & valid
    for threshold in candidates:
        pred = (delta_vh <= threshold) & valid
        tp = int(np.count_nonzero(pred & ref))
        fp = int(np.count_nonzero(pred & ~ref))
        fn = int(np.count_nonzero(~pred & ref))
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        curve.append({"threshold_db": float(threshold), "precision": precision, "recall": recall, "f1": f1})
        if f1 > best["f1"]:
            best = {
                "threshold_db": float(threshold),
                "f1": f1,
                "precision": precision,
                "recall": recall,
            }
    return {"selected": best, "curve": curve}


# ---------------------------------------------------------------------------
# U-Net inference
# ---------------------------------------------------------------------------
def predict_unet_scene(
    model: UNetResNet34,
    stack_db: np.ndarray,
    means: np.ndarray,
    stds: np.ndarray,
    tile: int = 128,
    stride: int = 64,
    batch_size: int = 4,
) -> np.ndarray:
    model.eval()
    filled = fill_scene_missing(stack_db, means)
    normalized = ((filled - means[:, None, None]) / np.maximum(stds[:, None, None], 1e-4)).astype(np.float32)

    prob_sum = np.zeros(stack_db.shape[1:], dtype=np.float32)
    counts = np.zeros(stack_db.shape[1:], dtype=np.float32)
    rows = edge_aware_positions(stack_db.shape[1], tile, stride)
    cols = edge_aware_positions(stack_db.shape[2], tile, stride)
    coords = [(r, c) for r in rows for c in cols]

    with torch.no_grad():
        for start in range(0, len(coords), batch_size):
            batch_coords = coords[start : start + batch_size]
            batch = np.stack(
                [
                    normalized[:, r : r + tile, c : c + tile]
                    for r, c in batch_coords
                ],
                axis=0,
            )
            logits = model(torch.from_numpy(batch).float())
            probs = torch.sigmoid(logits).squeeze(1).numpy().astype(np.float32)
            for (r, c), prob in zip(batch_coords, probs):
                prob_sum[r : r + tile, c : c + tile] += prob
                counts[r : r + tile, c : c + tile] += 1.0
    return prob_sum / np.maximum(counts, 1.0)


def select_probability_threshold(
    probability: np.ndarray,
    label: np.ndarray,
    valid: np.ndarray,
    candidates: Iterable[float] = tuple(np.round(np.arange(0.1, 0.91, 0.02), 2)),
) -> Dict[str, Any]:
    best = {"threshold": 0.5, "f1": -1.0, "precision": 0.0, "recall": 0.0}
    curve = []
    ref = (label > 0) & valid
    for threshold in candidates:
        pred = (probability >= threshold) & valid
        tp = int(np.count_nonzero(pred & ref))
        fp = int(np.count_nonzero(pred & ~ref))
        fn = int(np.count_nonzero(~pred & ref))
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        curve.append({"threshold": float(threshold), "precision": precision, "recall": recall, "f1": f1})
        if f1 > best["f1"]:
            best = {"threshold": float(threshold), "f1": f1, "precision": precision, "recall": recall}
    return {"selected": best, "curve": curve}


# ---------------------------------------------------------------------------
# CUSUM
# ---------------------------------------------------------------------------
def temporal_stack_db(prepared: Dict[str, np.ndarray]) -> Tuple[np.ndarray, List[str]]:
    dates = [str(value) for value in prepared["temporal_dates"]]
    layers = []
    for index in range(len(dates)):
        power = prepared[f"temporal_{index}_vh"]
        layers.append(power_to_db(power))
    stack = np.stack(layers, axis=0)
    # Fill isolated missing pixels with their temporal median so NaN does not poison CUSUM.
    median = np.nanmedian(stack, axis=0)
    median = np.where(np.isfinite(median), median, -17.0)
    for index in range(stack.shape[0]):
        missing = ~np.isfinite(stack[index])
        stack[index][missing] = median[missing]
    return stack.astype(np.float32), dates


def run_cusum(
    stack_db: np.ndarray,
    valid: np.ndarray,
    h_decision: float,
    baseline_indices: Tuple[int, int] = (0, 1),
) -> Tuple[np.ndarray, np.ndarray]:
    detector = CUSUMDetector(k_allowance=0.5, h_decision=h_decision)
    score, mask = detector.detect_downward_change(
        [layer for layer in stack_db], baseline_indices=baseline_indices
    )
    mask = (mask > 0) & valid
    return score.astype(np.float32), mask.astype(np.uint8)


# ---------------------------------------------------------------------------
# Main experiment
# ---------------------------------------------------------------------------
def run(epochs: int, skip_unet: bool, seed: int) -> Dict[str, Any]:
    started = time.time()
    manifest = load_manifest()
    means = np.asarray(manifest["normalization"]["mean"], dtype=np.float32)
    stds = np.asarray(manifest["normalization"]["std"], dtype=np.float32)
    threshold_dnbr = float(manifest["label_threshold"])
    splits = manifest["splits"]

    prepared: Dict[str, Dict[str, np.ndarray]] = {}
    labels: Dict[str, np.ndarray] = {}
    stacks: Dict[str, np.ndarray] = {}
    for event_id in splits["TRAIN"] + splits["VAL"] + splits["TEST"]:
        data = load_prepared(event_id)
        prepared[event_id] = data
        valid = data["valid"].astype(bool)
        labels[event_id] = ((data["dnbr"] >= threshold_dnbr) & valid).astype(np.uint8)
        stacks[event_id] = scene_stack(data)

    train_ids, val_ids, test_ids = splits["TRAIN"], splits["VAL"], splits["TEST"]
    if not train_ids or not val_ids or not test_ids:
        raise RuntimeError("Dataset must contain non-empty TRAIN, VAL and TEST event groups.")
    eval_ids = train_ids + val_ids + test_ids
    split_of = {**{eid: "TRAIN" for eid in train_ids}, **{eid: "VAL" for eid in val_ids}, **{eid: "TEST" for eid in test_ids}}

    # ---------------- Baseline: VH log-ratio, TRAIN calibration ----------------
    logger.info("Calibrating log-ratio baseline on TRAIN events only: %s", train_ids)
    train_delta = np.concatenate([stacks[eid][4][prepared[eid]["valid"].astype(bool)] for eid in train_ids])
    train_label = np.concatenate([labels[eid][prepared[eid]["valid"].astype(bool)] for eid in train_ids])
    train_valid = np.ones_like(train_label, dtype=bool)
    baseline_cal = calibrate_log_ratio(train_delta, train_label, train_valid)
    baseline_threshold = baseline_cal["selected"]["threshold_db"]
    logger.info("Selected VH log-ratio threshold: %.2f dB", baseline_threshold)

    predictions: Dict[str, Dict[str, np.ndarray]] = {}
    for event_id in eval_ids:
        delta = stacks[event_id][4]
        predictions.setdefault(event_id, {})["log_ratio"] = (
            (delta <= baseline_threshold) & prepared[event_id]["valid"].astype(bool)
        ).astype(np.uint8)

    # ---------------- LightGBM ----------------
    logger.info("Extracting LightGBM features from TRAIN/VAL full scenes")
    train_features = features_from_scene(stacks[train_ids[0]], means)
    train_valid = prepared[train_ids[0]]["valid"].astype(bool)
    y_train = labels[train_ids[0]]
    # Deterministic spatial thinning to reduce autocorrelation; all retained pixels are TRAIN.
    X_train = train_features[::2, ::2, :].reshape(-1, len(FEATURE_NAMES))[train_valid[::2, ::2].ravel()]
    y_train_flat = y_train[::2, ::2].ravel()[train_valid[::2, ::2].ravel()]

    val_features = features_from_scene(stacks[val_ids[0]], means)
    val_valid = prepared[val_ids[0]]["valid"].astype(bool)
    X_val = val_features[::2, ::2, :].reshape(-1, len(FEATURE_NAMES))[val_valid[::2, ::2].ravel()]
    y_val_flat = labels[val_ids[0]][::2, ::2].ravel()[val_valid[::2, ::2].ravel()]
    logger.info("LightGBM pixels: TRAIN=%d (%.1f%% positive), VAL=%d (%.1f%% positive)",
                len(y_train_flat), 100 * y_train_flat.mean(), len(y_val_flat), 100 * y_val_flat.mean())

    lgb_started = time.time()
    lgb_classifier = LightGBMBurnedAreaClassifier(
        n_estimators=250,
        learning_rate=0.05,
        max_depth=7,
        num_leaves=31,
        random_state=seed,
        feature_names=FEATURE_NAMES,
    )
    importances = lgb_classifier.fit(X_train, y_train_flat, X_val, y_val_flat)
    lgb_time = time.time() - lgb_started
    logger.info("LightGBM trained in %.1fs", lgb_time)

    val_prob = lgb_classifier.predict_spatial(val_features, threshold=0.5)[0]
    lgb_threshold = select_probability_threshold(
        val_prob, labels[val_ids[0]], prepared[val_ids[0]]["valid"].astype(bool)
    )["selected"]["threshold"]
    logger.info("LightGBM probability threshold selected on VAL: %.2f", lgb_threshold)

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
        predictions[event_id]["lightgbm"] = mask.astype(np.uint8) & prepared[event_id]["valid"].astype(np.uint8)

    # ---------------- U-Net ----------------
    unet_result: Optional[Dict[str, Any]] = None
    unet_model: Optional[UNetResNet34] = None
    unet_threshold = 0.5
    if not skip_unet:
        logger.info("Training U-Net ResNet-34 on real TRAIN patches (CPU unless CUDA is present)")
        train_npz = np.load(DATASET_ROOT / "train.npz")
        val_npz = np.load(DATASET_ROOT / "val.npz")
        train_ds = SARPatchDataset(
            patches=list(train_npz["patches"]),
            masks=list(train_npz["labels"].astype(np.float32)),
            is_train=True,
            norm_mean=means,
            norm_std=stds,
            event_ids=[str(value) for value in train_npz["events"]],
        )
        val_ds = SARPatchDataset(
            patches=list(val_npz["patches"]),
            masks=list(val_npz["labels"].astype(np.float32)),
            is_train=False,
            norm_mean=means,
            norm_std=stds,
            event_ids=[str(value) for value in val_npz["events"]],
        )
        torch.manual_seed(seed)
        np.random.seed(seed)
        unet_model, training = train_unet_model(
            train_dataset=train_ds,
            val_dataset=val_ds,
            checkpoint_dir=CHECKPOINT_DIR,
            num_epochs=epochs,
            batch_size=8,
            learning_rate=3e-4,
            device=None,
            seed=seed,
            in_channels=5,
            checkpoint_name="real_unet_resnet34_best.pt",
        )
        unet_result = {
            "best_epoch": training.best_epoch,
            "best_val_iou": training.best_val_iou,
            "best_val_dice": training.best_val_dice,
            "train_losses": training.train_losses,
            "val_losses": training.val_losses,
            "val_ious": training.val_ious,
            "training_time_sec": training.total_training_time_sec,
            "checkpoint_path": training.checkpoint_path,
            "checkpoint_note": "Separate from models/checkpoints/unet_resnet34_best.pt (synthetic).",
        }

        logger.info("Selecting U-Net probability threshold on VAL full scene")
        val_prob_unet = predict_unet_scene(
            unet_model, stacks[val_ids[0]], means, stds, tile=128, stride=64
        )
        unet_threshold = select_probability_threshold(
            val_prob_unet, labels[val_ids[0]], prepared[val_ids[0]]["valid"].astype(bool)
        )["selected"]["threshold"]
        logger.info("U-Net probability threshold selected on VAL: %.2f", unet_threshold)
        unet_result["selected_probability_threshold"] = unet_threshold

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

    # ---------------- CUSUM ----------------
    logger.info("Running CUSUM on four real Sentinel-1 dates per event")
    temporal: Dict[str, Dict[str, Any]] = {}
    for event_id in eval_ids:
        stack_t, dates = temporal_stack_db(prepared[event_id])
        temporal[event_id] = {"stack": stack_t, "dates": dates}

    cusum_scores: Dict[str, List[Dict[str, Any]]] = {}
    for h_value in (2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0):
        _, mask = run_cusum(temporal[val_ids[0]]["stack"], prepared[val_ids[0]]["valid"].astype(bool), h_value)
        score_dict = metrics_dict(
            mask, labels[val_ids[0]], prepared[val_ids[0]]["valid"].astype(bool)
        )
        cusum_scores.setdefault(val_ids[0], []).append({"h": h_value, "f1": score_dict["f1_score"]})
    best_h = max(cusum_scores[val_ids[0]], key=lambda item: (item["f1"], -item["h"]))["h"]
    logger.info("CUSUM h selected on VAL: %.2f", best_h)

    cusum_meta: Dict[str, Any] = {"selected_h": best_h, "k_allowance": 0.5, "val_scan": cusum_scores}
    for event_id in eval_ids:
        score, mask = run_cusum(
            temporal[event_id]["stack"], prepared[event_id]["valid"].astype(bool), best_h
        )
        predictions[event_id]["cusum_score"] = score
        predictions[event_id]["cusum"] = mask
        cusum_meta[event_id] = {"dates": temporal[event_id]["dates"], "baseline": "first acquisition only"}

    # ---------------- Reference / trivial layers ----------------
    for event_id in eval_ids:
        data = prepared[event_id]
        valid = data["valid"].astype(bool)
        predictions[event_id]["optical_reference"] = labels[event_id]
        predictions[event_id]["all_burned"] = valid.astype(np.uint8)

    # ---------------- Evaluation ----------------
    model_predictions = [
        ("Log_Ratio_Baseline", "log_ratio", "VH log-ratio threshold calibrated on TRAIN"),
        ("LightGBM_Pixel_Spatial", "lightgbm", "LightGBM on 10 Sentinel-1 dB/change features"),
        ("UNet_ResNet34", "unet", "U-Net ResNet-34 on paired Sentinel-1 patches"),
        ("CUSUM_Temporal", "cusum", "CUSUM on four Sentinel-1 VH acquisitions"),
        ("All_Burned_Trivial", "all_burned", "Predict every valid pixel burned"),
    ]
    if skip_unet:
        model_predictions = [row for row in model_predictions if row[0] != "UNet_ResNet34"]

    models: Dict[str, Any] = {}
    for name, key, description in model_predictions:
        entry: Dict[str, Any] = {
            "description": description,
            "role": "baseline" if key in {"log_ratio", "all_burned"} else "candidate",
            "independent_of_label": key != "optical_reference",
            "metrics": {},
        }
        for event_id in eval_ids:
            split = split_of[event_id]
            valid = prepared[event_id]["valid"].astype(bool)
            prediction = predictions[event_id][key]
            f1_ci = block_bootstrap_f1(prediction, labels[event_id], valid)
            entry["metrics"][split] = metrics_dict(prediction, labels[event_id], valid, f1_ci)
            entry["metrics"][split]["event_id"] = event_id
            if split == "TRAIN":
                entry["metrics"][split]["note"] = "resubstitution; not a generalisation estimate"
        models[name] = entry

    # dNBR reference layer is the label definition itself, so its dNBR-label score is 1.0
    # by construction. Report it separately, with MCD64A1 as the independent check.
    reference: Dict[str, Any] = {
        "description": "Sentinel-2 dNBR threshold; defines the reference labels, not an independent model",
        "independent_of_label": False,
        "threshold_dnbr": threshold_dnbr,
        "metrics": {},
    }
    for event_id in eval_ids:
        split = split_of[event_id]
        data = prepared[event_id]
        valid = data["valid"].astype(bool)
        mcd = data["mcd"].astype(bool) & valid
        reference["metrics"][split] = {
            "event_id": event_id,
            "dnbr_vs_mcd64a1": metrics_dict(labels[event_id], mcd, valid),
            "label_fraction_valid": float(labels[event_id][valid].mean()),
            "mcd_fraction_valid": float(mcd[valid].mean()),
        }

    # ---------------- Save maps and figure ----------------
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    MAP_ROOT.mkdir(parents=True, exist_ok=True)
    for event_id in eval_ids:
        np.savez_compressed(
            MAP_ROOT / f"{event_id}.npz",
            label=labels[event_id],
            valid=prepared[event_id]["valid"].astype(np.uint8),
            mcd=prepared[event_id]["mcd"].astype(np.uint8),
            **predictions[event_id],
        )

    test_event = test_ids[0]
    _make_figure(test_event, stacks[test_event], labels[test_event], prepared[test_event]["valid"].astype(bool), predictions[test_event])

    # ---------------- Report ----------------
    report: Dict[str, Any] = {
        "created_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "script": "scripts/run_real_pipeline.py",
        "data_origin": "CROSS_SENSOR_PROTOTYPE",
        "is_nisar": False,
        "nisar_status": {
            "available": False,
            "reason": (
                "NISAR GCOV science products require Earthdata Login. No EARTHDATA_USERNAME/"
                "EARTHDATA_PASSWORD, .netrc entry, or Earthdata token was present in the execution "
                "environment, so no NISAR scene was downloaded or used."
            ),
        },
        "sensor_input": "Sentinel-1 RTC C-band (VV/VH), 20 m, Microsoft Planetary Computer",
        "reference_labels": {
            "definition": "Sentinel-2 L2A dNBR >= threshold over SCL-valid and Sentinel-1-valid pixels",
            "threshold": threshold_dnbr,
            "threshold_calibration": manifest["label_calibration"],
            "independent_check": "MCD64A1 burned area (500 m, coarse; not used to fit any model)",
        },
        "splits": {"TRAIN": train_ids, "VAL": val_ids, "TEST": test_ids},
        "sample_cap": {"max": 10000, "generated": int(manifest["total_samples"])},
        "patch_dataset": {
            "patch_size": manifest["patch_size"],
            "stride": manifest["stride"],
            "samples": manifest["samples"],
            "normalization_fitted_on": "TRAIN",
        },
        "training": {
            "seed": seed,
            "lightgbm": {
                "training_time_sec": round(lgb_time, 2),
                "training_pixels": int(len(y_train_flat)),
                "validation_pixels": int(len(y_val_flat)),
                "selected_probability_threshold": lgb_threshold,
                "top_features": sorted(importances.items(), key=lambda item: item[1], reverse=True)[:6],
            },
            "unet": unet_result,
            "cusum": cusum_meta,
            "log_ratio": {
                "threshold_db": baseline_threshold,
                "calibration": baseline_cal,
                "calibrated_on": train_ids,
            },
        },
        "models": models,
        "reference_label_layer": reference,
        "caveats": [
            "Every model uses Sentinel-1 C-band input and Sentinel-2-derived labels; this is a cross-sensor prototype, not a NISAR result.",
            "Only three events contribute to experiments (one TRAIN, one VAL, one TEST), so generalisation estimates have very high variance.",
            "The TEST event (Bug Fire) has a much larger burned fraction than TRAIN (Gann Fire); class prior shift is severe.",
            "MCD64A1 and the dNBR reference disagree substantially for the TEST event; burned-area labels are uncertain, not ground truth.",
            "Sentinel-1 valid-data fraction for the TEST event is about 0.73 because of the swath edge, which further limits the test domain.",
            "CUSUM is unsupervised and uses only the first acquisition as its baseline; it is not directly comparable to supervised segmentation.",
            "Pixel metrics are spatially autocorrelated; blocked-bootstrap intervals are reported but still reflect only one test event.",
        ],
        "environment": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "torch": torch.__version__,
            "cuda_available": bool(torch.cuda.is_available()),
            "platform": platform.platform(),
        },
        "elapsed_sec": round(time.time() - started, 2),
    }

    report_path = OUTPUT_ROOT / "real_model_comparison.json"
    with open(report_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
    logger.info("Wrote %s", report_path)
    return report


def _make_figure(
    event_id: str,
    stack_db: np.ndarray,
    label: np.ndarray,
    valid: np.ndarray,
    predictions: Dict[str, np.ndarray],
) -> None:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        panels = [
            ("Sentinel-2 dNBR label", label, "Greys"),
            ("VH log-ratio (dB)", np.clip(stack_db[4], -6, 6), "RdBu"),
            ("Log-ratio baseline", predictions["log_ratio"], "Greys"),
            ("LightGBM", predictions["lightgbm"], "Greys"),
        ]
        if "unet" in predictions:
            panels.append(("U-Net ResNet-34", predictions["unet"], "Greys"))
        panels.append(("CUSUM", predictions["cusum"], "Greys"))
        columns = 3
        rows = int(np.ceil(len(panels) / columns))
        fig, axes = plt.subplots(rows, columns, figsize=(13, 4.4 * rows))
        for ax in np.atleast_1d(axes).ravel():
            ax.axis("off")
        for ax, (title, array, cmap) in zip(np.atleast_1d(axes).ravel(), panels):
            ax.imshow(array, cmap=cmap)
            ax.set_title(title, fontsize=10)
            ax.axis("off")
        fig.suptitle(f"Held-out TEST event: {event_id} (Sentinel-1 input, Sentinel-2 labels)", fontsize=11)
        fig.tight_layout()
        fig.savefig(OUTPUT_ROOT / "real_test_maps.png", dpi=130)
        plt.close(fig)
    except Exception as exc:  # pragma: no cover - figure is optional
        logger.warning("Could not draw QA figure: %s", exc)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epochs", type=int, default=8, help="U-Net epochs")
    parser.add_argument("--skip-unet", action="store_true", help="Run only non-deep-learning analyses")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    report = run(epochs=args.epochs, skip_unet=args.skip_unet, seed=args.seed)
    summary = {
        name: {split: values["metrics"][split]["f1_score"] for split in values["metrics"]}
        for name, values in report["models"].items()
    }
    print(json.dumps({"models_f1": summary, "test_event": report["splits"]["TEST"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
