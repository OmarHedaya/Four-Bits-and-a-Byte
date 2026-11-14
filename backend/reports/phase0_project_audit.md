# FireScope - Project Audit (before Phase 3)

Audit date: 2026-11-13. Nothing was deleted during the audit.

## Key findings

1. The website is NOT in the uploaded project. No HTML, JS, or package file exists. Phase 7 is blocked until the site files are provided.
2. Phase 2 outputs are intact: 12 files, 225,243 rows, SHA-256 and row counts match `reports/phase2_validation_summary.csv`. The 6 original tests pass.
3. `src/config.py` pointed to `data/processed` and used Windows separators. The real folders are `data_cleand/processed` and `Data_Before_cleaning/`. Fixed in Phase 3 (backup in `_backup_before_phase3/`).
4. The NOAA-20 2023 Shapefile zip (`DL_FIRE_J1V-C2_845121 (1).zip`) is not in the project. Only its CSV conversion exists: `firescope_noaa20_2023_candidate.csv` (31,025 rows, 359 days, 6 missing days). January rows match the old file after numeric normalization. The candidate has the raw 15-column schema, not the cleaned 23-column schema.
5. `Data_Before_cleaning/VIIRS S-NPP/` holds a stray NOAA-20 2026 zip (`DL_FIRE_J1V-C2_844873_2026.zip`), byte-identical to the one in `VIIRS NOAA-20/`.
6. 2026 zips (MODIS, NOAA-20, NOAA-21) are outside the 2023-2025 scope and are unused.
7. The folder name `data_cleand` is misspelled. It was kept to avoid breaking references.
8. `src/__pycache__/` holds Python 3.8 bytecode and can be regenerated.
9. Static thermal sources (type 2) are 60-74% of VIIRS rows and about 15-17% of MODIS rows.

## File table

| File Path | File Type | Purpose | Current Status | Used By |
|---|---|---|---|---|
| Data_Before_cleaning/Modis/DL_FIRE_M-C61_84481{1,24,38}_202{3,4,5}.zip | zip (3) | Raw MODIS C6.1 archives | Original, keep | Phase 2 loader |
| Data_Before_cleaning/Modis/DL_FIRE_M-C61_*/fire_archive_*.csv + Readme.txt | csv/txt (3+3) | Extracted copies of the MODIS zips | Duplicate of zip content | Phase 2 hash check |
| Data_Before_cleaning/Modis/DL_FIRE_M-C61_844872_2026.zip | zip | MODIS 2026 | Out of scope | Nothing |
| Data_Before_cleaning/VIIRS NOAA-20/*_844848_2023, 844849_2024, 844850_2025.zip | zip (3) | Raw NOAA-20 archives (2023 is January only) | Original, keep | Phase 2 loader |
| Data_Before_cleaning/VIIRS NOAA-20/*_844873_2026.zip | zip | NOAA-20 2026 | Out of scope | Nothing |
| Data_Before_cleaning/VIIRS NOAA-21/*_844851_2023, 844852_2024, 844853_2025.zip | zip (3) | Raw NOAA-21 archives | Original, keep | Phase 2 loader |
| Data_Before_cleaning/VIIRS NOAA-21/*_844874_2026.zip | zip | NOAA-21 2026 | Out of scope | Nothing |
| Data_Before_cleaning/VIIRS S-NPP/*_844842_2023, 844845_2024, 844847_2025.zip | zip (3) | Raw S-NPP archives | Original, keep | Phase 2 loader |
| Data_Before_cleaning/VIIRS S-NPP/DL_FIRE_J1V-C2_844873_2026.zip | zip | Misplaced NOAA-20 2026 copy | Duplicate, archive candidate | Nothing |
| data_cleand/processed/{2023,2024,2025}/{MODIS,NOAA20,NOAA21,SNPP}_YYYY.csv | csv (12) | Phase 2 cleaned data, 23 columns | Verified by hash | Phase 3 |
| data_cleand/processed/2023/NOAA20_2023.csv | csv | Old January-only NOAA-20 2023 | Superseded, keep as backup | Not used in Phase 3 |
| data_cleand/processed/2023/firescope_noaa20_2023_candidate.csv | csv | Full-year NOAA-20 2023, raw schema | Validated, used in Phase 3 | Phase 3 |
| src/config.py | py | Paths, schema, archive list | Fixed paths in Phase 3 | All |
| src/data_loader.py | py | Reads CSVs from zips, SHA-256 | Unchanged | Phase 2 |
| src/data_cleaning.py | py | Standardizes rows, coverage rules | Unchanged | Phase 2, Phase 3 |
| src/run_phase2.py | py | Phase 2 pipeline and report | Path fix only | main.py |
| src/harmonize.py | py | Phase 3 harmonization | New | run_phase3.py |
| src/run_phase3.py | py | Phase 3 runner and report | New | main.py |
| main.py | py | Entry point (`phase2` or `phase3`) | Updated | User |
| tests/test_phase2_cleaning.py | py | 6 unit tests | Passing | pytest |
| tests/test_phase3_harmonization.py | py | 5 tests for Phase 3 | New, passing | pytest |
| reports/phase1_data_quality_report.md | md | Phase 1 findings | Complete | Reference |
| reports/phase2_cleaning_report.md, .log, _details.json, _validation_summary.csv | md/log/json/csv | Phase 2 evidence | Complete | Phase 3 hash check |
| reports/phase3_harmonization_report.md | md | Generated Phase 3 report | New | Reference |
| pytest.ini, requirements.txt | config | Test and dependency config | Keep | pytest, pip |
| src/__pycache__/ | pyc | Python 3.8 bytecode | Regenerable | Nothing |
| _backup_before_phase3/ | py | Copies of config.py and run_phase2.py before edits | Backup | Nothing |

## Keep / archive / delete

- Keep: all raw zips 2023-2025, cleaned files, reports, source, tests.
- Keep as backup: `NOAA20_2023.csv` (January only).
- Archive: 2026 zips and the misplaced S-NPP-folder NOAA-20 2026 copy.
- Delete only after verification: `src/__pycache__/`, and the MODIS extracted CSV folders (they duplicate the zips but are hash-checked by Phase 2, so keep them until that check is changed).
- Missing: website files, the NOAA-20 2023 Shapefile zip, `README.md`, `docs/`.
