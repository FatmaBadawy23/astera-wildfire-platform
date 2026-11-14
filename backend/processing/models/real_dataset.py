"""Patch extraction for the real-data (Sentinel-1/2/MCD64A1) prototype.

Kept separate from the synthetic pipeline so the old dataset code and its tests remain
untouched. The sample cap and event grouping are enforced here as well.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np

from backend.processing.models.dataset import GlobalSampleTracker
from backend.processing.preprocessing.radiometry import linear_to_db


@dataclass
class RealPatchSet:
    patches: np.ndarray  # (N, 5, H, W) dB: VV_pre, VH_pre, VV_post, VH_post, dVH
    labels: np.ndarray  # (N, 1, H, W) dNBR-derived reference
    mcd: np.ndarray  # (N, 1, H, W) MCD64A1 independent reference
    valid: np.ndarray  # (N, 1, H, W)
    event_ids: List[str]


def to_db(power: np.ndarray) -> np.ndarray:
    """dB conversion that preserves NaN for invalid pixels."""
    db = linear_to_db(np.where(np.isfinite(power), power, np.nan))
    return db.astype(np.float32)


def extract_real_patches(
    pre_vv: np.ndarray,
    pre_vh: np.ndarray,
    post_vv: np.ndarray,
    post_vh: np.ndarray,
    label: np.ndarray,
    mcd: np.ndarray,
    valid: np.ndarray,
    event_id: str,
    split: str,
    patch_size: int = 128,
    stride: int = 64,
    min_valid_fraction: float = 0.25,
    tracker: Optional[GlobalSampleTracker] = None,
) -> RealPatchSet:
    """Extract paired 5-channel patches with aligned labels and validity masks."""
    trk = tracker or GlobalSampleTracker()
    height, width = pre_vv.shape

    vv_pre_db = to_db(pre_vv)
    vh_pre_db = to_db(pre_vh)
    vv_post_db = to_db(post_vv)
    vh_post_db = to_db(post_vh)
    dvh = vh_post_db - vh_pre_db
    stack = np.stack([vv_pre_db, vh_pre_db, vv_post_db, vh_post_db, dvh], axis=0)

    patches, labels, mcds, valids, events = [], [], [], [], []

    for row in range(0, height - patch_size + 1, stride):
        for col in range(0, width - patch_size + 1, stride):
            if not trk.can_add(1):
                return RealPatchSet(
                    np.stack(patches) if patches else np.empty((0, 5, patch_size, patch_size), np.float32),
                    np.stack(labels) if labels else np.empty((0, 1, patch_size, patch_size), np.uint8),
                    np.stack(mcds) if mcds else np.empty((0, 1, patch_size, patch_size), np.uint8),
                    np.stack(valids) if valids else np.empty((0, 1, patch_size, patch_size), np.uint8),
                    events,
                )
            patch_valid = valid[row : row + patch_size, col : col + patch_size]
            if float(patch_valid.mean()) < min_valid_fraction:
                continue
            patches.append(stack[:, row : row + patch_size, col : col + patch_size])
            labels.append(label[row : row + patch_size, col : col + patch_size][None].astype(np.uint8))
            mcds.append(mcd[row : row + patch_size, col : col + patch_size][None].astype(np.uint8))
            valids.append(patch_valid[None].astype(np.uint8))
            events.append(event_id)
            trk.record(split, 1)

    return RealPatchSet(
        np.stack(patches) if patches else np.empty((0, 5, patch_size, patch_size), np.float32),
        np.stack(labels) if labels else np.empty((0, 1, patch_size, patch_size), np.uint8),
        np.stack(mcds) if mcds else np.empty((0, 1, patch_size, patch_size), np.uint8),
        np.stack(valids) if valids else np.empty((0, 1, patch_size, patch_size), np.uint8),
        events,
    )


def nan_channel_stats(
    patches: np.ndarray,
    valid: Optional[np.ndarray] = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """Per-channel mean/std over finite (and optionally valid > 0) pixels in the training split."""
    channels = patches.shape[1]
    means = np.zeros(channels, dtype=np.float32)
    stds = np.ones(channels, dtype=np.float32)
    valid_mask = None
    if valid is not None:
        valid_mask = np.asarray(valid) > 0
        if valid_mask.ndim == 4 and valid_mask.shape[1] == 1:
            valid_mask = valid_mask[:, 0]
    for channel in range(channels):
        ch_arr = patches[:, channel]
        cond = np.isfinite(ch_arr)
        if valid_mask is not None:
            cond = cond & valid_mask
        values = ch_arr[cond]
        if values.size:
            means[channel] = float(np.mean(values))
            stds[channel] = max(float(np.std(values)), 1e-3)
    return means, stds


def fill_missing(patches: np.ndarray, means: np.ndarray) -> np.ndarray:
    """Replace NaN pixels with the training channel mean."""
    filled = patches.copy()
    for channel in range(patches.shape[1]):
        channel_values = filled[:, channel]
        channel_values[~np.isfinite(channel_values)] = means[channel]
        filled[:, channel] = channel_values
    return filled


def class_balance(masks: np.ndarray, valid: np.ndarray) -> Dict[str, float]:
    active = valid.astype(bool)
    positives = int(np.count_nonzero((masks > 0) & active))
    total = int(np.count_nonzero(active))
    return {
        "valid_pixels": total,
        "burned_pixels": positives,
        "burned_fraction": positives / total if total else 0.0,
    }
