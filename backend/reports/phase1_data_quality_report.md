# FireScope Phase 1 — Data Quality Report

Inspection date: 2026-11-13  
Scope: the 12 archive CSVs for 2023, 2024, and 2025. Raw files were read only. Nothing in `Modis/`, `VIIRS NOAA-20/`, `VIIRS NOAA-21/`, or `VIIRS S-NPP/` was modified.

This report describes the files as they are. It does not clean, harmonize, or aggregate them.

## 1. Where the files actually are

The downloads are NASA FIRMS zip archives, not the `FireScope_Data/YYYY/*.csv` layout. Each 2023–2025 zip contains one archive CSV plus a one-line `Readme.txt` that only points to the public FIRMS readme.

MODIS 2023–2025 are also extracted next to their zips. Uncompressed sizes match the CSVs inside the zips. VIIRS files are still zipped only.

| Year | Source folder | Archive | CSV inside the zip | Rows |
| --- | --- | --- | --- | --- |
| 2023 | `Modis` | `DL_FIRE_M-C61_844811_2023.zip` | `fire_archive_M-C61_844811.csv` | 1,421 |
| 2024 | `Modis` | `DL_FIRE_M-C61_844824_2024.zip` | `fire_archive_M-C61_844824.csv` | 1,268 |
| 2025 | `Modis` | `DL_FIRE_M-C61_844838_2025.zip` | `fire_archive_M-C61_844838.csv` | 1,438 |
| 2023 | `VIIRS NOAA-20` | `DL_FIRE_J1V-C2_844848_2023.zip` | `fire_archive_J1V-C2_844848.csv` | 2,093 |
| 2024 | `VIIRS NOAA-20` | `DL_FIRE_J1V-C2_844849_2024.zip` | `fire_archive_J1V-C2_844849.csv` | 28,873 |
| 2025 | `VIIRS NOAA-20` | `DL_FIRE_J1V-C2_844850_2025.zip` | `fire_archive_J1V-C2_844850.csv` | 26,916 |
| 2023 | `VIIRS NOAA-21` | `DL_FIRE_J2V-C2_844851_2023.zip` | `fire_archive_J2V-C2_844851.csv` | 26,280 |
| 2024 | `VIIRS NOAA-21` | `DL_FIRE_J2V-C2_844852_2024.zip` | `fire_archive_J2V-C2_844852.csv` | 27,568 |
| 2025 | `VIIRS NOAA-21` | `DL_FIRE_J2V-C2_844853_2025.zip` | `fire_archive_J2V-C2_844853.csv` | 25,403 |
| 2023 | `VIIRS S-NPP` | `DL_FIRE_SV-C2_844842_2023.zip` | `fire_archive_SV-C2_844842.csv` | 30,763 |
| 2024 | `VIIRS S-NPP` | `DL_FIRE_SV-C2_844845_2024.zip` | `fire_archive_SV-C2_844845.csv` | 27,178 |
| 2025 | `VIIRS S-NPP` | `DL_FIRE_SV-C2_844847_2025.zip` | `fire_archive_SV-C2_844847.csv` | 26,042 |

Product codes in the filenames:

- `M-C61` — MODIS Collection 6.1 (Terra and Aqua together in one file)
- `SV-C2` — VIIRS S-NPP Collection 2
- `J1V-C2` — VIIRS NOAA-20 Collection 2
- `J2V-C2` — VIIRS NOAA-21 Collection 2

Total rows in the 12 files: **225,243**.

## 2. Schema: one header, two physical meanings

Every one of the 12 CSVs has this exact header, in this order:

```text
latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type
```

There are 15 columns. No file is missing a column, and no file has an extra column. There is no byte-order mark.

Column names are therefore consistent. Column **meaning and dtype are not**.

| Role | Column in these files | MODIS (M-C61) | VIIRS (SV-C2, J1V-C2, J2V-C2) |
| --- | --- | --- | --- |
| Latitude | `latitude` | float, degrees | float, degrees, more decimal places |
| Longitude | `longitude` | float, degrees | float, degrees |
| Primary brightness | `brightness` | Kelvin, about 300–444. One 2024 row equals 367 | Kelvin. 3,771 rows are exactly 367.0, which is the top of the column in every VIIRS file |
| Along-scan pixel size | `scan` | about 1.0–4.8 km | about 0.32–0.80 km |
| Along-track pixel size | `track` | about 1.0–2.0 km | about 0.36–0.78 km |
| Acquisition date | `acq_date` | string `YYYY-MM-DD`, all parsed | same |
| Acquisition time | `acq_time` | integer HHMM, leading zeros already gone | same |
| Satellite | `satellite` | `Terra`, `Aqua` | `N20`, `N21`, or `SNPP` |
| Instrument | `instrument` | `MODIS` | `VIIRS` for NOAA-20 and NOAA-21; **`SNPP` for S-NPP** |
| Confidence | `confidence` | integer 0–100 | string `l`, `n`, `h` |
| Product version | `version` | float `61.03` | integer `2` |
| Second brightness | `bright_t31` | about 272–337 K | about 251–384 K, including values above 367 |
| Fire radiative power | `frp` | mean about 23–41 MW | mean about 1.8–4.1 MW. The 1.8 MW figure is the January-only NOAA-20 2023 file. Full VIIRS years sit around 2.9–4.1 MW |
| Day or night | `daynight` | `D` or `N` | `D` or `N` |
| Hotspot type | `type` | integer 0, 2, or 3 | integer 0, 2, or 3 |

The VIIRS headers use the MODIS names `brightness` and `bright_t31`. They do **not** use `bright_ti4` and `bright_ti5`. Pixel size (`scan` near 0.375 km at the low end) and the 367 K brightness ceiling are the VIIRS I-band pattern, stored under MODIS column names. Later phases must not treat `brightness` as the same spectral channel on both sensors, and must not compare raw counts or raw FRP across sensors.

## 3. Per-file quality

No file has nulls, blank strings, unparseable dates, coordinates outside −90/90 or −180/180, exact duplicate rows, or duplicate `(latitude, longitude, acq_date, acq_time)` keys.

Coordinates fall in latitude 21.998–31.585 and longitude 25.155–35.687. That is an Egypt bounding box. A few S-NPP points sit just south of 22°N (minimum 21.99785 in 2023). None are global stray detections.

`acq_time` is an integer from 0 to 2359. Pandas reads `0000` as `0` and `0834` as `834`. Digit length is 1–4. Standardization has to zero-pad to four digits and then parse HHMM. It must not be treated as minutes or as a decimal hour.

### MODIS Collection 6.1

| Year | Rows | Date span | Days with detections | Calendar days with no row | Satellites | Confidence | Mean FRP (MW) | Day / night |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2023 | 1,421 | 2023-01-01 to 2023-12-31 | 288 | 77 | Terra 866, Aqua 555 | 0–100, mean 62.4; 43 rows at 0 | 23.4 (min 3.6, max 671.5) | D 1,018 / N 403 |
| 2024 | 1,268 | 2024-01-01 to 2024-12-28 | 272 | 94 | Terra 898, Aqua 370 | 0–100, mean 66.2; 24 rows at 0 | 32.4 (min 2.6, max 750.7) | D 828 / N 440 |
| 2025 | 1,438 | 2025-01-06 to 2025-12-31 | 283 | 82 | Terra 1,112, Aqua 326 | 0–100, mean 69.9; 4 rows at 0 | 40.5 (min 3.2, max 906.8) | D 916 / N 522 |

Empty MODIS days are scattered. With roughly 1,300–1,400 detections per year, many quiet days are expected. Those gaps are not, by themselves, evidence of a truncated download.

`type` counts: 2023 = 0: 1,192, 2: 226, 3: 3. 2024 = 0: 1,046, 2: 220, 3: 2. 2025 = 0: 1,219, 2: 219. No `type` value of 1 appears. FIRMS documents `type` as 0 presumed vegetation, 1 active volcano, 2 other static land source, 3 offshore. That legend is the FIRMS definition, not something measured from these rows.

Instrument is always `MODIS`. Version is always `61.03`. FRP is never 0 and never null.

### VIIRS NOAA-20 (`J1V-C2`)

| Year | Rows | Date span | Days with detections | Confidence `n` / `l` / `h` | FRP (MW) | FRP = 0 | Day / night |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2023 | 2,093 | **2023-01-01 to 2023-01-31 only** | 31 | 2,071 / 13 / 9 | min 0.12, mean 1.76, max 31.34 | 0 | N 1,843 / D 250 |
| 2024 | 28,873 | 2024-01-01 to 2024-12-31 | 365 except 2024-02-04 | 26,514 / 2,101 / 258 | min 0.05, mean 2.90, max 250.64 | 0 | N 21,434 / D 7,439 |
| 2025 | 26,916 | 2025-01-01 to 2025-12-31 | 365 | 24,692 / 1,957 / 267 | min 0.00, mean 3.00, max 300.73 | 2 | N 20,971 / D 5,945 |

NOAA-20 2025 also has 1 row with brightness below 250 K (207.93). Brightness in the 2023 and 2024 files stays at or above 295 K and tops out at 367.0 (9 rows in 2023, 468 in 2024, 517 in 2025).

**NOAA-20 2023 is a truncated file.** It contains January only (2,093 rows, all 31 days). January 2024 has 2,053 rows, so January 2023 looks like a normal month. February–December 2023 are absent. This is not the known NOAA-21 commissioning gap. NOAA-20 was already in orbit. Any 2023 NOAA-20 annual total computed from this file would be about one month of data.

Satellite is always `N20`. Instrument is always `VIIRS`. Version is always `2`.

### VIIRS NOAA-21 (`J2V-C2`)

| Year | Rows | Date span | Missing calendar days | Confidence `n` / `l` / `h` | FRP (MW) | FRP = 0 | Brightness = 367 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2023 | 26,280 | 2023-03-01 to 2023-12-31 | 1 Jan–28 Feb (59 days) | 24,021 / 1,844 / 415 | min 0.05, mean 4.07, max 347.11 | 0 | 496 |
| 2024 | 27,568 | 2024-01-01 to 2024-12-31 | 2024-02-27, 2024-02-28 | 25,415 / 1,842 / 311 | min 0.00, mean 3.65, max 305.38 | 2 | 438 |
| 2025 | 25,403 | 2025-01-01 to 2025-12-31 | none | 23,373 / 1,763 / 267 | min 0.00, mean 3.75, max 529.08 | 6 | 402 |

January and February 2023 are absent, which matches NOAA-21 science-data availability (observations begin in March 2023). The file starts at the March boundary rather than with a partial February. 2024 is missing two consecutive days. 2025 is complete at daily coverage.

Satellite is always `N21`. Instrument is always `VIIRS`. Version is always `2`.

Day/night for 2023: N 18,055 / D 8,225. 2024: N 20,803 / D 6,765. 2025: N 20,176 / D 5,227.

`type` is dominated by 2 (other static land source in the FIRMS legend): 16,347 / 19,838 / 18,763 across 2023–2025, then type 0, then a small type 3 count (123, 114, 77). No type 1.

### VIIRS S-NPP (`SV-C2`)

| Year | Rows | Date span | Missing calendar days | Confidence `n` / `l` / `h` | Mean FRP (MW) | FRP = 0 | Brightness < 250 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2023 | 30,763 | 2023-01-01 to 2023-12-31 | none | 28,461 / 1,903 / 399 | 3.33 (min 0, max 199.5) | 2 | 7 |
| 2024 | 27,178 | 2024-01-01 to 2024-12-31 | 19 days, in clusters | 24,972 / 1,901 / 305 | 3.20 (min 0.08, max 343.71) | 0 | 17 |
| 2025 | 26,042 | 2025-01-01 to 2025-12-31 | 2025-07-06, 2025-07-07 | 23,952 / 1,803 / 287 | 3.03 (min 0.08, max 283.28) | 0 | 2 |

S-NPP 2024 missing days:

- 2024-05-30 through 2024-06-03
- 2024-07-10 through 2024-07-15
- 2024-07-25 through 2024-07-28
- 2024-09-26
- 2024-11-03 through 2024-11-05

July 2024 has 1,389 rows, against about 2,200 in the neighboring months. Clustered gaps are more consistent with missing coverage than with a quiet day. They should stay flagged in later analysis rather than being filled.

Satellite is always `SNPP`. **Instrument is `SNPP`, not `VIIRS`.** That is a real label inconsistency. Version is always `2`.

Day/night: 2023 N 21,673 / D 9,090. 2024 N 20,106 / D 7,072. 2025 N 20,361 / D 5,681.

## 4. Monthly counts

These are detection counts, not fire counts. VIIRS 375 m will report more detections than MODIS 1 km for the same fire.

| Month | MODIS | NOAA-20 | NOAA-21 | S-NPP |
| --- | ---: | ---: | ---: | ---: |
| 2023-01 | 56 | 2,093 | 0 | 2,095 |
| 2023-02 | 66 | 0 | 0 | 1,806 |
| 2023-03 | 77 | 0 | 2,308 | 2,267 |
| 2023-04 | 103 | 0 | 2,302 | 2,497 |
| 2023-05 | 156 | 0 | 2,626 | 2,825 |
| 2023-06 | 127 | 0 | 2,298 | 2,337 |
| 2023-07 | 71 | 0 | 2,193 | 2,254 |
| 2023-08 | 82 | 0 | 2,401 | 2,508 |
| 2023-09 | 212 | 0 | 3,921 | 3,866 |
| 2023-10 | 331 | 0 | 4,170 | 4,212 |
| 2023-11 | 85 | 0 | 2,262 | 2,221 |
| 2023-12 | 55 | 0 | 1,799 | 1,875 |
| 2024-01 | 60 | 2,053 | 2,025 | 1,992 |
| 2024-02 | 82 | 1,954 | 1,684 | 2,042 |
| 2024-03 | 129 | 2,380 | 2,425 | 2,535 |
| 2024-04 | 84 | 2,296 | 2,192 | 2,331 |
| 2024-05 | 131 | 2,727 | 2,735 | 2,609 |
| 2024-06 | 204 | 2,526 | 2,141 | 2,221 |
| 2024-07 | 91 | 2,257 | 2,135 | 1,389 |
| 2024-08 | 62 | 2,368 | 2,341 | 2,376 |
| 2024-09 | 113 | 2,884 | 2,772 | 2,554 |
| 2024-10 | 185 | 3,401 | 3,109 | 3,362 |
| 2024-11 | 67 | 2,244 | 2,164 | 1,918 |
| 2024-12 | 60 | 1,783 | 1,845 | 1,849 |
| 2025-01 | 51 | 1,763 | 1,771 | 1,694 |
| 2025-02 | 66 | 1,466 | 1,387 | 1,466 |
| 2025-03 | 211 | 2,423 | 2,245 | 2,366 |
| 2025-04 | 55 | 2,043 | 1,933 | 2,106 |
| 2025-05 | 117 | 2,577 | 2,346 | 2,431 |
| 2025-06 | 144 | 2,424 | 2,360 | 2,623 |
| 2025-07 | 183 | 2,450 | 2,203 | 1,996 |
| 2025-08 | 62 | 2,440 | 2,198 | 2,338 |
| 2025-09 | 230 | 2,657 | 2,558 | 2,611 |
| 2025-10 | 181 | 2,605 | 2,572 | 2,564 |
| 2025-11 | 82 | 2,175 | 1,948 | 1,956 |
| 2025-12 | 56 | 1,893 | 1,882 | 1,891 |

## 5. Issues that must drive later phases

1. **Do not concatenate on column position alone and then treat confidence as one number.** MODIS confidence is 0–100. VIIRS confidence is `l` / `n` / `h`. A shared numeric confidence column would be invented data. Keep both representations, and map VIIRS classes only with an explicit documented crosswalk if a common score is required.

2. **Do not compare raw hotspot counts or raw FRP across MODIS and VIIRS.** MODIS has about 1,300–1,400 rows per year. Each full VIIRS year has about 25,000–31,000. Mean FRP is about 23–41 MW on MODIS and about 2.9–4.1 MW on a full VIIRS year. `scan`/`track` show ~1 km versus ~375 m pixels.

3. **Keep satellite identity on every row.** Values in the files are `Terra`, `Aqua`, `N20`, `N21`, `SNPP`. S-NPP’s `instrument` value is `SNPP`, while NOAA-20 and NOAA-21 use `VIIRS`.

4. **`brightness` and `bright_t31` are shared names, not shared channels.** VIIRS brightness saturates at 367 K. MODIS brightness does not (max 436–444 K; one MODIS 2024 row equals 367).

5. **NOAA-20 2023 cannot support a 2023 annual or seasonal baseline.** Only January is present.

6. **NOAA-21 has no January or February 2023 rows.** That matches the sensor record. Do not impute those months.

7. **S-NPP 2024 has 19 missing days in multi-day blocks**, and a low July count. Flag them. Do not interpolate detections.

8. **`type` is mostly 2 on VIIRS** (FIRMS: other static land source) and mostly 0 on MODIS (FIRMS: presumed vegetation). Dropping type 2 would change the series. Keep the field and make any filter explicit.

9. **FRP equals 0 on 12 VIIRS rows** (S-NPP 2023: 2, NOAA-20 2025: 2, NOAA-21 2024: 2, NOAA-21 2025: 6). These are present values, not nulls. Do not replace them. A later filter can exclude them if the rule is documented.

10. **A few VIIRS brightness values are below 250 K** (NOAA-20 2025: 1, NOAA-21 2023: 2, NOAA-21 2024: 2, NOAA-21 2025: 8, S-NPP 2023: 7, S-NPP 2024: 17, S-NPP 2025: 2). They are inside the numeric column. They are not nulls.

11. **No within-file duplicates** on the full row or on latitude, longitude, date, and time. Cross-sensor overlap has not been measured yet. Phase 3 should look for it and should not delete a detection only because another sensor saw something nearby.

## 6. Files present but outside the 12-file scope

Four 2026 zips are in the same folders. They were not included in the tables above.

| Archive | Contents | Header difference |
| --- | --- | --- |
| `Modis\DL_FIRE_M-C61_844872_2026.zip` | `fire_archive_M-C61_844872.csv`, `fire_nrt_M-C61_844872.csv` | NRT file has 14 columns. It has no `type`. |
| `VIIRS NOAA-20\DL_FIRE_J1V-C2_844873_2026.zip` | archive + `fire_nrt_J1V-C2_844873.csv` | NRT file has no `type`. |
| `VIIRS NOAA-21\DL_FIRE_J2V-C2_844874_2026.zip` | archive + `fire_nrt_J2V-C2_844874.csv` | NRT file has no `type`. |
| `VIIRS S-NPP\DL_FIRE_J1V-C2_844873_2026.zip` | same two CSV names as the NOAA-20 2026 zip | NRT file has no `type`. |

The S-NPP 2026 zip is a byte-for-byte copy of the NOAA-20 2026 zip (`J1V-C2`, SHA-256 `eec4baf4e6c247984b33c81dc297189ad80ae3d6510821e1da21566162289023`). It is a NOAA-20 file sitting in the S-NPP folder. There is no `SV-C2` 2026 archive in this project.

Archive 2026 CSVs use the same 15-column header as 2023–2025. Near-real-time CSVs drop `type`. If 2026 is added later, archive and NRT must be handled as two schemas, and the misplaced S-NPP zip must not be loaded as S-NPP.

## 7. What Phase 2 has to respect

- Read from the zips or from copies. Do not rewrite the archives or the extracted MODIS CSVs.
- Map columns by name.
- Parse `acq_date` as `YYYY-MM-DD` (already in that form).
- Store `acq_time` as a zero-padded HHMM string, then as a time. Integer `0` is midnight.
- Keep `confidence` sensor-specific. Do not cast VIIRS `n` through a numeric parser.
- Keep `satellite` and `instrument` as stored, and add a normalized source key so S-NPP is not lost because its instrument value is `SNPP`.
- Carry `brightness`, `bright_t31`, `scan`, `track`, `frp`, `daynight`, `type`, and `version` through, with the sensor attached.
- Leave FRP 0, confidence 0, and low brightness values as observed values unless a documented filter removes the row.
- Record `source_file` from the archive name.
- Do not fill NOAA-20 February–December 2023 or NOAA-21 January–February 2023.

Phase 2 has not been implemented.
