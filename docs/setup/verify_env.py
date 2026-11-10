"""Verify the `astera` Conda environment: imports, versions, GDAL/PROJ paths.

Run with:  conda run -n astera python docs/setup/verify_env.py
Read-only: it only reads versions/paths and does in-memory transforms.
"""
import importlib
import os
import sys

ok = True

print("== Interpreter")
print("  executable :", sys.executable)
print("  version    :", sys.version.split()[0])
if not sys.version.startswith("3.11"):
    ok = False
    print("  !! expected Python 3.11")

print("\n== Imports")
modules = [
    "fastapi", "uvicorn", "pydantic", "pydantic_settings", "sqlalchemy",
    "geoalchemy2", "psycopg", "alembic", "httpx", "dotenv",
    "osgeo.gdal", "rasterio", "h5py", "numpy", "scipy", "geopandas",
    "shapely", "pyproj", "matplotlib", "pytest", "jupyterlab", "ipykernel",
]
for name in modules:
    try:
        m = importlib.import_module(name)
        print(f"  OK   {name:18} {getattr(m, '__version__', '')}")
    except Exception as e:  # noqa: BLE001
        ok = False
        print(f"  FAIL {name:18} {type(e).__name__}: {e}")

print("\n== Native library versions")
try:
    from osgeo import gdal, osr
    import rasterio, pyproj, shapely, geopandas, h5py

    gdal.UseExceptions()
    print("  GDAL (osgeo)      :", gdal.__version__)
    print("  GDAL (rasterio)   :", rasterio.__gdal_version__)
    print("  PROJ (rasterio)   :", rasterio.__proj_version__)
    print("  PROJ (pyproj)     :", pyproj.proj_version_str)
    print("  PROJ (osgeo)      :", f"{osr.GetPROJVersionMajor()}.{osr.GetPROJVersionMinor()}.{osr.GetPROJVersionMicro()}")
    print("  GEOS (shapely)    :", shapely.geos_version_string)
    print("  HDF5 (h5py)       :", h5py.version.hdf5_version)
    if gdal.__version__.rsplit(".", 1)[0] != rasterio.__gdal_version__.rsplit(".", 1)[0]:
        ok = False
        print("  !! GDAL mismatch between osgeo and rasterio")
except Exception as e:  # noqa: BLE001
    ok = False
    print("  FAIL", type(e).__name__, e)

print("\n== GDAL / PROJ data paths")
for var in ("GDAL_DATA", "PROJ_DATA", "PROJ_LIB", "CONDA_PREFIX"):
    print(f"  env {var:12}:", os.environ.get(var))
try:
    print("  gdal GDAL_DATA   :", gdal.GetConfigOption("GDAL_DATA"))
    print("  pyproj data dir  :", pyproj.datadir.get_data_dir())
    prefix = os.environ.get("CONDA_PREFIX") or sys.prefix
    for label, path in (("pyproj data dir", pyproj.datadir.get_data_dir()),
                        ("GDAL_DATA", os.environ.get("GDAL_DATA") or "")):
        if "PostgreSQL" in path or not os.path.normcase(path).startswith(os.path.normcase(prefix)):
            ok = False
            print(f"  !! {label} does not point inside the astera env")
except Exception as e:  # noqa: BLE001
    ok = False
    print("  FAIL", type(e).__name__, e)

print("\n== Functional checks (in memory)")
try:
    t = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True)
    x, y = t.transform(-120.0, 38.0)
    print(f"  pyproj 4326->6933 : ({x:.1f}, {y:.1f})")
    print("  rasterio CRS      :", rasterio.crs.CRS.from_epsg(32610).to_string())
    srs = osr.SpatialReference(); srs.ImportFromEPSG(4326)
    print("  osgeo EPSG:4326   :", srs.GetName())
    print("  GDAL HDF5 driver  :", "present" if gdal.GetDriverByName("HDF5") else "MISSING")
    print("  GDAL GTiff driver :", "present" if gdal.GetDriverByName("GTiff") else "MISSING")
    if not gdal.GetDriverByName("HDF5"):
        ok = False
    import geopandas as gpd
    from shapely.geometry import Point
    g = gpd.GeoSeries([Point(-120, 38)], crs="EPSG:4326").to_crs("EPSG:6933")
    print("  geopandas to_crs  :", g.iloc[0].wkt[:40])
except Exception as e:  # noqa: BLE001
    ok = False
    print("  FAIL", type(e).__name__, e)

print("\nRESULT:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
