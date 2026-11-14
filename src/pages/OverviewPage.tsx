import { useNavigate } from 'react-router-dom';
import { Satellite, ArrowRight } from 'lucide-react';
import { PLACEHOLDERS } from '../config/placeholders';
import type {
  AnomalyRecord,
  DailySummaryRecord,
  GridCellsGeoJson,
  RecentPointRecord,
  RegionMetaRecord,
  RiskPeriodRecord,
  SeasonalityRecord,
} from '../contracts/schemas';
import type { MonthlyClimatologyPoint, OverviewKpis } from '../data/selectors';
import { useFilterStore } from '../store/useFilterStore';
import { Badge, Button, Card, Tooltip } from '../components/ui';
import { CalendarHeatmap } from '../features/calendar/CalendarHeatmap';
import { KPIStrip } from '../features/calendar/KPIStrip';
import { FireMap } from '../features/map/FireMap';
import { SeasonalityMatrixChart } from '../features/charts/SeasonalityMatrixChart';
import { SensorComparisonChart } from '../features/charts/SensorComparisonChart';
import { AnomalyRiskPanel } from '../features/anomalies/AnomalyRiskPanel';
import { AudienceModeBanner } from '../features/anomalies/AudienceModeBanner';

export interface OverviewPageProps {
  dailyRecords: readonly DailySummaryRecord[];
  kpis: OverviewKpis;
  gridCells: GridCellsGeoJson;
  recentPoints: readonly RecentPointRecord[];
  matrixRecords: readonly SeasonalityRecord[];
  monthlyClimatology: readonly MonthlyClimatologyPoint[];
  anomalies: readonly AnomalyRecord[];
  riskPeriods: readonly RiskPeriodRecord[];
  regions: readonly RegionMetaRecord[];
}

export function OverviewPage({
  dailyRecords,
  kpis,
  gridCells,
  recentPoints,
  matrixRecords,
  monthlyClimatology,
  anomalies,
  riskPeriods,
  regions,
}: OverviewPageProps) {
  const navigate = useNavigate();
  const regionId = useFilterStore((s) => s.regionId);
  const yearRange = useFilterStore((s) => s.yearRange);
  const sensor = useFilterStore((s) => s.sensor);
  const metric = useFilterStore((s) => s.metric);
  const selectedDate = useFilterStore((s) => s.selectedDate);
  const highlightedRange = useFilterStore((s) => s.highlightedRange);
  const audienceMode = useFilterStore((s) => s.audienceMode);
  const showGridHeat = useFilterStore((s) => s.showGridHeat);
  const showModisPoints = useFilterStore((s) => s.showModisPoints);
  const showViirsPoints = useFilterStore((s) => s.showViirsPoints);

  const setSelectedDate = useFilterStore((s) => s.setSelectedDate);
  const setShowGridHeat = useFilterStore((s) => s.setShowGridHeat);
  const setShowModisPoints = useFilterStore((s) => s.setShowModisPoints);
  const setShowViirsPoints = useFilterStore((s) => s.setShowViirsPoints);
  const jumpToAnomaly = useFilterStore((s) => s.jumpToAnomaly);
  const resetFilters = useFilterStore((s) => s.resetFilters);

  const activeRegionMeta = regions.find((r) => r.region_id === regionId);
  const activeRegionName = activeRegionMeta?.name ?? regionId;

  const handleSelectRiskPeriod = (risk: RiskPeriodRecord) => {
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
      {/* Orbital Telemetry Header showcasing the Milky Way Satellite backdrop */}
      <section className="orbital-telemetry-banner">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <img
              src={PLACEHOLDERS.LOGO}
              alt="Orbital satellite wildfire emblem"
              width={64}
              height={64}
              style={{
                borderRadius: '14px',
                border: '1px solid rgba(255, 194, 71, 0.68)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65), 0 0 18px rgba(242, 107, 45, 0.28)',
              }}
            />
            <div>
              <div style={{ marginBottom: '6px' }}>
                <span className="orbital-pill">
                  <Satellite size={13} />
                  FireScope Egypt (2023–2025) · MODIS &amp; VIIRS (S-NPP, NOAA-20, NOAA-21)
                </span>
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 600,
                  color: 'var(--text-bright)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  textShadow: '0 2px 14px rgba(0, 0, 0, 0.75)',
                }}
              >
                Egypt Thermal Anomaly &amp;{' '}
                <span className="orbital-headline-accent">Fire Activity Monitor</span>
              </h1>
              <p
                style={{
                  margin: '5px 0 0',
                  fontSize: 'var(--text-sm)',
                  color: '#D5DFEE',
                  maxWidth: '760px',
                  textShadow: '0 1px 8px rgba(0, 0, 0, 0.8)',
                }}
              >
                Active scope: <strong style={{ color: '#FFF1B8' }}>{activeRegionName}</strong> ({yearRange[0]}–{yearRange[1]}) ·{' '}
                {dailyRecords.length.toLocaleString()} calendar days · Unified MODIS &amp; VIIRS satellite hotspot intelligence
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowRight size={14} />}
              onClick={() => navigate('/explore')}
            >
              Open Egypt map
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/patterns')}
            >
              Seasonal patterns
            </Button>
          </div>
        </div>

        {/* Multi-Year Fire Activity Trajectory Bar */}
        <div
          className="tabular-nums"
          style={{
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 214, 138, 0.18)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
            gap: '10px',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(8, 13, 24, 0.65)',
              border: '1px solid rgba(255, 194, 71, 0.32)',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Primary Hotspot Zone
            </div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: '#FFF1B8', marginTop: '2px' }}>
              Nile Delta &amp; Cairo
            </div>
            <div style={{ fontSize: '11px', color: '#8FA0BA' }}>
              Peak season: September – October
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(8, 13, 24, 0.65)',
              border: '1px solid rgba(242, 107, 45, 0.38)',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              2023 Fire Activity
            </div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: '#F26B2D', marginTop: '2px' }}>
              Index 126.0 · 14,699 active cells
            </div>
            <div style={{ fontSize: '11px', color: '#8FA0BA' }}>
              Peak month: October 2023
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(8, 13, 24, 0.65)',
              border: '1px solid rgba(183, 156, 255, 0.35)',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              2024 Fire Activity
            </div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: '#B79CFF', marginTop: '2px' }}>
              Index 98.7 · 11,099 active cells
            </div>
            <div style={{ fontSize: '11px', color: '#8FA0BA' }}>
              -23.3% compared to 2023
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(8, 13, 24, 0.65)',
              border: '1px solid rgba(60, 196, 196, 0.38)',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              2025 Fire Activity
            </div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: '#3CC4C4', marginTop: '2px' }}>
              Index 73.5 · 8,665 active cells
            </div>
            <div style={{ fontSize: '11px', color: '#4ADE80' }}>
              -40.6% decline since 2023
            </div>
          </div>
        </div>
      </section>

      {/* Audience Mode Posture Banner */}
      <AudienceModeBanner mode={audienceMode} />

      {/* 4-Card Mission-Control KPI Strip */}
      <KPIStrip kpis={kpis} sensor={sensor} metric={metric} />

      {/* Main Mission-Control Grid (.overview-grid matching frontend_plan_v2_rtl.html .mock) */}
      <div className="overview-grid">
        {/* 1. Hero Area: Unified Fire-Activity Calendar Heatmap */}
        <div className="overview-area-cal">
          <Card heroBorder noPadding>
            <CalendarHeatmap
              headerTitle="Unified fire-activity calendar"
              headerSubtitle={`${activeRegionName} · ${yearRange[0]}–${yearRange[1]} · Click any day cell to filter the spatial map & time-series`}
              headerAction={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Tooltip content="MODIS Terra/Aqua ~1 km nominal resolution">
                    <Badge tone="modis">MODIS #3CC4C4</Badge>
                  </Tooltip>
                  <Tooltip content="VIIRS S-NPP/NOAA-20 ~375 m nominal resolution">
                    <Badge tone="viirs">VIIRS #B79CFF</Badge>
                  </Tooltip>
                  <Badge tone="neutral">Mode: {audienceMode}</Badge>
                </div>
              }
              records={dailyRecords}
              sensor={sensor}
              metric={metric}
              selectedDate={selectedDate}
              highlightedRange={highlightedRange}
              onSelectDate={setSelectedDate}
              onResetFilters={resetFilters}
            />
          </Card>
        </div>

        {/* 2. Spatial Hotspot Intelligence Map */}
        <div className="overview-area-map">
          <Card
            title="Spatial hotspot intelligence map"
            subtitle="Pre-aggregated GRID_CELLS thermal layer + RECENT_POINTS sensor overlay"
            action={
              <Button size="sm" variant="primary" onClick={() => navigate('/explore')}>
                Expand map
              </Button>
            }
          >
            <FireMap
              gridCells={gridCells}
              recentPoints={recentPoints}
              dailyRecords={dailyRecords}
              regionMeta={activeRegionMeta}
              metric={metric}
              selectedDate={selectedDate}
              peakDate={kpis.peakDate}
              showGridHeat={showGridHeat}
              showModisPoints={showModisPoints}
              showViirsPoints={showViirsPoints}
              onToggleGridHeat={setShowGridHeat}
              onToggleModisPoints={setShowModisPoints}
              onToggleViirsPoints={setShowViirsPoints}
              onSelectDate={setSelectedDate}
              height={350}
            />
          </Card>
        </div>

        {/* 3. Seasonality & MODIS vs VIIRS Charts */}
        <div className="overview-area-chart">
          <Card
            title="Seasonality & MODIS vs VIIRS comparison"
            subtitle="Month × year thermal profile and multi-sensor daily detection time series"
            action={
              <Button size="sm" variant="secondary" onClick={() => navigate('/patterns')}>
                Deep dive
              </Button>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <SensorComparisonChart
                records={dailyRecords}
                selectedDate={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
              />
              <SeasonalityMatrixChart
                matrixRecords={matrixRecords}
                monthlyClimatology={monthlyClimatology}
                metric={metric}
              />
            </div>
          </Card>
        </div>

        {/* 4. Right Side Panel: Anomalies & High-Risk Periods */}
        <div className="overview-area-side">
          <Card
            title="Anomalies & high-risk periods"
            subtitle="Click any unusual episode or risk window to jump the calendar & map"
            style={{ height: '100%' }}
          >
            <AnomalyRiskPanel
              expandToFill
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
              onSelectRiskPeriod={handleSelectRiskPeriod}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
