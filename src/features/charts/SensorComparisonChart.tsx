import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DESIGN_TOKENS } from '../../config/placeholders';
import type { DailySummaryRecord } from '../../contracts/schemas';

export interface SensorComparisonChartProps {
  records: readonly DailySummaryRecord[];
  selectedDate: string | null;
  onSelectDate?: (date: string) => void;
}

export function SensorComparisonChart({
  records,
  selectedDate,
  onSelectDate,
}: SensorComparisonChartProps) {
  // Downsample to weekly/bi-weekly buckets when multi-year > 400 days so chart stays crisp & fast
  const chartSeries = useMemo(() => {
    if (records.length <= 400) {
      return records.map((r) => ({
        date: r.date,
        modis: r.count_modis,
        viirs: r.count_viirs,
        merged: r.count_merged,
        frp: r.total_frp,
      }));
    }

    const bucketSize = 7;
    const sampled: Array<{
      date: string;
      modis: number;
      viirs: number;
      merged: number;
      frp: number;
    }> = [];

    for (let i = 0; i < records.length; i += bucketSize) {
      const slice = records.slice(i, i + bucketSize);
      const divisor = Math.max(1, slice.length);
      sampled.push({
        date: slice[0].date,
        modis: Math.round(slice.reduce((a, r) => a + r.count_modis, 0) / divisor),
        viirs: Math.round(slice.reduce((a, r) => a + r.count_viirs, 0) / divisor),
        merged: Math.round(slice.reduce((a, r) => a + r.count_merged, 0) / divisor),
        frp: Number((slice.reduce((a, r) => a + r.total_frp, 0) / divisor).toFixed(1)),
      });
    }
    return sampled;
  }, [records]);

  return (
    <div style={{ height: '235px', width: '100%' }}>
      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          marginBottom: '6px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          MODIS (#3CC4C4) vs VIIRS (#B79CFF) vs Harmonized merged time series
        </span>
        <span>
          {records.length > 400 ? '7-day mean daily rate' : 'Daily resolution'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartSeries}
          margin={{ top: 8, right: 12, left: 0, bottom: 12 }}
          onClick={(state) => {
            if (state && state.activeLabel && onSelectDate) {
              onSelectDate(String(state.activeLabel));
            }
          }}
        >
          <defs>
            <linearGradient id="gradViirs" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={DESIGN_TOKENS.viirs} stopOpacity={0.32} />
              <stop offset="95%" stopColor={DESIGN_TOKENS.viirs} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradModis" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={DESIGN_TOKENS.modis} stopOpacity={0.35} />
              <stop offset="95%" stopColor={DESIGN_TOKENS.modis} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#26344D" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#8FA0BA"
            tick={{ fill: '#8FA0BA', fontSize: 11 }}
            minTickGap={36}
          />
          <YAxis
            stroke="#8FA0BA"
            tick={{ fill: '#8FA0BA', fontSize: 11 }}
            width={48}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: '#0B1220',
              border: '1px solid #3B5178',
              borderRadius: '8px',
              color: '#E6ECF5',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '4px' }} />
          {selectedDate && (
            <ReferenceLine
              x={selectedDate}
              stroke="#FFC247"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          )}
          <Area
            type="monotone"
            dataKey="viirs"
            name="VIIRS (375 m)"
            stroke={DESIGN_TOKENS.viirs}
            fill="url(#gradViirs)"
            strokeWidth={1.7}
          />
          <Area
            type="monotone"
            dataKey="merged"
            name="Harmonized merged"
            stroke="#FFC247"
            fill="none"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="modis"
            name="MODIS (1 km)"
            stroke={DESIGN_TOKENS.modis}
            fill="url(#gradModis)"
            strokeWidth={1.7}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
