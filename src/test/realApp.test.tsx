import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-maplibre-gl">{children}</div>
  ),
  Source: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Layer: () => null,
  NavigationControl: () => null,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const RAW = import.meta.glob('../../public/data/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const REAL_FETCHED = new Set([
  'daily_summary.json',
  'grid_cells.geojson',
  'recent_points.json',
  'seasonality.json',
  'anomalies.json',
  'risk_periods.json',
  'validation.json',
  'region_meta.json',
]);

describe('App running on the real Egypt dataset (fetch served from public/data)', () => {
  const fetchedUrls: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_USE_MOCK', 'false');
    vi.stubEnv('VITE_DATA_BASE_URL', '/data');
    fetchedUrls.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        fetchedUrls.push(url);
        const name = url.split('/').pop() ?? '';
        const key = Object.keys(RAW).find((k) => k.endsWith(`/${name}`) && REAL_FETCHED.has(name));
        if (!key) return new Response('not found', { status: 404 });
        return new Response(RAW[key], { status: 200 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it(
    'loads all 8 contract files, shows no demo badge, and renders every page without errors',
    async () => {
      const { default: App } = await import('../App');
      render(<App />);

      await waitFor(
        () => {
          expect(screen.getByText(/Unified fire-activity calendar/i)).toBeInTheDocument();
        },
        { timeout: 15000 },
      );

      expect(screen.queryByText('Demo data')).not.toBeInTheDocument();
      expect(fetchedUrls.length).toBe(8);
      expect(fetchedUrls.every((u) => u.startsWith('/data/'))).toBe(true);
      expect(screen.getAllByText(/Egypt/i).length).toBeGreaterThan(0);

      // Responder preset must land on dates that exist in the dataset
      fireEvent.click(screen.getByRole('button', { name: 'Responder' }));
      await waitFor(() => {
        expect(screen.getByText(/Responder operational posture/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('link', { name: /Method & validation/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Phase 6 Atlas/i })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('link', { name: /^Patterns$/i }));
      await waitFor(
        () => {
          expect(
            screen.getByText(/Multi-year seasonality & monthly climatology/i),
          ).toBeInTheDocument();
          expect(
            screen.getByText(/Daytime vs\. Nighttime Fire Activity across Egypt/i),
          ).toBeInTheDocument();
        },
        { timeout: 15000 },
      );

      expect(
        screen.getByRole('complementary', { name: /Global mission-control filters/i }),
      ).toHaveClass('filter-rail-sticky');

      fireEvent.click(screen.getByRole('link', { name: /^About$/i }));
      await waitFor(
        () => {
          expect(
            screen.getByText(/Orbital instrument comparison \(MODIS vs VIIRS\)/i),
          ).toBeInTheDocument();
          expect(screen.queryByText(/Team Four-Bits-and-a-Byte/i)).not.toBeInTheDocument();
          expect(
            screen.queryByRole('complementary', { name: /Global mission-control filters/i }),
          ).not.toBeInTheDocument();
        },
        { timeout: 15000 },
      );
    },
    25000,
  );
});
