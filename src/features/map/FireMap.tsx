import { useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DESIGN_TOKENS, PLACEHOLDERS } from '../../config/placeholders';
import type {
  DailySummaryRecord,
  GridCellsGeoJson,
  RecentPointRecord,
  RegionMetaRecord,
} from '../../contracts/schemas';
import type { MetricFilter } from '../../store/useFilterStore';
import { Badge } from '../../components/ui/Badge';
import { SwitchToggle } from '../../components/ui/Toggle';
import { TimeSlider } from './TimeSlider';

export interface FireMapProps {
  gridCells: GridCellsGeoJson;
  recentPoints: readonly RecentPointRecord[];
  dailyRecords: readonly DailySummaryRecord[];
  regionMeta: RegionMetaRecord | undefined;
  metric: MetricFilter;
  selectedDate: string | null;
  peakDate: string | null;
  showGridHeat: boolean;
  showModisPoints: boolean;
  showViirsPoints: boolean;
  onToggleGridHeat: (show: boolean) => void;
  onToggleModisPoints: (show: boolean) => void;
  onToggleViirsPoints: (show: boolean) => void;
  onSelectDate: (date: string | null) => void;
  height?: number;
}

interface InspectedFeatureInfo {
  longitude: number;
  latitude: number;
  kind: 'cell' | 'point';
  title: string;
  subtitle: string;
  frp: number;
  count?: number;
  sensor?: 'MODIS' | 'VIIRS';
  confidence?: string | number;
  date?: string;
}

export function FireMap({
  gridCells,
  recentPoints,
  dailyRecords,
  regionMeta,
  metric,
  selectedDate,
  peakDate,
  showGridHeat,
  showModisPoints,
  showViirsPoints,
  onToggleGridHeat,
  onToggleModisPoints,
  onToggleViirsPoints,
  onSelectDate,
  height = 380,
}: FireMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [inspected, setInspected] = useState<InspectedFeatureInfo | null>(null);
  const [useFallbackStyle, setUseFallbackStyle] = useState<boolean>(false);

  // Convert filtered recentPoints into GeoJSON FeatureCollection for WebGL circle rendering
  const pointsGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: recentPoints.map((pt, idx) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [pt.lon, pt.lat],
        },
        properties: {
          id: pt.id ?? `pt-${idx}`,
          sensor: pt.sensor,
          frp: pt.frp,
          confidence: String(pt.confidence),
          date: pt.date,
          lat: pt.lat,
          lon: pt.lon,
        },
      })),
    }),
    [recentPoints],
  );

  // Inline mission-control graticule + fallback dark style if remote vector tiles fail
  const fallbackMapStyle = useMemo(
    () => ({
      version: 8 as const,
      name: 'Mission Control Dark Fallback',
      sources: {},
      layers: [
        {
          id: 'night-background',
          type: 'background' as const,
          paint: {
            'background-color': DESIGN_TOKENS.night,
          },
        },
      ],
    }),
    [],
  );

  // Fit bounds when regionMeta changes
  useEffect(() => {
    if (!mapRef.current || !regionMeta) return;
    const [minLon, minLat, maxLon, maxLat] = regionMeta.bbox;
    try {
      mapRef.current.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: 36, duration: 650 },
      );
    } catch {
      // Ignore fitBounds errors during headless test teardown
    }
  }, [regionMeta]);

  const handleMapClick = (e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) {
      setInspected(null);
      return;
    }

    const props = feature.properties ?? {};
    if (feature.layer.id === 'recent-points-layer') {
      setInspected({
        longitude: Number(props.lon ?? e.lngLat.lng),
        latitude: Number(props.lat ?? e.lngLat.lat),
        kind: 'point',
        title: `${props.sensor} active hotspot`,
        subtitle: `Location: ${Number(props.lat).toFixed(3)}°, ${Number(props.lon).toFixed(3)}°`,
        frp: Number(props.frp ?? 0),
        sensor: props.sensor as 'MODIS' | 'VIIRS',
        confidence: props.confidence,
        date: String(props.date ?? ''),
      });
    } else if (feature.layer.id === 'grid-cells-fill') {
      setInspected({
        longitude: Number(props.lon ?? e.lngLat.lng),
        latitude: Number(props.lat ?? e.lngLat.lat),
        kind: 'cell',
        title: `Grid cell ${props.cell_id}`,
        subtitle: `Month ${props.month} · Centroid ${Number(props.lat).toFixed(2)}°, ${Number(props.lon).toFixed(2)}°`,
        frp: Number(props.frp_sum ?? 0),
        count: Number(props.count ?? 0),
      });
    }
  };

  const gridValueProperty = metric === 'frp' ? 'frp_sum' : 'count';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Layer Toggles & Sensor Telemetry Bar */}
      <div
        className="tabular-nums"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          backgroundColor: 'rgba(11, 18, 32, 0.68)',
          border: '1px solid var(--border-line)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          fontSize: 'var(--text-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <SwitchToggle
            checked={showGridHeat}
            onChange={onToggleGridHeat}
            accentColor="#F26B2D"
            label={`Grid heat (${gridCells.features.length} cells)`}
          />
          <SwitchToggle
            checked={showModisPoints}
            onChange={onToggleModisPoints}
            accentColor={DESIGN_TOKENS.modis}
            label={
              <span style={{ color: DESIGN_TOKENS.modis, fontWeight: 500 }}>
                MODIS 1 km points
              </span>
            }
          />
          <SwitchToggle
            checked={showViirsPoints}
            onChange={onToggleViirsPoints}
            accentColor={DESIGN_TOKENS.viirs}
            label={
              <span style={{ color: DESIGN_TOKENS.viirs, fontWeight: 500 }}>
                VIIRS 375 m points
              </span>
            }
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge tone="neutral">{recentPoints.length.toLocaleString()} visible points</Badge>
        </div>
      </div>

      {/* MapLibre GL Canvas Container */}
      <div
        style={{
          position: 'relative',
          height: `${height}px`,
          width: '100%',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--border-line)',
          backgroundColor: DESIGN_TOKENS.night,
        }}
      >
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: 18.0,
            latitude: 22.0,
            zoom: 1.8,
          }}
          mapStyle={useFallbackStyle ? fallbackMapStyle : PLACEHOLDERS.BASEMAP_STYLE_URL}
          interactiveLayerIds={['grid-cells-fill', 'recent-points-layer']}
          onClick={handleMapClick}
          onError={() => {
            if (!useFallbackStyle) setUseFallbackStyle(true);
          }}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
        >
          <NavigationControl position="top-right" showCompass={false} />

          {/* 1. Pre-Aggregated Spatial Grid Cells Layer (Thermal Ramp) */}
          {showGridHeat && (
            <Source id="grid-cells-source" type="geojson" data={gridCells}>
              <Layer
                id="grid-cells-fill"
                type="fill"
                paint={{
                  'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['get', gridValueProperty],
                    0,
                    DESIGN_TOKENS.thermalRamp[0],
                    metric === 'frp' ? 1500 : 40,
                    DESIGN_TOKENS.thermalRamp[1],
                    metric === 'frp' ? 3500 : 90,
                    DESIGN_TOKENS.thermalRamp[2],
                    metric === 'frp' ? 6500 : 150,
                    DESIGN_TOKENS.thermalRamp[3],
                    metric === 'frp' ? 10000 : 220,
                    DESIGN_TOKENS.thermalRamp[4],
                    metric === 'frp' ? 15000 : 310,
                    DESIGN_TOKENS.thermalRamp[5],
                    metric === 'frp' ? 22000 : 420,
                    DESIGN_TOKENS.thermalRamp[6],
                  ],
                  'fill-opacity': 0.68,
                }}
              />
              <Layer
                id="grid-cells-outline"
                type="line"
                paint={{
                  'line-color': '#FFC247',
                  'line-width': 0.6,
                  'line-opacity': 0.35,
                }}
              />
            </Source>
          )}

          {/* 2. Detailed Recent Points Layer (MODIS #3CC4C4 vs VIIRS #B79CFF) */}
          <Source id="recent-points-source" type="geojson" data={pointsGeoJson}>
            <Layer
              id="recent-points-layer"
              type="circle"
              paint={{
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['get', 'frp'],
                  10,
                  3.5,
                  80,
                  6,
                  200,
                  9.5,
                ],
                'circle-color': [
                  'match',
                  ['get', 'sensor'],
                  'MODIS',
                  DESIGN_TOKENS.modis,
                  'VIIRS',
                  DESIGN_TOKENS.viirs,
                  '#FFC247',
                ],
                'circle-opacity': 0.86,
                'circle-stroke-width': 1.2,
                'circle-stroke-color': '#0B1220',
              }}
            />
          </Source>

          {/* Interactive Feature Popup */}
          {inspected && (
            <Popup
              longitude={inspected.longitude}
              latitude={inspected.latitude}
              anchor="bottom"
              onClose={() => setInspected(null)}
              closeOnClick={false}
            >
              <div
                className="tabular-nums"
                style={{
                  backgroundColor: '#0B1220',
                  color: '#E6ECF5',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  minWidth: '180px',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>{inspected.title}</div>
                <div style={{ color: '#8FA0BA', fontSize: '11px', marginBottom: '6px' }}>
                  {inspected.subtitle}
                </div>
                {inspected.kind === 'point' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div>
                      Sensor:{' '}
                      <strong
                        style={{
                          color:
                            inspected.sensor === 'MODIS'
                              ? DESIGN_TOKENS.modis
                              : DESIGN_TOKENS.viirs,
                        }}
                      >
                        {inspected.sensor}
                      </strong>
                    </div>
                    <div>Date: {inspected.date}</div>
                    <div>FRP: {inspected.frp} MW</div>
                    <div>Confidence: {inspected.confidence}</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div>Harmonized count: {inspected.count?.toLocaleString()}</div>
                    <div>Integrated FRP: {inspected.frp.toLocaleString()} MW</div>
                  </div>
                )}
              </div>
            </Popup>
          )}
        </Map>

        {/* Bottom-Left Overlay Legend */}
        <div
          className="tabular-nums"
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            backgroundColor: 'rgba(11, 18, 32, 0.88)',
            border: '1px solid var(--border-line)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            pointerEvents: 'none',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: DESIGN_TOKENS.modis,
              }}
            />
            MODIS (~1 km)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: DESIGN_TOKENS.viirs,
              }}
            />
            VIIRS (~375 m)
          </span>
          <span style={{ color: 'var(--text-muted)' }}>Click cell/point to inspect</span>
        </div>
      </div>

      {/* Linked Timeline Scrubber */}
      <TimeSlider
        records={dailyRecords}
        selectedDate={selectedDate}
        peakDate={peakDate}
        onSelectDate={onSelectDate}
      />
    </div>
  );
}
