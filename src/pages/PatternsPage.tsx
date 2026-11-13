import type {
  AnomalyRecord,
  DailySummaryRecord,
  RegionMetaRecord,
  RiskPeriodRecord,
  SeasonalityRecord,
} from '../contracts/schemas';
import type { MonthlyClimatologyPoint } from '../data/selectors';
import { useFilterStore } from '../store/useFilterStore';
import { Card } from '../components/ui/Card';
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
    const startMonth = String(risk.start_month ?? 7).padStart(2, '0');
    const endMonth = String(risk.end_month ?? 8).padStart(2, '0');
    jumpToAnomaly({
      regionId: risk.region_id,
      startDate: `2024-${startMonth}-01`,
      endDate: `2024-${endMonth}-28`,
      label: risk.window,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: '14px',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          <Card
            heroBorder
            title="Multi-year seasonality & monthly climatology"
            subtitle="Month × year thermal activity matrix and 12-month MODIS vs VIIRS seasonal regime"
          >
            <SeasonalityMatrixChart
              matrixRecords={matrixRecords}
              monthlyClimatology={monthlyClimatology}
              metric={metric}
            />
          </Card>

          <Card
            title="MODIS (1 km) vs VIIRS (375 m) vs Harmonized time series"
            subtitle="Tracking sensor detection divergence and harmonized cluster convergence across seasons"
          >
            <SensorComparisonChart
              records={dailyRecords}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </Card>
        </div>

        <Card
          title="Anomalies & high-risk periods catalog"
          subtitle="Click any episode or seasonal window to synchronize the calendar and map"
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
    </div>
  );
}
