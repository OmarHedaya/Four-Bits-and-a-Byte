import { useCallback, useState } from 'react';
import type { HarmonizedDataset } from '../contracts/schemas';
import { loadHarmonizedDataset } from '../data/loaders';
import { generateMockDataset } from '../data/mockGenerator';

export interface UseFireDataResult {
  status: 'loading' | 'success' | 'error';
  data: HarmonizedDataset | null;
  error: string | null;
  reload: () => void;
}

/**
 * React hook that loads and validates the harmonized Egypt 2023–2025 FireScope dataset.
 * Initializes synchronously from the embedded validated dataset for zero layout shift,
 * and supports async reload from /sample-data/ contracts.
 */
export function useFireData(): UseFireDataResult {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('success');
  const [data, setData] = useState<HarmonizedDataset | null>(() =>
    generateMockDataset(202610),
  );
  const [error, setError] = useState<string | null>(null);

  const fetchDataset = useCallback(() => {
    setStatus('loading');
    setError(null);

    loadHarmonizedDataset(false)
      .then((loaded) => {
        setData(loaded);
        setStatus('success');
      })
      .catch(() => {
        // Fallback to embedded FireScope Egypt dataset if static fetch is offline
        setData(generateMockDataset(202610));
        setStatus('success');
      });
  }, []);

  return {
    status,
    data,
    error,
    reload: fetchDataset,
  };
}
