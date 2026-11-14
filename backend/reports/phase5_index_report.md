# FireScope Phase 5: Fire Activity Index (FAI) report

*Generated from `data/index/*.csv`. Baseline version **v1** (frozen 2026-11-13T21:14:18Z). Re-run `python main.py phase5` to refresh.*

## 1. How to read this index

FAI measures **detected vegetation-fire-candidate cell-day activity per usable day, relative to a frozen 2023-2025 reference** for the same series. FAI = 100 equals the reference average, 150 is 1.5 times it, 50 is half of it.

It is **not** a count of fires, not burned area, not fire intensity, not a probability, and not a 0-100 score. Type-0 detections are vegetation-fire **candidates**, not confirmed fires. Differences may come from real activity, detection and processing differences, cloud, unobserved areas, or static-source behaviour. Nothing here identifies a cause, and 100 is not a "normal" level because the reference is only three years.

Series are self-referenced: **compare shape and direction within a series, not levels between series or between blocks.**

## 2. Definition (Design A)

* Unit: **cell-day** = one 0.05 degree cell, one UTC date, at least one type-0 VIIRS detection; several sensors in the set count once.
* Headline sensor set: **NOAA-20 + S-NPP**. MODIS is not indexed. Static (type 2) rows never enter the index.
* Usable day: every sensor in the set has `coverage_status = observed` that day. This is a **record-presence proxy** (`coverage_basis = record_presence_proxy`): it does not prove that all of Egypt was viewed or cloud-free. Unusable days are never zeros.
* `r(P)` = mean cell-days per usable day in period P. `FAI(P) = 100 * r(P) / B`.
* `B` = frozen reference: mean cell-days per day over the matched month-days usable in 2023, 2024 and 2025 (29 February dropped), computed separately for every series.
* `kappa(P)` = usable days / expected days. Expected days exclude days before a sensor's science start (NOAA-21: 2023-03-01). Quality: `reliable` kappa >= 0.8; `partial_coverage` 0.5 to < 0.8; `insufficient_coverage` (FAI = NA) kappa < 0.5, fewer than 15 usable days in a month, or a period cut by the data window (incomplete season); `not_expected` before science start (NA).
* `FAI_sa` (secondary, descriptive): `100 * r(P) / B_calendar-month` (or season) using the matched-date mean of that calendar month; indicative only with three years.

## 3. Frozen baseline

* Baseline file: `data/index/baseline_v1.json`. Years: [2023, 2024, 2025]. Static mask: 144 VIIRS type-2 cells seen in any baseline year, expanded to 3x3 (hash `763ac2658b9c8ac0...`).
* Input fingerprint (baseline-year slice of the Phase 3 files): harmonized `960fad3ab4366825...` (254,175 rows), coverage `846c3e0b59acb24a...` (4,384 rows). A mismatch stops the run. Only 2023-2025 rows are hashed, so appending later years does not change it.
* Whole-file SHA-256 of the Phase 3 inputs equal to the values at freeze: **True**.
* Index runs read B from the file and never recompute it. A new baseline requires `--new-baseline` and writes a new version; old versions stay on disk.

| series_id | role | sensors | mask | confidence_rule | n_matched_days | baseline_total_cell_days | baseline_B |
| --- | --- | --- | --- | --- | --- | --- | --- |
| headline_N20_SNPP_core_all | headline | NOAA20+SNPP | core | all | 337 | 32,855 | 32.4975 |
| N20_SNPP_excl3x3_all | static_sensitivity | NOAA20+SNPP | excl3x3 | all | 337 | 21,409 | 21.1761 |
| N20_SNPP_core_excl_low | confidence_sensitivity | NOAA20+SNPP | core | excl_low | 337 | 30,304 | 29.9743 |
| V3_core_all | robustness_3sensor_union | NOAA20+NOAA21+SNPP | core | all | 279 | 38,115 | 45.5376 |
| NOAA20_core_all | single_sensor | NOAA20 | core | all | 358 | 20,713 | 19.2858 |
| NOAA21_core_all | single_sensor | NOAA21 | core | all | 306 | 16,256 | 17.7081 |
| SNPP_core_all | single_sensor | SNPP | core | all | 344 | 18,621 | 18.0436 |

Headline annual index on the matched dates (their mean is 100 by construction, a validation check, not a finding):

| year | n_matched_days | total_cell_days | mean_cell_days_per_matched_day | FAI_on_matched_dates |
| --- | --- | --- | --- | --- |
| 2023 | 337 | 13,940 | 41.3650 | 127.287 |
| 2024 | 337 | 10,862 | 32.2315 | 99.181 |
| 2025 | 337 | 8,053 | 23.8961 | 73.532 |

## 4. Headline results (NOAA-20 + S-NPP, core, all confidence classes)

Yearly, over all usable days of each year:

| period | expected_days | usable_days | kappa | cell_days_on_usable_days | r_cell_days_per_usable_day | FAI | quality_label |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2023 | 365 | 359 | 0.984 | 14,699 | 40.944 | 126.0 | reliable |
| 2024 | 366 | 346 | 0.945 | 11,099 | 32.078 | 98.7 | reliable |
| 2025 | 365 | 363 | 0.995 | 8,665 | 23.871 | 73.5 | reliable |

Seasonal (meteorological; December belongs to the following winter). Incomplete season-years at the window edges are NA:

| period | calendar_days_in_window | expected_days | usable_days | kappa | FAI | FAI_sa | quality_label | na_reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2023-DJF | 59 | 59 | 59 | 1.000 | NA | NA | insufficient_coverage | incomplete_period_window |
| 2023-JJA | 92 | 92 | 88 | 0.957 | 76.3 | 106.3 | reliable | NA |
| 2023-MAM | 92 | 92 | 92 | 1.000 | 125.8 | 121.3 | reliable | NA |
| 2023-SON | 91 | 91 | 89 | 0.978 | 227.8 | 143.9 | reliable | NA |
| 2024-DJF | 91 | 91 | 90 | 0.989 | 73.1 | 114.9 | reliable | NA |
| 2024-JJA | 92 | 92 | 79 | 0.859 | 69.7 | 97.1 | reliable | NA |
| 2024-MAM | 92 | 92 | 90 | 0.978 | 103.7 | 100.0 | reliable | NA |
| 2024-SON | 91 | 91 | 87 | 0.956 | 150.1 | 94.8 | reliable | NA |
| 2025-DJF | 90 | 90 | 90 | 1.000 | 49.6 | 78.0 | reliable | NA |
| 2025-JJA | 92 | 92 | 90 | 0.978 | 66.0 | 91.9 | reliable | NA |
| 2025-MAM | 92 | 92 | 92 | 1.000 | 81.8 | 78.9 | reliable | NA |
| 2025-SON | 91 | 91 | 91 | 1.000 | 97.3 | 61.5 | reliable | NA |
| 2026-DJF | 31 | 31 | 31 | 1.000 | NA | NA | insufficient_coverage | incomplete_period_window |

Monthly:

| period | expected_days | usable_days | kappa | FAI | FAI_sa | quality_label |
| --- | --- | --- | --- | --- | --- | --- |
| 2023-01 | 31 | 31 | 1.000 | 76.4 | 121.7 | reliable |
| 2023-02 | 28 | 28 | 1.000 | 85.0 | 111.2 | reliable |
| 2023-03 | 31 | 31 | 1.000 | 114.2 | 117.7 | reliable |
| 2023-04 | 30 | 30 | 1.000 | 103.3 | 122.9 | reliable |
| 2023-05 | 31 | 31 | 1.000 | 159.3 | 121.3 | reliable |
| 2023-06 | 30 | 30 | 1.000 | 83.7 | 111.6 | reliable |
| 2023-07 | 31 | 27 | 0.871 | 60.1 | 102.5 | reliable |
| 2023-08 | 31 | 31 | 1.000 | 83.3 | 110.5 | reliable |
| 2023-09 | 30 | 29 | 0.967 | 258.0 | 147.8 | reliable |
| 2023-10 | 31 | 30 | 0.968 | 325.9 | 151.5 | reliable |
| 2023-11 | 30 | 30 | 1.000 | 100.6 | 128.3 | reliable |
| 2023-12 | 31 | 31 | 1.000 | 61.8 | 115.7 | reliable |
| 2024-01 | 31 | 31 | 1.000 | 67.6 | 107.6 | reliable |
| 2024-02 | 29 | 28 | 0.966 | 91.8 | 120.1 | reliable |
| 2024-03 | 31 | 31 | 1.000 | 93.8 | 96.8 | reliable |
| 2024-04 | 30 | 30 | 1.000 | 86.2 | 102.5 | reliable |
| 2024-05 | 31 | 29 | 0.935 | 132.4 | 100.8 | reliable |
| 2024-06 | 30 | 27 | 0.900 | 72.9 | 97.3 | reliable |
| 2024-07 | 31 | 21 | 0.677 | 56.7 | 96.8 | partial_coverage |
| 2024-08 | 31 | 31 | 1.000 | 75.6 | 100.4 | reliable |
| 2024-09 | 30 | 29 | 0.967 | 162.0 | 92.8 | reliable |
| 2024-10 | 31 | 31 | 1.000 | 204.1 | 94.9 | reliable |
| 2024-11 | 30 | 27 | 0.900 | 75.3 | 96.1 | reliable |
| 2024-12 | 31 | 31 | 1.000 | 51.3 | 96.0 | reliable |
| 2025-01 | 31 | 31 | 1.000 | 44.4 | 70.7 | reliable |
| 2025-02 | 28 | 28 | 1.000 | 53.6 | 70.2 | reliable |
| 2025-03 | 31 | 31 | 1.000 | 82.9 | 85.5 | reliable |
| 2025-04 | 30 | 30 | 1.000 | 62.8 | 74.7 | reliable |
| 2025-05 | 31 | 31 | 1.000 | 99.3 | 75.6 | reliable |
| 2025-06 | 30 | 30 | 1.000 | 68.5 | 91.4 | reliable |
| 2025-07 | 31 | 29 | 0.935 | 62.0 | 105.7 | reliable |
| 2025-08 | 31 | 31 | 1.000 | 67.2 | 89.2 | reliable |
| 2025-09 | 30 | 30 | 1.000 | 109.3 | 62.6 | reliable |
| 2025-10 | 31 | 31 | 1.000 | 114.5 | 53.3 | reliable |
| 2025-11 | 30 | 30 | 1.000 | 67.5 | 86.1 | reliable |
| 2025-12 | 31 | 31 | 1.000 | 47.2 | 88.4 | reliable |

Months that are not `reliable`: 2024-07 (partial_coverage, kappa 0.68).

Highest and lowest published monthly values: 2023-10 (325.9) and 2025-01 (44.4). These describe detected cell-day activity relative to the reference; they are not a statement about fire occurrence.

Yearly and monthly values average over all usable days of the period, so they differ slightly from the matched-date annual values in section 3 (which use only dates usable in all three years). Both use the same frozen B.

The daily raw series is in `fai_daily.csv`. Unusable days carry NA, not zero.

## 5. Static-source sensitivity (always published next to the headline)

`excl3x3` removes cells in or adjacent to any VIIRS type-2 cell (time-invariant any-year mask) and has its own baseline. `sigma(P) = 1 - sum(c_excl3x3) / sum(c_core)` over the usable days of P (period totals; NA if the denominator is zero). `R(P) = FAI_excl3x3 / FAI_core = (1 - sigma_P) / (1 - sigma_B)`; R < 1 means the static-neighbourhood share is higher than in the reference.

| period | FAI_core | FAI_excl3x3 | sigma_P | sigma_B | R_P |
| --- | --- | --- | --- | --- | --- |
| 2023 | 126.0 | 127.5 | 0.3404 | 0.3484 | 1.0123 |
| 2024 | 98.7 | 97.4 | 0.3570 | 0.3484 | 0.9868 |
| 2025 | 73.5 | 72.8 | 0.3538 | 0.3484 | 0.9916 |

Monthly sigma ranges from 0.176 to 0.615; monthly R from 0.591 to 1.264.
Exclusion is a sensitivity analysis, not a correction: it may remove genuine vegetation-fire candidates in those cells, and unflagged static heat can remain in type 0. sigma and R are not contamination estimates.

## 6. Confidence sensitivity

`excl_low` keeps VIIRS classes n and h only, with its own baseline. Letters are never converted to numbers and MODIS confidence is not used.

| period | FAI_all | FAI_excl_low | FAI_difference_excl_low_minus_all | low_confidence_only_cell_day_share |
| --- | --- | --- | --- | --- |
| 2023 | 126.0 | 126.9 | 1.0 | 0.0707 |
| 2024 | 98.7 | 97.5 | -1.2 | 0.0892 |
| 2025 | 73.5 | 73.0 | -0.4 | 0.0827 |

Share of type-0 detections with confidence class l, by sensor and year (diagnostic):

| sensor_key | year | n_type0_detections | n_low | low_confidence_share |
| --- | --- | --- | --- | --- |
| NOAA20 | 2023 | 12,168 | 1,273 | 0.1046 |
| NOAA20 | 2024 | 9,532 | 1,310 | 0.1374 |
| NOAA20 | 2025 | 7,629 | 1,174 | 0.1539 |
| NOAA21 | 2023 | 9,810 | 1,171 | 0.1194 |
| NOAA21 | 2024 | 7,616 | 1,040 | 0.1366 |
| NOAA21 | 2025 | 6,563 | 991 | 0.1510 |
| SNPP | 2023 | 11,706 | 1,205 | 0.1029 |
| SNPP | 2024 | 9,173 | 1,242 | 0.1354 |
| SNPP | 2025 | 7,035 | 1,032 | 0.1467 |

## 7. Single sensors, 3-sensor union, and Inter-sensor Index Spread

Each single-sensor index uses that sensor's own usable days and own baseline. The Inter-sensor Index Spread is the range (max - min) of the single-sensor indices with kappa >= 0.5. It is a **descriptive sensitivity to which VIIRS sensor is used. It is not a confidence interval, standard error, or uncertainty estimate**, and it mixes sensor differences with different day sets.

| series_id | 2023 | 2024 | 2025 |
| --- | --- | --- | --- |
| NOAA20_core_all | 126.3 | 97.7 | 76.0 |
| NOAA21_core_all | 129.0 | 87.1 | 73.8 |
| SNPP_core_all | 124.2 | 100.5 | 73.4 |
| V3_core_all | 125.0 | 92.4 | 70.7 |
| headline_N20_SNPP_core_all | 126.0 | 98.7 | 73.5 |

| period | FAI_NOAA20 | FAI_NOAA21 | FAI_SNPP | n_sensors_in_spread | inter_sensor_index_spread |
| --- | --- | --- | --- | --- | --- |
| 2023 | 126.3 | 129.0 | 124.2 | 3 | 4.7 |
| 2024 | 97.7 | 87.1 | 100.5 | 3 | 13.4 |
| 2025 | 76.0 | 73.8 | 73.4 | 3 | 2.6 |

Monthly spread (months with at least two eligible sensors, n = 36): median 9.1, maximum 27.6 index points (2024-02).

## 8. 1-degree geographic blocks (not governorates)

Blocks with any headline cell-days on the matched dates: 81; eligible (at least 100 baseline cell-days under the headline definition): **39**. Eligible blocks hold 96.7% of baseline cell-days. The earlier count of 45 of 83 in the proposal came from the all-days 3-sensor table; this count is recomputed on the matched-date headline totals.

**Presentation limits.** The block index is *not locally coverage-normalised* (`coverage_basis = national_calendar_proxy`, `locally_coverage_normalized = False`): a block's rate is its mean cell-days over NATIONAL usable days, so missing local coverage can only bias it downward by an unknown amount. Each block is relative to its own 2023-2025 reference, so **values are not comparable between blocks and blocks are not ranked by FAI**. The table below is ordered by block id only.

| block_id | FAI_2023 | FAI_2024 | FAI_2025 | mean_yearly_share_of_national_cell_days |
| --- | --- | --- | --- | --- |
| B22N_28E | 95.3 | 125.2 | 85.5 | 0.020 |
| B22N_31E | 93.9 | 126.9 | 79.3 | 0.008 |
| B24N_32E | 89.9 | 110.4 | 101.2 | 0.022 |
| B24N_33E | 98.8 | 123.6 | 66.5 | 0.019 |
| B25N_28E | 102.2 | 116.4 | 73.9 | 0.003 |
| B25N_30E | 119.3 | 66.9 | 108.6 | 0.004 |
| B25N_32E | 102.5 | 105.0 | 82.0 | 0.038 |
| B26N_27E | 113.4 | 88.2 | 98.1 | 0.005 |
| B26N_31E | 163.7 | 84.2 | 54.0 | 0.024 |
| B26N_32E | 100.7 | 102.3 | 86.2 | 0.028 |
| B27N_27E | 163.8 | 61.1 | 86.1 | 0.003 |
| B27N_30E | 130.4 | 99.6 | 70.1 | 0.026 |
| B27N_31E | 134.0 | 110.0 | 50.2 | 0.011 |
| B27N_33E | 137.9 | 70.3 | 86.7 | 0.007 |
| B28N_30E | 90.6 | 106.7 | 97.9 | 0.026 |
| B28N_32E | 68.0 | 68.9 | 156.9 | 0.006 |
| B28N_33E | 171.5 | 47.8 | 83.8 | 0.016 |
| B28N_34E | 117.7 | 69.8 | 110.2 | 0.004 |
| B29N_27E | 118.9 | 163.9 | 17.0 | 0.022 |
| B29N_28E | 91.0 | 67.8 | 144.9 | 0.047 |
| B29N_30E | 163.5 | 72.4 | 63.7 | 0.017 |
| B29N_31E | 97.1 | 101.7 | 99.0 | 0.040 |
| B29N_32E | 138.8 | 88.7 | 72.8 | 0.017 |
| B29N_33E | 26.5 | 156.9 | 123.4 | 0.005 |
| B30N_25E | 154.5 | 12.3 | 130.4 | 0.008 |
| B30N_26E | 141.6 | 73.9 | 85.7 | 0.021 |
| B30N_27E | 120.8 | 116.6 | 60.7 | 0.057 |
| B30N_28E | 200.4 | 78.9 | 18.8 | 0.015 |
| B30N_29E | 137.1 | 81.6 | 79.8 | 0.041 |
| B30N_30E | 118.4 | 100.0 | 82.3 | 0.068 |
| B30N_31E | 134.6 | 100.0 | 61.6 | 0.166 |
| B30N_32E | 113.9 | 112.5 | 70.3 | 0.023 |
| B30N_33E | 91.1 | 103.1 | 103.8 | 0.003 |
| B31N_26E | 157.0 | 62.1 | 66.5 | 0.003 |
| B31N_27E | 69.2 | 167.5 | 68.4 | 0.007 |
| B31N_29E | 115.1 | 105.6 | 80.8 | 0.020 |
| B31N_30E | 170.1 | 81.4 | 45.5 | 0.022 |
| B31N_31E | 159.2 | 97.4 | 41.9 | 0.083 |
| B31N_32E | 117.1 | 106.7 | 68.1 | 0.009 |

Seasonal block values are in `block_fai.csv` (period_type = season). The share column says where detected activity concentrated; it is not a share of fires or burned area.

## 9. Cells (not indexed)

3,352 cells have at least one headline cell-day on usable days. Active-day frequency (active usable days / national usable days; not a probability) has median 0.0037, 90th percentile 0.0225, 99th percentile 0.0861. Per-cell values are in `cell_active_day_frequency.csv`.

## 10. Diagnostics (not part of the index)

Day/night split on the headline matched dates (a cell seen in both overpasses counts in both columns):

| year | n_matched_days | mean_cells_with_day_detection | mean_cells_with_night_detection | mean_cell_days_union | mean_cells_with_day_detection_pct_change_vs_first_year | mean_cells_with_night_detection_pct_change_vs_first_year |
| --- | --- | --- | --- | --- | --- | --- |
| 2023 | 337 | 22.66 | 19.63 | 41.36 | 0.00 | 0.00 |
| 2024 | 337 | 17.29 | 15.86 | 32.23 | -23.71 | -19.20 |
| 2025 | 337 | 10.61 | 13.67 | 23.90 | -53.21 | -30.36 |

Static-probe diagnostic (VIIRS static cells detected on at least half of a sensor's observed days). Probe misses mix cloud, intermittent flares and true coverage and cannot be separated, so this is never used to correct the index:

| sensor_key | observed_days | n_static_cells_detected | n_probes_ge_50pct_days | n_probes_ge_80pct_days | mean_share_probes_seen_per_day | days_share_below_0.5 |
| --- | --- | --- | --- | --- | --- | --- |
| NOAA20 | 1,089 | 132 | 23 | 8 | 0.719 | 123 |
| SNPP | 1,075 | 129 | 20 | 7 | 0.726 | 95 |

## 11. Validation

Pipeline: 254,175 Phase 3 rows, 5.25 s. Consistency checks passed: **53 of 53** (`phase5_checks.csv`).

| check | passed | detail |
| --- | --- | --- |
| only VIIRS sensors in the index detections | True | ['NOAA20', 'NOAA21', 'SNPP'] |
| index detections == VIIRS type-0 rows (no static, no MODIS) | True | 81232 vs 81232 |
| headline sensor set is NOAA20 + SNPP | True | NA |
| coverage calendar: NOAA21 not observed before 2023-03-01 | True | NA |
| frozen B equals catalog B [N20_SNPP_core_excl_low] | True | B=29.974283 |
| frozen B equals catalog B [N20_SNPP_excl3x3_all] | True | B=21.176063 |
| frozen B equals catalog B [NOAA20_core_all] | True | B=19.285847 |
| frozen B equals catalog B [NOAA21_core_all] | True | B=17.708061 |
| frozen B equals catalog B [SNPP_core_all] | True | B=18.043605 |
| frozen B equals catalog B [V3_core_all] | True | B=45.537634 |
| frozen B equals catalog B [headline_N20_SNPP_core_all] | True | B=32.497527 |
| mean of annual FAI on matched dates == 100 [N20_SNPP_core_excl_low] | True | NA |
| mean of annual FAI on matched dates == 100 [N20_SNPP_excl3x3_all] | True | NA |
| mean of annual FAI on matched dates == 100 [NOAA20_core_all] | True | NA |
| mean of annual FAI on matched dates == 100 [NOAA21_core_all] | True | NA |
| mean of annual FAI on matched dates == 100 [SNPP_core_all] | True | NA |
| mean of annual FAI on matched dates == 100 [V3_core_all] | True | NA |
| mean of annual FAI on matched dates == 100 [headline_N20_SNPP_core_all] | True | NA |
| headline |M| == 337 matched dates | True | 337 |
| headline matched dates contain no 29 February | True | NA |
| headline B == 32,855 / 1,011 | True | 32.4975 |
| headline annual FAI on matched dates 127.287 / 99.181 / 73.532 (methodology section 7.1) | True | 2023:127.287, 2024:99.181, 2025:73.532 |
| excl_low totals 13,002 / 9,899 / 7,403, B = 30,304/1,011 (methodology section 7.1) | True | NA |
| matched totals equal Phase 4 table [headline_N20_SNPP_core_all vs VIIRS_NOAA20_SNPP_union] | True | NA |
| matched totals equal Phase 4 table [V3_core_all vs VIIRS_3sensor_union] | True | NA |
| matched totals equal Phase 4 table [NOAA20_core_all vs NOAA20] | True | NA |
| matched totals equal Phase 4 table [NOAA21_core_all vs NOAA21] | True | NA |
| matched totals equal Phase 4 table [SNPP_core_all vs SNPP] | True | NA |
| V3 excl3x3 (frozen mask) totals equal Phase 4 any-year static exclusion | True | mine=[11128.0, 8515.0, 6384.0] |
| block cell-days sum to national cell-days on every usable day | True | NA |
| no daily FAI on unusable days (never zero-filled) | True | NA |
| fai_monthly: no FAI where quality is insufficient or not_expected | True | NA |
| fai_monthly: every published row has kappa >= 0.5 | True | NA |
| fai_seasonal: no FAI where quality is insufficient or not_expected | True | NA |
| fai_seasonal: every published row has kappa >= 0.5 | True | NA |
| fai_yearly: no FAI where quality is insufficient or not_expected | True | NA |
| fai_yearly: every published row has kappa >= 0.5 | True | NA |
| R(P) == (1 - sigma_P) / (1 - sigma_B) | True | 50 periods |
| block outputs flagged national_calendar_proxy and not locally normalised | True | NA |
| block outputs carry no rank column | True | NA |
| block outputs only for blocks with >= 100 baseline cell-days | True | NA |
| spread NA when fewer than two sensors | True | NA |
| spread table has no interval-style columns (ci, lower/upper bound) | True | NA |
| fai_daily: coverage_basis column present | True | NA |
| fai_daily: baseline_version column present | True | NA |
| fai_monthly: coverage_basis column present | True | NA |
| fai_monthly: baseline_version column present | True | NA |
| fai_seasonal: coverage_basis column present | True | NA |
| fai_seasonal: baseline_version column present | True | NA |
| fai_yearly: coverage_basis column present | True | NA |
| fai_yearly: baseline_version column present | True | NA |
| baseline matched dates only from baseline years | True | NA |
| Phase 0-4 files unchanged by Phase 5 run (sha256 of data, code, reports) | True | 69 files compared; changed: none |

## 12. Limitations

1. Detections are thermal anomalies. Type 0 are vegetation-fire candidates, not confirmed fires, burned area, or intensity.
2. Usable days are a record-presence proxy. They do not verify that all of Egypt, or any block or cell, was viewed or cloud-free.
3. The block index is not locally coverage-normalised and is biased downward by unknown local gaps. No stronger correction is supported by the data.
4. Cloud, swath edges, and detection thresholds hide some activity. Detected activity is not actual activity.
5. The reference is the 2023-2025 average, not a long-term climatology. FAI = 100 is not "normal".
6. Three years cannot separate trend from year-to-year variability. Changes are descriptive and not causal.
7. Series are self-referenced. Levels of different series, and of different blocks, are not comparable; only shape and direction are.
8. The 0.05 degree grid (about 5 km) is coarser than VIIRS pixels. Cell area varies about 8 % with latitude and no boundary mask exists.
9. Static exclusion is a sensitivity analysis that may remove genuine candidates and may miss unflagged static heat.
10. VIIRS (l/n/h) and MODIS (numeric) confidence are never merged; MODIS is outside the index.
11. Inter-sensor Index Spread is a range of three variants, not an uncertainty interval.
12. Quality thresholds (kappa 0.8 and 0.5, 15 usable days per month, incomplete-season rule, 100 block cell-days) are project choices.
13. The 1-degree blocks are analytical bins, not governorates.
14. Source gaps (S-NPP 2024, NOAA-21 before 2023-03-01) are preserved and reduce usable days.
15. Changed upstream data (for example NASA reprocessing) require a new baseline version.

Not implemented (optional in the approved methodology): the day-resampling interval (its autocorrelation and stationarity assumptions were not demonstrated, so it is off), same-cell-only and persistent-cell exclusion variants, and any swath or cloud-mask coverage correction.

