"""Repair S2 layers in already-acquired stacks (SCL must not be reflectance-scaled)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from rasterio.enums import Resampling

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.processing.preprocessing.grid import TargetGrid, read_to_grid

ROOT = PROJECT_ROOT / "data" / "real"

for event_dir in sorted(p for p in ROOT.iterdir() if p.is_dir()):
    meta_path = event_dir / "metadata.json"
    if not meta_path.exists():
        continue
    meta = json.load(open(meta_path, encoding="utf-8"))
    from rasterio.transform import Affine

    g = meta["grid"]
    grid = TargetGrid(crs=g["crs"], transform=Affine(*g["transform"]), width=g["width"], height=g["height"], res_m=g["res_m"])
    stack = np.load(event_dir / "stack.npz")
    arrays = {key: stack[key] for key in stack.files}
    changed = False
    for entry in meta["s2"]:
        role = entry["role"]
        for key, resampling, dtype, scale in (
            ("B04", Resampling.bilinear, "float32", 1 / 10000),
            ("B08", Resampling.bilinear, "float32", 1 / 10000),
            ("B12", Resampling.bilinear, "float32", 1 / 10000),
            ("SCL", Resampling.nearest, "uint8", 1.0),
        ):
            href = entry["assets"][key]
            array = read_to_grid(href, grid, resampling=resampling, dtype=dtype, scale=scale, collection="sentinel-2-l2a")
            if key != "SCL":
                array = np.where(array > 0, array, np.nan).astype(np.float32)
            arrays[f"s2_{role}_{key}"] = array
            changed = True
        print(event_dir.name, role, "SCL classes", np.unique(arrays[f"s2_{role}_SCL"], return_counts=True)[0][:12])
    if changed:
        np.savez_compressed(event_dir / "stack.npz", **arrays)
        print("repaired", event_dir.name)
