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
 * - false (default): Fetch the real FireScope harmonized JSON/GeoJSON files from DATA_BASE_URL
 * - true: Use the deterministic seeded mock data generator (unit tests and offline demos only)
 */
export const USE_MOCK: boolean =
  env.VITE_USE_MOCK === undefined ? false : String(env.VITE_USE_MOCK).toLowerCase() === 'true';

/**
 * Time span covered by the delivered dataset (Egypt, FIRMS MODIS + VIIRS).
 * Keep in sync with data/web_export/region_meta.json (date_min / date_max).
 */
export const DATA_WINDOW = {
  minYear: 2023,
  maxYear: 2025,
  latestDate: '2025-12-31',
  /** Days (ending at latestDate) that the Responder preset highlights. */
  responderDays: 14,
} as const;

/**
 * Base URL for harmonized data files (local folder under public/ or remote API)
 */
export const DATA_BASE_URL: string =
  (env.VITE_DATA_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '/data';

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
  'MODIS & VIIRS active-fire activity over Egypt, 2023–2025';

export const LOGO: string = '/logo-satellite-fire.jpg';

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
 * How the two sensors' confidence fields and the harmonized counts are handled.
 * Written from the FireScope project reports (phases 1-5); keep in sync with them.
 */
export const CONF_MAPPING_TEXT = {
  summary:
    'MODIS reports detection confidence as a number from 0 to 100, while VIIRS reports three classes: low ("l"), nominal ("n") and high ("h"). The two scales are not equivalent, so FireScope does not convert one into the other: VIIRS classes are never turned into numbers, and MODIS numeric confidence is not used in the activity indices. Confidence is kept as reported and used only as a sensitivity check (an index that drops VIIRS "low" detections).',
  tiers: [
    {
      tier: 'Low confidence',
      code: 'low' as const,
      modisRule: 'Numeric 0–100, kept as reported (not mapped)',
      viirsRule: 'class "l" — about 13% of VIIRS vegetation-fire candidates',
      treatment:
        'Kept in all counts. A sensitivity index that excludes VIIRS "l" shows how much the result depends on weak detections.',
    },
    {
      tier: 'Nominal confidence',
      code: 'nominal' as const,
      modisRule: 'Numeric 0–100, kept as reported (not mapped)',
      viirsRule: 'class "n" — about 84% of VIIRS vegetation-fire candidates',
      treatment: 'Kept in all counts and in the sensitivity index.',
    },
    {
      tier: 'High confidence',
      code: 'high' as const,
      modisRule: 'Numeric 0–100, kept as reported (not mapped)',
      viirsRule: 'class "h" — about 3% of VIIRS vegetation-fire candidates',
      treatment:
        'high_conf_share in the daily summary is the share of that day’s VIIRS detections with class "h". It is 0 on days without VIIRS detections.',
    },
  ],
  spatialTemporalRule:
    'Detections are placed on a 0.05° grid. A cell on one UTC date with at least one detection from any sensor is one “cell-day” and is counted once, however many sensors or passes saw it. That cell-day count is the harmonized series (count_merged). MODIS (~1 km) and VIIRS (~375 m) detections are never added together as independent fires, and raw VIIRS counts add up S-NPP, NOAA-20 and NOAA-21 passes that often see the same fire.',
  limitations: [
    'A hotspot is a satellite thermal detection, not a confirmed fire. The data cannot separate wildfire from crop-residue burning or other heat sources.',
    'Static land sources (FIRMS hotspot type 2) and water detections are excluded. The flag is not perfect: Phase 4 reports how much activity sits next to flagged static cells (3×3 neighbourhood).',
    'A day with no records is a coverage fact, not proof of no fire. MODIS has no records on 253 of 1,096 days, and NOAA-21 is not expected before its science start (59 days in January–February 2023).',
    'The satellites cross at different local times, so daytime and night-time sampling differ between sensors; hour-of-day patterns should be read per sensor.',
    'Only three years (2023–2025) are available, so the seasonal profile and the anomaly baseline are short. The seasonal activity index is relative to each region’s own peak month.',
    'Regions are analytical rectangles built from cell centres, not administrative boundaries.',
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
