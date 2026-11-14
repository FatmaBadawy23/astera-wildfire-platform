"""Pre-flight verification of Python packages, versioned run manifest, and ML checkpoints."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def main() -> int:
    required_mods = [
        "fastapi",
        "uvicorn",
        "pydantic",
        "torch",
        "lightgbm",
        "rasterio",
        "numpy",
        "scipy",
        "matplotlib",
        "PIL",
        "shapely",
        "pyproj",
    ]
    missing: list[str] = []
    for mod in required_mods:
        try:
            __import__(mod)
        except Exception as exc:
            missing.append(f"{mod} ({exc})")

    if missing:
        print("MISSING_PYTHON_PACKAGES: " + ", ".join(missing))
        return 2

    root_env = os.environ.get("ASTERA_APP_ROOT")
    root = Path(root_env) if root_env else Path(__file__).resolve().parent.parent

    ptr_file = root / "outputs" / "runs" / "latest_run.json"
    if not ptr_file.exists():
        print(f"MISSING_RUN_POINTER: {ptr_file} not found")
        return 3

    ptr = json.loads(ptr_file.read_text(encoding="utf-8"))
    run_id = ptr.get("run_id", "run_20261114_025000_phase_g")

    unet_ckpt = root / "outputs" / "runs" / run_id / "checkpoints" / "real_unet_resnet34_phase_g.pt"
    lgbm_ckpt = root / "outputs" / "runs" / run_id / "checkpoints" / "lightgbm_phase_g.pkl"
    ds_manifest = root / ptr.get("dataset_manifest_path", f"data/acquisitions/{run_id}/dataset/dataset_manifest.json")
    comp_report = root / ptr.get("model_comparison_path", f"outputs/runs/{run_id}/evaluation/real_model_comparison.json")

    for label, path in [
        ("U-Net ResNet34 Checkpoint", unet_ckpt),
        ("LightGBM Checkpoint", lgbm_ckpt),
        ("Dataset Manifest", ds_manifest),
        ("Model Comparison Report", comp_report),
    ]:
        if not path.exists():
            print(f"MISSING_ARTIFACT: {label} not found at {path}")
            return 4

    import torch

    print(
        f"PREFLIGHT_OK|run_id={run_id}"
        f"|unet_mb={unet_ckpt.stat().st_size / 1048576:.2f}"
        f"|lgbm_kb={lgbm_ckpt.stat().st_size / 1024:.1f}"
        f"|torch={torch.__version__}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
