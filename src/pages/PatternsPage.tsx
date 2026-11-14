import { Clock, Layers, Sun } from 'lucide-react';
import type {
  AnomalyRecord,
  DailySummaryRecord,
  RegionMetaRecord,
  RiskPeriodRecord,
  SeasonalityRecord,
} from '../contracts/schemas';
import { FIRESCOPE_BUNDLE } from '../data/firescopeBundle';
import type { MonthlyClimatologyPoint } from '../data/selectors';
import { useFilterStore } from '../store/useFilterStore';
import { Card } from '../components/ui';
import { SeasonalityMatrixChart } from '../features/charts/SeasonalityMatrixChart';
import { SensorComparisonChart } from '../features/charts/SensorComparisonChart';
import { AnomalyRiskPanel } from '../features/anomalies/AnomalyRiskPanel';

export interface PatternsPageProps {
  dailyRecords: readonly DailySummaryRecord[];
  matrixRecords: readonly SeasonalityRecord[];
  monthlyClimatology: readonly MonthlyClimatologyPoint[];
  anomalies: readonly AnomalyRecord[];
  riskPeriods: readonly RiskPeriodRecord[];
  regions: readonly RegionMetaRecord[];
}

export function PatternsPage({
  dailyRecords,
  matrixRecords,
  monthlyClimatology,
  anomalies,
  riskPeriods,
  regions,
}: PatternsPageProps) {
  const metric = useFilterStore((s) => s.metric);
  const selectedDate = useFilterStore((s) => s.selectedDate);
  const highlightedRange = useFilterStore((s) => s.highlightedRange);
  const setSelectedDate = useFilterStore((s) => s.setSelectedDate);
  const jumpToAnomaly = useFilterStore((s) => s.jumpToAnomaly);

  const handleSelectRisk = (risk: RiskPeriodRecord) => {
    const startMonth = String(risk.start_month ?? 9).padStart(2, '0');
    const endMonth = String(risk.end_month ?? 10).padStart(2, '0');
    jumpToAnomaly({
      regionId: risk.region_id,
      startDate: `2024-${startMonth}-01`,
      endDate: `2024-${endMonth}-28`,
      label: risk.window,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* 1. Main Seasonality & Time-Series + Anomaly Catalog (Balanced 2-Column Grid) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '10px',
          alignItems: 'stretch',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
          <Card
            heroBorder
            title="Multi-year seasonality & monthly climatology (Egypt 2023–2025)"
            subtitle="Month × year thermal activity matrix and 12-month MODIS vs VIIRS seasonal regime peaking in September–October"
          >
            <SeasonalityMatrixChart
              matrixRecords={matrixRecords}
              monthlyClimatology={monthlyClimatology}
              metric={metric}
            />
          </Card>

          <Card
            title="MODIS (1 km) vs VIIRS (375 m) vs Harmonized daily activity"
            subtitle="Tracking multi-sensor fire activity across seasons"
          >
            <SensorComparisonChart
              records={dailyRecords}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </Card>
        </div>

        <Card
          title="Egypt Anomalies & Seasonal Regimes Catalog"
          subtitle="Click any episode or seasonal window to synchronize the calendar and map"
          style={{ height: '100%' }}
        >
          <AnomalyRiskPanel
            anomalies={anomalies}
            riskPeriods={riskPeriods}
            regions={regions}
            highlightedRange={highlightedRange}
            onSelectAnomaly={(anom) =>
              jumpToAnomaly({
                regionId: anom.region_id,
                startDate: anom.start_date,
                endDate: anom.end_date,
                label: anom.reason,
              })
            }
            onSelectRiskPeriod={handleSelectRisk}
          />
        </Card>
      </div>

      {/* 2. Daytime vs. Nighttime Fire Activity Summary */}
      <Card
        title="Daytime vs. Nighttime Fire Activity across Egypt (2023–2025)"
        subtitle="Comparing afternoon agricultural/vegetation fire activity with nighttime detections"
        action={<Sun size={16} color="#3CC4C4" />}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              className="tabular-nums"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-line)',
                    color: 'var(--text-muted)',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '6px 8px' }}>Year</th>
                  <th style={{ padding: '6px 8px' }}>Daytime Active Cells/Day</th>
                  <th style={{ padding: '6px 8px' }}>Daytime Change</th>
                  <th style={{ padding: '6px 8px' }}>Nighttime Active Cells/Day</th>
                  <th style={{ padding: '6px 8px' }}>Nighttime Change</th>
                </tr>
              </thead>
              <tbody>
                {FIRESCOPE_BUNDLE.daynightDiagnostic.map((dn) => (
                  <tr
                    key={dn.year}
                    style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}
                  >
                    <td style={{ padding: '6px 8px', fontWeight: 600, color: '#FFF1B8' }}>
                      {dn.year}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#FFC247', fontWeight: 600 }}>
                      {dn.mean_cells_with_day_detection.toFixed(1)}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#4ADE80', fontWeight: 600 }}>
                      {dn.mean_cells_with_day_detection_pct_change_vs_first_year.toFixed(1)}%
                    </td>
                    <td style={{ padding: '6px 8px', color: '#B79CFF', fontWeight: 600 }}>
                      {dn.mean_cells_with_night_detection.toFixed(1)}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#3CC4C4', fontWeight: 600 }}>
                      {dn.mean_cells_with_night_detection_pct_change_vs_first_year.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              fontSize: '11.5px',
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(11, 18, 32, 0.75)',
                border: '1px solid var(--border-line)',
                borderRadius: '8px',
                padding: '8px 10px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#FFC247',
                  fontWeight: 600,
                }}
              >
                <Clock size={13} />
                Daytime Peak (12:00–14:00 Cairo)
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: '3px' }}>
                Afternoon satellite passes capture peak agricultural &amp; vegetation burning, which
                declined by 53.2% from 2023 to 2025.
              </div>
            </div>
            <div
              style={{
                backgroundColor: 'rgba(11, 18, 32, 0.75)',
                border: '1px solid var(--border-line)',
                borderRadius: '8px',
                padding: '8px 10px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#B79CFF',
                  fontWeight: 600,
                }}
              >
                <Layers size={13} />
                Nighttime Peak (01:00–02:00 Cairo)
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: '3px' }}>
                Overnight satellite passes capture smoldering field fires and persistent industrial
                heat sources.
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
