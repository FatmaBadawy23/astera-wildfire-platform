"""Phase G6 & G8 Backend Production API and Contract Verification Tests."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.analysis_service import AnalysisService

client = TestClient(app)


def test_phase_g_health_and_active_run():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ONLINE"
    assert data["geospatial_ready"] is True
    assert data["ml_ready"] is True
    assert data["dataset_ready"] is True
    assert data["checkpoints_ready"] is True
    assert data["active_run_id"] == "run_20261114_025000_phase_g"
    assert data["is_nisar"] is False
    assert data["nisar_status"]["nisar_pixels_used"] == 0
    assert data["nisar_status"]["current_sar_model_input"] == "Sentinel-1 C-band"


def test_phase_g_latest_run_contract():
    resp = client.get("/api/runs/latest")
    assert resp.status_code == 200
    data = resp.json()
    assert data["available"] is True
    assert data["run_id"] == "run_20261114_025000_phase_g"
    assert data["previous_baseline_run_id"] == "run_20261114_013500"
    assert data["training_status"] == "COMPLETED"
    assert data["evaluation_status"] == "VERIFIED"
    assert data["is_nisar"] is False
    assert data["sensor_provenance"]["nisar_l_band_pixels_used"] == 0
    assert data["dataset_counts"]["total_patches"] == 336
    assert data["dataset_counts"]["patches_per_split"] == {"TRAIN": 121, "VAL": 121, "TEST": 94}
    assert data["event_splits"] == {
        "TRAIN": ["CA_GANN_2026"],
        "VAL": ["CA_DOME_2026"],
        "TEST": ["CA_BUG_2026"],
    }
    assert "CA_TIMBER_2026" in data["excluded_events"]
    assert data["checkpoint_metadata"]["unet"]["masked_loss_used"] is True
    assert data["checkpoint_metadata"]["lightgbm"]["best_iteration"] == 6
    assert len(data["scientific_limitations"]) >= 4


def test_phase_g_models_comparison_and_separate_leaderboards():
    for endpoint in ("/api/models/comparison", "/api/metrics"):
        resp = client.get(endpoint)
        assert resp.status_code == 200
        data = resp.json()
        assert data["run_id"] == "run_20261114_025000_phase_g"
        assert data["is_nisar"] is False
        assert "leaderboards" in data
        lbs = data["leaderboards"]
        assert "vs_sentinel2_dnbr_20m" in lbs
        assert "vs_nasa_mcd64a1_20m" in lbs
        assert "vs_nasa_mcd64a1_500m_blocks" in lbs

        # Verify Sentinel-2 dNBR and MCD64A1 leaderboards are strictly distinct
        unet_dnbr = lbs["vs_sentinel2_dnbr_20m"]["UNet_ResNet34"]["metrics"]["TEST"]
        unet_mcd = lbs["vs_nasa_mcd64a1_20m"]["UNet_ResNet34"]["metrics"]["TEST"]
        assert unet_dnbr["reference_area_km2"] != unet_mcd["reference_area_km2"]
        assert unet_dnbr["f1_score"] > 0.79
        assert unet_mcd["f1_score"] > 0.89


def test_phase_g_dataset_stats_distinguishes_unique_and_overlapping_pixels():
    resp = client.get("/api/dataset/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["dataset_version"] == "run_20261114_025000_phase_g"
    assert data["events_summary"]["total_catalog_events"] == 4
    assert data["events_summary"]["supervised_pipeline_events"] == 3
    assert data["events_summary"]["excluded_events"] == 1

    px = data["pixel_accounting"]
    unique_3 = px["unique_scene_pixels_supervised_3_events"]
    overlap_336 = px["overlapping_patch_pixels_336_patches"]

    assert unique_3["total_scene_pixels"] == 1920000
    assert unique_3["valid_land_pixels"] == 1674809
    assert unique_3["water_pixels_excluded_scl6"] == 27939
    assert overlap_336["total_nominal_patch_pixels"] == 5505024
    assert overlap_336["valid_land_patch_pixels"] == 5158361
    assert overlap_336["invalid_or_water_masked_patch_pixels"] == 346663
    assert "CA_TIMBER_2026" in px["per_event"]
    assert px["per_event"]["CA_TIMBER_2026"]["include_in_training"] is False


def test_phase_g_events_include_excluded():
    resp_train = client.get("/api/events")
    assert resp_train.status_code == 200
    ids_train = {ev["event_id"] for ev in resp_train.json()}
    assert ids_train == {"CA_GANN_2026", "CA_DOME_2026", "CA_BUG_2026"}

    resp_all = client.get("/api/events?include_excluded=true")
    assert resp_all.status_code == 200
    ids_all = {ev["event_id"] for ev in resp_all.json()}
    assert ids_all == {"CA_GANN_2026", "CA_DOME_2026", "CA_BUG_2026", "CA_TIMBER_2026"}
    timber = next(ev for ev in resp_all.json() if ev["event_id"] == "CA_TIMBER_2026")
    assert timber["include_in_training"] is False
    assert timber["exclusion_reason"] is not None


def test_phase_g_event_analysis_geojson_rasters_and_png_layers():
    for event_id in ("CA_GANN_2026", "CA_DOME_2026", "CA_BUG_2026", "CA_TIMBER_2026"):
        ana_resp = client.get(f"/api/events/{event_id}/analysis")
        assert ana_resp.status_code == 200
        ana = ana_resp.json()
        assert ana["event_id"] == event_id
        assert ana["run_id"] == "run_20261114_025000_phase_g"
        assert ana["water_pixels_remaining_in_valid"] == 0
        assert len(ana["bounds_wgs84"]) == 4
        assert ana["raster_quality_audit"]["all_rasters_valid_and_aligned"] is True

        gj_resp = client.get(f"/api/events/{event_id}/geojson")
        assert gj_resp.status_code == 200
        gj = gj_resp.json()
        assert gj["aoi_boundary"]["type"] == "FeatureCollection"
        assert len(gj["aoi_boundary"]["features"]) == 1
        assert gj["firms_hotspots"]["type"] == "FeatureCollection"
        assert gj["firms_hotspot_count_in_aoi"] > 0

        ras_resp = client.get(f"/api/events/{event_id}/rasters")
        assert ras_resp.status_code == 200
        ras = ras_resp.json()
        assert len(ras["web_overlay_urls"]) == 8

    # Verify PNG endpoints return actual PNG bytes
    for layer_key in (
        "pre_fire_vh_db",
        "post_fire_vh_db",
        "delta_vh_db",
        "burn_probability",
        "predicted_burn_mask",
        "dnbr_reference",
        "mcd64a1_reference",
        "valid_land_mask",
    ):
        png_resp = client.get(f"/api/events/CA_BUG_2026/layers/{layer_key}.png")
        assert png_resp.status_code == 200
        assert png_resp.headers["content-type"] == "image/png"
        assert png_resp.content[:8] == b"\x89PNG\r\n\x1a\n"

    ov_resp = client.get("/api/events/CA_BUG_2026/overview.png")
    assert ov_resp.status_code == 200
    assert ov_resp.headers["content-type"] == "image/png"
    assert ov_resp.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_phase_g_nisar_status_endpoint():
    resp = client.get("/api/nisar/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["metadata_discovered"] is True
    assert data["authentication_required"] is True
    assert data["download_blocked"] is True
    assert data["nisar_granules_downloaded"] is False
    assert data["nisar_pixels_used"] == 0
    assert data["current_sar_model_input"] == "Sentinel-1 C-band"
    assert data["matched_same_geometry_pairs_count"] >= 15


def test_phase_g_error_handling_and_security_no_absolute_paths(tmp_path: Path):
    # Invalid event IDs
    assert client.get("/api/events/INVALID_EVENT/analysis").status_code == 404
    assert client.get("/api/events/INVALID_EVENT/geojson").status_code == 404
    assert client.get("/api/events/INVALID_EVENT/rasters").status_code == 404
    assert client.get("/api/events/INVALID_EVENT/layers/burn_probability.png").status_code == 404
    assert client.get("/api/events/CA_BUG_2026/layers/invalid_layer.png").status_code == 404

    # Missing latest_run.json graceful fallback
    svc_missing = AnalysisService(latest_run_ptr=tmp_path / "nonexistent_latest_run.json")
    missing_run_report = svc_missing.get_latest_versioned_run_report()
    assert missing_run_report["available"] is False
    assert missing_run_report["is_nisar"] is False

    # Verify zero absolute Windows paths or secret API keys leak in major API responses
    for url in (
        "/api/health",
        "/api/runs/latest",
        "/api/models/comparison",
        "/api/dataset/stats",
        "/api/nisar/status",
        "/api/events/CA_BUG_2026/analysis",
    ):
        raw_text = client.get(url).text
        assert "C:\\Users\\" not in raw_text
        assert "C:/Users/" not in raw_text
        assert "976f97bb32df53ab906fb2ff57ecae71" not in raw_text
