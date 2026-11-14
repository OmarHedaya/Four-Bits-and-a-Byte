import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock MapLibre GL inside JSDOM so the smoke test exercises the full React application tree without requiring WebGL canvas context
vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-maplibre-gl">{children}</div>
  ),
  Source: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Layer: () => null,
  NavigationControl: () => null,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import App from '../App';
import { PLACEHOLDERS } from '../config/placeholders';

describe('Main User Flow End-to-End Smoke Test (FireScope Egypt 2023–2025)', () => {
  it('renders Overview with Egypt 2023–2025 data, switches Audience Modes, jumps to an Anomaly, and navigates to Method, Atlas & About pages', async () => {
    render(<App />);

    // 1. Verify TopBar brand & Egypt Baseline v1 badge
    expect(screen.getByText(PLACEHOLDERS.PROJECT_NAME)).toBeInTheDocument();
    expect(screen.getByText(/Egypt 2023–2025 · Baseline v1/i)).toBeInTheDocument();

    // 2. Wait for lazy-loaded OverviewPage & CalendarHeatmap to appear
    await waitFor(() => {
      expect(
        screen.getByText(/Unified fire-activity calendar/i),
      ).toBeInTheDocument();
    });

    // 3. Switch Audience Mode to Responder and verify posture banner updates
    const responderBtn = screen.getByRole('button', { name: 'Responder' });
    fireEvent.click(responderBtn);
    await waitFor(() => {
      expect(
        screen.getByText(/Responder operational posture/i),
      ).toBeInTheDocument();
    });

    // 4. Click a 2024–2025 Egypt anomaly in the right panel and verify Active focus updates
    const deltaAnomaly = screen.getByText(/2024-10-01 → 2024-10-30/i);
    fireEvent.click(deltaAnomaly);
    await waitFor(() => {
      expect(screen.getByText(/Day: 2024-10-01/i)).toBeInTheDocument();
    });

    // 5. Navigate to Method & validation screen
    const methodNav = screen.getByRole('link', { name: /Method & validation/i });
    fireEvent.click(methodNav);
    await waitFor(
      () => {
        expect(
          screen.getByText(/Step-by-step MODIS \(1 km\) & VIIRS \(375 m\) harmonization methodology/i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Honest methodological & physical sensor limitations/i),
        ).toBeInTheDocument();
      },
      { timeout: 4000 },
    );

    // 6. Navigate to Phase 6 Atlas screen
    const atlasNav = screen.getByRole('link', { name: /Phase 6 Atlas/i });
    fireEvent.click(atlasNav);
    await waitFor(
      () => {
        expect(
          screen.getByText(/Phase 6 Scientific Visualization Atlas & Pipeline Reports/i),
        ).toBeInTheDocument();
      },
      { timeout: 4000 },
    );

    // 7. Navigate to About screen
    const aboutNav = screen.getByRole('link', { name: /^About$/i });
    fireEvent.click(aboutNav);
    await waitFor(
      () => {
        expect(
          screen.getByText(/Orbital instrument comparison \(MODIS vs VIIRS\)/i),
        ).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });
});
