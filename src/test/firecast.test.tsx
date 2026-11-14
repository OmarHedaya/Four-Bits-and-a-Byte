import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
import {
  classifyRiskTier,
  evaluateFireCastRisk,
  validateFireCastDate,
} from '../features/firecast/firecastEngine';
import { generateMockDataset } from '../data/mockGenerator';
import { selectFilteredDailySummary } from '../data/selectors';

describe('FireCast Engine – Date Validation, Scientific Separation & Risk Classification', () => {
  it('validates historical and future ISO dates strictly and rejects invalid or out-of-range dates', () => {
    const hist = validateFireCastDate('2023-10-20');
    expect(hist.valid).toBe(true);
    expect(hist.temporalMode).toBe('historical_observation');

    const leap = validateFireCastDate('2024-02-29');
    expect(leap.valid).toBe(true);
    expect(leap.temporalMode).toBe('historical_observation');

    const fut = validateFireCastDate('2026-10-15');
    expect(fut.valid).toBe(true);
    expect(fut.temporalMode).toBe('future_prediction');

    expect(validateFireCastDate('').valid).toBe(false);
    expect(validateFireCastDate('10/20/2025').valid).toBe(false);
    expect(validateFireCastDate('2025-02-29').valid).toBe(false); // 2025 is not a leap year
    expect(validateFireCastDate('2022-12-31').valid).toBe(false); // before archive start
    expect(validateFireCastDate('2031-01-01').valid).toBe(false); // beyond forecast horizon
  });

  it('classifies LOW, MODERATE, HIGH, and EXTREME risk tiers accurately', () => {
    const thresholds = { p50: 38, p80: 61, p95: 134.3 };
    expect(classifyRiskTier(12, thresholds, -0.4)).toBe('LOW');
    expect(classifyRiskTier(45, thresholds, 0.2)).toBe('MODERATE');
    expect(classifyRiskTier(75, thresholds, 1.1)).toBe('HIGH');
    expect(classifyRiskTier(180, thresholds, 2.8)).toBe('EXTREME');
    // Anomaly Z >= 2.2 also triggers EXTREME
    expect(classifyRiskTier(55, thresholds, 2.5)).toBe('EXTREME');
  });

  it('strictly separates historical observations from future predictions and preserves all 5 satellite identities', () => {
    const dataset = generateMockDataset(202610);
    const dailyRecords = selectFilteredDailySummary(dataset, {
      regionId: 'all',
      yearRange: [2023, 2025],
    });

    // 1. Historical evaluation (never labeled as a prediction)
    const histResult = evaluateFireCastRisk({
      targetDate: '2023-10-20',
      regionId: 'all',
      regionName: 'All Egypt (Harmonized Study Extent)',
      dailyRecords,
      recentPoints: dataset.recentPoints,
    });

    expect(histResult.isFuturePrediction).toBe(false);
    expect(histResult.temporalMode).toBe('historical_observation');
    expect(histResult.observedSummary).not.toBeNull();
    expect(histResult.predictedSummary).toBeNull();
    expect(histResult.modelStatus.isExperimental).toBe(false);
    expect(histResult.satellitePlatforms.map((p) => p.satelliteName)).toEqual([
      'Terra',
      'Aqua',
      'Suomi-NPP',
      'NOAA-20',
      'NOAA-21',
    ]);
    // Verify native confidence format separation (MODIS numeric vs VIIRS categorical)
    expect(histResult.satellitePlatforms[0].confidenceFormatLabel).toBe(
      'Numeric (0–100%)',
    );
    expect(histResult.satellitePlatforms[2].confidenceFormatLabel).toBe(
      'Categorical (l / n / h)',
    );

    // 2. Future forecast evaluation (never fabricates future satellite detections)
    const futureResult = evaluateFireCastRisk({
      targetDate: '2026-10-15',
      regionId: 'all',
      regionName: 'All Egypt (Harmonized Study Extent)',
      dailyRecords,
      recentPoints: dataset.recentPoints,
    });

    expect(futureResult.isFuturePrediction).toBe(true);
    expect(futureResult.temporalMode).toBe('future_prediction');
    expect(futureResult.observedSummary).toBeNull();
    expect(futureResult.predictedSummary).not.toBeNull();
    expect(futureResult.observedSensorRecords).toEqual([]);
    expect(futureResult.modelStatus.isExperimental).toBe(true);
    expect(
      futureResult.satellitePlatforms.every((p) => p.observedOnDate === null),
    ).toBe(true);
    expect(futureResult.validationSummary.validationMetrics.length).toBe(3);
    expect(futureResult.validationSummary.testMetrics.length).toBe(3);
  });
});

describe('FireCast UI & Emergency Alert System Integration', () => {
  it(
    'navigates to FireCast, displays future forecast warnings, and triggers/acknowledges the Emergency Alert System',
    async () => {
      render(<App />);

      const firecastNav = await screen.findByRole('link', { name: /^FireCast$/i });
      fireEvent.click(firecastNav);

      await waitFor(
        () => {
          expect(
            screen.getByText(
              /Explore future fire risk through satellite-based environmental analysis\./i,
            ),
          ).toBeInTheDocument();
          expect(
            screen.queryByRole('complementary', {
              name: /Global mission-control filters/i,
            }),
          ).not.toBeInTheDocument();
        },
        { timeout: 15000 },
      );

      // 1. Click Future Peak preset (2026-10-15) and verify future no-satellite-observations notice
      const futurePresetBtn = screen.getByRole('button', {
        name: /Future Peak \(2026-10-15\)/i,
      });
      fireEvent.click(futurePresetBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Future Date — No Satellite Observations Exist Yet/i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            /No NASA FIRMS satellite or sensor observations exist yet for 2026-10-15 because this date is in the future/i,
          ),
        ).toBeInTheDocument();
      });

      // 2. Click Extreme Event preset (2023-10-20) and verify Emergency Alert System activates
      const extremePresetBtn = screen.getByRole('button', {
        name: /Extreme Event \(2023-10-20\)/i,
      });
      fireEvent.click(extremePresetBtn);

      await waitFor(() => {
        expect(
          screen.getByTestId('emergency-alert-banner'),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/EXTREME FIRE RISK ALERT/i),
        ).toBeInTheDocument();
      });

      // 3. Test Mute / Stop Sound button
      const muteBtn = screen.getByRole('button', {
        name: /Mute \/ Stop Sound/i,
      });
      fireEvent.click(muteBtn);
      expect(screen.getByText(/Sound Muted \(Replay\)/i)).toBeInTheDocument();

      // 4. Test Acknowledge & Stop Alarm button
      const ackBtn = screen.getByRole('button', {
        name: /Acknowledge & Stop Alarm/i,
      });
      fireEvent.click(ackBtn);

      await waitFor(() => {
        expect(
          screen.getByTestId('alert-acknowledged-badge'),
        ).toBeInTheDocument();
      });

      // 5. Test Manual Active Hazard Reporting workflow
      const submitHazardBtn = screen.getByRole('button', {
        name: /Trigger Emergency Hazard Alert/i,
      });
      fireEvent.click(submitHazardBtn);

      await waitFor(() => {
        expect(
          screen.getByTestId('emergency-alert-banner'),
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            /EXTREME FIRE RISK ALERT — ACTIVE FIRE HAZARD REPORTED/i,
          ),
        ).toBeInTheDocument();
      });
    },
    25000,
  );
});
