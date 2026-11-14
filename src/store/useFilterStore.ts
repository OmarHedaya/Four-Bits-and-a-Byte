import { create } from 'zustand';
import { DATA_WINDOW } from '../config/placeholders';

const FULL_RANGE: [number, number] = [DATA_WINDOW.minYear, DATA_WINDOW.maxYear];

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type SensorFilter = 'merged' | 'modis' | 'viirs';
export type MetricFilter = 'count' | 'frp' | 'fai';
export type AudienceMode = 'responder' | 'scientist' | 'planner';

export interface FilterState {
  regionId: string;
  yearRange: [number, number];
  sensor: SensorFilter;
  metric: MetricFilter;
  selectedDate: string | null;
  highlightedRange: { start: string; end: string; label?: string } | null;
  audienceMode: AudienceMode;
  showModisPoints: boolean;
  showViirsPoints: boolean;
  showGridHeat: boolean;

  setRegionId: (regionId: string) => void;
  setYearRange: (yearRange: [number, number]) => void;
  setSensor: (sensor: SensorFilter) => void;
  setMetric: (metric: MetricFilter) => void;
  setSelectedDate: (date: string | null) => void;
  setHighlightedRange: (range: { start: string; end: string; label?: string } | null) => void;
  setAudienceMode: (mode: AudienceMode) => void;
  setShowModisPoints: (show: boolean) => void;
  setShowViirsPoints: (show: boolean) => void;
  setShowGridHeat: (show: boolean) => void;
  jumpToAnomaly: (params: {
    regionId: string;
    startDate: string;
    endDate: string;
    label: string;
  }) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  regionId: 'all',
  yearRange: FULL_RANGE,
  sensor: 'merged',
  metric: 'count',
  selectedDate: null,
  highlightedRange: null,
  audienceMode: 'scientist',
  showModisPoints: true,
  showViirsPoints: true,
  showGridHeat: true,

  setRegionId: (regionId) => set({ regionId }),
  setYearRange: (yearRange) =>
    set({
      yearRange: [
        Math.min(yearRange[0], yearRange[1]),
        Math.max(yearRange[0], yearRange[1]),
      ],
    }),
  setSensor: (sensor) => set({ sensor }),
  setMetric: (metric) => set({ metric }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setHighlightedRange: (highlightedRange) => set({ highlightedRange }),

  setAudienceMode: (audienceMode) =>
    set(() => {
      if (audienceMode === 'responder') {
        return {
          audienceMode,
          yearRange: [DATA_WINDOW.maxYear - 1, DATA_WINDOW.maxYear],
          sensor: 'merged',
          metric: 'frp',
          selectedDate: DATA_WINDOW.latestDate,
          highlightedRange: {
            start: shiftDate(DATA_WINDOW.latestDate, -(DATA_WINDOW.responderDays - 1)),
            end: DATA_WINDOW.latestDate,
            label: `Responder triage window (last ${DATA_WINDOW.responderDays} observed days)`,
          },
          showModisPoints: true,
          showViirsPoints: true,
          showGridHeat: true,
        };
      }
      if (audienceMode === 'planner') {
        return {
          audienceMode,
          yearRange: FULL_RANGE,
          sensor: 'merged',
          metric: 'count',
          selectedDate: null,
          highlightedRange: null,
          showGridHeat: true,
        };
      }
      // scientist default
      return {
        audienceMode,
        yearRange: FULL_RANGE,
        sensor: 'merged',
        metric: 'frp',
        selectedDate: null,
        highlightedRange: null,
        showModisPoints: true,
        showViirsPoints: true,
        showGridHeat: true,
      };
    }),

  setShowModisPoints: (showModisPoints) => set({ showModisPoints }),
  setShowViirsPoints: (showViirsPoints) => set({ showViirsPoints }),
  setShowGridHeat: (showGridHeat) => set({ showGridHeat }),

  jumpToAnomaly: ({ regionId, startDate, endDate, label }) => {
    const startYear = Number(startDate.slice(0, 4)) || DATA_WINDOW.minYear;
    const endYear = Number(endDate.slice(0, 4)) || DATA_WINDOW.maxYear;
    set({
      regionId,
      yearRange: [
        Math.max(DATA_WINDOW.minYear, startYear - 1),
        Math.min(DATA_WINDOW.maxYear, endYear + 1),
      ],
      selectedDate: startDate,
      highlightedRange: { start: startDate, end: endDate, label },
    });
  },

  resetFilters: () =>
    set({
      regionId: 'all',
      yearRange: FULL_RANGE,
      sensor: 'merged',
      metric: 'count',
      selectedDate: null,
      highlightedRange: null,
    }),
}));
