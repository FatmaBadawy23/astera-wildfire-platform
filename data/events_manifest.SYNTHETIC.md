# Provenance warning: synthetic event manifest

`events_manifest.json` and `events_manifest.csv` in this directory are the **historical
synthetic** event fixtures used by `scripts/run_scientific_pipeline.py`.

- The events are fabricated.
- The HDF5 files in `data/mock/` are synthetic, NISAR-shaped mocks.
- Metrics produced from them are not real-world or NISAR results.
- The real, verified events and data are in `data/real/` and
  `backend/processing/acquisition/event_specs.py`.
- The API uses the real acquisition manifest, not these synthetic fixtures.

These files are retained only so the old synthetic pipeline remains reproducible and
clearly separated from the real-data experiment.
