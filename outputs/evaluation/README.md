# Evaluation artifacts

| File | Status | Description |
|---|---|---|
| `real_model_comparison.json` | **CURRENT** | Real Sentinel-1/Sentinel-2/MCD64A1 cross-sensor experiment. This is the file served by the API. |
| `real_test_maps.png` | **CURRENT** | Held-out TEST event QA figure (generated; ignored by Git). |
| `real_predictions/*.npz` | **CURRENT** | Full-scene prediction maps (generated; ignored by Git). |
| `scientific_model_comparison.json` | **SUPERSEDED - SYNTHETIC** | Historical output of `scripts/run_scientific_pipeline.py` using synthetic mock scenes. Do not cite as real or NISAR results. |

The current report is reproducible with:

```powershell
python scripts/acquire_real_data.py --event all
python scripts/build_real_dataset.py
python scripts/run_real_pipeline.py --epochs 8
```

`real_model_comparison.json` records `data_origin = CROSS_SENSOR_PROTOTYPE` and
`is_nisar = false`. No NISAR scene was available.
