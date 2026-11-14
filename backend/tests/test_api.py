"""Integration tests for FastAPI application endpoints.

These tests assert the real-data prototype contract: verified event IDs, stored
experiment metrics, Before/After geospatial products, independent MCD64A1/dNBR validation,
NISAR candidate pair discovery, and explicit non-NISAR provenance.
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.analysis_service import AnalysisService

client = TestClient(app)

REAL_EVENT_IDS = {"CA_GANN_2026", "CA_DOME_2026", "CA_BUG_2026"}


def test_root_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert data["is_nisar"] is False
    assert data["data_origin"] == "CROSS_SENSOR_PROTOTYPE"
    assert "DISCOVERED_BLOCKED_AUTH" in data["nisar_mode"]
    assert data["project_maturity_status"]["CROSS_SENSOR_PROTOTYPE"] is True
    assert data["project_maturity_status"]["NISAR_DATA_DISCOVERED"] is True
    assert data["project_maturity_status"]["NISAR_DATA_ACQUIRED"] is False


def test_api_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["geospatial_ready"] is True
    assert data["ml_ready"] is True


def test_list_events():
    response = client.get("/api/events")
    assert response.status_code == 200
    events = response.json()
    assert isinstance(events, list)
    assert len(events) >= 3
    event_ids = {event["event_id"] for event in events}
    assert REAL_EVENT_IDS.issubset(event_ids)
    assert all(event["is_nisar"] is False for event in events)
    assert all(event["data_origin"] == "CROSS_SENSOR_PROTOTYPE" for event in events)


def test_get_event_detail():
    response = client.get("/api/events/CA_GANN_2026")
    assert response.status_code == 200
    event = response.json()
    assert event["fire_name"] == "Gann Fire"
    assert "California" in event["state_region"]
    assert event["split_assignment"] == "TRAIN"
    assert event["is_nisar"] is False


def test_trigger_analysis_returns_stored_real_metrics():
    response = client.post(
        "/api/analysis/run",
        json={"event_id": "CA_BUG_2026", "model_type": "lightgbm", "polarization": "HV"},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "COMPLETED"
    assert result["event_id"] == "CA_BUG_2026"
    assert result["is_nisar"] is False
    assert result["data_origin"] == "CROSS_SENSOR_PROTOTYPE"
    assert result["metrics"]["f1_score"] > 0.0
    assert result["metrics"]["event_id"] == "CA_BUG_2026"
    assert result["provenance"]["split"] == "TEST"
    assert result["uncertainty"]["f1_ci95_block_bootstrap"] is not None


def test_trigger_unet_analysis_uses_stored_checkpoint_metrics():
    response = client.post(
        "/api/analysis/run",
        json={"event_id": "CA_DOME_2026", "model_type": "unet", "polarization": "HV"},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["model_type"] == "unet"
    assert result["metrics"]["iou"] > 0.0
    assert result["provenance"]["split"] == "VAL"


def test_unknown_event_returns_404():
    response = client.post(
        "/api/analysis/run",
        json={"event_id": "OR_ROWE_CREEK_2026", "model_type": "lightgbm"},
    )
    assert response.status_code == 404


def test_unknown_model_returns_400():
    response = client.post(
        "/api/analysis/run",
        json={"event_id": "CA_BUG_2026", "model_type": "not_a_model"},
    )
    assert response.status_code == 400


def test_models_comparison():
    response = client.get("/api/models/comparison")
    assert response.status_code == 200
    data = response.json()
    assert data["is_nisar"] is False
    assert data["data_origin"] == "CROSS_SENSOR_PROTOTYPE"
    assert "models" in data
    assert "Log_Ratio_Baseline" in data["models"]
    assert "LightGBM_Pixel_Spatial" in data["models"]
    assert "UNet_ResNet34" in data["models"]
    assert "CUSUM_Temporal" in data["models"]
    assert data["splits"]["TEST"] == ["CA_BUG_2026"]


def test_event_before_after_endpoint():
    response = client.get("/api/events/CA_BUG_2026/before-after")
    assert response.status_code == 200
    data = response.json()
    assert data["event_id"] == "CA_BUG_2026"
    assert data["is_nisar"] is False
    assert data["before_after_verification"]["spatial_grid_verification"]["all_layers_co_registered"] is True
    assert data["area_estimates"]["primary_model_burned_area"]["burned_area_km2"] > 0.0
    assert data["area_estimates"]["primary_model_burned_area"]["burned_area_ha"] > 0.0


def test_event_products_endpoint():
    response = client.get("/api/events/CA_GANN_2026/products")
    assert response.status_code == 200
    data = response.json()
    assert data["event_id"] == "CA_GANN_2026"
    assert data["provenance"]["data_origin"] == "CROSS_SENSOR_PROTOTYPE"
    products = data["products"]
    for req_key in (
        "pre_vh_db",
        "post_vh_db",
        "delta_vh_db",
        "burn_prob",
        "burn_mask",
        "valid_mask",
        "aoi_boundary_geojson",
        "before_after_overview_png",
    ):
        assert req_key in products
        assert products[req_key]["exists"] is True
        assert products[req_key]["size_bytes"] > 0
    assert products["before_after_overview_png"]["format"] == "PNG"


def test_event_validation_and_nisar_candidates_endpoints():
    val_resp = client.get("/api/events/CA_BUG_2026/validation")
    assert val_resp.status_code == 200
    val_data = val_resp.json()
    unet_val = val_data["independent_validation"]["models"]["unet"]
    assert "vs_sentinel2_dnbr" in unet_val
    assert "vs_nasa_mcd64a1_qa_filtered" in unet_val
    assert "vs_nasa_mcd64a1_500m_block_reconciled" in unet_val
    assert unet_val["vs_sentinel2_dnbr"]["roc_auc"] > 0.5
    assert "all_burned" in val_data["independent_validation"]["models"]

    nisar_resp = client.get("/api/nisar/candidates")
    assert nisar_resp.status_code == 200
    nisar_data = nisar_resp.json()
    assert nisar_data["nisar_collection"]["validated_concept_id"] == "C3622241360-ASF"
    assert nisar_data["nisar_collection"]["provisional_concept_id"] == "C2854338529-ASF"
    assert nisar_data["acquisition_environment"]["matched_same_geometry_pairs_count"] >= 4
    assert "CA_BUG_2026" in nisar_data["events"]
    assert nisar_data["events"]["CA_BUG_2026"]["primary_nisar_pair"] is not None

    # Verify /api/v1 alias routes work identically
    v1_resp = client.get("/api/v1/events/CA_BUG_2026/before-after")
    assert v1_resp.status_code == 200
    assert v1_resp.json()["event_id"] == "CA_BUG_2026"


def test_mock_data_flag_explicitly_labels_synthetic():
    svc = AnalysisService(use_mock_data=True)
    events = svc.list_events()
    assert len(events) > 0
    assert all(ev["data_origin"] == "SYNTHETIC_MOCK_DATA" for ev in events)
    assert all(ev["is_synthetic"] is True for ev in events)


def test_firms_and_latest_versioned_run_endpoints():
    firms_resp = client.get("/api/events/CA_BUG_2026/firms")
    assert firms_resp.status_code == 200
    firms_data = firms_resp.json()
    assert firms_data["event_id"] == "CA_BUG_2026"
    assert firms_data["is_nisar"] is False
    assert firms_data["buffered_aoi_summary"]["total_hotspots"] > 0

    run_resp = client.get("/api/runs/latest")
    assert run_resp.status_code == 200
    run_data = run_resp.json()
    assert run_data["available"] is True
    assert run_data["is_nisar"] is False
    assert run_data["water_exclusion_audit"]["CA_GANN_2026"]["scl6_water_pixels_in_valid_mask"] == 0
    assert "UNet_ResNet34" in run_data["models"]
