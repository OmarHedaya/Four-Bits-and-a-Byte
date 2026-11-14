import { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCircle2, AlertCircle, GitMerge, ShieldCheck, Satellite } from 'lucide-react';
import { DESIGN_TOKENS, PLACEHOLDERS } from '../config/placeholders';
import type { ValidationData } from '../contracts/schemas';
import { FIRESCOPE_BUNDLE } from '../data/firescopeBundle';
import { Badge, Button, Card } from '../components/ui';

export interface MethodPageProps {
  validation: ValidationData;
  isDemoData: boolean;
}

const PIPELINE_STEPS = [
  {
    step: 'Phase 1–2',
    title: 'Archive Audit & Quality Cleaning',
    summary:
      'Audits and cleans 254,175 NASA FIRMS rows across Egypt (2023–2025) from 4 instruments (MODIS, S-NPP, NOAA-20, NOAA-21), validating coordinates, UTC timestamps, FRP, and sensor type codes.',
  },
  {
    step: 'Phase 3',
    title: '0.05° Grid & Coverage Harmonization',
    summary:
      'Maps all detections onto a common 0.05° × 0.05° (~5 km) spatial grid, normalizes confidence into 3 tiers (low, nominal, high), and builds the 1,096-day × 4-sensor coverage calendar.',
  },
  {
    step: 'Phase 4',
    title: 'Spatio-Temporal & Static Source Analysis',
    summary:
      'Separates 84,689 Type 0 vegetation fire candidates from 168,263 Type 2 static industrial/flare detections across 267 cells, identifying 96 multi-year 95th-percentile hotspot clusters.',
  },
  {
    step: 'Phase 5–6',
    title: 'Frozen Baseline v1 FAI & Scientific Atlas',
    summary:
      'Calibrates the coverage-aware Fire Activity Index (FAI) on 337 matched calendar dates (B = 32.4975 cell-days/day) with static 3×3 exclusion (excl3x3) and generates 28 publication-grade figures.',
  },
] as const;

export function MethodPage({ validation, isDemoData }: MethodPageProps) {
  const [checksTab, setChecksTab] = useState<'phase5' | 'phase4'>('phase5');
  const confText = PLACEHOLDERS.CONF_MAPPING_TEXT;

  const scatterPoints = validation.monthly_pairs.map((pair) => ({
    month: pair.month,
    viirs: pair.viirs,
    modis: pair.modis,
    predictedModis: Math.round(pair.viirs * validation.scaling_factor),
    harmonized: pair.harmonized ?? Math.round(pair.modis * 0.52 + pair.viirs * 0.49),
  }));

  const activeChecks =
    checksTab === 'phase5'
      ? FIRESCOPE_BUNDLE.phase5_checks
      : FIRESCOPE_BUNDLE.consistency_checks;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Harmonization Pipeline Step-by-Step */}
      <Card
        heroBorder
        title="Step-by-step MODIS (1 km) & VIIRS (375 m) harmonization methodology"
        subtitle="How 254,175 multi-resolution orbital detections across Egypt (2023–2025) are unified into a 0.05° cell-day calendar and Fire Activity Index (FAI)"
        action={
          isDemoData ? (
            <Badge tone="demo">Demo data — synthetic validation benchmark</Badge>
          ) : (
            <Badge tone="modis">Validated empirical Egypt dataset · 74/74 checks passed</Badge>
          )
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            {confText.spatialTemporalRule}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
            }}
          >
            {PIPELINE_STEPS.map((s) => (
              <div
                key={s.step}
                style={{
                  backgroundColor: 'rgba(11, 18, 32, 0.72)',
                  border: '1px solid var(--border-line)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    className="tabular-nums"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xs)',
                      color: '#FFC247',
                      fontWeight: 600,
                    }}
                  >
                    {s.step}
                  </span>
                  <GitMerge size={14} color="#7E9DFF" />
                </div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-bright)' }}>
                  {s.title}
                </div>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  {s.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 2. 4-Sensor Empirical Profile Table (sensor_profile.csv) */}
      <Card
        title="4-Sensor Empirical Profile in Egypt 2023–2025 (sensor_profile.csv)"
        subtitle="Comparing MODIS (Terra/Aqua ~1,000 m) and VIIRS (S-NPP, NOAA-20, NOAA-21 ~375 m) detection composition, FRP, and coverage"
        action={<Satellite size={16} color="#3CC4C4" />}
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
                <th style={{ padding: '8px 10px' }}>Sensor Key</th>
                <th style={{ padding: '8px 10px' }}>Resolution</th>
                <th style={{ padding: '8px 10px' }}>Total Rows</th>
                <th style={{ padding: '8px 10px' }}>Type 0 (Veg)</th>
                <th style={{ padding: '8px 10px' }}>Type 2 (Static)</th>
                <th style={{ padding: '8px 10px' }}>Static Share</th>
                <th style={{ padding: '8px 10px' }}>Observed Days</th>
                <th style={{ padding: '8px 10px' }}>Veg Cell-Days</th>
                <th style={{ padding: '8px 10px' }}>Median / P95 FRP</th>
                <th style={{ padding: '8px 10px' }}>Veg Night Share</th>
              </tr>
            </thead>
            <tbody>
              {FIRESCOPE_BUNDLE.sensor_profile.map((sp) => (
                <tr
                  key={sp.sensor_key}
                  style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}
                >
                  <td style={{ padding: '8px 10px' }}>
                    <Badge tone={sp.sensor_family === 'MODIS' ? 'modis' : 'viirs'}>
                      {sp.sensor_key}
                    </Badge>
                  </td>
                  <td style={{ padding: '8px 10px' }}>{sp.nominal_resolution_m} m</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#FFF1B8' }}>
                    {sp.n_rows.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 10px', color: '#4ADE80', fontWeight: 600 }}>
                    {sp.n_type0_vegetation_candidates.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 10px', color: '#FFC247' }}>
                    {sp.n_type2_static.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {(sp.static_share_of_rows * 100).toFixed(1)}%
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {sp.observed_days} / 1,096
                  </td>
                  <td style={{ padding: '8px 10px', color: '#3CC4C4', fontWeight: 600 }}>
                    {sp.veg_cell_days.toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {sp.median_veg_frp_mw.toFixed(2)} / {sp.p95_veg_frp_mw.toFixed(1)} MW
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {(sp.veg_night_share * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 3. Statistical Validation Metrics & Scatter Plot + Confidence Mapping */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 0.85fr',
          gap: '14px',
          alignItems: 'stretch',
        }}
      >
        <Card
          title="MODIS vs VIIRS monthly pairs scatter & scaling calibration"
          subtitle={`Across ${validation.monthly_pairs.length} paired monthly aggregates in Egypt (2023–2025)`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Statistical KPI Cards */}
            <div
              className="tabular-nums"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'rgba(11, 18, 32, 0.72)',
                  border: '1px solid var(--border-line)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Daily Cell Correlation (r)
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: '#3CC4C4' }}>
                  {validation.correlation.toFixed(3)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(11, 18, 32, 0.72)',
                  border: '1px solid var(--border-line)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Scaling factor (MODIS/VIIRS)
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: '#B79CFF' }}>
                  {validation.scaling_factor.toFixed(3)}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(11, 18, 32, 0.72)',
                  border: '1px solid var(--border-line)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  3×3 Spatial Co-Occurrence
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: '#FFC247' }}>
                  52.9%
                </div>
              </div>

              {validation.rmse !== undefined && (
                <div
                  style={{
                    backgroundColor: 'rgba(11, 18, 32, 0.72)',
                    border: '1px solid var(--border-line)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Monthly RMSE
                  </div>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-bright)' }}>
                    {validation.rmse.toFixed(1)}
                  </div>
                </div>
              )}
            </div>

            {/* Scatter Chart */}
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 16, bottom: 16, left: 6 }}>
                  <CartesianGrid stroke="#26344D" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="viirs"
                    name="VIIRS monthly detections"
                    stroke="#8FA0BA"
                    tick={{ fill: '#8FA0BA', fontSize: 11 }}
                    label={{
                      value: 'VIIRS 375 m monthly detections (S-NPP + NOAA-20 + NOAA-21)',
                      position: 'insideBottom',
                      offset: -8,
                      fill: '#B79CFF',
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="modis"
                    name="MODIS monthly detections"
                    stroke="#8FA0BA"
                    tick={{ fill: '#8FA0BA', fontSize: 11 }}
                    label={{
                      value: 'MODIS 1 km detections',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#3CC4C4',
                      fontSize: 11,
                    }}
                  />
                  <RechartsTooltip
                    cursor={{ strokeDasharray: '3 3', stroke: '#98A8C2' }}
                    contentStyle={{
                      backgroundColor: 'rgba(11, 18, 32, 0.96)',
                      border: '1px solid rgba(255, 194, 71, 0.45)',
                      borderRadius: '8px',
                      color: '#E6ECF5',
                      fontSize: '12px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65)',
                    }}
                    itemStyle={{
                      color: '#E6ECF5',
                      fontWeight: 500,
                    }}
                    labelStyle={{
                      color: '#FFF1B8',
                      fontWeight: 600,
                      marginBottom: '4px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Scatter
                    name="Observed monthly pairs (VIIRS vs MODIS)"
                    data={scatterPoints}
                    fill={DESIGN_TOKENS.modis}
                  />
                  <Scatter
                    name={`Scaled VIIRS prediction (${validation.scaling_factor.toFixed(3)} × VIIRS)`}
                    data={scatterPoints.map((p) => ({
                      viirs: p.viirs,
                      modis: p.predictedModis,
                    }))}
                    fill={DESIGN_TOKENS.viirs}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Confidence Mapping Table */}
        <Card
          title="Cross-sensor confidence mapping & thresholds"
          subtitle="Translating MODIS continuous % and VIIRS categorical classes"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {confText.summary}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {confText.tiers.map((t) => (
                <div
                  key={t.code}
                  style={{
                    backgroundColor: 'rgba(11, 18, 32, 0.72)',
                    border: '1px solid var(--border-line)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600,
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-bright)',
                      }}
                    >
                      <CheckCircle2 size={14} color="#3CC4C4" />
                      {t.tier}
                    </span>
                    <Badge tone="neutral">Weight: {t.harmonizedWeight}</Badge>
                  </div>

                  <div
                    className="tabular-nums"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      fontSize: '11.5px',
                      marginTop: '2px',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--sensor-modis)' }}>MODIS:</strong> {t.modisRule}
                    </div>
                    <div>
                      <strong style={{ color: 'var(--sensor-viirs)' }}>VIIRS:</strong> {t.viirsRule}
                    </div>
                  </div>

                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {t.treatment}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* 4. Automated 74/74 Scientific Verification Checks */}
      <Card
        title="Automated Pipeline Verification Suite (74 / 74 Checks Passed)"
        subtitle="Mathematical & data-integrity invariants verified across Phase 4 (consistency_checks.csv) and Phase 5 (phase5_checks.csv)"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              size="sm"
              variant={checksTab === 'phase5' ? 'primary' : 'secondary'}
              onClick={() => setChecksTab('phase5')}
            >
              Phase 5 FAI Checks (53/53)
            </Button>
            <Button
              size="sm"
              variant={checksTab === 'phase4' ? 'primary' : 'secondary'}
              onClick={() => setChecksTab('phase4')}
            >
              Phase 4 Analysis Checks (21/21)
            </Button>
          </div>
        }
      >
        <div
          style={{
            maxHeight: '280px',
            overflowY: 'auto',
            border: '1px solid var(--border-line)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(8, 13, 24, 0.78)',
          }}
        >
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
                  position: 'sticky',
                  top: 0,
                  backgroundColor: '#131C2E',
                }}
              >
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 12px' }}>Verification Invariant</th>
                <th style={{ padding: '8px 12px' }}>Empirical Detail</th>
              </tr>
            </thead>
            <tbody>
              {activeChecks.map((chk, idx) => (
                <tr
                  key={idx}
                  style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}
                >
                  <td style={{ padding: '7px 12px', width: '90px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        color: chk.passed ? '#4ADE80' : '#F26B2D',
                        fontWeight: 600,
                      }}
                    >
                      <ShieldCheck size={14} />
                      {chk.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </td>
                  <td style={{ padding: '7px 12px', color: 'var(--text-bright)' }}>
                    {chk.check}
                  </td>
                  <td
                    style={{
                      padding: '7px 12px',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {chk.detail !== null && chk.detail !== '' ? String(chk.detail) : 'Verified'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 5. Honest Limitations Section */}
      <Card
        title="Honest methodological & physical sensor limitations"
        subtitle="Critical orbital, atmospheric, and radiometric constraints to consider when interpreting harmonized counts"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '10px',
          }}
        >
          {confText.limitations.map((limit, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: 'rgba(11, 18, 32, 0.72)',
                border: '1px solid rgba(201, 48, 107, 0.38)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              <AlertCircle size={16} color="#FFC247" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                {limit}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
