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
 * - false: Real Egypt 2023–2025 FireScope dataset is embedded and active by default
 * - true: Only when explicitly forced via VITE_USE_MOCK='true'
 */
export const USE_MOCK: boolean =
  env.VITE_USE_MOCK === undefined ? false : String(env.VITE_USE_MOCK).toLowerCase() === 'true';

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
  (env.VITE_PROJECT_NAME as string | undefined) || 'MODIS & VIIRS Harmonizer';

export const TAGLINE: string =
  (env.VITE_TAGLINE as string | undefined) ||
  'FireScope Egypt (2023–2025) · MODIS & VIIRS (S-NPP, NOAA-20, NOAA-21) Harmonization & Fire Activity Index';

export const LOGO: string = '/logo-satellite-fire.jpg';

export const TEAM_NAMES: readonly TeamMember[] = [
  {
    name: 'Four-Bits-and-a-Byte — Phase 1–3 Data Engineering & Harmonization',
    role: 'Schema Audit, Cleaning & 0.05° Grid Harmonization',
    focus: '254,175 NASA FIRMS rows across MODIS, S-NPP, NOAA-20, and NOAA-21 harmonized onto a 0.05° × 0.05° spatial grid and 1,096-day coverage calendar',
  },
  {
    name: 'Four-Bits-and-a-Byte — Phase 4 Spatio-Temporal & Sensor Analytics',
    role: 'Cross-Sensor Co-Occurrence, Static Thermal Sources & 1° Blocks',
    focus: 'Separating 84,689 Type 0 vegetation fire candidates from 168,263 Type 2 persistent industrial/flare detections and 96 multi-year hotspot clusters',
  },
  {
    name: 'Four-Bits-and-a-Byte — Phase 5 Fire Activity Index (FAI) & Baseline v1',
    role: 'Frozen Baseline v1 Index & Sensitivity Diagnostics',
    focus: 'Matched-day baseline calibration (B = 32.4975 cell-days/day), static 3×3 exclusion sensitivity (excl3x3), confidence sensitivity (excl_low), and coverage factor kappa',
  },
  {
    name: 'Four-Bits-and-a-Byte — Phase 6 Scientific Atlas & Interactive Frontend',
    role: 'Mission-Control Web Platform & 28-Figure Scientific Atlas',
    focus: 'Interactive multi-year fire calendar, MapLibre GL Egypt 0.05° spatial workbench, and publication-grade Phase 6 visualization suite',
  },
] as const;

/**
 * Explanation of confidence mapping, 0.05° cell-day harmonization, and physical sensor rules
 */
export const CONF_MAPPING_TEXT = {
  summary:
    'In FireScope Egypt (2023–2025), MODIS (Collection 6.1, ~1,000 m pixel) reports fire detection confidence as a numeric percentage (0–100%, mean 67.7% across 3,457 vegetation candidate rows), whereas VIIRS (375 m I-band on S-NPP, NOAA-20, and NOAA-21) reports categorical classes: low ("l", ~12.5–13.3%), nominal ("n", ~83.2–84.5%), and high ("h", ~2.6–3.4%). Both sensor families are mapped onto a unified three-tier confidence taxonomy (`low`, `nominal`, `high`) and aggregated onto a common 0.05° × 0.05° (~5 km) spatial grid.',
  tiers: [
    {
      tier: 'Low confidence',
      code: 'low' as const,
      modisRule: '0% <= confidence < 30%',
      viirsRule: 'class === "l" (12.5%–13.3% of VIIRS Type 0 rows; daytime sun-glint or weak thermal edge)',
      harmonizedWeight: 0.25,
      treatment:
        'Included in the headline_N20_SNPP_core_all series; explicitly tested via the N20_SNPP_core_excl_low sensitivity series (8.6% of cell-days have only low-confidence detections).',
    },
    {
      tier: 'Nominal confidence',
      code: 'nominal' as const,
      modisRule: '30% <= confidence < 80% (MODIS mean = 67.7%)',
      viirsRule: 'class === "n" (83.2%–84.5% of VIIRS Type 0 rows; standard active fire pixel)',
      harmonizedWeight: 1.0,
      treatment:
        'Core component of both headline_N20_SNPP_core_all and N20_SNPP_core_excl_low cell-day presence series on the 0.05° × 0.05° grid.',
    },
    {
      tier: 'High confidence',
      code: 'high' as const,
      modisRule: '80% <= confidence <= 100%',
      viirsRule: 'class === "h" (2.6%–3.4% of VIIRS Type 0 rows; intense 4 µm brightness temperature anomaly)',
      harmonizedWeight: 1.0,
      treatment:
        'Included in all core and high-confidence series; prioritized for immediate responder hotspot verification.',
    },
  ],
  spatialTemporalRule:
    'Raw detection counts across MODIS (~1 km) and the three VIIRS instruments (~375 m) are NEVER summed as independent fires because a single burn or flare generates multiple pixel detections across overlapping swaths. Instead, FireScope defines a 0.05° × 0.05° (~5 km) cell-day presence indicator: one grid cell on one UTC calendar day with ≥1 qualifying Type 0 detection counts as 1 cell-day. The headline Fire Activity Index (FAI) uses the NOAA-20 ∪ S-NPP union relative to frozen baseline v1 (B = 32.4975 cell-days/day over 337 matched calendar dates).',
  limitations: [
    '65.6%–69.3% of raw VIIRS detections in Egypt (168,263 rows across 267 cells) are Type 2 persistent static thermal sources (gas flares, refineries, cement kilns) and 33.4% of Type 0 candidate cell-days fall within a 3×3 cell neighborhood of a static source; always compare core FAI against the excl3x3 sensitivity series.',
    'Unusable sensor days (such as NOAA-21 prior to its 2023-03-01 science start and S-NPP’s 19-day source gap in July 2024) are treated strictly as missing coverage (kappa < 1), never zero-filled.',
    'Daytime detections (peaking 10:00–12:00 UTC / 12:00–14:00 Cairo local time) declined by 53.2% from 2023 to 2025 on matched days, whereas nighttime detections (23:00–00:00 UTC / 01:00–02:00 Cairo) declined by 30.4%, reflecting stronger daytime agricultural burning reductions vs persistent nocturnal industrial heat.',
    'Regional 1° × 1° block FAI values use the national coverage calendar (coverage_basis = national_calendar_proxy) and measure each block’s trajectory relative to its own 3-year baseline; blocks are never ranked by FAI.',
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
