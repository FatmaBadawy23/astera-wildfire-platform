"""CUSUM (Cumulative Sum) Statistical Change Detector for Multi-Temporal SAR Time-Series."""

from __future__ import annotations

from typing import List, Tuple
import numpy as np


class CUSUMDetector:
    """Detects persistent surface changes and recovery across multi-temporal SAR acquisitions."""

    def __init__(self, k_allowance: float = 0.5, h_decision: float = 4.0):
        """
        Args:
            k_allowance: Reference value / slack parameter in standard deviations (typically 0.5).
            h_decision: Decision interval / threshold in standard deviations (typically 4.0 or 5.0).
        """
        self.k = k_allowance
        self.h = h_decision

    def detect_downward_change(
        self,
        time_series_db: List[np.ndarray],
        baseline_indices: Tuple[int, int] = (0, 2),
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Detects negative shift (drop in backscatter indicative of vegetation loss).

        Args:
            time_series_db: List of 2D backscatter arrays in decibels ordered chronologically.
            baseline_indices: (start_idx, end_idx) used to estimate pre-fire baseline mean & std.

        Returns:
            (cumulative_sum_score, change_detected_mask)
        """
        if len(time_series_db) < 3:
            raise ValueError("CUSUM requires at least 3 temporal acquisitions.")

        # Compute pre-fire baseline statistics
        baseline_stack = np.stack(time_series_db[baseline_indices[0] : baseline_indices[1]], axis=0)
        mu_0 = np.mean(baseline_stack, axis=0)
        sigma_0 = np.maximum(np.std(baseline_stack, axis=0), 0.5)

        h_shape = time_series_db[0].shape
        s_low = np.zeros(h_shape, dtype=np.float32)
        change_detected = np.zeros(h_shape, dtype=np.bool_)

        # Iteratively accumulate standardized negative deviations
        for t in range(baseline_indices[1], len(time_series_db)):
            x_t = time_series_db[t]
            # Standardized deviation
            z_t = (x_t - mu_0) / sigma_0
            # S_low accumulates downward shifts (z_t < 0)
            s_low = np.maximum(0.0, s_low - z_t - self.k)
            change_detected = change_detected | (s_low >= self.h)

        return s_low, change_detected.astype(np.uint8)
