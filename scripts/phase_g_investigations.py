"""Phase G2 & G3 Controlled Scientific Investigations:
1. Phase G2: Root-cause analysis of LightGBM `best_iteration_ = 1` and controlled TRAIN/VAL experiment
   across weighting strategies, regularization, and early-stopping metrics (strictly on TRAIN=CA_GANN_2026
   and VAL=CA_DOME_2026; zero TEST access).
2. Phase G3: Comprehensive physical, radiometric, and geospatial suitability audit of CA_TIMBER_2026
   vs. CA_GANN_2026, CA_DOME_2026, and CA_BUG_2026.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List

import lightgbm as lgb
import numpy as np
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss, roc_auc_score

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.processing.acquisition.event_specs import EVENTS_BY_ID
from backend.processing.models.real_dataset import nan_channel_stats
from backend.processing.preprocessing.mcd64a1 import decode_qa_bitmask
from backend.processing.preprocessing.optical import (
    compute_dnbr,
    compute_nbr,
    valid_optical_mask,
    water_optical_mask,
)
from scripts.run_real_pipeline import (
    FEATURE_NAMES,
    features_from_scene,
    metrics_dict,
    power_to_db,
    scene_stack,
    select_probability_threshold,
)


def run_g2_lightgbm_investigation() -> Dict[str, Any]:
    ds_dir = PROJECT_ROOT / "data" / "acquisitions" / "run_20261114_013500" / "dataset"
    manifest = json.loads((ds_dir / "dataset_manifest.json").read_text(encoding="utf-8"))
    threshold_dnbr = float(manifest["label_threshold"])

    # Compute valid-only TRAIN normalization stats
    with np.load(ds_dir / "train.npz") as tr_npz:
        means, stds = nan_channel_stats(tr_npz["patches"], valid=tr_npz["valid"])

    prep_gann = dict(np.load(ds_dir / "prepared" / "CA_GANN_2026.npz"))
    prep_dome = dict(np.load(ds_dir / "prepared" / "CA_DOME_2026.npz"))

    valid_gann = prep_gann["valid"].astype(bool)
    valid_dome = prep_dome["valid"].astype(bool)
    y_gann_2d = ((prep_gann["dnbr"] >= threshold_dnbr) & valid_gann).astype(np.uint8)
    y_dome_2d = ((prep_dome["dnbr"] >= threshold_dnbr) & valid_dome).astype(np.uint8)

    stack_gann = scene_stack(prep_gann)
    stack_dome = scene_stack(prep_dome)

    feat_gann_2d = features_from_scene(stack_gann, means)
    feat_dome_2d = features_from_scene(stack_dome, means)

    # Stride-2 subsampling used for fitting & early stopping
    X_train = feat_gann_2d[::2, ::2, :].reshape(-1, len(FEATURE_NAMES))[valid_gann[::2, ::2].ravel()]
    y_train = y_gann_2d[::2, ::2].ravel()[valid_gann[::2, ::2].ravel()]

    X_val = feat_dome_2d[::2, ::2, :].reshape(-1, len(FEATURE_NAMES))[valid_dome[::2, ::2].ravel()]
    y_val = y_dome_2d[::2, ::2].ravel()[valid_dome[::2, ::2].ravel()]

    pos_train = int(np.count_nonzero(y_train == 1))
    neg_train = int(np.count_nonzero(y_train == 0))
    pos_val = int(np.count_nonzero(y_val == 1))
    neg_val = int(np.count_nonzero(y_val == 0))
    full_spw = float(neg_train / max(pos_train, 1))
    sqrt_spw = float(np.sqrt(full_spw))

    # Audit feature distributions & missing values on TRAIN and VAL
    feature_audit: Dict[str, Any] = {}
    for idx, fname in enumerate(FEATURE_NAMES):
        tr_col = X_train[:, idx]
        va_col = X_val[:, idx]
        feature_audit[fname] = {
            "train_nan_count": int(np.count_nonzero(~np.isfinite(tr_col))),
            "val_nan_count": int(np.count_nonzero(~np.isfinite(va_col))),
            "train_mean": round(float(np.mean(tr_col)), 4),
            "train_std": round(float(np.std(tr_col)), 4),
            "train_burned_mean": round(float(np.mean(tr_col[y_train == 1])), 4),
            "train_unburned_mean": round(float(np.mean(tr_col[y_train == 0])), 4),
            "val_mean": round(float(np.mean(va_col)), 4),
            "val_std": round(float(np.std(va_col)), 4),
            "val_burned_mean": round(float(np.mean(va_col[y_val == 1])), 4),
            "val_unburned_mean": round(float(np.mean(va_col[y_val == 0])), 4),
        }

    configs = [
        {
            "id": "A_baseline_balanced_logloss",
            "description": "Original baseline: scale_pos_weight=5.624 (balanced), eval_metric=binary_logloss, depth=7, leaves=31, lr=0.05",
            "params": {
                "n_estimators": 250,
                "learning_rate": 0.05,
                "max_depth": 7,
                "num_leaves": 31,
                "min_child_samples": 20,
                "scale_pos_weight": full_spw,
                "metric": "binary_logloss",
            },
        },
        {
            "id": "B_unweighted_logloss",
            "description": "Unweighted training (scale_pos_weight=1.0), eval_metric=binary_logloss, depth=5, leaves=15, min_child=100, lr=0.03",
            "params": {
                "n_estimators": 250,
                "learning_rate": 0.03,
                "max_depth": 5,
                "num_leaves": 15,
                "min_child_samples": 100,
                "subsample": 0.8,
                "subsample_freq": 1,
                "colsample_bytree": 0.8,
                "reg_alpha": 1.0,
                "reg_lambda": 5.0,
                "scale_pos_weight": 1.0,
                "metric": "binary_logloss",
            },
        },
        {
            "id": "C_sqrt_weighted_auc_es",
            "description": "Tempered sqrt class weight (scale_pos_weight=2.371), eval_metric=auc, depth=4, leaves=15, min_child=200, lr=0.03",
            "params": {
                "n_estimators": 250,
                "learning_rate": 0.03,
                "max_depth": 4,
                "num_leaves": 15,
                "min_child_samples": 200,
                "subsample": 0.8,
                "subsample_freq": 1,
                "colsample_bytree": 0.8,
                "reg_alpha": 2.0,
                "reg_lambda": 10.0,
                "scale_pos_weight": sqrt_spw,
                "metric": "auc",
            },
        },
        {
            "id": "D_unweighted_shallow_auc_es",
            "description": "Unweighted (scale_pos_weight=1.0), eval_metric=auc, depth=4, leaves=15, min_child=200, lr=0.03, strong L2",
            "params": {
                "n_estimators": 250,
                "learning_rate": 0.03,
                "max_depth": 4,
                "num_leaves": 15,
                "min_child_samples": 200,
                "subsample": 0.8,
                "subsample_freq": 1,
                "colsample_bytree": 0.8,
                "reg_alpha": 2.0,
                "reg_lambda": 10.0,
                "scale_pos_weight": 1.0,
                "metric": "auc",
            },
        },
        {
            "id": "E_balanced_shallow_ap_es",
            "description": "Balanced (scale_pos_weight=5.624), eval_metric=average_precision, depth=4, leaves=15, min_child=200, lr=0.03",
            "params": {
                "n_estimators": 250,
                "learning_rate": 0.03,
                "max_depth": 4,
                "num_leaves": 15,
                "min_child_samples": 200,
                "subsample": 0.8,
                "subsample_freq": 1,
                "colsample_bytree": 0.8,
                "reg_alpha": 2.0,
                "reg_lambda": 10.0,
                "scale_pos_weight": full_spw,
                "metric": "average_precision",
            },
        },
    ]

    experiment_results: List[Dict[str, Any]] = []
    for cfg in configs:
        p = dict(cfg["params"])
        metric_name = p.pop("metric")
        model = lgb.LGBMClassifier(
            objective="binary",
            boosting_type="gbdt",
            random_state=42,
            n_jobs=-1,
            verbose=-1,
            metric=metric_name,
            **p,
        )
        model.fit(
            X_train,
            y_train,
            eval_set=[(X_train, y_train), (X_val, y_val)],
            eval_names=["train", "val"],
            callbacks=[lgb.early_stopping(stopping_rounds=25, verbose=False)],
        )

        # Full-scene predictions on TRAIN and VAL
        tr_prob_2d = model.predict_proba(feat_gann_2d.reshape(-1, len(FEATURE_NAMES)))[:, 1].reshape(y_gann_2d.shape).astype(np.float32)
        va_prob_2d = model.predict_proba(feat_dome_2d.reshape(-1, len(FEATURE_NAMES)))[:, 1].reshape(y_dome_2d.shape).astype(np.float32)

        # Calibrate probability threshold strictly on VAL
        fine_candidates = tuple(np.round(np.arange(0.05, 0.951, 0.02), 2))
        thr_sel = select_probability_threshold(va_prob_2d, y_dome_2d, valid_dome, candidates=fine_candidates)
        best_thr = float(thr_sel["selected"]["threshold"])

        tr_pred_2d = ((tr_prob_2d >= best_thr) & valid_gann).astype(np.uint8)
        va_pred_2d = ((va_prob_2d >= best_thr) & valid_dome).astype(np.uint8)

        tr_m = metrics_dict(tr_pred_2d, y_gann_2d, valid_gann)
        va_m = metrics_dict(va_pred_2d, y_dome_2d, valid_dome)

        tr_prob_v = tr_prob_2d[valid_gann]
        tr_true_v = y_gann_2d[valid_gann]
        va_prob_v = va_prob_2d[valid_dome]
        va_true_v = y_dome_2d[valid_dome]

        tr_logloss = float(log_loss(tr_true_v, np.clip(tr_prob_v, 1e-6, 1 - 1e-6)))
        va_logloss = float(log_loss(va_true_v, np.clip(va_prob_v, 1e-6, 1 - 1e-6)))
        va_brier = float(brier_score_loss(va_true_v, va_prob_v))
        tr_roc = float(roc_auc_score(tr_true_v, tr_prob_v))
        va_roc = float(roc_auc_score(va_true_v, va_prob_v))
        tr_pr = float(average_precision_score(tr_true_v, tr_prob_v))
        va_pr = float(average_precision_score(va_true_v, va_prob_v))

        eval_hist_val = [round(float(x), 5) for x in model.evals_result_["val"][metric_name][:30]]

        experiment_results.append(
            {
                "config_id": cfg["id"],
                "description": cfg["description"],
                "hyperparameters": cfg["params"],
                "best_iteration": int(model.best_iteration_),
                "total_trees_fitted": int(model.booster_.num_trees()),
                "total_splits": int(sum(model.feature_importances_)),
                "val_eval_history_first30": eval_hist_val,
                "selected_val_threshold": best_thr,
                "train_metrics": {
                    "logloss": round(tr_logloss, 4),
                    "roc_auc": round(tr_roc, 4),
                    "pr_auc": round(tr_pr, 4),
                    "f1": tr_m["f1_score"],
                    "iou": tr_m["iou"],
                    "precision": tr_m["precision"],
                    "recall": tr_m["recall"],
                },
                "val_metrics": {
                    "logloss": round(va_logloss, 4),
                    "brier_score": round(va_brier, 4),
                    "roc_auc": round(va_roc, 4),
                    "pr_auc": round(va_pr, 4),
                    "f1": va_m["f1_score"],
                    "iou": va_m["iou"],
                    "precision": va_m["precision"],
                    "recall": va_m["recall"],
                    "specificity": va_m["specificity"],
                },
                "feature_importances": {
                    name: int(imp) for name, imp in zip(FEATURE_NAMES, model.feature_importances_)
                },
            }
        )

    return {
        "split_summary": {
            "train_event": "CA_GANN_2026",
            "train_stride2_rows": int(len(y_train)),
            "train_positives": pos_train,
            "train_negatives": neg_train,
            "train_prevalence": round(pos_train / len(y_train), 4),
            "train_full_valid_pixels": int(np.count_nonzero(valid_gann)),
            "val_event": "CA_DOME_2026",
            "val_stride2_rows": int(len(y_val)),
            "val_positives": pos_val,
            "val_negatives": neg_val,
            "val_prevalence": round(pos_val / len(y_val), 4),
            "val_full_valid_pixels": int(np.count_nonzero(valid_dome)),
            "n_features": len(FEATURE_NAMES),
            "feature_names": FEATURE_NAMES,
            "full_scale_pos_weight": round(full_spw, 4),
            "sqrt_scale_pos_weight": round(sqrt_spw, 4),
        },
        "feature_audit": feature_audit,
        "controlled_experiments": experiment_results,
    }


def run_g3_event_suitability_investigation() -> Dict[str, Any]:
    real_root = PROJECT_ROOT / "data" / "real"
    event_diagnostics: Dict[str, Any] = {}

    for ev_id, spec in EVENTS_BY_ID.items():
        ev_dir = real_root / ev_id
        meta = json.loads((ev_dir / "metadata.json").read_text(encoding="utf-8"))
        with np.load(ev_dir / "stack.npz") as st:
            arrays = {k: st[k] for k in st.files}
        with np.load(ev_dir / "mcd64a1_ancillary.npz") as anc:
            qa_dec = decode_qa_bitmask(anc["qa"])

        ordered = sorted(meta["s1"], key=lambda e: e["datetime"])
        pre_role, post_role = ordered[0]["role"], ordered[-1]["role"]
        pre_vv = arrays[f"s1_{pre_role}_vv"]
        pre_vh = arrays[f"s1_{pre_role}_vh"]
        post_vv = arrays[f"s1_{post_role}_vv"]
        post_vh = arrays[f"s1_{post_role}_vh"]

        valid_s1 = (
            np.isfinite(pre_vv) & np.isfinite(pre_vh)
            & np.isfinite(post_vv) & np.isfinite(post_vh)
            & (pre_vv > 0) & (pre_vh > 0) & (post_vv > 0) & (post_vh > 0)
        )
        nbr_pre = compute_nbr(arrays["s2_pre_B08"], arrays["s2_pre_B12"])
        nbr_post = compute_nbr(arrays["s2_post_B08"], arrays["s2_post_B12"])
        dnbr = compute_dnbr(nbr_pre, nbr_post)
        water_mask = water_optical_mask(arrays["s2_pre_SCL"], arrays["s2_post_SCL"])
        opt_valid = valid_optical_mask(
            arrays["s2_pre_SCL"], arrays["s2_post_SCL"],
            arrays["s2_pre_B08"], arrays["s2_post_B08"], exclude_water=True
        )
        valid = opt_valid & valid_s1 & np.isfinite(dnbr) & (~water_mask)

        dnbr_burn = (dnbr >= 0.11) & valid
        mcd_burn = (arrays["mcd_burn_mask"] > 0) & qa_dec["high_quality_land_mask"] & valid

        vh_pre_db = power_to_db(pre_vh)
        vh_post_db = power_to_db(post_vh)
        vv_pre_db = power_to_db(pre_vv)
        vv_post_db = power_to_db(post_vv)
        delta_vh = vh_post_db - vh_pre_db
        delta_vv = vv_post_db - vv_pre_db

        dvh_burned = delta_vh[dnbr_burn]
        dvh_unburned = delta_vh[valid & (~dnbr_burn)]
        dvv_burned = delta_vv[dnbr_burn]
        dvv_unburned = delta_vv[valid & (~dnbr_burn)]

        # Compute ROC-AUC of (-delta_vh) as a standalone physical burn discriminator
        y_true = dnbr_burn[valid].astype(np.uint8)
        score = (-delta_vh[valid]).astype(np.float32)
        phys_roc_auc = float(roc_auc_score(y_true, score))

        event_diagnostics[ev_id] = {
            "event_id": ev_id,
            "name": spec.name,
            "region": spec.region,
            "split": spec.split,
            "include_in_training": spec.include_in_training,
            "reported_start": spec.reported_start,
            "reported_acres": spec.reported_acres,
            "crs": meta["grid"]["crs"],
            "dimensions": [meta["grid"]["height"], meta["grid"]["width"]],
            "resolution_m": meta["grid"]["res_m"],
            "s1_pre_date": ordered[0]["datetime"][:10],
            "s1_post_date": ordered[-1]["datetime"][:10],
            "s2_pre_date": meta["s2"][0]["datetime"][:10],
            "s2_post_date": meta["s2"][-1]["datetime"][:10],
            "total_pixels": int(valid.size),
            "valid_land_pixels": int(np.count_nonzero(valid)),
            "valid_land_fraction": round(float(valid.mean()), 4),
            "water_pixels_scl6": int(np.count_nonzero(water_mask)),
            "dnbr_burned_pixels": int(np.count_nonzero(dnbr_burn)),
            "dnbr_burned_fraction": round(float(dnbr_burn[valid].mean()), 4),
            "mcd_burned_pixels": int(np.count_nonzero(mcd_burn)),
            "mcd_burned_fraction": round(float(mcd_burn[valid].mean()), 4),
            "delta_vh_burned_mean_db": round(float(np.mean(dvh_burned)), 4),
            "delta_vh_burned_median_db": round(float(np.median(dvh_burned)), 4),
            "delta_vh_unburned_mean_db": round(float(np.mean(dvh_unburned)), 4),
            "delta_vh_unburned_median_db": round(float(np.median(dvh_unburned)), 4),
            "delta_vh_burn_minus_unburn_db": round(float(np.mean(dvh_burned) - np.mean(dvh_unburned)), 4),
            "delta_vv_burn_minus_unburn_db": round(float(np.mean(dvv_burned) - np.mean(dvv_unburned)), 4),
            "minus_delta_vh_roc_auc_vs_dnbr": round(phys_roc_auc, 4),
            "spec_notes": spec.notes,
        }

    return event_diagnostics


if __name__ == "__main__":
    g2 = run_g2_lightgbm_investigation()
    g3 = run_g3_event_suitability_investigation()
    out = {"phase_g2_lightgbm": g2, "phase_g3_events": g3}
    out_path = PROJECT_ROOT / "outputs" / "phase_g_investigations.json"
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("Wrote", out_path)
    for exp in g2["controlled_experiments"]:
        print(
            exp["config_id"],
            "best_iter=", exp["best_iteration"],
            "splits=", exp["total_splits"],
            "val_f1=", exp["val_metrics"]["f1"],
            "val_pr_auc=", exp["val_metrics"]["pr_auc"],
            "val_roc_auc=", exp["val_metrics"]["roc_auc"],
            "val_logloss=", exp["val_metrics"]["logloss"],
            "thr=", exp["selected_val_threshold"],
        )
    for ev_id, diag in g3.items():
        print(
            ev_id,
            "include=", diag["include_in_training"],
            "valid_frac=", diag["valid_land_fraction"],
            "water_px=", diag["water_pixels_scl6"],
            "dvh_burn_med=", diag["delta_vh_burned_median_db"],
            "dvh_unburn_med=", diag["delta_vh_unburned_median_db"],
            "roc_auc(-dVH)=", diag["minus_delta_vh_roc_auc_vs_dnbr"],
        )
