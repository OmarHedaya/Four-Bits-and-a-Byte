/**
 * Single source of truth for all application placeholders, data endpoint mappings,
 * project branding metadata, and environment switches.
 *
 * No placeholder values or endpoint paths are hard-coded inside UI components.
 */

export interface TeamMember {
  name: string;
  role: string;
  focus: string;
}

const env = import.meta.env ?? {};

/**
 * Environment switch:
 * - true (default): Use deterministic seeded mock data generator
 * - false: Fetch real harmonized JSON/GeoJSON endpoints from DATA_BASE_URL
 */
export const USE_MOCK: boolean =
  env.VITE_USE_MOCK === undefined ? true : String(env.VITE_USE_MOCK).toLowerCase() !== 'false';

/**
 * Base URL for harmonized data files (local folder under public/ or remote API)
 */
export const DATA_BASE_URL: string =
  (env.VITE_DATA_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '/sample-data';

/**
 * MapLibre GL dark basemap style URL and optional API key
 */
export const BASEMAP_STYLE_URL: string =
  (env.VITE_BASEMAP_STYLE_URL as string | undefined) ||
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export const MAP_KEY: string = (env.VITE_MAP_KEY as string | undefined) || '';

/**
 * Project branding & team metadata placeholders
 */
export const PROJECT_NAME: string =
  (env.VITE_PROJECT_NAME as string | undefined) || 'FIRMS Harmonizer';

export const TAGLINE: string =
  (env.VITE_TAGLINE as string | undefined) ||
  'Harmonized MODIS & VIIRS active-fire mission-control instrument';

export const LOGO: string = '/logo-thermal-orbit.svg';

export const TEAM_NAMES: readonly TeamMember[] = [
  {
    name: 'Four-Bits-and-a-Byte — Front-End & Visual Analytics Lead',
    role: 'Front-End Architecture & D3/WebGL Visualization',
    focus: 'Mission-control UI, multi-year fire calendar heatmap, MapLibre GL layers, and data contract validation',
  },
  {
    name: 'Four-Bits-and-a-Byte — Earth Observation Data Scientist',
    role: 'Sensor Harmonization & Spatio-Temporal Clustering',
    focus: 'MODIS (1 km) & VIIRS (375 m) co-registration, FRP scaling factor calibration, and confidence alignment',
  },
  {
    name: 'Four-Bits-and-a-Byte — Statistical Modeling & Anomaly Lead',
    role: 'Climatology, Seasonality & Risk Scoring',
    focus: 'Z-score anomaly detection, seasonal fire regimes, and responder/planner risk window forecasting',
  },
  {
    name: 'Four-Bits-and-a-Byte — Data Engineering & Pipeline Lead',
    role: 'FIRMS Ingestion & Pre-Aggregation Pipeline',
    focus: 'NASA FIRMS archival processing, GeoJSON grid aggregation, and static/API contract delivery',
  },
  {
    name: 'Four-Bits-and-a-Byte — Domain Research & Science Communicator',
    role: 'Wildfire Operations & Validation Documentation',
    focus: 'Responder/Scientist/Planner workflow design, sensor limitation analysis, and mission storytelling',
  },
] as const;

/**
 * Explanation of confidence mapping and thresholds between MODIS and VIIRS
 */
export const CONF_MAPPING_TEXT = {
  summary:
    'MODIS (Collection 6.1, 1 km nominal pixel) reports fire detection confidence as a continuous integer percentage (0–100%), whereas VIIRS (375 m I-band, S-NPP & NOAA-20/21) reports categorical confidence classes: low ("l"), nominal ("n"), and high ("h"). To construct a consistent multi-year fire-activity calendar without threshold-induced jumps, both sensors are mapped into a unified three-tier harmonized confidence scale before spatial-temporal clustering.',
  tiers: [
    {
      tier: 'Low confidence',
      code: 'low' as const,
      modisRule: '0% <= confidence < 30%',
      viirsRule: 'class === "l" (sun-glint or weak thermal anomaly)',
      harmonizedWeight: 0.25,
      treatment:
        'Excluded from high-confidence KPI share; retained with 0.25 weight in exploratory point views to avoid masking nascent ignitions.',
    },
    {
      tier: 'Nominal confidence',
      code: 'nominal' as const,
      modisRule: '30% <= confidence < 80%',
      viirsRule: 'class === "n" (standard active fire pixel free of daytime glint)',
      harmonizedWeight: 1.0,
      treatment:
        'Included in daily harmonized counts (count_merged) and spatial-temporal 1.2 km / +/-4 hr co-registration clusters.',
    },
    {
      tier: 'High confidence',
      code: 'high' as const,
      modisRule: '80% <= confidence <= 100%',
      viirsRule: 'class === "h" (saturated or intense 4 um brightness temperature anomaly)',
      harmonizedWeight: 1.0,
      treatment:
        'Included in count_merged and numerator of high_conf_share; prioritized for Responder alert triage.',
    },
  ],
  spatialTemporalRule:
    'VIIRS 375 m detections falling within 1.25 km and +/-3.5 hours of a MODIS 1 km centroid are grouped into a single harmonized fire event footprint. Raw VIIRS counts typically exceed MODIS by 2.8x–3.6x due to higher sensitivity to small and cool perimeter fires; the harmonized count_merged series applies cluster deduplication plus regional scaling validation.',
  limitations: [
    'Cloud cover and dense optically thick smoke plumes can obscure both MODIS and VIIRS mid-infrared channels, causing artificial dips on overcast days.',
    'Diurnal overpass timing differs: Terra (~10:30 LT) provides morning coverage while Aqua, Suomi-NPP, and NOAA-20/21 cross near ~13:30 LT / 01:30 LT, creating diurnal sampling asymmetry.',
    'Off-nadir scan geometry stretches pixel footprints toward swath edges ("bow-tie" effect), which is more pronounced in MODIS (up to ~4.8 km at scan edge) than VIIRS (constrained by pixel aggregation rules).',
    'Industrial flares, volcanic vents, and agricultural residue burns can trigger nominal thermal anomalies unless filtered by static land-cover masks.',
  ],
} as const;

/**
 * Exact placeholder keys required by the specification and their corresponding
 * relative file endpoints under DATA_BASE_URL.
 */
export const PLACEHOLDERS = {
  DAILY_SUMMARY: `${DATA_BASE_URL}/daily_summary.json`,
  GRID_CELLS: `${DATA_BASE_URL}/grid_cells.geojson`,
  RECENT_POINTS: `${DATA_BASE_URL}/recent_points.json`,
  SEASONALITY: `${DATA_BASE_URL}/seasonality.json`,
  ANOMALIES: `${DATA_BASE_URL}/anomalies.json`,
  RISK_PERIODS: `${DATA_BASE_URL}/risk_periods.json`,
  VALIDATION: `${DATA_BASE_URL}/validation.json`,
  REGION_META: `${DATA_BASE_URL}/region_meta.json`,
  CONF_MAPPING_TEXT,
  DATA_BASE_URL,
  BASEMAP_STYLE_URL,
  MAP_KEY,
  PROJECT_NAME,
  TAGLINE,
  LOGO,
  TEAM_NAMES,
} as const;

/**
 * Design token constants for programmatic use in D3 scales, Canvas, and MapLibre GL
 */
export const DESIGN_TOKENS = {
  night: '#0B1220',
  panel: '#131C2E',
  line: '#26344D',
  text: '#E6ECF5',
  muted: '#8FA0BA',
  modis: '#3CC4C4',
  viirs: '#B79CFF',
  thermalRamp: [
    '#1a2140',
    '#2B2F7E',
    '#7A2E8E',
    '#C9306B',
    '#F26B2D',
    '#FFC247',
    '#FFF1B8',
  ] as const,
} as const;
