"""Base interfaces and data models for Astera Watch SAR processing.

Preserves native metadata, enforces explicit data origin tracking, and prevents
unverified assumptions about satellite layouts.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


class SensorType(str, Enum):
    NISAR_L = "NISAR_L"
    NISAR_S = "NISAR_S"
    SENTINEL_1 = "SENTINEL_1"
    ALOS_2 = "ALOS_2"
    MOCK = "MOCK"


class ProductType(str, Enum):
    GCOV = "GCOV"
    GSLC = "GSLC"
    GRD = "GRD"
    RTC = "RTC"
    MOCK = "MOCK"


class Polarization(str, Enum):
    HH = "HH"
    HV = "HV"
    VV = "VV"
    VH = "VH"
    HHHH = "HHHH"
    HVHV = "HVHV"
    VVVV = "VVVV"
    VHVH = "VHVH"


@dataclass
class RasterLayer:
    """A single 2D raster array with associated metadata."""
    name: str
    data: np.ndarray  # 2D float32 or uint8 array
    nodata: Optional[float] = None
    unit: str = "linear_power"  # "linear_power", "dB", "dimensionless", "mask"
    description: str = ""

    @property
    def shape(self) -> Tuple[int, int]:
        return self.data.shape


@dataclass
class ValidationReport:
    """Verification results for an ingested SAR product."""
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    quality_flags: Dict[str, Any] = field(default_factory=dict)
    inspected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class SARScene:
    """Internal canonical SAR scene representation."""
    scene_id: str
    sensor: SensorType
    product_type: ProductType
    acquisition_time: str
    crs: str  # EPSG string, e.g. "EPSG:32610" or "EPSG:4326"
    transform: Tuple[float, float, float, float, float, float]  # Affine geotransform
    bounds: Tuple[float, float, float, float]  # (min_x, min_y, max_x, max_y)
    pixel_spacing: Tuple[float, float]  # (x_res, y_res) in meters
    layers: Dict[str, RasterLayer] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_synthetic: bool = False
    data_origin: str = "REAL_SATELLITE"
    validation_report: Optional[ValidationReport] = None

    def get_layer(self, name: str) -> Optional[RasterLayer]:
        return self.layers.get(name)

    @property
    def dimensions(self) -> Tuple[int, int]:
        """Returns (height, width)."""
        if not self.layers:
            return (0, 0)
        first_layer = next(iter(self.layers.values()))
        return first_layer.shape


class BaseSARAdapter(ABC):
    """Abstract base class for all SAR product readers."""

    @abstractmethod
    def inspect(self, file_path: Path) -> Dict[str, Any]:
        """Quickly read headers and metadata without loading full raster grids into memory."""
        pass

    @abstractmethod
    def validate(self, file_path: Path) -> ValidationReport:
        """Inspect product integrity, check for corrupted layers, valid coordinates, and nodata."""
        pass

    @abstractmethod
    def load(
        self,
        file_path: Path,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        polarizations: Optional[List[str]] = None,
    ) -> SARScene:
        """Load the SAR scene into the canonical SARScene object.

        Supports windowed / bounding-box subsetting to avoid loading massive files.
        """
        pass
