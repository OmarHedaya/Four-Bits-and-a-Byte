import { useCallback, useEffect, useState } from 'react';
import { USE_MOCK } from '../config/placeholders';
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
 * React hook that loads and validates the harmonized fire dataset.
 * - Initializes immediately when USE_MOCK is true for zero layout shift.
 * - Fetches and validates remote/public JSON & GeoJSON files when USE_MOCK is false.
 */
export function useFireData(): UseFireDataResult {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(() =>
    USE_MOCK ? 'success' : 'loading',
  );
  const [data, setData] = useState<HarmonizedDataset | null>(() =>
    USE_MOCK ? generateMockDataset(202610) : null,
  );
  const [error, setError] = useState<string | null>(null);

  const fetchDataset = useCallback(() => {
    if (USE_MOCK) {
      setData(generateMockDataset(202610));
      setStatus('success');
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    loadHarmonizedDataset(false)
      .then((loaded) => {
        if (!cancelled) {
          setData(loaded);
          setStatus('success');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown data loading error');
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!USE_MOCK) {
      return fetchDataset();
    }
  }, [fetchDataset]);

  return {
    status,
    data,
    error,
    reload: fetchDataset,
  };
}
