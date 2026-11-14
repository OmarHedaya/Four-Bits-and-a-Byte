# FireScope Phase 2 — Cleaning and Validation Report

Phase 2 standardizes the 12 archive CSVs. It does not harmonize sensors,
aggregate grid cells, or calculate a Fire Activity Index.
Raw zip archives and the extracted MODIS CSVs were opened for reading only.
Raw-file SHA-256 fingerprints unchanged after the run: **True**.

## Coverage decisions

### NOAA20 2023 — incomplete

Incomplete archive. This file is not complete annual coverage for 2023. Observed acquisition dates run 2023-01-01 through 2023-01-31. No observations are present from 2023-02-01 through 2023-12-31 (334 days). Download the NOAA-20 VIIRS Collection 2 (J1V-C2) Egypt archive again for 2023-02-01 through 2023-12-31. January rows already in the file were kept. No rows were created for the missing months.

Rows in: 2093. Rows written: 2093. Rows rejected: 0. Rows synthesized: 0.

### NOAA21 2023 — expected_limitation

Expected coverage limitation, not a file error. NOAA-21 active-fire science data begin on 2023-03-01. This file's first acquisition date is 2023-03-01. Days with no row before 2023-03-01: 59. Those days were not filled.

Rows in: 26280. Rows written: 26280. Rows rejected: 0. Rows synthesized: 0.

### SNPP 2024 — gaps_preserved

Gaps preserved. The S-NPP 2024 source has no rows on 19 calendar days: 2024-05-30 through 2024-06-03 (5 days); 2024-07-10 through 2024-07-15 (6 days); 2024-07-25 through 2024-07-28 (4 days); 2024-09-26 (1 day); 2024-11-03 through 2024-11-05 (3 days). No observations were generated, interpolated, or copied into those days.

Rows in: 27178. Rows written: 27178. Rows rejected: 0. Rows synthesized: 0.

## Transformations applied to every kept row

- Read each CSV from its zip as text. Default pandas NA tokens were disabled so the VIIRS confidence code `n` cannot be dropped, and `acq_time` values such as `0051` stay four-digit text.
- Renamed columns by name: `acq_date` to `acquisition_date`, `acq_time` to `acquisition_time_raw`, `type` to `hotspot_type`. Latitude, longitude, brightness, `bright_t31`, FRP, scan, track, satellite, instrument, confidence, version, and daynight keep their source names.
- Parsed `acquisition_date` with the strict format `YYYY-MM-DD` and wrote it back in that format.
- Validated `acquisition_time_raw` as HHMM and wrote `acquisition_time` as `HH:MM:SS`. The raw token is kept. An impossible clock is left blank rather than replaced.
- Parsed latitude, longitude, brightness, `bright_t31`, FRP, scan, and track as numbers. Empty input stays empty. FRP values of 0 stay 0.
- Stored MODIS `confidence` as the original integer text and copied it to `confidence_numeric` (0–100). `confidence_class` is empty for MODIS.
- Stored VIIRS `confidence` as `l`, `n`, or `h` and copied it to `confidence_class`. `confidence_numeric` is empty for VIIRS. Letters were not mapped onto the MODIS 0–100 scale.
- Left `satellite` and `instrument` as stored. S-NPP stays `instrument=SNPP`. Terra and Aqua stay together in the MODIS year file, distinguished by `satellite`.
- Added `sensor_key`, `sensor_family`, and `product_id` from the archive identity, plus `source_file` and `source_archive` on every row.
- Removed a row only when coordinates were null or outside -90/90 and -180/180, or when the acquisition date did not match `YYYY-MM-DD`. No row was added for a missing calendar day.
- `bright_t31` was kept under that source name. The cleaner does not rename it to a VIIRS channel.

## Per-file validation

| File | Rows in | Rows out | Rejected | Date min | Date max | Days with rows | Absent days | Coverage |
| --- | ---: | ---: | ---: | --- | --- | ---: | ---: | --- |
| MODIS_2023 | 1,421 | 1,421 | 0 | 2023-01-01 | 2023-12-31 | 288 | 77 | empty_days_preserved |
| MODIS_2024 | 1,268 | 1,268 | 0 | 2024-01-01 | 2024-12-28 | 272 | 94 | empty_days_preserved |
| MODIS_2025 | 1,438 | 1,438 | 0 | 2025-01-06 | 2025-12-31 | 283 | 82 | empty_days_preserved |
| NOAA20_2023 | 2,093 | 2,093 | 0 | 2023-01-01 | 2023-01-31 | 31 | 334 | incomplete |
| NOAA20_2024 | 28,873 | 28,873 | 0 | 2024-01-01 | 2024-12-31 | 365 | 1 | empty_days_preserved |
| NOAA20_2025 | 26,916 | 26,916 | 0 | 2025-01-01 | 2025-12-31 | 365 | 0 | no_calendar_gaps |
| NOAA21_2023 | 26,280 | 26,280 | 0 | 2023-03-01 | 2023-12-31 | 306 | 59 | expected_limitation |
| NOAA21_2024 | 27,568 | 27,568 | 0 | 2024-01-01 | 2024-12-31 | 364 | 2 | empty_days_preserved |
| NOAA21_2025 | 25,403 | 25,403 | 0 | 2025-01-01 | 2025-12-31 | 365 | 0 | no_calendar_gaps |
| SNPP_2023 | 30,763 | 30,763 | 0 | 2023-01-01 | 2023-12-31 | 365 | 0 | no_calendar_gaps |
| SNPP_2024 | 27,178 | 27,178 | 0 | 2024-01-01 | 2024-12-31 | 347 | 19 | gaps_preserved |
| SNPP_2025 | 26,042 | 26,042 | 0 | 2025-01-01 | 2025-12-31 | 363 | 2 | empty_days_preserved |

## Confidence, satellite, and instrument

### MODIS 2023

- Output: `data/processed/2023/MODIS_2023.csv`
- Source: `Modis/DL_FIRE_M-C61_844811_2023.zip` / `fire_archive_M-C61_844811.csv`
- Satellite values: `{'Terra': 866, 'Aqua': 555}`
- Instrument values: `{'MODIS': 1421}`
- Confidence status counts: `{'ok': 1421}`
- Version values: `{'61.03': 1421}`
- Time tokens that were not already four digits: 0. Invalid clocks left blank: 0. Missing times: 0.
- FRP equal to 0 (kept): 0. FRP null: 0.
- Null counts: `{'latitude': 0, 'longitude': 0, 'acquisition_date': 0, 'acquisition_time': 0, 'satellite': 0, 'instrument': 0, 'confidence': 0, 'confidence_numeric': 0, 'confidence_class': 1421, 'brightness': 0, 'bright_t31': 0, 'frp': 0, 'daynight': 0, 'scan': 0, 'track': 0, 'hotspot_type': 0, 'version': 0, 'acquisition_time_raw': 0, 'sensor_key': 0, 'sensor_family': 0, 'product_id': 0, 'source_file': 0, 'source_archive': 0}`
- Hotspot type counts: `{'0': 1192, '2': 226, '3': 3, '<NA>': 0}`
- Day/night counts: `{'D': 1018, 'N': 403}`
- Calendar days with no source row, left empty: 2023-01-04 to 2023-01-04 (1 days); 2023-01-06 to 2023-01-09 (4 days); 2023-01-11 to 2023-01-11 (1 days); 2023-01-13 to 2023-01-14 (2 days); 2023-01-16 to 2023-01-16 (1 days); 2023-01-18 to 2023-01-19 (2 days); 2023-01-25 to 2023-01-25 (1 days); 2023-01-30 to 2023-01-30 (1 days); 2023-02-04 to 2023-02-04 (1 days); 2023-02-08 to 2023-02-09 (2 days); 2023-02-14 to 2023-02-14 (1 days); 2023-02-16 to 2023-02-16 (1 days); 2023-02-21 to 2023-02-21 (1 days); 2023-02-28 to 2023-02-28 (1 days); 2023-03-05 to 2023-03-05 (1 days); 2023-03-12 to 2023-03-13 (2 days); 2023-03-21 to 2023-03-21 (1 days); 2023-03-24 to 2023-03-24 (1 days); 2023-04-05 to 2023-04-05 (1 days); 2023-04-22 to 2023-04-22 (1 days); 2023-04-27 to 2023-04-27 (1 days); 2023-05-04 to 2023-05-04 (1 days); 2023-05-09 to 2023-05-09 (1 days); 2023-05-11 to 2023-05-11 (1 days); 2023-05-16 to 2023-05-16 (1 days); 2023-05-19 to 2023-05-19 (1 days); 2023-05-21 to 2023-05-21 (1 days); 2023-05-23 to 2023-05-23 (1 days); 2023-05-26 to 2023-05-26 (1 days); 2023-05-28 to 2023-05-28 (1 days); 2023-05-30 to 2023-05-30 (1 days); 2023-06-01 to 2023-06-02 (2 days); 2023-06-04 to 2023-06-04 (1 days); 2023-06-16 to 2023-06-16 (1 days); 2023-06-23 to 2023-06-23 (1 days); 2023-07-25 to 2023-07-25 (1 days); 2023-08-01 to 2023-08-01 (1 days); 2023-08-03 to 2023-08-03 (1 days); 2023-08-06 to 2023-08-06 (1 days); 2023-08-08 to 2023-08-08 (1 days); 2023-08-11 to 2023-08-11 (1 days); 2023-08-13 to 2023-08-13 (1 days); 2023-08-15 to 2023-08-16 (2 days); 2023-08-18 to 2023-08-18 (1 days); 2023-08-20 to 2023-08-20 (1 days); 2023-08-27 to 2023-08-27 (1 days); 2023-08-29 to 2023-08-29 (1 days); 2023-09-01 to 2023-09-01 (1 days); 2023-09-03 to 2023-09-03 (1 days); 2023-09-13 to 2023-09-13 (1 days); 2023-09-20 to 2023-09-20 (1 days); 2023-09-25 to 2023-09-25 (1 days); 2023-09-27 to 2023-09-27 (1 days); 2023-10-02 to 2023-10-02 (1 days); 2023-10-07 to 2023-10-07 (1 days); 2023-11-07 to 2023-11-07 (1 days); 2023-11-12 to 2023-11-12 (1 days); 2023-11-20 to 2023-11-20 (1 days); 2023-12-02 to 2023-12-02 (1 days); 2023-12-04 to 2023-12-05 (2 days); 2023-12-09 to 2023-12-09 (1 days); 2023-12-16 to 2023-12-16 (1 days); 2023-12-20 to 2023-12-20 (1 days); 2023-12-23 to 2023-12-23 (1 days); 2023-12-26 to 2023-12-26 (1 days); 2023-12-28 to 2023-12-28 (1 days); 2023-12-30 to 2023-12-30 (1 days)
- Coverage: 77 calendar days in 2023 have no row in the source file: 2023-01-04 (1 day); 2023-01-06 through 2023-01-09 (4 days); 2023-01-11 (1 day); 2023-01-13 through 2023-01-14 (2 days); 2023-01-16 (1 day); 2023-01-18 through 2023-01-19 (2 days); 2023-01-25 (1 day); 2023-01-30 (1 day); 2023-02-04 (1 day); 2023-02-08 through 2023-02-09 (2 days); 2023-02-14 (1 day); 2023-02-16 (1 day); 2023-02-21 (1 day); 2023-02-28 (1 day); 2023-03-05 (1 day); 2023-03-12 through 2023-03-13 (2 days); 2023-03-21 (1 day); 2023-03-24 (1 day); 2023-04-05 (1 day); 2023-04-22 (1 day); 2023-04-27 (1 day); 2023-05-04 (1 day); 2023-05-09 (1 day); 2023-05-11 (1 day); 2023-05-16 (1 day); 2023-05-19 (1 day); 2023-05-21 (1 day); 2023-05-23 (1 day); 2023-05-26 (1 day); 2023-05-28 (1 day); 2023-05-30 (1 day); 2023-06-01 through 2023-06-02 (2 days); 2023-06-04 (1 day); 2023-06-16 (1 day); 2023-06-23 (1 day); 2023-07-25 (1 day); 2023-08-01 (1 day); 2023-08-03 (1 day); 2023-08-06 (1 day); 2023-08-08 (1 day); 2023-08-11 (1 day); 2023-08-13 (1 day); 2023-08-15 through 2023-08-16 (2 days); 2023-08-18 (1 day); 2023-08-20 (1 day); 2023-08-27 (1 day); 2023-08-29 (1 day); 2023-09-01 (1 day); 2023-09-03 (1 day); 2023-09-13 (1 day); 2023-09-20 (1 day); 2023-09-25 (1 day); 2023-09-27 (1 day); 2023-10-02 (1 day); 2023-10-07 (1 day); 2023-11-07 (1 day); 2023-11-12 (1 day); 2023-11-20 (1 day); 2023-12-02 (1 day); 2023-12-04 through 2023-12-05 (2 days); 2023-12-09 (1 day); 2023-12-16 (1 day); 2023-12-20 (1 day); 2023-12-23 (1 day); 2023-12-26 (1 day); 2023-12-28 (1 day); 2023-12-30 (1 day). These days were left empty. No observations were invented. For MODIS, a day with no row is consistent with a 1 km product that records few detections; it is not marked as a truncated download.

### MODIS 2024

- Output: `data/processed/2024/MODIS_2024.csv`
- Source: `Modis/DL_FIRE_M-C61_844824_2024.zip` / `fire_archive_M-C61_844824.csv`
- Satellite values: `{'Terra': 898, 'Aqua': 370}`
- Instrument values: `{'MODIS': 1268}`
- Confidence status counts: `{'ok': 1268}`
- Version values: `{'61.03': 1268}`
- Time tokens that were not already four digits: 0. Invalid clocks left blank: 0. Missing times: 0.
- FRP equal to 0 (kept): 0. FRP null: 0.
- Null counts: `{'latitude': 0, 'longitude': 0, 'acquisition_date': 0, 'acquisition_time': 0, 'satellite': 0, 'instrument': 0, 'confidence': 0, 'confidence_numeric': 0, 'confidence_class': 1268, 'brightness': 0, 'bright_t31': 0, 'frp': 0, 'daynight': 0, 'scan': 0, 'track': 0, 'hotspot_type': 0, 'version': 0, 'acquisition_time_raw': 0, 'sensor_key': 0, 'sensor_family': 0, 'product_id': 0, 'source_file': 0, 'source_archive': 0}`
- Hotspot type counts: `{'0': 1046, '2': 220, '3': 2, '<NA>': 0}`
- Day/night counts: `{'D': 828, 'N': 440}`
- Calendar days with no source row, left empty: 2024-01-03 to 2024-01-04 (2 days); 2024-01-06 to 2024-01-07 (2 days); 2024-01-11 to 2024-01-11 (1 days); 2024-01-14 to 2024-01-14 (1 days); 2024-01-16 to 2024-01-16 (1 days); 2024-01-21 to 2024-01-21 (1 days); 2024-01-26 to 2024-01-26 (1 days); 2024-01-28 to 2024-01-28 (1 days); 2024-01-31 to 2024-01-31 (1 days); 2024-02-02 to 2024-02-02 (1 days); 2024-02-04 to 2024-02-04 (1 days); 2024-02-07 to 2024-02-07 (1 days); 2024-02-09 to 2024-02-09 (1 days); 2024-02-11 to 2024-02-12 (2 days); 2024-02-14 to 2024-02-14 (1 days); 2024-02-19 to 2024-02-19 (1 days); 2024-02-21 to 2024-02-21 (1 days); 2024-02-23 to 2024-02-24 (2 days); 2024-03-07 to 2024-03-07 (1 days); 2024-03-09 to 2024-03-09 (1 days); 2024-03-26 to 2024-03-26 (1 days); 2024-04-05 to 2024-04-05 (1 days); 2024-04-15 to 2024-04-15 (1 days); 2024-04-18 to 2024-04-18 (1 days); 2024-04-20 to 2024-04-20 (1 days); 2024-04-22 to 2024-04-23 (2 days); 2024-04-25 to 2024-04-25 (1 days); 2024-04-29 to 2024-04-29 (1 days); 2024-05-03 to 2024-05-03 (1 days); 2024-05-11 to 2024-05-12 (2 days); 2024-05-24 to 2024-05-24 (1 days); 2024-06-17 to 2024-06-17 (1 days); 2024-06-24 to 2024-06-24 (1 days); 2024-06-27 to 2024-06-27 (1 days); 2024-07-05 to 2024-07-06 (2 days); 2024-07-09 to 2024-07-09 (1 days); 2024-07-19 to 2024-07-19 (1 days); 2024-07-21 to 2024-07-22 (2 days); 2024-07-24 to 2024-07-24 (1 days); 2024-07-26 to 2024-07-28 (3 days); 2024-07-31 to 2024-07-31 (1 days); 2024-08-02 to 2024-08-02 (1 days); 2024-08-05 to 2024-08-05 (1 days); 2024-08-14 to 2024-08-15 (2 days); 2024-08-17 to 2024-08-17 (1 days); 2024-08-20 to 2024-08-20 (1 days); 2024-08-22 to 2024-08-24 (3 days); 2024-08-27 to 2024-08-27 (1 days); 2024-08-29 to 2024-08-29 (1 days); 2024-08-31 to 2024-09-01 (2 days); 2024-09-03 to 2024-09-03 (1 days); 2024-09-06 to 2024-09-06 (1 days); 2024-09-08 to 2024-09-08 (1 days); 2024-09-10 to 2024-09-11 (2 days); 2024-09-13 to 2024-09-13 (1 days); 2024-09-15 to 2024-09-15 (1 days); 2024-09-18 to 2024-09-18 (1 days); 2024-09-20 to 2024-09-20 (1 days); 2024-09-23 to 2024-09-23 (1 days); 2024-09-25 to 2024-09-25 (1 days); 2024-10-10 to 2024-10-10 (1 days); 2024-10-17 to 2024-10-17 (1 days); 2024-10-22 to 2024-10-22 (1 days); 2024-10-29 to 2024-10-29 (1 days); 2024-11-01 to 2024-11-01 (1 days); 2024-11-03 to 2024-11-03 (1 days); 2024-11-08 to 2024-11-08 (1 days); 2024-11-13 to 2024-11-13 (1 days); 2024-11-23 to 2024-11-23 (1 days); 2024-11-28 to 2024-11-28 (1 days); 2024-12-05 to 2024-12-05 (1 days); 2024-12-07 to 2024-12-07 (1 days); 2024-12-20 to 2024-12-20 (1 days); 2024-12-24 to 2024-12-26 (3 days); 2024-12-29 to 2024-12-31 (3 days)
- Coverage: 94 calendar days in 2024 have no row in the source file: 2024-01-03 through 2024-01-04 (2 days); 2024-01-06 through 2024-01-07 (2 days); 2024-01-11 (1 day); 2024-01-14 (1 day); 2024-01-16 (1 day); 2024-01-21 (1 day); 2024-01-26 (1 day); 2024-01-28 (1 day); 2024-01-31 (1 day); 2024-02-02 (1 day); 2024-02-04 (1 day); 2024-02-07 (1 day); 2024-02-09 (1 day); 2024-02-11 through 2024-02-12 (2 days); 2024-02-14 (1 day); 2024-02-19 (1 day); 2024-02-21 (1 day); 2024-02-23 through 2024-02-24 (2 days); 2024-03-07 (1 day); 2024-03-09 (1 day); 2024-03-26 (1 day); 2024-04-05 (1 day); 2024-04-15 (1 day); 2024-04-18 (1 day); 2024-04-20 (1 day); 2024-04-22 through 2024-04-23 (2 days); 2024-04-25 (1 day); 2024-04-29 (1 day); 2024-05-03 (1 day); 2024-05-11 through 2024-05-12 (2 days); 2024-05-24 (1 day); 2024-06-17 (1 day); 2024-06-24 (1 day); 2024-06-27 (1 day); 2024-07-05 through 2024-07-06 (2 days); 2024-07-09 (1 day); 2024-07-19 (1 day); 2024-07-21 through 2024-07-22 (2 days); 2024-07-24 (1 day); 2024-07-26 through 2024-07-28 (3 days); 2024-07-31 (1 day); 2024-08-02 (1 day); 2024-08-05 (1 day); 2024-08-14 through 2024-08-15 (2 days); 2024-08-17 (1 day); 2024-08-20 (1 day); 2024-08-22 through 2024-08-24 (3 days); 2024-08-27 (1 day); 2024-08-29 (1 day); 2024-08-31 through 2024-09-01 (2 days); 2024-09-03 (1 day); 2024-09-06 (1 day); 2024-09-08 (1 day); 2024-09-10 through 2024-09-11 (2 days); 2024-09-13 (1 day); 2024-09-15 (1 day); 2024-09-18 (1 day); 2024-09-20 (1 day); 2024-09-23 (1 day); 2024-09-25 (1 day); 2024-10-10 (1 day); 2024-10-17 (1 day); 2024-10-22 (1 day); 2024-10-29 (1 day); 2024-11-01 (1 day); 2024-11-03 (1 day); 2024-11-08 (1 day); 2024-11-13 (1 day); 2024-11-23 (1 day); 2024-11-28 (1 day); 2024-12-05 (1 day); 2024-12-07 (1 day); 2024-12-20 (1 day); 2024-12-24 through 2024-12-26 (3 days); 2024-12-29 through 2024-12-31 (3 days). These days were left empty. No observations were invented. For MODIS, a day with no row is consistent with a 1 km product that records few detections; it is not marked as a truncated download.

### MODIS 2025

- Output: `data/processed/2025/MODIS_2025.csv`
- Source: `Modis/DL_FIRE_M-C61_844838_2025.zip` / `fire_archive_M-C61_844838.csv`
- Satellite values: `{'Terra': 1112, 'Aqua': 326}`
- Instrument values: `{'MODIS': 1438}`
- Confidence status counts: `{'ok': 1438}`
- Version values: `{'61.03': 1438}`
- Time tokens that were not already four digits: 0. Invalid clocks left blank: 0. Missing times: 0.
- FRP equal to 0 (kept): 0. FRP null: 0.
- Null counts: `{'latitude': 0, 'longitude': 0, 'acquisition_date': 0, 'acquisition_time': 0, 'satellite': 0, 'instrument': 0, 'confidence': 0, 'confidence_numeric': 0, 'confidence_class': 1438, 'brightness': 0, 'bright_t31': 0, 'frp': 0, 'daynight': 0, 'scan': 0, 'track': 0, 'hotspot_type': 0, 'version': 0, 'acquisition_time_raw': 0, 'sensor_key': 0, 'sensor_family': 0, 'product_id': 0, 'source_file': 0, 'source_archive': 0}`
- Hotspot type counts: `{'0': 1219, '2': 219, '<NA>': 0}`
- Day/night counts: `{'D': 916, 'N': 522}`
- Calendar days with no source row, left empty: 2025-01-01 to 2025-01-05 (5 days); 2025-01-09 to 2025-01-09 (1 days); 2025-01-13 to 2025-01-14 (2 days); 2025-01-16 to 2025-01-16 (1 days); 2025-01-21 to 2025-01-22 (2 days); 2025-01-26 to 2025-01-26 (1 days); 2025-01-30 to 2025-01-30 (1 days); 2025-02-04 to 2025-02-04 (1 days); 2025-02-06 to 2025-02-07 (2 days); 2025-02-14 to 2025-02-14 (1 days); 2025-02-17 to 2025-02-17 (1 days); 2025-02-19 to 2025-02-19 (1 days); 2025-02-21 to 2025-02-21 (1 days); 2025-02-24 to 2025-02-24 (1 days); 2025-02-27 to 2025-02-27 (1 days); 2025-03-06 to 2025-03-06 (1 days); 2025-03-11 to 2025-03-11 (1 days); 2025-03-26 to 2025-03-26 (1 days); 2025-04-01 to 2025-04-01 (1 days); 2025-04-05 to 2025-04-05 (1 days); 2025-04-09 to 2025-04-10 (2 days); 2025-04-12 to 2025-04-12 (1 days); 2025-04-15 to 2025-04-15 (1 days); 2025-04-20 to 2025-04-20 (1 days); 2025-04-22 to 2025-04-22 (1 days); 2025-04-25 to 2025-04-25 (1 days); 2025-04-29 to 2025-04-30 (2 days); 2025-05-02 to 2025-05-02 (1 days); 2025-05-05 to 2025-05-05 (1 days); 2025-05-10 to 2025-05-10 (1 days); 2025-05-17 to 2025-05-17 (1 days); 2025-05-20 to 2025-05-20 (1 days); 2025-05-25 to 2025-05-25 (1 days); 2025-06-01 to 2025-06-01 (1 days); 2025-06-04 to 2025-06-04 (1 days); 2025-06-06 to 2025-06-06 (1 days); 2025-06-11 to 2025-06-11 (1 days); 2025-07-18 to 2025-07-18 (1 days); 2025-07-23 to 2025-07-23 (1 days); 2025-07-26 to 2025-07-26 (1 days); 2025-08-01 to 2025-08-02 (2 days); 2025-08-09 to 2025-08-09 (1 days); 2025-08-12 to 2025-08-12 (1 days); 2025-08-15 to 2025-08-15 (1 days); 2025-08-17 to 2025-08-17 (1 days); 2025-08-22 to 2025-08-22 (1 days); 2025-08-25 to 2025-08-25 (1 days); 2025-08-27 to 2025-08-27 (1 days); 2025-09-04 to 2025-09-04 (1 days); 2025-09-06 to 2025-09-06 (1 days); 2025-09-11 to 2025-09-11 (1 days); 2025-09-13 to 2025-09-13 (1 days); 2025-09-16 to 2025-09-16 (1 days); 2025-09-21 to 2025-09-21 (1 days); 2025-09-26 to 2025-09-26 (1 days); 2025-10-11 to 2025-10-11 (1 days); 2025-10-30 to 2025-10-30 (1 days); 2025-11-17 to 2025-11-17 (1 days); 2025-11-19 to 2025-11-19 (1 days); 2025-11-22 to 2025-11-22 (1 days); 2025-11-27 to 2025-11-27 (1 days); 2025-11-29 to 2025-11-29 (1 days); 2025-12-03 to 2025-12-03 (1 days); 2025-12-05 to 2025-12-05 (1 days); 2025-12-07 to 2025-12-07 (1 days); 2025-12-12 to 2025-12-12 (1 days); 2025-12-15 to 2025-12-15 (1 days); 2025-12-17 to 2025-12-17 (1 days); 2025-12-20 to 2025-12-21 (2 days); 2025-12-25 to 2025-12-25 (1 days); 2025-12-30 to 2025-12-30 (1 days)
- Coverage: 82 calendar days in 2025 have no row in the source file: 2025-01-01 through 2025-01-05 (5 days); 2025-01-09 (1 day); 2025-01-13 through 2025-01-14 (2 days); 2025-01-16 (1 day); 2025-01-21 through 2025-01-22 (2 days); 2025-01-26 (1 day); 2025-01-30 (1 day); 2025-02-04 (1 day); 2025-02-06 through 2025-02-07 (2 days); 2025-02-14 (1 day); 2025-02-17 (1 day); 2025-02-19 (1 day); 2025-02-21 (1 day); 2025-02-24 (1 day); 2025-02-27 (1 day); 2025-03-06 (1 day); 2025-03-11 (1 day); 2025-03-26 (1 day); 2025-04-01 (1 day); 2025-04-05 (1 day); 2025-04-09 through 2025-04-10 (2 days); 2025-04-12 (1 day); 2025-04-15 (1 day); 2025-04-20 (1 day); 2025-04-22 (1 day); 2025-04-25 (1 day); 2025-04-29 through 2025-04-30 (2 days); 2025-05-02 (1 day); 2025-05-05 (1 day); 2025-05-10 (1 day); 2025-05-17 (1 day); 2025-05-20 (1 day); 2025-05-25 (1 day); 2025-06-01 (1 day); 2025-06-04 (1 day); 2025-06-06 (1 day); 2025-06-11 (1 day); 2025-07-18 (1 day); 2025-07-23 (1 day); 2025-07-26 (1 day); 2025-08-01 through 2025-08-02 (2 days); 2025-08-09 (1 day); 2025-08-12 (1 day); 2025-08-15 (1 day); 2025-08-17 (1 day); 2025-08-22 (1 day); 2025-08-25 (1 day); 2025-08-27 (1 day); 2025-09-04 (1 day); 2025-09-06 (1 day); 2025-09-11 (1 day); 2025-09-13 (1 day); 2025-09-16 (1 day); 2025-09-21 (1 day); 2025-09-26 (1 day); 2025-10-11 (1 day); 2025-10-30 (1 day); 2025-11-17 (1 day); 2025-11-19 (1 day); 2025-11-22 (1 day); 2025-11-27 (1 day); 2025-11-29 (1 day); 2025-12-03 (1 day); 2025-12-05 (1 day); 2025-12-07 (1 day); 2025-12-12 (1 day); 2025-12-15 (1 day); 2025-12-17 (1 day); 2025-12-20 through 2025-12-21 (2 days); 2025-12-25 (1 day); 2025-12-30 (1 day). These days were left empty. No observations were invented. For MODIS, a day with no row is consistent with a 1 km product that records few detections; it is not marked as a truncated download.

### NOAA20 2023

- Output: `data/processed/2023/NOAA20_2023.csv`
- Source: `VIIRS NOAA-20/DL_FIRE_J1V-C2_844848_2023.zip` / `fire_archive_J1V-C2_844848.csv`
- Satellite values: `{'N20': 2093}`
- Instrument values: `{'VIIRS': 2093}`
- Confidence status counts: `{'ok': 2093}`
- Version values: `{'2': 2093}`
- Time tokens that were not already four digits: 0. Invalid clocks left blank: 0. Missing times: 0.
- FRP equal to 0 (kept): 0. FRP null: 0.
- Null counts: `{'latitude': 0, 'longitude': 0, 'acquisition_date': 0, 'acquisition_time': 0, 'satellite': 0, 'instrument': 0, 'confidence': 0, 'confidence_numeric': 2093, 'confidence_class': 0, 'brightness': 0, 'bright_t31': 0, 'frp': 0, 'daynight': 0, 'scan': 0, 'track': 0, 'hotspot_type': 0, 'version': 0, 'acquisition_time_raw': 0, 'sensor_key': 0, 'sensor_family': 0, 'product_id': 0, 'source_file': 0, 'source_archive': 0}`
- Hotspot type counts: `{'2': 1499, '0': 571, '3': 23, '<NA>': 0}`
- Day/night counts: `{'N': 1843, 'D': 250}`
- Calendar days with no source row, left empty: 2023-02-01 to 2023-12-31 (334 days)
- Coverage: Incomplete archive. This file is not complete annual coverage for 2023. Observed acquisition dates run 2023-01-01 through 2023-01-31. No observations are present from 2023-02-01 through 2023-12-31 (334 days). Download the NOAA-20 VIIRS Collection 2 (J1V-C2) Egypt archive again for 2023-02-01 through 2023-12-31. January rows already in the file were kept. No rows were created for the missing months.

### NOAA20 2024

- Output: `data/processed/2024/NOAA20_2024.csv`
- Source: `VIIRS NOAA-20/DL_FIRE_J1V-C2_844849_2024.zip` / `fire_archive_J1V-C2_844849.csv`
- Satellite values: `{'N20': 28873}`
- Instrument values: `{'VIIRS': 28873}`
- Confidence status counts: `{'ok': 28873}`
- Version values: `{'2': 28873}`
- Time tokens that were not already four digits: 0. Invalid clocks left blank: 0. Missing times: 0.
- FRP equal to 0 (kept): 0. FRP null: 0.
- Null counts: `{'latitude': 0, 'longitude': 0, 'acquisition_date': 0, 'acquisition_time': 0, 'satellite': 0, 'instrument': 0, 'confidence': 0, 'confidence_numeric': 28873, 'confidence_class': 0, 'brightness': 0, 'bright_t31': 0, 'frp': 0, 'daynight': 0, 'scan': 0, 'track': 0, 'hotspot_type': 0, 'version': 0, 'acquisition_time_raw': 0, 'sensor_key': 0, 'sensor_family': 0, 'product_id': 0, 'source_file': 0, 'source_archive': 0}`
- Hotspot type counts: `{'2': 19150, '0': 9532, '3': 191, '<NA>': 0}`
- Day/night counts: `{'N': 21434, 'D': 7439}`
- Calendar days with no source row, left empty: 2024-02-04 to 2024-02-04 (1 days)
- Coverage: 1 calendar days in 2024 have no row in the source file: 2024-02-04 (1 day). These days were left empty. No observations were invented. For MODIS, a day with no row is consistent with a 1 km product that records few detections; it is not marked as a truncated download.

### NOAA20 2025

- Output: `data/processed/2025/NOAA20_2025.csv`
- Source: `VIIRS NOAA-20/DL_FIRE_J1V-C2_844850_2025.zip` / `fire_archive_J1V-C2_844850.csv`
- Satellite values: `{'N20': 26916}`
- Instrument values: `{'VIIRS': 26916}`
- Confidence status counts: `{'ok': 26916}`
- Version values: `{'2': 26916}`
- Time tokens that were not already four digits: 0. Invalid clocks left blank: 0. Missing times: 0.
- FRP equal to 0 (kept): 2. FRP null: 0.
- Null counts: `{'latitude': 0, 'longitude': 0, 'acquisition_date': 0, 'acquisition_time': 0, 'satellite': 0, 'instrument': 0, 'confidence': 0, 'confidence_numeric': 26916, 'confidence_class': 0, 'brightness': 0, 'bright_t31': 0, 'frp': 0, 'daynight': 0, 'scan': 0, 'track': 0, 'hotspot_type': 0, 'version': 0, 'acquisition_time_raw': 0, 'sensor_key': 0, 'sensor_family': 0, 'product_id': 0, 'source_file': 0, 'source_archive': 0}`
- Hotspot type counts: `{'2': 19169, '0': 7629, '3': 118, '<NA>': 0}`
- Day/night counts: `{'N': 20971, 'D': 5945}`
- Coverage: Every calendar day in 2025 has at least one source row. No rows were added.

### NOAA21 2023

- Output: `data/processed/2023/NOAA21_2023.csv`
- Source: `VIIRS NOAA-21/DL_FIRE_J2V-C2_844851_2023.zip` / `fire_archive_J2V-C2_844851.csv`
- Satellite values: `{'N21': 26280}`
- Instrument values: `{'VIIRS': 26280}`
- Confidence status counts: `{'ok': 26280}`
- Version values: `{'2': 26280}`
- Time tokens that were not already four digits: 0. Invalid clocks left blank: 0. Missing times: 0.
- FRP equal to 0 (kept): 0. FRP null: 0.
- Null counts: `{'latitude': 0, 'longitude': 0, 'acquisition_date': 0, 'acquisition_time': 0, 'satellite': 0, 'instrument': 0, 'confidence': 0, 'confidence_numeric': 26280, 'confidence_class': 0, 'brightness': 0, 'bright_t31': 0, 'frp': 0, 'daynight': 0, 'scan': 0, 'track': 0, 'hotspot_type': 0, 'version': 0, 'acquisition_time_raw': 0, 'sensor_key': 0, 'sensor_family': 0, 'product_id': 0, 'source_file': 0, 'source_archive': 0}`
- Hotspot type counts: `{'2': 16347, '0': 9810, '3': 123, '<NA>': 0}`
- Day/night counts: `{'N': 18055, 'D': 8225}`
- Calendar days with no source row, left empty: 2023-01-01 to 2023-02-28 (59 days)
- Coverage: Expected coverage limitation, not a file error. NOAA-21 active-fire science data begin on 2023-03-01. This file's first acquisition date is 2023-03-01. Days with no row before 2023-03-01: 59. Those days were not filled.

### NOAA21 2024

- Output: `data/processed/2024/NOAA21_2024.csv`
- Source: `VIIRS NOAA-21/DL_FIRE_J2V-C2_844852_2024.zip` / `fire_archive_J2V-C2_844852.csv`
- Satellite values: `{'N21': 27568}`
- Instrument values: `{'VIIRS': 27568}`
- Confidence status counts: `{'ok': 27568}`
- Version values: `{'2': 27568}`
- Time tokens that were not already four digits: 0. Invalid clocks left blank: 0. Missing times: 0.
- FRP equal to 0 (kept): 2. FRP null: 0.
- Null counts: `{'latitude': 0, 'longitude': 0, 'acquisition_date': 0, 'acquisition_time': 0, 'satellite': 0, 'instrument': 0, 'confidence': 0, 'confidence_numeric': 27568, 'confidence_class': 0, 'brightness': 0, 'bright_t31': 0, 'frp': 0, 'daynight': 0, 'scan': 0, 'track': 0, 'hotspot_type': 0, 'version': 0, 'acquisition_time_raw': 0, 'sensor_key': 0, 'sensor_family': 0, 'product_id': 0, 'source_file': 0, 'source_archive': 0}`
- Hotspot type counts: `{'2': 19838, '0': 7616, '3': 114, '<NA>': 0}`
- Day/night counts: `{'N': 20803, 'D': 6765}`
- Calendar days with no source row, left empty: 2024-02-27 to 2024-02-28 (2 days)
- Coverage: 2 calendar days in 2024 have no row in the source file: 2024-02-27 through 2024-02-28 (2 days). These days were left empty. No observations were invented. For MODIS, a day with no row is consistent with a 1 km product that records few detections; it is not marked as a truncated download.

### NOAA21 2025

- Output: `data/processed/2025/NOAA21_2025.csv`
- Source: `VIIRS NOAA-21/DL_FIRE_J2V-C2_844853_2025.zip` / `fire_archive_J2V-C2_844853.csv`
- Satellite values: `{'N21': 25403}`
- Instrument values: `{'VIIRS': 25403}`
- Confidence status counts: `{'ok': 25403}`
- Version values: `{'2': 25403}`
- Time tokens that were not already four digits: 0. Invalid clocks left blank: 0. Missing times: 0.
- FRP equal to 0 (kept): 6. FRP null: 0.
- Null counts: `{'latitude': 0, 'longitude': 0, 'acquisition_date': 0, 'acquisition_time': 0, 'satellite': 0, 'instrument': 0, 'confidence': 0, 'confidence_numeric': 25403, 'confidence_class': 0, 'brightness': 0, 'bright_t31': 0, 'frp': 0, 'daynight': 0, 'scan': 0, 'track': 0, 'hotspot_type': 0, 'version': 0, 'acquisition_time_raw': 0, 'sensor_key': 0, 'sensor_family': 0, 'product_id': 0, 'source_file': 0, 'source_archive': 0}`
- Hotspot type counts: `{'2': 18763, '0': 6563, '3': 77, '<NA>': 0}`
- Day/night counts: `{'N': 20176, 'D': 5227}`
- Coverage: Every calendar day in 2025 has at least one source row. No rows were added.

### SNPP 2023

- Output: `data/processed/2023/SNPP_2023.csv`
- Source: `VIIRS S-NPP/DL_FIRE_SV-C2_844842_2023.zip` / `fire_archive_SV-C2_844842.csv`
- Satellite values: `{'SNPP': 30763}`
- Instrument values: `{'SNPP': 30763}`
- Confidence status counts: `{'ok': 30763}`
- Version values: `{'2': 30763}`
- Time tokens that were not already four digits: 0. Invalid clocks left blank: 0. Missing times: 0.
- FRP equal to 0 (kept): 2. FRP null: 0.
- Null counts: `{'latitude': 0, 'longitude': 0, 'acquisition_date': 0, 'acquisition_time': 0, 'satellite': 0, 'instrument': 0, 'confidence': 0, 'confidence_numeric': 30763, 'confidence_class': 0, 'brightness': 0, 'bright_t31': 0, 'frp': 0, 'daynight': 0, 'scan': 0, 'track': 0, 'hotspot_type': 0, 'version': 0, 'acquisition_time_raw': 0, 'sensor_key': 0, 'sensor_family': 0, 'product_id': 0, 'source_file': 0, 'source_archive': 0}`
- Hotspot type counts: `{'2': 18884, '0': 11706, '3': 173, '<NA>': 0}`
- Day/night counts: `{'N': 21673, 'D': 9090}`
- Coverage: Every calendar day in 2023 has at least one source row. No rows were added.

### SNPP 2024

- Output: `data/processed/2024/SNPP_2024.csv`
- Source: `VIIRS S-NPP/DL_FIRE_SV-C2_844845_2024.zip` / `fire_archive_SV-C2_844845.csv`
- Satellite values: `{'SNPP': 27178}`
- Instrument values: `{'SNPP': 27178}`
- Confidence status counts: `{'ok': 27178}`
- Version values: `{'2': 27178}`
- Time tokens that were not already four digits: 0. Invalid clocks left blank: 0. Missing times: 0.
- FRP equal to 0 (kept): 0. FRP null: 0.
- Null counts: `{'latitude': 0, 'longitude': 0, 'acquisition_date': 0, 'acquisition_time': 0, 'satellite': 0, 'instrument': 0, 'confidence': 0, 'confidence_numeric': 27178, 'confidence_class': 0, 'brightness': 0, 'bright_t31': 0, 'frp': 0, 'daynight': 0, 'scan': 0, 'track': 0, 'hotspot_type': 0, 'version': 0, 'acquisition_time_raw': 0, 'sensor_key': 0, 'sensor_family': 0, 'product_id': 0, 'source_file': 0, 'source_archive': 0}`
- Hotspot type counts: `{'2': 17875, '0': 9173, '3': 130, '<NA>': 0}`
- Day/night counts: `{'N': 20106, 'D': 7072}`
- Calendar days with no source row, left empty: 2024-05-30 to 2024-06-03 (5 days); 2024-07-10 to 2024-07-15 (6 days); 2024-07-25 to 2024-07-28 (4 days); 2024-09-26 to 2024-09-26 (1 days); 2024-11-03 to 2024-11-05 (3 days)
- Coverage: Gaps preserved. The S-NPP 2024 source has no rows on 19 calendar days: 2024-05-30 through 2024-06-03 (5 days); 2024-07-10 through 2024-07-15 (6 days); 2024-07-25 through 2024-07-28 (4 days); 2024-09-26 (1 day); 2024-11-03 through 2024-11-05 (3 days). No observations were generated, interpolated, or copied into those days.

### SNPP 2025

- Output: `data/processed/2025/SNPP_2025.csv`
- Source: `VIIRS S-NPP/DL_FIRE_SV-C2_844847_2025.zip` / `fire_archive_SV-C2_844847.csv`
- Satellite values: `{'SNPP': 26042}`
- Instrument values: `{'SNPP': 26042}`
- Confidence status counts: `{'ok': 26042}`
- Version values: `{'2': 26042}`
- Time tokens that were not already four digits: 0. Invalid clocks left blank: 0. Missing times: 0.
- FRP equal to 0 (kept): 0. FRP null: 0.
- Null counts: `{'latitude': 0, 'longitude': 0, 'acquisition_date': 0, 'acquisition_time': 0, 'satellite': 0, 'instrument': 0, 'confidence': 0, 'confidence_numeric': 26042, 'confidence_class': 0, 'brightness': 0, 'bright_t31': 0, 'frp': 0, 'daynight': 0, 'scan': 0, 'track': 0, 'hotspot_type': 0, 'version': 0, 'acquisition_time_raw': 0, 'sensor_key': 0, 'sensor_family': 0, 'product_id': 0, 'source_file': 0, 'source_archive': 0}`
- Hotspot type counts: `{'2': 18929, '0': 7035, '3': 78, '<NA>': 0}`
- Day/night counts: `{'N': 20361, 'D': 5681}`
- Calendar days with no source row, left empty: 2025-07-06 to 2025-07-07 (2 days)
- Coverage: 2 calendar days in 2025 have no row in the source file: 2025-07-06 through 2025-07-07 (2 days). These days were left empty. No observations were invented. For MODIS, a day with no row is consistent with a 1 km product that records few detections; it is not marked as a truncated download.

## Result

Input rows: 225,243. Cleaned rows: 225,243. Rejected rows: 0. Synthesized rows: 0.

Phase 3 has not been run.
