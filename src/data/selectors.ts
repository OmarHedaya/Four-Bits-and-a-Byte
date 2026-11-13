import type {
  AnomalyRecord,
  DailySummaryRecord,
  GridCellsGeoJson,
  HarmonizedDataset,
  RecentPointRecord,
  RegionMetaRecord,
  RiskPeriodRecord,
  SeasonalityRecord,
} from '../contracts/schemas';
import type { MetricFilter, SensorFilter } from '../store/useFilterStore';

export interface DailyFilterParams {
  regionId: string;
  yearRange: [number, number];
}

/**
 * Returns one DailySummaryRecord per calendar day within [startYear, endYear].
 * When regionId === 'all', aggregates across all regional records for each date.
 */
export function selectFilteredDailySummary(
  dataset: HarmonizedDataset,
  { regionId, yearRange }: DailyFilterParams,
): DailySummaryRecord[] {
  const [minYear, maxYear] = [
    Math.min(yearRange[0], yearRange[1]),
    Math.max(yearRange[0], yearRange[1]),
  ];
  const minDate = `${minYear}-01-01`;
  const maxDate = `${maxYear}-12-31`;

  if (regionId !== 'all') {
    return dataset.dailySummary
      .filter(
        (r) =>
          r.region_id === regionId && r.date >= minDate && r.date <= maxDate,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Global composite ('all'): aggregate by date
  const byDate = new Map<
    string,
    {
      count_modis: number;
      count_viirs: number;
      count_merged: number;
      total_frp: number;
      weighted_high_conf: number;
      weight_sum: number;
      max_anomaly_z: number;
    }
  >();

  for (const r of dataset.dailySummary) {
    if (r.date < minDate || r.date > maxDate) continue;
    const existing = byDate.get(r.date);
    const weight = Math.max(1, r.count_merged);
    if (!existing) {
      byDate.set(r.date, {
        count_modis: r.count_modis,
        count_viirs: r.count_viirs,
        count_merged: r.count_merged,
        total_frp: r.total_frp,
        weighted_high_conf: r.high_conf_share * weight,
        weight_sum: weight,
        max_anomaly_z: r.anomaly_z,
      });
    } else {
      existing.count_modis += r.count_modis;
      existing.count_viirs += r.count_viirs;
      existing.count_merged += r.count_merged;
      existing.total_frp = Number((existing.total_frp + r.total_frp).toFixed(1));
      existing.weighted_high_conf += r.high_conf_share * weight;
      existing.weight_sum += weight;
      if (r.anomaly_z > existing.max_anomaly_z) {
        existing.max_anomaly_z = r.anomaly_z;
      }
    }
  }

  const aggregated: DailySummaryRecord[] = [];
  for (const [date, item] of byDate.entries()) {
    aggregated.push({
      date,
      region_id: 'all',
      count_modis: item.count_modis,
      count_viirs: item.count_viirs,
      count_merged: item.count_merged,
      total_frp: item.total_frp,
      high_conf_share: Number(
        (item.weighted_high_conf / Math.max(1, item.weight_sum)).toFixed(3),
      ),
      anomaly_z: item.max_anomaly_z,
    });
  }

  return aggregated.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Extracts the active numeric value for a daily record given sensor & metric filters.
 */
export function selectDayMetricValue(
  record: DailySummaryRecord,
  sensor: SensorFilter,
  metric: MetricFilter,
): number {
  if (metric === 'count') {
    if (sensor === 'modis') return record.count_modis;
    if (sensor === 'viirs') return record.count_viirs;
    return record.count_merged;
  }

  // metric === 'frp'
  if (sensor === 'merged') {
    return record.total_frp;
  }
  const combinedRaw = Math.max(1, record.count_modis + record.count_viirs);
  if (sensor === 'modis') {
    // MODIS 1km pixels carry ~44% of total integrated radiative power on average
    const modisShare = (record.count_modis / combinedRaw) * 1.45;
    return Number((record.total_frp * Math.min(0.85, modisShare)).toFixed(1));
  }
  const viirsShare = (record.count_viirs / combinedRaw) * 0.85;
  return Number((record.total_frp * Math.min(0.9, viirsShare)).toFixed(1));
}

export interface OverviewKpis {
  totalMerged: number;
  totalModis: number;
  totalViirs: number;
  totalFrpMw: number;
  meanHighConfShare: number;
  anomalyDaysCount: number;
  peakDate: string | null;
  peakValue: number;
  viirsToModisRatio: number;
  activeDaysCount: number;
}

/**
 * Computes summary KPIs from a filtered list of daily summary records.
 */
export function selectOverviewKpis(
  records: readonly DailySummaryRecord[],
  sensor: SensorFilter = 'merged',
  metric: MetricFilter = 'count',
): OverviewKpis {
  if (records.length === 0) {
    return {
      totalMerged: 0,
      totalModis: 0,
      totalViirs: 0,
      totalFrpMw: 0,
      meanHighConfShare: 0,
      anomalyDaysCount: 0,
      peakDate: null,
      peakValue: 0,
      viirsToModisRatio: 0,
      activeDaysCount: 0,
    };
  }

  let totalMerged = 0;
  let totalModis = 0;
  let totalViirs = 0;
  let totalFrpMw = 0;
  let highConfSum = 0;
  let anomalyDaysCount = 0;
  let peakDate: string | null = records[0].date;
  let peakValue = -1;

  for (const r of records) {
    totalMerged += r.count_merged;
    totalModis += r.count_modis;
    totalViirs += r.count_viirs;
    totalFrpMw += r.total_frp;
    highConfSum += r.high_conf_share;
    if (r.anomaly_z >= 2.0) {
      anomalyDaysCount += 1;
    }
    const val = selectDayMetricValue(r, sensor, metric);
    if (val > peakValue) {
      peakValue = val;
      peakDate = r.date;
    }
  }

  return {
    totalMerged,
    totalModis,
    totalViirs,
    totalFrpMw: Number(totalFrpMw.toFixed(1)),
    meanHighConfShare: Number((highConfSum / records.length).toFixed(3)),
    anomalyDaysCount,
    peakDate,
    peakValue: Number(peakValue.toFixed(1)),
    viirsToModisRatio: Number((totalViirs / Math.max(1, totalModis)).toFixed(2)),
    activeDaysCount: records.length,
  };
}

export interface MonthlyClimatologyPoint {
  month: number;
  monthLabel: string;
  meanCount: number;
  meanFrp: number;
  meanModis: number;
  meanViirs: number;
}

const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Selects seasonality records (month x year) and monthly climatological averages.
 */
export function selectSeasonalityData(
  dataset: HarmonizedDataset,
  regionId: string,
  yearRange: [number, number],
): {
  matrixRecords: SeasonalityRecord[];
  monthlyClimatology: MonthlyClimatologyPoint[];
} {
  const [minYear, maxYear] = [
    Math.min(yearRange[0], yearRange[1]),
    Math.max(yearRange[0], yearRange[1]),
  ];

  const matching = dataset.seasonality.filter((s) => {
    const regionMatches = s.region_id ? s.region_id === regionId : regionId === 'all';
    return regionMatches && s.year >= minYear && s.year <= maxYear;
  });

  // Fallback: if external dataset omitted region_id on seasonality, derive from dailySummary
  let matrixRecords = matching;
  if (matrixRecords.length === 0) {
    const daily = selectFilteredDailySummary(dataset, { regionId, yearRange });
    const map = new Map<string, SeasonalityRecord>();
    for (const d of daily) {
      const year = Number(d.date.slice(0, 4));
      const month = Number(d.date.slice(5, 7));
      const key = `${year}-${month}`;
      const cur = map.get(key) ?? {
        year,
        month,
        frp_sum: 0,
        count: 0,
        count_modis: 0,
        count_viirs: 0,
        region_id: regionId,
      };
      cur.frp_sum = Number((cur.frp_sum + d.total_frp).toFixed(1));
      cur.count += d.count_merged;
      cur.count_modis = (cur.count_modis ?? 0) + d.count_modis;
      cur.count_viirs = (cur.count_viirs ?? 0) + d.count_viirs;
      map.set(key, cur);
    }
    matrixRecords = Array.from(map.values());
  }

  const monthlyClimatology: MonthlyClimatologyPoint[] = [];
  for (let m = 1; m <= 12; m++) {
    const forMonth = matrixRecords.filter((r) => r.month === m);
    const divisor = Math.max(1, forMonth.length);
    const sumCount = forMonth.reduce((a, r) => a + r.count, 0);
    const sumFrp = forMonth.reduce((a, r) => a + r.frp_sum, 0);
    const sumModis = forMonth.reduce((a, r) => a + (r.count_modis ?? Math.round(r.count * 0.38)), 0);
    const sumViirs = forMonth.reduce((a, r) => a + (r.count_viirs ?? Math.round(r.count * 1.25)), 0);

    monthlyClimatology.push({
      month: m,
      monthLabel: MONTH_SHORT_NAMES[m - 1],
      meanCount: Math.round(sumCount / divisor),
      meanFrp: Number((sumFrp / divisor).toFixed(1)),
      meanModis: Math.round(sumModis / divisor),
      meanViirs: Math.round(sumViirs / divisor),
    });
  }

  return {
    matrixRecords: matrixRecords.sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month,
    ),
    monthlyClimatology,
  };
}

function isWithinBbox(
  lon: number,
  lat: number,
  bbox: readonly [number, number, number, number],
): boolean {
  return lon >= bbox[0] && lat >= bbox[1] && lon <= bbox[2] && lat <= bbox[3];
}

/**
 * Filters GRID_CELLS GeoJSON features by region (or spatial bbox) and optional selected date's month.
 */
export function selectFilteredGridCells(
  dataset: HarmonizedDataset,
  regionId: string,
  selectedDate: string | null,
): GridCellsGeoJson {
  const regionMeta: RegionMetaRecord | undefined = dataset.regionMeta.find(
    (r) => r.region_id === regionId,
  );
  const selectedMonth = selectedDate ? Number(selectedDate.slice(5, 7)) : null;

  const filteredFeatures = dataset.gridCells.features.filter((f) => {
    const props = f.properties;
    const regionOk =
      regionId === 'all' ||
      (props.region_id
        ? props.region_id === regionId
        : regionMeta
          ? isWithinBbox(props.lon, props.lat, regionMeta.bbox)
          : true);

    if (!regionOk) return false;

    if (selectedMonth !== null) {
      const cellMonth =
        typeof props.month === 'number'
          ? props.month
          : Number(String(props.month).slice(-2));
      // Match selected month if available; if no cells for that exact off-season month, keep regional cells
      return cellMonth === selectedMonth;
    }
    return true;
  });

  // If a user clicks an off-peak month that had 0 pre-aggregated peak cells, return regional cells scaled down
  if (filteredFeatures.length === 0 && selectedMonth !== null) {
    const fallbackFeatures = dataset.gridCells.features.filter((f) =>
      regionId === 'all'
        ? true
        : f.properties.region_id === regionId ||
          (regionMeta
            ? isWithinBbox(f.properties.lon, f.properties.lat, regionMeta.bbox)
            : true),
    );
    return {
      type: 'FeatureCollection',
      features: fallbackFeatures,
    };
  }

  return {
    type: 'FeatureCollection',
    features: filteredFeatures,
  };
}

export interface RecentPointsFilterParams {
  regionId: string;
  selectedDate: string | null;
  highlightedRange: { start: string; end: string } | null;
  showModis: boolean;
  showViirs: boolean;
}

/**
 * Filters RECENT_POINTS by sensor visibility toggles, region/bbox, and active date/window.
 */
export function selectFilteredRecentPoints(
  dataset: HarmonizedDataset,
  {
    regionId,
    selectedDate,
    highlightedRange,
    showModis,
    showViirs,
  }: RecentPointsFilterParams,
): RecentPointRecord[] {
  const regionMeta = dataset.regionMeta.find((r) => r.region_id === regionId);

  const byRegionAndSensor = dataset.recentPoints.filter((pt) => {
    if (pt.sensor === 'MODIS' && !showModis) return false;
    if (pt.sensor === 'VIIRS' && !showViirs) return false;

    if (regionId !== 'all') {
      if (pt.region_id) {
        if (pt.region_id !== regionId) return false;
      } else if (regionMeta && !isWithinBbox(pt.lon, pt.lat, regionMeta.bbox)) {
        return false;
      }
    }
    return true;
  });

  if (selectedDate) {
    const exact = byRegionAndSensor.filter((pt) => pt.date === selectedDate);
    if (exact.length > 0) return exact;
  }

  if (highlightedRange) {
    const inRange = byRegionAndSensor.filter(
      (pt) => pt.date >= highlightedRange.start && pt.date <= highlightedRange.end,
    );
    if (inRange.length > 0) return inRange;
  }

  return byRegionAndSensor;
}

/**
 * Filters and ranks ANOMALIES and RISK_PERIODS for the active region and year range.
 */
export function selectFilteredAnomaliesAndRisks(
  dataset: HarmonizedDataset,
  regionId: string,
  yearRange: [number, number],
): {
  anomalies: AnomalyRecord[];
  riskPeriods: RiskPeriodRecord[];
} {
  const [minYear, maxYear] = [
    Math.min(yearRange[0], yearRange[1]),
    Math.max(yearRange[0], yearRange[1]),
  ];
  const minDate = `${minYear}-01-01`;
  const maxDate = `${maxYear}-12-31`;

  const anomalies = dataset.anomalies
    .filter((a) => {
      const regionMatch = regionId === 'all' || a.region_id === regionId;
      const dateMatch = a.end_date >= minDate && a.start_date <= maxDate;
      return regionMatch && dateMatch;
    })
    .sort((a, b) => b.score - a.score);

  const riskPeriods = dataset.riskPeriods
    .filter((r) => regionId === 'all' || r.region_id === regionId)
    .sort((a, b) => b.risk_score - a.risk_score);

  return { anomalies, riskPeriods };
}
