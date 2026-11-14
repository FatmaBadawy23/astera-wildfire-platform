import sys
import numpy as np
sys.path.insert(0, ".")
from backend.processing.acquisition.event_specs import EVENTS_BY_ID
from backend.processing.preprocessing.grid import build_local_grid, read_to_grid
from backend.processing.acquisition.planetary_computer import stac_search, item_datetime, asset_href
from rasterio.enums import Resampling

e = EVENTS_BY_ID["CA_GANN_2026"]
g = build_local_grid(e.center_lon, e.center_lat, 8000, 20)
fs = stac_search("sentinel-2-l2a", (-120.83, 38.03, -120.63, 38.19), "2026-07-25/2026-09-02", limit=100, query={"eo:cloud_cover": {"lt": 30}})
for f in sorted(fs, key=item_datetime):
    d = item_datetime(f)[:10]
    if d not in ("2026-07-27", "2026-07-29", "2026-08-01", "2026-08-03", "2026-08-26", "2026-08-30", "2026-08-31"):
        continue
    scl = read_to_grid(asset_href(f, "SCL"), g, resampling=Resampling.nearest, dtype="uint8", collection="sentinel-2-l2a")
    valid = np.isin(scl, [4, 5, 6, 7]).mean()
    print(d, f["id"].split("_")[-2], "valid", round(float(valid), 3), "class0", round(float((scl == 0).mean()), 3), "cloud", round(float(f["properties"]["eo:cloud_cover"]), 1))
