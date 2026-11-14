# Harmonized Data Dictionary (`data/harmonized/firescope_harmonized.csv`)

One row per satellite detection. Times are UTC (Egypt is UTC+2 or UTC+3).

| Column | Meaning |
|---|---|
| record_id | Stable id (FS0000001...) after sorting by date, time, sensor, position |
| acquisition_datetime_utc, acquisition_date, acquisition_time_utc | Acquisition instant |
| latitude, longitude | Pixel center, degrees |
| grid_cell_id, grid_cell_lat, grid_cell_lon | 0.05 degree cell id and cell center |
| sensor_key | MODIS, SNPP, NOAA20, NOAA21 |
| sensor_family | MODIS or VIIRS |
| instrument_name | MODIS or VIIRS (S-NPP raw value "SNPP" is normalized to VIIRS) |
| satellite_code, satellite_name | FIRMS code and readable name |
| product_id, product_version | FIRMS product and version |
| nominal_resolution_m | 1000 (MODIS) or 375 (VIIRS) at nadir |
| scan_km, track_km | Actual pixel size for the record |
| confidence_numeric | MODIS only, 0-100 |
| confidence_class | VIIRS only, l / n / h |
| brightness_k, brightness_t31_k | Brightness temperatures in Kelvin. Bands differ between MODIS and VIIRS |
| frp_mw | Fire radiative power, MW. Not burned area |
| daynight | D or N |
| hotspot_type, hotspot_type_label | 0 vegetation fire, 1 volcano, 2 static land source, 3 water |
| is_static_source, is_vegetation_fire_candidate, is_water_detection | Flags from hotspot_type |
| is_exact_duplicate_within_sensor | Same sensor, satellite, time, and position as an earlier row. Flagged only |
| source_file, source_archive, input_origin | Provenance |

Companion files: `cell_day_presence.csv` (cross-sensor presence per cell per day),
`coverage_calendar.csv` (per sensor and day coverage status), `harmonization_inputs.csv`.


## Phase 4 tables (`data/analysis/`)

Code: `src/phase4_analysis.py`. Report: `reports/phase4_analysis_report.md` (numbers generated from these tables).

Terms used in every table:

* **Cell-day**: one 0.05 degree grid cell on one UTC date with at least one detection. Counted once, however many sensors or records contributed.
* **Vegetation-fire candidate**: hotspot type 0. A thermal detection, not a confirmed fire.
* **Static thermal source**: hotspot type 2. Analysed separately, never in candidate tables.
* **Observed day**: the coverage calendar found at least one record (any type) for that sensor and day. Rates divide by observed days only.
* **Season year**: December belongs to the winter (DJF) of the following year. `season_year_complete` flags season-years the 2023-2025 window does not fully cover.
* **Agreement / co-occurrence**: grid-cell co-occurrence on the 0.05 degree grid (`measure` column). It is not pixel-level agreement.
* **Block**: 1 degree analytical bin (`B31N_29E`). Not an administrative boundary.

Tables: sensor_day, daily_summary, series_daily, yearly_summary, monthly_summary, monthly_pooled, seasonal_summary, seasonal_pooled,
matched_day_yearly, sensitivity_matched_day_yearly, hourly_profile, spatial_cells, spatial_concentration, hotspot_clusters,
hotspot_thresholds, persistent_activity, regional_blocks_1deg, static_source_cells, static_source_yearly, static_cell_turnover,
static_proximity_summary, static_influence_metrics, sensor_profile, sensor_pair_daily_correlation, sensor_pair_cell_day_agreement,
modis_vs_viirs_agreement, sensor_comparison, coverage_analysis, coverage_gap_runs, consistency_checks.
