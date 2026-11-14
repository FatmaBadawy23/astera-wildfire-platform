"""Diagnostics for the acquired real stacks (kept for reproducibility)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.processing.preprocessing.optical import (
    calibrate_dnbr_threshold,
    compute_dnbr,
    compute_nbr,
    valid_optical_mask,
)

ROOT = PROJECT_ROOT / "data" / "real"
manifest = json.load(open(ROOT / "acquisition_manifest.json", encoding="utf-8"))

for event_id, record in manifest["events"].items():
    stack = np.load(ROOT / event_id / "stack.npz")
    arrays = {key: stack[key] for key in stack.files}
    pre_dates = [entry for entry in record["s1"] if entry["role"] == "pre"]
    post_entries = sorted(record["s1"], key=lambda entry: entry["datetime"])
    pre_vh = arrays["s1_pre_vh"]
    post_vh = arrays[f"s1_{post_entries[-1]['role']}_vh"]
    valid = np.isfinite(pre_vh) & np.isfinite(post_vh) & (pre_vh > 0) & (post_vh > 0)
    log_ratio = 10 * np.log10(post_vh) - 10 * np.log10(pre_vh)
    burn = arrays["mcd_burn_mask"] > 0
    print(f"== {event_id} ({record['event']['split']})")
    print(
        f"   valid S1 {valid.mean():.3f}  burn|valid {burn[valid].mean():.3f}  "
        f"LR burn {np.nanmedian(log_ratio[burn & valid]):.2f} dB  LR unburn {np.nanmedian(log_ratio[~burn & valid]):.2f} dB"
    )
    try:
        nbr_pre = compute_nbr(arrays["s2_pre_B08"], arrays["s2_pre_B12"])
        nbr_post = compute_nbr(arrays["s2_post_B08"], arrays["s2_post_B12"])
        opt_valid = valid_optical_mask(
            arrays["s2_pre_SCL"],
            arrays["s2_post_SCL"],
            arrays["s2_pre_B08"],
            arrays["s2_post_B08"],
        ) & valid
        dnbr = compute_dnbr(nbr_pre, nbr_post)
        print(
            f"   optical valid {opt_valid.mean():.3f}  dNBR burn {np.nanmedian(dnbr[burn & opt_valid]):.3f}  "
            f"dNBR unburn {np.nanmedian(dnbr[~burn & opt_valid]):.3f}"
        )
        if record["event"]["split"] == "TRAIN":
            cal = calibrate_dnbr_threshold(dnbr, burn.astype(np.uint8), opt_valid)
            print(f"   calibrated dNBR threshold {cal['selected']}")
    except KeyError as exc:
        print("   optical missing", exc)
