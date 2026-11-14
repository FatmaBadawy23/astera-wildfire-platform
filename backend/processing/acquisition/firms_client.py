"""NASA FIRMS (Fire Information for Resource Management System) Client.

Queries VIIRS and MODIS active fire hotspots for event discovery, ignition date
bounding, and temporal perimeter tracking.

SCIENTIFIC PRINCIPLE: FIRMS active fire hotspots represent instantaneous thermal
radiance detections; they are NEVER pixel-level burned-area polygons or ground truth.
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import httpx

logger = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

DEFAULT_FIRMS_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
DEFAULT_FIRMS_AVAILABILITY_URL = "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv"
DEFAULT_FIRMS_STATUS_URL = "https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/"


def get_env_or_windows_user_var(name: str) -> str:
    """Retrieve an environment variable from Process scope or Windows User registry."""
    val = os.environ.get(name, "").strip()
    if val:
        return val
    if os.name == "nt":
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Environment") as reg_key:
                reg_val, _ = winreg.QueryValueEx(reg_key, name)
                return str(reg_val).strip()
        except Exception:
            return ""
    return ""


def sanitize_firms_url(url: str, map_key: str) -> str:
    """Replace any occurrence of the secret FIRMS MAP_KEY with <REDACTED_MAP_KEY>."""
    if not map_key:
        return url
    return url.replace(map_key, "<REDACTED_MAP_KEY>")



def normalize_firms_confidence(raw_conf: Any) -> str:
    """Normalize VIIRS ('l','n','h','low','nominal','high') and MODIS (0-100) confidence."""
    s = str(raw_conf or "").strip().lower()
    if s in ("h", "high"):
        return "HIGH"
    if s in ("n", "nominal"):
        return "NOMINAL"
    if s in ("l", "low"):
        return "LOW"
    try:
        val = float(s)
        if val >= 80.0:
            return "HIGH"
        if val >= 30.0:
            return "NOMINAL"
        return "LOW"
    except ValueError:
        return "NOMINAL"


def format_firms_utc_timestamp(acq_date: str, acq_time: str) -> str:
    """Convert FIRMS acq_date ('YYYY-MM-DD') and acq_time ('HHMM' or 'HMM') to ISO-8601 UTC."""
    d_clean = str(acq_date or "").strip()
    t_clean = str(acq_time or "").strip().replace(":", "")
    if not d_clean:
        return ""
    t_padded = t_clean.zfill(4)
    hh = t_padded[:2]
    mm = t_padded[2:4]
    return f"{d_clean}T{hh}:{mm}:00Z"


@dataclass
class ActiveFirePoint:
    latitude: float
    longitude: float
    brightness: float
    scan: float
    track: float
    acq_date: str
    acq_time: str
    satellite: str
    instrument: str
    confidence: str
    version: str
    bright_t31: float
    frp: float  # Fire Radiative Power (MW)
    daynight: str

    @property
    def confidence_normalized(self) -> str:
        return normalize_firms_confidence(self.confidence)

    @property
    def acq_datetime_utc(self) -> str:
        return format_firms_utc_timestamp(self.acq_date, self.acq_time)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["confidence_normalized"] = self.confidence_normalized
        d["acq_datetime_utc"] = self.acq_datetime_utc
        return d


class FIRMSClient:
    """Client for querying NASA FIRMS active fire detections."""

    def __init__(self, map_key: Optional[str] = None):
        resolved_key = map_key or get_env_or_windows_user_var("FIRMS_MAP_KEY")
        self.map_key = resolved_key.strip() if resolved_key else ""
        self._query_cache: Dict[str, Tuple[List[ActiveFirePoint], Dict[str, Any]]] = {}
        self._availability_cache: Optional[Dict[str, Dict[str, str]]] = None

    def is_configured(self) -> bool:
        return bool(self.map_key and self.map_key != "CHANGE_ME")

    def check_mapkey_status(self) -> Dict[str, Any]:
        """Verify FIRMS MAP_KEY status and current transaction usage."""
        if not self.is_configured():
            return {"configured": False, "authenticated": False, "status_code": None}
        url = f"{DEFAULT_FIRMS_STATUS_URL}?MAP_KEY={self.map_key}"
        try:
            resp = httpx.get(url, headers={"User-Agent": "AsteraWatch/1.0"}, timeout=15.0)
            payload = resp.json() if resp.status_code == 200 else {"raw": resp.text[:200]}
            return {
                "configured": True,
                "authenticated": resp.status_code == 200 and "transaction_limit" in payload,
                "status_code": resp.status_code,
                "sanitized_url": sanitize_firms_url(url, self.map_key),
                "status": payload,
            }
        except Exception as exc:
            logger.error("FIRMS mapkey_status check failed: %s", sanitize_firms_url(str(exc), self.map_key))
            return {"configured": True, "authenticated": False, "error": sanitize_firms_url(str(exc), self.map_key)}

    def fetch_data_availability(
        self, save_csv_path: Optional[Path] = None
    ) -> Dict[str, Dict[str, str]]:
        """Query FIRMS data availability table dynamically (/api/data_availability/csv/{MAP_KEY}/all)."""
        if self._availability_cache is not None and save_csv_path is None:
            return self._availability_cache
        if not self.is_configured():
            return {}
        url = f"{DEFAULT_FIRMS_AVAILABILITY_URL}/{self.map_key}/all"
        try:
            resp = httpx.get(url, headers={"User-Agent": "AsteraWatch/1.0"}, timeout=20.0)
            if resp.status_code != 200:
                logger.error("FIRMS data_availability returned status %d", resp.status_code)
                return {}
            if save_csv_path is not None:
                save_csv_path = Path(save_csv_path)
                save_csv_path.parent.mkdir(parents=True, exist_ok=True)
                save_csv_path.write_text(resp.text, encoding="utf-8")
            availability: Dict[str, Dict[str, str]] = {}
            lines = [ln.strip() for ln in resp.text.strip().splitlines() if ln.strip()]
            for line in lines[1:]:
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 3:
                    availability[parts[0]] = {"min_date": parts[1], "max_date": parts[2]}
            self._availability_cache = availability
            return availability
        except Exception as exc:
            logger.error("FIRMS data_availability query failed: %s", sanitize_firms_url(str(exc), self.map_key))
            return {}

    def select_sources_for_date(
        self,
        date_str: str,
        availability: Optional[Dict[str, Dict[str, str]]] = None,
        preferred_families: Tuple[str, ...] = ("VIIRS_NOAA20", "VIIRS_SNPP", "VIIRS_NOAA21", "MODIS"),
    ) -> List[str]:
        """Select FIRMS sensor sources (_SP or _NRT) whose date range covers date_str."""
        avail = availability if availability is not None else self.fetch_data_availability()
        selected: List[str] = []
        for fam in preferred_families:
            chosen = None
            for suffix in ("_NRT", "_SP"):
                cand = f"{fam}{suffix}"
                if cand in avail:
                    min_d = avail[cand]["min_date"]
                    max_d = avail[cand]["max_date"]
                    if min_d <= date_str <= max_d:
                        chosen = cand
                        break
            if chosen is not None:
                selected.append(chosen)
        if not selected:
            selected = ["VIIRS_NOAA20_NRT", "VIIRS_SNPP_NRT", "MODIS_NRT"]
        return selected

    def query_area(
        self,
        bbox: Tuple[float, float, float, float],
        date_str: Optional[str] = None,
        days_range: int = 1,
        source: str = "VIIRS_NOAA20_NRT",
        max_retries: int = 3,
        save_csv_path: Optional[Path] = None,
    ) -> List[ActiveFirePoint]:
        """Queries FIRMS active fire detections within a bounding box."""
        points, _ = self.query_area_with_provenance(
            bbox=bbox,
            date_str=date_str,
            days_range=days_range,
            source=source,
            max_retries=max_retries,
            save_csv_path=save_csv_path,
        )
        return points

    def query_area_with_provenance(
        self,
        bbox: Tuple[float, float, float, float],
        date_str: Optional[str] = None,
        days_range: int = 1,
        source: str = "VIIRS_NOAA20_NRT",
        max_retries: int = 3,
        save_csv_path: Optional[Path] = None,
    ) -> Tuple[List[ActiveFirePoint], Dict[str, Any]]:
        """Query FIRMS active fire detections and return (points, provenance_dict)."""
        days_clamped = max(1, min(int(days_range), 5 if date_str else 10))
        min_lon, min_lat, max_lon, max_lat = bbox
        area_str = f"{min_lon:.3f},{min_lat:.3f},{max_lon:.3f},{max_lat:.3f}"
        if date_str:
            url = f"{DEFAULT_FIRMS_BASE_URL}/{self.map_key}/{source}/{area_str}/{days_clamped}/{date_str}"
        else:
            url = f"{DEFAULT_FIRMS_BASE_URL}/{self.map_key}/{source}/{area_str}/{days_clamped}"
        sanitized = sanitize_firms_url(url, self.map_key)

        if not self.is_configured():
            logger.warning("FIRMS MAP_KEY is not configured. Returning empty active fire list.")
            return [], {
                "source": source,
                "bbox": list(bbox),
                "date_str": date_str,
                "days_range": days_clamped,
                "sanitized_url": sanitized,
                "status_code": None,
                "record_count": 0,
                "configured": False,
            }

        cache_key = f"{source}|{area_str}|{days_clamped}|{date_str or 'RECENT'}"
        if cache_key in self._query_cache and save_csv_path is None:
            return self._query_cache[cache_key]

        backoff = 1.0
        for attempt in range(max_retries):
            try:
                response = httpx.get(url, headers={"User-Agent": "AsteraWatch/1.0"}, timeout=25.0)
                if response.status_code == 200:
                    raw_text = response.text
                    raw_bytes = response.content
                    sha256_hex = hashlib.sha256(raw_bytes).hexdigest()
                    saved_path_str = None
                    if save_csv_path is not None:
                        save_csv_path = Path(save_csv_path)
                        save_csv_path.parent.mkdir(parents=True, exist_ok=True)
                        save_csv_path.write_bytes(raw_bytes)
                        saved_path_str = str(save_csv_path)
                    pts = self._parse_csv(raw_text)
                    prov = {
                        "source": source,
                        "bbox": list(bbox),
                        "date_str": date_str,
                        "days_range": days_clamped,
                        "sanitized_url": sanitized,
                        "status_code": response.status_code,
                        "bytes": len(raw_bytes),
                        "sha256": sha256_hex,
                        "csv_path": saved_path_str,
                        "record_count": len(pts),
                        "summary": self.summarize_hotspots(pts, bbox=bbox),
                    }
                    self._query_cache[cache_key] = (pts, prov)
                    return pts, prov
                elif response.status_code == 429:  # Rate limited
                    logger.warning("FIRMS API rate limit reached. Backing off...")
                    time.sleep(backoff)
                    backoff *= 2.0
                else:
                    logger.error(
                        "FIRMS API returned status %d for %s: %s",
                        response.status_code,
                        sanitized,
                        sanitize_firms_url(response.text[:200], self.map_key),
                    )
                    break
            except Exception as e:
                logger.error(
                    "FIRMS request failed on attempt %d for %s: %s",
                    attempt + 1,
                    sanitized,
                    sanitize_firms_url(str(e), self.map_key),
                )
                time.sleep(backoff)
                backoff *= 2.0

        return [], {
            "source": source,
            "bbox": list(bbox),
            "date_str": date_str,
            "days_range": days_clamped,
            "sanitized_url": sanitized,
            "status_code": None,
            "record_count": 0,
        }

    def _parse_csv(self, csv_text: str) -> List[ActiveFirePoint]:
        lines = [line.strip() for line in csv_text.strip().split("\n") if line.strip()]
        if len(lines) <= 1:
            return []

        header = [h.strip() for h in lines[0].split(",")]
        points: List[ActiveFirePoint] = []

        for line in lines[1:]:
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < len(header):
                continue
            row = dict(zip(header, parts))
            try:
                points.append(
                    ActiveFirePoint(
                        latitude=float(row.get("latitude", 0.0)),
                        longitude=float(row.get("longitude", 0.0)),
                        brightness=float(row.get("bright_ti4", row.get("brightness", 0.0))),
                        scan=float(row.get("scan", 0.0)),
                        track=float(row.get("track", 0.0)),
                        acq_date=row.get("acq_date", ""),
                        acq_time=row.get("acq_time", ""),
                        satellite=row.get("satellite", ""),
                        instrument=row.get("instrument", ""),
                        confidence=row.get("confidence", "nominal"),
                        version=row.get("version", ""),
                        bright_t31=float(row.get("bright_ti5", row.get("bright_t31", 0.0))),
                        frp=float(row.get("frp", 0.0)),
                        daynight=row.get("daynight", "D"),
                    )
                )
            except ValueError:
                continue

        return points

    @staticmethod
    def summarize_hotspots(
        points: List[ActiveFirePoint],
        bbox: Optional[Tuple[float, float, float, float]] = None,
    ) -> Dict[str, Any]:
        """Summarize active fire detections within an optional AOI bounding box."""
        filtered = points
        if bbox is not None:
            min_lon, min_lat, max_lon, max_lat = bbox
            filtered = [
                p
                for p in points
                if (min_lon <= p.longitude <= max_lon) and (min_lat <= p.latitude <= max_lat)
            ]

        if not filtered:
            return {
                "total_hotspots": 0,
                "high_confidence_hotspots": 0,
                "nominal_confidence_hotspots": 0,
                "low_confidence_hotspots": 0,
                "first_detection_utc": None,
                "last_detection_utc": None,
                "max_frp_mw": 0.0,
                "mean_frp_mw": 0.0,
                "scientific_disclaimer": (
                    "FIRMS active fire hotspots represent instantaneous thermal anomalies "
                    "and are never used as pixel-level burned-area ground truth."
                ),
            }

        timestamps = sorted(p.acq_datetime_utc for p in filtered if p.acq_datetime_utc)
        frps = [p.frp for p in filtered]
        confs = [p.confidence_normalized for p in filtered]
        return {
            "total_hotspots": len(filtered),
            "high_confidence_hotspots": sum(1 for c in confs if c == "HIGH"),
            "nominal_confidence_hotspots": sum(1 for c in confs if c == "NOMINAL"),
            "low_confidence_hotspots": sum(1 for c in confs if c == "LOW"),
            "first_detection_utc": timestamps[0] if timestamps else None,
            "last_detection_utc": timestamps[-1] if timestamps else None,
            "max_frp_mw": round(float(max(frps)), 2),
            "mean_frp_mw": round(float(sum(frps) / len(frps)), 2),
            "scientific_disclaimer": (
                "FIRMS active fire hotspots represent instantaneous thermal anomalies "
                "and are never used as pixel-level burned-area ground truth."
            ),
        }
