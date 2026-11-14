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

describe('Data Layer Selectors & Filter Logic (F2)', () => {
  const dataset = generateMockDataset(202610);

  it('aggregates daily records by date when regionId is "all"', () => {
    const globalRecords = selectFilteredDailySummary(dataset, {
      regionId: 'all',
      yearRange: [2021, 2025],
    });
    const medRecords = selectFilteredDailySummary(dataset, {
      regionId: 'med-east',
      yearRange: [2021, 2025],
    });

    // 5 years (including 2024 leap year) = 1,826 days
    expect(globalRecords.length).toBe(1826);
    expect(medRecords.length).toBe(1826);
    expect(globalRecords[0].count_merged).toBeGreaterThan(medRecords[0].count_merged);
  });

  it('filters daily records by single year range', () => {
    const only2023 = selectFilteredDailySummary(dataset, {
      regionId: 'med-east',
      yearRange: [2023, 2023],
    });
    expect(only2023.length).toBe(365);
    expect(only2023.every((r) => r.date.startsWith('2023-'))).toBe(true);
  });

  it('computes accurate Overview KPIs and handles empty records cleanly', () => {
    const med2023 = selectFilteredDailySummary(dataset, {
      regionId: 'med-east',
      yearRange: [2023, 2023],
    });
    const kpis = selectOverviewKpis(med2023, 'merged', 'count');
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

  it('selects seasonality matrix and 12-month climatology', () => {
    const { matrixRecords, monthlyClimatology } = selectSeasonalityData(
      dataset,
      'amazon-south',
      [2021, 2025],
    );
    expect(matrixRecords.length).toBe(60); // 5 years x 12 months
    expect(monthlyClimatology.length).toBe(12);
    // September (month 9, index 8) should be higher than March (month 3, index 2) in Southern Amazonia
    expect(monthlyClimatology[8].meanCount).toBeGreaterThan(monthlyClimatology[2].meanCount);
  });

  it('filters spatial grid cells and recent points by region and sensor toggles', () => {
    const westNaCells = selectFilteredGridCells(dataset, 'west-na', '2021-08-10');
    expect(westNaCells.features.length).toBeGreaterThan(0);
    expect(westNaCells.features.every((f) => f.properties.region_id === 'west-na')).toBe(true);

    const modisOnlyPts = selectFilteredRecentPoints(dataset, {
      regionId: 'med-east',
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
      'med-east',
      [2021, 2025],
    );
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].score).toBeGreaterThanOrEqual(anomalies[anomalies.length - 1].score);
    expect(riskPeriods.length).toBeGreaterThan(0);
  });
});

describe('selectors on real-data shapes', () => {
  it('aggregateGridCellsByCell draws each cell once and sums counts and FRP', async () => {
    const { aggregateGridCellsByCell } = await import('../data/selectors');
    const mk = (cell: string, month: number, count: number, frp: number) => ({
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [] as unknown },
      properties: { cell_id: cell, lat: 30, lon: 31, month, frp_sum: frp, count, region_id: 'r' },
    });
    const out = aggregateGridCellsByCell([
      mk('A', 1, 2, 10),
      mk('A', 2, 3, 5.5),
      mk('B', 1, 1, 1),
    ]);
    expect(out.length).toBe(2);
    const a = out.find((f) => f.properties.cell_id === 'A')!;
    expect(a.properties.count).toBe(5);
    expect(a.properties.frp_sum).toBeCloseTo(15.5, 1);
  });

  it('uses real per-sensor FRP when the daily record provides it', async () => {
    const { selectDayMetricValue } = await import('../data/selectors');
    const rec = {
      date: '2024-01-01',
      region_id: 'r',
      count_modis: 1,
      count_viirs: 9,
      count_merged: 8,
      total_frp: 100,
      frp_modis: 12.5,
      frp_viirs: 80.25,
      high_conf_share: 0.1,
      anomaly_z: 0,
    };
    expect(selectDayMetricValue(rec, 'modis', 'frp')).toBe(12.5);
    expect(selectDayMetricValue(rec, 'viirs', 'frp')).toBe(80.25);
    expect(selectDayMetricValue(rec, 'merged', 'frp')).toBe(100);
  });
});
