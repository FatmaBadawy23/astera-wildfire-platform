"""Unit tests for SAR adapters and HDF5 readers."""

import tempfile
from pathlib import Path
import h5py
import numpy as np
import pytest

from backend.processing.adapters.mock_adapter import (
    MockSARAdapter,
    generate_paired_sar_scene,
    write_mock_hdf5,
)
from backend.processing.adapters.nisar_gcov_adapter import (
    NISAR_GCOV_Adapter,
    decode_nisar_mask,
    gamma0_to_sigma0,
)


def test_mock_adapter_generation():
    pre, post, mask = generate_paired_sar_scene(height=128, width=128, seed=42)
    assert pre.dimensions == (128, 128)
    assert post.dimensions == (128, 128)
    assert mask.shape == (128, 128)
    assert "HHHH" in pre.layers
    assert "HVHV" in pre.layers
    assert pre.is_synthetic is True
    assert np.count_nonzero(mask) > 0


def test_nisar_gcov_adapter_read():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        pre, _, _ = generate_paired_sar_scene(height=64, width=64, seed=42)
        h5_file = tmp_path / "test_gcov.h5"
        write_mock_hdf5(pre, h5_file)

        adapter = NISAR_GCOV_Adapter()
        # Inspect
        info = adapter.inspect(h5_file)
        assert info["product_type"] == "GCOV"
        assert "HHHH" in info["polarizations"]
        assert info["crs"] == "EPSG:32610"

        # Validate
        val = adapter.validate(h5_file)
        assert val.is_valid is True

        # Load
        scene = adapter.load(h5_file)
        assert scene.dimensions == (64, 64)
        assert "HHHH" in scene.layers
        assert scene.layers["HHHH"].data.shape == (64, 64)
        assert "valid_mask" in scene.layers
        assert np.all(scene.layers["valid_mask"].data == 1)


def test_nisar_adapter_fails_closed_on_missing_timestamp_and_projection():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        pre, _, _ = generate_paired_sar_scene(height=32, width=32, seed=7)
        h5_file = tmp_path / "missing_meta.h5"
        write_mock_hdf5(pre, h5_file)

        # Remove zeroDopplerStartTime and projection dataset
        with h5py.File(h5_file, "a") as h5:
            del h5["science/LSAR/GCOV/identification/zeroDopplerStartTime"]
            del h5["science/LSAR/GCOV/grids/frequencyA/projection"]

        adapter = NISAR_GCOV_Adapter()
        val = adapter.validate(h5_file)
        assert val.is_valid is False
        assert any("zeroDopplerStartTime" in e for e in val.errors)
        assert any("projection" in e for e in val.errors)

        with pytest.raises(ValueError, match="Invalid NISAR GCOV file"):
            adapter.load(h5_file)


def test_nisar_adapter_complex_off_diagonal_sigma0_and_stateless_frequency():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        h5_file = tmp_path / "freqB_complex.h5"
        with h5py.File(h5_file, "w") as h5:
            grid = h5.create_group("science/LSAR/GCOV/grids/frequencyB")
            x = np.linspace(500000.0, 500300.0, 16)
            y = np.linspace(4200300.0, 4200000.0, 16)
            grid.create_dataset("xCoordinates", data=x)
            grid.create_dataset("yCoordinates", data=y)
            grid.create_dataset(
                "listOfPolarizations", data=[b"VV", b"VH"]
            )
            grid.create_dataset(
                "listOfCovarianceTerms", data=[b"VVVV", b"VHVH", b"HHHV"]
            )
            grid.create_dataset("VVVV", data=np.full((16, 16), 0.2, dtype=np.float32))
            grid.create_dataset("VHVH", data=np.full((16, 16), 0.04, dtype=np.float32))
            complex_cov = (
                np.full((16, 16), 0.01, dtype=np.float32)
                + 1j * np.full((16, 16), -0.005, dtype=np.float32)
            ).astype(np.complex64)
            grid.create_dataset("HHHV", data=complex_cov)
            grid.create_dataset(
                "rtcGammaToSigmaFactor", data=np.full((16, 16), 0.5, dtype=np.float32)
            )
            mask_arr = np.ones((16, 16), dtype=np.uint8)
            mask_arr[0, 0] = 0    # invalid radar shadow
            mask_arr[0, 1] = 255  # fill outside swath
            grid.create_dataset("mask", data=mask_arr)
            proj = grid.create_dataset("projection", data=32611)
            proj.attrs["epsg_code"] = 32611

            id_grp = h5.create_group("science/LSAR/GCOV/identification")
            id_grp.create_dataset(
                "zeroDopplerStartTime", data=b"2026-09-14T01:54:23Z"
            )

        adapter = NISAR_GCOV_Adapter()
        orig_grid_path = adapter.grid_path
        info = adapter.inspect(h5_file)
        # Must not mutate self.grid_path
        assert adapter.grid_path == orig_grid_path
        assert "VVVV" in info["diagonal_polarizations"]
        assert "HHHV" in info["off_diagonal_terms"]

        scene = adapter.load(h5_file, convert_to_sigma0=True)
        assert scene.crs == "EPSG:32611"
        assert scene.acquisition_time == "2026-09-14T01:54:23Z"
        # Gamma-0 (0.2) * rtc_factor (0.5) == Sigma-0 (0.1)
        assert np.allclose(scene.layers["VVVV"].data, 0.1)
        # Complex off-diagonal preserved as complex64
        assert np.issubdtype(scene.layers["HHHV"].data.dtype, np.complexfloating)
        # Mask decoded properly
        assert scene.layers["valid_mask"].data[0, 0] == 0
        assert scene.layers["valid_mask"].data[0, 1] == 0
        assert scene.layers["valid_mask"].data[5, 5] == 1


def test_asf_bytes_extraction_and_harmony_url_builder():
    from backend.processing.acquisition.asf_client import (
        _extract_asf_bytes,
        build_harmony_subset_url,
    )

    scene = "NISAR_L2_PR_GCOV_026_042_D_069_4005_DHDH_A_20260723T025606_20260723T025641_P05023_N_F_J_001"
    nested_bytes = {
        f"{scene}.png": {"bytes": 124500, "format": "PNG"},
        f"{scene}.h5": {"bytes": 7099342848, "format": "HDF5"},
    }
    assert _extract_asf_bytes(nested_bytes, scene_name=scene) == 7099342848.0
    assert _extract_asf_bytes(1048576) == 1048576.0
    assert _extract_asf_bytes(None) == 0.0

    url = build_harmony_subset_url(
        "C2854338529-ASF",
        "G4260296005-ASF",
        (-120.82, 38.03, -120.64, 38.18),
        target_crs="EPSG:32610",
    )
    assert "C2854338529-ASF/ogc-api-coverages/1.0.0" in url
    assert "granuleId=G4260296005-ASF" in url
    assert "subset=lat(" in url
    assert "HHHH" in url


def test_coarse_block_reconciliation_metrics():
    from backend.processing.validation.metrics import (
        calculate_coarse_block_reconciliation_metrics,
    )

    y_pred = np.zeros((100, 100), dtype=np.uint8)
    y_ref = np.zeros((100, 100), dtype=np.uint8)
    y_pred[:50, :50] = 1
    y_ref[:50, :50] = 1
    valid = np.ones((100, 100), dtype=np.uint8)

    res = calculate_coarse_block_reconciliation_metrics(
        y_pred, y_ref, valid_mask_20m=valid, block_size_px=25
    )
    assert res["valid_500m_blocks"] == 16
    assert res["fractional_burn_mae"] == 0.0
    assert res["block_classification_metrics"]["f1_score"] == 1.0
