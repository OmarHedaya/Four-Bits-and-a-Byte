import { describe, expect, it } from 'vitest';
import {
  AnomalyRecordSchema,
  DailySummaryRecordSchema,
  GridCellsGeoJsonSchema,
  RecentPointRecordSchema,
  RegionMetaRecordSchema,
  RiskPeriodRecordSchema,
  SeasonalityRecordSchema,
  ValidationDataSchema,
} from '../schemas';
import { generateMockDataset } from '../../data/mockGenerator';
import { PLACEHOLDERS } from '../../config/placeholders';

describe('Data Contract Schemas & Seeded Mock Generator (F0)', () => {
  const dataset = generateMockDataset(202610);

  it('produces deterministic multi-year, multi-region daily summaries', () => {
    expect(dataset.dailySummary.length).toBeGreaterThan(7000); // 4 regions x 5 years (~7,304 rows)
    const sample = dataset.dailySummary[0];
    const parsed = DailySummaryRecordSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
    expect(sample.count_viirs).toBeGreaterThanOrEqual(sample.count_modis);
  });

  it('validates GRID_CELLS GeoJSON FeatureCollection', () => {
    const parsed = GridCellsGeoJsonSchema.safeParse(dataset.gridCells);
    expect(parsed.success).toBe(true);
    expect(dataset.gridCells.features.length).toBeGreaterThan(100);
  });

  it('validates RECENT_POINTS with sensor and confidence levels', () => {
    expect(dataset.recentPoints.length).toBeGreaterThan(100);
    const parsed = RecentPointRecordSchema.safeParse(dataset.recentPoints[0]);
    expect(parsed.success).toBe(true);
  });

  it('validates SEASONALITY, ANOMALIES, RISK_PERIODS, VALIDATION, and REGION_META', () => {
    expect(SeasonalityRecordSchema.safeParse(dataset.seasonality[0]).success).toBe(true);
    expect(AnomalyRecordSchema.safeParse(dataset.anomalies[0]).success).toBe(true);
    expect(RiskPeriodRecordSchema.safeParse(dataset.riskPeriods[0]).success).toBe(true);
    expect(ValidationDataSchema.safeParse(dataset.validation).success).toBe(true);
    expect(RegionMetaRecordSchema.safeParse(dataset.regionMeta[0]).success).toBe(true);
  });

  it('rejects malformed daily summary records', () => {
    const invalid = DailySummaryRecordSchema.safeParse({
      date: '13-11-2026', // invalid format
      region_id: '',
      count_modis: -5,
      count_viirs: 10,
      count_merged: 8,
      total_frp: 100,
      high_conf_share: 1.5, // > 1
      anomaly_z: 0,
    });
    expect(invalid.success).toBe(false);
  });

  it('exposes all required placeholders from config/placeholders.ts', () => {
    expect(PLACEHOLDERS.DAILY_SUMMARY).toContain('daily_summary.json');
    expect(PLACEHOLDERS.GRID_CELLS).toContain('grid_cells.geojson');
    expect(PLACEHOLDERS.RECENT_POINTS).toContain('recent_points.json');
    expect(PLACEHOLDERS.SEASONALITY).toContain('seasonality.json');
    expect(PLACEHOLDERS.ANOMALIES).toContain('anomalies.json');
    expect(PLACEHOLDERS.RISK_PERIODS).toContain('risk_periods.json');
    expect(PLACEHOLDERS.VALIDATION).toContain('validation.json');
    expect(PLACEHOLDERS.REGION_META).toContain('region_meta.json');
    expect(PLACEHOLDERS.CONF_MAPPING_TEXT.tiers.length).toBe(3);
    expect(PLACEHOLDERS.PROJECT_NAME.length).toBeGreaterThan(0);
    expect(PLACEHOLDERS.TEAM_NAMES.length).toBeGreaterThan(0);
  });
});
