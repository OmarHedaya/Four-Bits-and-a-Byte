import { useState } from 'react';
import { Flame, Globe, Layers } from 'lucide-react';
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
  const topClusters = FIRESCOPE_BUNDLE.hotspot_clusters.slice(0, 12);
  const topBlocks = FIRESCOPE_BUNDLE.regional_blocks_1deg.slice(0, 12);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Card
        heroBorder
        title={`Egypt Spatial Fire & Thermal Explorer — ${regionMeta?.name ?? 'All Egypt (22°N–32°N)'}`}
        subtitle="Inspect 0.05° × 0.05° (~5 km) active grid cells, 95th-percentile hotspot clusters, Type 2 static industrial sources, and 1° × 1° analytical blocks"
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
              WebGL MapLibre
            </Button>
            <Button
              size="sm"
              variant={mapEngine === 'folium' ? 'thermal' : 'secondary'}
              icon={<Layers size={13} />}
              onClick={() => setMapEngine('folium')}
            >
              Phase 6 Folium Map
            </Button>
          </div>
        }
      >
        {mapEngine === 'maplibre' ? (
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
              title="Phase 6 Interactive Spatial Map of Egypt"
              style={{ width: '100%', height: '540px', border: 'none', backgroundColor: '#fff' }}
            />
          </div>
        )}
      </Card>

      {/* Top 95th-Percentile Multi-Year Hotspot Clusters & 1° Analytical Blocks */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '14px',
        }}
      >
        <Card
          title="Top 95th-Percentile Multi-Year Hotspot Clusters (hotspot_clusters.csv)"
          subtitle="8-connected 0.05° grid cell clusters with ≥48 active cell-days across 2023–2025 (96 clusters total)"
          action={<Flame size={16} color="#F26B2D" />}
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
                  <th style={{ padding: '7px 8px' }}>Cluster ID</th>
                  <th style={{ padding: '7px 8px' }}>1° Blocks</th>
                  <th style={{ padding: '7px 8px' }}>Centroid</th>
                  <th style={{ padding: '7px 8px' }}>Cells</th>
                  <th style={{ padding: '7px 8px' }}>2023 / 24 / 25</th>
                  <th style={{ padding: '7px 8px' }}>Total</th>
                  <th style={{ padding: '7px 8px' }}>Static 3×3</th>
                </tr>
              </thead>
              <tbody>
                {topClusters.map((c) => (
                  <tr
                    key={c.cluster_id}
                    style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}
                  >
                    <td style={{ padding: '7px 8px', fontWeight: 600, color: '#FFF1B8' }}>
                      {c.cluster_id}
                    </td>
                    <td style={{ padding: '7px 8px', color: '#3CC4C4' }}>{c.block_ids}</td>
                    <td style={{ padding: '7px 8px' }}>
                      {c.centroid_lat.toFixed(2)}°N, {c.centroid_lon.toFixed(2)}°E
                    </td>
                    <td style={{ padding: '7px 8px' }}>{c.n_cells}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>
                      {c.cell_days_2023} / {c.cell_days_2024} / {c.cell_days_2025}
                    </td>
                    <td style={{ padding: '7px 8px', color: '#FFC247', fontWeight: 600 }}>
                      {c.total_cell_days.toLocaleString()}
                    </td>
                    <td style={{ padding: '7px 8px' }}>
                      <Badge
                        tone={
                          c.static_proximity_flag === 'none'
                            ? 'modis'
                            : c.static_proximity_flag === 'some_cells'
                              ? 'demo'
                              : 'anomaly'
                        }
                      >
                        {c.static_proximity_flag}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Top 1° × 1° Analytical Blocks in Egypt (regional_blocks_1deg.csv)"
          subtitle="Ranked by total VIIRS Type 0 vegetation candidate cell-days across 2023–2025 (83 blocks total)"
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
                  <th style={{ padding: '7px 8px' }}>Block ID</th>
                  <th style={{ padding: '7px 8px' }}>Active Cells</th>
                  <th style={{ padding: '7px 8px' }}>2023</th>
                  <th style={{ padding: '7px 8px' }}>2024</th>
                  <th style={{ padding: '7px 8px' }}>2025</th>
                  <th style={{ padding: '7px 8px' }}>Total</th>
                  <th style={{ padding: '7px 8px' }}>Δ 23→25</th>
                </tr>
              </thead>
              <tbody>
                {topBlocks.map((b) => (
                  <tr
                    key={b.block_id_1deg}
                    style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}
                  >
                    <td style={{ padding: '7px 8px', fontWeight: 600, color: '#FFF1B8' }}>
                      {b.block_id_1deg}
                    </td>
                    <td style={{ padding: '7px 8px' }}>{b.n_active_cells}</td>
                    <td style={{ padding: '7px 8px' }}>{b.veg_cell_days_2023.toLocaleString()}</td>
                    <td style={{ padding: '7px 8px' }}>{b.veg_cell_days_2024.toLocaleString()}</td>
                    <td style={{ padding: '7px 8px' }}>{b.veg_cell_days_2025.toLocaleString()}</td>
                    <td style={{ padding: '7px 8px', color: '#FFC247', fontWeight: 600 }}>
                      {b.veg_cell_days_total.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '7px 8px',
                        color:
                          (b.pct_change_2023_to_2025 ?? 0) < 0 ? '#4ADE80' : '#F26B2D',
                        fontWeight: 600,
                      }}
                    >
                      {b.pct_change_2023_to_2025 !== null
                        ? `${b.pct_change_2023_to_2025 > 0 ? '+' : ''}${b.pct_change_2023_to_2025.toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Recent Sensor Detections Table */}
      <Card
        title="Sampled Egypt Hotspot & Static Source Centroids (RECENT_POINTS)"
        subtitle="Comparing MODIS (~1 km) and VIIRS (~375 m S-NPP, NOAA-20, NOAA-21) detections across Egypt"
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
                <th style={{ padding: '8px 10px' }}>Sensor / Instrument</th>
                <th style={{ padding: '8px 10px' }}>1° Block</th>
                <th style={{ padding: '8px 10px' }}>Latitude</th>
                <th style={{ padding: '8px 10px' }}>Longitude</th>
                <th style={{ padding: '8px 10px' }}>FRP (MW)</th>
                <th style={{ padding: '8px 10px' }}>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {recentPoints.slice(0, 14).map((pt, idx) => (
                <tr
                  key={pt.id ?? idx}
                  style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}
                >
                  <td style={{ padding: '7px 10px' }}>{pt.date}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <Badge tone={pt.sensor === 'MODIS' ? 'modis' : 'viirs'}>
                      {pt.instrument ? `${pt.sensor} (${pt.instrument})` : pt.sensor}
                    </Badge>
                  </td>
                  <td style={{ padding: '7px 10px', color: '#3CC4C4' }}>
                    {pt.block_ids || 'Egypt'}
                  </td>
                  <td style={{ padding: '7px 10px' }}>{pt.lat.toFixed(4)}°N</td>
                  <td style={{ padding: '7px 10px' }}>{pt.lon.toFixed(4)}°E</td>
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
