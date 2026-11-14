"""Sentinel-2 optical indices and reference-label helpers.

These functions produce an *independent optical reference* for the SAR experiments and
are also used to cross-check the MCD64A1 labels. They are not ground truth.
"""

from __future__ import annotations

from typing import Dict, Iterable, Tuple

import numpy as np

# Sentinel-2 L2A Scene Classification Layer classes considered usable for dNBR.
# SCL_LAND_VALID_CLASSES excludes SCL == 6 (Water) so open water is never included in valid burn masks.
SCL_LAND_VALID_CLASSES = (4, 5, 7)  # vegetation, bare/not-vegetated, unclassified
SCL_VALID_CLASSES = (4, 5, 6, 7)  # legacy superset (includes water=6)
SCL_WATER_CLASS = 6
SCL_INVALID_CLASSES = (0, 1, 2, 3, 8, 9, 10, 11)  # no-data, saturated, shadow, cloud, snow


def _safe_ratio(numerator: np.ndarray, denominator: np.ndarray) -> np.ndarray:
    out = np.full(numerator.shape, np.nan, dtype=np.float32)
    ok = np.isfinite(numerator) & np.isfinite(denominator) & (np.abs(denominator) > 1e-6)
    out[ok] = numerator[ok] / denominator[ok]
    return out


def compute_nbr(nir: np.ndarray, swir2: np.ndarray) -> np.ndarray:
    """Normalized Burn Ratio from surface reflectance scaled to [0, 1]."""
    return _safe_ratio(nir.astype(np.float32) - swir2.astype(np.float32), nir.astype(np.float32) + swir2.astype(np.float32))


def compute_dnbr(nbr_pre: np.ndarray, nbr_post: np.ndarray) -> np.ndarray:
    return nbr_pre.astype(np.float32) - nbr_post.astype(np.float32)


def water_optical_mask(scl_pre: np.ndarray, scl_post: np.ndarray) -> np.ndarray:
    """Boolean mask of pixels classified as water (SCL == 6) in either pre or post scene."""
    return (scl_pre == SCL_WATER_CLASS) | (scl_post == SCL_WATER_CLASS)


def valid_optical_mask(
    scl_pre: np.ndarray,
    scl_post: np.ndarray,
    reflectance_pre: np.ndarray,
    reflectance_post: np.ndarray,
    exclude_water: bool = True,
) -> np.ndarray:
    """Boolean mask of land pixels usable in both optical acquisitions."""
    allowed_classes = SCL_LAND_VALID_CLASSES if exclude_water else SCL_VALID_CLASSES
    pre = np.isin(scl_pre, allowed_classes) & np.isfinite(reflectance_pre) & (reflectance_pre > 0)
    post = np.isin(scl_post, allowed_classes) & np.isfinite(reflectance_post) & (reflectance_post > 0)
    return pre & post


def burn_mask_from_dnbr(dnbr: np.ndarray, valid: np.ndarray, threshold: float) -> np.ndarray:
    return ((dnbr >= threshold) & valid).astype(np.uint8)


def calibrate_dnbr_threshold(
    dnbr: np.ndarray,
    reference_burn: np.ndarray,
    valid: np.ndarray,
    thresholds: Iterable[float] = tuple(np.round(np.arange(0.02, 0.401, 0.01), 2)),
) -> Dict[str, object]:
    """Choose a dNBR threshold on the training event only.

    The reference is MCD64A1 burned area. Optimising this threshold on the training
    events is legitimate; applying it to validation/test without refitting is required.
    """
    ref = (reference_burn > 0) & valid
    best = {"threshold": 0.27, "f1": -1.0, "precision": 0.0, "recall": 0.0}
    curve = []
    for threshold in thresholds:
        pred = (dnbr >= threshold) & valid
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


def optical_agreement(
    dnbr_burn: np.ndarray,
    reference_burn: np.ndarray,
    valid: np.ndarray,
) -> Dict[str, float]:
    """Compare an optical dNBR mask with MCD64A1 over the valid domain."""
    ref = (reference_burn > 0) & valid
    pred = (dnbr_burn > 0) & valid
    tp = int(np.count_nonzero(pred & ref))
    fp = int(np.count_nonzero(pred & ~ref))
    fn = int(np.count_nonzero(~pred & ref))
    tn = int(np.count_nonzero(~pred & ~ref))
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    iou = tp / (tp + fp + fn) if (tp + fp + fn) else 0.0
    return {
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "true_negatives": tn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "iou": iou,
    }
