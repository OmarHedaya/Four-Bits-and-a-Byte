import { z } from 'zod';

/**
 * ISO YYYY-MM-DD date string validator
 */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date format');

/**
 * ISO YYYY-MM month string or integer month (1..12)
 */
export const MonthSchema = z.union([
  z.number().int().min(1).max(12),
  z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM format'),
]);

/**
 * 1. DAILY_SUMMARY
 * Fields: date, region_id, count_modis, count_viirs, count_merged, total_frp, high_conf_share, anomaly_z
 */
export const DailySummaryRecordSchema = z.object({
  date: IsoDateSchema,
  region_id: z.string().min(1),
  count_modis: z.number().int().nonnegative(),
  count_viirs: z.number().int().nonnegative(),
  count_merged: z.number().int().nonnegative(),
  total_frp: z.number().nonnegative(),
  high_conf_share: z.number().min(0).max(1),
  anomaly_z: z.number(),
});

export const DailySummaryListSchema = z.array(DailySummaryRecordSchema);
export type DailySummaryRecord = z.infer<typeof DailySummaryRecordSchema>;

/**
 * 2. GRID_CELLS
 * Fields: cell_id, lat, lon, month, frp_sum, count (as flat records or GeoJSON FeatureCollection)
 */
export const GridCellPropertiesSchema = z.object({
  cell_id: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  month: MonthSchema,
  frp_sum: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
  region_id: z.string().optional(),
});

export type GridCellRecord = z.infer<typeof GridCellPropertiesSchema>;

export const GridCellFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: z.object({
    type: z.enum(['Polygon', 'Point']),
    coordinates: z.unknown(),
  }),
  properties: GridCellPropertiesSchema,
});

export const GridCellsGeoJsonSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(GridCellFeatureSchema),
});

export type GridCellsGeoJson = z.infer<typeof GridCellsGeoJsonSchema>;

/**
 * 3. RECENT_POINTS
 * Fields: lat, lon, date, sensor, frp, confidence (last N days only)
 */
export const SensorTypeSchema = z.enum(['MODIS', 'VIIRS']);
export const ConfidenceLevelSchema = z.union([
  z.enum(['low', 'nominal', 'high']),
  z.number().min(0).max(100),
]);

export const RecentPointRecordSchema = z.object({
  id: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  date: IsoDateSchema,
  sensor: SensorTypeSchema,
  frp: z.number().nonnegative(),
  confidence: ConfidenceLevelSchema,
  region_id: z.string().optional(),
});

export const RecentPointsListSchema = z.array(RecentPointRecordSchema);
export type RecentPointRecord = z.infer<typeof RecentPointRecordSchema>;

/**
 * 4. SEASONALITY
 * Fields: year, month, frp_sum, count (plus optional region_id for regional slices)
 */
export const SeasonalityRecordSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  frp_sum: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
  count_modis: z.number().int().nonnegative().optional(),
  count_viirs: z.number().int().nonnegative().optional(),
  region_id: z.string().optional(),
});

export const SeasonalityListSchema = z.array(SeasonalityRecordSchema);
export type SeasonalityRecord = z.infer<typeof SeasonalityRecordSchema>;

/**
 * 5. ANOMALIES
 * Fields: start_date, end_date, region_id, score, reason
 */
export const AnomalyRecordSchema = z.object({
  start_date: IsoDateSchema,
  end_date: IsoDateSchema,
  region_id: z.string().min(1),
  score: z.number(),
  reason: z.string().min(1),
});

export const AnomaliesListSchema = z.array(AnomalyRecordSchema);
export type AnomalyRecord = z.infer<typeof AnomalyRecordSchema>;

/**
 * 6. RISK_PERIODS
 * Fields: window, region_id, risk_score, drivers
 */
export const RiskPeriodRecordSchema = z.object({
  window: z.string().min(1),
  region_id: z.string().min(1),
  risk_score: z.number().min(0).max(100),
  drivers: z.union([z.array(z.string()), z.string()]),
  start_month: z.number().int().min(1).max(12).optional(),
  end_month: z.number().int().min(1).max(12).optional(),
});

export const RiskPeriodsListSchema = z.array(RiskPeriodRecordSchema);
export type RiskPeriodRecord = z.infer<typeof RiskPeriodRecordSchema>;

/**
 * 7. VALIDATION
 * Fields: monthly pairs (modis, viirs), correlation, bias, scaling_factor
 */
export const ValidationMonthlyPairSchema = z.object({
  month: z.string().min(1),
  modis: z.number().nonnegative(),
  viirs: z.number().nonnegative(),
  harmonized: z.number().nonnegative().optional(),
  frp_modis: z.number().nonnegative().optional(),
  frp_viirs: z.number().nonnegative().optional(),
  region_id: z.string().optional(),
});

export const ValidationDataSchema = z.object({
  monthly_pairs: z.array(ValidationMonthlyPairSchema),
  correlation: z.number().min(-1).max(1),
  bias: z.number(),
  scaling_factor: z.number().positive(),
  rmse: z.number().nonnegative().optional(),
  sample_size: z.number().int().positive().optional(),
});

export type ValidationMonthlyPair = z.infer<typeof ValidationMonthlyPairSchema>;
export type ValidationData = z.infer<typeof ValidationDataSchema>;

/**
 * 8. REGION_META
 * Fields: region_id, name, bbox, date_min, date_max
 */
export const BboxSchema = z.tuple([
  z.number().min(-180).max(180), // minLon (west)
  z.number().min(-90).max(90),   // minLat (south)
  z.number().min(-180).max(180), // maxLon (east)
  z.number().min(-90).max(90),   // maxLat (north)
]);

export const RegionMetaRecordSchema = z.object({
  region_id: z.string().min(1),
  name: z.string().min(1),
  bbox: BboxSchema,
  date_min: IsoDateSchema,
  date_max: IsoDateSchema,
  biome: z.string().optional(),
  description: z.string().optional(),
});

export const RegionMetaListSchema = z.array(RegionMetaRecordSchema);
export type RegionMetaRecord = z.infer<typeof RegionMetaRecordSchema>;

/**
 * Complete bundle schema for runtime validation of the full dataset
 */
export const HarmonizedDatasetSchema = z.object({
  dailySummary: DailySummaryListSchema,
  gridCells: GridCellsGeoJsonSchema,
  recentPoints: RecentPointsListSchema,
  seasonality: SeasonalityListSchema,
  anomalies: AnomaliesListSchema,
  riskPeriods: RiskPeriodsListSchema,
  validation: ValidationDataSchema,
  regionMeta: RegionMetaListSchema,
  isDemoData: z.boolean(),
});

export type HarmonizedDataset = z.infer<typeof HarmonizedDatasetSchema>;
