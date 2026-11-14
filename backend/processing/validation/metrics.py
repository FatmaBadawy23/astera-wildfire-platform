"""Comprehensive scientific evaluation metrics for wildfire burned area segmentation.

Calculates pixel-level confusion matrix, Precision, Recall, F1, IoU, Dice,
Specificity, and geographic burned area estimates in hectares and km^2.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional, Tuple
import numpy as np


@dataclass
class EvaluationMetrics:
    """Standardized scientific evaluation results for burned-area segmentation."""
    true_positives: int
    false_positives: int
    false_negatives: int
    true_negatives: int
    total_pixels: int
    prevalence: float
    precision: float
    recall: float
    f1_score: float
    iou: float
    dice: float
    specificity: float
    false_positive_rate: float
    false_negative_rate: float
    predicted_area_km2: float
    reference_area_km2: float
    area_error_percent: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def calculate_segmentation_metrics(
    y_pred: np.ndarray,
    y_true: np.ndarray,
    valid_mask: Optional[np.ndarray] = None,
    pixel_area_m2: float = 400.0,  # 20m x 20m default = 400 m^2
) -> EvaluationMetrics:
    """Calculates all scientific segmentation metrics against ground truth reference labels.

    Args:
        y_pred: Binary predicted mask (0 or 1).
        y_true: Binary reference ground truth mask (0 or 1).
        valid_mask: Optional boolean or uint8 mask (1 = valid, 0 = ignore/cloud/nodata).
        pixel_area_m2: Area of a single pixel in square meters.
    """
    y_pred_bin = (y_pred > 0).astype(np.bool_)
    y_true_bin = (y_true > 0).astype(np.bool_)

    if valid_mask is not None:
        valid = (valid_mask > 0).astype(np.bool_)
        y_pred_bin = y_pred_bin[valid]
        y_true_bin = y_true_bin[valid]
    else:
        y_pred_bin = y_pred_bin.ravel()
        y_true_bin = y_true_bin.ravel()

    tp = int(np.count_nonzero(y_pred_bin & y_true_bin))
    fp = int(np.count_nonzero(y_pred_bin & ~y_true_bin))
    fn = int(np.count_nonzero(~y_pred_bin & y_true_bin))
    tn = int(np.count_nonzero(~y_pred_bin & ~y_true_bin))

    total = tp + fp + fn + tn
    prevalence = float((tp + fn) / max(total, 1))

    precision = float(tp / max(tp + fp, 1e-7))
    recall = float(tp / max(tp + fn, 1e-7))
    f1 = float(2.0 * tp / max(2 * tp + fp + fn, 1e-7))
    iou = float(tp / max(tp + fp + fn, 1e-7))
    dice = f1  # Dice is mathematically identical to F1 for binary masks
    specificity = float(tn / max(tn + fp, 1e-7))
    fpr = float(fp / max(fp + tn, 1e-7))
    fnr = float(fn / max(fn + tp, 1e-7))

    # Geographic area calculation in km^2
    pred_km2 = float(np.count_nonzero(y_pred_bin) * pixel_area_m2 / 1e6)
    ref_km2 = float(np.count_nonzero(y_true_bin) * pixel_area_m2 / 1e6)
    area_error_pct = float(100.0 * (pred_km2 - ref_km2) / max(ref_km2, 1e-4))

    return EvaluationMetrics(
        true_positives=tp,
        false_positives=fp,
        false_negatives=fn,
        true_negatives=tn,
        total_pixels=total,
        prevalence=round(prevalence, 4),
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1_score=round(f1, 4),
        iou=round(iou, 4),
        dice=round(dice, 4),
        specificity=round(specificity, 4),
        false_positive_rate=round(fpr, 4),
        false_negative_rate=round(fnr, 4),
        predicted_area_km2=round(pred_km2, 3),
        reference_area_km2=round(ref_km2, 3),
        area_error_percent=round(area_error_pct, 2),
    )


def calculate_probability_auc_metrics(
    y_score: np.ndarray,
    y_true: np.ndarray,
    valid_mask: Optional[np.ndarray] = None,
) -> Dict[str, Optional[float]]:
    """Calculate threshold-independent ROC-AUC and PR-AUC (Average Precision) on valid pixels."""
    from sklearn.metrics import average_precision_score, roc_auc_score

    score = np.asarray(y_score, dtype=np.float32)
    true_bin = (np.asarray(y_true) > 0).astype(np.uint8)

    if valid_mask is not None:
        valid = (np.asarray(valid_mask) > 0) & np.isfinite(score)
    else:
        valid = np.isfinite(score)

    s_val = score[valid]
    t_val = true_bin[valid]

    if s_val.size == 0 or len(np.unique(t_val)) < 2:
        return {"roc_auc": None, "pr_auc": None}

    roc_auc = float(roc_auc_score(t_val, s_val))
    pr_auc = float(average_precision_score(t_val, s_val))
    return {
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
    }


def calculate_coarse_block_reconciliation_metrics(
    y_pred_20m: np.ndarray,
    y_ref_coarse_20m: np.ndarray,
    valid_mask_20m: Optional[np.ndarray] = None,
    block_size_px: int = 25,  # 25 x 20m = 500m MODIS MCD64A1 native resolution
    min_valid_fraction: float = 0.5,
    block_burn_threshold: float = 0.5,
) -> Dict[str, Any]:
    """Reconcile 20 m SAR predictions with 500 m coarse reference (MCD64A1) on native 500 m blocks.

    Aggregates 20 m binary masks into 25x25 pixel (500 m x 500 m) cells, computing both:
    - Fractional burn agreement (Pearson r, MAE, RMSE across valid 500 m cells)
    - Binary 500 m cell classification metrics (F1, IoU, Precision, Recall, Specificity)
    """
    h, w = y_pred_20m.shape
    pred_bin = (np.asarray(y_pred_20m) > 0).astype(np.float32)
    ref_bin = (np.asarray(y_ref_coarse_20m) > 0).astype(np.float32)
    valid_bin = (
        (np.asarray(valid_mask_20m) > 0).astype(np.float32)
        if valid_mask_20m is not None
        else np.ones_like(pred_bin, dtype=np.float32)
    )

    pred_fracs = []
    ref_fracs = []
    for r in range(0, h - block_size_px + 1, block_size_px):
        for c in range(0, w - block_size_px + 1, block_size_px):
            v_blk = valid_bin[r : r + block_size_px, c : c + block_size_px]
            v_cnt = float(np.sum(v_blk))
            if v_cnt < (block_size_px * block_size_px * min_valid_fraction):
                continue
            p_blk = pred_bin[r : r + block_size_px, c : c + block_size_px]
            t_blk = ref_bin[r : r + block_size_px, c : c + block_size_px]
            pred_fracs.append(float(np.sum(p_blk * v_blk) / v_cnt))
            ref_fracs.append(float(np.sum(t_blk * v_blk) / v_cnt))

    if not pred_fracs:
        return {"valid_500m_blocks": 0}

    p_arr = np.asarray(pred_fracs, dtype=np.float64)
    r_arr = np.asarray(ref_fracs, dtype=np.float64)
    diff = p_arr - r_arr
    mae = float(np.mean(np.abs(diff)))
    rmse = float(np.sqrt(np.mean(diff * diff)))
    if np.std(p_arr) > 1e-8 and np.std(r_arr) > 1e-8:
        pearson_r = float(np.corrcoef(p_arr, r_arr)[0, 1])
    else:
        pearson_r = 0.0

    p_cell = (p_arr >= block_burn_threshold).astype(np.uint8)
    r_cell = (r_arr >= block_burn_threshold).astype(np.uint8)
    block_seg = calculate_segmentation_metrics(
        p_cell,
        r_cell,
        valid_mask=np.ones_like(p_cell, dtype=np.uint8),
        pixel_area_m2=float((block_size_px * 20.0) ** 2),  # 250,000 m^2 = 0.25 km^2 per 500m block
    ).to_dict()

    return {
        "block_resolution_m": int(block_size_px * 20),
        "block_size_px": block_size_px,
        "valid_500m_blocks": len(pred_fracs),
        "fractional_burn_mae": round(mae, 4),
        "fractional_burn_rmse": round(rmse, 4),
        "fractional_burn_pearson_r": round(pearson_r, 4),
        "block_classification_metrics": block_seg,
    }
