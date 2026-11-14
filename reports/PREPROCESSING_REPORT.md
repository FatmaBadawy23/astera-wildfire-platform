# SENSOR-AWARE PREPROCESSING & CO-REGISTRATION REPORT
## Astera Watch — Phase 4 Radiometric & Spatial Alignment Verification
**Challenge:** NASA Space Apps Challenge 2026 — *Dancing with the SARs*  
**Generated:** 2026-11-13

---

## 1. Co-Registration & Target Grid Specification

All multi-sensor layers (`Sentinel-1 RTC`, `Sentinel-2 L2A`, `MODIS MCD64A1.061`) for each wildfire event are warped via `rasterio.vrt.WarpedVRT` onto a single deterministic projected UTM target grid (`800 × 800` pixels at $20.0\text{ m} \times 20.0\text{ m}$ resolution = $16.0\text{ km} \times 16.0\text{ km} = 256.0\text{ km}^2$):

| Event ID | Target CRS | Affine Geotransform `(a, b, c, d, e, f)` | Bounds `(left, bottom, right, top)` (m) | Dimensions `(H, W)` | Co-Registration Verified? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`CA_GANN_2026`** | `EPSG:32610` (UTM 10N) | `(20.0, 0.0, 690640.0, 0.0, -20.0, 4228780.0)` | `(690640.0, 4212780.0, 706640.0, 4228780.0)` | `(800, 800)` | **YES (`19/19` arrays match)** |
| **`CA_DOME_2026`** | `EPSG:32611` (UTM 11N) | `(20.0, 0.0, 268420.0, 0.0, -20.0, 4172420.0)` | `(268420.0, 4156420.0, 284420.0, 4172420.0)` | `(800, 800)` | **YES (`19/19` arrays match)** |
| **`CA_BUG_2026`** | `EPSG:32611` (UTM 11N) | `(20.0, 0.0, 244920.0, 0.0, -20.0, 4420880.0)` | `(244920.0, 4404880.0, 260920.0, 4420880.0)` | `(800, 800)` | **YES (`19/19` arrays match)** |
| **`CA_TIMBER_2026`** | `EPSG:32610` (UTM 10N) | `(20.0, 0.0, 611340.0, 0.0, -20.0, 4015360.0)` | `(611340.0, 3999360.0, 627340.0, 4015360.0)` | `(800, 800)` | **YES (`19/19` arrays match)** |

- **Resampling Methods Enforced (`backend/processing/preprocessing/grid.py`):**
  - Continuous radar power ($\gamma^0_{\text{VV}}, \gamma^0_{\text{VH}}$) and optical surface reflectance (`B04`, `B08`, `B12`): **`Resampling.bilinear`** in linear domain (never interpolating dB values or categorical masks).
  - Categorical & ordinal layers (`SCL`, `MCD64A1 Burn_Date`, `Uncertainty`, `QA`, `First_Day`, `Last_Day`): **`Resampling.nearest`** with explicit `dst_nodata` (`255` for `uint8` `QA`/`Uncertainty`, `-1` for `int16` `Burn_Date`/`First_Day`/`Last_Day`) so valid `0` values (`QA == 0` water, `Burn_Date == 0` unburned land) are never corrupted.

---

## 2. Sensor-Aware SAR Radiometric Preprocessing

1. **Strict Linear-to-dB Conversion (`power_to_db_strict`):**
   $$\gamma^0_{\text{dB}} = 10 \log_{10}(\gamma^0_{\text{linear}}) \quad \text{for } \gamma^0_{\text{linear}} > 0\text{ and finite; } \text{NaN otherwise.}$$
   Missing swath-edge pixels (such as the $27.19\%$ swath edge in `CA_BUG_2026`) remain `NaN` and `valid_mask = 0` rather than being clamped to an artificial epsilon floor.
2. **NISAR L2 GCOV HDF5 Adapter (`backend/processing/adapters/nisar_gcov_adapter.py`):**
   - Validates `/science/LSAR/identification/zeroDopplerStartTime` and `/science/LSAR/GCOV/grids/frequencyA/projection` (fails closed with `ValueError` if missing).
   - Dynamically discovers diagonal (`HHHH`, `HVHV`, `VVVV`, `VHVH` as `float32`) and off-diagonal (`HHHV`, `HHVV`, `HVVV` as `complex64`) covariance terms.
   - Decodes `mask` (`0` = invalid/shadow/layover, `1..254` = valid subswath ID, `255` = fill outside swath).
   - Supports $\sigma^0 = \gamma^0 \times \text{rtcGammaToSigmaFactor}$ conversion.
3. **Optical & SAR Composite Validity Mask (`valid_mask`):**
   A pixel is valid (`valid_mask == 1`) if and only if:
   - Pre-fire and post-fire Sentinel-1 `VV` and `VH` $\gamma^0$ are finite and $> 0$
   - Pre-fire and post-fire Sentinel-2 `SCL` are in `{4, 5, 6, 7}` and not water (`SCL != 6`)
   - Pre-fire and post-fire `dNBR` is finite.
