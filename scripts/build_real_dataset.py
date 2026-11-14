"""Build the real-data, event-grouped patch dataset.

Inputs are the aligned stacks written by ``scripts/acquire_real_data.py``.
Outputs are ``data/real/dataset/{train,val,test}.npz``, full-scene prepared arrays for
per-event evaluation, train-only normalization statistics, and a manifest that records
every provenance and calibration decision.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.processing.acquisition.event_specs import EVENTS
from backend.processing.models.dataset import GlobalSampleTracker
from backend.processing.models.real_dataset import (
    class_balance,
    extract_real_patches,
    fill_missing,
    nan_channel_stats,
)
from backend.processing.preprocessing.optical import (
    calibrate_dnbr_threshold,
    compute_dnbr,
    compute_nbr,
    optical_agreement,
    valid_optical_mask,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("build-real-dataset")

REAL_ROOT = PROJECT_ROOT / "data" / "real"
DATASET_ROOT = REAL_ROOT / "dataset"
PATCH_SIZE = 128
STRIDE = 64
MAX_SAMPLES = 10000


def load_event_stack(event_id: str, record: Dict[str, Any]):
    stack = np.load(REAL_ROOT / event_id / "stack.npz")
    return {key: stack[key] for key in stack.files}


def earliest_latest_s1(record: Dict[str, Any]):
    ordered = sorted(record["s1"], key=lambda entry: entry["datetime"])
    return ordered[0], ordered[-1]


def optical_layers(arrays: Dict[str, np.ndarray], valid_s1: np.ndarray):
    nbr_pre = compute_nbr(arrays["s2_pre_B08"], arrays["s2_pre_B12"])
    nbr_post = compute_nbr(arrays["s2_post_B08"], arrays["s2_post_B12"])
    dnbr = compute_dnbr(nbr_pre, nbr_post)
    opt_valid = valid_optical_mask(
        arrays["s2_pre_SCL"],
        arrays["s2_post_SCL"],
        arrays["s2_pre_B08"],
        arrays["s2_post_B08"],
    )
    # A pixel is only usable if the dNBR itself exists. This also catches invalid B12
    # values, which ``valid_optical_mask`` cannot see because it only receives B08.
    return dnbr, (opt_valid & valid_s1 & np.isfinite(dnbr))


def build(threshold_override: float | None = None) -> Dict[str, Any]:
    manifest = json.load(open(REAL_ROOT / "acquisition_manifest.json", encoding="utf-8"))
    events = [event for event in EVENTS if event.include_in_training and event.event_id in manifest["events"]]
    if not events:
        raise RuntimeError("No eligible acquired events found.")

    prepared: Dict[str, Dict[str, np.ndarray]] = {}
    event_meta: Dict[str, Any] = {}

    # ---- First pass: build full-scene labels and validity; calibrate on TRAIN only ----
    for event in events:
        record = manifest["events"][event.event_id]
        arrays = load_event_stack(event.event_id, record)
        pre_entry, post_entry = earliest_latest_s1(record)
        pre_role, post_role = pre_entry["role"], post_entry["role"]

        pre_vv = arrays[f"s1_{pre_role}_vv"]
        pre_vh = arrays[f"s1_{pre_role}_vh"]
        post_vv = arrays[f"s1_{post_role}_vv"]
        post_vh = arrays[f"s1_{post_role}_vh"]
        valid_s1 = (
            np.isfinite(pre_vv)
            & np.isfinite(pre_vh)
            & np.isfinite(post_vv)
            & np.isfinite(post_vh)
            & (pre_vv > 0)
            & (pre_vh > 0)
            & (post_vv > 0)
            & (post_vh > 0)
        )
        dnbr, valid = optical_layers(arrays, valid_s1)

        prepared[event.event_id] = {
            "pre_vv": pre_vv,
            "pre_vh": pre_vh,
            "post_vv": post_vv,
            "post_vh": post_vh,
            "dnbr": dnbr,
            "valid": valid.astype(np.uint8),
            "mcd": (arrays["mcd_burn_mask"] > 0).astype(np.uint8),
            "pre_date": np.array(pre_entry["datetime"]),
            "post_date": np.array(post_entry["datetime"]),
        }
        # Temporal stack for CUSUM (>=3 observations).
        temporal_dates = sorted(record["s1"], key=lambda entry: entry["datetime"])
        prepared[event.event_id]["temporal_dates"] = np.array([entry["datetime"] for entry in temporal_dates])
        for index, entry in enumerate(temporal_dates):
            prepared[event.event_id][f"temporal_{index}_vv"] = arrays[f"s1_{entry['role']}_vv"]
            prepared[event.event_id][f"temporal_{index}_vh"] = arrays[f"s1_{entry['role']}_vh"]
        event_meta[event.event_id] = {
            "split": event.split,
            "name": event.name,
            "pre_datetime": pre_entry["datetime"],
            "post_datetime": post_entry["datetime"],
            "n_s1_dates": len(temporal_dates),
            "valid_fraction": float(valid.mean()),
            "mcd_fraction_valid": float(((arrays["mcd_burn_mask"] > 0) & valid).sum() / max(valid.sum(), 1)),
            "pre_item": pre_entry["item_id"],
            "post_item": post_entry["item_id"],
        }

    if threshold_override is not None:
        threshold = float(threshold_override)
        calibration = {"selected": {"threshold": threshold, "source": "override"}}
    else:
        train_pool = [
            event.event_id
            for event in events
            if event.split == "TRAIN"
        ]
        combined_dnbr = np.concatenate([prepared[eid]["dnbr"].ravel() for eid in train_pool])
        combined_mcd = np.concatenate([prepared[eid]["mcd"].ravel() for eid in train_pool])
        combined_valid = np.concatenate([prepared[eid]["valid"].ravel() for eid in train_pool]).astype(bool)
        calibration = calibrate_dnbr_threshold(combined_dnbr, combined_mcd, combined_valid)
        threshold = float(calibration["selected"]["threshold"])
    logger.info("dNBR threshold calibrated on TRAIN: %.3f (%s)", threshold, calibration["selected"])

    # ---- Second pass: labels, agreement, patches ----
    tracker = GlobalSampleTracker(max_limit=MAX_SAMPLES)
    split_accumulator = {split: {"patches": [], "labels": [], "mcd": [], "valid": [], "events": []} for split in ("TRAIN", "VAL", "TEST")}
    agreement: Dict[str, Any] = {}

    for event in events:
        data = prepared[event.event_id]
        dnbr = data["dnbr"]
        valid = data["valid"].astype(bool)
        label = ((dnbr >= threshold) & valid).astype(np.uint8)
        mcd = data["mcd"] & valid.astype(np.uint8)
        data["label"] = label
        agreement[event.event_id] = {
            "dnbr_vs_mcd": optical_agreement(label, mcd, valid),
            "label_fraction_valid": float(label[valid].mean()) if valid.any() else 0.0,
            "mcd_fraction_valid": float(mcd[valid].mean()) if valid.any() else 0.0,
            "valid_fraction": float(valid.mean()),
        }

        patch_set = extract_real_patches(
            data["pre_vv"],
            data["pre_vh"],
            data["post_vv"],
            data["post_vh"],
            label,
            mcd,
            valid.astype(np.uint8),
            event_id=event.event_id,
            split=event.split,
            patch_size=PATCH_SIZE,
            stride=STRIDE,
            tracker=tracker,
        )
        bucket = split_accumulator[event.split]
        bucket["patches"].append(patch_set.patches)
        bucket["labels"].append(patch_set.labels)
        bucket["mcd"].append(patch_set.mcd)
        bucket["valid"].append(patch_set.valid)
        bucket["events"].extend(patch_set.event_ids)
        logger.info(
            "%s (%s): %d patches, label fraction %.3f, MCD fraction %.3f",
            event.event_id,
            event.split,
            len(patch_set.patches),
            agreement[event.event_id]["label_fraction_valid"],
            agreement[event.event_id]["mcd_fraction_valid"],
        )

    DATASET_ROOT.mkdir(parents=True, exist_ok=True)
    (DATASET_ROOT / "prepared").mkdir(exist_ok=True)

    for split, bucket in split_accumulator.items():
        if bucket["patches"]:
            patches = np.concatenate(bucket["patches"], axis=0).astype(np.float32)
            labels = np.concatenate(bucket["labels"], axis=0).astype(np.uint8)
            mcds = np.concatenate(bucket["mcd"], axis=0).astype(np.uint8)
            valids = np.concatenate(bucket["valid"], axis=0).astype(np.uint8)
        else:
            patches = np.empty((0, 5, PATCH_SIZE, PATCH_SIZE), np.float32)
            labels = np.empty((0, 1, PATCH_SIZE, PATCH_SIZE), np.uint8)
            mcds = np.empty((0, 1, PATCH_SIZE, PATCH_SIZE), np.uint8)
            valids = np.empty((0, 1, PATCH_SIZE, PATCH_SIZE), np.uint8)
        np.savez_compressed(
            DATASET_ROOT / f"{split.lower()}.npz",
            patches=patches,
            labels=labels,
            mcd=mcds,
            valid=valids,
            events=np.array(bucket["events"]),
        )
        logger.info("%s: %d samples", split, len(patches))

    train = np.load(DATASET_ROOT / "train.npz")
    means, stds = nan_channel_stats(train["patches"])
    for split in ("TRAIN", "VAL", "TEST"):
        path = DATASET_ROOT / f"{split.lower()}.npz"
        data = np.load(path)
        filled = fill_missing(data["patches"], means)
        np.savez_compressed(
            path,
            patches=filled,
            labels=data["labels"],
            mcd=data["mcd"],
            valid=data["valid"],
            events=data["events"],
        )

    for event_id, data in prepared.items():
        np.savez_compressed(DATASET_ROOT / "prepared" / f"{event_id}.npz", **data)

    dataset_manifest = {
        "created_at_utc": __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime()),
        "data_origin": "CROSS_SENSOR_PROTOTYPE",
        "is_nisar": False,
        "sensors": ["sentinel-1-rtc (C-band)", "sentinel-2-l2a (reference labels)", "modis-64A1-061 (independent check)"],
        "label_definition": "Sentinel-2 dNBR >= threshold, masked by SCL and Sentinel-1 validity",
        "label_threshold": threshold,
        "label_calibration": calibration,
        "patch_size": PATCH_SIZE,
        "stride": STRIDE,
        "max_samples": MAX_SAMPLES,
        "samples": {split: int(np.load(DATASET_ROOT / f"{split.lower()}.npz")["patches"].shape[0]) for split in ("TRAIN", "VAL", "TEST")},
        "total_samples": int(sum(np.load(DATASET_ROOT / f"{split.lower()}.npz")["patches"].shape[0] for split in ("TRAIN", "VAL", "TEST"))),
        "normalization": {"mean": means.tolist(), "std": stds.tolist(), "fitted_on": "TRAIN"},
        "events": event_meta,
        "agreement": agreement,
        "splits": {
            split: sorted({event.event_id for event in events if event.split == split})
            for split in ("TRAIN", "VAL", "TEST")
        },
    }
    with open(DATASET_ROOT / "dataset_manifest.json", "w", encoding="utf-8") as handle:
        json.dump(dataset_manifest, handle, indent=2)
    with open(DATASET_ROOT / "norm_stats.json", "w", encoding="utf-8") as handle:
        json.dump({"mean": means.tolist(), "std": stds.tolist(), "fitted_on": "TRAIN"}, handle, indent=2)
    return dataset_manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--threshold", type=float, default=None, help="Override calibrated dNBR threshold")
    args = parser.parse_args()
    manifest = build(args.threshold)
    print(json.dumps({
        "samples": manifest["samples"],
        "total_samples": manifest["total_samples"],
        "threshold": manifest["label_threshold"],
        "splits": manifest["splits"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
