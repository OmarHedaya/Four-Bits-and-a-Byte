import { useMemo } from 'react';
import { scaleQuantile } from 'd3-scale';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DESIGN_TOKENS } from '../../config/placeholders';
import type { SeasonalityRecord } from '../../contracts/schemas';
import type { MonthlyClimatologyPoint } from '../../data/selectors';
import type { MetricFilter } from '../../store/useFilterStore';

export interface SeasonalityMatrixChartProps {
  matrixRecords: readonly SeasonalityRecord[];
  monthlyClimatology: readonly MonthlyClimatologyPoint[];
  metric: MetricFilter;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function SeasonalityMatrixChart({
  matrixRecords,
  monthlyClimatology,
  metric,
}: SeasonalityMatrixChartProps) {
  const years = useMemo(() => {
    const s = new Set<number>();
    for (const r of matrixRecords) s.add(r.year);
    return Array.from(s).sort((a, b) => b - a);
  }, [matrixRecords]);

  const colorScale = useMemo(() => {
    const vals = matrixRecords.map((r) => (metric === 'frp' ? r.frp_sum : r.count));
    if (vals.length === 0) return () => DESIGN_TOKENS.thermalRamp[0];
    return scaleQuantile<string>()
      .domain(vals)
      .range([...DESIGN_TOKENS.thermalRamp]);
  }, [matrixRecords, metric]);

  const recordLookup = useMemo(() => {
    const map = new Map<string, SeasonalityRecord>();
    for (const r of matrixRecords) {
      map.set(`${r.year}-${r.month}`, r);
    }
    return map;
  }, [matrixRecords]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Month x Year Thermal Matrix */}
      <div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>
            Month × year seasonality matrix (
            {metric === 'frp' ? 'Monthly radiative power MW' : 'Monthly harmonized clusters'})
          </span>
          <span>Thermal ramp intensity</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table
            className="tabular-nums"
            style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: '3px',
              fontSize: '11px',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    color: 'var(--text-muted)',
                    padding: '4px 6px',
                    fontWeight: 500,
                  }}
                >
                  Year
                </th>
                {MONTHS.map((m) => (
                  <th
                    key={m}
                    style={{
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      padding: '4px',
                      fontWeight: 500,
                    }}
                  >
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((yr) => (
                <tr key={yr}>
                  <td
                    style={{
                      fontWeight: 600,
                      color: 'var(--text-bright)',
                      padding: '4px 6px',
                    }}
                  >
                    {yr}
                  </td>
                  {MONTHS.map((mLabel, mIdx) => {
                    const rec = recordLookup.get(`${yr}-${mIdx + 1}`);
                    const val = rec ? (metric === 'frp' ? rec.frp_sum : rec.count) : 0;
                    const bg = val > 0 ? colorScale(val) : DESIGN_TOKENS.thermalRamp[0];
                    const isBright =
                      bg === DESIGN_TOKENS.thermalRamp[5] ||
                      bg === DESIGN_TOKENS.thermalRamp[6];

                    return (
                      <td
                        key={mLabel}
                        title={`${mLabel} ${yr}: ${
                          metric === 'frp'
                            ? `${val.toLocaleString()} MW`
                            : `${val.toLocaleString()} harmonized hotspots`
                        }`}
                        style={{
                          backgroundColor: bg,
                          color: isBright ? '#0B1220' : '#E6ECF5',
                          textAlign: 'center',
                          padding: '6px 4px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        {metric === 'frp'
                          ? `${(val / 1000).toFixed(0)}k`
                          : val >= 1000
                            ? `${(val / 1000).toFixed(1)}k`
                            : val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. 12-Month Climatological Sensor Profile */}
      <div style={{ height: '220px', width: '100%' }}>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            marginBottom: '6px',
          }}
        >
          12-month climatological sensor profile (MODIS #3CC4C4 vs VIIRS #B79CFF vs Harmonized)
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={[...monthlyClimatology]}
            margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
          >
            <CartesianGrid stroke="#26344D" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="monthLabel"
              stroke="#8FA0BA"
              tick={{ fill: '#8FA0BA', fontSize: 11 }}
            />
            <YAxis
              stroke="#8FA0BA"
              tick={{ fill: '#8FA0BA', fontSize: 11 }}
              width={48}
            />
            <RechartsTooltip
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
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '4px' }} />
            <Bar
              dataKey="meanModis"
              name="MODIS (~1 km)"
              fill={DESIGN_TOKENS.modis}
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="meanViirs"
              name="VIIRS (~375 m)"
              fill={DESIGN_TOKENS.viirs}
              radius={[3, 3, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="meanCount"
              name="Harmonized merged"
              stroke="#FFC247"
              strokeWidth={2.2}
              dot={{ r: 3, fill: '#FFC247' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
