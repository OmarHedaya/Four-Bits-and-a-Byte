import { describe, expect, it } from 'vitest';
import {
  AnomaliesListSchema,
  DailySummaryListSchema,
  GridCellsGeoJsonSchema,
  RecentPointsListSchema,
  RegionMetaListSchema,
  RiskPeriodsListSchema,
  SeasonalityListSchema,
  ValidationDataSchema,
} from '../contracts/schemas';

// Load the delivered files as raw text through Vite (no Node typings needed).
const RAW = import.meta.glob('../../public/data/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const read = (name: string): unknown => {
  const key = Object.keys(RAW).find((k) => k.endsWith(`/${name}`));
  if (!key) throw new Error(`Missing data file public/data/${name}`);
  return JSON.parse(RAW[key]);
};

describe('Real FireScope data files (public/data) honour the data contract', () => {
  const daily = DailySummaryListSchema.parse(read('daily_summary.json'));
  const grid = GridCellsGeoJsonSchema.parse(read('grid_cells.geojson'));
  const points = RecentPointsListSchema.parse(read('recent_points.json'));
  const seasonality = SeasonalityListSchema.parse(read('seasonality.json'));
  const anomalies = AnomaliesListSchema.parse(read('anomalies.json'));
  const risks = RiskPeriodsListSchema.parse(read('risk_periods.json'));
  const validation = ValidationDataSchema.parse(read('validation.json'));
  const regions = RegionMetaListSchema.parse(read('region_meta.json'));

  const regionIds = new Set(regions.map((r) => r.region_id));
  const realRegions = regions.filter((r) => r.region_id !== 'all');

  it('has the "all" region plus the analytical regions', () => {
    expect(regionIds.has('all')).toBe(true);
    expect(realRegions.length).toBeGreaterThanOrEqual(2);
  });

  it('daily summary covers every date of every region exactly once (2023-01-01..2025-12-31)', () => {
    const keys = new Set(daily.map((d) => `${d.region_id}|${d.date}`));
    expect(keys.size).toBe(daily.length);
    expect(daily.length).toBe(realRegions.length * 1096);
    expect(daily.every((d) => regionIds.has(d.region_id) && d.region_id !== 'all')).toBe(true);
    expect(daily.every((d) => d.date >= '2023-01-01' && d.date <= '2025-12-31')).toBe(true);
  });

  it('seasonality "all" equals the sum of the regions and the daily totals', () => {
    const sum = (rows: typeof seasonality) => rows.reduce((a, r) => a + r.count, 0);
    const all = seasonality.filter((s) => s.region_id === 'all');
    const parts = seasonality.filter((s) => s.region_id !== 'all');
    expect(all.length).toBe(36);
    expect(sum(all)).toBe(sum(parts));
    expect(sum(all)).toBe(daily.reduce((a, d) => a + d.count_merged, 0));
  });

  it('every region-tagged record points at a known region', () => {
    const ids = [
      ...grid.features.map((f) => f.properties.region_id),
      ...points.map((p) => p.region_id),
      ...seasonality.map((s) => s.region_id),
      ...anomalies.map((a) => a.region_id),
      ...risks.map((r) => r.region_id),
    ].filter((x): x is string => x !== undefined);
    expect(ids.every((id) => regionIds.has(id))).toBe(true);
  });

  it('recent points stay under the contract cap and carry real sensor families', () => {
    expect(points.length).toBeGreaterThan(0);
    expect(points.length).toBeLessThan(15000);
    expect(new Set(points.map((p) => p.sensor))).toEqual(new Set(['MODIS', 'VIIRS']));
  });

  it('points and grid cells lie inside the country bounding box', () => {
    const [w, s, e, n] = regions.find((r) => r.region_id === 'all')!.bbox;
    expect(points.every((p) => p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n)).toBe(true);
    expect(
      grid.features.every(
        (f) =>
          f.properties.lon >= w - 0.1 &&
          f.properties.lon <= e + 0.1 &&
          f.properties.lat >= s - 0.1 &&
          f.properties.lat <= n + 0.1,
      ),
    ).toBe(true);
  });

  it('validation statistics are finite and consistent with the monthly pairs', () => {
    expect(validation.monthly_pairs.length).toBe(36);
    expect(Number.isFinite(validation.correlation)).toBe(true);
    expect(validation.scaling_factor).toBeGreaterThan(0);
  });

  it('anomalies reference dates inside the data window', () => {
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.every((a) => a.start_date >= '2023-01-01' && a.end_date <= '2025-12-31')).toBe(true);
  });
});
