import { PLACEHOLDERS, USE_MOCK } from '../config/placeholders';
import {
  AnomaliesListSchema,
  DailySummaryListSchema,
  GridCellsGeoJsonSchema,
  type HarmonizedDataset,
  RecentPointsListSchema,
  RegionMetaListSchema,
  RiskPeriodsListSchema,
  SeasonalityListSchema,
  ValidationDataSchema,
} from '../contracts/schemas';
import { generateMockDataset } from './mockGenerator';

async function fetchAndValidate<T>(
  url: string,
  parser: { parse: (data: unknown) => T },
  entityName: string,
): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to load ${entityName} from ${url} (HTTP ${response.status} ${response.statusText})`,
    );
  }
  const rawJson: unknown = await response.json();
  return parser.parse(rawJson);
}

async function fetchRealDataset(): Promise<HarmonizedDataset> {
  const [
    dailySummary,
    gridCells,
    recentPoints,
    seasonality,
    anomalies,
    riskPeriods,
    validation,
    regionMeta,
  ] = await Promise.all([
    fetchAndValidate(PLACEHOLDERS.DAILY_SUMMARY, DailySummaryListSchema, 'DAILY_SUMMARY'),
    fetchAndValidate(PLACEHOLDERS.GRID_CELLS, GridCellsGeoJsonSchema, 'GRID_CELLS'),
    fetchAndValidate(PLACEHOLDERS.RECENT_POINTS, RecentPointsListSchema, 'RECENT_POINTS'),
    fetchAndValidate(PLACEHOLDERS.SEASONALITY, SeasonalityListSchema, 'SEASONALITY'),
    fetchAndValidate(PLACEHOLDERS.ANOMALIES, AnomaliesListSchema, 'ANOMALIES'),
    fetchAndValidate(PLACEHOLDERS.RISK_PERIODS, RiskPeriodsListSchema, 'RISK_PERIODS'),
    fetchAndValidate(PLACEHOLDERS.VALIDATION, ValidationDataSchema, 'VALIDATION'),
    fetchAndValidate(PLACEHOLDERS.REGION_META, RegionMetaListSchema, 'REGION_META'),
  ]);

  return {
    dailySummary,
    gridCells,
    recentPoints,
    seasonality,
    anomalies,
    riskPeriods,
    validation,
    regionMeta,
    isDemoData: false,
  };
}

// Several components call useFireData(); they must share one download (the grid file alone is ~3.6 MB).
let inflight: Promise<HarmonizedDataset> | null = null;

/**
 * Loads the complete harmonized dataset.
 * - When VITE_USE_MOCK === 'true', returns the deterministic seeded mock dataset wrapped in a Promise.
 * - Otherwise fetches all 8 contract files from VITE_DATA_BASE_URL once (shared by every caller)
 *   and validates them with Zod. A failed load is not cached, so "Retry" really refetches.
 */
export function loadHarmonizedDataset(
  forceUseMock: boolean = USE_MOCK,
): Promise<HarmonizedDataset> {
  if (forceUseMock) {
    return Promise.resolve(generateMockDataset(202610));
  }
  if (!inflight) {
    inflight = fetchRealDataset().catch((err: unknown) => {
      inflight = null;
      throw err;
    });
  }
  return inflight;
}
