"""Build a common local analysis grid and reproject public raster assets onto it.

The analysis grid is a 20 m UTM grid centred on a fire's burn-scar centroid. Keeping
every sensor on the same grid is what makes the paired pre/post patches comparable.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import Affine, from_origin
from rasterio.vrt import WarpedVRT
from rasterio.warp import reproject, transform as warp_transform

from backend.processing.acquisition.planetary_computer import open_signed


@dataclass(frozen=True)
class TargetGrid:
    """A north-up UTM analysis grid."""

    crs: str
    transform: Affine
    width: int
    height: int
    res_m: float

    @property
    def bounds(self) -> Tuple[float, float, float, float]:
        left = self.transform.c
        top = self.transform.f
        right = left + self.width * self.transform.a
        bottom = top + self.height * self.transform.e
        return (left, bottom, right, top)


def utm_crs_for_lonlat(lon: float, lat: float) -> str:
    zone = int(math.floor((lon + 180.0) / 6.0)) + 1
    zone = min(max(zone, 1), 60)
    if lat >= 0:
        return f"EPSG:{32600 + zone}"
    return f"EPSG:{32700 + zone}"


def build_local_grid(
    center_lon: float,
    center_lat: float,
    half_size_m: float = 8000.0,
    res_m: float = 20.0,
) -> TargetGrid:
    """Create a square UTM grid centred as closely as possible on the given point."""
    crs = utm_crs_for_lonlat(center_lon, center_lat)
    x, y = warp_transform("EPSG:4326", crs, [center_lon], [center_lat])
    cx, cy = float(x[0]), float(y[0])

    left = math.floor((cx - half_size_m) / res_m) * res_m
    top = math.ceil((cy + half_size_m) / res_m) * res_m
    width = int(round((2 * half_size_m) / res_m))
    height = width
    return TargetGrid(crs=crs, transform=from_origin(left, top, res_m, res_m), width=width, height=height, res_m=res_m)


def read_to_grid(
    href: str,
    grid: TargetGrid,
    resampling: Resampling = Resampling.bilinear,
    dtype: str = "float32",
    scale: float = 1.0,
    collection: Optional[str] = None,
) -> np.ndarray:
    """Read one asset band and reproject it onto the analysis grid."""
    with open_signed(href, collection=collection) as src:
        src_nodata = src.nodata
        with WarpedVRT(
            src,
            crs=grid.crs,
            transform=grid.transform,
            width=grid.width,
            height=grid.height,
            resampling=resampling,
            nodata=src_nodata,
        ) as vrt:
            arr = vrt.read(1).astype(dtype)
    if scale != 1.0:
        arr = arr * scale
    return arr


def read_mcd_burn_date_to_grid(
    href: str,
    grid: TargetGrid,
    burn_start_doy: int,
    burn_end_doy: int,
) -> Tuple[np.ndarray, np.ndarray]:
    """Reproject an MCD64A1 Burn_Date tile and build a binary event-window mask.

    Returns ``(burn_mask, burn_date)`` on the analysis grid. Pixels whose burn date is
    outside the event window are set to zero in the mask; the raw date is retained for
    provenance and quality checks.
    """
    from backend.processing.acquisition.planetary_computer import sign_href

    signed = sign_href(href)
    burn_date = np.zeros((grid.height, grid.width), dtype=np.int16)
    with rasterio.open(signed) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=burn_date,
            src_transform=src.transform,
            src_crs=src.crs,
            src_nodata=src.nodata,
            dst_transform=grid.transform,
            dst_crs=grid.crs,
            dst_nodata=-1,
            resampling=Resampling.nearest,
        )
    in_window = (burn_date >= burn_start_doy) & (burn_date <= burn_end_doy)
    return in_window.astype(np.uint8), burn_date


def read_mcd_layer_to_grid(
    href: str,
    grid: TargetGrid,
    dtype: str = "int16",
    dst_nodata: int = -1,
) -> np.ndarray:
    """Reproject an arbitrary MCD64A1 asset layer (Uncertainty, QA, First_Day, Last_Day) onto the analysis grid."""
    from backend.processing.acquisition.planetary_computer import sign_href

    signed = sign_href(href)
    dst = np.full((grid.height, grid.width), dst_nodata, dtype=dtype)
    with rasterio.open(signed) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=dst,
            src_transform=src.transform,
            src_crs=src.crs,
            src_nodata=src.nodata,
            dst_transform=grid.transform,
            dst_crs=grid.crs,
            dst_nodata=dst_nodata,
            resampling=Resampling.nearest,
        )
    return dst


def valid_fraction(array: np.ndarray) -> float:
    finite = np.isfinite(array) & (array > 0)
    return float(finite.mean()) if array.size else 0.0


def grid_metadata(grid: TargetGrid) -> Dict[str, Any]:
    return {
        "crs": grid.crs,
        "transform": list(grid.transform)[:6],
        "width": grid.width,
        "height": grid.height,
        "res_m": grid.res_m,
        "bounds": list(grid.bounds),
    }


def write_geotiff(path: str, array: np.ndarray, grid: TargetGrid, nodata: float = 0.0) -> None:
    """Write a single-band float32 GeoTIFF for visual QA."""
    profile = {
        "driver": "GTiff",
        "height": grid.height,
        "width": grid.width,
        "count": 1,
        "dtype": "float32",
        "crs": grid.crs,
        "transform": grid.transform,
        "nodata": nodata,
        "compress": "deflate",
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(array.astype(np.float32), 1)
