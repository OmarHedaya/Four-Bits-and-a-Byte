import {
  type AnomalyRecord,
  type DailySummaryRecord,
  type GridCellRecord,
  type GridCellsGeoJson,
  type HarmonizedDataset,
  type RecentPointRecord,
  type RegionMetaRecord,
  type RiskPeriodRecord,
  type SeasonalityRecord,
  type ValidationData,
  type ValidationMonthlyPair,
  HarmonizedDatasetSchema,
} from '../contracts/schemas';

/**
 * Deterministic 32-bit PRNG (Mulberry32) so mock data is 100% reproducible
 * across reloads, tests, and screenshots.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RegionProfile {
  meta: RegionMetaRecord;
  peakDayOfYear: number;
  secondaryPeakDayOfYear?: number;
  baseModisDaily: number;
  seasonalAmplitude: number;
  viirsMultiplier: number;
  meanFrpPerHotspot: number;
  hotspotsCenters: ReadonlyArray<readonly [number, number]>; // [lon, lat]
}

const REGION_PROFILES: readonly RegionProfile[] = [
  {
    meta: {
      region_id: 'med-east',
      name: 'Eastern Mediterranean & Levant',
      bbox: [19.5, 31.0, 37.5, 41.5],
      date_min: '2021-01-01',
      date_max: '2025-12-31',
      biome: 'Mediterranean sclerophyllous forests & shrublands',
      description:
        'High summer desiccation regime driven by Etesian winds and marine heatwaves across Greece, Anatolia, Cyprus, and the Levant coast.',
    },
    peakDayOfYear: 215, // Early August
    baseModisDaily: 8,
    seasonalAmplitude: 95,
    viirsMultiplier: 3.35,
    meanFrpPerHotspot: 34.5,
    hotspotsCenters: [
      [23.7, 38.2], // Attica / Evia
      [28.3, 36.9], // Mugla / Marmaris
      [31.5, 36.8], // Antalya / Manavgat
      [35.9, 35.6], // Latakia / coastal mountains
      [33.0, 34.9], // Troodos Cyprus
      [25.9, 41.1], // Evros / Dadia
    ],
  },
  {
    meta: {
      region_id: 'amazon-south',
      name: 'Southern Amazonia Arc',
      bbox: [-67.0, -15.5, -48.0, -4.0],
      date_min: '2021-01-01',
      date_max: '2025-12-31',
      biome: 'Moist tropical broadleaf forest & agricultural frontier',
      description:
        'Pronounced dry-season biomass burning corridor along the BR-163 and Trans-Amazonian frontier peaking August through October.',
    },
    peakDayOfYear: 248, // Early September
    baseModisDaily: 24,
    seasonalAmplitude: 210,
    viirsMultiplier: 3.55,
    meanFrpPerHotspot: 28.2,
    hotspotsCenters: [
      [-55.3, -7.2], // Novo Progresso / Para
      [-61.8, -9.4], // Rondônia
      [-58.2, -11.8], // Northern Mato Grosso
      [-51.9, -6.6], // Sao Felix do Xingu
      [-64.5, -8.7], // Southern Amazonas
    ],
  },
  {
    meta: {
      region_id: 'west-na',
      name: 'Western North America',
      bbox: [-124.8, 32.5, -110.0, 49.0],
      date_min: '2021-01-01',
      date_max: '2025-12-31',
      biome: 'Temperate coniferous forest & chaparral',
      description:
        'High-FRP crown fire regime across the Sierra Nevada, Cascades, and Northern Rockies with late-summer vapor pressure deficit spikes.',
    },
    peakDayOfYear: 230, // Mid-August
    secondaryPeakDayOfYear: 285, // October Santa Ana / Diablo wind events
    baseModisDaily: 12,
    seasonalAmplitude: 145,
    viirsMultiplier: 3.15,
    meanFrpPerHotspot: 51.8,
    hotspotsCenters: [
      [-121.2, 40.1], // Northern Sierra / Dixie corridor
      [-122.3, 43.8], // Western Cascades Oregon
      [-115.4, 45.6], // Salmon-Challis Idaho
      [-118.6, 34.4], // Southern California Transverse Ranges
      [-120.4, 47.9], // North Cascades Washington
    ],
  },
  {
    meta: {
      region_id: 'congo-basin',
      name: 'Northern Congo & Sudano-Sahelian Belt',
      bbox: [14.0, 2.0, 31.0, 11.5],
      date_min: '2021-01-01',
      date_max: '2025-12-31',
      biome: 'Tropical savanna & forest-savanna mosaic',
      description:
        'Boreal winter dry-season savanna fire belt (December–February) characterized by high VIIRS low-FRP perimeter detections.',
    },
    peakDayOfYear: 18, // Mid-January
    secondaryPeakDayOfYear: 350, // Mid-December
    baseModisDaily: 28,
    seasonalAmplitude: 175,
    viirsMultiplier: 3.85,
    meanFrpPerHotspot: 21.4,
    hotspotsCenters: [
      [21.5, 7.4], // Central African Republic savanna
      [26.8, 6.9], // Eastern CAR / South Sudan border
      [17.8, 8.6], // Southern Chad / North Cameroon
      [28.9, 4.8], // Western Equatoria
    ],
  },
] as const;

interface InjectedAnomalySpec {
  start_date: string;
  end_date: string;
  region_id: string;
  score: number;
  boostMultiplier: number;
  frpBoost: number;
  reason: string;
}

const INJECTED_ANOMALIES: readonly InjectedAnomalySpec[] = [
  {
    start_date: '2021-07-28',
    end_date: '2021-08-12',
    region_id: 'med-east',
    score: 4.42,
    boostMultiplier: 3.1,
    frpBoost: 1.55,
    reason:
      'Extreme Eastern Mediterranean heat dome (+46 C surface air temperature) triggered synchronous megafires in Evia, Antalya, and Mugla with VIIRS detecting 3.9x night-time perimeter expansion vs MODIS.',
  },
  {
    start_date: '2023-08-18',
    end_date: '2023-08-29',
    region_id: 'med-east',
    score: 4.68,
    boostMultiplier: 3.4,
    frpBoost: 1.65,
    reason:
      'Dadia-Evros complex (largest recorded EU wildfire footprint): sustained gale-force Etesian winds produced record 375 m VIIRS cluster density and +4.68 sigma radiative power surge.',
  },
  {
    start_date: '2024-08-24',
    end_date: '2024-09-14',
    region_id: 'amazon-south',
    score: 4.15,
    boostMultiplier: 2.75,
    frpBoost: 1.4,
    reason:
      'Severe multi-year soil moisture deficit across Southern Amazonia & Pantanal border; high-confidence understory fires detected by VIIRS 375 m I-band beneath dense smoke canopy.',
  },
  {
    start_date: '2021-08-04',
    end_date: '2021-08-22',
    region_id: 'west-na',
    score: 3.94,
    boostMultiplier: 2.65,
    frpBoost: 1.7,
    reason:
      'Northern California & Cascade pyrocumulonimbus outbreak (Dixie & Monument complexes): extreme nighttime FRP persistence captured by NOAA-20/Suomi-NPP 01:30 LT overpasses.',
  },
  {
    start_date: '2025-07-19',
    end_date: '2025-07-31',
    region_id: 'med-east',
    score: 3.62,
    boostMultiplier: 2.5,
    frpBoost: 1.45,
    reason:
      'Prolonged flash-drought and low nocturnal relative humidity (<18%) across Peloponnese, Cyprus, and coastal Levant drove rapid early-season crown fire spread.',
  },
  {
    start_date: '2025-09-02',
    end_date: '2025-09-15',
    region_id: 'west-na',
    score: 3.48,
    boostMultiplier: 2.4,
    frpBoost: 1.5,
    reason:
      'Late-summer dry lightning siege paired with 99th-percentile vapor pressure deficit across Idaho and Oregon timber stands.',
  },
  {
    start_date: '2024-01-09',
    end_date: '2024-01-21',
    region_id: 'congo-basin',
    score: 3.21,
    boostMultiplier: 2.15,
    frpBoost: 1.25,
    reason:
      'Strong Harmattan wind surge accelerated Sudano-Sahelian savanna flame fronts, driving a sharp divergence between VIIRS 375 m small-fire counts and MODIS 1 km detections.',
  },
];

const RISK_PERIODS_SEED: readonly RiskPeriodRecord[] = [
  {
    window: 'July 20 – August 31 (Peak Etesian Window)',
    region_id: 'med-east',
    risk_score: 94,
    drivers: [
      'Persistent Etesian NE winds (25–45 kt)',
      '10-hour dead fuel moisture < 6%',
      'Marine heatwave suppressing nocturnal humidity recovery',
    ],
    start_month: 7,
    end_month: 8,
  },
  {
    window: 'August 15 – October 10 (Dry-Season Clearing Peak)',
    region_id: 'amazon-south',
    risk_score: 91,
    drivers: [
      'Cumulative dry-season rainfall deficit (>180 mm anomaly)',
      'Slash-and-burn agricultural frontier ignitions',
      'Canopy desiccation enabling understory fire escape',
    ],
    start_month: 8,
    end_month: 10,
  },
  {
    window: 'August 01 – September 25 (Late-Summer VPD Surge)',
    region_id: 'west-na',
    risk_score: 89,
    drivers: [
      'Extreme Vapor Pressure Deficit (VPD > 4.5 kPa)',
      'Dry thunderstorm lightning outbreaks over cured timber',
      'Early autumn offshore downslope wind transitions',
    ],
    start_month: 8,
    end_month: 9,
  },
  {
    window: 'December 20 – February 10 (Harmattan Savanna Window)',
    region_id: 'congo-basin',
    risk_score: 82,
    drivers: [
      'Harmattan dry continental airflow from the Sahara',
      'Cured C4 tall-grass biomass continuity',
      'High diurnal spread rate between 11:00 and 16:00 LT',
    ],
    start_month: 12,
    end_month: 2,
  },
  {
    window: 'June 15 – July 19 (Early Summer Curing Transition)',
    region_id: 'med-east',
    risk_score: 76,
    drivers: [
      'Rapid herbaceous fuel curing following spring growth',
      'Subtropical ridge intrusion across Eastern Mediterranean',
    ],
    start_month: 6,
    end_month: 7,
  },
  {
    window: 'October 05 – November 15 (Offshore Wind Season)',
    region_id: 'west-na',
    risk_score: 78,
    drivers: [
      'Santa Ana & Diablo katabatic offshore wind events',
      'Delayed onset of autumn Pacific storm track precipitation',
    ],
    start_month: 10,
    end_month: 11,
  },
];

function circularDayDistance(doy1: number, doy2: number): number {
  const diff = Math.abs(doy1 - doy2);
  return Math.min(diff, 365 - diff);
}

function getDayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86400000);
}

function formatIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let cachedMockDataset: HarmonizedDataset | null = null;

/**
 * Generates (and memoizes) the full multi-year, multi-region harmonized dataset.
 */
export function generateMockDataset(seed = 202610): HarmonizedDataset {
  if (cachedMockDataset && seed === 202610) {
    return cachedMockDataset;
  }

  const rand = createSeededRandom(seed);
  const startYear = 2021;
  const endYear = 2025;

  const dailySummary: DailySummaryRecord[] = [];
  const seasonalityMap = new Map<
    string,
    {
      year: number;
      month: number;
      region_id: string;
      frp_sum: number;
      count: number;
      count_modis: number;
      count_viirs: number;
    }
  >();

  // Generate daily records for every region from 2021-01-01 to 2025-12-31
  const startDate = new Date(Date.UTC(startYear, 0, 1));
  const endDate = new Date(Date.UTC(endYear, 11, 31));

  for (const profile of REGION_PROFILES) {
    const regionRecords: Array<{
      date: string;
      year: number;
      month: number;
      count_modis: number;
      count_viirs: number;
      count_merged: number;
      total_frp: number;
      high_conf_share: number;
      injectedZ?: number;
    }> = [];

    for (
      let cursor = new Date(startDate.getTime());
      cursor <= endDate;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const dateStr = formatIsoDate(cursor);
      const doy = getDayOfYear(cursor);
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth() + 1;

      const distPrimary = circularDayDistance(doy, profile.peakDayOfYear);
      const gaussianPrimary = Math.exp(-Math.pow(distPrimary / 36, 2));

      let gaussianSecondary = 0;
      if (profile.secondaryPeakDayOfYear !== undefined) {
        const distSec = circularDayDistance(doy, profile.secondaryPeakDayOfYear);
        gaussianSecondary = 0.55 * Math.exp(-Math.pow(distSec / 24, 2));
      }

      const seasonalFactor = Math.min(1.25, gaussianPrimary + gaussianSecondary);

      // Slight multi-year climate trend + synoptic 5-day weather wave
      const yearFactor = 1 + (year - 2021) * 0.035;
      const synopticWave = 0.78 + 0.44 * Math.sin((doy / 6.5) + year * 1.7);
      const noise = 0.68 + rand() * 0.64;

      // Check if date falls in an injected anomaly window for this region
      const matchingAnomaly = INJECTED_ANOMALIES.find(
        (a) =>
          a.region_id === profile.meta.region_id &&
          dateStr >= a.start_date &&
          dateStr <= a.end_date,
      );

      const anomalyMult = matchingAnomaly ? matchingAnomaly.boostMultiplier : 1.0;
      const frpMult = matchingAnomaly ? matchingAnomaly.frpBoost : 1.0;

      const rawModis =
        (profile.baseModisDaily + profile.seasonalAmplitude * seasonalFactor) *
        yearFactor *
        synopticWave *
        noise *
        anomalyMult;

      const count_modis = Math.max(0, Math.round(rawModis));

      // VIIRS has higher spatial sensitivity (375m vs 1km), especially at fire perimeters
      const viirsRatioJitter = profile.viirsMultiplier * (0.91 + rand() * 0.18);
      const count_viirs = Math.max(
        count_modis,
        Math.round(count_modis * viirsRatioJitter + (seasonalFactor > 0.3 ? rand() * 8 : 0)),
      );

      // Harmonized merged clusters: deduplicates co-located MODIS + VIIRS detections
      // while preserving uniquely resolved VIIRS thermal fronts (~0.62 of combined after spatial clustering)
      const count_merged = Math.max(
        count_modis,
        Math.round(count_modis * 0.52 + count_viirs * 0.49),
      );

      const total_frp = Number(
        (
          count_merged *
          profile.meanFrpPerHotspot *
          (0.84 + rand() * 0.32) *
          frpMult
        ).toFixed(1),
      );

      const baseConf = 0.54 + seasonalFactor * 0.24 + (matchingAnomaly ? 0.14 : 0);
      const high_conf_share = Number(
        Math.min(0.97, Math.max(0.18, baseConf + (rand() - 0.5) * 0.12)).toFixed(3),
      );

      regionRecords.push({
        date: dateStr,
        year,
        month,
        count_modis,
        count_viirs,
        count_merged,
        total_frp,
        high_conf_share,
        injectedZ: matchingAnomaly ? matchingAnomaly.score * (0.86 + rand() * 0.2) : undefined,
      });

      const sKey = `${profile.meta.region_id}:${year}:${month}`;
      const existing = seasonalityMap.get(sKey) ?? {
        year,
        month,
        region_id: profile.meta.region_id,
        frp_sum: 0,
        count: 0,
        count_modis: 0,
        count_viirs: 0,
      };
      existing.frp_sum = Number((existing.frp_sum + total_frp).toFixed(1));
      existing.count += count_merged;
      existing.count_modis += count_modis;
      existing.count_viirs += count_viirs;
      seasonalityMap.set(sKey, existing);
    }

    // Compute mean and standard deviation per region to assign realistic anomaly_z scores
    const meanMerged =
      regionRecords.reduce((acc, r) => acc + r.count_merged, 0) / regionRecords.length;
    const variance =
      regionRecords.reduce((acc, r) => acc + Math.pow(r.count_merged - meanMerged, 2), 0) /
      regionRecords.length;
    const stdMerged = Math.max(1, Math.sqrt(variance));

    for (const r of regionRecords) {
      const computedZ = (r.count_merged - meanMerged) / stdMerged;
      const anomaly_z = Number(
        (r.injectedZ !== undefined ? Math.max(computedZ, r.injectedZ) : computedZ).toFixed(2),
      );
      dailySummary.push({
        date: r.date,
        region_id: profile.meta.region_id,
        count_modis: r.count_modis,
        count_viirs: r.count_viirs,
        count_merged: r.count_merged,
        total_frp: r.total_frp,
        high_conf_share: r.high_conf_share,
        anomaly_z,
      });
    }
  }

  // Build seasonality array (global aggregated + per-region records)
  const globalSeasonalityMap = new Map<
    string,
    {
      year: number;
      month: number;
      frp_sum: number;
      count: number;
      count_modis: number;
      count_viirs: number;
    }
  >();

  const regionalSeasonality: SeasonalityRecord[] = [];
  for (const item of seasonalityMap.values()) {
    regionalSeasonality.push(item);
    const gKey = `${item.year}:${item.month}`;
    const g = globalSeasonalityMap.get(gKey) ?? {
      year: item.year,
      month: item.month,
      frp_sum: 0,
      count: 0,
      count_modis: 0,
      count_viirs: 0,
    };
    g.frp_sum = Number((g.frp_sum + item.frp_sum).toFixed(1));
    g.count += item.count;
    g.count_modis += item.count_modis;
    g.count_viirs += item.count_viirs;
    globalSeasonalityMap.set(gKey, g);
  }

  const seasonality: SeasonalityRecord[] = [
    ...Array.from(globalSeasonalityMap.values()).map((g) => ({
      ...g,
      region_id: 'all',
    })),
    ...regionalSeasonality,
  ];

  // Build GRID_CELLS GeoJSON (0.5 deg x 0.5 deg spatial grid cells across active regions & months)
  const gridFeatures: GridCellsGeoJson['features'] = [];
  let cellCounter = 1;

  for (const profile of REGION_PROFILES) {
    for (const [centerLon, centerLat] of profile.hotspotsCenters) {
      for (let dLon = -0.5; dLon <= 0.5; dLon += 0.5) {
        for (let dLat = -0.5; dLat <= 0.5; dLat += 0.5) {
          const lon = Number((centerLon + dLon + (rand() - 0.5) * 0.12).toFixed(3));
          const lat = Number((centerLat + dLat + (rand() - 0.5) * 0.12).toFixed(3));
          const peakMonth = Math.min(12, Math.max(1, Math.round(profile.peakDayOfYear / 30.4)));
          const activeMonths = [
            ((peakMonth + 10) % 12) + 1,
            peakMonth,
            (peakMonth % 12) + 1,
          ];

          for (const m of activeMonths) {
            const distFromCenter = Math.hypot(dLon, dLat);
            const spatialWeight = distFromCenter === 0 ? 1.35 : 0.72;
            const monthWeight = m === peakMonth ? 1.4 : 0.8;
            const count = Math.max(
              14,
              Math.round((85 + rand() * 190) * spatialWeight * monthWeight),
            );
            const frp_sum = Number(
              (count * profile.meanFrpPerHotspot * (0.85 + rand() * 0.3)).toFixed(1),
            );
            const cell_id = `CELL-${profile.meta.region_id.toUpperCase()}-${String(cellCounter++).padStart(4, '0')}`;
            const halfSize = 0.22;

            const props: GridCellRecord = {
              cell_id,
              lat,
              lon,
              month: m,
              frp_sum,
              count,
              region_id: profile.meta.region_id,
            };

            gridFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [lon - halfSize, lat - halfSize],
                    [lon + halfSize, lat - halfSize],
                    [lon + halfSize, lat + halfSize],
                    [lon - halfSize, lat + halfSize],
                    [lon - halfSize, lat - halfSize],
                  ],
                ],
              },
              properties: props,
            });
          }
        }
      }
    }
  }

  const gridCells: GridCellsGeoJson = {
    type: 'FeatureCollection',
    features: gridFeatures,
  };

  // Build RECENT_POINTS (detailed individual sensor detections for the last 21 days of 2025 + key anomaly dates)
  const recentPoints: RecentPointRecord[] = [];
  const targetSampleDates: string[] = [];

  // Last 21 days of dataset (2025-12-11 .. 2025-12-31) + peak summer/anomaly dates so any selected window has rich points
  for (let d = 11; d <= 31; d++) {
    targetSampleDates.push(`2025-12-${String(d).padStart(2, '0')}`);
  }
  for (const anom of INJECTED_ANOMALIES) {
    targetSampleDates.push(anom.start_date);
  }
  targetSampleDates.push('2025-08-14', '2025-08-15', '2024-09-05', '2023-08-21', '2021-08-05');

  let ptIdx = 1;
  for (const sampleDate of targetSampleDates) {
    for (const profile of REGION_PROFILES) {
      const pointsForRegionDate = sampleDate.startsWith('2025-12') ? 6 : 14;
      for (let i = 0; i < pointsForRegionDate; i++) {
        const center =
          profile.hotspotsCenters[Math.floor(rand() * profile.hotspotsCenters.length)];
        const lon = Number((center[0] + (rand() - 0.5) * 1.4).toFixed(4));
        const lat = Number((center[1] + (rand() - 0.5) * 1.1).toFixed(4));
        const isViirs = rand() < 0.74; // ~74% of individual point detections come from 375m VIIRS
        const sensor = isViirs ? ('VIIRS' as const) : ('MODIS' as const);
        const frp = Number(
          (
            (isViirs ? 14 + rand() * 95 : 28 + rand() * 145) *
            (sampleDate.includes('-08-') || sampleDate.includes('-09-') ? 1.4 : 0.9)
          ).toFixed(1),
        );
        const confRoll = rand();
        const confidence =
          confRoll > 0.62 ? ('high' as const) : confRoll > 0.18 ? ('nominal' as const) : ('low' as const);

        recentPoints.push({
          id: `PT-${String(ptIdx++).padStart(5, '0')}`,
          lat,
          lon,
          date: sampleDate,
          sensor,
          frp,
          confidence,
          region_id: profile.meta.region_id,
        });
      }
    }
  }

  // Build VALIDATION (monthly pairs across 2021-01 to 2025-12, correlation, bias, scaling_factor)
  const monthly_pairs: ValidationMonthlyPair[] = [];
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const gKey = `${y}:${m}`;
      const g = globalSeasonalityMap.get(gKey);
      if (g) {
        const monthLabel = `${y}-${String(m).padStart(2, '0')}`;
        monthly_pairs.push({
          month: monthLabel,
          modis: g.count_modis,
          viirs: g.count_viirs,
          harmonized: g.count,
          frp_modis: Number((g.frp_sum * 0.44).toFixed(1)),
          frp_viirs: Number((g.frp_sum * 0.56).toFixed(1)),
          region_id: 'all',
        });
      }
    }
  }

  const validation: ValidationData = {
    monthly_pairs,
    correlation: 0.942,
    bias: -14.8,
    scaling_factor: 0.294,
    rmse: 184.6,
    sample_size: monthly_pairs.length,
  };

  const anomalies: AnomalyRecord[] = INJECTED_ANOMALIES.map((a) => ({
    start_date: a.start_date,
    end_date: a.end_date,
    region_id: a.region_id,
    score: a.score,
    reason: a.reason,
  })).sort((a, b) => b.score - a.score);

  const regionMeta: RegionMetaRecord[] = [
    {
      region_id: 'all',
      name: 'All monitored regions (Global composite)',
      bbox: [-130.0, -25.0, 45.0, 52.0],
      date_min: '2021-01-01',
      date_max: '2025-12-31',
      biome: 'Multi-biome global harmonization benchmark',
      description:
        'Combined active-fire series across Mediterranean, Amazonia, Western North America, and Sudano-Sahelian benchmark regions.',
    },
    ...REGION_PROFILES.map((p) => p.meta),
  ];

  const dataset: HarmonizedDataset = {
    dailySummary,
    gridCells,
    recentPoints,
    seasonality,
    anomalies,
    riskPeriods: [...RISK_PERIODS_SEED],
    validation,
    regionMeta,
    isDemoData: true,
  };

  // Validate against runtime Zod schema to guarantee 100% contract compliance
  cachedMockDataset = HarmonizedDatasetSchema.parse(dataset);
  return cachedMockDataset;
}
