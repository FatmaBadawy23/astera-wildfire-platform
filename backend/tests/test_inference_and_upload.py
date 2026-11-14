"""End-to-end integration tests for Upload, Before/After Pair Validation, and Real SAR Model Inference."""

from __future__ import annotations

import io
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.main import app

client = TestClient(app)
PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_available_models_registry():
    resp = client.get("/api/models/available")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_run_id"] == "run_20261114_025000_phase_g"
    assert data["is_nisar"] is False
    models = {m["model_id"]: m for m in data["models"]}
    assert {"unet", "lightgbm", "log_ratio", "cusum"}.issubset(models.keys())

    unet = models["unet"]
    assert unet["status"] == "READY"
    assert unet["checkpoint_size_bytes"] > 90_000_000
    assert len(unet["checkpoint_sha256"]) == 64
    assert len(unet["input_contract"]["channels"]) == 5

    lgbm = models["lightgbm"]
    assert lgbm["status"] == "READY"
    assert lgbm["checkpoint_size_bytes"] > 5_000
    assert len(lgbm["checkpoint_sha256"]) == 64
    assert len(lgbm["input_contract"]["features"]) == 10


def test_rgb_png_upload_is_scientifically_rejected():
    img = Image.fromarray(np.zeros((64, 64, 3), dtype=np.uint8))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    resp = client.post(
        "/api/analysis/upload",
        files={"file": ("holiday_photo.png", buf.getvalue(), "image/png")},
        data={"role": "pre_fire"},
    )
    assert resp.status_code == 200
    meta = resp.json()
    assert meta["is_valid"] is False
    assert meta["valid_for_sar_inference"] is False
    assert meta["validation_status"] == "REJECTED_NON_GEOSPATIAL_RGB"
    assert meta["error_code"] == "UNSUPPORTED_OPTICAL_RGB_FOR_SAR_MODEL"
    assert "RGB" in meta["scientific_explanation"]

    # Attempting to run SAR inference on the rejected RGB upload must fail with 400
    run_resp = client.post(
        "/api/analysis/run",
        json={"upload_id": meta["upload_id"], "model_type": "unet", "live_inference": True},
    )
    assert run_resp.status_code == 400


def test_end_to_end_upload_pair_validation_and_multi_model_inference():
    # 1. Discover generated real sample GeoTIFFs from CA_BUG_2026
    samples_resp = client.get("/api/analysis/samples")
    assert samples_resp.status_code == 200
    samples = {s["sample_id"]: s for s in samples_resp.json()["samples"]}
    assert "CA_BUG_2026_DUALPOL" in samples

    pre_path = PROJECT_ROOT / samples["CA_BUG_2026_DUALPOL"]["pre_file"]
    post_path = PROJECT_ROOT / samples["CA_BUG_2026_DUALPOL"]["post_file"]
    assert pre_path.exists()
    assert post_path.exists()

    # 2. Upload Pre-Fire GeoTIFF via multipart/form-data
    with pre_path.open("rb") as f_pre:
        pre_up_resp = client.post(
            "/api/analysis/upload",
            files={"file": (pre_path.name, f_pre.read(), "image/tiff")},
            data={"role": "pre_fire"},
        )
    assert pre_up_resp.status_code == 200
    pre_meta = pre_up_resp.json()
    assert pre_meta["validation_status"] == "VALID_GEOTIFF"
    assert pre_meta["band_count"] == 2
    assert pre_meta["width"] == 800
    assert pre_meta["height"] == 800
    assert pre_meta["crs"] in ("EPSG:32610", "EPSG:32611")
    pre_upload_id = pre_meta["upload_id"]

    # Check preview PNG endpoint
    prev_resp = client.get(f"/api/analysis/uploads/{pre_upload_id}/preview.png")
    assert prev_resp.status_code == 200
    assert prev_resp.headers["content-type"] == "image/png"
    assert len(prev_resp.content) > 1000

    # 3. Upload Post-Fire GeoTIFF via multipart/form-data
    with post_path.open("rb") as f_post:
        post_up_resp = client.post(
            "/api/analysis/upload",
            files={"file": (post_path.name, f_post.read(), "image/tiff")},
            data={"role": "post_fire"},
        )
    assert post_up_resp.status_code == 200
    post_meta = post_up_resp.json()
    post_upload_id = post_meta["upload_id"]

    # 4. Validate Before vs. After Pair Compatibility
    pair_resp = client.post(
        "/api/analysis/validate-pair",
        json={
            "pre_upload_id": pre_upload_id,
            "post_upload_id": post_upload_id,
            "auto_coregister": True,
        },
    )
    assert pair_resp.status_code == 200
    pair_data = pair_resp.json()
    assert pair_data["compatible"] is True
    assert pair_data["checks"]["crs_match"] is True
    assert pair_data["checks"]["spatial_overlap_percent"] > 99.0
    assert pair_data["checks"]["dimensions_match"] is True
    pair_id = pair_data["pair_id"]

    # 5. Execute Real Multi-Model Inference (UNet ResNet34 + LightGBM + Log-Ratio + CUSUM)
    run_resp = client.post(
        "/api/analysis/run",
        json={
            "pair_id": pair_id,
            "model_type": "unet",
            "run_all_models": True,
            "live_inference": True,
        },
    )
    assert run_resp.status_code == 200
    res = run_resp.json()
    assert res["status"] == "COMPLETED"
    assert res["model_type"] == "unet"
    assert set(res["model_comparison"].keys()) == {"unet", "lightgbm", "log_ratio", "cusum"}

    # Verify all 4 models produced real quantitative outputs
    for m_key in ("unet", "lightgbm", "log_ratio", "cusum"):
        m_out = res["model_comparison"][m_key]
        assert m_out["burned_pixels"] > 0
        assert m_out["burned_area_km2"] > 0.0
        assert m_out["burned_area_ha"] > 0.0
        assert m_out["execution_time_sec"] >= 0.0

    # Verify Before vs. After comparison metrics
    ba = res["before_after_radiometry"]
    assert ba["mean_pre_vh_db"] != ba["mean_post_vh_db"]
    assert ba["mean_delta_vh_db"] < 0.0
    assert res["area_statistics"]["burned_area_km2"] > 0.0
    assert res["burned_polygons_feature_count"] > 0

    analysis_id = res["analysis_id"]

    # 6. Verify generated raster, PNG overlay, and GeoJSON endpoints
    overview_resp = client.get(f"/api/analysis/results/{analysis_id}/overview.png")
    assert overview_resp.status_code == 200
    assert overview_resp.headers["content-type"] == "image/png"

    for layer_name in (
        "pre_fire_vh_db",
        "post_fire_vh_db",
        "delta_vh_db",
        "burn_probability",
        "predicted_burn_mask",
        "difference_heatmap",
        "model_consensus",
        "models/unet_probability",
        "models/unet_mask",
        "models/lightgbm_probability",
        "models/log_ratio_mask",
        "models/cusum_probability",
    ):
        l_resp = client.get(f"/api/analysis/results/{analysis_id}/layers/{layer_name}.png")
        assert l_resp.status_code == 200
        assert l_resp.headers["content-type"] == "image/png"

    for m_key in ("unet", "lightgbm", "log_ratio", "cusum"):
        m_out = res["model_comparison"][m_key]
        assert m_out["status"] == "COMPLETED"
        assert m_out["detected_regions_count"] >= 0
        assert m_out["agreement_with_primary_percent"] is not None
        assert m_out["probability_png"]
        assert m_out["mask_png"]

    tif_resp = client.get(f"/api/analysis/results/{analysis_id}/geotiff/burn_probability.tif")
    assert tif_resp.status_code == 200
    assert len(tif_resp.content) > 10_000

    cons_tif = client.get(f"/api/analysis/results/{analysis_id}/geotiff/model_consensus.tif")
    assert cons_tif.status_code == 200
    assert len(cons_tif.content) > 1000

    geojson_resp = client.get(
        f"/api/analysis/results/{analysis_id}/geojson/burned_polygons.geojson"
    )
    assert geojson_resp.status_code == 200
    gj = geojson_resp.json()
    assert gj["type"] == "FeatureCollection"
    assert len(gj["features"]) > 0


def test_optical_rgb_geotiff_is_scientifically_rejected():
    buf = io.BytesIO()
    profile = {
        "driver": "GTiff",
        "height": 32,
        "width": 32,
        "count": 3,
        "dtype": "uint8",
        "crs": "EPSG:4326",
        "transform": from_origin(-121.9, 40.0, 0.0002, 0.0002),
    }
    with rasterio.MemoryFile() as memfile:
        with memfile.open(**profile) as dst:
            dst.write(np.full((3, 32, 32), 120, dtype=np.uint8))
        buf.write(memfile.read())
    buf.seek(0)

    resp = client.post(
        "/api/analysis/upload",
        files={"file": ("optical_sentinel2_rgb.tif", buf, "image/tiff")},
        data={"role": "pre"},
    )
    assert resp.status_code == 200
    meta = resp.json()
    assert meta["is_valid"] is False
    assert meta["valid_for_sar_inference"] is False
    assert meta["error_code"] == "UNSUPPORTED_OPTICAL_RGB_FOR_SAR_MODEL"
    assert meta["file_format"] == "OPTICAL_RGB_GEOTIFF"


def test_inverted_dates_and_reference_candidates_and_custom_dualpol_pair():
    # Create synthetic non-catalog 2-date dual-pol GeoTIFF pair in EPSG:4326 (tests degree->m conversion too)
    rng = np.random.default_rng(7)
    transform = from_origin(-121.92, 40.02, 0.0002, 0.0002)

    def _make_tif_bytes(vv_arr: np.ndarray, vh_arr: np.ndarray) -> bytes:
        profile = {
            "driver": "GTiff",
            "height": 48,
            "width": 48,
            "count": 2,
            "dtype": "float32",
            "crs": "EPSG:4326",
            "transform": transform,
            "nodata": -9999.0,
        }
        with rasterio.MemoryFile() as memfile:
            with memfile.open(**profile) as dst:
                dst.write(vv_arr.astype(np.float32), 1)
                dst.write(vh_arr.astype(np.float32), 2)
                dst.set_band_description(1, "VV_dB")
                dst.set_band_description(2, "VH_dB")
            return memfile.read()

    pre_vv = rng.normal(-10.0, 1.0, (48, 48))
    pre_vh = rng.normal(-16.5, 1.0, (48, 48))
    post_vv = pre_vv.copy()
    post_vh = pre_vh.copy()
    post_vh[12:32, 12:32] -= 4.5
    post_vv[12:32, 12:32] -= 2.5

    r_pre = client.post(
        "/api/analysis/upload",
        files={"file": ("custom_site_pre_dualpol.tif", io.BytesIO(_make_tif_bytes(pre_vv, pre_vh)), "image/tiff")},
        data={"role": "pre", "acquisition_date": "2024-07-10"},
    )
    assert r_pre.status_code == 200
    pre_meta = r_pre.json()
    assert pre_meta["resolution_m"] is not None and 10.0 < pre_meta["resolution_m"] < 35.0
    assert pre_meta["acquisition_date"] == "2024-07-10"

    r_post = client.post(
        "/api/analysis/upload",
        files={"file": ("custom_site_post_dualpol.tif", io.BytesIO(_make_tif_bytes(post_vv, post_vh)), "image/tiff")},
        data={"role": "post", "acquisition_date": "2024-08-12"},
    )
    assert r_post.status_code == 200
    post_meta = r_post.json()

    # Check reference candidates matching endpoint for single uploaded image
    cand_resp = client.get(
        "/api/analysis/reference-candidates",
        params={"upload_id": pre_meta["upload_id"], "role_needed": "post"},
    )
    assert cand_resp.status_code == 200
    cands = cand_resp.json()["candidates"]
    assert len(cands) >= 1
    assert any("overlap_percent" in c for c in cands)

    # Inverted date validation must reject the pair
    bad_pair = client.post(
        "/api/analysis/validate-pair",
        json={
            "pre_upload_id": pre_meta["upload_id"],
            "post_upload_id": post_meta["upload_id"],
            "pre_date": "2024-09-01",
            "post_date": "2024-08-01",
        },
    )
    assert bad_pair.status_code == 200
    bad_data = bad_pair.json()
    assert bad_data["compatible"] is False
    assert bad_data["checks"]["date_order_valid"] is False
    assert any("DATE_ORDER_INVALID" in r for r in bad_data["reasons"])

    # Valid confirmed pair -> run analysis -> UNet/LightGBM/LogRatio COMPLETE, CUSUM reports UNAVAILABLE honestly
    ok_pair = client.post(
        "/api/analysis/validate-pair",
        json={
            "pre_upload_id": pre_meta["upload_id"],
            "post_upload_id": post_meta["upload_id"],
            "pre_date": "2024-07-10",
            "post_date": "2024-08-12",
            "area_name": "Custom Butte Test Ridge",
        },
    )
    assert ok_pair.status_code == 200
    ok_data = ok_pair.json()
    assert ok_data["compatible"] is True
    assert ok_data["area_name"] == "Custom Butte Test Ridge"

    run_resp = client.post(
        "/api/analysis/run",
        json={
            "pair_id": ok_data["pair_id"],
            "model_type": "unet",
            "run_all_models": True,
            "live_inference": True,
        },
    )
    assert run_resp.status_code == 200
    run_res = run_resp.json()
    assert run_res["spatial_metadata"]["area_name"] == "Custom Butte Test Ridge"
    assert run_res["spatial_metadata"]["pre_date"] == "2024-07-10"
    assert run_res["spatial_metadata"]["post_date"] == "2024-08-12"
    mc = run_res["model_comparison"]
    assert mc["unet"]["status"] == "COMPLETED"
    assert mc["lightgbm"]["status"] == "COMPLETED"
    assert mc["log_ratio"]["status"] == "COMPLETED"
    assert mc["cusum"]["status"] == "UNAVAILABLE"
    assert "temporal" in (mc["cusum"]["status_reason"] or "").lower()
