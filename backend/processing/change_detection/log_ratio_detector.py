"""Classical Log-ratio change detector for SAR wildfire monitoring."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple
import numpy as np

from backend.processing.preprocessing.log_ratio import compute_log_ratio


@dataclass
class LogRatioDetectorResult:
    """Output from log-ratio change detection."""
    change_map_db: np.ndarray  # Continuous dB difference
    binary_mask: np.ndarray  # 1 = candidate burned area, 0 = unburned
    confidence_map: np.ndarray  # Heuristic confidence proxy [0, 1]
    selected_threshold_db: float
    threshold_method: str
    metadata: Dict[str, Any]


class LogRatioDetector:
    """Analytical baseline detector using dual-pol backscatter log-ratio."""

    def __init__(
        self,
        method: str = "adaptive",
        k_sigma: float = 2.0,
        fixed_threshold_db: float = -3.5,
        polarization: str = "HV",
    ):
        """
        Args:
            method: 'adaptive' (mean - k*std), 'otsu', or 'fixed'
            k_sigma: Factor for adaptive threshold (tau = mean - k*sigma)
            fixed_threshold_db: User-specified threshold in dB (e.g. -3.5 dB)
            polarization: Which polarization to base detection on ('HV', 'HH', or 'DUAL')
        """
        self.method = method
        self.k_sigma = k_sigma
        self.fixed_threshold_db = fixed_threshold_db
        self.polarization = polarization

    def detect(
        self,
        pre_hv_power: np.ndarray,
        post_hv_power: np.ndarray,
        pre_hh_power: Optional[np.ndarray] = None,
        post_hh_power: Optional[np.ndarray] = None,
        valid_mask: Optional[np.ndarray] = None,
    ) -> LogRatioDetectorResult:
        """Runs the analytical change detector."""
        delta_hv_db = compute_log_ratio(pre_hv_power, post_hv_power)

        if valid_mask is not None:
            active_pixels = delta_hv_db[valid_mask > 0]
        else:
            active_pixels = delta_hv_db.ravel()

        active_finite = active_pixels[np.isfinite(active_pixels)]

        # Determine threshold
        if self.method == "fixed":
            thresh = float(self.fixed_threshold_db)
        elif self.method == "adaptive":
            mean_val = float(np.mean(active_finite)) if len(active_finite) > 0 else 0.0
            std_val = float(np.std(active_finite)) if len(active_finite) > 0 else 1.5
            # Wildfires cause severe backscatter drops (negative tail)
            thresh = float(mean_val - self.k_sigma * std_val)
            # Enforce physical sanity bound: threshold cannot be positive
            thresh = min(thresh, -1.5)
        elif self.method == "otsu":
            # Otsu on inverted negative tail
            neg_tail = np.clip(-active_finite, 0.0, 15.0)
            hist, bin_edges = np.histogram(neg_tail, bins=100, range=(0.0, 15.0))
            prob = hist / max(hist.sum(), 1)
            omega = np.cumsum(prob)
            mu = np.cumsum(prob * np.arange(len(prob)))
            mu_t = mu[-1]

            sigma_b_sq = (mu_t * omega - mu) ** 2 / (omega * (1.0 - omega) + 1e-7)
            best_idx = int(np.argmax(sigma_b_sq))
            thresh_pos = 0.5 * (bin_edges[best_idx] + bin_edges[best_idx + 1])
            thresh = -float(thresh_pos)
        else:
            raise ValueError(f"Unknown threshold method: {self.method}")

        # Primary candidate mask (cross-pol drop)
        binary_mask = (delta_hv_db <= thresh).astype(np.uint8)

        # Dual-polarization agreement: require co-pol HH to also show decrease if provided
        if self.polarization == "DUAL" and pre_hh_power is not None and post_hh_power is not None:
            delta_hh_db = compute_log_ratio(pre_hh_power, post_hh_power)
            hh_mask = (delta_hh_db <= -1.0).astype(np.uint8)
            binary_mask = binary_mask & hh_mask

        # Apply validity mask if present
        if valid_mask is not None:
            binary_mask = binary_mask * (valid_mask > 0).astype(np.uint8)

        # Confidence proxy: linear scaling between threshold and severe drop (-8 dB)
        drop_magnitude = np.clip(-delta_hv_db, 0.0, 10.0)
        confidence = np.clip(drop_magnitude / 6.0, 0.0, 1.0).astype(np.float32)

        return LogRatioDetectorResult(
            change_map_db=delta_hv_db,
            binary_mask=binary_mask,
            confidence_map=confidence,
            selected_threshold_db=round(thresh, 2),
            threshold_method=self.method,
            metadata={
                "polarization": self.polarization,
                "burn_candidate_pixels": int(np.count_nonzero(binary_mask)),
                "total_valid_pixels": int(len(active_finite)),
            },
        )
