# Phase 4 report: temporal, spatial, sensor, coverage, and static-source analysis

*All numbers below are read from `data/analysis/*.csv` when this report is generated. Re-run `python main.py phase4` to refresh both.*

## 1. What Phase 4 analyses

Thermal detections from NASA FIRMS over Egypt: when they occur, where they concentrate, how the sensors compare, how much of the calendar each sensor actually covers, and how static thermal sources (type 2) shape the picture. A detection is a thermal anomaly. Only type 0 rows are called **vegetation-fire candidates**; they are not confirmed fires, burned area, or intensity. Type 2 rows are **static thermal sources** and are analysed separately. No Fire Activity Index is built (Phase 5).

## 2. Data and sensors

| sensor_key | nominal_resolution_m | n_rows | n_type0_vegetation_candidates | n_type2_static | n_type3_water | observed_days | unobserved_days |
|---|---|---|---|---|---|---|---|
| MODIS | 1000 | 4127 | 3457 | 665 | 5 | 843 | 253 |
| NOAA20 | 375 | 86814 | 29329 | 56962 | 523 | 1089 | 7 |
| NOAA21 | 375 | 79251 | 23989 | 54948 | 314 | 1035 | 61 |
| SNPP | 375 | 83983 | 27914 | 55688 | 381 | 1075 | 21 |

Input rows: 254,175 (2023-2025). MODIS ~1 km, VIIRS ~375 m. Sensors are never summed as independent events.

## 3. Analysis period and grid

Years 2023-2025. Grid: 0.05 degrees (Phase 3 grid kept). A **cell-day** is one grid cell on one UTC date with at least one detection, counted once however many sensors or records contributed. Rows dated outside the analysis years are dropped from the analysis copy only.

## 4. Temporal methodology

* **Coverage first.** A sensor-day is *observed* when the coverage calendar finds at least one record of any type. Rates divide by observed days only. A day with no records at all is a coverage fact, not zero fire; an observed day with zero candidates (for example, static records only) is a valid zero.

* **Series.** Per sensor, plus VIIRS unions counted as cell-days: `VIIRS_3sensor_union` (needs all three VIIRS sensors observed), `VIIRS_NOAA20_SNPP_union`, and two static-exclusion sensitivities.

* **MODIS** has totals but no per-day rates: an empty MODIS day cannot be told apart from missing MODIS data.

* **Matched days.** Year-over-year change uses only calendar dates usable in all 3 years (Feb 29 dropped).

* **Seasons** are meteorological with a **season year**: December belongs to the following winter. Season-years the window cannot cover completely are flagged `season_year_complete = False`.

* **Hourly profile** uses Africa/Cairo local time with daylight saving; UTC stays untouched. Overpass times are fixed in UTC, so the profile mostly shows the satellite schedule.


**Matched-day result, `VIIRS_3sensor_union`** (279 matched days, 03-01 to 12-31):

| year | total_cell_days | mean_cell_days_per_day | pct_change_vs_previous_year | pct_change_vs_first_year |
|---|---|---|---|---|
| 2023.0 | 16143.0 | 57.86 |  |  |
| 2024.0 | 12375.0 | 44.35 | -23.34 | -23.34 |
| 2025.0 | 9597.0 | 34.4 | -22.45 | -40.55 |

The same direction appears in each single-sensor matched series (see `matched_day_yearly.csv`). This is descriptive. It does not identify a cause, and it may combine real change with changes in detection, processing, or static-source behaviour.

Sensitivity series:

| series | year | n_matched_days | total_cell_days | pct_change_vs_first_year |
|---|---|---|---|---|
| VIIRS_NOAA20_SNPP_union | 2023 | 337 | 13940.0 |  |
| VIIRS_NOAA20_SNPP_union | 2024 | 337 | 10862.0 | -22.08 |
| VIIRS_NOAA20_SNPP_union | 2025 | 337 | 8053.0 | -42.23 |
| VIIRS_3sensor_union_excl_static_3x3_any_year | 2023 | 279 | 11128.0 |  |
| VIIRS_3sensor_union_excl_static_3x3_any_year | 2024 | 279 | 8515.0 | -23.48 |
| VIIRS_3sensor_union_excl_static_3x3_any_year | 2025 | 279 | 6384.0 | -42.63 |
| VIIRS_3sensor_union_excl_static_3x3_same_year | 2023 | 279 | 11398.0 |  |
| VIIRS_3sensor_union_excl_static_3x3_same_year | 2024 | 279 | 8759.0 | -23.15 |
| VIIRS_3sensor_union_excl_static_3x3_same_year | 2025 | 279 | 6698.0 | -41.24 |

Pooled peak month for `VIIRS_NOAA20_SNPP_union`: month 10 (mean 69.42 cell-days per used day over 92 used days, 3 years).

Incomplete season-years for `VIIRS_NOAA20_SNPP_union`:

| season_year | season | calendar_days | expected_season_days |
|---|---|---|---|
| 2023 | DJF | 59 | 90 |
| 2026 | DJF | 31 | 90 |

## 5. Spatial methodology

* Spatial tables use **VIIRS vegetation-candidate cell-days** (union of the three VIIRS sensors). They are not normalised by coverage.
* **Hotspot clusters**: cells at or above the 95th percentile of active days (per scope) that touch (8 neighbours) form one cluster. A cluster is a statistical concentration, not a fire location.
* **Persistent cells**: at least 91 cell-days in one year.
* **Geographic blocks** are 1-degree analytical bins named like `B31N_29E`. They are **not governorates**.

Active VIIRS candidate cells: 3,596; cell-days: 45,595.

| cell_filter | n_active_cells | total_cell_days | top_5pct_cells_share | gini | cells_for_50pct_of_cell_days |
|---|---|---|---|---|---|
| all_viirs_veg_cells | 3596 | 45595.0 | 0.36 | 0.647 | 343 |
| excl_static_3x3_neighborhood | 3133 | 30363.0 | 0.279 | 0.588 | 399 |
| excl_persistent_cells | 3575 | 41182.0 | 0.315 | 0.62 | 397 |

All-years clusters: threshold 48.0 days, 184 high cells, 96 clusters (65 single-cell).

Largest all-years clusters:

| cluster_id | n_cells | total_cell_days | centroid_lat | centroid_lon | static_proximity_flag |
|---|---|---|---|---|---|
| HC-all_years-001 | 29 | 2049 | 30.932 | 31.492 | some_cells |
| HC-all_years-002 | 7 | 747 | 31.07 | 29.822 | all_cells |
| HC-all_years-003 | 3 | 681 | 30.713 | 27.72 | all_cells |
| HC-all_years-004 | 4 | 579 | 30.666 | 26.993 | all_cells |
| HC-all_years-005 | 10 | 579 | 30.761 | 31.714 | none |

Top blocks by candidate cell-days:

| block_id_1deg | n_veg_cells | veg_cell_days_total | veg_cell_days_excl_static_3x3 | top_cell_id |
|---|---|---|---|---|
| B30N_31E | 349 | 7926 | 5999 | G605_636 |
| B31N_31E | 189 | 4101 | 3818 | G620_629 |
| B30N_30E | 368 | 3190 | 2789 | G607_611 |
| B30N_27E | 63 | 2380 | 178 | G614_554 |
| B30N_29E | 142 | 1988 | 1556 | G617_589 |

## 6. Static-source methodology

Type 2 rows are never deleted or mixed into candidate tables. Three populations are kept distinct: (a) static detections from all sensors (`static_source_cells`), (b) VIIRS static cell-days (used for neighbourhood flags and proximity), (c) vegetation candidates. Exclusion of cells in or next to static cells (3x3) is a **sensitivity analysis**, not a correction: `VIIRS_3sensor_union_excl_static_3x3_any_year` uses static cells seen in any year (conservative); `VIIRS_3sensor_union_excl_static_3x3_same_year` uses static cells seen in the same year.

* Candidate cells with a static cell in the same cell: 143; in the 3x3 neighbourhood: 463 (12.9% of cells, 33.4% of cell-days).
* Of the 10 most active cells, 10 have a VIIRS static cell in the 3x3 neighbourhood.
* Persistent cells (any year): 21; with static in 3x3: 19.
* Spearman correlation between distance to nearest VIIRS static cell and candidate cell-days: -0.307 (descriptive, not causal).

| proximity_band | n_cells | veg_cell_days | mean_days_per_cell | median_days_per_cell | n_persistent_cells | share_of_cells | share_of_cell_days |
|---|---|---|---|---|---|---|---|
| 1_same_cell | 143 | 11520 | 80.559 | 57.0 | 19 | 0.04 | 0.253 |
| 2_adjacent_cell_8neighbour | 320 | 3712 | 11.6 | 6.0 | 0 | 0.089 | 0.081 |
| 3_within_10km | 63 | 462 | 7.333 | 5.0 | 0 | 0.018 | 0.01 |
| 4_10_to_50km | 1913 | 23598 | 12.336 | 7.0 | 2 | 0.532 | 0.518 |
| 5_beyond_50km | 1157 | 6303 | 5.448 | 3.0 | 0 | 0.322 | 0.138 |

Many of the most active candidate cells sit in or next to static thermal sources, so the headline hotspot map should be read together with the exclusion sensitivity.

## 7. Sensor-comparison methodology

All comparisons are **grid-cell co-occurrence on the 0.05 degree grid**. They are not pixel-level agreement and do not show that two satellites saw the same physical fire. VIIRS pairs use only days both sensors were observed. MODIS (~1 km) versus VIIRS (~375 m) differ in pixel size and sensitivity, so VIIRS is expected to flag many cell-days MODIS does not. Two day bases are reported for MODIS vs VIIRS: days with a MODIS record (biased toward MODIS detections) and all fully covered VIIRS days with empty MODIS days assumed to have no cell-days (an assumption, not a measurement). Confidence is never merged: MODIS is numeric 0-100, VIIRS is l/n/h, reported separately in `sensor_profile`.

| comparison_type | sensor_a | sensor_b | day_basis | n_common_days | jaccard | share_a_also_in_b | share_b_also_in_a | share_a_with_b_in_3x3 | spearman_daily_cells |
|---|---|---|---|---|---|---|---|---|---|
| viirs_pair | NOAA20 | NOAA21 | both_sensors_observed | 1028 | 0.128 | 0.212 | 0.245 | 0.335 | 0.56 |
| viirs_pair | NOAA20 | SNPP | both_sensors_observed | 1068 | 0.155 | 0.259 | 0.279 | 0.385 | 0.58 |
| viirs_pair | NOAA21 | SNPP | both_sensors_observed | 1014 | 0.145 | 0.263 | 0.245 | 0.398 | 0.587 |
| modis_vs_viirs_union | MODIS | VIIRS_3sensor_union | modis_has_records | 779 | 0.023 | 0.332 | 0.024 | 0.529 | 0.4 |
| modis_vs_viirs_union | MODIS | VIIRS_3sensor_union | all_viirs_full_days_modis_empty_assumed_zero | 1007 | 0.018 | 0.332 | 0.019 | 0.529 | 0.346 |

## 8. Coverage methodology

Coverage comes from `coverage_calendar.csv`: observed, documented source gap, no records (unconfirmed), or not expected before science start. Observed is inferred from the presence of records, so a genuine VIIRS day with no records of any kind is indistinguishable from missing data and is excluded (conservative).

| sensor_key | observed_days | documented_source_gap_days | no_records_unconfirmed_days | not_expected_before_science_start_days | calendar_days |
|---|---|---|---|---|---|
| MODIS | 843 | 0 | 253 | 0 | 1096 |
| NOAA20 | 1089 | 6 | 1 | 0 | 1096 |
| NOAA21 | 1035 | 0 | 2 | 59 | 1096 |
| SNPP | 1075 | 19 | 2 | 0 | 1096 |

Hourly profile rows: 143.

## 9. Known limitations

1. Detections are thermal anomalies, not confirmed fires.
2. MODIS coverage cannot be confirmed on empty days, so MODIS has no rates.
3. Observed days are inferred from records; true zero-record VIIRS days are treated as unobserved.
4. Spatial cell-days are not coverage-normalised and are a union of VIIRS sensors with different start dates.
5. The 0.05 degree grid (~5 km) is coarser than VIIRS pixels; co-occurrence on it is not the same fire.
6. Static-source exclusion is a sensitivity view; unflagged industrial or other static heat can remain in type 0.
7. Three years cannot separate trend from year-to-year variability; matched-day change is descriptive.
8. DJF season-years at the window edges are incomplete (flagged).
9. The 1-degree blocks are analytical bins, not administrative areas.
10. Hotspot cluster thresholds are a project choice (percentile), not a statistical test.

## 10. Validation and testing

* Pipeline executed on real data: 254,175 rows in 6.0 s, 30 tables, 0 warnings.
* Numerical consistency checks: 21 of 21 passed (`consistency_checks.csv`).
* Automated tests: `tests/test_phase4_analysis.py` (see completion summary for the run result).

| check | passed |
|---|---|
| VIIRS vegetation cell-days are unique per (date, cell) | True |
| spatial_cells total cell-days == unique VIIRS veg (date, cell) rows | True |
| spatial_cells has one row per grid_cell_id | True |
| cell-days never exceed raw detections | True |
| sensor_day veg detections == raw rows [MODIS] | True |
| sensor_day veg detections == raw rows [NOAA20] | True |
| sensor_day veg detections == raw rows [NOAA21] | True |
| sensor_day veg detections == raw rows [SNPP] | True |
| sensor_profile n_rows sums to total harmonized rows | True |
| type 0 + 2 + 3 + other == total rows | True |
| observed days in sensor_day == observed days in coverage calendar | True |
| every sensor-day has exactly one coverage row | True |
| daily_summary has one row per date | True |
| VIIRS union cells <= sum of sensor cells and >= max sensor cells | True |
| union excl. static <= union (any-year and same-year) | True |
| regional blocks total cell-days == spatial_cells total | True |
| block ids are strings | True |
| cluster shares per scope are <= 1 | True |
| matched-day counts identical across years per series | True |
| series_daily has one row per (series, date) | True |
| no infinite values in any table | True |

## 11. Recommendations for Phase 5 (not implemented)

* Build any index on cell-day presence, not raw counts, and keep sensors separate.
* Divide by observed days, and restrict year comparisons to matched days.
* Decide explicitly how to treat static-neighbourhood cells; keep the exclusion as a documented, switchable sensitivity.
* Do not use MODIS empty days as zeros.
* Treat the 2023-2025 change as descriptive until longer history is available.
