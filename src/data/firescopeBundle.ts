import rawBundle from './generated/firescopeBundle.json';

export interface FireScopeSeriesCatalogItem {
  series_id: string;
  role: string;
  sensors: string;
  mask: string;
  confidence_rule: string;
  n_matched_days: number;
  baseline_total_cell_days: number;
  baseline_B: number;
  matched_total_2023: number;
  matched_total_2024: number;
  matched_total_2025: number;
  baseline_version: string;
  coverage_basis: string;
}

export interface FireScopeFaiRow {
  series_id: string;
  role: string;
  period_type: string;
  period: string | number;
  year: number;
  month: number | null;
  season: string | null;
  period_start: string;
  period_end: string;
  calendar_days_in_window: number;
  expected_days: number;
  usable_days: number;
  unusable_days: number;
  cell_days_on_usable_days: number;
  r_cell_days_per_usable_day: number;
  baseline_B: number;
  FAI: number | null;
  FAI_sa: number | null;
  kappa: number;
  quality_label: string;
  na_reason: string | null;
  period_complete: boolean;
  baseline_version: string;
  coverage_basis: string;
}

export interface FireScopeStaticExposureRow {
  period_type: string;
  period: string | number;
  year: number;
  usable_days: number;
  expected_days: number;
  kappa: number;
  quality_label: string;
  cell_days_on_usable_days_core: number;
  FAI_core: number | null;
  cell_days_on_usable_days_excl3x3: number;
  FAI_excl3x3: number | null;
  sigma_P: number;
  sigma_B: number;
  R_P: number | null;
}

export interface FireScopeConfidenceRow {
  period_type: string;
  period: string | number;
  year: number;
  quality_label: string;
  cell_days_on_usable_days_all: number;
  FAI_all: number | null;
  cell_days_on_usable_days_excl_low: number;
  FAI_excl_low: number | null;
  FAI_difference_excl_low_minus_all: number | null;
  low_confidence_only_cell_day_share: number;
}

export interface FireScopeInterSensorSpreadRow {
  period_type: string;
  period: string | number;
  year: number;
  FAI_NOAA20: number | null;
  FAI_NOAA21: number | null;
  FAI_SNPP: number | null;
  n_sensors_in_spread: number;
  inter_sensor_index_spread: number | null;
  spread_note: string;
}

export interface FireScopeSensorProfileRow {
  sensor_key: string;
  sensor_family: string;
  nominal_resolution_m: number;
  n_rows: number;
  n_type0_vegetation_candidates: number;
  n_type2_static: number;
  n_type3_water: number;
  static_share_of_rows: number;
  observed_days: number;
  unobserved_days: number;
  veg_active_cells: number;
  veg_cell_days: number;
  mean_veg_detections_per_observed_day: number | null;
  median_veg_frp_mw: number;
  p95_veg_frp_mw: number;
  veg_night_share: number;
  mean_pixel_scan_km: number;
  mean_pixel_track_km: number;
  veg_mean_confidence_numeric: number | null;
  veg_confidence_l_share: number | null;
  veg_confidence_n_share: number | null;
  veg_confidence_h_share: number | null;
}

export interface FireScopeHourlyProfileRow {
  sensor_key: string;
  hotspot_group: string;
  utc_offset_hours: number;
  local_hour_cairo: number;
  n_detections: number;
  median_frp_mw: number;
  share_daytime_flag: number;
  share_of_group: number;
}

export interface FireScopeDayNightRow {
  year: number;
  n_matched_days: number;
  mean_cells_with_day_detection: number;
  mean_cells_with_night_detection: number;
  mean_cell_days_union: number;
  mean_cells_with_day_detection_pct_change_vs_first_year: number;
  mean_cells_with_night_detection_pct_change_vs_first_year: number;
}

export interface FireScopeHotspotClusterRow {
  cluster_id: string;
  cluster_scope: string;
  percentile: number;
  threshold_days: number;
  n_cells: number;
  total_cell_days: number;
  share_of_scope_cell_days: number;
  centroid_lat: number;
  centroid_lon: number;
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
  peak_cell_id: string;
  peak_cell_days: number;
  n_cells_with_static_same_cell: number;
  n_cells_static_in_3x3: number;
  block_ids: string;
  cell_days_2023: number;
  cell_days_2024: number;
  cell_days_2025: number;
  static_proximity_flag: string;
}

export interface FireScopeRegionalBlockRow {
  block_id_1deg: string;
  block_lat_min: number;
  block_lon_min: number;
  n_active_cells: number;
  veg_cell_days_2023: number;
  veg_cell_days_2024: number;
  veg_cell_days_2025: number;
  veg_cell_days_total: number;
  share_of_all_cell_days: number;
  n_cells_static_same_cell: number;
  n_cells_static_in_3x3: number;
  share_cells_static_in_3x3: number;
  pct_change_2023_to_2025: number | null;
  rank_by_total_cell_days: number;
}

export interface FireScopeBlockFaiRow {
  block_id: string;
  block_lat_min: number;
  block_lon_min: number;
  period_type: string;
  period: string | number;
  year: number;
  usable_days: number;
  cell_days_on_usable_days: number;
  r_block_cell_days_per_national_usable_day: number;
  baseline_B_block: number;
  FAI_block: number | null;
  block_share_of_national_cell_days: number;
  kappa_national: number;
  quality_label: string;
}

export interface FireScopeCheckRow {
  check: string;
  passed: boolean;
  detail: string | number | null;
}

export interface FireScopeVizEntry {
  figure_id: string;
  category: string;
  path: string;
  web_path: string;
  format: string;
  title: string;
  source_tables: string[];
  bytes: number;
}

export interface FireScopeReportEntry {
  id: string;
  title: string;
  file: string;
  content: string;
}

export interface FireScopeBundle {
  project: {
    name: string;
    study_area: string;
    time_span: string;
    total_harmonized_rows: number;
    type0_vegetation_rows: number;
    type2_static_rows: number;
    type3_water_rows: number;
    unique_cell_days_all_sensors: number;
    unique_viirs_veg_cell_days: number;
    active_veg_cells_005deg: number;
    active_static_cells_005deg: number;
    eligible_1deg_blocks: number;
    total_1deg_blocks: number;
    multi_year_hotspot_clusters: number;
  };
  baseline_v1: {
    baseline_version: string;
    coverage_basis: string;
    headline_series_id: string;
    matched_day_rule: string;
    static_mask_definition: string;
    static_3x3_cell_count: number;
    eligible_block_count: number;
  };
  series_catalog: FireScopeSeriesCatalogItem[];
  fai_yearly: FireScopeFaiRow[];
  fai_seasonal: FireScopeFaiRow[];
  fai_monthly: FireScopeFaiRow[];
  static_exposure: FireScopeStaticExposureRow[];
  static_proximity_summary: Array<{
    proximity_band: string;
    n_cells: number;
    veg_cell_days: number;
    mean_days_per_cell: number;
    median_days_per_cell: number;
    n_persistent_cells: number;
    share_of_cells: number;
    share_of_cell_days: number;
  }>;
  confidence_sensitivity: FireScopeConfidenceRow[];
  inter_sensor_spread: FireScopeInterSensorSpreadRow[];
  sensor_profile: FireScopeSensorProfileRow[];
  modis_vs_viirs_agreement: Array<Record<string, string | number | null>>;
  sensor_pair_cell_agreement: Array<Record<string, string | number | null>>;
  sensor_pair_daily_correlation: Array<Record<string, string | number | null>>;
  coverage_analysis: Array<Record<string, string | number | null>>;
  coverage_gap_runs: Array<{
    sensor_key: string;
    start_date: string;
    end_date: string;
    n_days: number;
    coverage_status: string;
  }>;
  hourly_profile: FireScopeHourlyProfileRow[];
  daynight_diagnostic: FireScopeDayNightRow[];
  hotspot_clusters: FireScopeHotspotClusterRow[];
  regional_blocks_1deg: FireScopeRegionalBlockRow[];
  block_fai_yearly: FireScopeBlockFaiRow[];
  consistency_checks: FireScopeCheckRow[];
  phase5_checks: FireScopeCheckRow[];
  visualizations: FireScopeVizEntry[];
  reports: FireScopeReportEntry[];
}

export const FIRESCOPE_BUNDLE: FireScopeBundle = rawBundle as unknown as FireScopeBundle;
