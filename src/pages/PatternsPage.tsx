import { Clock, Flame, Layers, Sun } from 'lucide-react';
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
import { Badge, Card } from '../components/ui';
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

  // Group annual FAI by series_id
  const annualBySeries = new Map<string, Record<number, number | null>>();
  for (const row of FIRESCOPE_BUNDLE.fai_yearly) {
    const cur = annualBySeries.get(row.series_id) ?? {};
    cur[row.year] = row.FAI;
    annualBySeries.set(row.series_id, cur);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Phase 5 Fire Activity Index (FAI) Multi-Series & Sensitivity Catalog */}
      <Card
        heroBorder
        title="Phase 5 Fire Activity Index (FAI) — Frozen Baseline v1 & Sensitivity Series"
        subtitle="Comparing the headline NOAA-20 ∪ S-NPP index against static-source 3×3 exclusion (excl3x3), low-confidence exclusion (excl_low), and single-sensor indices"
        action={<Badge tone="modis">Baseline v1 · Mean = 100</Badge>}
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
                <th style={{ padding: '8px 10px' }}>Series ID</th>
                <th style={{ padding: '8px 10px' }}>Role</th>
                <th style={{ padding: '8px 10px' }}>Sensors</th>
                <th style={{ padding: '8px 10px' }}>Mask / Conf</th>
                <th style={{ padding: '8px 10px' }}>Matched Days</th>
                <th style={{ padding: '8px 10px' }}>Baseline B</th>
                <th style={{ padding: '8px 10px' }}>2023 FAI</th>
                <th style={{ padding: '8px 10px' }}>2024 FAI</th>
                <th style={{ padding: '8px 10px' }}>2025 FAI</th>
                <th style={{ padding: '8px 10px' }}>Matched Δ 23→25</th>
              </tr>
            </thead>
            <tbody>
              {FIRESCOPE_BUNDLE.series_catalog.map((s) => {
                const yrFai = annualBySeries.get(s.series_id) ?? {};
                const pctChange =
                  s.matched_total_2023 > 0
                    ? ((s.matched_total_2025 - s.matched_total_2023) / s.matched_total_2023) * 100
                    : 0;
                return (
                  <tr
                    key={s.series_id}
                    style={{
                      borderBottom: '1px solid rgba(38, 52, 77, 0.45)',
                      backgroundColor:
                        s.role === 'headline' ? 'rgba(242, 107, 45, 0.08)' : undefined,
                    }}
                  >
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: '#FFF1B8' }}>
                      {s.series_id}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <Badge
                        tone={
                          s.role === 'headline'
                            ? 'anomaly'
                            : s.role.includes('sensitivity')
                              ? 'modis'
                              : 'viirs'
                        }
                      >
                        {s.role}
                      </Badge>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#3CC4C4' }}>{s.sensors}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {s.mask} / {s.confidence_rule}
                    </td>
                    <td style={{ padding: '8px 10px' }}>{s.n_matched_days}d</td>
                    <td style={{ padding: '8px 10px', color: '#FFC247', fontWeight: 600 }}>
                      {s.baseline_B.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                      {yrFai[2023] !== undefined && yrFai[2023] !== null
                        ? yrFai[2023].toFixed(1)
                        : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                      {yrFai[2024] !== undefined && yrFai[2024] !== null
                        ? yrFai[2024].toFixed(1)
                        : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: '#3CC4C4' }}>
                      {yrFai[2025] !== undefined && yrFai[2025] !== null
                        ? yrFai[2025].toFixed(1)
                        : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#4ADE80', fontWeight: 600 }}>
                      {pctChange.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 2. Main Seasonality & Time-Series + Anomaly Catalog */}
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
            title="Multi-year seasonality & monthly climatology (Egypt 2023–2025)"
            subtitle="Month × year thermal activity matrix and 12-month MODIS vs VIIRS seasonal regime peaking in September–October (SON)"
          >
            <SeasonalityMatrixChart
              matrixRecords={matrixRecords}
              monthlyClimatology={monthlyClimatology}
              metric={metric}
            />
          </Card>

          <Card
            title="MODIS (1 km) vs VIIRS (375 m) vs Harmonized 0.05° cell-days"
            subtitle="Tracking sensor detection divergence and harmonized cell-day convergence across seasons"
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

      {/* 3. Static Thermal Source Proximity & Day/Night Overpass Diagnostics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '14px',
        }}
      >
        <Card
          title="Static Thermal Source Proximity Bands (static_proximity_summary.csv)"
          subtitle="Distribution of the 3,596 active VIIRS vegetation candidate cells relative to the 267 Type 2 static thermal source cells"
          action={<Flame size={16} color="#FFC247" />}
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
                  <th style={{ padding: '7px 8px' }}>Proximity Band</th>
                  <th style={{ padding: '7px 8px' }}>Veg Cells</th>
                  <th style={{ padding: '7px 8px' }}>Cell Share</th>
                  <th style={{ padding: '7px 8px' }}>Veg Cell-Days</th>
                  <th style={{ padding: '7px 8px' }}>Cell-Day Share</th>
                  <th style={{ padding: '7px 8px' }}>Mean Days/Cell</th>
                </tr>
              </thead>
              <tbody>
                {FIRESCOPE_BUNDLE.static_proximity_summary.map((band) => (
                  <tr
                    key={band.proximity_band}
                    style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}
                  >
                    <td style={{ padding: '7px 8px', fontWeight: 600, color: '#FFF1B8' }}>
                      {band.proximity_band}
                    </td>
                    <td style={{ padding: '7px 8px' }}>{band.n_cells.toLocaleString()}</td>
                    <td style={{ padding: '7px 8px' }}>
                      {(band.share_of_cells * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '7px 8px', color: '#FFC247', fontWeight: 600 }}>
                      {band.veg_cell_days.toLocaleString()}
                    </td>
                    <td style={{ padding: '7px 8px', color: '#3CC4C4', fontWeight: 600 }}>
                      {(band.share_of_cell_days * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '7px 8px' }}>{band.mean_days_per_cell.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: '#FFF1B8' }}>Key finding:</strong> 12.9% of active grid cells
            (463 cells within a 3×3 neighborhood of static sources) account for{' '}
            <strong style={{ color: '#FFC247' }}>33.4%</strong> of all VIIRS Type 0 cell-days (15,232
            of 45,595). Excluding all 463 cells (`N20_SNPP_excl3x3_all`) still yields a{' '}
            <strong style={{ color: '#4ADE80' }}>-43.3%</strong> matched-day decline from 2023 to
            2025.
          </p>
        </Card>

        <Card
          title="Daytime vs. Nighttime Detection Asymmetry (daynight_diagnostic.csv)"
          subtitle="Headline sensor set (NOAA-20 + S-NPP) across 337 matched calendar dates per year"
          action={<Sun size={16} color="#3CC4C4" />}
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
                  <th style={{ padding: '7px 8px' }}>Year</th>
                  <th style={{ padding: '7px 8px' }}>Matched Days</th>
                  <th style={{ padding: '7px 8px' }}>Daytime Cells/Day</th>
                  <th style={{ padding: '7px 8px' }}>Day Δ vs 2023</th>
                  <th style={{ padding: '7px 8px' }}>Nighttime Cells/Day</th>
                  <th style={{ padding: '7px 8px' }}>Night Δ vs 2023</th>
                </tr>
              </thead>
              <tbody>
                {FIRESCOPE_BUNDLE.daynight_diagnostic.map((dn) => (
                  <tr
                    key={dn.year}
                    style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}
                  >
                    <td style={{ padding: '7px 8px', fontWeight: 600, color: '#FFF1B8' }}>
                      {dn.year}
                    </td>
                    <td style={{ padding: '7px 8px' }}>{dn.n_matched_days}d</td>
                    <td style={{ padding: '7px 8px', color: '#FFC247', fontWeight: 600 }}>
                      {dn.mean_cells_with_day_detection.toFixed(2)}
                    </td>
                    <td style={{ padding: '7px 8px', color: '#4ADE80', fontWeight: 600 }}>
                      {dn.mean_cells_with_day_detection_pct_change_vs_first_year.toFixed(1)}%
                    </td>
                    <td style={{ padding: '7px 8px', color: '#B79CFF', fontWeight: 600 }}>
                      {dn.mean_cells_with_night_detection.toFixed(2)}
                    </td>
                    <td style={{ padding: '7px 8px', color: '#3CC4C4', fontWeight: 600 }}>
                      {dn.mean_cells_with_night_detection_pct_change_vs_first_year.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              marginTop: '12px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              fontSize: '11.5px',
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(11, 18, 32, 0.75)',
                border: '1px solid var(--border-line)',
                borderRadius: '8px',
                padding: '9px 11px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FFC247', fontWeight: 600 }}>
                <Clock size={13} />
                Daytime Overpass (12:00–14:00 Cairo)
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: '3px' }}>
                10:00–12:00 UTC window captures 52–57% of VIIRS &amp; 70.5% of MODIS vegetation candidates; fell -53.2% by 2025.
              </div>
            </div>
            <div
              style={{
                backgroundColor: 'rgba(11, 18, 32, 0.75)',
                border: '1px solid var(--border-line)',
                borderRadius: '8px',
                padding: '9px 11px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#B79CFF', fontWeight: 600 }}>
                <Layers size={13} />
                Nighttime Overpass (01:00–02:00 Cairo)
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: '3px' }}>
                23:00–00:00 UTC window captures 43–47% of VIIRS candidates and 82–84% of Type 2 static thermal flares.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
