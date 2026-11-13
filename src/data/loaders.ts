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

/**
 * Loads the complete harmonized dataset.
 * - When VITE_USE_MOCK !== 'false', returns the deterministic seeded mock dataset synchronously wrapped in a Promise.
 * - When VITE_USE_MOCK === 'false', fetches all 8 contract files from VITE_DATA_BASE_URL and validates with Zod.
 */
export async function loadHarmonizedDataset(
  forceUseMock: boolean = USE_MOCK,
): Promise<HarmonizedDataset> {
  if (forceUseMock) {
    return generateMockDataset(202610);
  }

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
