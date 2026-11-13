import type { OverviewKpis } from '../../data/selectors';
import type { MetricFilter, SensorFilter } from '../../store/useFilterStore';

export interface KPIStripProps {
  kpis: OverviewKpis;
  sensor: SensorFilter;
  metric: MetricFilter;
}

export function KPIStrip({ kpis, sensor, metric }: KPIStripProps) {
  const unitLabel = metric === 'count' ? 'hotspots' : 'MW';

  return (
    <div
      className="tabular-nums"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
        gap: '10px',
      }}
    >
      {/* 1. Harmonized Hotspots */}
      <div
        style={{
          backgroundColor: 'rgba(11, 18, 32, 0.72)',
          border: '1px solid var(--border-line)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 13px',
        }}
      >
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Harmonized fire clusters
        </div>
        <div
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            color: 'var(--text-bright)',
            marginTop: '2px',
          }}
        >
          {kpis.totalMerged.toLocaleString()}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Across {kpis.activeDaysCount.toLocaleString()} observed days
        </div>
      </div>

      {/* 2. Integrated Radiative Power */}
      <div
        style={{
          backgroundColor: 'rgba(11, 18, 32, 0.72)',
          border: '1px solid var(--border-line)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 13px',
        }}
      >
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Cumulative radiative power
        </div>
        <div
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            color: '#FFC247',
            marginTop: '2px',
          }}
        >
          {(kpis.totalFrpMw / 1000).toFixed(1)}k MW
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {Math.round(kpis.meanHighConfShare * 100)}% high-confidence tier
        </div>
      </div>

      {/* 3. MODIS vs VIIRS Sensor Split */}
      <div
        style={{
          backgroundColor: 'rgba(11, 18, 32, 0.72)',
          border: '1px solid var(--border-line)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 13px',
        }}
      >
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Raw sensor detections
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            marginTop: '2px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--sensor-modis)' }}>
            {kpis.totalModis.toLocaleString()} MODIS
          </span>
          <span style={{ color: 'var(--text-subtle)' }}>·</span>
          <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--sensor-viirs)' }}>
            {kpis.totalViirs.toLocaleString()} VIIRS
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          VIIRS / MODIS ratio: {kpis.viirsToModisRatio}x
        </div>
      </div>

      {/* 4. Peak Activity & Anomaly Days */}
      <div
        style={{
          backgroundColor: 'rgba(11, 18, 32, 0.72)',
          border: '1px solid var(--border-line)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 13px',
        }}
      >
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Peak daily {sensor} ({unitLabel})
        </div>
        <div
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            color: 'var(--text-bright)',
            marginTop: '2px',
          }}
        >
          {kpis.peakValue.toLocaleString()}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Peak on {kpis.peakDate ?? '—'} · {kpis.anomalyDaysCount} anomaly days (≥2σ)
        </div>
      </div>
    </div>
  );
}
