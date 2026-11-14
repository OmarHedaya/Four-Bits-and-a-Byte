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
  cellType?: string;
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

  // Colour ramp scaled to the displayed cells (98th percentile), so the thermal ramp
  // stays readable whatever the dataset's magnitude (a fixed ramp hides low-count regions).
  const gridValueKey = metric === 'frp' ? 'frp_sum' : 'count';
  const rampMax = useMemo(() => {
    const values = gridCells.features
      .map((f) => Number(f.properties[gridValueKey]))
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    if (values.length === 0) return 1;
    const p98 = values[Math.min(values.length - 1, Math.floor(values.length * 0.98))];
    return Math.max(1, p98);
  }, [gridCells, gridValueKey]);

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

  // Frame the active region. Used on load (the map instance does not exist yet when the first
  // effect runs) and whenever the region changes.
  const fitToRegion = (duration: number) => {
    if (!mapRef.current || !regionMeta) return;
    const [minLon, minLat, maxLon, maxLat] = regionMeta.bbox;
    try {
      mapRef.current.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: 36, duration },
      );
    } catch {
      // Ignore fitBounds errors during headless test teardown
    }
  };

  // Fit bounds when regionMeta changes
  useEffect(() => {
    fitToRegion(650);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const cellType = String(props.cell_type ?? 'vegetation');
      setInspected({
        longitude: Number(props.lon ?? e.lngLat.lng),
        latitude: Number(props.lat ?? e.lngLat.lat),
        kind: 'cell',
        title:
          cellType === 'static_thermal'
            ? `Static thermal cell ${props.cell_id}`
            : `Grid cell ${props.cell_id}`,
        subtitle: `${props.month === 'all' ? 'All months' : `Month ${props.month}`} · Centroid ${Number(props.lat).toFixed(2)}°, ${Number(props.lon).toFixed(2)}°`,
        frp: Number(props.frp_sum ?? 0),
        count: Number(props.count ?? 0),
        cellType,
      });
    }
  };

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
          initialViewState={
            regionMeta
              ? {
                  bounds: regionMeta.bbox as [number, number, number, number],
                  fitBoundsOptions: { padding: 36 },
                }
              : { longitude: 30.0, latitude: 27.0, zoom: 4.8 }
          }
          onLoad={() => fitToRegion(0)}
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
                    ['get', gridValueKey],
                    0,
                    DESIGN_TOKENS.thermalRamp[0],
                    rampMax * 0.08,
                    DESIGN_TOKENS.thermalRamp[1],
                    rampMax * 0.2,
                    DESIGN_TOKENS.thermalRamp[2],
                    rampMax * 0.38,
                    DESIGN_TOKENS.thermalRamp[3],
                    rampMax * 0.58,
                    DESIGN_TOKENS.thermalRamp[4],
                    rampMax * 0.8,
                    DESIGN_TOKENS.thermalRamp[5],
                    rampMax,
                    DESIGN_TOKENS.thermalRamp[6],
                  ],
                  'fill-opacity': 0.68,
                }}
              />
              <Layer
                id="grid-cells-outline"
                type="line"
                paint={{
                  'line-color': [
                    'match',
                    ['get', 'cell_type'],
                    'static_thermal',
                    '#E85D75',
                    '#FFC247',
                  ],
                  'line-width': 0.7,
                  'line-opacity': 0.42,
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
                    <div>
                      Classification:{' '}
                      <strong
                        style={{
                          color:
                            inspected.cellType === 'static_thermal' ? '#E85D75' : '#4ADE80',
                        }}
                      >
                        {inspected.cellType === 'static_thermal'
                          ? 'Type 2 Static Industrial / Flare'
                          : 'Type 0 Vegetation Fire Candidate'}
                      </strong>
                    </div>
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
