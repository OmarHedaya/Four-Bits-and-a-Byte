import type {
  DailySummaryRecord,
  GridCellsGeoJson,
  RecentPointRecord,
  RegionMetaRecord,
} from '../contracts/schemas';
import { useFilterStore } from '../store/useFilterStore';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { FireMap } from '../features/map/FireMap';

export interface ExplorePageProps {
  gridCells: GridCellsGeoJson;
  recentPoints: readonly RecentPointRecord[];
  dailyRecords: readonly DailySummaryRecord[];
  regionMeta: RegionMetaRecord | undefined;
  peakDate: string | null;
}

export function ExplorePage({
  gridCells,
  recentPoints,
  dailyRecords,
  regionMeta,
  peakDate,
}: ExplorePageProps) {
  const metric = useFilterStore((s) => s.metric);
  const selectedDate = useFilterStore((s) => s.selectedDate);
  const showGridHeat = useFilterStore((s) => s.showGridHeat);
  const showModisPoints = useFilterStore((s) => s.showModisPoints);
  const showViirsPoints = useFilterStore((s) => s.showViirsPoints);

  const setSelectedDate = useFilterStore((s) => s.setSelectedDate);
  const setShowGridHeat = useFilterStore((s) => s.setShowGridHeat);
  const setShowModisPoints = useFilterStore((s) => s.setShowModisPoints);
  const setShowViirsPoints = useFilterStore((s) => s.setShowViirsPoints);

  const modisPtsCount = recentPoints.filter((p) => p.sensor === 'MODIS').length;
  const viirsPtsCount = recentPoints.filter((p) => p.sensor === 'VIIRS').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Card
        heroBorder
        title={`Spatial fire explorer — ${regionMeta?.name ?? 'Global composite'}`}
        subtitle="Full-viewport MapLibre GL WebGL rendering of pre-aggregated GRID_CELLS thermal polygons and RECENT_POINTS sensor detections"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge tone="modis">{modisPtsCount} MODIS points</Badge>
            <Badge tone="viirs">{viirsPtsCount} VIIRS points</Badge>
          </div>
        }
      >
        <FireMap
          gridCells={gridCells}
          recentPoints={recentPoints}
          dailyRecords={dailyRecords}
          regionMeta={regionMeta}
          metric={metric}
          selectedDate={selectedDate}
          peakDate={peakDate}
          showGridHeat={showGridHeat}
          showModisPoints={showModisPoints}
          showViirsPoints={showViirsPoints}
          onToggleGridHeat={setShowGridHeat}
          onToggleModisPoints={setShowModisPoints}
          onToggleViirsPoints={setShowViirsPoints}
          onSelectDate={setSelectedDate}
          height={540}
        />
      </Card>

      {/* Recent Sensor Detections Table */}
      <Card
        title="Sampled individual hotspot detections (RECENT_POINTS)"
        subtitle="Comparing MODIS (1 km) and VIIRS (375 m) pixel-level radiative power and harmonized confidence tier"
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            className="tabular-nums"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--text-xs)',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-line)',
                  color: 'var(--text-muted)',
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: '8px 10px' }}>Date</th>
                <th style={{ padding: '8px 10px' }}>Sensor</th>
                <th style={{ padding: '8px 10px' }}>Latitude</th>
                <th style={{ padding: '8px 10px' }}>Longitude</th>
                <th style={{ padding: '8px 10px' }}>FRP (MW)</th>
                <th style={{ padding: '8px 10px' }}>Harmonized confidence</th>
              </tr>
            </thead>
            <tbody>
              {recentPoints.slice(0, 12).map((pt, idx) => (
                <tr
                  key={pt.id ?? idx}
                  style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}
                >
                  <td style={{ padding: '7px 10px' }}>{pt.date}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <Badge tone={pt.sensor === 'MODIS' ? 'modis' : 'viirs'}>
                      {pt.sensor}
                    </Badge>
                  </td>
                  <td style={{ padding: '7px 10px' }}>{pt.lat.toFixed(4)}°</td>
                  <td style={{ padding: '7px 10px' }}>{pt.lon.toFixed(4)}°</td>
                  <td style={{ padding: '7px 10px', color: '#FFC247', fontWeight: 600 }}>
                    {pt.frp.toFixed(1)} MW
                  </td>
                  <td style={{ padding: '7px 10px' }}>{String(pt.confidence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
