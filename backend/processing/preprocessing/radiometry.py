"""Radiometric processing functions for SAR data.

Handles linear power to decibels (dB), RTC gamma-to-sigma corrections,
and train-split-only feature normalization to prevent leakage.
"""

from __future__ import annotations

from typing import Dict, Optional, Tuple
import numpy as np


def linear_to_db(power: np.ndarray, epsilon: float = 1e-7) -> np.ndarray:
    """Converts linear radar backscatter power to decibels (dB).

    dB = 10 * log10(power + epsilon)
    Safely handles non-positive, zero, and NaN values.
    """
    safe_power = np.maximum(power, epsilon)
    return (10.0 * np.log10(safe_power)).astype(np.float32)


def db_to_linear(db: np.ndarray) -> np.ndarray:
    """Converts backscatter from decibels to linear power."""
    return (10.0 ** (db / 10.0)).astype(np.float32)


def apply_rtc_gamma_to_sigma(gamma0: np.ndarray, rtc_factor: np.ndarray) -> np.ndarray:
    """Converts terrain-corrected gamma-nought backscatter to sigma-nought.

    sigma0 = gamma0 * rtc_factor
    """
    return (gamma0 * rtc_factor).astype(np.float32)


def fit_scaler(data: np.ndarray, method: str = "robust") -> Dict[str, float]:
    """Computes normalization statistics strictly on the TRAINING split.

    Supports:
    - 'robust': median and interquartile range (IQR = Q75 - Q25)
    - 'standard': mean and standard deviation
    - 'minmax': 2nd and 98th percentiles
    """
    valid_data = data[np.isfinite(data)]
    if len(valid_data) == 0:
        return {"center": 0.0, "scale": 1.0}

    if method == "robust":
        q25 = float(np.percentile(valid_data, 25))
        q75 = float(np.percentile(valid_data, 75))
        median = float(np.median(valid_data))
        iqr = max(q75 - q25, 1e-4)
        return {"center": median, "scale": iqr, "method": "robust"}
    elif method == "standard":
        mean = float(np.mean(valid_data))
        std = max(float(np.std(valid_data)), 1e-4)
        return {"center": mean, "scale": std, "method": "standard"}
    elif method == "minmax":
        p2 = float(np.percentile(valid_data, 2))
        p98 = float(np.percentile(valid_data, 98))
        diff = max(p98 - p2, 1e-4)
        return {"center": p2, "scale": diff, "method": "minmax"}
    else:
        raise ValueError(f"Unknown scaling method: {method}")


def apply_scaler(data: np.ndarray, stats: Dict[str, float]) -> np.ndarray:
    """Applies pre-computed training statistics to any dataset split."""
    center = stats["center"]
    scale = stats["scale"]
    normed = (data - center) / scale
    if stats.get("method") == "minmax":
        normed = np.clip(normed, 0.0, 1.0)
    return normed.astype(np.float32)
