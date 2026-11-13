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

describe('Main User Flow End-to-End Smoke Test (F8)', () => {
  it('renders Overview, switches Audience Modes, jumps to an Anomaly, and navigates to Method & About pages', async () => {
    render(<App />);

    // 1. Verify TopBar brand & Demo data badge
    expect(screen.getByText('FIRMS Harmonizer')).toBeInTheDocument();
    expect(screen.getByText('Demo data')).toBeInTheDocument();

    // 2. Wait for lazy-loaded OverviewPage & CalendarHeatmap to appear
    await waitFor(() => {
      expect(
        screen.getByText(/Unified fire-activity calendar \(Hero\)/i),
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

    // 4. Click a 2024–2025 anomaly in the right panel and verify Active focus updates
    const amazonAnomaly = screen.getByText(/2024-08-24 → 2024-09-14/i);
    fireEvent.click(amazonAnomaly);
    await waitFor(() => {
      expect(screen.getByText(/Day: 2024-08-24/i)).toBeInTheDocument();
    });

    // 5. Navigate to Method & validation screen
    const methodNav = screen.getByRole('link', { name: /Method & validation/i });
    fireEvent.click(methodNav);
    await waitFor(() => {
      expect(
        screen.getByText(/Step-by-step MODIS \(1 km\) & VIIRS \(375 m\) harmonization methodology/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Honest methodological & physical sensor limitations/i),
      ).toBeInTheDocument();
    });

    // 6. Navigate to About screen
    const aboutNav = screen.getByRole('link', { name: /^About$/i });
    fireEvent.click(aboutNav);
    await waitFor(() => {
      expect(screen.getByText(/Team Four-Bits-and-a-Byte/i)).toBeInTheDocument();
    });
  });
});
