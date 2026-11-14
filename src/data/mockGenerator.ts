import {
  type HarmonizedDataset,
  HarmonizedDatasetSchema,
} from '../contracts/schemas';
import rawEgyptDataset from './generated/firescopeEgyptDataset.json';

let cachedEgyptDataset: HarmonizedDataset | null = null;

/**
 * Returns the validated FireScope Egypt 2023–2025 harmonized dataset
 * (254,175 harmonized rows across MODIS, S-NPP, NOAA-20, and NOAA-21
 * aggregated onto the 0.05° × 0.05° spatial grid and 1,096-day calendar).
 */
export function generateMockDataset(_seed = 202610): HarmonizedDataset {
  if (cachedEgyptDataset && _seed === 202610) {
    return cachedEgyptDataset;
  }

  cachedEgyptDataset = HarmonizedDatasetSchema.parse(rawEgyptDataset);
  return cachedEgyptDataset;
}
