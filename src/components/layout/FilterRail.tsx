import { RotateCcw, Calendar, Flame, Layers } from 'lucide-react';
import { DESIGN_TOKENS } from '../../config/placeholders';
import type { RegionMetaRecord } from '../../contracts/schemas';
import {
  useFilterStore,
  type MetricFilter,
  type SensorFilter,
} from '../../store/useFilterStore';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { SegmentedToggle, type ToggleOption } from '../ui/Toggle';

export interface FilterRailProps {
  regions: readonly RegionMetaRecord[];
}

const SENSOR_OPTIONS: ReadonlyArray<ToggleOption<SensorFilter>> = [
  { value: 'merged', label: 'Harmonized' },
  { value: 'modis', label: 'MODIS', dotColor: DESIGN_TOKENS.modis },
  { value: 'viirs', label: 'VIIRS', dotColor: DESIGN_TOKENS.viirs },
];

const METRIC_OPTIONS: ReadonlyArray<ToggleOption<MetricFilter>> = [
  { value: 'count', label: 'Hotspot count' },
  { value: 'frp', label: 'Radiative power (MW)' },
];

const AVAILABLE_YEARS = ['2021', '2022', '2023', '2024', '2025'] as const;

export function FilterRail({ regions }: FilterRailProps) {
  const regionId = useFilterStore((s) => s.regionId);
  const yearRange = useFilterStore((s) => s.yearRange);
  const sensor = useFilterStore((s) => s.sensor);
  const metric = useFilterStore((s) => s.metric);
  const selectedDate = useFilterStore((s) => s.selectedDate);
  const highlightedRange = useFilterStore((s) => s.highlightedRange);
  const audienceMode = useFilterStore((s) => s.audienceMode);

  const setRegionId = useFilterStore((s) => s.setRegionId);
  const setYearRange = useFilterStore((s) => s.setYearRange);
  const setSensor = useFilterStore((s) => s.setSensor);
  const setMetric = useFilterStore((s) => s.setMetric);
  const setSelectedDate = useFilterStore((s) => s.setSelectedDate);
  const setHighlightedRange = useFilterStore((s) => s.setHighlightedRange);
  const resetFilters = useFilterStore((s) => s.resetFilters);

  const selectedRegionMeta = regions.find((r) => r.region_id === regionId);

  return (
    <aside
      aria-label="Global mission-control filters"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-line)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--border-line)',
        }}
      >
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          Mission controls
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={resetFilters}
          icon={<RotateCcw size={13} />}
          title="Reset all filters to default multi-year view"
        >
          Reset
        </Button>
      </div>

      {/* 1. Region Filter */}
      <Select
        label="Monitored region"
        value={regionId}
        onChange={setRegionId}
        options={regions.map((r) => ({
          value: r.region_id,
          label: r.name,
        }))}
        helperText={selectedRegionMeta?.biome}
      />

      {/* 2. Year Range Filter */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <Select
          label="Start year"
          value={String(yearRange[0])}
          onChange={(v) => setYearRange([Number(v), yearRange[1]])}
          options={AVAILABLE_YEARS.map((y) => ({ value: y, label: y }))}
        />
        <Select
          label="End year"
          value={String(yearRange[1])}
          onChange={(v) => setYearRange([yearRange[0], Number(v)])}
          options={AVAILABLE_YEARS.map((y) => ({ value: y, label: y }))}
        />
      </div>

      {/* 3. Sensor Selection */}
      <SegmentedToggle
        label="Sensor stream"
        options={SENSOR_OPTIONS}
        value={sensor}
        onChange={setSensor}
        size="sm"
        fullWidth
      />

      {/* 4. Metric Selection */}
      <SegmentedToggle
        label="Intensity metric"
        options={METRIC_OPTIONS}
        value={metric}
        onChange={setMetric}
        size="sm"
        fullWidth
      />

      {/* Active Date / Anomaly Selection Status */}
      {(selectedDate || highlightedRange) && (
        <div
          style={{
            backgroundColor: 'rgba(242, 107, 45, 0.12)',
            border: '1px solid #F26B2D',
            borderRadius: 'var(--radius-md)',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: '#FFC247',
              }}
            >
              <Calendar size={13} />
              Active focus
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedDate(null);
                setHighlightedRange(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              Clear
            </button>
          </div>

          {selectedDate && (
            <div className="tabular-nums" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              Day: {selectedDate}
            </div>
          )}

          {highlightedRange && (
            <div
              className="tabular-nums"
              style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}
            >
              <div>
                Window: {highlightedRange.start} → {highlightedRange.end}
              </div>
              {highlightedRange.label && (
                <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>
                  {highlightedRange.label}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sensor & Thermal Color Reference Key */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-line)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Layers size={13} />
          <span>Sensor legend (lines &amp; badges)</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: DESIGN_TOKENS.modis,
                }}
              />
              <span style={{ color: 'var(--text-primary)' }}>MODIS</span>
            </span>
            <span className="tabular-nums">~1 km · Terra/Aqua</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: DESIGN_TOKENS.viirs,
                }}
              />
              <span style={{ color: 'var(--text-primary)' }}>VIIRS</span>
            </span>
            <span className="tabular-nums">~375 m · S-NPP/NOAA</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>
            <Flame size={13} color="#F26B2D" />
            <span>Thermal intensity ramp</span>
          </div>
          <div
            aria-label="Thermal intensity color scale from low indigo to peak pale yellow"
            style={{
              height: '10px',
              borderRadius: '5px',
              background: 'var(--thermal-gradient)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          />
          <div
            className="tabular-nums"
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}
          >
            <span>Low activity</span>
            <span>Peak intensity</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-night)',
            border: '1px solid var(--border-line)',
            borderRadius: 'var(--radius-sm)',
            padding: '7px 9px',
            fontSize: '11px',
            lineHeight: 1.4,
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>
            Mode: {audienceMode.charAt(0).toUpperCase() + audienceMode.slice(1)}
          </strong>
          <div>
            {audienceMode === 'responder' &&
              'Emphasizes recent 2024–2025 activity, high-FRP perimeters, and active anomaly alerts.'}
            {audienceMode === 'scientist' &&
              'Emphasizes harmonized vs raw sensor counts, FRP (MW), and confidence calibration.'}
            {audienceMode === 'planner' &&
              'Emphasizes 5-year seasonal cycles and climatological high-risk planning windows.'}
          </div>
        </div>
      </div>
    </aside>
  );
}
