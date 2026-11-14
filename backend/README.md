# FireScope

Analysis of thermal anomaly (hotspot) activity in Egypt, 2023-2025, from NASA FIRMS
MODIS and VIIRS (S-NPP, NOAA-20, NOAA-21) data.

## Important limits

- A hotspot is a satellite thermal detection, not a confirmed fire.
- Hotspot type 2 (other static land source) is flagged with `is_static_source`. These rows are kept but excluded from activity indices by default.
- MODIS (about 1 km) and VIIRS (about 375 m) counts are never added together as independent fires.
- A day with no records is a coverage fact, not proof of no fire.

## Status

| Phase | Status |
|---|---|
| 1 Data quality assessment | Done |
| 2 Cleaning | Done |
| 3 Sensor harmonization | Done |
| 4 Temporal, spatial, sensor and static-source analysis | Implemented; tests and real-data run pass (see `reports/phase4_analysis_report.md`) |
| 5 Fire Activity Index | Done (Design A, frozen baseline v1) |
| 6 Visualization | Pending |
| 7 Website integration | Blocked: website files not provided |
| 8 Final testing and docs | Pending |

## Run

```bash
pip install -r requirements.txt
python main.py phase3      # harmonization (reads data_cleand/processed)
python main.py phase4      # temporal/spatial analysis -> data/analysis
python main.py phase5 --new-baseline   # first run only: freezes data/index/baseline_v1.json
python main.py phase5      # Fire Activity Index -> data/index, reports/phase5_index_report.md
python main.py phase4      # Phase 4 analysis (reads data/harmonized, writes data/analysis and the report)
python -m pytest -q
```

`python main.py phase2` re-runs cleaning and rewrites the cleaned files. Use it only if needed.

## Layout

- `Data_Before_cleaning/` raw FIRMS downloads (read only)
- `data_cleand/processed/` Phase 2 cleaned files
- `data/harmonized/` Phase 3 outputs
- `data/analysis/` Phase 4 tables (one CSV each) and `run_info.json`
- `src/`, `tests/`, `reports/`, `docs/`

See `docs/data_dictionary.md` for the harmonized schema.
