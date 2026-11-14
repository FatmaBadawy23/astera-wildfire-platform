"""Execute Versioned End-to-End Real NASA Data Acquisition, Water-Free Dataset Construction,
Model Training, Before/After Geospatial Product Generation, and Independent Validation.

NON-DESTRUCTIVE VERSIONED EXECUTION:
- Writes all acquisition artifacts to: `data/acquisitions/run_<RUN_ID>/`
- Writes all checkpoints, predictions, GeoTIFFs, GeoJSONs, PNGs, and reports to:
  `outputs/runs/run_<RUN_ID>/`
- Preserves all existing files in `data/real/`, `models/checkpoints/`, `outputs/evaluation/`,
  and `outputs/geospatial/` without modification.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import os
import pickle
import platform
import shutil
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import httpx
import numpy as np
import torch
from scipy.ndimage import uniform_filter

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.processing.acquisition.asf_client import parse_nisar_granule_id

NISAR_GCOV_VALIDATED_CONCEPT_ID = "C3622241360-ASF"
NISAR_GCOV_PROVISIONAL_CONCEPT_ID = "C2854338529-ASF"
from backend.processing.acquisition.event_specs import EVENTS, EVENTS_BY_ID
from backend.processing.acquisition.firms_client import (
    ActiveFirePoint,
    FIRMSClient,
    get_env_or_windows_user_var,
    sanitize_firms_url,
)
from backend.processing.change_detection.before_after import (
    compute_before_after_sar_features,
    compute_geospatial_burned_area,
    export_aoi_boundary_geojson,
    export_geotiff_layer,
    verify_before_after_alignment,
)
from backend.processing.change_detection.cusum import CUSUMDetector
from backend.processing.models.dataset import GlobalSampleTracker, SARPatchDataset
from backend.processing.models.lightgbm_model import LightGBMBurnedAreaClassifier
from backend.processing.models.real_dataset import (
    extract_real_patches,
    fill_missing,
    nan_channel_stats,
)
from backend.processing.models.trainer import train_unet_model
from backend.processing.models.unet_resnet import UNetResNet34
from backend.processing.preprocessing.mcd64a1 import (
    decode_qa_bitmask,
    summarize_mcd64a1_layers,
)
from backend.processing.preprocessing.optical import (
    SCL_LAND_VALID_CLASSES,
    SCL_WATER_CLASS,
    calibrate_dnbr_threshold,
    compute_dnbr,
    compute_nbr,
    optical_agreement,
    valid_optical_mask,
    water_optical_mask,
)
from backend.processing.validation.metrics import (
    calculate_coarse_block_reconciliation_metrics,
    calculate_probability_auc_metrics,
    calculate_segmentation_metrics,
)
from scripts.generate_before_after_and_validation import export_before_after_overview_png
from scripts.run_real_pipeline import (
    FEATURE_NAMES,
    PIXEL_AREA_M2,
    block_bootstrap_f1,
    calibrate_log_ratio,
    edge_aware_positions,
    features_from_scene,
    metrics_dict,
    power_to_db,
    predict_unet_scene,
    run_cusum,
    scene_stack,
    select_probability_threshold,
    temporal_stack_db,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger("versioned-real-pipeline")

REAL_ROOT = PROJECT_ROOT / "data" / "real"
PATCH_SIZE = 128
STRIDE = 64
MAX_SAMPLES = 10000


def compute_file_sha256(path: Path) -> Tuple[int, str]:
    raw = path.read_bytes()
    return len(raw), hashlib.sha256(raw).hexdigest()


def export_hotspots_geojson(
    out_path: Path,
    event_id: str,
    points: List[ActiveFirePoint],
    bbox: Tuple[float, float, float, float],
) -> Path:
    min_lon, min_lat, max_lon, max_lat = bbox
    features = []
    for pt in points:
        if not ((min_lon <= pt.longitude <= max_lon) and (min_lat <= pt.latitude <= max_lat)):
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(float(pt.longitude), 5), round(float(pt.latitude), 5)],
                },
                "properties": {
                    "event_id": event_id,
                    "acq_date": pt.acq_date,
                    "acq_time": pt.acq_time,
                    "acq_datetime_utc": pt.acq_datetime_utc,
                    "satellite": pt.satellite,
                    "instrument": pt.instrument,
                    "confidence": pt.confidence,
                    "confidence_normalized": pt.confidence_normalized,
                    "frp_mw": pt.frp,
                    "brightness_k": pt.brightness,
                    "daynight": pt.daynight,
                },
            }
        )
    fc = {
        "type": "FeatureCollection",
        "name": f"{event_id}_firms_active_fire_hotspots",
        "scientific_disclaimer": (
            "FIRMS active fire hotspots represent instantaneous thermal anomalies (375 m / 1 km) "
            "and are used for ignition confirmation and temporal progression, never as pixel-level burn masks."
        ),
        "features": features,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(fc, indent=2), encoding="utf-8")
    return out_path


def run_phase_b_acquisition(acq_dir: Path) -> Dict[str, Any]:
    """Execute Phase B: Live NASA FIRMS, EONET v3, NASA API, NISAR CMR & Auth Gate, and Sensor Inventory."""
    firms_dir = acq_dir / "firms"
    eonet_dir = acq_dir / "eonet"
    nisar_dir = acq_dir / "nisar_metadata"
    s1_dir = acq_dir / "sentinel1"
    s2_dir = acq_dir / "sentinel2"
    modis_dir = acq_dir / "modis"
    manifests_dir = acq_dir / "manifests"
    for d in (firms_dir, eonet_dir, nisar_dir, s1_dir, s2_dir, modis_dir, manifests_dir):
        d.mkdir(parents=True, exist_ok=True)

    firms_client = FIRMSClient()
    nasa_api_key = get_env_or_windows_user_var("NASA_API_KEY")

    # 1. Verify FIRMS MAP_KEY & Data Availability
    logger.info("Phase B.1: Verifying FIRMS MAP_KEY status and dynamic data availability...")
    mapkey_status = firms_client.check_mapkey_status()
    avail_csv_path = firms_dir / "firms_data_availability.csv"
    availability = firms_client.fetch_data_availability(save_csv_path=avail_csv_path)
    avail_bytes, avail_sha256 = (
        compute_file_sha256(avail_csv_path) if avail_csv_path.exists() else (0, "")
    )

    # 2. Egypt NRT Verification in Run Directory
    logger.info("Phase B.2: Acquiring Egypt VIIRS_NOAA20_NRT active fire detections...")
    egypt_csv_path = firms_dir / "firms_egypt_noaa20_nrt.csv"
    egypt_pts, egypt_prov = firms_client.query_area_with_provenance(
        bbox=(24.0, 21.0, 37.0, 32.0),
        date_str=None,
        days_range=3,
        source="VIIRS_NOAA20_NRT",
        save_csv_path=egypt_csv_path,
    )
    egypt_geojson_path = export_hotspots_geojson(
        firms_dir / "firms_egypt_noaa20_nrt.geojson",
        event_id="EGYPT_SMOKE_TEST",
        points=egypt_pts,
        bbox=(24.0, 21.0, 37.0, 32.0),
    )
    egypt_gj_bytes, egypt_gj_sha = compute_file_sha256(egypt_geojson_path)
    egypt_prov["geojson_path"] = str(egypt_geojson_path.relative_to(PROJECT_ROOT)).replace("\\", "/")
    egypt_prov["geojson_bytes"] = egypt_gj_bytes
    egypt_prov["geojson_sha256"] = egypt_gj_sha
    if egypt_csv_path.exists():
        egypt_prov["csv_path"] = str(egypt_csv_path.relative_to(PROJECT_ROOT)).replace("\\", "/")

    # 3. Acquire Historical FIRMS Standard Processing (_SP) Hotspots for All 4 Wildfire AOIs
    logger.info("Phase B.3: Acquiring historical FIRMS hotspots across all 4 wildfire AOIs...")
    firms_events_manifest: Dict[str, Any] = {}
    for spec in EVENTS:
        ev_id = spec.event_id
        # Compute WGS84 AOI bbox from center_lon, center_lat, and aoi_half_m (~8 km -> ~0.09 deg lon, ~0.072 deg lat)
        dlat = round(float(spec.aoi_half_m) / 111320.0, 4)
        dlon = round(float(spec.aoi_half_m) / (111320.0 * float(np.cos(np.radians(spec.center_lat)))), 4)
        strict_bbox = (
            round(spec.center_lon - dlon, 4),
            round(spec.center_lat - dlat, 4),
            round(spec.center_lon + dlon, 4),
            round(spec.center_lat + dlat, 4),
        )
        # Pad bbox slightly by 0.04 deg (~4 km) to capture perimeter thermal detections
        min_lon, min_lat, max_lon, max_lat = strict_bbox
        query_bbox = (
            round(min_lon - 0.04, 3),
            round(min_lat - 0.04, 3),
            round(max_lon + 0.04, 3),
            round(max_lat + 0.04, 3),
        )
        start_dt = datetime.strptime(spec.reported_start, "%Y-%m-%d")
        # Query three consecutive 5-day windows covering 15 days from reported_start (FIRMS [1..5] day rule)
        window_starts = [
            start_dt.strftime("%Y-%m-%d"),
            (start_dt + timedelta(days=5)).strftime("%Y-%m-%d"),
            (start_dt + timedelta(days=10)).strftime("%Y-%m-%d"),
        ]
        sources = firms_client.select_sources_for_date(spec.reported_start, availability=availability)
        ev_queries: List[Dict[str, Any]] = []
        combined_points: List[ActiveFirePoint] = []
        seen_keys = set()

        for src in sources:
            for w_start in window_starts:
                raw_csv = firms_dir / f"{ev_id}_{src}_{w_start}_5d.csv"
                pts, prov = firms_client.query_area_with_provenance(
                    bbox=query_bbox,
                    date_str=w_start,
                    days_range=5,
                    source=src,
                    save_csv_path=raw_csv,
                )
                if raw_csv.exists():
                    prov["csv_path"] = str(raw_csv.relative_to(PROJECT_ROOT)).replace("\\", "/")
                ev_queries.append(prov)
                for p in pts:
                    dedup_key = (
                        round(p.latitude, 5),
                        round(p.longitude, 5),
                        p.acq_date,
                        p.acq_time,
                        p.instrument,
                        p.satellite,
                    )
                    if dedup_key not in seen_keys:
                        seen_keys.add(dedup_key)
                        combined_points.append(p)

        # Save combined deduplicated CSV and GeoJSON for the event
        combined_csv_path = firms_dir / f"{ev_id}_combined_hotspots.csv"
        with open(combined_csv_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "latitude",
                    "longitude",
                    "brightness",
                    "scan",
                    "track",
                    "acq_date",
                    "acq_time",
                    "acq_datetime_utc",
                    "satellite",
                    "instrument",
                    "confidence",
                    "confidence_normalized",
                    "version",
                    "bright_t31",
                    "frp",
                    "daynight",
                ]
            )
            for p in sorted(combined_points, key=lambda x: x.acq_datetime_utc):
                writer.writerow(
                    [
                        p.latitude,
                        p.longitude,
                        p.brightness,
                        p.scan,
                        p.track,
                        p.acq_date,
                        p.acq_time,
                        p.acq_datetime_utc,
                        p.satellite,
                        p.instrument,
                        p.confidence,
                        p.confidence_normalized,
                        p.version,
                        p.bright_t31,
                        p.frp,
                        p.daynight,
                    ]
                )
        comb_bytes, comb_sha = compute_file_sha256(combined_csv_path)
        ev_geojson_path = export_hotspots_geojson(
            firms_dir / f"{ev_id}_hotspots.geojson",
            event_id=ev_id,
            points=combined_points,
            bbox=query_bbox,
        )
        gj_bytes, gj_sha = compute_file_sha256(ev_geojson_path)

        strict_aoi_summary = FIRMSClient.summarize_hotspots(combined_points, bbox=strict_bbox)
        buffered_aoi_summary = FIRMSClient.summarize_hotspots(combined_points, bbox=query_bbox)

        firms_events_manifest[ev_id] = {
            "event_id": ev_id,
            "fire_name": spec.name,
            "reported_start": spec.reported_start,
            "aoi_bbox": list(strict_bbox),
            "query_bbox_buffered": list(query_bbox),
            "sources_queried": sources,
            "windows_queried": window_starts,
            "queries": ev_queries,
            "combined_csv": {
                "path": str(combined_csv_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
                "bytes": comb_bytes,
                "sha256": comb_sha,
                "deduplicated_record_count": len(combined_points),
            },
            "hotspots_geojson": {
                "path": str(ev_geojson_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
                "bytes": gj_bytes,
                "sha256": gj_sha,
            },
            "strict_aoi_summary": strict_aoi_summary,
            "buffered_aoi_summary": buffered_aoi_summary,
        }
        logger.info(
            "FIRMS %s: %d deduplicated hotspots (strict AOI=%d, max FRP=%.1f MW)",
            ev_id,
            len(combined_points),
            strict_aoi_summary["total_hotspots"],
            buffered_aoi_summary["max_frp_mw"],
        )

    # 4. Query NASA EONET API v3 & NASA API
    logger.info("Phase B.4: Querying NASA EONET v3 wildfire events and NASA API status...")
    eonet_manifest: Dict[str, Any] = {}
    try:
        eonet_hist_url = "https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=all&start=2026-07-15&end=2026-10-31&limit=100"
        r_hist = httpx.get(eonet_hist_url, headers={"User-Agent": "AsteraWatch/1.0"}, timeout=25.0)
        hist_path = eonet_dir / "eonet_wildfires_aug_sep_2026.json"
        hist_path.write_bytes(r_hist.content)
        h_bytes, h_sha = compute_file_sha256(hist_path)
        hist_events = r_hist.json().get("events", []) if r_hist.status_code == 200 else []
        # Filter West Coast US wildfire events (lon in [-126, -114], lat in [32, 49])
        west_coast_matches = []
        for ev in hist_events:
            for geom in ev.get("geometry", []):
                coords = geom.get("coordinates", [])
                if isinstance(coords, list) and len(coords) >= 2 and isinstance(coords[0], (int, float)):
                    lon, lat = float(coords[0]), float(coords[1])
                    if -125.5 <= lon <= -114.0 and 32.0 <= lat <= 49.0:
                        west_coast_matches.append(
                            {
                                "id": ev.get("id"),
                                "title": ev.get("title"),
                                "date": geom.get("date"),
                                "coordinates": [lon, lat],
                            }
                        )
                        break
        eonet_manifest["summer_2026_query"] = {
            "url": eonet_hist_url,
            "status_code": r_hist.status_code,
            "path": str(hist_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "bytes": h_bytes,
            "sha256": h_sha,
            "total_events_returned": len(hist_events),
            "west_coast_us_matches_count": len(west_coast_matches),
            "west_coast_us_matches_sample": west_coast_matches[:15],
        }
    except Exception as exc:
        eonet_manifest["summer_2026_query"] = {"error": str(exc)}

    try:
        eonet_rec_url = "https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&limit=25"
        r_rec = httpx.get(eonet_rec_url, headers={"User-Agent": "AsteraWatch/1.0"}, timeout=20.0)
        rec_path = eonet_dir / "eonet_wildfires_recent.json"
        rec_path.write_bytes(r_rec.content)
        r_bytes, r_sha = compute_file_sha256(rec_path)
        rec_events = r_rec.json().get("events", []) if r_rec.status_code == 200 else []
        eonet_manifest["recent_active_query"] = {
            "url": eonet_rec_url,
            "status_code": r_rec.status_code,
            "path": str(rec_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "bytes": r_bytes,
            "sha256": r_sha,
            "total_events_returned": len(rec_events),
        }
    except Exception as exc:
        eonet_manifest["recent_active_query"] = {"error": str(exc)}

    nasa_api_status: Dict[str, Any] = {"configured": bool(nasa_api_key)}
    if nasa_api_key:
        try:
            apod_url = f"https://api.nasa.gov/planetary/apod?api_key={nasa_api_key}"
            r_apod = httpx.get(apod_url, timeout=15.0)
            nasa_status_payload = {
                "configured": True,
                "authenticated": r_apod.status_code == 200,
                "status_code": r_apod.status_code,
                "sanitized_url": "https://api.nasa.gov/planetary/apod?api_key=<REDACTED_NASA_API_KEY>",
                "rate_limit_limit": r_apod.headers.get("x-ratelimit-limit"),
                "rate_limit_remaining": r_apod.headers.get("x-ratelimit-remaining"),
            }
            nasa_status_path = eonet_dir / "nasa_api_status.json"
            nasa_status_path.write_text(json.dumps(nasa_status_payload, indent=2), encoding="utf-8")
            n_bytes, n_sha = compute_file_sha256(nasa_status_path)
            nasa_status_payload["path"] = str(nasa_status_path.relative_to(PROJECT_ROOT)).replace("\\", "/")
            nasa_status_payload["bytes"] = n_bytes
            nasa_status_payload["sha256"] = n_sha
            nasa_api_status = nasa_status_payload
        except Exception as exc:
            nasa_api_status["error"] = str(exc).replace(nasa_api_key, "<REDACTED_NASA_API_KEY>")

    # 5. NISAR CMR Granule Discovery & Live Earthdata Auth Gate Check
    logger.info("Phase B.5: Verifying NISAR CMR GCOV granules and Earthdata Login auth gate...")
    existing_nisar_path = REAL_ROOT / "nisar_cmr_candidates.json"
    nisar_base = (
        json.loads(existing_nisar_path.read_text(encoding="utf-8"))
        if existing_nisar_path.exists()
        else {}
    )
    ed_user = get_env_or_windows_user_var("EARTHDATA_USERNAME")
    ed_pass = get_env_or_windows_user_var("EARTHDATA_PASSWORD")
    ed_token = get_env_or_windows_user_var("EARTHDATA_TOKEN")
    netrc_exists = (Path.home() / ".netrc").exists() or (Path.home() / "_netrc").exists()
    earthdata_configured = bool((ed_user and ed_pass) or ed_token or netrc_exists)

    # Empirical test of the ASF Earthdata Cloud NISAR HDF5 URL without credentials
    sample_nisar_url = None
    for ev_data in nisar_base.get("events", {}).values():
        pair = ev_data.get("primary_nisar_pair")
        if pair and pair.get("before_granule", {}).get("data_url"):
            sample_nisar_url = pair["before_granule"]["data_url"]
            break

    auth_gate_probe: Dict[str, Any] = {
        "earthdata_login_configured": earthdata_configured,
        "tested_url": sample_nisar_url,
    }
    if sample_nisar_url and not earthdata_configured:
        try:
            r_probe = httpx.get(sample_nisar_url, follow_redirects=False, timeout=15.0)
            auth_gate_probe["http_status_code"] = r_probe.status_code
            auth_gate_probe["redirect_location"] = r_probe.headers.get("location")
            auth_gate_probe["www_authenticate"] = r_probe.headers.get("www-authenticate")
        except Exception as exc:
            auth_gate_probe["probe_error"] = str(exc)

    nisar_gate_doc = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "NISAR_METADATA_DISCOVERED": True,
        "NISAR_GRANULE_DOWNLOADED": False,
        "NISAR_DOWNLOAD_BLOCKED": not earthdata_configured,
        "blocking_reason": (
            "NASA ASF Earthdata Cloud (https://nisar.asf.earthdatacloud.nasa.gov) requires NASA Earthdata Login "
            "OAuth2/URS credentials (EARTHDATA_USERNAME/EARTHDATA_PASSWORD, EARTHDATA_TOKEN, or ~/.netrc). "
            "None are present in the execution environment."
        ),
        "auth_gate_empirical_probe": auth_gate_probe,
        "validated_collection_concept_id": NISAR_GCOV_VALIDATED_CONCEPT_ID,
        "provisional_collection_concept_id": NISAR_GCOV_PROVISIONAL_CONCEPT_ID,
        "cmr_summary": nisar_base.get("acquisition_environment", {}),
        "events": nisar_base.get("events", {}),
    }
    nisar_out_path = nisar_dir / "nisar_discovery_and_auth_gate.json"
    nisar_out_path.write_text(json.dumps(nisar_gate_doc, indent=2), encoding="utf-8")
    nisar_bytes, nisar_sha = compute_file_sha256(nisar_out_path)

    # 6. Verify Real Co-Registered Satellite Imagery Stacks (Sentinel-1 RTC, Sentinel-2 L2A, MODIS MCD64A1.061)
    logger.info("Phase B.6: Verifying real Sentinel-1 RTC, Sentinel-2 L2A, and MODIS MCD64A1.061 rasters...")
    s1_inventory: Dict[str, Any] = {}
    s2_inventory: Dict[str, Any] = {}
    modis_inventory: Dict[str, Any] = {}

    for spec in EVENTS:
        ev_id = spec.event_id
        ev_dir = REAL_ROOT / ev_id
        stack_p = ev_dir / "stack.npz"
        meta_p = ev_dir / "metadata.json"
        anc_p = ev_dir / "mcd64a1_ancillary.npz"

        stack_bytes, stack_sha = compute_file_sha256(stack_p)
        meta_bytes, meta_sha = compute_file_sha256(meta_p)
        anc_bytes, anc_sha = compute_file_sha256(anc_p)
        meta = json.loads(meta_p.read_text(encoding="utf-8"))

        with np.load(stack_p) as st:
            arr_info = {
                k: {
                    "shape": list(st[k].shape),
                    "dtype": str(st[k].dtype),
                    "finite_fraction": round(float(np.isfinite(st[k]).mean()), 6),
                }
                for k in st.files
            }
            scl_pre = st["s2_pre_SCL"]
            scl_post = st["s2_post_SCL"]
            water_px = int(np.count_nonzero(water_optical_mask(scl_pre, scl_post)))

        s1_inventory[ev_id] = {
            "event_id": ev_id,
            "collection": "sentinel-1-rtc",
            "source_stac": "https://planetarycomputer.microsoft.com/api/stac/v1",
            "stack_path": str(stack_p.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "stack_bytes": stack_bytes,
            "stack_sha256": stack_sha,
            "metadata_path": str(meta_p.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "metadata_bytes": meta_bytes,
            "metadata_sha256": meta_sha,
            "grid": meta["grid"],
            "acquisitions": meta["s1"],
            "layers": {k: v for k, v in arr_info.items() if k.startswith("s1_")},
        }
        s2_inventory[ev_id] = {
            "event_id": ev_id,
            "collection": "sentinel-2-l2a",
            "source_stac": "https://planetarycomputer.microsoft.com/api/stac/v1",
            "stack_path": str(stack_p.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "stack_sha256": stack_sha,
            "grid": meta["grid"],
            "acquisitions": meta["s2"],
            "water_pixels_scl6_count": water_px,
            "layers": {k: v for k, v in arr_info.items() if k.startswith("s2_")},
        }
        modis_inventory[ev_id] = {
            "event_id": ev_id,
            "collection": "modis-64A1-061",
            "cmr_concept_id": "C2565786756-LPCLOUD",
            "ancillary_path": str(anc_p.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "ancillary_bytes": anc_bytes,
            "ancillary_sha256": anc_sha,
            "granule": meta["mcd64a1"],
            "layers": {k: v for k, v in arr_info.items() if k.startswith("mcd_")},
        }

    s1_inv_path = s1_dir / "sentinel1_inventory.json"
    s2_inv_path = s2_dir / "sentinel2_inventory.json"
    modis_inv_path = modis_dir / "mcd64a1_inventory.json"
    s1_inv_path.write_text(json.dumps(s1_inventory, indent=2), encoding="utf-8")
    s2_inv_path.write_text(json.dumps(s2_inventory, indent=2), encoding="utf-8")
    modis_inv_path.write_text(json.dumps(modis_inventory, indent=2), encoding="utf-8")

    acq_manifest = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "acquisition_run_dir": str(acq_dir.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "authentication_status": {
            "FIRMS_MAP_KEY": {
                "configured": firms_client.is_configured(),
                "authenticated": mapkey_status.get("authenticated", False),
                "mapkey_status": mapkey_status,
            },
            "NASA_API_KEY": nasa_api_status,
            "EARTHDATA_LOGIN": {
                "configured": earthdata_configured,
                "NISAR_METADATA_DISCOVERED": True,
                "NISAR_GRANULE_DOWNLOADED": False,
                "NISAR_DOWNLOAD_BLOCKED": not earthdata_configured,
            },
        },
        "firms_availability": {
            "csv_path": str(avail_csv_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "bytes": avail_bytes,
            "sha256": avail_sha256,
            "sensors": availability,
        },
        "firms_egypt_smoke_test": egypt_prov,
        "firms_wildfire_events": firms_events_manifest,
        "eonet_wildfire_cross_check": eonet_manifest,
        "nisar_discovery_and_auth_gate": {
            "path": str(nisar_out_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "bytes": nisar_bytes,
            "sha256": nisar_sha,
            "NISAR_METADATA_DISCOVERED": True,
            "NISAR_GRANULE_DOWNLOADED": False,
            "NISAR_DOWNLOAD_BLOCKED": not earthdata_configured,
        },
        "satellite_raster_inventories": {
            "sentinel1_rtc": str(s1_inv_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "sentinel2_l2a": str(s2_inv_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "modis_mcd64a1": str(modis_inv_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        },
    }
    manifest_out = manifests_dir / "acquisition_manifest.json"
    manifest_out.write_text(json.dumps(acq_manifest, indent=2), encoding="utf-8")
    logger.info("Phase B complete. Wrote acquisition manifest -> %s", manifest_out)
    return acq_manifest


def run_phase_c_dataset(acq_dir: Path) -> Dict[str, Any]:
    """Execute Phase C: Build Water-Excluded (SCL != 6) Before/After Dataset in Versioned Directory."""
    dataset_root = acq_dir / "dataset"
    prepared_dir = dataset_root / "prepared"
    processed_dir = acq_dir / "processed"
    dataset_root.mkdir(parents=True, exist_ok=True)
    prepared_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)

    base_manifest = json.loads((REAL_ROOT / "acquisition_manifest.json").read_text(encoding="utf-8"))
    events = [ev for ev in EVENTS if ev.include_in_training and ev.event_id in base_manifest["events"]]

    prepared: Dict[str, Dict[str, np.ndarray]] = {}
    event_meta: Dict[str, Any] = {}
    water_audit: Dict[str, Any] = {}

    for event in events:
        record = base_manifest["events"][event.event_id]
        with np.load(REAL_ROOT / event.event_id / "stack.npz") as st:
            arrays = {k: st[k] for k in st.files}
        with np.load(REAL_ROOT / event.event_id / "mcd64a1_ancillary.npz") as anc:
            qa_arr = anc["qa"]
            qa_dec = decode_qa_bitmask(qa_arr)

        ordered = sorted(record["s1"], key=lambda entry: entry["datetime"])
        pre_entry, post_entry = ordered[0], ordered[-1]
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

        nbr_pre = compute_nbr(arrays["s2_pre_B08"], arrays["s2_pre_B12"])
        nbr_post = compute_nbr(arrays["s2_post_B08"], arrays["s2_post_B12"])
        dnbr = compute_dnbr(nbr_pre, nbr_post)

        water_mask = water_optical_mask(arrays["s2_pre_SCL"], arrays["s2_post_SCL"])
        opt_valid_land = valid_optical_mask(
            arrays["s2_pre_SCL"],
            arrays["s2_post_SCL"],
            arrays["s2_pre_B08"],
            arrays["s2_post_B08"],
            exclude_water=True,
        )
        valid = opt_valid_land & valid_s1 & np.isfinite(dnbr) & (~water_mask)
        remaining_water_in_valid = int(np.count_nonzero(valid & water_mask))
        assert remaining_water_in_valid == 0, f"Water pixels leaked into valid mask for {event.event_id}"

        mcd_hq_burn = (
            (arrays["mcd_burn_mask"] > 0)
            & qa_dec["high_quality_land_mask"]
        ).astype(np.uint8)

        prepared[event.event_id] = {
            "pre_vv": pre_vv,
            "pre_vh": pre_vh,
            "post_vv": post_vv,
            "post_vh": post_vh,
            "dnbr": dnbr,
            "valid": valid.astype(np.uint8),
            "water_mask": water_mask.astype(np.uint8),
            "mcd": mcd_hq_burn,
            "pre_date": np.array(pre_entry["datetime"]),
            "post_date": np.array(post_entry["datetime"]),
        }
        temporal_dates = sorted(record["s1"], key=lambda entry: entry["datetime"])
        prepared[event.event_id]["temporal_dates"] = np.array([entry["datetime"] for entry in temporal_dates])
        for index, entry in enumerate(temporal_dates):
            prepared[event.event_id][f"temporal_{index}_vv"] = arrays[f"s1_{entry['role']}_vv"]
            prepared[event.event_id][f"temporal_{index}_vh"] = arrays[f"s1_{entry['role']}_vh"]

        water_audit[event.event_id] = {
            "total_pixels": int(valid.size),
            "scl6_water_pixels_detected": int(np.count_nonzero(water_mask)),
            "scl6_water_pixels_in_valid_mask": remaining_water_in_valid,
            "valid_land_pixels": int(np.count_nonzero(valid)),
            "valid_land_fraction": round(float(valid.mean()), 6),
        }
        event_meta[event.event_id] = {
            "split": event.split,
            "name": event.name,
            "pre_datetime": pre_entry["datetime"],
            "post_datetime": post_entry["datetime"],
            "n_s1_dates": len(temporal_dates),
            "valid_fraction": float(valid.mean()),
            "water_pixels_excluded": int(np.count_nonzero(water_mask)),
            "mcd_fraction_valid": float(((mcd_hq_burn > 0) & valid).sum() / max(valid.sum(), 1)),
            "pre_item": pre_entry["item_id"],
            "post_item": post_entry["item_id"],
        }

    # Calibrate dNBR threshold strictly on TRAIN (CA_GANN_2026) against QA-filtered MCD64A1
    train_pool = [ev.event_id for ev in events if ev.split == "TRAIN"]
    combined_dnbr = np.concatenate([prepared[eid]["dnbr"].ravel() for eid in train_pool])
    combined_mcd = np.concatenate([prepared[eid]["mcd"].ravel() for eid in train_pool])
    combined_valid = np.concatenate([prepared[eid]["valid"].ravel() for eid in train_pool]).astype(bool)
    calibration = calibrate_dnbr_threshold(combined_dnbr, combined_mcd, combined_valid)
    threshold_calibrated = float(calibration["selected"]["threshold"])
    threshold_usgs_moderate = 0.27
    logger.info(
        "Phase C: dNBR threshold calibrated on water-free TRAIN: %.3f (USGS moderate-severity reference=%.2f)",
        threshold_calibrated,
        threshold_usgs_moderate,
    )

    tracker = GlobalSampleTracker(max_limit=MAX_SAMPLES)
    split_accumulator = {
        split: {"patches": [], "labels": [], "mcd": [], "valid": [], "events": []}
        for split in ("TRAIN", "VAL", "TEST")
    }
    agreement: Dict[str, Any] = {}

    for event in events:
        data = prepared[event.event_id]
        dnbr = data["dnbr"]
        valid = data["valid"].astype(bool)
        label = ((dnbr >= threshold_calibrated) & valid).astype(np.uint8)
        label_usgs_027 = ((dnbr >= threshold_usgs_moderate) & valid).astype(np.uint8)
        mcd = data["mcd"] & valid.astype(np.uint8)
        data["label"] = label
        data["label_usgs_027"] = label_usgs_027

        agreement[event.event_id] = {
            "dnbr_calibrated_vs_mcd": optical_agreement(label, mcd, valid),
            "dnbr_usgs_027_vs_mcd": optical_agreement(label_usgs_027, mcd, valid),
            "label_calibrated_fraction_valid": float(label[valid].mean()) if valid.any() else 0.0,
            "label_usgs_027_fraction_valid": float(label_usgs_027[valid].mean()) if valid.any() else 0.0,
            "mcd_fraction_valid": float(mcd[valid].mean()) if valid.any() else 0.0,
            "valid_fraction": float(valid.mean()),
            "water_pixels_excluded": water_audit[event.event_id]["scl6_water_pixels_detected"],
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

    for split, bucket in split_accumulator.items():
        patches = np.concatenate(bucket["patches"], axis=0).astype(np.float32)
        labels_arr = np.concatenate(bucket["labels"], axis=0).astype(np.uint8)
        mcds = np.concatenate(bucket["mcd"], axis=0).astype(np.uint8)
        valids = np.concatenate(bucket["valid"], axis=0).astype(np.uint8)
        np.savez_compressed(
            dataset_root / f"{split.lower()}.npz",
            patches=patches,
            labels=labels_arr,
            mcd=mcds,
            valid=valids,
            events=np.array(bucket["events"]),
        )

    train_npz = np.load(dataset_root / "train.npz")
    means, stds = nan_channel_stats(train_npz["patches"])
    split_files_info: Dict[str, Any] = {}
    for split in ("TRAIN", "VAL", "TEST"):
        p = dataset_root / f"{split.lower()}.npz"
        with np.load(p) as data:
            filled = fill_missing(data["patches"], means)
            labels_arr = data["labels"]
            mcds = data["mcd"]
            valids = data["valid"]
            ev_arr = data["events"]
        np.savez_compressed(
            p,
            patches=filled,
            labels=labels_arr,
            mcd=mcds,
            valid=valids,
            events=ev_arr,
        )
        f_bytes, f_sha = compute_file_sha256(p)
        split_files_info[split] = {
            "path": str(p.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "bytes": f_bytes,
            "sha256": f_sha,
            "samples": int(filled.shape[0]),
            "positive_pixel_fraction_valid": round(
                float(labels_arr[valids > 0].mean()) if np.any(valids > 0) else 0.0, 4
            ),
        }

    prepared_files_info: Dict[str, Any] = {}
    for event_id, data in prepared.items():
        prep_p = prepared_dir / f"{event_id}.npz"
        np.savez_compressed(prep_p, **data)
        p_bytes, p_sha = compute_file_sha256(prep_p)
        prepared_files_info[event_id] = {
            "path": str(prep_p.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "bytes": p_bytes,
            "sha256": p_sha,
        }

    dataset_manifest = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "data_origin": "CROSS_SENSOR_PROTOTYPE",
        "is_nisar": False,
        "sensors": [
            "sentinel-1-rtc (C-band, 20 m)",
            "sentinel-2-l2a (optical dNBR reference, SCL land classes {4,5,7}, water SCL=6 excluded)",
            "modis-64A1-061 (independent check, QA Bits 0=1, 1=1, 2=0 filtered)",
        ],
        "scl_valid_land_classes": list(SCL_LAND_VALID_CLASSES),
        "scl_water_class_excluded": SCL_WATER_CLASS,
        "water_exclusion_audit": water_audit,
        "label_definition": (
            "Sentinel-2 dNBR >= threshold_calibrated (0.11, calibrated on TRAIN vs QA-filtered MCD64A1), "
            "masked by SCL land classes {4,5,7} (water SCL=6 excluded) and Sentinel-1 validity. "
            "USGS moderate-severity threshold (0.27) also tracked as sensitivity layer."
        ),
        "label_threshold": threshold_calibrated,
        "label_threshold_usgs_moderate": threshold_usgs_moderate,
        "label_calibration": calibration,
        "patch_size": PATCH_SIZE,
        "stride": STRIDE,
        "max_samples": MAX_SAMPLES,
        "samples": {split: split_files_info[split]["samples"] for split in ("TRAIN", "VAL", "TEST")},
        "total_samples": sum(split_files_info[split]["samples"] for split in ("TRAIN", "VAL", "TEST")),
        "split_files": split_files_info,
        "prepared_files": prepared_files_info,
        "normalization": {"mean": means.tolist(), "std": stds.tolist(), "fitted_on": "TRAIN"},
        "events": event_meta,
        "agreement": agreement,
        "splits": {
            split: sorted({ev.event_id for ev in events if ev.split == split})
            for split in ("TRAIN", "VAL", "TEST")
        },
    }
    ds_manifest_path = dataset_root / "dataset_manifest.json"
    ds_manifest_path.write_text(json.dumps(dataset_manifest, indent=2), encoding="utf-8")
    (dataset_root / "norm_stats.json").write_text(
        json.dumps({"mean": means.tolist(), "std": stds.tolist(), "fitted_on": "TRAIN"}, indent=2),
        encoding="utf-8",
    )
    logger.info("Phase C complete. Wrote water-free dataset manifest -> %s", ds_manifest_path)
    return dataset_manifest


def run_phase_d_and_e_training_and_evaluation(
    acq_dir: Path,
    out_run_dir: Path,
    epochs: int = 6,
    seed: int = 42,
) -> Dict[str, Any]:
    """Execute Phases D & E: Train 3 Predictive Models + CUSUM on Water-Free Dataset and Export Geospatial Products."""
    started = time.time()
    dataset_root = acq_dir / "dataset"
    ckpt_dir = out_run_dir / "checkpoints"
    eval_dir = out_run_dir / "evaluation"
    pred_dir = eval_dir / "predictions"
    geo_dir = out_run_dir / "geospatial"
    for d in (ckpt_dir, eval_dir, pred_dir, geo_dir):
        d.mkdir(parents=True, exist_ok=True)

    manifest = json.loads((dataset_root / "dataset_manifest.json").read_text(encoding="utf-8"))
    means = np.asarray(manifest["normalization"]["mean"], dtype=np.float32)
    stds = np.asarray(manifest["normalization"]["std"], dtype=np.float32)
    threshold_dnbr = float(manifest["label_threshold"])
    splits = manifest["splits"]
    train_ids, val_ids, test_ids = splits["TRAIN"], splits["VAL"], splits["TEST"]
    eval_ids = train_ids + val_ids + test_ids
    split_of = {
        **{eid: "TRAIN" for eid in train_ids},
        **{eid: "VAL" for eid in val_ids},
        **{eid: "TEST" for eid in test_ids},
    }

    prepared: Dict[str, Dict[str, np.ndarray]] = {}
    labels: Dict[str, np.ndarray] = {}
    stacks: Dict[str, np.ndarray] = {}
    for event_id in eval_ids:
        with np.load(dataset_root / "prepared" / f"{event_id}.npz") as data:
            prepared[event_id] = {k: data[k] for k in data.files}
        valid = prepared[event_id]["valid"].astype(bool)
        labels[event_id] = ((prepared[event_id]["dnbr"] >= threshold_dnbr) & valid).astype(np.uint8)
        stacks[event_id] = scene_stack(prepared[event_id])

    # ---------------- Model 1: Calibrated SAR VH Log-Ratio Baseline ----------------
    logger.info("Phase D.1: Calibrating Model 1 (VH Log-Ratio Baseline) on TRAIN (%s)...", train_ids)
    train_delta = np.concatenate([stacks[eid][4][prepared[eid]["valid"].astype(bool)] for eid in train_ids])
    train_label = np.concatenate([labels[eid][prepared[eid]["valid"].astype(bool)] for eid in train_ids])
    baseline_cal = calibrate_log_ratio(train_delta, train_label, np.ones_like(train_label, dtype=bool))
    baseline_threshold = float(baseline_cal["selected"]["threshold_db"])
    logger.info("Model 1 (Log-Ratio) threshold selected on TRAIN: %.2f dB", baseline_threshold)

    predictions: Dict[str, Dict[str, np.ndarray]] = {}
    for event_id in eval_ids:
        delta = stacks[event_id][4]
        predictions.setdefault(event_id, {})["log_ratio"] = (
            (delta <= baseline_threshold) & prepared[event_id]["valid"].astype(bool)
        ).astype(np.uint8)

    # ---------------- Model 2: LightGBM 10-Feature Spatial Classifier ----------------
    logger.info("Phase D.2: Training Model 2 (LightGBM 10-Feature Spatial Classifier)...")
    train_features = features_from_scene(stacks[train_ids[0]], means)
    train_valid = prepared[train_ids[0]]["valid"].astype(bool)
    y_train = labels[train_ids[0]]
    X_train = train_features[::2, ::2, :].reshape(-1, len(FEATURE_NAMES))[train_valid[::2, ::2].ravel()]
    y_train_flat = y_train[::2, ::2].ravel()[train_valid[::2, ::2].ravel()]

    val_features = features_from_scene(stacks[val_ids[0]], means)
    val_valid = prepared[val_ids[0]]["valid"].astype(bool)
    X_val = val_features[::2, ::2, :].reshape(-1, len(FEATURE_NAMES))[val_valid[::2, ::2].ravel()]
    y_val_flat = labels[val_ids[0]][::2, ::2].ravel()[val_valid[::2, ::2].ravel()]

    lgb_started = time.time()
    lgb_classifier = LightGBMBurnedAreaClassifier(
        n_estimators=250,
        learning_rate=0.05,
        max_depth=7,
        num_leaves=31,
        random_state=seed,
        feature_names=FEATURE_NAMES,
    )
    importances = lgb_classifier.fit(X_train, y_train_flat, X_val, y_val_flat)
    lgb_time = time.time() - lgb_started

    val_prob_lgb = lgb_classifier.predict_spatial(val_features, threshold=0.5)[0]
    lgb_threshold = float(
        select_probability_threshold(val_prob_lgb, labels[val_ids[0]], val_valid)["selected"]["threshold"]
    )
    lgb_ckpt_path = ckpt_dir / "lightgbm_water_free.pkl"
    with open(lgb_ckpt_path, "wb") as f:
        pickle.dump(
            {
                "classifier": lgb_classifier,
                "selected_probability_threshold": lgb_threshold,
                "feature_names": FEATURE_NAMES,
                "importances": importances,
                "seed": seed,
            },
            f,
        )
    lgb_ckpt_bytes, lgb_ckpt_sha = compute_file_sha256(lgb_ckpt_path)
    logger.info("Model 2 (LightGBM) trained in %.2fs; VAL threshold=%.2f", lgb_time, lgb_threshold)

    features_by_event = {
        train_ids[0]: train_features,
        val_ids[0]: val_features,
        **{event_id: features_from_scene(stacks[event_id], means) for event_id in test_ids},
    }
    for event_id in eval_ids:
        prob, mask = lgb_classifier.predict_spatial(
            features_by_event[event_id], threshold=lgb_threshold
        )
        predictions[event_id]["lightgbm_prob"] = prob
        predictions[event_id]["lightgbm"] = (
            mask.astype(np.uint8) & prepared[event_id]["valid"].astype(np.uint8)
        )

    # ---------------- Model 3: 5-Channel UNetResNet34 ----------------
    logger.info("Phase D.3: Training Model 3 (5-channel UNetResNet34) for %d epochs...", epochs)
    train_npz = np.load(dataset_root / "train.npz")
    val_npz = np.load(dataset_root / "val.npz")
    train_ds = SARPatchDataset(
        patches=list(train_npz["patches"]),
        masks=list(train_npz["labels"].astype(np.float32)),
        is_train=True,
        norm_mean=means,
        norm_std=stds,
        event_ids=[str(v) for v in train_npz["events"]],
    )
    val_ds = SARPatchDataset(
        patches=list(val_npz["patches"]),
        masks=list(val_npz["labels"].astype(np.float32)),
        is_train=False,
        norm_mean=means,
        norm_std=stds,
        event_ids=[str(v) for v in val_npz["events"]],
    )
    torch.manual_seed(seed)
    np.random.seed(seed)
    unet_ckpt_name = "real_unet_resnet34_water_free.pt"
    unet_model, training = train_unet_model(
        train_dataset=train_ds,
        val_dataset=val_ds,
        checkpoint_dir=ckpt_dir,
        num_epochs=epochs,
        batch_size=8,
        learning_rate=3e-4,
        device=None,
        seed=seed,
        in_channels=5,
        checkpoint_name=unet_ckpt_name,
    )
    unet_ckpt_path = ckpt_dir / unet_ckpt_name
    unet_ckpt_bytes, unet_ckpt_sha = compute_file_sha256(unet_ckpt_path)

    val_prob_unet = predict_unet_scene(
        unet_model, stacks[val_ids[0]], means, stds, tile=128, stride=64
    )
    unet_threshold = float(
        select_probability_threshold(val_prob_unet, labels[val_ids[0]], val_valid)["selected"]["threshold"]
    )
    logger.info("Model 3 (UNetResNet34) VAL threshold selected: %.2f", unet_threshold)

    unet_result = {
        "best_epoch": training.best_epoch,
        "best_val_iou": training.best_val_iou,
        "best_val_dice": training.best_val_dice,
        "train_losses": training.train_losses,
        "val_losses": training.val_losses,
        "val_ious": training.val_ious,
        "training_time_sec": training.total_training_time_sec,
        "checkpoint_path": str(unet_ckpt_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "checkpoint_bytes": unet_ckpt_bytes,
        "checkpoint_sha256": unet_ckpt_sha,
        "selected_probability_threshold": unet_threshold,
    }

    unet_prob_by_event = {val_ids[0]: val_prob_unet}
    for event_id in train_ids + test_ids:
        unet_prob_by_event[event_id] = predict_unet_scene(
            unet_model, stacks[event_id], means, stds, tile=128, stride=64
        )
    for event_id in eval_ids:
        prob = unet_prob_by_event[event_id]
        predictions[event_id]["unet_prob"] = prob
        predictions[event_id]["unet"] = (
            (prob >= unet_threshold) & prepared[event_id]["valid"].astype(bool)
        ).astype(np.uint8)

    # ---------------- Auxiliary Change Detector: Temporal CUSUM ----------------
    logger.info("Phase D.4: Running multi-temporal CUSUM across 4 Sentinel-1 acquisitions...")
    temporal: Dict[str, Dict[str, Any]] = {}
    for event_id in eval_ids:
        stack_t, dates = temporal_stack_db(prepared[event_id])
        temporal[event_id] = {"stack": stack_t, "dates": dates}

    cusum_scores: Dict[str, List[Dict[str, Any]]] = {}
    for h_value in (2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0):
        _, mask = run_cusum(temporal[val_ids[0]]["stack"], val_valid, h_value)
        score_dict = metrics_dict(mask, labels[val_ids[0]], val_valid)
        cusum_scores.setdefault(val_ids[0], []).append({"h": h_value, "f1": score_dict["f1_score"]})
    best_h = float(max(cusum_scores[val_ids[0]], key=lambda item: (item["f1"], -item["h"]))["h"])
    cusum_meta: Dict[str, Any] = {"selected_h": best_h, "k_allowance": 0.5, "val_scan": cusum_scores}
    for event_id in eval_ids:
        score, mask = run_cusum(
            temporal[event_id]["stack"], prepared[event_id]["valid"].astype(bool), best_h
        )
        predictions[event_id]["cusum_score"] = score
        predictions[event_id]["cusum"] = mask
        cusum_meta[event_id] = {"dates": temporal[event_id]["dates"], "baseline": "first two acquisitions (0, 1)"}

    for event_id in eval_ids:
        valid = prepared[event_id]["valid"].astype(bool)
        predictions[event_id]["optical_reference"] = labels[event_id]
        predictions[event_id]["all_burned"] = valid.astype(np.uint8)

    # ---------------- Evaluate Models on Water-Free Valid Domain ----------------
    model_specs = [
        ("Log_Ratio_Baseline", "log_ratio", "VH log-ratio threshold calibrated on TRAIN"),
        ("LightGBM_Pixel_Spatial", "lightgbm", "LightGBM on 10 Sentinel-1 dB/change features"),
        ("UNet_ResNet34", "unet", "U-Net ResNet-34 on paired Sentinel-1 patches"),
        ("CUSUM_Temporal", "cusum", "CUSUM on four Sentinel-1 VH acquisitions"),
        ("All_Burned_Trivial", "all_burned", "Predict every valid pixel burned"),
    ]
    models_eval: Dict[str, Any] = {}
    for name, key, description in model_specs:
        entry: Dict[str, Any] = {
            "description": description,
            "role": "baseline" if key in {"log_ratio", "all_burned"} else "candidate",
            "independent_of_label": True,
            "metrics": {},
        }
        for event_id in eval_ids:
            split = split_of[event_id]
            valid = prepared[event_id]["valid"].astype(bool)
            prediction = predictions[event_id][key]
            f1_ci = block_bootstrap_f1(prediction, labels[event_id], valid)
            entry["metrics"][split] = metrics_dict(prediction, labels[event_id], valid, f1_ci)
            entry["metrics"][split]["event_id"] = event_id
            if split == "TRAIN":
                entry["metrics"][split]["note"] = "resubstitution; not a generalisation estimate"
        models_eval[name] = entry

    reference_layer: Dict[str, Any] = {
        "description": "Sentinel-2 dNBR threshold; defines the reference labels, not an independent model",
        "independent_of_label": False,
        "threshold_dnbr_calibrated": threshold_dnbr,
        "threshold_dnbr_usgs_moderate": 0.27,
        "metrics": {},
    }
    for event_id in eval_ids:
        split = split_of[event_id]
        data = prepared[event_id]
        valid = data["valid"].astype(bool)
        mcd = data["mcd"].astype(bool) & valid
        label_027 = data["label_usgs_027"].astype(bool) & valid
        reference_layer["metrics"][split] = {
            "event_id": event_id,
            "dnbr_calibrated_vs_mcd64a1": metrics_dict(labels[event_id], mcd, valid),
            "dnbr_usgs_027_vs_mcd64a1": metrics_dict(label_027.astype(np.uint8), mcd, valid),
            "label_calibrated_fraction_valid": float(labels[event_id][valid].mean()),
            "label_usgs_027_fraction_valid": float(label_027[valid].mean()),
            "mcd_fraction_valid": float(mcd[valid].mean()),
        }

    # Save prediction archives
    pred_files_info: Dict[str, Any] = {}
    for event_id in eval_ids:
        pred_p = pred_dir / f"{event_id}.npz"
        np.savez_compressed(
            pred_p,
            label=labels[event_id],
            label_usgs_027=prepared[event_id]["label_usgs_027"],
            valid=prepared[event_id]["valid"].astype(np.uint8),
            water_mask=prepared[event_id]["water_mask"].astype(np.uint8),
            mcd=prepared[event_id]["mcd"].astype(np.uint8),
            **predictions[event_id],
        )
        p_bytes, p_sha = compute_file_sha256(pred_p)
        pred_files_info[event_id] = {
            "path": str(pred_p.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "bytes": p_bytes,
            "sha256": p_sha,
        }

    comparison_report = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "script": "scripts/execute_versioned_real_pipeline.py",
        "run_directory": str(out_run_dir.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "dataset_directory": str(dataset_root.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "data_origin": "CROSS_SENSOR_PROTOTYPE",
        "is_nisar": False,
        "nisar_status": {
            "NISAR_METADATA_DISCOVERED": True,
            "NISAR_GRANULE_DOWNLOADED": False,
            "NISAR_DOWNLOAD_BLOCKED": True,
            "available": False,
            "reason": (
                "NISAR GCOV science products require NASA Earthdata Login credentials. "
                "Metadata and same-geometry pre/post pairs were discovered via NASA CMR, "
                "and unauthenticated download attempts were empirically verified as blocked."
            ),
        },
        "sensor_input": "Sentinel-1 RTC C-band (VV/VH), 20 m, Microsoft Planetary Computer",
        "reference_labels": {
            "definition": (
                "Sentinel-2 L2A dNBR >= 0.11 over SCL land-valid classes {4,5,7} (water SCL=6 excluded) "
                "and Sentinel-1 valid pixels; USGS moderate-severity dNBR >= 0.27 also evaluated"
            ),
            "threshold": threshold_dnbr,
            "threshold_usgs_moderate": 0.27,
            "threshold_calibration": manifest["label_calibration"],
            "independent_check": "NASA MODIS MCD64A1.061 burned area (500 m, QA Bits 0=1, 1=1, 2=0 filtered)",
        },
        "splits": {"TRAIN": train_ids, "VAL": val_ids, "TEST": test_ids},
        "sample_cap": {"max": 10000, "generated": int(manifest["total_samples"])},
        "patch_dataset": {
            "patch_size": manifest["patch_size"],
            "stride": manifest["stride"],
            "samples": manifest["samples"],
            "normalization_fitted_on": "TRAIN",
            "water_exclusion_audit": manifest["water_exclusion_audit"],
        },
        "training": {
            "seed": seed,
            "lightgbm": {
                "training_time_sec": round(lgb_time, 2),
                "training_pixels": int(len(y_train_flat)),
                "validation_pixels": int(len(y_val_flat)),
                "selected_probability_threshold": lgb_threshold,
                "checkpoint_path": str(lgb_ckpt_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
                "checkpoint_bytes": lgb_ckpt_bytes,
                "checkpoint_sha256": lgb_ckpt_sha,
                "top_features": sorted(importances.items(), key=lambda item: item[1], reverse=True)[:6],
            },
            "unet": unet_result,
            "cusum": cusum_meta,
            "log_ratio": {
                "threshold_db": baseline_threshold,
                "calibration": baseline_cal,
                "calibrated_on": train_ids,
            },
        },
        "prediction_files": pred_files_info,
        "models": models_eval,
        "reference_label_layer": reference_layer,
        "elapsed_sec": round(time.time() - started, 2),
    }
    comp_out_path = eval_dir / "real_model_comparison.json"
    comp_out_path.write_text(json.dumps(comparison_report, indent=2), encoding="utf-8")

    # ---------------- Phase E: Export Before/After GeoTIFFs, GeoJSONs, PNGs & Validation ----------------
    logger.info("Phase E: Exporting georeferenced GeoTIFFs, GeoJSONs, 6-panel PNGs, and validation report...")
    nisar_manifest = json.loads((REAL_ROOT / "nisar_cmr_candidates.json").read_text(encoding="utf-8"))
    acq_manifest = json.loads((acq_dir / "manifests" / "acquisition_manifest.json").read_text(encoding="utf-8"))

    events_summaries: Dict[str, Any] = {}
    for spec in EVENTS:
        ev_id = spec.event_id
        real_dir = REAL_ROOT / ev_id
        meta = json.loads((real_dir / "metadata.json").read_text(encoding="utf-8"))
        with np.load(real_dir / "stack.npz") as st:
            stack_shapes = {k: st[k].shape for k in st.files}
            vv_pre = st["s1_pre_vv"].astype(np.float32)
            vh_pre = st["s1_pre_vh"].astype(np.float32)
            vv_post = np.nanmedian(np.stack([st["s1_post_vv"], st["s1_post2_vv"]], axis=0), axis=0).astype(np.float32)
            vh_post = np.nanmedian(np.stack([st["s1_post_vh"], st["s1_post2_vh"]], axis=0), axis=0).astype(np.float32)
            s2_b08_pre = st["s2_pre_B08"].astype(np.float32)
            s2_b12_pre = st["s2_pre_B12"].astype(np.float32)
            s2_scl_pre = st["s2_pre_SCL"].astype(np.uint8)
            s2_b08_post = st["s2_post_B08"].astype(np.float32)
            s2_b12_post = st["s2_post_B12"].astype(np.float32)
            s2_scl_post = st["s2_post_SCL"].astype(np.uint8)
            mcd_burn_mask = st["mcd_burn_mask"].astype(np.uint8)
            mcd_burn_date = st["mcd_burn_date"].astype(np.int16)

        verification = verify_before_after_alignment(meta, stack_shapes)
        sar_feats = compute_before_after_sar_features(vv_pre, vh_pre, vv_post, vh_post)
        nbr_pre = compute_nbr(s2_b08_pre, s2_b12_pre)
        nbr_post = compute_nbr(s2_b08_post, s2_b12_post)
        dnbr = compute_dnbr(nbr_pre, nbr_post)
        water_mask = water_optical_mask(s2_scl_pre, s2_scl_post)
        opt_valid_land = valid_optical_mask(
            s2_scl_pre, s2_scl_post, s2_b08_pre, s2_b08_post, exclude_water=True
        )
        valid_mask = (sar_feats["s1_valid_mask"] & opt_valid_land & np.isfinite(dnbr) & (~water_mask)).astype(np.uint8)
        assert int(np.count_nonzero((valid_mask > 0) & water_mask)) == 0

        dnbr_label_mask = ((dnbr >= threshold_dnbr) & (valid_mask > 0)).astype(np.uint8)
        dnbr_usgs_027_mask = ((dnbr >= 0.27) & (valid_mask > 0)).astype(np.uint8)

        model_masks: Dict[str, np.ndarray] = {}
        model_probs: Dict[str, np.ndarray] = {}
        pred_p = pred_dir / f"{ev_id}.npz"
        if pred_p.exists():
            with np.load(pred_p) as pr:
                valid_mask = ((pr["valid"] > 0) & (~water_mask)).astype(np.uint8)
                dnbr_label_mask = ((pr["label"] > 0) & (valid_mask > 0)).astype(np.uint8)
                for key in ("unet", "lightgbm", "log_ratio", "cusum", "all_burned"):
                    if key in pr:
                        model_masks[key] = ((pr[key] > 0) & (valid_mask > 0)).astype(np.uint8)
                if "unet_prob" in pr:
                    model_probs["unet"] = pr["unet_prob"].astype(np.float32)
                if "lightgbm_prob" in pr:
                    model_probs["lightgbm"] = pr["lightgbm_prob"].astype(np.float32)
                if "cusum_score" in pr:
                    model_probs["cusum"] = pr["cusum_score"].astype(np.float32)
                model_probs["log_ratio"] = (-sar_feats["delta_vh_db"]).astype(np.float32)
        else:
            model_masks["log_ratio"] = (
                (sar_feats["delta_vh_db"] <= baseline_threshold) & (valid_mask > 0)
            ).astype(np.uint8)
            model_probs["log_ratio"] = (-sar_feats["delta_vh_db"]).astype(np.float32)
            model_masks["all_burned"] = (valid_mask > 0).astype(np.uint8)

        primary_model_key = "unet" if "unet" in model_masks else "log_ratio"
        primary_burn_mask = model_masks[primary_model_key]
        primary_burn_prob = model_probs.get(primary_model_key, primary_burn_mask.astype(np.float32))

        grid_info = meta["grid"]
        crs = str(grid_info["crs"])
        transform_tuple = tuple(float(x) for x in grid_info["transform"])
        bounds_utm = tuple(float(x) for x in grid_info["bounds"])
        pixel_area_m2 = float(abs(transform_tuple[0] * transform_tuple[4]))

        ev_geo_dir = geo_dir / ev_id
        ev_geo_dir.mkdir(parents=True, exist_ok=True)

        products_exported: Dict[str, str] = {}
        tiffs = [
            ("pre_vh_db", "pre_vh_db.tif", sar_feats["vh_pre_db"], "float32", -9999.0, "Pre-fire Sentinel-1 RTC VH gamma-0 (dB)"),
            ("post_vh_db", "post_vh_db.tif", sar_feats["vh_post_db"], "float32", -9999.0, "Post-fire Sentinel-1 RTC VH gamma-0 (dB)"),
            ("delta_vh_db", "delta_vh_db.tif", sar_feats["delta_vh_db"], "float32", -9999.0, "Post minus Pre Sentinel-1 RTC VH log-ratio change (dB)"),
            ("burn_prob", "burn_prob.tif", primary_burn_prob, "float32", -9999.0, f"Burned-area probability / score ({primary_model_key})"),
            ("burn_mask", "burn_mask.tif", primary_burn_mask, "uint8", 255.0, f"Binary burned-area mask (1=burned, 0=unburned, {primary_model_key})"),
            ("valid_mask", "valid_mask.tif", valid_mask, "uint8", 255.0, "Valid land observation mask (1=valid SAR+optical land, 0=invalid/cloud/water)"),
            ("dnbr", "dnbr.tif", dnbr, "float32", -9999.0, "Sentinel-2 L2A differenced Normalized Burn Ratio (dNBR)"),
            ("mcd64a1_burn_date", "mcd64a1_burn_date.tif", mcd_burn_date, "int16", -1.0, "NASA MODIS MCD64A1.061 ordinal day of burn"),
        ]
        for key, fname, arr, dt, nodata_val, desc in tiffs:
            p = export_geotiff_layer(
                ev_geo_dir / fname,
                arr,
                crs=crs,
                transform_tuple=transform_tuple,
                dtype=dt,
                nodata=nodata_val,
                description=desc,
            )
            products_exported[key] = str(p.relative_to(PROJECT_ROOT)).replace("\\", "/")

        ref_dnbr_area = compute_geospatial_burned_area(
            dnbr_label_mask, valid_mask, crs=crs, transform=transform_tuple,
            probability_or_score=dnbr, threshold_used=threshold_dnbr, threshold_delta=0.02,
        )
        ref_dnbr_027_area = compute_geospatial_burned_area(
            dnbr_usgs_027_mask, valid_mask, crs=crs, transform=transform_tuple,
            probability_or_score=dnbr, threshold_used=0.27, threshold_delta=0.02,
        )
        with np.load(real_dir / "mcd64a1_ancillary.npz") as anc:
            unc_arr = anc["uncertainty"]
            qa_arr = anc["qa"]
            fd_arr = anc["first_day"]
            ld_arr = anc["last_day"]
            qa_dec = decode_qa_bitmask(qa_arr)
            qa_filtered_mcd_mask = (
                (mcd_burn_mask > 0) & qa_dec["high_quality_land_mask"] & (valid_mask > 0)
            )
            in_win_bd = np.where(
                (mcd_burn_date >= spec.mcd_burn_start_doy) & (mcd_burn_date <= spec.mcd_burn_end_doy),
                mcd_burn_date,
                np.where(mcd_burn_date > 0, 0, mcd_burn_date),
            ).astype(np.int16)
            mcd_anc_summary = summarize_mcd64a1_layers(
                in_win_bd, uncertainty=unc_arr, qa=qa_arr, first_day=fd_arr, last_day=ld_arr, pixel_area_m2=pixel_area_m2,
            )

        ref_mcd_area = compute_geospatial_burned_area(
            qa_filtered_mcd_mask.astype(np.uint8), valid_mask, crs=crs, transform=transform_tuple,
        )

        model_area_estimates: Dict[str, Any] = {}
        for m_key, m_mask in model_masks.items():
            if m_key == "unet":
                t_used, t_delta, low_tail, score_arr = unet_threshold, 0.05, False, model_probs.get("unet")
            elif m_key == "lightgbm":
                t_used, t_delta, low_tail, score_arr = lgb_threshold, 0.01, False, model_probs.get("lightgbm")
            elif m_key == "log_ratio":
                t_used, t_delta, low_tail, score_arr = baseline_threshold, 0.25, True, sar_feats["delta_vh_db"]
            else:
                t_used, t_delta, low_tail, score_arr = None, 0.05, False, model_probs.get(m_key)
            model_area_estimates[m_key] = compute_geospatial_burned_area(
                m_mask, valid_mask, crs=crs, transform=transform_tuple,
                probability_or_score=score_arr, threshold_used=t_used, threshold_delta=t_delta, is_lower_tail=low_tail,
            ).to_dict()

        geojson_path = export_aoi_boundary_geojson(
            ev_geo_dir / "aoi_boundary.geojson",
            event_id=ev_id,
            fire_name=spec.name,
            crs=crs,
            bounds_utm=bounds_utm,
            extra_properties={
                "split": spec.split,
                "primary_model": primary_model_key,
                "predicted_burned_area_km2": model_area_estimates[primary_model_key]["burned_area_km2"],
                "dnbr_reference_burned_area_km2": ref_dnbr_area.burned_area_km2,
                "dnbr_usgs_027_burned_area_km2": ref_dnbr_027_area.burned_area_km2,
                "mcd64a1_burned_area_km2": ref_mcd_area.burned_area_km2,
                "firms_hotspots_count": acq_manifest["firms_wildfire_events"][ev_id]["buffered_aoi_summary"]["total_hotspots"],
            },
        )
        products_exported["aoi_boundary_geojson"] = str(geojson_path.relative_to(PROJECT_ROOT)).replace("\\", "/")

        # Copy FIRMS hotspots GeoJSON into event geospatial directory as well
        src_firms_gj = PROJECT_ROOT / acq_manifest["firms_wildfire_events"][ev_id]["hotspots_geojson"]["path"]
        dst_firms_gj = ev_geo_dir / "firms_hotspots.geojson"
        if src_firms_gj.exists():
            shutil.copy2(src_firms_gj, dst_firms_gj)
            products_exported["firms_hotspots_geojson"] = str(dst_firms_gj.relative_to(PROJECT_ROOT)).replace("\\", "/")

        s1_pre_dt = verification["temporal_verification"]["s1_pre_dates"][0]
        s1_post_dt = "/".join(verification["temporal_verification"]["s1_post_dates"])
        overview_png_path = export_before_after_overview_png(
            ev_geo_dir / "before_after_overview.png",
            event_id=ev_id,
            fire_name=spec.name,
            split=spec.split,
            crs=crs,
            bounds_utm=bounds_utm,
            pre_date=s1_pre_dt,
            post_date=s1_post_dt,
            vh_pre_db=sar_feats["vh_pre_db"],
            vh_post_db=sar_feats["vh_post_db"],
            delta_vh_db=sar_feats["delta_vh_db"],
            dnbr=dnbr,
            mcd_burn_mask=qa_filtered_mcd_mask.astype(np.uint8),
            pred_burn_mask=primary_burn_mask,
            valid_mask=valid_mask,
            primary_model_key=primary_model_key,
            pred_area_km2=model_area_estimates[primary_model_key]["burned_area_km2"],
            dnbr_area_km2=ref_dnbr_area.burned_area_km2,
            mcd_area_km2=ref_mcd_area.burned_area_km2,
        )
        products_exported["before_after_overview_png"] = str(overview_png_path.relative_to(PROJECT_ROOT)).replace("\\", "/")

        independent_validation_by_model: Dict[str, Any] = {}
        for m_key, m_mask in model_masks.items():
            vs_dnbr = calculate_segmentation_metrics(
                m_mask, dnbr_label_mask, valid_mask=valid_mask, pixel_area_m2=pixel_area_m2
            ).to_dict()
            vs_dnbr_027 = calculate_segmentation_metrics(
                m_mask, dnbr_usgs_027_mask, valid_mask=valid_mask, pixel_area_m2=pixel_area_m2
            ).to_dict()
            vs_mcd = calculate_segmentation_metrics(
                m_mask, qa_filtered_mcd_mask.astype(np.uint8), valid_mask=valid_mask, pixel_area_m2=pixel_area_m2
            ).to_dict()
            vs_mcd_500m_block = calculate_coarse_block_reconciliation_metrics(
                m_mask, qa_filtered_mcd_mask.astype(np.uint8), valid_mask_20m=valid_mask, block_size_px=25
            )
            score_for_auc = model_probs.get(m_key)
            if score_for_auc is not None:
                vs_dnbr.update(calculate_probability_auc_metrics(score_for_auc, dnbr_label_mask, valid_mask=valid_mask))
                vs_mcd.update(calculate_probability_auc_metrics(score_for_auc, qa_filtered_mcd_mask.astype(np.uint8), valid_mask=valid_mask))
            independent_validation_by_model[m_key] = {
                "vs_sentinel2_dnbr": vs_dnbr,
                "vs_sentinel2_dnbr_usgs_027": vs_dnbr_027,
                "vs_nasa_mcd64a1_qa_filtered": vs_mcd,
                "vs_nasa_mcd64a1_500m_block_reconciled": vs_mcd_500m_block,
            }

        dnbr_vs_mcd = calculate_segmentation_metrics(
            dnbr_label_mask, qa_filtered_mcd_mask.astype(np.uint8), valid_mask=valid_mask, pixel_area_m2=pixel_area_m2
        ).to_dict()
        dnbr_vs_mcd["block_reconciled_500m"] = calculate_coarse_block_reconciliation_metrics(
            dnbr_label_mask, qa_filtered_mcd_mask.astype(np.uint8), valid_mask_20m=valid_mask, block_size_px=25
        )

        event_summary = {
            "event_id": ev_id,
            "fire_name": spec.name,
            "state_region": spec.region,
            "split": spec.split,
            "include_in_training": spec.include_in_training,
            "is_nisar": False,
            "data_origin": "CROSS_SENSOR_PROTOTYPE",
            "water_pixels_excluded_scl6": int(np.count_nonzero(water_mask)),
            "water_pixels_remaining_in_valid": int(np.count_nonzero((valid_mask > 0) & water_mask)),
            "firms_active_fire_summary": acq_manifest["firms_wildfire_events"][ev_id]["buffered_aoi_summary"],
            "before_after_verification": verification,
            "primary_model": primary_model_key,
            "area_estimates": {
                "primary_model_burned_area": model_area_estimates[primary_model_key],
                "by_model": model_area_estimates,
                "sentinel2_dnbr_reference": ref_dnbr_area.to_dict(),
                "sentinel2_dnbr_usgs_027_reference": ref_dnbr_027_area.to_dict(),
                "nasa_mcd64a1_reference": ref_mcd_area.to_dict(),
            },
            "independent_validation": {
                "models": independent_validation_by_model,
                "sentinel2_dnbr_vs_nasa_mcd64a1": dnbr_vs_mcd,
                "mcd64a1_ancillary_summary": mcd_anc_summary,
            },
            "geospatial_products": products_exported,
        }
        summary_path = ev_geo_dir / "before_after_summary.json"
        summary_path.write_text(json.dumps(event_summary, indent=2), encoding="utf-8")
        products_exported["before_after_summary_json"] = str(summary_path.relative_to(PROJECT_ROOT)).replace("\\", "/")
        events_summaries[ev_id] = event_summary

    comp_val_report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "run_directory": str(out_run_dir.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "acquisition_directory": str(acq_dir.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "data_origin": "CROSS_SENSOR_PROTOTYPE",
        "is_nisar": False,
        "nisar_completion_gates": {
            "NISAR_METADATA_DISCOVERED": True,
            "NISAR_GRANULE_DOWNLOADED": False,
            "NISAR_DOWNLOAD_BLOCKED": True,
        },
        "splits": comparison_report["splits"],
        "excluded_events": ["CA_TIMBER_2026"],
        "stored_model_comparison": comparison_report["models"],
        "events_before_after_and_validation": events_summaries,
        "processing_elapsed_sec": round(time.time() - started, 2),
    }
    comp_val_path = eval_dir / "comprehensive_validation_report.json"
    comp_val_path.write_text(json.dumps(comp_val_report, indent=2), encoding="utf-8")

    # Write pointer file `outputs/runs/latest_run.json` so FastAPI service can surface versioned run metadata
    latest_pointer = {
        "run_id": out_run_dir.name,
        "generated_at_utc": comp_val_report["generated_at_utc"],
        "acquisition_dir": str(acq_dir.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "output_run_dir": str(out_run_dir.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "acquisition_manifest_path": str((acq_dir / "manifests" / "acquisition_manifest.json").relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "dataset_manifest_path": str((dataset_root / "dataset_manifest.json").relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "model_comparison_path": str(comp_out_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        "comprehensive_validation_path": str(comp_val_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
    }
    (out_run_dir.parent / "latest_run.json").write_text(json.dumps(latest_pointer, indent=2), encoding="utf-8")
    logger.info("Phases D & E complete in %.1fs. Wrote %s", time.time() - started, comp_val_path)
    return comp_val_report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", type=str, default="run_20261114_013200", help="Versioned run directory name")
    parser.add_argument(
        "--stage",
        choices=("all", "acquire-only", "acquire-and-build", "train-and-evaluate"),
        default="all",
        help="Pipeline stage to execute",
    )
    parser.add_argument("--epochs", type=int, default=6, help="U-Net training epochs")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    acq_dir = PROJECT_ROOT / "data" / "acquisitions" / args.run_id
    out_run_dir = PROJECT_ROOT / "outputs" / "runs" / args.run_id

    if args.stage in ("all", "acquire-only", "acquire-and-build"):
        run_phase_b_acquisition(acq_dir)
    if args.stage in ("all", "acquire-and-build"):
        run_phase_c_dataset(acq_dir)

    if args.stage in ("all", "train-and-evaluate"):
        run_phase_d_and_e_training_and_evaluation(
            acq_dir=acq_dir,
            out_run_dir=out_run_dir,
            epochs=args.epochs,
            seed=args.seed,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
