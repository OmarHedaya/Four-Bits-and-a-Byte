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
import { CheckCircle2, AlertCircle, GitMerge } from 'lucide-react';
import { DESIGN_TOKENS, PLACEHOLDERS } from '../config/placeholders';
import type { ValidationData } from '../contracts/schemas';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';

export interface MethodPageProps {
  validation: ValidationData;
  isDemoData: boolean;
}

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'Confidence scale normalization',
    summary:
      'Aligns MODIS Collection 6.1 continuous confidence (0–100%) with VIIRS 375 m I-band categorical classes ("l", "n", "h") into a unified 3-tier confidence taxonomy.',
  },
  {
    step: '02',
    title: 'Spatio-temporal cluster co-registration',
    summary:
      'Groups VIIRS 375 m detections falling within a 1.25 km spatial radius and ±3.5 hr overpass window of a MODIS 1 km centroid into a single deduplicated fire event cluster.',
  },
  {
    step: '03',
    title: 'Cross-sensor scaling & FRP calibration',
    summary:
      'Applies regional scaling regression (scaling_factor = 0.294) to reconcile VIIRS higher small-fire perimeter sensitivity (~3.5x raw count) against the 20+ year MODIS baseline.',
  },
  {
    step: '04',
    title: 'Climatological Z-score & risk indexing',
    summary:
      'Computes standardized daily departures (anomaly_z) relative to the multi-year regional day-of-year mean and standard deviation to flag ≥2σ unusual episodes.',
  },
] as const;

export function MethodPage({ validation, isDemoData }: MethodPageProps) {
  const confText = PLACEHOLDERS.CONF_MAPPING_TEXT;

  const scatterPoints = validation.monthly_pairs.map((pair) => ({
    month: pair.month,
    viirs: pair.viirs,
    modis: pair.modis,
    predictedModis: Math.round(pair.viirs * validation.scaling_factor),
    harmonized: pair.harmonized ?? Math.round(pair.modis * 0.52 + pair.viirs * 0.49),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Harmonization Pipeline Step-by-Step */}
      <Card
        heroBorder
        title="Step-by-step MODIS (1 km) & VIIRS (375 m) harmonization methodology"
        subtitle="How multi-resolution orbital active-fire detections are unified into a consistent climate-grade fire calendar"
        action={
          isDemoData ? (
            <Badge tone="demo">Demo data — synthetic validation benchmark</Badge>
          ) : (
            <Badge tone="modis">Validated empirical dataset</Badge>
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
                    Step {s.step}
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

      {/* 2. Statistical Validation Metrics & Scatter Plot */}
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
          subtitle={`Across ${validation.monthly_pairs.length} paired monthly aggregates (2021–2025)`}
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
                  Correlation (Pearson r)
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
                  Residual bias
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: '#FFC247' }}>
                  {validation.bias} / mo
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
                      value: 'VIIRS 375 m monthly detections',
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
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      backgroundColor: '#0B1220',
                      border: '1px solid #3B5178',
                      borderRadius: '8px',
                      color: '#E6ECF5',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Scatter
                    name="Observed monthly pairs (VIIRS vs MODIS)"
                    data={scatterPoints}
                    fill={DESIGN_TOKENS.modis}
                  />
                  <Scatter
                    name="Scaled VIIRS prediction (0.294 × VIIRS)"
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

        {/* 3. Confidence Mapping Table (CONF_MAPPING_TEXT) */}
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

      {/* 4. Honest Limitations Section */}
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
