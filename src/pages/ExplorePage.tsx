import { useMemo, useState } from 'react';
import { Globe, Layers } from 'lucide-react';
import type {
  DailySummaryRecord,
  GridCellsGeoJson,
  RecentPointRecord,
  RegionMetaRecord,
} from '../contracts/schemas';
import { FIRESCOPE_BUNDLE } from '../data/firescopeBundle';
import { useFilterStore } from '../store/useFilterStore';
import { Badge, Button, Card } from '../components/ui';
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
  const [mapEngine, setMapEngine] = useState<'maplibre' | 'folium'>('maplibre');
  const [cellFilter, setCellFilter] = useState<'all' | 'vegetation' | 'static'>('all');

  const regionId = useFilterStore((s) => s.regionId);
  const metric = useFilterStore((s) => s.metric);
  const selectedDate = useFilterStore((s) => s.selectedDate);
  const showGridHeat = useFilterStore((s) => s.showGridHeat);
  const showModisPoints = useFilterStore((s) => s.showModisPoints);
  const showViirsPoints = useFilterStore((s) => s.showViirsPoints);

  const setSelectedDate = useFilterStore((s) => s.setSelectedDate);
  const setShowGridHeat = useFilterStore((s) => s.setShowGridHeat);
  const setShowModisPoints = useFilterStore((s) => s.setShowModisPoints);
  const setShowViirsPoints = useFilterStore((s) => s.setShowViirsPoints);

  // Merge vegetation gridCells with industrial/gas-flare thermal cells when requested
  const displayedGridCells = useMemo<GridCellsGeoJson>(() => {
    const staticFeatures = FIRESCOPE_BUNDLE.staticCellFeatures.filter(
      (f) => regionId === 'all' || f.properties.region_id === regionId,
    );
    if (cellFilter === 'vegetation') {
      return gridCells;
    }
    if (cellFilter === 'static') {
      return {
        type: 'FeatureCollection',
        features: staticFeatures,
      };
    }
    return {
      type: 'FeatureCollection',
      features: [...gridCells.features, ...staticFeatures],
    };
  }, [gridCells, cellFilter, regionId]);

  const modisPtsCount = recentPoints.filter((p) => p.sensor === 'MODIS').length;
  const viirsPtsCount = recentPoints.filter((p) => p.sensor === 'VIIRS').length;
  const topBlocks = FIRESCOPE_BUNDLE.topBlocks.slice(0, 12);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Card
        heroBorder
        title={`Egypt Spatial Fire & Thermal Explorer — ${regionMeta?.name ?? 'All Egypt'}`}
        subtitle="Explore active fire hotspots, agricultural burning zones, and persistent industrial heat sources across Egypt"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Badge tone="modis">{modisPtsCount} MODIS points</Badge>
            <Badge tone="viirs">{viirsPtsCount} VIIRS points</Badge>
            <Button
              size="sm"
              variant={mapEngine === 'maplibre' ? 'primary' : 'secondary'}
              icon={<Globe size={13} />}
              onClick={() => setMapEngine('maplibre')}
            >
              Interactive Satellite Map
            </Button>
            <Button
              size="sm"
              variant={mapEngine === 'folium' ? 'thermal' : 'secondary'}
              icon={<Layers size={13} />}
              onClick={() => setMapEngine('folium')}
            >
              Detailed Regional Map
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Source Type Layer Filter */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: 'var(--text-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                Heat Source Filter:
              </span>
              {(
                [
                  { id: 'all', label: 'All Heat Sources (Vegetation + Industrial)' },
                  { id: 'vegetation', label: 'Vegetation & Agricultural Fires Only' },
                  { id: 'static', label: 'Industrial & Gas Flare Sites Only' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCellFilter(opt.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '11.5px',
                    fontWeight: cellFilter === opt.id ? 600 : 500,
                    cursor: 'pointer',
                    color: cellFilter === opt.id ? '#FFF1B8' : 'var(--text-primary)',
                    backgroundColor:
                      cellFilter === opt.id
                        ? 'rgba(242, 107, 45, 0.28)'
                        : 'rgba(11, 18, 32, 0.72)',
                    border:
                      cellFilter === opt.id
                        ? '1px solid rgba(255, 194, 71, 0.65)'
                        : '1px solid var(--border-line)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Badge tone="neutral">
              {displayedGridCells.features.length.toLocaleString()} active grid cells
            </Badge>
          </div>

          {mapEngine === 'maplibre' ? (
            <FireMap
              gridCells={displayedGridCells}
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
          ) : (
            <div
              style={{
                border: '1px solid rgba(255, 194, 71, 0.45)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                backgroundColor: '#0B1220',
              }}
            >
              <iframe
                src="/visualizations/spatial/interactive_spatial_map.html"
                title="Detailed Regional Map of Egypt"
                style={{ width: '100%', height: '540px', border: 'none', backgroundColor: '#fff' }}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Regional Activity & Recent Detections Side-by-Side */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '12px',
          alignItems: 'stretch',
        }}
      >
        <Card
          title="Most Active Fire Zones in Egypt (2023–2025)"
          subtitle="Ranked by cumulative active fire cell-days across 2023, 2024, and 2025"
          action={<Layers size={16} color="#B79CFF" />}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              className="tabular-nums"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-line)',
                    color: 'var(--text-muted)',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '6px 8px' }}>Zone</th>
                  <th style={{ padding: '6px 8px' }}>Region</th>
                  <th style={{ padding: '6px 8px' }}>2023</th>
                  <th style={{ padding: '6px 8px' }}>2024</th>
                  <th style={{ padding: '6px 8px' }}>2025</th>
                  <th style={{ padding: '6px 8px' }}>Total Activity</th>
                </tr>
              </thead>
              <tbody>
                {topBlocks.map((b) => (
                  <tr
                    key={b.block_id_1deg}
                    style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}
                  >
                    <td style={{ padding: '6px 8px', fontWeight: 600, color: '#FFF1B8' }}>
                      {b.block_id_1deg}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#3CC4C4' }}>{b.label}</td>
                    <td style={{ padding: '6px 8px' }}>{b.veg_cell_days_2023.toLocaleString()}</td>
                    <td style={{ padding: '6px 8px' }}>{b.veg_cell_days_2024.toLocaleString()}</td>
                    <td style={{ padding: '6px 8px' }}>{b.veg_cell_days_2025.toLocaleString()}</td>
                    <td style={{ padding: '6px 8px', color: '#FFC247', fontWeight: 600 }}>
                      {b.veg_cell_days_total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Recent Satellite Hotspot Detections"
          subtitle="Comparing MODIS (~1 km) and VIIRS (~375 m) detections across Egypt"
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
                  <th style={{ padding: '6px 8px' }}>Date</th>
                  <th style={{ padding: '6px 8px' }}>Sensor</th>
                  <th style={{ padding: '6px 8px' }}>Coordinates</th>
                  <th style={{ padding: '6px 8px' }}>FRP (MW)</th>
                  <th style={{ padding: '6px 8px' }}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {recentPoints.slice(0, 12).map((pt, idx) => (
                  <tr
                    key={pt.id ?? idx}
                    style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}
                  >
                    <td style={{ padding: '6px 8px' }}>{pt.date}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <Badge tone={pt.sensor === 'MODIS' ? 'modis' : 'viirs'}>
                        {pt.sensor}
                      </Badge>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      {pt.lat.toFixed(3)}°N, {pt.lon.toFixed(3)}°E
                    </td>
                    <td style={{ padding: '6px 8px', color: '#FFC247', fontWeight: 600 }}>
                      {pt.frp.toFixed(1)} MW
                    </td>
                    <td style={{ padding: '6px 8px' }}>{String(pt.confidence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
