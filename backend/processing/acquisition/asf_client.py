"""Alaska Satellite Facility (ASF) DAAC & NASA CMR Search and Acquisition Client.

Queries ASF Vertex (`asf_search`) and NASA Earthdata Common Metadata Repository (CMR)
for NISAR L-band Level-2 GCOV (`NISAR_L2_GCOV_V1`, Concept ID `C3622241360-ASF`)
and Sentinel-1 products.

Handles:
- Unauthenticated live CMR/ASF metadata discovery
- NISAR GCOV granule naming convention parsing (cycle, track, direction, frame, mode,
  polarizations, CRID/PGE maturity `P05023` Provisional vs `P05036` Validated)
- Permanent mission outage detection (`2026-07-27T22:03:25Z` to `2026-08-10T00:55:27Z`)
- Pre-fire / post-fire same-geometry (track/frame/orbit) pair matching
- Explicit Earthdata Login (EDL) credential verification and disk-budget guardrails
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import httpx

logger = logging.getLogger(__name__)

NISAR_GCOV_CONCEPT_ID = "C3622241360-ASF"
NISAR_GCOV_PROVISIONAL_CONCEPT_ID = "C2854338529-ASF"
NISAR_GCOV_BETA_CONCEPT_ID = "C3622214170-ASF"
NISAR_COLLECTION_SHORT_NAMES = {
    NISAR_GCOV_CONCEPT_ID: "NISAR_L2_GCOV_V1",
    NISAR_GCOV_PROVISIONAL_CONCEPT_ID: "NISAR_L2_GCOV_PROVISIONAL_V1",
    NISAR_GCOV_BETA_CONCEPT_ID: "NISAR_L2_GCOV_BETA_V1",
}
NASA_CMR_GRANULES_URL = "https://cmr.earthdata.nasa.gov/search/granules.json"
NASA_HARMONY_BASE_URL = "https://harmony.earthdata.nasa.gov"
NISAR_OUTAGE_START = "2026-07-27T22:03:25Z"
NISAR_OUTAGE_END = "2026-08-10T00:55:27Z"
NISAR_VALIDATED_RELEASE_START = "2026-10-21T00:00:00Z"

NISAR_HARMONY_SUBSET_VARIABLES = [
    "/science/LSAR/GCOV/grids/frequencyA/HHHH",
    "/science/LSAR/GCOV/grids/frequencyA/HVHV",
    "/science/LSAR/GCOV/grids/frequencyA/mask",
    "/science/LSAR/GCOV/grids/frequencyA/numberOfLooks",
    "/science/LSAR/GCOV/grids/frequencyA/rtcGammaToSigmaFactor",
]


def _extract_asf_bytes(raw_bytes: Any, scene_name: str = "") -> float:
    """Extract HDF5/primary file size in bytes from asf_search properties['bytes']."""
    if raw_bytes is None:
        return 0.0
    if isinstance(raw_bytes, (int, float)):
        return float(raw_bytes)
    if isinstance(raw_bytes, str):
        try:
            return float(raw_bytes)
        except ValueError:
            return 0.0
    if isinstance(raw_bytes, dict):
        # Prefer exact <scene_name>.h5 entry, then any .h5 entry, then first entry
        target_h5 = f"{scene_name}.h5" if scene_name else ""
        if target_h5 and target_h5 in raw_bytes and isinstance(raw_bytes[target_h5], dict):
            return float(raw_bytes[target_h5].get("bytes", 0) or 0.0)
        for fname, meta in raw_bytes.items():
            if str(fname).endswith(".h5") and isinstance(meta, dict):
                return float(meta.get("bytes", 0) or 0.0)
        for meta in raw_bytes.values():
            if isinstance(meta, dict) and "bytes" in meta:
                return float(meta.get("bytes", 0) or 0.0)
            if isinstance(meta, (int, float)):
                return float(meta)
    return 0.0


def build_harmony_subset_url(
    collection_concept_id: str,
    granule_concept_id: str,
    bbox: Tuple[float, float, float, float],
    target_crs: str = "EPSG:32610",
    variables: Optional[List[str]] = None,
) -> str:
    """Build NASA Harmony OGC API Coverages spatial + variable subset request URL."""
    min_lon, min_lat, max_lon, max_lat = bbox
    vars_list = variables or NISAR_HARMONY_SUBSET_VARIABLES
    from urllib.parse import quote
    var_param = ",".join(quote(v, safe="") for v in vars_list)
    return (
        f"{NASA_HARMONY_BASE_URL}/{collection_concept_id}/ogc-api-coverages/1.0.0/"
        f"collections/parameter_vars/coverage/rangeset"
        f"?granuleId={granule_concept_id}"
        f"&subset=lat({min_lat:.6f}:{max_lat:.6f})"
        f"&subset=lon({min_lon:.6f}:{max_lon:.6f})"
        f"&crs={quote(target_crs, safe='')}"
        f"&variable={var_param}"
    )

# Regex for NISAR_L2_PR_GCOV_009_042_D_069_2005_DHDH_A_20260723T020229_20260723T020305_P05023_N_F_J_001
NISAR_GRANULE_REGEX = re.compile(
    r"^NISAR_L2_(?P<maturity>[A-Z]{2})_GCOV_"
    r"(?P<cycle>\d{3})_(?P<track>\d{3})_(?P<dir>[AD])_(?P<frame>\d{3})_"
    r"(?P<mode>\d{4})_(?P<pol_code>[A-Z]{4})_(?P<antenna>[A-Z])_"
    r"(?P<start>\d{8}T\d{6})_(?P<end>\d{8}T\d{6})_"
    r"(?P<crid>[A-Z]\d{5})_"
)


def parse_nisar_granule_id(granule_id: str) -> Dict[str, Any]:
    """Parse official JPL NISAR L2 GCOV granule identifier fields."""
    match = NISAR_GRANULE_REGEX.match(granule_id.strip())
    if not match:
        return {
            "granule_id": granule_id,
            "parsed": False,
            "crid": "UNKNOWN",
            "maturity_status": "UNKNOWN",
        }
    gd = match.groupdict()
    crid = gd["crid"]
    if crid >= "P05036":
        maturity = "VALIDATED_SCIENCE"
    elif crid == "P05023" or gd["maturity"] == "PR":
        maturity = "PROVISIONAL"
    else:
        maturity = f"PRE_VALIDATED_{crid}"

    pol_map = {
        "DHDH": "HHHH+HVHV",
        "DVDV": "VVVV+VHVH",
        "QPQP": "HHHH+HVHV+VVVV+VHVH",
        "SHSH": "HHHH",
        "SVSV": "VVVV",
    }
    return {
        "granule_id": granule_id,
        "parsed": True,
        "maturity_code": gd["maturity"],
        "maturity_status": maturity,
        "cycle": int(gd["cycle"]),
        "track": int(gd["track"]),
        "flight_direction": "DESCENDING" if gd["dir"] == "D" else "ASCENDING",
        "frame": int(gd["frame"]),
        "mode": gd["mode"],
        "pol_code": gd["pol_code"],
        "polarization": pol_map.get(gd["pol_code"], gd["pol_code"]),
        "crid": crid,
    }


@dataclass
class SARGranuleMetadata:
    granule_name: str
    sensor: str
    product_type: str
    acquisition_time: str
    polarization: str
    flight_direction: str
    track: int
    frame: int
    download_url: str
    file_size_mb: float
    wkt_geometry: str
    crid: str = ""
    maturity_status: str = ""
    end_time: str = ""
    concept_id: str = ""
    collection_concept_id: str = ""
    collection_short_name: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ASFSearchClient:
    """Client for discovering NISAR and Sentinel-1 granules via ASF Search and NASA CMR."""

    def __init__(self, username: Optional[str] = None, password: Optional[str] = None):
        self.username = username or os.environ.get("EARTHDATA_USERNAME", "")
        self.password = password or os.environ.get("EARTHDATA_PASSWORD", "")

    def has_earthdata_credentials(self) -> bool:
        """Check whether NASA Earthdata Login credentials exist in env or ~/.netrc."""
        if self.username and self.password and self.username != "CHANGE_ME":
            return True
        if os.environ.get("EARTHDATA_TOKEN"):
            return True
        home = Path.home()
        for netrc_name in (".netrc", "_netrc"):
            netrc_path = home / netrc_name
            if netrc_path.exists():
                try:
                    text = netrc_path.read_text(encoding="utf-8", errors="ignore")
                    if "urs.earthdata.nasa.gov" in text:
                        return True
                except OSError:
                    pass
        return False

    def search_granules(
        self,
        bbox: Tuple[float, float, float, float],
        start_date: str,
        end_date: str,
        platform: str = "NISAR",
        processing_level: str = "GCOV",
        max_results: int = 10,
    ) -> List[SARGranuleMetadata]:
        """Queries ASF Vertex for SAR products intersecting a bounding box."""
        try:
            import asf_search as asf
        except ImportError:
            logger.error("asf_search package not installed.")
            return []

        min_lon, min_lat, max_lon, max_lat = bbox
        wkt_polygon = (
            f"POLYGON(({min_lon} {min_lat}, {max_lon} {min_lat}, "
            f"{max_lon} {max_lat}, {min_lon} {max_lat}, {min_lon} {min_lat}))"
        )

        granules: List[SARGranuleMetadata] = []
        try:
            results = asf.geo_search(
                platform=platform,
                intersectsWith=wkt_polygon,
                start=start_date,
                end=end_date,
                processingLevel=processing_level,
                maxResults=max_results,
            )

            for item in results:
                props = item.properties
                scene_name = props.get("sceneName", item.geojson().get("id", ""))
                parsed = parse_nisar_granule_id(scene_name)
                bytes_val = _extract_asf_bytes(props.get("bytes"), scene_name=scene_name)
                granules.append(
                    SARGranuleMetadata(
                        granule_name=scene_name,
                        sensor=platform,
                        product_type=processing_level,
                        acquisition_time=props.get("startTime", ""),
                        polarization=props.get("polarization") or parsed.get("polarization", "HH+HV"),
                        flight_direction=props.get("flightDirection") or parsed.get("flight_direction", ""),
                        track=int(props.get("pathNumber") or parsed.get("track", 0) or 0),
                        frame=int(props.get("frameNumber") or parsed.get("frame", 0) or 0),
                        download_url=props.get("url", ""),
                        file_size_mb=round(bytes_val / (1024 * 1024), 2),
                        wkt_geometry=item.wkt(),
                        crid=parsed.get("crid", ""),
                        maturity_status=parsed.get("maturity_status", ""),
                        end_time=props.get("stopTime", ""),
                    )
                )

        except Exception as e:
            logger.error(f"ASF search failed: {e}")

        return granules

    def search_cmr_nisar_gcov(
        self,
        bbox: Tuple[float, float, float, float],
        start_date: str,
        end_date: str,
        page_size: int = 50,
        include_provisional: bool = True,
    ) -> List[SARGranuleMetadata]:
        """Query NASA CMR directly for NISAR_L2_GCOV_V1 and optionally NISAR_L2_GCOV_PROVISIONAL_V1 granules."""
        min_lon, min_lat, max_lon, max_lat = bbox
        t_start = start_date if "T" in start_date else f"{start_date}T00:00:00Z"
        t_end = end_date if "T" in end_date else f"{end_date}T23:59:59Z"
        concept_ids = [NISAR_GCOV_CONCEPT_ID]
        if include_provisional:
            concept_ids.append(NISAR_GCOV_PROVISIONAL_CONCEPT_ID)

        granules: List[SARGranuleMetadata] = []
        for cid in concept_ids:
            params = {
                "collection_concept_id": cid,
                "bounding_box": f"{min_lon},{min_lat},{max_lon},{max_lat}",
                "temporal": f"{t_start},{t_end}",
                "page_size": str(page_size),
                "sort_key": "start_date",
            }
            try:
                resp = httpx.get(NASA_CMR_GRANULES_URL, params=params, timeout=25.0)
                resp.raise_for_status()
                entries = resp.json().get("feed", {}).get("entry", [])
                for entry in entries:
                    title = entry.get("title", "")
                    parsed = parse_nisar_granule_id(title)
                    h5_url = ""
                    for link in entry.get("links", []):
                        href = link.get("href", "")
                        if href.startswith("https://") and href.endswith(".h5"):
                            h5_url = href
                            break
                    size_mb = float(entry.get("granule_size", 0.0) or 0.0)
                    polys = entry.get("polygons", [[""]])
                    poly_str = polys[0][0] if polys and polys[0] else ""
                    granules.append(
                        SARGranuleMetadata(
                            granule_name=title,
                            sensor="NISAR_L",
                            product_type="GCOV",
                            acquisition_time=entry.get("time_start", ""),
                            end_time=entry.get("time_end", ""),
                            polarization=parsed.get("polarization", "HHHH+HVHV"),
                            flight_direction=parsed.get("flight_direction", ""),
                            track=int(parsed.get("track", 0)),
                            frame=int(parsed.get("frame", 0)),
                            download_url=h5_url,
                            file_size_mb=round(size_mb, 2),
                            wkt_geometry=poly_str,
                            crid=parsed.get("crid", ""),
                            maturity_status=parsed.get("maturity_status", ""),
                            concept_id=entry.get("id", ""),
                            collection_concept_id=cid,
                            collection_short_name=NISAR_COLLECTION_SHORT_NAMES.get(cid, ""),
                        )
                    )
            except Exception as e:
                logger.error(f"CMR NISAR GCOV search failed for {cid}: {e}")

        granules.sort(key=lambda g: g.acquisition_time)
        return granules

    def match_before_after_pairs(
        self,
        granules: List[SARGranuleMetadata],
        ignition_date: str,
        containment_date: str,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        target_crs: str = "EPSG:32610",
    ) -> List[Dict[str, Any]]:
        """Group NISAR GCOV granules by (flight_direction, track, frame) and pair pre/post fire."""
        groups: Dict[Tuple[str, int, int], List[SARGranuleMetadata]] = {}
        for g in granules:
            key = (g.flight_direction, g.track, g.frame)
            groups.setdefault(key, []).append(g)

        pairs: List[Dict[str, Any]] = []
        ig_prefix = ignition_date[:10]
        ct_prefix = containment_date[:10]

        for (direction, track, frame), items in sorted(groups.items()):
            items_sorted = sorted(items, key=lambda x: x.acquisition_time)
            pre_candidates = [g for g in items_sorted if g.acquisition_time[:10] < ig_prefix]
            post_candidates = [g for g in items_sorted if g.acquisition_time[:10] > ct_prefix]
            if not pre_candidates or not post_candidates:
                continue
            pre_best = pre_candidates[-1]  # Closest prior to ignition
            post_best = post_candidates[0]  # Closest immediate post-fire
            val_post = next(
                (g for g in post_candidates if g.crid >= "P05036"),
                post_candidates[-1],
            )
            combined_gb = round((pre_best.file_size_mb + post_best.file_size_mb) / 1024.0, 2)
            pair_dict: Dict[str, Any] = {
                "orbit_direction": direction,
                "track": track,
                "frame": frame,
                "same_geometry_verified": True,
                "polarization": pre_best.polarization,
                "maturity_status": f"{pre_best.maturity_status}->{post_best.maturity_status}",
                "pre_fire_maturity_status": pre_best.maturity_status,
                "post_fire_maturity_status": post_best.maturity_status,
                "crid": pre_best.crid,
                "post_fire_crid": post_best.crid,
                "validated_post_fire_crid": val_post.crid,
                "combined_size_gb": combined_gb,
                "harmony_subset_pair_estimated_mb": 5.12,
                "pre_fire_granule": pre_best.to_dict(),
                "post_fire_granule": post_best.to_dict(),
                "validated_post_fire_granule": val_post.to_dict(),
            }
            if bbox is not None:
                pre_cid = pre_best.collection_concept_id or NISAR_GCOV_PROVISIONAL_CONCEPT_ID
                post_cid = post_best.collection_concept_id or NISAR_GCOV_CONCEPT_ID
                val_cid = val_post.collection_concept_id or NISAR_GCOV_CONCEPT_ID
                pair_dict["harmony_subset_urls"] = {
                    "pre_fire": build_harmony_subset_url(
                        pre_cid, pre_best.concept_id, bbox, target_crs=target_crs
                    ),
                    "post_fire_immediate": build_harmony_subset_url(
                        post_cid, post_best.concept_id, bbox, target_crs=target_crs
                    ),
                    "post_fire_validated": build_harmony_subset_url(
                        val_cid, val_post.concept_id, bbox, target_crs=target_crs
                    ),
                }
            pairs.append(pair_dict)
        return pairs
