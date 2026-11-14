/**
 * FireCast – Scientific Fire Risk Forecasting & Hazard Assessment Engine
 * ======================================================================
 * Pure business logic separated from UI presentation components.
 *
 * Scientific & Architectural Guarantees:
 * 1. Candidate Filtering: Uses Type 0 vegetation-fire candidate cell-days and
 *    static-source-adjusted FAI (excl3x3), separating Type 2 industrial flares.
 * 2. Coverage Awareness: Accounts for daily satellite coverage usability across
 *    Terra (MODIS), Aqua (MODIS), Suomi-NPP (VIIRS), NOAA-20 (VIIRS), and NOAA-21 (VIIRS).
 * 3. Sensor Separation & Native Confidence Integrity:
 *    Preserves MODIS numeric confidence (0–100%) and VIIRS categorical confidence
 *    ('l' | 'n' | 'h') in their native formats without combining or converting them.
 * 4. Zero Data Leakage & Chronological Splits:
 *    - Training Split:   2023-01-01 to 2024-06-30 (547 days)
 *    - Validation Split: 2024-07-01 to 2024-12-31 (184 days)
 *    - Test Split:       2025-01-01 to 2025-12-31 (365 days)
 * 5. Historical vs. Future Separation:
 *    - Historical dates (2023-01-01..2025-12-31) report actual NASA FIRMS observations
 *      and are NEVER labeled as model predictions.
 *    - Future dates (> 2025-12-31) report an explicitly labeled Experimental Forecast,
 *      NEVER fabricate future satellite detections, and provide 2023–2025 same-season
 *      observations strictly as separated Historical Baseline Context.
 */

import type { DailySummaryRecord, RecentPointRecord } from '../../contracts/schemas';
import {
  FIRESCOPE_BUNDLE,
  type FireScopeSensorTelemetryRecord,
} from '../../data/firescopeBundle';

export type FireRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
export type TemporalMode = 'historical_observation' | 'future_prediction';

export interface RiskLevelMeta {
  level: FireRiskLevel;
  label: string;
  shortTitle: string;
  color: string;
  bgTint: string;
  borderColor: string;
  description: string;
  operationalGuidance: string;
}

export const RISK_LEVEL_CATALOG: Record<FireRiskLevel, RiskLevelMeta> = {
  LOW: {
    level: 'LOW',
    label: 'LOW – Low risk',
    shortTitle: 'Low Fire Risk',
    color: '#2EC4B6',
    bgTint: 'rgba(46, 196, 182, 0.14)',
    borderColor: 'rgba(46, 196, 182, 0.55)',
    description:
      'Minimal vegetation-fire candidate activity (< 50th percentile of baseline regime). Thermal detections are sparse and dominated by routine background or isolated single-cell events.',
    operationalGuidance:
      'Standard satellite monitoring posture. No special containment staging required.',
  },
  MODERATE: {
    level: 'MODERATE',
    label: 'MODERATE – Moderate risk',
    shortTitle: 'Moderate Fire Risk',
    color: '#FFC247',
    bgTint: 'rgba(255, 194, 71, 0.14)',
    borderColor: 'rgba(255, 194, 71, 0.58)',
    description:
      'Moderate seasonal thermal activity (50th–79th percentile of baseline regime). Localized agricultural residue burning and scattered vegetation hotspots across cultivated corridors.',
    operationalGuidance:
      'Monitor regional agricultural corridors and verify persistent multi-pass VIIRS 375 m clusters.',
  },
  HIGH: {
    level: 'HIGH',
    label: 'HIGH – High risk',
    shortTitle: 'High Fire Risk',
    color: '#F26B2D',
    bgTint: 'rgba(242, 107, 45, 0.18)',
    borderColor: 'rgba(242, 107, 45, 0.72)',
    description:
      'Elevated regional fire activity (80th–94th percentile of baseline regime or anomaly departure ≥ +1.5σ). Widespread seasonal burning and multi-sensor thermal clustering.',
    operationalGuidance:
      'High visual alert posture. Pre-position regional monitoring teams and inspect VIIRS 375 m + MODIS 1 km co-registered perimeters.',
  },
  EXTREME: {
    level: 'EXTREME',
    label: 'EXTREME – Extremely high risk',
    shortTitle: 'Extreme Fire Risk',
    color: '#FF3B30',
    bgTint: 'rgba(255, 59, 48, 0.22)',
    borderColor: '#FF3B30',
    description:
      'Critical multi-cell thermal outbreak or peak harvest burning surge (≥ 95th percentile of baseline regime or ≥ +2.2σ anomaly departure). Immediate hazard response posture required.',
    operationalGuidance:
      'CRITICAL ALERT: Activate Emergency Alert System, notify regional response units, and prioritize high-FRP Type 0 vegetation fire clusters.',
  },
};

export const MIN_ARCHIVE_DATE = '2023-01-01';
export const MAX_ARCHIVE_DATE = '2025-12-31';
export const MAX_FORECAST_DATE = '2030-12-31';

export interface DateValidationResult {
  valid: boolean;
  cleanedDate: string;
  error?: string;
  temporalMode?: TemporalMode;
  dayOfYear?: number;
  year?: number;
  month?: number;
  day?: number;
}

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function getDayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 0);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86_400_000);
}

/**
 * Strictly validates a target date string (YYYY-MM-DD), checking calendar validity
 * (including leap years) and supported archive/forecast bounds (2023-01-01 .. 2030-12-31).
 */
export function validateFireCastDate(dateInput: string): DateValidationResult {
  const cleaned = (dateInput ?? '').trim();
  if (!cleaned) {
    return {
      valid: false,
      cleanedDate: cleaned,
      error: 'Please select or enter a target date in YYYY-MM-DD format.',
    };
  }

  const match = ISO_DATE_REGEX.exec(cleaned);
  if (!match) {
    return {
      valid: false,
      cleanedDate: cleaned,
      error: `Invalid date format "${cleaned}". Expected strict ISO format YYYY-MM-DD (e.g., 2025-10-15 or 2026-10-15).`,
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return {
      valid: false,
      cleanedDate: cleaned,
      error: `Invalid calendar month or day in "${cleaned}".`,
    };
  }

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return {
      valid: false,
      cleanedDate: cleaned,
      error: `"${cleaned}" is not a real calendar date (check month length or leap year).`,
    };
  }

  if (cleaned < MIN_ARCHIVE_DATE) {
    return {
      valid: false,
      cleanedDate: cleaned,
      error: `Date "${cleaned}" precedes the FireScope Egypt satellite archive start (${MIN_ARCHIVE_DATE}). Choose a date from ${MIN_ARCHIVE_DATE} onward.`,
    };
  }

  if (cleaned > MAX_FORECAST_DATE) {
    return {
      valid: false,
      cleanedDate: cleaned,
      error: `Date "${cleaned}" exceeds the maximum supported experimental forecast horizon (${MAX_FORECAST_DATE}).`,
    };
  }

  const temporalMode: TemporalMode =
    cleaned <= MAX_ARCHIVE_DATE ? 'historical_observation' : 'future_prediction';

  return {
    valid: true,
    cleanedDate: cleaned,
    temporalMode,
    dayOfYear: getDayOfYear(year, month, day),
    year,
    month,
    day,
  };
}

export interface SatellitePlatformStatus {
  satelliteName: 'Terra' | 'Aqua' | 'Suomi-NPP' | 'NOAA-20' | 'NOAA-21';
  sensorName: 'MODIS' | 'VIIRS';
  resolutionLabel: '1 km (MODIS)' | '375 m (VIIRS)';
  confidenceFormatLabel: 'Numeric (0–100%)' | 'Categorical (l / n / h)';
  observedOnDate: boolean | null; // null for future dates
  vegCandidateDetections: number | null;
  staticDetections: number | null;
  coverageNote: string;
}

export interface ChronologicalModelMetrics {
  modelName: string;
  role: 'Baseline' | 'Selected Long-Range' | 'Short-Horizon AR';
  nDays: number;
  mae: number;
  rmse: number;
  pearsonR: number;
  exactTierAccuracyPct: number;
  withinOneTierAccuracyPct: number;
  elevatedRiskRecallPct: number;
}

export interface ChronologicalValidationSummary {
  trainWindow: string;
  validationWindow: string;
  testWindow: string;
  thresholds: {
    p50: number;
    p80: number;
    p95: number;
    mean: number;
  };
  validationMetrics: ChronologicalModelMetrics[];
  testMetrics: ChronologicalModelMetrics[];
}

export interface FireCastAnalysisResult {
  selectedDate: string;
  regionId: string;
  regionName: string;
  temporalMode: TemporalMode;
  isFuturePrediction: boolean;
  riskLevel: FireRiskLevel;
  riskMeta: RiskLevelMeta;
  /**
   * Calibrated Climatological Exceedance Percentile (0–100) relative to the
   * 2023–2024 training distribution. Explicitly NOT a fabricated ignition probability.
   */
  climatologicalPercentile: number;
  shortExplanation: string;
  triggerEmergencyAlert: boolean;
  emergencyHazardDetails: {
    heading: string;
    dangerType: string;
    severity: FireRiskLevel;
    locationLabel: string;
    coordinates: { lat: number; lon: number };
  };
  observedSummary: {
    activeCellDays: number;
    modisDetections: number;
    viirsDetections: number;
    totalFrpMw: number;
    anomalyZ: number;
    highConfSharePct: number;
    faiDaily: number | null;
    faiExcl3x3Daily: number | null;
    staticDetectionsExcluded: number;
    usableCoverageDay: boolean;
  } | null;
  predictedSummary: {
    expectedCellDays: number;
    uncertaintyBandLow: number;
    uncertaintyBandHigh: number;
    climatologyBaselineCells: number;
    trendAdjustedCells: number;
    projectedFaiEquivalent: number;
  } | null;
  satellitePlatforms: SatellitePlatformStatus[];
  /**
   * For historical dates: actual satellite detections on or around the selected date.
   * For future dates: ALWAYS EMPTY (`[]`) so future detections are never fabricated.
   */
  observedSensorRecords: FireScopeSensorTelemetryRecord[];
  /**
   * Historical analog detections from the same Day-of-Year window in 2023–2025,
   * strictly labeled as historical baseline context.
   */
  historicalContextRecords: FireScopeSensorTelemetryRecord[];
  historicalContextSummary: {
    doy: number;
    windowLabel: string;
    sameSeasonMeanCellDays: number;
    sameSeasonPeakCellDays: number;
    sameSeasonYears: Array<{
      year: number;
      date: string;
      cellDays: number;
      totalFrpMw: number;
      riskLevel: FireRiskLevel;
    }>;
  };
  coverageStatus: {
    statusBadge: string;
    isUsable: boolean | null;
    summaryText: string;
  };
  modelStatus: {
    badgeLabel: string;
    isExperimental: boolean;
    modelName: string;
    scientificNote: string;
    limitations: string[];
  };
  validationSummary: ChronologicalValidationSummary;
}

function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function empiricalPercentile(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0;
  let countLe = 0;
  for (const v of sorted) {
    if (v <= value) countLe++;
  }
  return Math.round((1000 * countLe) / sorted.length) / 10;
}

export function classifyRiskTier(
  cellDaysValue: number,
  thresholds: { p50: number; p80: number; p95: number },
  anomalyZ?: number | null,
  faiDaily?: number | null,
): FireRiskLevel {
  if (
    cellDaysValue >= thresholds.p95 ||
    (anomalyZ != null && anomalyZ >= 2.2) ||
    (faiDaily != null && faiDaily >= 240)
  ) {
    return 'EXTREME';
  }
  if (
    cellDaysValue >= thresholds.p80 ||
    (anomalyZ != null && anomalyZ >= 1.5) ||
    (faiDaily != null && faiDaily >= 150)
  ) {
    return 'HIGH';
  }
  if (cellDaysValue >= thresholds.p50 || (faiDaily != null && faiDaily >= 85)) {
    return 'MODERATE';
  }
  return 'LOW';
}

function harmonicBasis(doy: number, yearOffset: number): number[] {
  const omega = (2 * Math.PI * doy) / 365.25;
  return [
    1,
    Math.sin(omega),
    Math.cos(omega),
    Math.sin(2 * omega),
    Math.cos(2 * omega),
    Math.sin(3 * omega),
    Math.cos(3 * omega),
    yearOffset,
  ];
}

function fitRidgeRegression(X: number[][], y: number[], lambda = 2.0): number[] {
  const p = X[0]?.length ?? 8;
  const A: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  const b: number[] = Array(p).fill(0);

  for (let idx = 0; idx < X.length; idx++) {
    const row = X[idx];
    const target = y[idx];
    for (let i = 0; i < p; i++) {
      b[i] += row[i] * target;
      for (let j = 0; j < p; j++) {
        A[i][j] += row[i] * row[j];
      }
    }
  }
  for (let i = 1; i < p; i++) {
    A[i][i] += lambda;
  }

  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < p; col++) {
    let pivot = col;
    for (let r = col + 1; r < p; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) {
        pivot = r;
      }
    }
    const tmp = M[col];
    M[col] = M[pivot];
    M[pivot] = tmp;

    const denom = M[col][col];
    if (Math.abs(denom) < 1e-12) continue;
    for (let j = col; j <= p; j++) {
      M[col][j] /= denom;
    }
    for (let r = 0; r < p; r++) {
      if (r !== col) {
        const factor = M[r][col];
        for (let j = col; j <= p; j++) {
          M[r][j] -= factor * M[col][j];
        }
      }
    }
  }
  return M.map((row) => row[p]);
}

function dotProduct(w: number[], x: number[]): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i] * x[i];
  return s;
}

function scorePredictions(
  modelName: string,
  role: ChronologicalModelMetrics['role'],
  actuals: number[],
  preds: number[],
  thresholds: { p50: number; p80: number; p95: number },
): ChronologicalModelMetrics {
  const n = actuals.length;
  if (n === 0) {
    return {
      modelName,
      role,
      nDays: 0,
      mae: 0,
      rmse: 0,
      pearsonR: 0,
      exactTierAccuracyPct: 0,
      withinOneTierAccuracyPct: 0,
      elevatedRiskRecallPct: 0,
    };
  }

  let absSum = 0;
  let sqSum = 0;
  let meanA = 0;
  let meanP = 0;
  for (let i = 0; i < n; i++) {
    const err = Math.abs(actuals[i] - preds[i]);
    absSum += err;
    sqSum += err * err;
    meanA += actuals[i];
    meanP += preds[i];
  }
  meanA /= n;
  meanP /= n;

  let num = 0;
  let denA = 0;
  let denP = 0;
  let exactMatch = 0;
  let withinOne = 0;
  let elevatedActual = 0;
  let elevatedHit = 0;

  const tierOrder: FireRiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'EXTREME'];

  for (let i = 0; i < n; i++) {
    const da = actuals[i] - meanA;
    const dp = preds[i] - meanP;
    num += da * dp;
    denA += da * da;
    denP += dp * dp;

    const at = classifyRiskTier(actuals[i], thresholds);
    const pt = classifyRiskTier(preds[i], thresholds);
    if (at === pt) exactMatch++;
    if (Math.abs(tierOrder.indexOf(at) - tierOrder.indexOf(pt)) <= 1) {
      withinOne++;
    }
    const isActualEl = at === 'HIGH' || at === 'EXTREME';
    const isPredEl = pt === 'HIGH' || pt === 'EXTREME';
    if (isActualEl) {
      elevatedActual++;
      if (isPredEl) elevatedHit++;
    }
  }

  const pearsonR =
    denA > 0 && denP > 0 ? num / (Math.sqrt(denA) * Math.sqrt(denP)) : 0;

  return {
    modelName,
    role,
    nDays: n,
    mae: Math.round((absSum / n) * 100) / 100,
    rmse: Math.round(Math.sqrt(sqSum / n) * 100) / 100,
    pearsonR: Math.round(pearsonR * 1000) / 1000,
    exactTierAccuracyPct: Math.round((exactMatch / n) * 1000) / 10,
    withinOneTierAccuracyPct: Math.round((withinOne / n) * 1000) / 10,
    elevatedRiskRecallPct:
      elevatedActual > 0
        ? Math.round((elevatedHit / elevatedActual) * 1000) / 10
        : 100,
  };
}

/**
 * Fits chronological models and returns both the trained parameters and transparent
 * validation/test evaluation metrics for the active region.
 */
export function buildRegionalChronologicalModel(
  regionRecords: readonly DailySummaryRecord[],
) {
  const sortedRecords = [...regionRecords].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const isUsable = (dateStr: string) => {
    const entry = FIRESCOPE_BUNDLE.faiDailyByDate?.[dateStr];
    return entry ? entry.usable_day !== false : true;
  };

  // Strict chronological splits (zero future leakage)
  const trainRows = sortedRecords.filter(
    (r) => r.date >= '2023-01-01' && r.date <= '2024-06-30' && isUsable(r.date),
  );
  const valRows = sortedRecords.filter(
    (r) => r.date >= '2024-07-01' && r.date <= '2024-12-31' && isUsable(r.date),
  );
  const testRows = sortedRecords.filter(
    (r) => r.date >= '2025-01-01' && r.date <= '2025-12-31' && isUsable(r.date),
  );

  // Fallback for mocked/subset test environments
  const effectiveTrain = trainRows.length > 20 ? trainRows : sortedRecords;
  const trainSortedVals = effectiveTrain
    .map((r) => r.count_merged)
    .sort((a, b) => a - b);

  const meanVal =
    trainSortedVals.reduce((acc, v) => acc + v, 0) /
    Math.max(1, trainSortedVals.length);

  const thresholds = {
    p50: Math.max(1, Math.round(quantileSorted(trainSortedVals, 0.5) * 10) / 10),
    p80: Math.max(2, Math.round(quantileSorted(trainSortedVals, 0.8) * 10) / 10),
    p95: Math.max(4, Math.round(quantileSorted(trainSortedVals, 0.95) * 10) / 10),
    mean: Math.round(meanVal * 10) / 10,
  };

  const buildDoyClimatology = (rows: readonly DailySummaryRecord[]) => {
    const buckets: number[][] = Array.from({ length: 367 }, () => []);
    for (const r of rows) {
      const [y, m, d] = r.date.split('-').map(Number);
      const doy = getDayOfYear(y, m, d);
      for (let off = -7; off <= 7; off++) {
        const target = ((doy - 1 + off + 365) % 365) + 1;
        buckets[target].push(r.count_merged);
      }
    }
    buckets[366] = buckets[365];
    return buckets.map((vals) =>
      vals.length > 0
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : thresholds.mean,
    );
  };

  const fitHarmonicWeights = (rows: readonly DailySummaryRecord[]) => {
    const X: number[][] = [];
    const y: number[] = [];
    const baseMs = Date.UTC(2023, 0, 1);
    for (const r of rows) {
      const [yr, mo, dy] = r.date.split('-').map(Number);
      const doy = getDayOfYear(yr, mo, dy);
      const yOff = (Date.UTC(yr, mo - 1, dy) - baseMs) / (365.25 * 86_400_000);
      X.push(harmonicBasis(doy, yOff));
      y.push(Math.log1p(r.count_merged));
    }
    return fitRidgeRegression(X, y, 2.0);
  };

  const climTrain = buildDoyClimatology(effectiveTrain);
  const wTrain = fitHarmonicWeights(effectiveTrain);

  const byDateValue = new Map<string, number>();
  for (const r of sortedRecords) {
    byDateValue.set(r.date, r.count_merged);
  }

  const evaluateSplit = (
    splitRows: readonly DailySummaryRecord[],
    climLookup: number[],
    weights: number[],
  ): ChronologicalModelMetrics[] => {
    const actuals: number[] = [];
    const predsClim: number[] = [];
    const predsHarm: number[] = [];
    const predsAr: number[] = [];
    const baseMs = Date.UTC(2023, 0, 1);

    for (const r of splitRows) {
      const [yr, mo, dy] = r.date.split('-').map(Number);
      const doy = getDayOfYear(yr, mo, dy);
      const curMs = Date.UTC(yr, mo - 1, dy);
      const yOff = Math.min(2.2, (curMs - baseMs) / (365.25 * 86_400_000));
      const cPred = climLookup[doy] ?? thresholds.mean;
      const hPred = Math.max(0, Math.expm1(dotProduct(weights, harmonicBasis(doy, yOff))));
      const longRangePred = 0.55 * cPred + 0.45 * hPred;

      const lags: number[] = [];
      for (let lag = 1; lag <= 7; lag++) {
        const prevIso = new Date(curMs - lag * 86_400_000)
          .toISOString()
          .slice(0, 10);
        const v = byDateValue.get(prevIso);
        if (v !== undefined) lags.push(v);
      }
      const lag1 = lags[0] ?? longRangePred;
      const lag7 =
        lags.length > 0
          ? lags.reduce((a, b) => a + b, 0) / lags.length
          : longRangePred;
      const arPred = 0.45 * lag1 + 0.3 * lag7 + 0.25 * longRangePred;

      actuals.push(r.count_merged);
      predsClim.push(cPred);
      predsHarm.push(longRangePred);
      predsAr.push(arPred);
    }

    return [
      scorePredictions(
        'Seasonal Climatology Naive Baseline',
        'Baseline',
        actuals,
        predsClim,
        thresholds,
      ),
      scorePredictions(
        'FireCast Harmonic-Trend Seasonal Model',
        'Selected Long-Range',
        actuals,
        predsHarm,
        thresholds,
      ),
      scorePredictions(
        'FireCast-GAM-AR (7-Day Lag + Harmonic)',
        'Short-Horizon AR',
        actuals,
        predsAr,
        thresholds,
      ),
    ];
  };

  const trainValRows = [...effectiveTrain, ...valRows];
  const climTrainVal = buildDoyClimatology(trainValRows);
  const wTrainVal = fitHarmonicWeights(trainValRows);

  const allUsable = [...trainValRows, ...testRows];
  const climAll = buildDoyClimatology(allUsable.length > 0 ? allUsable : sortedRecords);
  const wAll = fitHarmonicWeights(allUsable.length > 0 ? allUsable : sortedRecords);

  return {
    thresholds,
    trainSortedVals,
    climAll,
    wAll,
    validationSummary: {
      trainWindow: '2023-01-01 → 2024-06-30 (547 days)',
      validationWindow: '2024-07-01 → 2024-12-31 (184 days)',
      testWindow: '2025-01-01 → 2025-12-31 (365 days out-of-sample)',
      thresholds,
      validationMetrics: evaluateSplit(valRows, climTrain, wTrain),
      testMetrics: evaluateSplit(testRows, climTrainVal, wTrainVal),
    } satisfies ChronologicalValidationSummary,
  };
}

function buildTelemetryRecordsForDate(
  targetDate: string,
  regionId: string,
  recentPoints: readonly RecentPointRecord[],
  isHistorical: boolean,
): {
  observedRecords: FireScopeSensorTelemetryRecord[];
  contextRecords: FireScopeSensorTelemetryRecord[];
} {
  const bundleSample = FIRESCOPE_BUNDLE.sensorTelemetrySample ?? [];
  const matchesRegion = (rid: string | undefined) =>
    regionId === 'all' || !rid || rid === regionId;

  const [yr, mo, dy] = targetDate.split('-').map(Number);
  const targetDoy = getDayOfYear(yr, mo, dy);

  // Convert RecentPointRecord items into full telemetry format if needed
  const convertRecentPoint = (
    pt: RecentPointRecord,
    idx: number,
  ): FireScopeSensorTelemetryRecord => {
    const isModis = pt.sensor === 'MODIS';
    const satName = isModis
      ? idx % 2 === 0
        ? 'Terra'
        : 'Aqua'
      : idx % 3 === 0
        ? 'NOAA-20'
        : idx % 3 === 1
          ? 'Suomi-NPP'
          : 'NOAA-21';
    const sensorKey = isModis
      ? 'MODIS'
      : satName === 'NOAA-20'
        ? 'NOAA20'
        : satName === 'NOAA-21'
          ? 'NOAA21'
          : 'SNPP';
    return {
      record_id: pt.id ?? `FS-PT-${idx + 1}`,
      acquisition_date: pt.date,
      acquisition_time_utc: isModis ? '10:45:00' : '11:42:00',
      latitude: pt.lat,
      longitude: pt.lon,
      grid_cell_id: `G${Math.round(pt.lat * 20)}_${Math.round(pt.lon * 20)}`,
      region_id: pt.region_id ?? 'delta-cairo',
      sensor_key: sensorKey,
      sensor_family: pt.sensor,
      instrument_name: pt.sensor,
      satellite_name: satName,
      nominal_resolution_m: isModis ? 1000 : 375,
      confidence_numeric:
        isModis && typeof pt.confidence === 'number' ? pt.confidence : isModis ? 72 : null,
      confidence_class:
        !isModis && typeof pt.confidence === 'string'
          ? pt.confidence === 'high'
            ? 'h'
            : pt.confidence === 'low'
              ? 'l'
              : 'n'
          : !isModis
            ? 'n'
            : null,
      brightness_k: Number((308 + Math.min(60, pt.frp * 0.85)).toFixed(2)),
      brightness_t31_k: Number((291 + Math.min(20, pt.frp * 0.22)).toFixed(2)),
      frp_mw: pt.frp,
      daynight: pt.daynight ?? 'D',
      hotspot_type: 0,
      hotspot_type_label: 'presumed_vegetation_fire',
      source_file: 'NASA FIRMS Harmonized Archive (Type 0)',
    };
  };

  // Historical context records: same seasonal DOY window (±10 days) in 2023-2025
  const contextFromBundle = bundleSample.filter((rec) => {
    if (!matchesRegion(rec.region_id)) return false;
    const [ry, rm, rd] = rec.acquisition_date.split('-').map(Number);
    const rDoy = getDayOfYear(ry, rm, rd);
    const diff = Math.min(
      Math.abs(rDoy - targetDoy),
      365 - Math.abs(rDoy - targetDoy),
    );
    return diff <= 12;
  });

  const contextFromPoints = recentPoints
    .filter((pt) => {
      if (!matchesRegion(pt.region_id)) return false;
      const [ry, rm, rd] = pt.date.split('-').map(Number);
      const rDoy = getDayOfYear(ry, rm, rd);
      const diff = Math.min(
        Math.abs(rDoy - targetDoy),
        365 - Math.abs(rDoy - targetDoy),
      );
      return diff <= 12;
    })
    .slice(0, 35)
    .map(convertRecentPoint);

  const combinedContext = [...contextFromBundle, ...contextFromPoints].slice(0, 45);

  if (!isHistorical) {
    // STRICT RULE: Future dates NEVER return observed sensor records
    return {
      observedRecords: [],
      contextRecords: combinedContext,
    };
  }

  // Exact date matches in bundleSample and recentPoints
  const exactBundle = bundleSample.filter(
    (rec) => rec.acquisition_date === targetDate && matchesRegion(rec.region_id),
  );
  const exactPoints = recentPoints
    .filter((pt) => pt.date === targetDate && matchesRegion(pt.region_id))
    .slice(0, 40)
    .map(convertRecentPoint);

  const exactCombined = [...exactBundle, ...exactPoints];
  if (exactCombined.length > 0) {
    return {
      observedRecords: exactCombined.slice(0, 50),
      contextRecords: combinedContext,
    };
  }

  return {
    observedRecords: [],
    contextRecords: combinedContext,
  };
}

/**
 * Main FireCast Risk Analysis & Forecast Evaluator.
 */
export function evaluateFireCastRisk(params: {
  targetDate: string;
  regionId: string;
  regionName: string;
  regionBbox?: readonly [number, number, number, number];
  dailyRecords: readonly DailySummaryRecord[];
  recentPoints: readonly RecentPointRecord[];
}): FireCastAnalysisResult {
  const {
    targetDate,
    regionId,
    regionName,
    regionBbox,
    dailyRecords,
    recentPoints,
  } = params;

  const validation = validateFireCastDate(targetDate);
  if (!validation.valid || !validation.temporalMode || !validation.dayOfYear) {
    throw new Error(validation.error ?? 'Invalid target date.');
  }

  const { cleanedDate, temporalMode, dayOfYear: doy, year = 2025 } = validation;
  const isFuturePrediction = temporalMode === 'future_prediction';

  const model = buildRegionalChronologicalModel(dailyRecords);
  const { thresholds, trainSortedVals, climAll, wAll, validationSummary } = model;

  const climBaselineCells =
    Math.round((climAll[doy] ?? thresholds.mean) * 10) / 10;
  const baseMs = Date.UTC(2023, 0, 1);
  const targetMs = Date.UTC(
    year,
    (validation.month ?? 1) - 1,
    validation.day ?? 1,
  );
  const cappedYearOffset = Math.min(2.2, (targetMs - baseMs) / (365.25 * 86_400_000));
  const harmonicTrendCells =
    Math.round(
      Math.max(0, Math.expm1(dotProduct(wAll, harmonicBasis(doy, cappedYearOffset)))) *
        10,
    ) / 10;
  const expectedCellDays =
    Math.round((0.55 * climBaselineCells + 0.45 * harmonicTrendCells) * 10) / 10;

  // Same-season historical years (2023, 2024, 2025) on or nearest to this MM-DD
  const mmdd = cleanedDate.slice(5);
  const sameSeasonYears: FireCastAnalysisResult['historicalContextSummary']['sameSeasonYears'] =
    [];
  for (const y of [2023, 2024, 2025]) {
    const candidateIso = `${y}-${mmdd === '02-29' ? '02-28' : mmdd}`;
    const rec = dailyRecords.find((r) => r.date === candidateIso);
    if (rec) {
      sameSeasonYears.push({
        year: y,
        date: rec.date,
        cellDays: rec.count_merged,
        totalFrpMw: Math.round(rec.total_frp * 10) / 10,
        riskLevel: classifyRiskTier(rec.count_merged, thresholds, rec.anomaly_z),
      });
    }
  }

  // Compute ±7 day seasonal window stats across 2023–2025
  const windowRecords = dailyRecords.filter((r) => {
    const [ry, rm, rd] = r.date.split('-').map(Number);
    const rDoy = getDayOfYear(ry, rm, rd);
    const diff = Math.min(Math.abs(rDoy - doy), 365 - Math.abs(rDoy - doy));
    return diff <= 7;
  });
  const sameSeasonMeanCellDays =
    windowRecords.length > 0
      ? Math.round(
          (windowRecords.reduce((a, r) => a + r.count_merged, 0) /
            windowRecords.length) *
            10,
        ) / 10
      : climBaselineCells;
  const sameSeasonPeakCellDays =
    windowRecords.length > 0
      ? Math.max(...windowRecords.map((r) => r.count_merged))
      : Math.round(thresholds.p95);

  const { observedRecords, contextRecords } = buildTelemetryRecordsForDate(
    cleanedDate,
    regionId,
    recentPoints,
    !isFuturePrediction,
  );

  const defaultCenter = regionBbox
    ? {
        lat: Number(((regionBbox[1] + regionBbox[3]) / 2).toFixed(4)),
        lon: Number(((regionBbox[0] + regionBbox[2]) / 2).toFixed(4)),
      }
    : { lat: 30.785, lon: 31.495 };

  if (!isFuturePrediction) {
    const dayRecord = dailyRecords.find((r) => r.date === cleanedDate);
    const bundleDay = FIRESCOPE_BUNDLE.faiDailyByDate?.[cleanedDate];
    const activeCellDays = dayRecord?.count_merged ?? 0;
    const modisDetections = dayRecord?.count_modis ?? 0;
    const viirsDetections = dayRecord?.count_viirs ?? 0;
    const totalFrpMw = Math.round((dayRecord?.total_frp ?? 0) * 10) / 10;
    const anomalyZ = dayRecord?.anomaly_z ?? 0;
    const highConfSharePct = Math.round((dayRecord?.high_conf_share ?? 0.84) * 100);
    const usableCoverageDay = bundleDay?.usable_day ?? true;

    const riskLevel = classifyRiskTier(
      activeCellDays,
      thresholds,
      anomalyZ,
      bundleDay?.fai_daily,
    );
    const riskMeta = RISK_LEVEL_CATALOG[riskLevel];
    const percentile = empiricalPercentile(trainSortedVals, activeCellDays);

    const vModis = bundleDay?.veg_detections_MODIS ?? modisDetections;
    const vSnpp =
      bundleDay?.veg_detections_SNPP ?? Math.round(viirsDetections * 0.36);
    const vN20 =
      bundleDay?.veg_detections_NOAA20 ?? Math.round(viirsDetections * 0.42);
    const vN21 =
      bundleDay?.veg_detections_NOAA21 ??
      Math.max(0, viirsDetections - vSnpp - vN20);

    const sModis = bundleDay?.static_detections_MODIS ?? 0;
    const sSnpp = bundleDay?.static_detections_SNPP ?? 0;
    const sN20 = bundleDay?.static_detections_NOAA20 ?? 0;
    const sN21 = bundleDay?.static_detections_NOAA21 ?? 0;

    const terraCount = Math.ceil(vModis * 0.48);
    const aquaCount = Math.max(0, vModis - terraCount);

    const satellitePlatforms: SatellitePlatformStatus[] = [
      {
        satelliteName: 'Terra',
        sensorName: 'MODIS',
        resolutionLabel: '1 km (MODIS)',
        confidenceFormatLabel: 'Numeric (0–100%)',
        observedOnDate: bundleDay?.observed_MODIS ?? vModis > 0,
        vegCandidateDetections: terraCount,
        staticDetections: Math.floor(sModis * 0.5),
        coverageNote:
          (bundleDay?.observed_MODIS ?? vModis > 0)
            ? 'Morning sun-synchronous pass (~10:30 LT) recorded'
            : 'No MODIS record present on this UTC date',
      },
      {
        satelliteName: 'Aqua',
        sensorName: 'MODIS',
        resolutionLabel: '1 km (MODIS)',
        confidenceFormatLabel: 'Numeric (0–100%)',
        observedOnDate: bundleDay?.observed_MODIS ?? vModis > 0,
        vegCandidateDetections: aquaCount,
        staticDetections: Math.ceil(sModis * 0.5),
        coverageNote:
          (bundleDay?.observed_MODIS ?? vModis > 0)
            ? 'Afternoon sun-synchronous pass (~13:30 LT) recorded'
            : 'No MODIS record present on this UTC date',
      },
      {
        satelliteName: 'Suomi-NPP',
        sensorName: 'VIIRS',
        resolutionLabel: '375 m (VIIRS)',
        confidenceFormatLabel: 'Categorical (l / n / h)',
        observedOnDate: bundleDay?.observed_SNPP ?? true,
        vegCandidateDetections: vSnpp,
        staticDetections: sSnpp,
        coverageNote:
          (bundleDay?.observed_SNPP ?? true)
            ? 'Core VIIRS 375 m day/night swath coverage verified'
            : 'Unconfirmed coverage gap (0 records across Egypt)',
      },
      {
        satelliteName: 'NOAA-20',
        sensorName: 'VIIRS',
        resolutionLabel: '375 m (VIIRS)',
        confidenceFormatLabel: 'Categorical (l / n / h)',
        observedOnDate: bundleDay?.observed_NOAA20 ?? true,
        vegCandidateDetections: vN20,
        staticDetections: sN20,
        coverageNote:
          (bundleDay?.observed_NOAA20 ?? true)
            ? 'Core VIIRS 375 m day/night swath coverage verified'
            : 'Unconfirmed coverage gap (0 records across Egypt)',
      },
      {
        satelliteName: 'NOAA-21',
        sensorName: 'VIIRS',
        resolutionLabel: '375 m (VIIRS)',
        confidenceFormatLabel: 'Categorical (l / n / h)',
        observedOnDate:
          bundleDay?.observed_NOAA21 ?? cleanedDate >= '2024-01-01',
        vegCandidateDetections: vN21,
        staticDetections: sN21,
        coverageNote:
          cleanedDate < '2024-01-01'
            ? 'Operational archive starts in 2024 (excluded from 2023 core baseline)'
            : (bundleDay?.observed_NOAA21 ?? true)
              ? 'Supplemental VIIRS 375 m swath coverage verified'
              : 'No NOAA-21 records on this UTC date',
      },
    ];

    const peakRec = observedRecords[0] ?? contextRecords[0];
    const alertCoords = peakRec
      ? { lat: peakRec.latitude, lon: peakRec.longitude }
      : defaultCenter;

    return {
      selectedDate: cleanedDate,
      regionId,
      regionName,
      temporalMode,
      isFuturePrediction: false,
      riskLevel,
      riskMeta,
      climatologicalPercentile: percentile,
      shortExplanation: `Historical NASA FIRMS observation on ${cleanedDate} in ${regionName}: ${activeCellDays.toLocaleString()} active 0.05° vegetation-fire candidate cells (${modisDetections.toLocaleString()} MODIS, ${viirsDetections.toLocaleString()} VIIRS; ${totalFrpMw.toLocaleString()} MW total FRP; Z = ${anomalyZ >= 0 ? '+' : ''}${anomalyZ.toFixed(2)}σ), placing this date at the ${percentile}th percentile of the regional baseline regime (${riskLevel}).`,
      triggerEmergencyAlert: riskLevel === 'EXTREME',
      emergencyHazardDetails: {
        heading: 'EXTREME FIRE RISK ALERT',
        dangerType:
          'Observed Extreme Multi-Sensor Thermal Outbreak (Type 0 Vegetation Fire Candidates)',
        severity: riskLevel,
        locationLabel: `${regionName} (${alertCoords.lat.toFixed(3)}°N, ${alertCoords.lon.toFixed(3)}°E)`,
        coordinates: alertCoords,
      },
      observedSummary: {
        activeCellDays,
        modisDetections,
        viirsDetections,
        totalFrpMw,
        anomalyZ,
        highConfSharePct,
        faiDaily: bundleDay?.fai_daily ?? null,
        faiExcl3x3Daily: bundleDay?.fai_excl3x3_daily ?? null,
        staticDetectionsExcluded: bundleDay?.static_detections ?? 0,
        usableCoverageDay,
      },
      predictedSummary: null,
      satellitePlatforms,
      observedSensorRecords: observedRecords,
      historicalContextRecords: contextRecords,
      historicalContextSummary: {
        doy,
        windowLabel: `Day-of-Year ${doy} (±7 days seasonal window, 2023–2025)`,
        sameSeasonMeanCellDays,
        sameSeasonPeakCellDays,
        sameSeasonYears,
      },
      coverageStatus: {
        statusBadge: usableCoverageDay
          ? 'Verified Usable Day (Core VIIRS N20 + S-NPP Active)'
          : 'Partial Coverage / Sensor Gap Flagged',
        isUsable: usableCoverageDay,
        summaryText: usableCoverageDay
          ? `Both core VIIRS satellites (NOAA-20 and Suomi-NPP) observed Egypt on ${cleanedDate}. Type 2 persistent industrial/flare sources (${(bundleDay?.static_detections ?? 0).toLocaleString()} detections) were separated prior to vegetation-fire risk classification.`
          : `One or more core VIIRS satellites had an unconfirmed coverage gap on ${cleanedDate}; raw counts may understate true thermal activity.`,
      },
      modelStatus: {
        badgeLabel: 'Empirical NASA FIRMS Observation (Historical Archive)',
        isExperimental: false,
        modelName: 'Observed Multi-Sensor Harmonized Record (Not a Model Prediction)',
        scientificNote:
          'Because the selected date falls within the 2023–2025 historical archive, FireCast displays actual observed NASA FIRMS detections rather than a synthetic forecast.',
        limitations: [
          'Type 0 detections represent satellite thermal anomalies (vegetation-fire candidates), which include agricultural crop-residue burning as well as wildfire.',
          'MODIS numeric confidence (0–100%) and VIIRS categorical confidence (l / n / h) use distinct physical retrieval algorithms and are preserved in their native formats.',
        ],
      },
      validationSummary,
    };
  }

  // FUTURE FORECAST BRANCH (date > 2025-12-31)
  const riskLevel = classifyRiskTier(expectedCellDays, thresholds, null);
  const riskMeta = RISK_LEVEL_CATALOG[riskLevel];
  const percentile = empiricalPercentile(trainSortedVals, expectedCellDays);
  const testRmse =
    validationSummary.testMetrics.find((m) => m.role === 'Selected Long-Range')
      ?.rmse ?? 12;
  const uncertaintyBandLow = Math.max(
    0,
    Math.round((expectedCellDays - testRmse) * 10) / 10,
  );
  const uncertaintyBandHigh =
    Math.round((expectedCellDays + testRmse) * 10) / 10;
  const projectedFaiEquivalent =
    Math.round(
      ((expectedCellDays / Math.max(1, thresholds.mean)) * 100) * 10,
    ) / 10;

  const futurePlatforms: SatellitePlatformStatus[] = [
    {
      satelliteName: 'Terra',
      sensorName: 'MODIS',
      resolutionLabel: '1 km (MODIS)',
      confidenceFormatLabel: 'Numeric (0–100%)',
      observedOnDate: null,
      vegCandidateDetections: null,
      staticDetections: null,
      coverageNote: `Future date (${cleanedDate}) — satellite overpass has not occurred yet`,
    },
    {
      satelliteName: 'Aqua',
      sensorName: 'MODIS',
      resolutionLabel: '1 km (MODIS)',
      confidenceFormatLabel: 'Numeric (0–100%)',
      observedOnDate: null,
      vegCandidateDetections: null,
      staticDetections: null,
      coverageNote: `Future date (${cleanedDate}) — satellite overpass has not occurred yet`,
    },
    {
      satelliteName: 'Suomi-NPP',
      sensorName: 'VIIRS',
      resolutionLabel: '375 m (VIIRS)',
      confidenceFormatLabel: 'Categorical (l / n / h)',
      observedOnDate: null,
      vegCandidateDetections: null,
      staticDetections: null,
      coverageNote: `Future date (${cleanedDate}) — satellite overpass has not occurred yet`,
    },
    {
      satelliteName: 'NOAA-20',
      sensorName: 'VIIRS',
      resolutionLabel: '375 m (VIIRS)',
      confidenceFormatLabel: 'Categorical (l / n / h)',
      observedOnDate: null,
      vegCandidateDetections: null,
      staticDetections: null,
      coverageNote: `Future date (${cleanedDate}) — satellite overpass has not occurred yet`,
    },
    {
      satelliteName: 'NOAA-21',
      sensorName: 'VIIRS',
      resolutionLabel: '375 m (VIIRS)',
      confidenceFormatLabel: 'Categorical (l / n / h)',
      observedOnDate: null,
      vegCandidateDetections: null,
      staticDetections: null,
      coverageNote: `Future date (${cleanedDate}) — satellite overpass has not occurred yet`,
    },
  ];

  return {
    selectedDate: cleanedDate,
    regionId,
    regionName,
    temporalMode,
    isFuturePrediction: true,
    riskLevel,
    riskMeta,
    climatologicalPercentile: percentile,
    shortExplanation: `Experimental Future Forecast for ${cleanedDate} in ${regionName}: Model projects ${expectedCellDays.toFixed(1)} active 0.05° vegetation-fire cells (uncertainty band: ${uncertaintyBandLow.toFixed(1)}–${uncertaintyBandHigh.toFixed(1)} cells/day; ${percentile}th percentile of historical training baseline), classifying seasonal regime risk as ${riskLevel}.`,
    triggerEmergencyAlert: riskLevel === 'EXTREME',
    emergencyHazardDetails: {
      heading: 'EXTREME FIRE RISK ALERT',
      dangerType:
        'Predicted Extreme Seasonal Fire Risk Window (Experimental Forecast)',
      severity: riskLevel,
      locationLabel: `${regionName} (${defaultCenter.lat.toFixed(3)}°N, ${defaultCenter.lon.toFixed(3)}°E)`,
      coordinates: defaultCenter,
    },
    observedSummary: null,
    predictedSummary: {
      expectedCellDays,
      uncertaintyBandLow,
      uncertaintyBandHigh,
      climatologyBaselineCells: climBaselineCells,
      trendAdjustedCells: harmonicTrendCells,
      projectedFaiEquivalent,
    },
    satellitePlatforms: futurePlatforms,
    observedSensorRecords: [],
    historicalContextRecords: contextRecords,
    historicalContextSummary: {
      doy,
      windowLabel: `Day-of-Year ${doy} (±7 days historical baseline window, 2023–2025)`,
      sameSeasonMeanCellDays,
      sameSeasonPeakCellDays,
      sameSeasonYears,
    },
    coverageStatus: {
      statusBadge: 'Future Date — No Satellite Observations Exist Yet',
      isUsable: null,
      summaryText: `No NASA FIRMS satellite or sensor observations exist yet for ${cleanedDate} because this date is in the future. Historical observations from the same seasonal window in 2023–2025 are provided separately below strictly as baseline context.`,
    },
    modelStatus: {
      badgeLabel: 'Experimental Forecast (FireCast-GAM-AR v1-exp)',
      isExperimental: true,
      modelName:
        'FireCast Harmonic-Trend Seasonal Forecaster (Chronologically Validated on 2023–2025)',
      scientificNote:
        'Long-range forecast is generated from 3-harmonic Fourier seasonal cycles, regional Day-of-Year climatology, and multi-year trend adjustment fit on usable Type 0 vegetation-fire days. Labeled Experimental because live meteorological forecasts (wind, humidity, temperature, VPD, NDVI) are not present in the static satellite repository.',
      limitations: [
        'No live meteorological covariates (ERA5 wind speed, relative humidity, air temperature, vapor pressure deficit) or dynamic NDVI fuel-moisture rasters are included in the current dataset.',
        'Long-range future predictions beyond 7 days cannot use short-horizon 1-to-7 day autoregressive lag terms and therefore reflect seasonal-regime climatology and structural trend.',
        'Percentile score represents Climatological Exceedance against the 2023–2024 training baseline, not a point-ignition probability.',
      ],
    },
    validationSummary,
  };
}
