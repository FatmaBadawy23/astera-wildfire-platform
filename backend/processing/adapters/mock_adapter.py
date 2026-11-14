"""Mock SAR Adapter and Deterministic Synthetic Data Generator.

Generates scientifically realistic SAR scenes with planted burn scars for testing
and pipeline verification without live satellite internet downloads.
All products are explicitly labelled is_synthetic=True and SYNTHETIC DATA.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import h5py
import numpy as np

from backend.processing.adapters.base import (
    BaseSARAdapter,
    Polarization,
    ProductType,
    RasterLayer,
    SARScene,
    SensorType,
    ValidationReport,
)


class MockSARAdapter(BaseSARAdapter):
    """Adapter for synthetic mock SAR datasets."""

    def inspect(self, file_path: Path) -> Dict[str, Any]:
        file_path = Path(file_path)
        return {
            "file_name": file_path.name,
            "sensor": SensorType.MOCK.value,
            "product_type": ProductType.MOCK.value,
            "is_synthetic": True,
            "polarizations": ["HH", "HV"],
        }

    def validate(self, file_path: Path) -> ValidationReport:
        return ValidationReport(
            is_valid=True,
            warnings=["File is a synthetic mock dataset, NOT real satellite observations."],
            quality_flags={"is_mock": True},
        )

    def load(
        self,
        file_path: Path,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        polarizations: Optional[List[str]] = None,
    ) -> SARScene:
        """Load synthetic scene from disk or generate on the fly."""
        file_path = Path(file_path)
        if file_path.suffix.lower() in [".h5", ".hdf5"]:
            # Load HDF5 mock
            with h5py.File(file_path, "r") as h5:
                grid = h5["science/LSAR/GCOV/grids/frequencyA"]
                x_coords = grid["xCoordinates"][:]
                y_coords = grid["yCoordinates"][:]
                dx = float(abs(x_coords[1] - x_coords[0]))
                dy = float(abs(y_coords[1] - y_coords[0]))

                layers: Dict[str, RasterLayer] = {}
                for pol in ["HHHH", "HVHV"]:
                    if pol in grid:
                        layers[pol] = RasterLayer(
                            name=pol,
                            data=grid[pol][:].astype(np.float32),
                            unit="linear_power",
                            description=f"Synthetic {pol} backscatter power",
                        )

                top_left_x = float(x_coords[0] - dx / 2.0)
                top_left_y = float(y_coords[0] + dy / 2.0)
                transform = (top_left_x, dx, 0.0, top_left_y, 0.0, -dy)

                return SARScene(
                    scene_id=file_path.stem,
                    sensor=SensorType.MOCK,
                    product_type=ProductType.MOCK,
                    acquisition_time="2026-07-01T00:00:00Z",
                    crs="EPSG:32610",
                    transform=transform,
                    bounds=(float(x_coords.min()), float(y_coords.min()), float(x_coords.max()), float(y_coords.max())),
                    pixel_spacing=(dx, dy),
                    layers=layers,
                    is_synthetic=True,
                    data_origin="SYNTHETIC_MOCK_DATA",
                    validation_report=self.validate(file_path),
                )
        else:
            raise NotImplementedError(f"Unsupported mock file format: {file_path.suffix}")


def generate_paired_sar_scene(
    height: int = 512,
    width: int = 512,
    pixel_spacing: float = 20.0,
    seed: int = 42,
    burn_center: Optional[Tuple[int, int]] = None,
    burn_radius: int = 80,
    epsg: int = 32610,
) -> Tuple[SARScene, SARScene, np.ndarray]:
    """Generates a realistic pre-fire and post-fire SAR pair and the ground-truth burned area mask."""
    rng = np.random.default_rng(seed)
    if burn_center is None:
        burn_center = (width // 2, height // 2)

    # Base unburned backscatter in dB
    hh_pre_db = rng.normal(loc=-9.0, scale=1.5, size=(height, width)).astype(np.float32)
    hv_pre_db = rng.normal(loc=-15.0, scale=1.8, size=(height, width)).astype(np.float32)

    # Convert to linear power
    hh_pre_p = 10.0 ** (hh_pre_db / 10.0)
    hv_pre_p = 10.0 ** (hv_pre_db / 10.0)

    # Create realistic spatial burn scar with fractal/irregular boundary
    yy, xx = np.ogrid[:height, :width]
    dist_from_center = np.sqrt((xx - burn_center[0]) ** 2 + (yy - burn_center[1]) ** 2)

    # Add Perlin/Fourier low-frequency spatial noise for organic fire boundary
    noise = rng.normal(0, 1, size=(height, width))
    # Gaussian blur the noise
    from scipy.ndimage import gaussian_filter
    smooth_boundary = gaussian_filter(noise, sigma=12.0) * 25.0

    burn_mask = ((dist_from_center + smooth_boundary) <= burn_radius).astype(np.uint8)

    # Post-fire backscatter
    hh_post_db = hh_pre_db.copy()
    hv_post_db = hv_pre_db.copy()

    # Drop backscatter inside burn scar (severe drop in cross-pol HV)
    severity = gaussian_filter(burn_mask.astype(np.float32), sigma=4.0)
    hv_post_db -= severity * 5.2  # -5.2 dB volume scattering loss
    hh_post_db -= severity * 2.8  # -2.8 dB co-pol change

    # Add temporal variation (soil moisture fluctuation) outside burn scar
    temporal_noise_hh = rng.normal(0, 0.4, size=(height, width)).astype(np.float32)
    temporal_noise_hv = rng.normal(0, 0.4, size=(height, width)).astype(np.float32)
    hh_post_db += temporal_noise_hh * (1 - severity)
    hv_post_db += temporal_noise_hv * (1 - severity)

    # Convert post to linear power
    hh_post_p = 10.0 ** (hh_post_db / 10.0)
    hv_post_p = 10.0 ** (hv_post_db / 10.0)

    # Apply 4-look Gamma speckle (mean=1.0, shape=4, scale=1/4)
    looks = 4.0
    speckle_pre = rng.gamma(shape=looks, scale=1.0 / looks, size=(height, width)).astype(np.float32)
    speckle_post = rng.gamma(shape=looks, scale=1.0 / looks, size=(height, width)).astype(np.float32)

    hh_pre_speckled = np.maximum(hh_pre_p * speckle_pre, 1e-7)
    hv_pre_speckled = np.maximum(hv_pre_p * speckle_pre, 1e-7)
    hh_post_speckled = np.maximum(hh_post_p * speckle_post, 1e-7)
    hv_post_speckled = np.maximum(hv_post_p * speckle_post, 1e-7)

    # Coordinates
    origin_x, origin_y = 650000.0, 4950000.0  # UTM Zone 10N
    transform = (origin_x, pixel_spacing, 0.0, origin_y, 0.0, -pixel_spacing)
    bounds = (origin_x, origin_y - height * pixel_spacing, origin_x + width * pixel_spacing, origin_y)

    pre_layers = {
        "HHHH": RasterLayer("HHHH", hh_pre_speckled, unit="linear_power", description="Pre-fire HH gamma-0"),
        "HVHV": RasterLayer("HVHV", hv_pre_speckled, unit="linear_power", description="Pre-fire HV gamma-0"),
        "mask": RasterLayer("mask", np.ones((height, width), dtype=np.uint8), unit="mask", description="Valid subswath mask (1=subswath 1)"),
    }
    post_layers = {
        "HHHH": RasterLayer("HHHH", hh_post_speckled, unit="linear_power", description="Post-fire HH gamma-0"),
        "HVHV": RasterLayer("HVHV", hv_post_speckled, unit="linear_power", description="Post-fire HV gamma-0"),
        "mask": RasterLayer("mask", np.ones((height, width), dtype=np.uint8), unit="mask", description="Valid subswath mask (1=subswath 1)"),
    }

    pre_scene = SARScene(
        scene_id="MOCK_NISAR_GCOV_PRE_FIRE",
        sensor=SensorType.MOCK,
        product_type=ProductType.GCOV,
        acquisition_time="2026-07-01T14:30:00Z",
        crs=f"EPSG:{epsg}",
        transform=transform,
        bounds=bounds,
        pixel_spacing=(pixel_spacing, pixel_spacing),
        layers=pre_layers,
        is_synthetic=True,
        data_origin="SYNTHETIC_MOCK_DATA",
    )

    post_scene = SARScene(
        scene_id="MOCK_NISAR_GCOV_POST_FIRE",
        sensor=SensorType.MOCK,
        product_type=ProductType.GCOV,
        acquisition_time="2026-08-25T14:30:00Z",
        crs=f"EPSG:{epsg}",
        transform=transform,
        bounds=bounds,
        pixel_spacing=(pixel_spacing, pixel_spacing),
        layers=post_layers,
        is_synthetic=True,
        data_origin="SYNTHETIC_MOCK_DATA",
    )

    return pre_scene, post_scene, burn_mask


def write_mock_hdf5(scene: SARScene, output_path: Path) -> Path:
    """Saves a SARScene into a NISAR-compliant HDF5 structure."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with h5py.File(output_path, "w") as h5:
        grid_grp = h5.create_group("science/LSAR/GCOV/grids/frequencyA")
        h, w = scene.dimensions
        dx, dy = scene.pixel_spacing
        top_left_x, _, _, top_left_y, _, _ = scene.transform

        x_coords = top_left_x + np.arange(w) * dx + dx / 2.0
        y_coords = top_left_y - np.arange(h) * dy - dy / 2.0

        grid_grp.create_dataset("xCoordinates", data=x_coords)
        grid_grp.create_dataset("yCoordinates", data=y_coords)
        grid_grp.create_dataset("listOfPolarizations", data=[p.encode("utf-8") for p in scene.layers.keys() if p != "mask"])

        for name, layer in scene.layers.items():
            ds = grid_grp.create_dataset(name, data=layer.data, compression="gzip", compression_opts=4)
            ds.attrs["unit"] = layer.unit
            ds.attrs["description"] = layer.description

        # Projection metadata
        epsg = int(scene.crs.split(":")[-1]) if ":" in scene.crs else 32610
        proj_ds = grid_grp.create_dataset("projection", data=epsg)
        proj_ds.attrs["epsg_code"] = epsg

        # Identification
        id_grp = h5.create_group("science/LSAR/GCOV/identification")
        id_grp.create_dataset("zeroDopplerStartTime", data=scene.acquisition_time.encode("utf-8"))
        id_grp.create_dataset("is_synthetic", data=1 if scene.is_synthetic else 0)
        id_grp.attrs["WARNING"] = "SYNTHETIC MOCK DATA - NOT REAL SATELLITE OBSERVATIONS"

    return output_path
