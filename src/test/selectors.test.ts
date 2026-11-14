import { describe, expect, it } from 'vitest';
import { generateMockDataset } from '../data/mockGenerator';
import {
  selectDayMetricValue,
  selectFilteredAnomaliesAndRisks,
  selectFilteredDailySummary,
  selectFilteredGridCells,
  selectFilteredRecentPoints,
  selectOverviewKpis,
  selectSeasonalityData,
} from '../data/selectors';

describe('Data Layer Selectors & Filter Logic (FireScope Egypt 2023–2025)', () => {
  const dataset = generateMockDataset(202610);

  it('returns daily records by date for All Egypt ("all") and Egyptian sub-regions', () => {
    const nationalRecords = selectFilteredDailySummary(dataset, {
      regionId: 'all',
      yearRange: [2023, 2025],
    });
    const deltaRecords = selectFilteredDailySummary(dataset, {
      regionId: 'nile-delta',
      yearRange: [2023, 2025],
    });

    // 3 years (2023, 2024 leap year, 2025) = 1,096 days
    expect(nationalRecords.length).toBe(1096);
    expect(deltaRecords.length).toBe(1096);
    expect(nationalRecords[0].count_merged).toBeGreaterThan(deltaRecords[0].count_merged);
  });

  it('filters daily records by single year range', () => {
    const only2023 = selectFilteredDailySummary(dataset, {
      regionId: 'nile-delta',
      yearRange: [2023, 2023],
    });
    expect(only2023.length).toBe(365);
    expect(only2023.every((r) => r.date.startsWith('2023-'))).toBe(true);
  });

  it('computes accurate Overview KPIs and handles empty records cleanly', () => {
    const delta2023 = selectFilteredDailySummary(dataset, {
      regionId: 'nile-delta',
      yearRange: [2023, 2023],
    });
    const kpis = selectOverviewKpis(delta2023, 'merged', 'count');
    expect(kpis.totalMerged).toBeGreaterThan(0);
    expect(kpis.viirsToModisRatio).toBeGreaterThan(2.5);
    expect(kpis.peakDate).toContain('2023-');

    const emptyKpis = selectOverviewKpis([], 'merged', 'count');
    expect(emptyKpis.totalMerged).toBe(0);
    expect(emptyKpis.peakDate).toBeNull();
  });

  it('extracts metric values across sensors (merged, modis, viirs) and metrics (count, frp)', () => {
    const sample = dataset.dailySummary[100];
    expect(selectDayMetricValue(sample, 'merged', 'count')).toBe(sample.count_merged);
    expect(selectDayMetricValue(sample, 'modis', 'count')).toBe(sample.count_modis);
    expect(selectDayMetricValue(sample, 'viirs', 'count')).toBe(sample.count_viirs);
    expect(selectDayMetricValue(sample, 'merged', 'frp')).toBe(sample.total_frp);
  });

  it('selects seasonality matrix and 12-month climatology for Nile Delta', () => {
    const { matrixRecords, monthlyClimatology } = selectSeasonalityData(
      dataset,
      'nile-delta',
      [2023, 2025],
    );
    expect(matrixRecords.length).toBe(36); // 3 years x 12 months
    expect(monthlyClimatology.length).toBe(12);
    // October (month 10, index 9) should be higher than January (month 1, index 0) in Nile Delta
    expect(monthlyClimatology[9].meanCount).toBeGreaterThan(monthlyClimatology[0].meanCount);
  });

  it('filters spatial grid cells and recent points by Egyptian region and sensor toggles', () => {
    const deltaCells = selectFilteredGridCells(dataset, 'nile-delta', '2023-10-12');
    expect(deltaCells.features.length).toBeGreaterThan(0);
    expect(deltaCells.features.every((f) => f.properties.region_id === 'nile-delta')).toBe(true);

    const modisOnlyPts = selectFilteredRecentPoints(dataset, {
      regionId: 'nile-delta',
      selectedDate: null,
      highlightedRange: null,
      showModis: true,
      showViirs: false,
    });
    expect(modisOnlyPts.length).toBeGreaterThan(0);
    expect(modisOnlyPts.every((p) => p.sensor === 'MODIS')).toBe(true);
  });

  it('ranks anomalies and risk periods by severity score', () => {
    const { anomalies, riskPeriods } = selectFilteredAnomaliesAndRisks(
      dataset,
      'nile-delta',
      [2023, 2025],
    );
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].score).toBeGreaterThanOrEqual(anomalies[anomalies.length - 1].score);
    expect(riskPeriods.length).toBeGreaterThan(0);
  });
});
