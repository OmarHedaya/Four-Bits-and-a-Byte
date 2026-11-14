import rawBundle from './generated/firescopeBundle.json';
import type { GridCellFeatureSchema } from '../contracts/schemas';
import type { z } from 'zod';

export interface FireScopeBaseline {
  baseline_version: string;
  created_utc: string;
  grid_size_deg: number;
  headline_series: string;
  headline_B: number;
  n_matched_days: number;
  input_fingerprint: {
    harmonized_baseline_years_rows: number;
    coverage_baseline_years_rows: number;
  };
  sensor_baselines: Record<string, number>;
}

export interface FireScopeSensorProfile {
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
}

export interface FireScopeYearlySummary {
  series: string;
  year: number;
  calendar_days: number;
  used_days: number;
  cell_days_all_available_days: number;
  cell_days_on_used_days: number;
  detections_on_used_days: number;
  median_cell_days_per_used_day: number | null;
  p95_cell_days_per_used_day: number | null;
  max_cell_days_per_used_day: number | null;
  unused_days: number;
  mean_cell_days_per_used_day: number | null;
  mean_detections_per_used_day: number | null;
  rates_valid: boolean;
  n_static_detections: number;
  n_water_detections: number;
  n_veg_detections_all_days: number;
  used_day_share: number;
}

export interface FireScopeFaiYearly {
  series_id: string;
  role: string;
  period_type: string;
  period: number;
  year: number;
  usable_days: number;
  unusable_days: number;
  cell_days_on_usable_days: number;
  r_cell_days_per_usable_day: number;
  baseline_B: number;
  FAI: number;
  kappa: number;
  quality_label: string;
}

export interface FireScopeFaiMonthly {
  series_id: string;
  role: string;
  period: string;
  year: number;
  month: number;
  usable_days: number;
  unusable_days: number;
  cell_days_on_usable_days: number;
  r_cell_days_per_usable_day: number;
  baseline_B: number;
  FAI: number | null;
  FAI_sa: number | null;
  kappa: number;
  quality_label: string;
}

export interface FireScopeDailyFaiEntry {
  fai_daily: number | null;
  fai_excl3x3_daily: number | null;
  usable_day: boolean;
  static_detections: number;
  static_cells: number;
  observed_MODIS?: boolean;
  observed_SNPP?: boolean;
  observed_NOAA20?: boolean;
  observed_NOAA21?: boolean;
  veg_detections_MODIS?: number;
  veg_detections_SNPP?: number;
  veg_detections_NOAA20?: number;
  veg_detections_NOAA21?: number;
  static_detections_MODIS?: number;
  static_detections_SNPP?: number;
  static_detections_NOAA20?: number;
  static_detections_NOAA21?: number;
}

export interface FireScopeSensorTelemetryRecord {
  record_id: string;
  acquisition_date: string;
  acquisition_time_utc: string;
  latitude: number;
  longitude: number;
  grid_cell_id: string;
  region_id: string;
  sensor_key: 'MODIS' | 'SNPP' | 'NOAA20' | 'NOAA21' | string;
  sensor_family: 'MODIS' | 'VIIRS' | string;
  instrument_name: 'MODIS' | 'VIIRS' | string;
  satellite_name: 'Terra' | 'Aqua' | 'Suomi-NPP' | 'NOAA-20' | 'NOAA-21' | string;
  nominal_resolution_m: number;
  confidence_numeric: number | null;
  confidence_class: 'l' | 'n' | 'h' | string | null;
  brightness_k: number;
  brightness_t31_k: number;
  frp_mw: number;
  daynight: 'D' | 'N' | string;
  hotspot_type: number;
  hotspot_type_label: string;
  source_file: string;
}

export interface FireScopeVariantSummary {
  series_id: string;
  role: string;
  sensors: string;
  mask: string;
  confidence_rule: string;
  baseline_B: number;
  matched_days: number;
  fai_2023: number;
  fai_2024: number;
  fai_2025: number;
  decline_2023_to_2025_pct: number;
  matched_decline_2023_to_2025_pct: number;
}

export interface FireScopeStaticProximity {
  proximity_band: string;
  n_cells: number;
  veg_cell_days: number;
  mean_days_per_cell: number;
  median_days_per_cell: number;
  n_persistent_cells: number;
  share_of_cells: number;
  share_of_cell_days: number;
}

export interface FireScopeStaticExposure {
  period_type: string;
  period: number;
  year: number;
  usable_days: number;
  expected_days: number;
  kappa: number;
  quality_label: string;
  cell_days_on_usable_days_core: number;
  FAI_core: number;
  cell_days_on_usable_days_excl3x3: number;
  FAI_excl3x3: number;
  sigma_P: number;
  sigma_B: number;
  R_P: number;
}

export interface FireScopeConfidenceRow {
  sensor_key: string;
  confidence_tier: string;
  n_type0: number;
  share_type0: number;
  n_type2_static: number;
  median_frp_mw: number;
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

export interface FireScopePhase2ArchiveRow {
  sensor_key: string;
  year: number;
  rows_in: number;
  rows_out: number;
  unique_dates: number;
  absent_days: number;
  coverage_status: string;
  output_file: string;
  output_sha256: string;
  source_archive: string;
}

export interface FireScopeTopBlock {
  block_id_1deg: string;
  label: string;
  region_id: string;
  block_lat_min: number;
  block_lon_min: number;
  n_veg_cells: number;
  veg_cell_days_total: number;
  veg_cell_days_2023: number;
  veg_cell_days_2024: number;
  veg_cell_days_2025: number;
  n_static_cells_any_sensor: number;
  static_detections_all_sensors: number;
  share_of_veg_cell_days: number;
  eligible: boolean;
  baseline_B_block: number;
  fai_2023: number | null;
  fai_2024: number | null;
  fai_2025: number | null;
  mean_fai: number | null;
}

export interface FireScopeCheckItem {
  check: string;
  passed: boolean;
  detail: string | number | null;
}

export interface FireScopeVisualizationItem {
  id: string;
  kind: 'png' | 'html' | string;
  title: string;
  communicates: string;
  limitations: string;
  sources: string[];
  category: string;
  url: string;
  filename: string;
}

export interface FireScopeSensorComparisonRow {
  comparison_type: string;
  sensor_a: string;
  sensor_b: string;
  scope: string;
  n_common_days: number;
  pearson_daily_detections: number;
  pearson_daily_cells: number;
  n_cell_days_a: number;
  n_cell_days_b: number;
  n_cell_days_both: number;
  jaccard: number;
  share_a_also_in_b: number;
  share_b_also_in_a: number;
  share_a_with_b_in_3x3: number;
}

export interface FireScopeBundle {
  baseline: FireScopeBaseline;
  exportManifest: {
    source: string;
    veg_detections_exported: number;
    date_range: [string, string];
    regions: string[];
    file_bytes: Record<string, number>;
  };
  sensorProfile: FireScopeSensorProfile[];
  yearlySummary: FireScopeYearlySummary[];
  faiYearly: FireScopeFaiYearly[];
  faiMonthly: FireScopeFaiMonthly[];
  faiDailyByDate: Record<string, FireScopeDailyFaiEntry>;
  sensorTelemetrySample?: FireScopeSensorTelemetryRecord[];
  variantSummary: FireScopeVariantSummary[];
  staticProximity: FireScopeStaticProximity[];
  staticExposure: FireScopeStaticExposure[];
  staticCellFeatures: Array<z.infer<typeof GridCellFeatureSchema>>;
  confidenceSummary: FireScopeConfidenceRow[];
  daynightDiagnostic: FireScopeDayNightRow[];
  sensorComparison: FireScopeSensorComparisonRow[];
  phase2Validation: FireScopePhase2ArchiveRow[];
  topBlocks: FireScopeTopBlock[];
  checks: {
    phase4: FireScopeCheckItem[];
    phase5: FireScopeCheckItem[];
  };
  visualizations: FireScopeVisualizationItem[];
  reports: {
    phase0: string;
    phase1: string;
    phase2: string;
    phase3: string;
    phase4: string;
    phase5: string;
    phase6: string;
    data_dictionary: string;
  };
}

export const FIRESCOPE_BUNDLE: FireScopeBundle = rawBundle as unknown as FireScopeBundle;
