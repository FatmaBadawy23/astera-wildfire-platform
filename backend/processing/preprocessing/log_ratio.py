"""SAR Log-ratio change computation and feature stack construction."""

from __future__ import annotations

from typing import Dict, Tuple
import numpy as np

from backend.processing.preprocessing.filters import lee_filter
from backend.processing.preprocessing.radiometry import linear_to_db


def compute_log_ratio(
    pre_power: np.ndarray,
    post_power: np.ndarray,
    epsilon: float = 1e-7,
) -> np.ndarray:
    """Computes backscatter change in decibels (log-ratio).

    Delta_dB = 10 * log10((post + eps) / (pre + eps)) = post_dB - pre_dB
    Negative values indicate a decrease in radar backscatter (typical of burned vegetation).
    """
    pre_db = linear_to_db(pre_power, epsilon=epsilon)
    post_db = linear_to_db(post_power, epsilon=epsilon)
    return (post_db - pre_db).astype(np.float32)


def compute_normalized_difference(
    pre_power: np.ndarray,
    post_power: np.ndarray,
    epsilon: float = 1e-7,
) -> np.ndarray:
    """Normalized Difference SAR Index: (post - pre) / (post + pre + epsilon). Range [-1, 1]."""
    diff = post_power - pre_power
    total = post_power + pre_power + epsilon
    return (diff / total).astype(np.float32)


def extract_polarimetric_stack(
    hh_pre: np.ndarray,
    hv_pre: np.ndarray,
    hh_post: np.ndarray,
    hv_post: np.ndarray,
    filter_speckle: bool = True,
    num_looks: float = 4.0,
) -> Dict[str, np.ndarray]:
    """Builds a standardized 6-feature polarimetric SAR stack.

    Features:
    1. hh_pre_db
    2. hv_pre_db
    3. hh_post_db
    4. hv_post_db
    5. log_ratio_hh (dB change in co-pol)
    6. log_ratio_hv (dB change in cross-pol - primary wildfire signature)
    7. nd_sar_hv (normalized difference in cross-pol)
    """
    if filter_speckle:
        hh_pre_p = lee_filter(hh_pre, window_size=5, num_looks=num_looks)
        hv_pre_p = lee_filter(hv_pre, window_size=5, num_looks=num_looks)
        hh_post_p = lee_filter(hh_post, window_size=5, num_looks=num_looks)
        hv_post_p = lee_filter(hv_post, window_size=5, num_looks=num_looks)
    else:
        hh_pre_p = np.maximum(hh_pre, 1e-7)
        hv_pre_p = np.maximum(hv_pre, 1e-7)
        hh_post_p = np.maximum(hh_post, 1e-7)
        hv_post_p = np.maximum(hv_post, 1e-7)

    hh_pre_db = linear_to_db(hh_pre_p)
    hv_pre_db = linear_to_db(hv_pre_p)
    hh_post_db = linear_to_db(hh_post_p)
    hv_post_db = linear_to_db(hv_post_p)

    log_ratio_hh = hh_post_db - hh_pre_db
    log_ratio_hv = hv_post_db - hv_pre_db
    nd_sar_hv = compute_normalized_difference(hv_pre_p, hv_post_p)

    return {
        "hh_pre_db": hh_pre_db,
        "hv_pre_db": hv_pre_db,
        "hh_post_db": hh_post_db,
        "hv_post_db": hv_post_db,
        "log_ratio_hh": log_ratio_hh,
        "log_ratio_hv": log_ratio_hv,
        "nd_sar_hv": nd_sar_hv,
    }
