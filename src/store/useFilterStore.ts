import { create } from 'zustand';

export type SensorFilter = 'merged' | 'modis' | 'viirs';
export type MetricFilter = 'count' | 'frp';
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
  yearRange: [2023, 2025],
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
          yearRange: [2024, 2025],
          sensor: 'merged',
          metric: 'frp',
          selectedDate: '2025-10-12',
          highlightedRange: {
            start: '2025-10-01',
            end: '2025-10-28',
            label: 'Responder triage window (Oct 2025 Nile Delta autumn peak)',
          },
          showModisPoints: true,
          showViirsPoints: true,
          showGridHeat: true,
        };
      }
      if (audienceMode === 'planner') {
        return {
          audienceMode,
          yearRange: [2023, 2025],
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
        yearRange: [2023, 2025],
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
    const startYear = Number(startDate.slice(0, 4)) || 2023;
    const endYear = Number(endDate.slice(0, 4)) || 2025;
    set({
      regionId,
      yearRange: [Math.max(2023, startYear), Math.min(2025, Math.max(endYear, startYear))],
      selectedDate: startDate,
      highlightedRange: { start: startDate, end: endDate, label },
    });
  },

  resetFilters: () =>
    set({
      regionId: 'all',
      yearRange: [2023, 2025],
      sensor: 'merged',
      metric: 'count',
      selectedDate: null,
      highlightedRange: null,
    }),
}));
