"""PyTorch Dataset and Event-Grouped Patch Extraction Pipeline for Paired SAR Wildfire Monitoring.

Enforces strict scientific constraints:
1. HARD LIMIT: Global maximum of 10,000 generated samples across all splits.
2. ZERO SPATIAL LEAKAGE: Split strictly by wildfire event BEFORE extracting patches.
3. DATA AUGMENTATION: Safe radar augmentations applied exclusively to TRAIN split.
4. NORMALIZATION: Mean and std statistics computed strictly on TRAIN split.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple
import numpy as np
import torch
from torch.utils.data import Dataset

logger = logging.getLogger(__name__)

MAX_TOTAL_SAMPLES = 10000


@dataclass
class GlobalSampleTracker:
    """Tracks global sample counts across all dataset splits to enforce the 10,000 hard limit."""
    max_limit: int = MAX_TOTAL_SAMPLES
    train_count: int = 0
    val_count: int = 0
    test_count: int = 0

    @property
    def total_count(self) -> int:
        return self.train_count + self.val_count + self.test_count

    def can_add(self, n: int = 1) -> bool:
        return (self.total_count + n) <= self.max_limit

    def record(self, split: str, n: int = 1) -> bool:
        if not self.can_add(n):
            return False
        if split.upper() == "TRAIN":
            self.train_count += n
        elif split.upper() in ["VAL", "VALIDATION"]:
            self.val_count += n
        elif split.upper() == "TEST":
            self.test_count += n
        else:
            raise ValueError(f"Unknown split: {split}")
        return True


GLOBAL_TRACKER = GlobalSampleTracker()


class SARPatchDataset(Dataset):
    """PyTorch Dataset for paired multi-channel SAR patches and burned-area target masks."""

    def __init__(
        self,
        patches: List[np.ndarray],  # List of (5, H, W) arrays [HH_pre, HV_pre, HH_post, HV_post, Delta_HV]
        masks: List[np.ndarray],  # List of (1, H, W) binary uint8 arrays
        is_train: bool = False,
        norm_mean: Optional[np.ndarray] = None,  # (5,)
        norm_std: Optional[np.ndarray] = None,  # (5,)
        event_ids: Optional[List[str]] = None,
        valid_masks: Optional[List[np.ndarray]] = None,  # Optional list of (1, H, W) validity masks
    ):
        """``valid_masks`` (1 = valid land, 0 = excluded) is optional for backward compatibility.

        When it is given, ``__getitem__`` returns ``(x, y, m)``, the same geometric augmentation is
        applied to ``y`` and ``m``, and the trainer uses a masked loss. When it is omitted, the
        legacy ``(x, y)`` tuple is returned.
        """
        if valid_masks is not None and len(valid_masks) != len(patches):
            raise ValueError("valid_masks must have the same length as patches")
        self.patches = patches
        self.masks = masks
        self.valid_masks = valid_masks
        self.is_train = is_train
        self.norm_mean = norm_mean
        self.norm_std = norm_std
        self.event_ids = event_ids or ["UNKNOWN"] * len(patches)

    def __len__(self) -> int:
        return len(self.patches)

    def __getitem__(self, idx: int):
        patch = self.patches[idx].copy()  # (5, H, W)
        mask = self.masks[idx].copy()  # (1, H, W)
        valid = self.valid_masks[idx].copy() if self.valid_masks is not None else None

        # On-the-fly safe augmentations for training split only (applied identically to label and validity)
        if self.is_train:
            # Random horizontal flip
            if np.random.rand() > 0.5:
                patch = np.flip(patch, axis=2).copy()
                mask = np.flip(mask, axis=2).copy()
                if valid is not None:
                    valid = np.flip(valid, axis=2).copy()
            # Random vertical flip
            if np.random.rand() > 0.5:
                patch = np.flip(patch, axis=1).copy()
                mask = np.flip(mask, axis=1).copy()
                if valid is not None:
                    valid = np.flip(valid, axis=1).copy()
            # Random 90-degree rotations
            k = int(np.random.randint(0, 4))
            if k > 0:
                patch = np.rot90(patch, k=k, axes=(1, 2)).copy()
                mask = np.rot90(mask, k=k, axes=(1, 2)).copy()
                if valid is not None:
                    valid = np.rot90(valid, k=k, axes=(1, 2)).copy()

        # Apply train-fitted normalization
        if self.norm_mean is not None and self.norm_std is not None:
            mean_bc = self.norm_mean[:, None, None]
            std_bc = self.norm_std[:, None, None]
            patch = (patch - mean_bc) / np.maximum(std_bc, 1e-4)

        x_tensor = torch.from_numpy(np.ascontiguousarray(patch)).float()
        y_tensor = torch.from_numpy(np.ascontiguousarray(mask)).float()
        if valid is None:
            return x_tensor, y_tensor
        m_tensor = torch.from_numpy(np.ascontiguousarray(valid)).float()
        return x_tensor, y_tensor, m_tensor


def extract_patches_from_scene(
    pre_hh: np.ndarray,
    pre_hv: np.ndarray,
    post_hh: np.ndarray,
    post_hv: np.ndarray,
    burn_mask: np.ndarray,
    event_id: str,
    split: str,
    patch_size: int = 256,
    stride: int = 128,
    min_burn_ratio: float = 0.01,
    tracker: Optional[GlobalSampleTracker] = None,
) -> Tuple[List[np.ndarray], List[np.ndarray], List[str]]:
    """Extracts 256x256 bitemporal SAR patches while respecting global sample limits.

    Input channels:
    0: HH_pre (dB)
    1: HV_pre (dB)
    2: HH_post (dB)
    3: HV_post (dB)
    4: Delta_HV (dB)
    """
    from backend.processing.preprocessing.radiometry import linear_to_db

    trk = tracker or GLOBAL_TRACKER
    h, w = pre_hh.shape

    hh_pre_db = linear_to_db(pre_hh)
    hv_pre_db = linear_to_db(pre_hv)
    hh_post_db = linear_to_db(post_hh)
    hv_post_db = linear_to_db(post_hv)
    delta_hv_db = hv_post_db - hv_pre_db

    full_stack = np.stack(
        [hh_pre_db, hv_pre_db, hh_post_db, hv_post_db, delta_hv_db], axis=0
    ).astype(np.float32)  # (5, H, W)

    extracted_patches: List[np.ndarray] = []
    extracted_masks: List[np.ndarray] = []
    extracted_events: List[str] = []

    for r in range(0, h - patch_size + 1, stride):
        for c in range(0, w - patch_size + 1, stride):
            # Check hard global limit
            if not trk.can_add(1):
                logger.warning(f"Global sample limit ({trk.max_limit}) reached! Halting patch extraction.")
                return extracted_patches, extracted_masks, extracted_events

            patch_data = full_stack[:, r : r + patch_size, c : c + patch_size]
            patch_mask = burn_mask[r : r + patch_size, c : c + patch_size][None, :, :].astype(np.float32)

            # Skip patches that are completely empty / NaN
            if not np.all(np.isfinite(patch_data)):
                continue

            # Record in global tracker
            trk.record(split, 1)

            extracted_patches.append(patch_data)
            extracted_masks.append(patch_mask)
            extracted_events.append(event_id)

    return extracted_patches, extracted_masks, extracted_events


def compute_train_normalization(
    train_patches: List[np.ndarray],
) -> Tuple[np.ndarray, np.ndarray]:
    """Computes mean and std across training patches for each of the 5 channels."""
    if not train_patches:
        return np.zeros(5, dtype=np.float32), np.ones(5, dtype=np.float32)

    stack = np.stack(train_patches, axis=0)  # (N, 5, H, W)
    mean_vals = np.mean(stack, axis=(0, 2, 3)).astype(np.float32)
    std_vals = np.std(stack, axis=(0, 2, 3)).astype(np.float32)
    std_vals = np.maximum(std_vals, 1e-4)

    return mean_vals, std_vals
