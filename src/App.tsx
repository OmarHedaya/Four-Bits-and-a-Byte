import { lazy, Suspense, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { USE_MOCK } from './config/placeholders';
import { AppShell } from './components/layout/AppShell';
import { EmptyState } from './components/ui';
import {
  selectFilteredAnomaliesAndRisks,
  selectFilteredDailySummary,
  selectFilteredGridCells,
  selectFilteredRecentPoints,
  selectOverviewKpis,
  selectSeasonalityData,
} from './data/selectors';
import { useFireData } from './hooks/useFireData';
import { useFilterStore } from './store/useFilterStore';

import { OverviewPage } from './pages/OverviewPage';

const ExplorePage = lazy(() =>
  import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage })),
);
const PatternsPage = lazy(() =>
  import('./pages/PatternsPage').then((m) => ({ default: m.PatternsPage })),
);
const FireCastPage = lazy(() =>
  import('./pages/FireCastPage').then((m) => ({ default: m.FireCastPage })),
);
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })),
);

function WorkspaceRoutes() {
  const { status, data, error, reload } = useFireData();

  const regionId = useFilterStore((s) => s.regionId);
  const yearRange = useFilterStore((s) => s.yearRange);
  const sensor = useFilterStore((s) => s.sensor);
  const metric = useFilterStore((s) => s.metric);
  const selectedDate = useFilterStore((s) => s.selectedDate);
  const highlightedRange = useFilterStore((s) => s.highlightedRange);
  const showModisPoints = useFilterStore((s) => s.showModisPoints);
  const showViirsPoints = useFilterStore((s) => s.showViirsPoints);

  const dailyRecords = useMemo(() => {
    if (!data) return [];
    return selectFilteredDailySummary(data, { regionId, yearRange });
  }, [data, regionId, yearRange]);

  const kpis = useMemo(
    () => selectOverviewKpis(dailyRecords, sensor, metric),
    [dailyRecords, sensor, metric],
  );

  const gridCells = useMemo(() => {
    if (!data) return { type: 'FeatureCollection' as const, features: [] };
    return selectFilteredGridCells(data, regionId, selectedDate);
  }, [data, regionId, selectedDate]);

  const recentPoints = useMemo(() => {
    if (!data) return [];
    return selectFilteredRecentPoints(data, {
      regionId,
      selectedDate,
      highlightedRange,
      showModis: showModisPoints,
      showViirs: showViirsPoints,
    });
  }, [data, regionId, selectedDate, highlightedRange, showModisPoints, showViirsPoints]);

  const { matrixRecords, monthlyClimatology } = useMemo(() => {
    if (!data) return { matrixRecords: [], monthlyClimatology: [] };
    return selectSeasonalityData(data, regionId, yearRange);
  }, [data, regionId, yearRange]);

  const { anomalies, riskPeriods } = useMemo(() => {
    if (!data) return { anomalies: [], riskPeriods: [] };
    return selectFilteredAnomaliesAndRisks(data, regionId, yearRange);
  }, [data, regionId, yearRange]);

  if (status === 'loading') {
    return (
      <EmptyState
        variant="loading"
        title="Loading harmonized satellite fire records..."
        description="Fetching and validating MODIS and VIIRS datasets against the runtime contract."
      />
    );
  }

  if (status === 'error' || !data) {
    return (
      <EmptyState
        variant="error"
        title="Unable to load harmonized fire dataset"
        description={error || 'Data contract validation failed.'}
        actionLabel="Retry loading"
        onAction={reload}
      />
    );
  }

  const activeRegionMeta = data.regionMeta.find((r) => r.region_id === regionId);

  return (
    <Suspense
      fallback={
        <EmptyState
          variant="loading"
          title="Loading mission-control view..."
          description="Initializing interactive visualization module."
        />
      }
    >
      <Routes>
        <Route
          path="/"
          element={
            <OverviewPage
              dailyRecords={dailyRecords}
              kpis={kpis}
              gridCells={gridCells}
              recentPoints={recentPoints}
              matrixRecords={matrixRecords}
              monthlyClimatology={monthlyClimatology}
              anomalies={anomalies}
              riskPeriods={riskPeriods}
              regions={data.regionMeta}
            />
          }
        />
        <Route
          path="/explore"
          element={
            <ExplorePage
              gridCells={gridCells}
              recentPoints={recentPoints}
              dailyRecords={dailyRecords}
              regionMeta={activeRegionMeta}
              peakDate={kpis.peakDate}
            />
          }
        />
        <Route
          path="/patterns"
          element={
            <PatternsPage
              dailyRecords={dailyRecords}
              matrixRecords={matrixRecords}
              monthlyClimatology={monthlyClimatology}
              anomalies={anomalies}
              riskPeriods={riskPeriods}
              regions={data.regionMeta}
            />
          }
        />
        <Route
          path="/firecast"
          element={
            <FireCastPage
              dailyRecords={dailyRecords}
              gridCells={gridCells}
              recentPoints={recentPoints}
              regions={data.regionMeta}
            />
          }
        />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Suspense>
  );
}

export function App() {
  const { data } = useFireData();
  const regions = data?.regionMeta ?? [];

  return (
    <BrowserRouter>
      <AppShell regions={regions} isDemoData={USE_MOCK || Boolean(data?.isDemoData)}>
        <WorkspaceRoutes />
      </AppShell>
    </BrowserRouter>
  );
}

export default App;
