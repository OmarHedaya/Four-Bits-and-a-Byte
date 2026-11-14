import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { scaleQuantile } from 'd3-scale';
import { DESIGN_TOKENS } from '../../config/placeholders';
import type { DailySummaryRecord } from '../../contracts/schemas';
import { selectDayMetricValue } from '../../data/selectors';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { MetricFilter, SensorFilter } from '../../store/useFilterStore';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

export interface CalendarHeatmapProps {
  headerTitle?: ReactNode;
  headerSubtitle?: ReactNode;
  headerAction?: ReactNode;
  records: readonly DailySummaryRecord[];
  sensor: SensorFilter;
  metric: MetricFilter;
  selectedDate: string | null;
  highlightedRange: { start: string; end: string; label?: string } | null;
  onSelectDate: (date: string | null) => void;
  onResetFilters?: () => void;
}

const MONTH_LABELS = [
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

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface DayCellMeta {
  record: DailySummaryRecord;
  year: number;
  weekIndex: number;
  dayOfWeek: number;
  value: number;
  color: string;
}

function getWeekAndDay(dateStr: string): { year: number; weekIndex: number; dayOfWeek: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const jan1 = new Date(Date.UTC(y, 0, 1));
  const jan1Dow = jan1.getUTCDay();
  const dayOfYearZeroBased = Math.floor((dt.getTime() - jan1.getTime()) / 86400000);
  const weekIndex = Math.floor((dayOfYearZeroBased + jan1Dow) / 7);
  return {
    year: y,
    weekIndex,
    dayOfWeek: dt.getUTCDay(),
  };
}

export function CalendarHeatmap({
  headerTitle,
  headerSubtitle,
  headerAction,
  records,
  sensor,
  metric,
  selectedDate,
  highlightedRange,
  onSelectDate,
  onResetFilters,
}: CalendarHeatmapProps) {
  const reducedMotion = useReducedMotion();
  const [hoveredRecord, setHoveredRecord] = useState<DailySummaryRecord | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState<boolean>(false);

  const unitLabel = useMemo(() => {
    if (metric === 'frp') return 'MW radiative power';
    if (sensor === 'modis') return 'MODIS hotspots / day';
    if (sensor === 'viirs') return 'VIIRS hotspots / day';
    return 'harmonized clusters / day';
  }, [metric, sensor]);

  // Build D3 quantile thermal color scale across positive values
  const { colorScale, quantiles } = useMemo(() => {
    const values = records
      .map((r) => selectDayMetricValue(r, sensor, metric))
      .filter((v) => v > 0);

    if (values.length === 0) {
      const fallback = () => DESIGN_TOKENS.thermalRamp[0];
      return { colorScale: fallback, quantiles: [0, 10, 25, 50, 100, 200] };
    }

    const scale = scaleQuantile<string>()
      .domain(values)
      .range([...DESIGN_TOKENS.thermalRamp]);

    const q = scale.quantiles().map((n) => Math.round(n));
    return { colorScale: scale, quantiles: q };
  }, [records, sensor, metric]);

  // Group cells by year for multi-year stacked mission-control layout
  const { yearsList, cellsByYear, flatCells } = useMemo(() => {
    const byYear = new Map<number, DayCellMeta[]>();
    const allCells: DayCellMeta[] = [];

    for (const r of records) {
      const value = selectDayMetricValue(r, sensor, metric);
      const { year, weekIndex, dayOfWeek } = getWeekAndDay(r.date);
      const color =
        value <= 0
          ? DESIGN_TOKENS.thermalRamp[0]
          : showAnomaliesOnly && r.anomaly_z < 2.0
            ? 'rgba(26, 33, 64, 0.35)'
            : colorScale(value);

      const cell: DayCellMeta = {
        record: r,
        year,
        weekIndex,
        dayOfWeek,
        value,
        color,
      };
      allCells.push(cell);
      const list = byYear.get(year) ?? [];
      list.push(cell);
      byYear.set(year, list);
    }

    const years = Array.from(byYear.keys()).sort((a, b) => b - a); // Latest year on top for rapid inspection
    return { yearsList: years, cellsByYear: byYear, flatCells: allCells };
  }, [records, sensor, metric, colorScale, showAnomaliesOnly]);

  if (records.length === 0) {
    return (
      <EmptyState
        title="No fires recorded in this period"
        description="Adjust the region or year range in the left filter rail to view harmonized MODIS and VIIRS fire activity."
        actionLabel="Reset filters"
        onAction={onResetFilters}
      />
    );
  }

  const activeInspectRecord =
    hoveredRecord ??
    (selectedDate ? records.find((r) => r.date === selectedDate) ?? null : null) ??
    records[records.length - 1];

  const handleGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (flatCells.length === 0) return;

    let nextIndex = focusedIndex;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = Math.min(flatCells.length - 1, focusedIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = Math.max(0, focusedIndex - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = Math.min(flatCells.length - 1, focusedIndex + 7);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = Math.max(0, focusedIndex - 7);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const target = flatCells[focusedIndex]?.record.date;
      if (target) {
        onSelectDate(selectedDate === target ? null : target);
      }
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onSelectDate(null);
      return;
    } else {
      return;
    }

    setFocusedIndex(nextIndex);
    setHoveredRecord(flatCells[nextIndex].record);
  };

  const cellSize = 12;
  const cellGap = 2.5;
  const step = cellSize + cellGap;
  const leftMargin = 32;
  const topMargin = 18;
  const svgWidth = leftMargin + 54 * step + 8;
  const svgHeight = topMargin + 7 * step + 4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Sticky Top Header, Intensity Scale & Live Day Inspector inside the Calendar Section */}
      <div
        style={{
          position: 'sticky',
          top: '63px',
          zIndex: 30,
          background:
            'linear-gradient(180deg, rgba(11, 18, 32, 0.96) 0%, rgba(15, 22, 38, 0.95) 100%)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)',
          borderBottom: '1px solid rgba(255, 214, 138, 0.16)',
          boxShadow: '0 10px 28px rgba(4, 7, 15, 0.6)',
          padding: '13px 18px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {(headerTitle || headerSubtitle || headerAction) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(255, 214, 138, 0.12)',
              flexWrap: 'wrap',
            }}
          >
            <div>
              {headerTitle && (
                <h2
                  style={{
                    margin: 0,
                    fontSize: 'var(--text-base)',
                    fontWeight: 600,
                    color: 'var(--text-bright)',
                    lineHeight: 1.35,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {headerTitle}
                </h2>
              )}
              {headerSubtitle && (
                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                  }}
                >
                  {headerSubtitle}
                </p>
              )}
            </div>
            {headerAction && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {headerAction}
              </div>
            )}
          </div>
        )}

        {/* Top Controls & Quantitative Thermal Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: 'rgba(11, 18, 32, 0.72)',
            border: '1px solid var(--border-line)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Intensity scale ({unitLabel}):
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                0
              </span>
              {DESIGN_TOKENS.thermalRamp.map((hex, idx) => (
                <span
                  key={hex}
                  title={
                    idx === 0
                      ? 'Baseline / low activity'
                      : `>= ${quantiles[idx - 1]?.toLocaleString() ?? 0} ${unitLabel}`
                  }
                  style={{
                    width: '18px',
                    height: '11px',
                    borderRadius: '2px',
                    backgroundColor: hex,
                    border: '1px solid rgba(255,255,255,0.12)',
                    display: 'inline-block',
                  }}
                />
              ))}
              <span className="tabular-nums" style={{ fontSize: '11px', color: '#FFF1B8', fontWeight: 600 }}>
                ≥{quantiles[quantiles.length - 1]?.toLocaleString() ?? 100}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              size="sm"
              variant={showAnomaliesOnly ? 'thermal' : 'secondary'}
              active={showAnomaliesOnly}
              onClick={() => setShowAnomaliesOnly((v) => !v)}
            >
              {showAnomaliesOnly ? 'Showing ≥2σ anomalies only' : 'Highlight ≥2σ anomaly days'}
            </Button>
            {selectedDate && (
              <Button size="sm" variant="ghost" onClick={() => onSelectDate(null)}>
                Clear day ({selectedDate})
              </Button>
            )}
          </div>
        </div>

        {/* Live Day Inspector / Tooltip Bar (MODIS vs VIIRS vs Harmonized Merged) */}
        {activeInspectRecord && (
          <div
            aria-live="polite"
            className="tabular-nums"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              backgroundColor: 'rgba(11, 18, 32, 0.9)',
              border: `1px solid ${
                activeInspectRecord.anomaly_z >= 2.0 ? '#F26B2D' : 'rgba(93, 123, 222, 0.35)'
              }`,
              borderRadius: 'var(--radius-md)',
              padding: '9px 14px',
              fontSize: 'var(--text-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-bright)' }}>
                {activeInspectRecord.date}
              </span>
              {selectedDate === activeInspectRecord.date && (
                <Badge tone="demo">Locked filter date</Badge>
              )}
              {activeInspectRecord.anomaly_z >= 2.0 && (
                <Badge tone="anomaly">
                  Unusual activity: +{activeInspectRecord.anomaly_z.toFixed(2)}σ
                </Badge>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span>
                <strong style={{ color: 'var(--sensor-modis)' }}>MODIS:</strong>{' '}
                {activeInspectRecord.count_modis.toLocaleString()}
              </span>
              <span>
                <strong style={{ color: 'var(--sensor-viirs)' }}>VIIRS:</strong>{' '}
                {activeInspectRecord.count_viirs.toLocaleString()}
              </span>
              <span>
                <strong style={{ color: 'var(--text-bright)' }}>0.05° Cell-days:</strong>{' '}
                {activeInspectRecord.count_merged.toLocaleString()}
              </span>
              {activeInspectRecord.fai_daily !== undefined && (
                <span>
                  <strong style={{ color: '#4ADE80' }}>Daily FAI:</strong>{' '}
                  {activeInspectRecord.fai_daily !== null
                    ? activeInspectRecord.fai_daily.toFixed(1)
                    : 'Coverage gap'}
                </span>
              )}
              <span>
                <strong style={{ color: '#FFC247' }}>Total FRP:</strong>{' '}
                {activeInspectRecord.total_frp.toLocaleString()} MW
              </span>
              <span>
                <strong style={{ color: 'var(--text-muted)' }}>Nom+High conf:</strong>{' '}
                {Math.round(activeInspectRecord.high_conf_share * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Multi-Year SVG Calendar Grid */}
      <div
        role="grid"
        tabIndex={0}
        aria-label={`Multi-year fire activity calendar heatmap colored by ${unitLabel}. Use arrow keys to navigate days and Enter to select a date.`}
        onKeyDown={handleGridKeyDown}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          overflowX: 'auto',
          padding: '14px 18px 16px',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {yearsList.map((year) => {
          const yearCells = cellsByYear.get(year) ?? [];
          const yearTotalMerged = yearCells.reduce((a, c) => a + c.record.count_merged, 0);
          const yearTotalFrp = yearCells.reduce((a, c) => a + c.record.total_frp, 0);

          return (
            <div
              key={year}
              role="rowgroup"
              aria-label={`Year ${year}`}
              style={{
                backgroundColor: 'rgba(11, 18, 32, 0.58)',
                border: '1px solid rgba(38, 52, 77, 0.7)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
              }}
            >
              <div
                className="tabular-nums"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                  fontSize: 'var(--text-xs)',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-bright)' }}>
                  {year}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {yearTotalMerged.toLocaleString()} harmonized hotspots ·{' '}
                  {(yearTotalFrp / 1000).toFixed(1)}k MW
                </span>
              </div>

              <svg
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
              >
                {/* Month Headers along top of each year */}
                {MONTH_LABELS.map((mLabel, mIdx) => {
                  const approxWeek = Math.floor((mIdx * 365.25) / 12 / 7);
                  return (
                    <text
                      key={mLabel}
                      x={leftMargin + approxWeek * step}
                      y={12}
                      fill="#8FA0BA"
                      fontSize="10"
                      fontFamily="var(--font-sans)"
                    >
                      {mLabel}
                    </text>
                  );
                })}

                {/* Day-of-week labels (Mon, Wed, Fri) */}
                {[1, 3, 5].map((dow) => (
                  <text
                    key={DAY_LABELS[dow]}
                    x={2}
                    y={topMargin + dow * step + 9}
                    fill="#8FA0BA"
                    fontSize="9.5"
                    fontFamily="var(--font-sans)"
                  >
                    {DAY_LABELS[dow]}
                  </text>
                ))}

                {/* Daily Cells */}
                {yearCells.map((cell) => {
                  const { record, weekIndex, dayOfWeek, color, value } = cell;
                  const x = leftMargin + weekIndex * step;
                  const y = topMargin + dayOfWeek * step;
                  const isSelected = selectedDate === record.date;
                  const isInHighlightWindow =
                    highlightedRange !== null &&
                    record.date >= highlightedRange.start &&
                    record.date <= highlightedRange.end;

                  return (
                    <rect
                      key={record.date}
                      role="gridcell"
                      aria-selected={isSelected}
                      aria-label={`${record.date}: ${value} ${unitLabel}, MODIS ${record.count_modis}, VIIRS ${record.count_viirs}, merged ${record.count_merged}`}
                      x={x}
                      y={y}
                      width={cellSize}
                      height={cellSize}
                      rx={2}
                      ry={2}
                      fill={color}
                      stroke={
                        isSelected
                          ? '#FFFFFF'
                          : isInHighlightWindow
                            ? '#FFC247'
                            : 'rgba(255,255,255,0.04)'
                      }
                      strokeWidth={isSelected ? 1.8 : isInHighlightWindow ? 1.2 : 0.5}
                      className={reducedMotion ? undefined : 'calendar-cell-animated'}
                      style={
                        reducedMotion
                          ? { cursor: 'pointer' }
                          : {
                              cursor: 'pointer',
                              animationDelay: `${weekIndex * 7}ms`,
                            }
                      }
                      onMouseEnter={() => setHoveredRecord(record)}
                      onClick={() =>
                        onSelectDate(selectedDate === record.date ? null : record.date)
                      }
                    >
                      <title>
                        {`${record.date} | Harmonized: ${record.count_merged} | MODIS: ${record.count_modis} | VIIRS: ${record.count_viirs} | FRP: ${record.total_frp} MW | Z: ${record.anomaly_z}σ`}
                      </title>
                    </rect>
                  );
                })}
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}
