"""Verified 2026 wildfire event specifications used by the real-data pipeline.

Event identities and reported ignition dates/acreages come from public incident
reporting. Burn-scar centroids and burn-date windows are *computed from MCD64A1*, not
hand-entered. Every acquisition is selected dynamically from STAC at run time; the dates
below define the target windows, not guaranteed granule IDs.

This catalogue replaces the fabricated ``data/events_manifest.json`` entries used by the
synthetic pipeline. The synthetic manifest is retained, with a provenance warning, so the
old results remain reproducible.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass(frozen=True)
class S1Request:
    date: str
    role: str  # "pre", "mid", "post", "post2"


@dataclass(frozen=True)
class S2Request:
    date: str
    role: str


@dataclass(frozen=True)
class EventSpec:
    event_id: str
    name: str
    region: str
    split: str
    center_lon: float
    center_lat: float
    reported_start: str
    reported_acres: int
    mcd_burn_start_doy: int
    mcd_burn_end_doy: int
    mcd_items: List[str]
    s1_relative_orbit: int
    s1_pass: str
    s1_dates: List[S1Request]
    s2_dates: List[S2Request]
    aoi_half_m: float = 8000.0
    include_in_training: bool = True
    notes: str = ""
    provenance: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "name": self.name,
            "region": self.region,
            "split": self.split,
            "center_lon": self.center_lon,
            "center_lat": self.center_lat,
            "reported_start": self.reported_start,
            "reported_acres": self.reported_acres,
            "mcd_burn_start_doy": self.mcd_burn_start_doy,
            "mcd_burn_end_doy": self.mcd_burn_end_doy,
            "mcd_items": self.mcd_items,
            "s1_relative_orbit": self.s1_relative_orbit,
            "s1_pass": self.s1_pass,
            "s1_dates": [d.__dict__ for d in self.s1_dates],
            "s2_dates": [d.__dict__ for d in self.s2_dates],
            "aoi_half_m": self.aoi_half_m,
            "include_in_training": self.include_in_training,
            "notes": self.notes,
            "provenance": self.provenance,
        }


AUG_MCD = "MCD64A1.A2026213.h08v05.061.2026286121320"
SEP_MCD = "MCD64A1.A2026244.h08v05.061.2026314113209"

# Burn-scar centroids computed from MCD64A1 in this study (EPSG:4326).
EVENTS: List[EventSpec] = [
    EventSpec(
        event_id="CA_GANN_2026",
        name="Gann Fire",
        region="Calaveras County, California",
        split="TRAIN",
        center_lon=-120.734,
        center_lat=38.113,
        reported_start="2026-08-03",
        reported_acres=10339,
        mcd_burn_start_doy=215,
        mcd_burn_end_doy=222,
        mcd_items=[AUG_MCD],
        s1_relative_orbit=42,
        s1_pass="descending",
        s1_dates=[
            S1Request("2026-07-26", "pre"),
            S1Request("2026-08-07", "mid"),
            S1Request("2026-08-19", "post"),
            S1Request("2026-08-31", "post2"),
        ],
        s2_dates=[
            S2Request("2026-07-29", "pre"),
            S2Request("2026-08-30", "post"),
        ],
        notes="Small grass/woodland fire; reported acreage is public incident reporting.",
    ),
    EventSpec(
        event_id="CA_TIMBER_2026",
        name="Timber Fire",
        region="Monterey County, California",
        split="TRAIN",
        center_lon=-121.668,
        center_lat=36.211,
        reported_start="2026-08-09",
        reported_acres=25435,
        mcd_burn_start_doy=219,
        mcd_burn_end_doy=243,
        mcd_items=[AUG_MCD],
        s1_relative_orbit=35,
        s1_pass="ascending",
        s1_dates=[
            S1Request("2026-08-07", "pre"),
            S1Request("2026-08-19", "mid"),
            S1Request("2026-08-31", "post"),
            S1Request("2026-09-12", "post2"),
        ],
        s2_dates=[
            S2Request("2026-07-27", "pre"),
            S2Request("2026-08-26", "post"),
        ],
        notes="Excluded from training: the MCD64A1 label in this AOI aggregates the overlapping Timber/Plaskett complex, and Sentinel-1 VH showed no coherent scar (median log-ratio +0.07 dB inside vs -0.08 dB outside). Retained as acquisition evidence only.",
        include_in_training=False,
    ),
    EventSpec(
        event_id="CA_DOME_2026",
        name="Dome Fire",
        region="Yosemite area, California",
        split="VAL",
        center_lon=-119.613,
        center_lat=37.612,
        reported_start="2026-09-21",
        reported_acres=6159,
        mcd_burn_start_doy=244,
        mcd_burn_end_doy=273,
        mcd_items=[SEP_MCD],
        s1_relative_orbit=144,
        s1_pass="descending",
        s1_dates=[
            S1Request("2026-09-13", "pre"),
            S1Request("2026-10-01", "mid"),
            S1Request("2026-10-07", "post"),
            S1Request("2026-10-19", "post2"),
        ],
        s2_dates=[
            S2Request("2026-09-12", "pre"),
            S2Request("2026-10-07", "post"),
        ],
        notes="Small fire; MCD64A1 shows only ~74 burned 500 m cells, a known limitation.",
    ),
    EventSpec(
        event_id="CA_BUG_2026",
        name="Bug Fire",
        region="Lassen/Sierra California and Washoe County, Nevada",
        split="TEST",
        center_lon=-119.887,
        center_lat=39.830,
        reported_start="2026-08-08",
        reported_acres=93733,
        mcd_burn_start_doy=219,
        mcd_burn_end_doy=240,
        mcd_items=[AUG_MCD],
        s1_relative_orbit=64,
        s1_pass="ascending",
        s1_dates=[
            S1Request("2026-08-03", "pre"),
            S1Request("2026-08-15", "mid"),
            S1Request("2026-08-27", "post"),
            S1Request("2026-09-08", "post2"),
        ],
        s2_dates=[
            S2Request("2026-08-06", "pre"),
            S2Request("2026-08-30", "post"),
        ],
        notes="Held-out test event. Large sagebrush/forest scar north of Reno.",
    ),
]

EVENTS_BY_ID = {e.event_id: e for e in EVENTS}

TRAIN_EVENTS = [e for e in EVENTS if e.split == "TRAIN"]
VAL_EVENTS = [e for e in EVENTS if e.split == "VAL"]
TEST_EVENTS = [e for e in EVENTS if e.split == "TEST"]
