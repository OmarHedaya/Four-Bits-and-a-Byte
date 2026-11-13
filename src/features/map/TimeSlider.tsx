import { useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Sparkles } from 'lucide-react';
import type { DailySummaryRecord } from '../../contracts/schemas';
import { Button } from '../../components/ui/Button';

export interface TimeSliderProps {
  records: readonly DailySummaryRecord[];
  selectedDate: string | null;
  peakDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export function TimeSlider({
  records,
  selectedDate,
  peakDate,
  onSelectDate,
}: TimeSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const currentIndex = selectedDate
    ? Math.max(
        0,
        records.findIndex((r) => r.date === selectedDate),
      )
    : records.length - 1;

  const activeRecord = records[currentIndex] ?? records[records.length - 1];

  useEffect(() => {
    if (!isPlaying || records.length === 0) return;
    const timer = window.setInterval(() => {
      const nextIdx = (currentIndex + 1) % records.length;
      onSelectDate(records[nextIdx].date);
    }, 380);
    return () => window.clearInterval(timer);
  }, [isPlaying, currentIndex, records, onSelectDate]);

  if (records.length === 0) return null;

  return (
    <div
      className="tabular-nums"
      style={{
        backgroundColor: 'rgba(11, 18, 32, 0.85)',
        border: '1px solid var(--border-line)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsPlaying((p) => !p)}
            icon={isPlaying ? <Pause size={13} /> : <Play size={13} />}
          >
            {isPlaying ? 'Pause' : 'Play timeline'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setIsPlaying(false);
              const prev = Math.max(0, currentIndex - 1);
              onSelectDate(records[prev].date);
            }}
            title="Previous day"
          >
            <SkipBack size={13} />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setIsPlaying(false);
              const next = Math.min(records.length - 1, currentIndex + 1);
              onSelectDate(records[next].date);
            }}
            title="Next day"
          >
            <SkipForward size={13} />
          </Button>
          {peakDate && (
            <Button
              size="sm"
              variant="thermal"
              onClick={() => {
                setIsPlaying(false);
                onSelectDate(peakDate);
              }}
              icon={<Sparkles size={13} />}
            >
              Jump to peak ({peakDate})
            </Button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: 'var(--text-xs)' }}>
          <span>
            Active date:{' '}
            <strong style={{ color: 'var(--text-bright)' }}>
              {selectedDate ?? `All (${activeRecord?.date ?? ''})`}
            </strong>
          </span>
          {activeRecord && (
            <>
              <span style={{ color: 'var(--sensor-modis)' }}>
                MODIS: {activeRecord.count_modis}
              </span>
              <span style={{ color: 'var(--sensor-viirs)' }}>
                VIIRS: {activeRecord.count_viirs}
              </span>
              <span style={{ color: '#FFC247' }}>
                FRP: {activeRecord.total_frp.toLocaleString()} MW
              </span>
            </>
          )}
          {selectedDate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsPlaying(false);
                onSelectDate(null);
              }}
            >
              All dates
            </Button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {records[0].date}
        </span>
        <input
          type="range"
          aria-label="Timeline date scrubber linked to calendar"
          min={0}
          max={Math.max(0, records.length - 1)}
          value={currentIndex}
          onChange={(e) => {
            setIsPlaying(false);
            const idx = Number(e.target.value);
            if (records[idx]) {
              onSelectDate(records[idx].date);
            }
          }}
          style={{
            flex: 1,
            accentColor: '#F26B2D',
            cursor: 'pointer',
          }}
        />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {records[records.length - 1].date}
        </span>
      </div>
    </div>
  );
}
