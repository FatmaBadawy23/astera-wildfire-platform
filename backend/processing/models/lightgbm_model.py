"""LightGBM Classical Machine Learning Baseline for SAR Burned-Area Classification."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
import lightgbm as lgb
import numpy as np
from scipy.ndimage import uniform_filter

from backend.processing.preprocessing.radiometry import linear_to_db

logger = logging.getLogger(__name__)


@dataclass
class LightGBMResult:
    probability_map: np.ndarray  # 2D array of burn probabilities [0, 1]
    binary_mask: np.ndarray  # Thresholded binary mask (default > 0.5)
    feature_importances: Dict[str, float]
    metrics: Dict[str, float]


FEATURE_NAMES = [
    "hh_pre_db",
    "hv_pre_db",
    "hh_post_db",
    "hv_post_db",
    "log_ratio_hh",
    "log_ratio_hv",
    "ratio_diff",
    "local_mean_ratio_hv",
    "local_std_ratio_hv",
    "nd_sar_hv",
]


def extract_features(
    hh_pre_p: np.ndarray,
    hv_pre_p: np.ndarray,
    hh_post_p: np.ndarray,
    hv_post_p: np.ndarray,
) -> np.ndarray:
    """Extracts a (height, width, 10) feature tensor from multi-channel SAR backscatter."""
    hh_pre_db = linear_to_db(hh_pre_p)
    hv_pre_db = linear_to_db(hv_pre_p)
    hh_post_db = linear_to_db(hh_post_p)
    hv_post_db = linear_to_db(hv_post_p)

    lr_hh = hh_post_db - hh_pre_db
    lr_hv = hv_post_db - hv_pre_db
    ratio_diff = lr_hv - lr_hh

    # Local 5x5 spatial texture statistics
    mean_hv = uniform_filter(lr_hv, size=5)
    mean_sq_hv = uniform_filter(lr_hv**2, size=5)
    std_hv = np.sqrt(np.maximum(mean_sq_hv - mean_hv**2, 0.0))

    # Normalized Difference
    nd_hv = (hv_post_p - hv_pre_p) / (hv_post_p + hv_pre_p + 1e-7)

    features = np.stack(
        [
            hh_pre_db,
            hv_pre_db,
            hh_post_db,
            hv_post_db,
            lr_hh,
            lr_hv,
            ratio_diff,
            mean_hv,
            std_hv,
            nd_hv,
        ],
        axis=-1,
    )
    return features.astype(np.float32)


class LightGBMBurnedAreaClassifier:
    """Gradient Boosted Decision Tree pixel-spatial classifier."""

    def __init__(
        self,
        n_estimators: int = 150,
        learning_rate: float = 0.08,
        max_depth: int = 6,
        num_leaves: int = 31,
        random_state: int = 42,
        feature_names: Optional[List[str]] = None,
        min_child_samples: int = 20,
        subsample: float = 1.0,
        subsample_freq: int = 0,
        colsample_bytree: float = 1.0,
        reg_alpha: float = 0.0,
        reg_lambda: float = 0.0,
        scale_pos_weight: Optional[float] = None,
        eval_metric: str = "binary_logloss",
        stopping_rounds: int = 15,
    ):
        self.feature_names = list(feature_names) if feature_names is not None else list(FEATURE_NAMES)
        self.scale_pos_weight_override = scale_pos_weight
        self.eval_metric = eval_metric
        self.stopping_rounds = stopping_rounds
        self.params: Dict[str, Any] = {
            "objective": "binary",
            "metric": eval_metric,
            "boosting_type": "gbdt",
            "n_estimators": n_estimators,
            "learning_rate": learning_rate,
            "max_depth": max_depth,
            "num_leaves": num_leaves,
            "min_child_samples": min_child_samples,
            "subsample": subsample,
            "subsample_freq": subsample_freq,
            "colsample_bytree": colsample_bytree,
            "reg_alpha": reg_alpha,
            "reg_lambda": reg_lambda,
            "random_state": random_state,
            "n_jobs": -1,
            "verbose": -1,
        }
        self.model: Optional[lgb.LGBMClassifier] = None

    def fit(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
    ) -> Dict[str, float]:
        """Trains LightGBM model on flattened feature matrix.

        Uses ``scale_pos_weight_override`` when explicitly provided (e.g. ``1.0`` for
        calibrated unweighted probabilities), otherwise defaults to ``neg_count / pos_count``.
        """
        pos_count = int(np.count_nonzero(y_train == 1))
        neg_count = int(np.count_nonzero(y_train == 0))
        if self.scale_pos_weight_override is not None:
            scale_weight = float(self.scale_pos_weight_override)
        else:
            scale_weight = float(neg_count / max(pos_count, 1))

        self.params["scale_pos_weight"] = scale_weight
        self.model = lgb.LGBMClassifier(**self.params)

        eval_set = [(X_val, y_val)] if X_val is not None and y_val is not None else None

        self.model.fit(
            X_train,
            y_train,
            eval_set=eval_set,
            callbacks=[lgb.early_stopping(stopping_rounds=self.stopping_rounds, verbose=False)] if eval_set else None,
        )

        importances = {}
        for name, imp in zip(self.feature_names, self.model.feature_importances_):
            importances[name] = float(imp)

        return importances

    def predict_spatial(
        self,
        features_tensor: np.ndarray,
        threshold: float = 0.5,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Runs inference across a 2D (height, width, n_features) scene.

        Returns (probability_map, binary_mask).
        """
        if self.model is None:
            raise RuntimeError("Model has not been trained yet.")

        h, w, c = features_tensor.shape
        flat_X = features_tensor.reshape(-1, c)
        probs = self.model.predict_proba(flat_X)[:, 1]

        prob_map = probs.reshape(h, w).astype(np.float32)
        binary_mask = (prob_map >= threshold).astype(np.uint8)

        return prob_map, binary_mask
