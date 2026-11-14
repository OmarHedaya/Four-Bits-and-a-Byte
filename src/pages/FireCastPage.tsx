import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Info,
  Radio,
  Satellite,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type {
  DailySummaryRecord,
  GridCellsGeoJson,
  RecentPointRecord,
  RegionMetaRecord,
} from '../contracts/schemas';
import { useFilterStore } from '../store/useFilterStore';
import { Badge, Button, Card } from '../components/ui';
import { FireMap } from '../features/map/FireMap';
import {
  evaluateFireCastRisk,
  RISK_LEVEL_CATALOG,
  validateFireCastDate,
  type FireCastAnalysisResult,
  type FireRiskLevel,
} from '../features/firecast/firecastEngine';
import {
  EmergencyAlertSystem,
  type EmergencyHazardPayload,
} from '../features/firecast/EmergencyAlertSystem';
import { emergencyAlarm } from '../features/firecast/alarmSound';

export interface FireCastPageProps {
  dailyRecords: readonly DailySummaryRecord[];
  gridCells: GridCellsGeoJson;
  recentPoints: readonly RecentPointRecord[];
  regions: readonly RegionMetaRecord[];
}

const ALL_RISK_LEVELS: readonly FireRiskLevel[] = [
  'LOW',
  'MODERATE',
  'HIGH',
  'EXTREME',
];

const SATELLITE_FILTER_OPTIONS = [
  'ALL',
  'Terra',
  'Aqua',
  'Suomi-NPP',
  'NOAA-20',
  'NOAA-21',
] as const;

export function FireCastPage({
  dailyRecords,
  gridCells,
  recentPoints,
  regions,
}: FireCastPageProps) {
  const regionId = useFilterStore((s) => s.regionId);
  const metric = useFilterStore((s) => s.metric);
  const showGridHeat = useFilterStore((s) => s.showGridHeat);
  const showModisPoints = useFilterStore((s) => s.showModisPoints);
  const showViirsPoints = useFilterStore((s) => s.showViirsPoints);
  const setShowGridHeat = useFilterStore((s) => s.setShowGridHeat);
  const setShowModisPoints = useFilterStore((s) => s.setShowModisPoints);
  const setShowViirsPoints = useFilterStore((s) => s.setShowViirsPoints);
  const setSelectedDate = useFilterStore((s) => s.setSelectedDate);

  const activeRegionMeta = regions.find((r) => r.region_id === regionId);
  const activeRegionName = activeRegionMeta?.name ?? 'All Egypt (National Scope)';

  // Controlled date input & analysis state
  const [dateInput, setDateInput] = useState<string>('2026-10-15');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzedDate, setAnalyzedDate] = useState<string>('2026-10-15');
  const [satelliteFilter, setSatelliteFilter] =
    useState<(typeof SATELLITE_FILTER_OPTIONS)[number]>('ALL');

  // Emergency Alert System state
  const [alertActive, setAlertActive] = useState<boolean>(false);
  const [alertAcknowledged, setAlertAcknowledged] = useState<boolean>(false);
  const [soundPlaying, setSoundPlaying] = useState<boolean>(false);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [alarmOnHighRisk, setAlarmOnHighRisk] = useState<boolean>(false);
  const [customHazardOverride, setCustomHazardOverride] =
    useState<EmergencyHazardPayload | null>(null);

  // Manual hazard report form state
  const [reportDangerType, setReportDangerType] = useState<string>(
    'Active Vegetation Fire / Critical Multi-Cell Thermal Plume',
  );
  const [reportLocation, setReportLocation] = useState<string>(
    'Nile Delta & Sharkia Agricultural Corridor',
  );
  const [reportLat, setReportLat] = useState<string>('30.7850');
  const [reportLon, setReportLon] = useState<string>('31.4950');

  // Clean up alarm sound when leaving FireCastPage
  useEffect(() => {
    return () => {
      emergencyAlarm.stopAlarm();
    };
  }, []);

  const analysisResult: FireCastAnalysisResult | null = useMemo(() => {
    const check = validateFireCastDate(analyzedDate);
    if (!check.valid) return null;
    try {
      return evaluateFireCastRisk({
        targetDate: analyzedDate,
        regionId,
        regionName: activeRegionName,
        regionBbox: activeRegionMeta?.bbox,
        dailyRecords,
        recentPoints,
      });
    } catch {
      return null;
    }
  }, [analyzedDate, regionId, activeRegionName, activeRegionMeta, dailyRecords, recentPoints]);

  const triggerAlertForResult = (res: FireCastAnalysisResult, forceAlarm = false) => {
    const shouldActivateEmergency =
      forceAlarm ||
      res.riskLevel === 'EXTREME' ||
      (alarmOnHighRisk && res.riskLevel === 'HIGH');

    if (shouldActivateEmergency) {
      setCustomHazardOverride(null);
      setAlertActive(true);
      setAlertAcknowledged(false);
      emergencyAlarm.startAlarm();
      setSoundPlaying(true);
      setSoundMuted(false);
    } else {
      emergencyAlarm.stopAlarm();
      setAlertActive(false);
      setAlertAcknowledged(false);
      setSoundPlaying(false);
      setSoundMuted(false);
      setCustomHazardOverride(null);
    }
  };

  const runAnalysisForDate = (targetDateStr: string) => {
    const check = validateFireCastDate(targetDateStr);
    if (!check.valid) {
      setValidationError(check.error ?? 'Invalid date.');
      return;
    }
    setValidationError(null);
    setIsAnalyzing(true);

    // Brief interactive progress transition so loading state is clearly observable
    setTimeout(() => {
      setAnalyzedDate(check.cleanedDate);
      setIsAnalyzing(false);
      try {
        const res = evaluateFireCastRisk({
          targetDate: check.cleanedDate,
          regionId,
          regionName: activeRegionName,
          regionBbox: activeRegionMeta?.bbox,
          dailyRecords,
          recentPoints,
        });
        if (!res.isFuturePrediction) {
          setSelectedDate(check.cleanedDate);
        }
        triggerAlertForResult(res);
      } catch (err) {
        setValidationError(
          err instanceof Error ? err.message : 'Unable to evaluate risk.',
        );
      }
    }, 120);
  };

  const handleAcknowledgeAlert = () => {
    emergencyAlarm.stopAlarm();
    setAlertAcknowledged(true);
    setSoundPlaying(false);
    setSoundMuted(true);
  };

  const handleMuteSound = () => {
    emergencyAlarm.stopSoundOnly();
    setSoundPlaying(false);
    setSoundMuted(true);
  };

  const handleReplaySound = () => {
    emergencyAlarm.startAlarm();
    setSoundPlaying(true);
    setSoundMuted(false);
  };

  const handleReportActiveHazard = () => {
    const latNum = Number(reportLat);
    const lonNum = Number(reportLon);
    const safeLat = Number.isFinite(latNum) ? latNum : 30.785;
    const safeLon = Number.isFinite(lonNum) ? lonNum : 31.495;

    setCustomHazardOverride({
      heading: 'EXTREME FIRE RISK ALERT — ACTIVE FIRE HAZARD REPORTED',
      dangerType: reportDangerType,
      severity: 'EXTREME',
      locationLabel: reportLocation,
      coordinates: { lat: safeLat, lon: safeLon },
      selectedDate: analyzedDate,
      isReportedIncident: true,
    });
    setAlertActive(true);
    setAlertAcknowledged(false);
    emergencyAlarm.startAlarm();
    setSoundPlaying(true);
    setSoundMuted(false);
  };

  const activeHazardPayload: EmergencyHazardPayload = useMemo(() => {
    if (customHazardOverride) return customHazardOverride;
    if (analysisResult) {
      return {
        ...analysisResult.emergencyHazardDetails,
        selectedDate: analysisResult.selectedDate,
      };
    }
    return {
      heading: 'EXTREME FIRE RISK ALERT',
      dangerType: 'Critical Thermal Anomaly Hazard',
      severity: 'EXTREME',
      locationLabel: activeRegionName,
      coordinates: { lat: 30.785, lon: 31.495 },
      selectedDate: analyzedDate,
    };
  }, [customHazardOverride, analysisResult, activeRegionName, analyzedDate]);

  // Records to display in the Satellite & Sensor table
  const displayedTelemetryRecords = useMemo(() => {
    if (!analysisResult) return [];
    const baseList = analysisResult.isFuturePrediction
      ? analysisResult.historicalContextRecords
      : analysisResult.observedSensorRecords.length > 0
        ? analysisResult.observedSensorRecords
        : analysisResult.historicalContextRecords;

    if (satelliteFilter === 'ALL') return baseList;
    return baseList.filter((r) => r.satellite_name === satelliteFilter);
  }, [analysisResult, satelliteFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. FireCast Hero Header */}
      <section className="orbital-telemetry-banner">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '6px',
                flexWrap: 'wrap',
              }}
            >
              <span className="orbital-pill">
                <Sparkles size={13} />
                FireCast · Satellite Fire Risk Forecasting &amp; Early Warning
              </span>
              <Badge tone="modis">Chronologically Validated (2023–2025)</Badge>
              <Badge tone="viirs">5 Orbital Sensors Tracked</Badge>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--text-2xl)',
                fontWeight: 700,
                color: 'var(--text-bright)',
                letterSpacing: '-0.02em',
              }}
            >
              FireCast –{' '}
              <span className="orbital-headline-accent">
                Fire Risk Forecasting &amp; Emergency Alert System
              </span>
            </h1>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 'var(--text-sm)',
                color: '#D5DFEE',
                maxWidth: '820px',
              }}
            >
              Explore future fire risk through satellite-based environmental analysis. Strictly
              separates historical NASA FIRMS observations (2023–2025) from experimental future
              seasonal forecasts and activates an immediate audio-visual Emergency Alert System on
              EXTREME hazards.
            </p>
          </div>

          {/* Quick Scenario Presets for Rapid Inspection */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              alignItems: 'flex-end',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Quick Scenario Presets:
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDateInput('2026-10-15');
                  runAnalysisForDate('2026-10-15');
                }}
              >
                Future Peak (2026-10-15)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDateInput('2026-01-20');
                  runAnalysisForDate('2026-01-20');
                }}
              >
                Future Low (2026-01-20)
              </Button>
              <Button
                size="sm"
                variant="thermal"
                onClick={() => {
                  setDateInput('2023-10-20');
                  runAnalysisForDate('2023-10-20');
                }}
              >
                Extreme Event (2023-10-20)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDateInput('2024-04-29');
                  runAnalysisForDate('2024-04-29');
                }}
              >
                High Event (2024-04-29)
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Emergency Warning & Alert System (Activates on EXTREME risk or reported active hazard) */}
      <EmergencyAlertSystem
        activeEmergency={alertActive}
        acknowledged={alertAcknowledged}
        soundPlaying={soundPlaying}
        soundMuted={soundMuted}
        highRiskWarningOnly={
          !alertActive && analysisResult?.riskLevel === 'HIGH'
        }
        hazard={activeHazardPayload}
        onAcknowledge={handleAcknowledgeAlert}
        onMuteSound={handleMuteSound}
        onReplaySound={handleReplaySound}
      />

      {/* 3. Date Selection, Risk Analysis Trigger & Active Hazard Reporting Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '12px',
          alignItems: 'stretch',
        }}
      >
        <Card
          heroBorder
          title="1. Select Target Date & Analyze Fire Risk"
          subtitle={`Active regional scope: ${activeRegionName} · Historical archive: 2023-01-01 to 2025-12-31 · Future forecast horizon: 2026-01-01 to 2030-12-31`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: '1 1 220px' }}>
                <label
                  htmlFor="firecast-date-input"
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--text-bright)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Calendar size={13} color="#FFC247" />
                  Target Analysis Date (YYYY-MM-DD)
                </label>
                <input
                  id="firecast-date-input"
                  aria-label="Target Analysis Date (YYYY-MM-DD)"
                  type="date"
                  min="2023-01-01"
                  max="2030-12-31"
                  value={dateInput}
                  onChange={(e) => {
                    setDateInput(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  style={{
                    backgroundColor: 'var(--bg-night)',
                    border: `1px solid ${validationError ? '#FF3B30' : 'var(--border-line-strong)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    color: 'var(--text-bright)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-sans)',
                  }}
                />
              </div>

              <Button
                variant="primary"
                size="md"
                icon={<Activity size={15} />}
                onClick={() => runAnalysisForDate(dateInput)}
                disabled={isAnalyzing}
                aria-label="Analyze Risk"
              >
                {isAnalyzing ? 'Analyzing Risk...' : 'Analyze Risk'}
              </Button>
            </div>

            {/* Optional HIGH-risk audible alarm preference */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={alarmOnHighRisk}
                onChange={(e) => setAlarmOnHighRisk(e.target.checked)}
              />
              <span>
                Also trigger audible emergency siren on <strong>HIGH</strong> risk (by default,
                audible alarm activates only on <strong>EXTREME</strong> risk or reported active fire)
              </span>
            </label>

            {validationError && (
              <div
                role="alert"
                data-testid="firecast-date-error"
                style={{
                  backgroundColor: 'rgba(255, 59, 48, 0.16)',
                  border: '1px solid #FF3B30',
                  borderRadius: 'var(--radius-md)',
                  padding: '9px 12px',
                  fontSize: 'var(--text-xs)',
                  color: '#FFD2CE',
                }}
              >
                <strong>Date Validation Error:</strong> {validationError}
              </div>
            )}

            {isAnalyzing && (
              <div
                role="status"
                aria-live="polite"
                data-testid="firecast-loading-indicator"
                style={{
                  backgroundColor: 'rgba(60, 196, 196, 0.12)',
                  border: '1px solid var(--sensor-modis)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  fontSize: 'var(--text-xs)',
                  color: '#FFF1B8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Clock size={14} color="#3CC4C4" />
                <span>
                  Evaluating chronological seasonal regime model &amp; checking multi-sensor
                  coverage for <strong>{dateInput}</strong>...
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Active Fire / Critical Hazard Emergency Trigger */}
        <Card
          title="2. Report Active Fire / Trigger Emergency Hazard Alert"
          subtitle="Immediately activate the audio-visual Emergency Alert System for critical field detections or active thermal hazards"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="hazard-type-input"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  Hazard / Danger Type
                </label>
                <input
                  id="hazard-type-input"
                  type="text"
                  value={reportDangerType}
                  onChange={(e) => setReportDangerType(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-night)',
                    border: '1px solid var(--border-line)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 9px',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-xs)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="hazard-location-input"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  Location Description
                </label>
                <input
                  id="hazard-location-input"
                  type="text"
                  value={reportLocation}
                  onChange={(e) => setReportLocation(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-night)',
                    border: '1px solid var(--border-line)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 9px',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-xs)',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', flex: '1 1 200px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                  <label
                    htmlFor="hazard-lat-input"
                    style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                  >
                    Latitude (°N)
                  </label>
                  <input
                    id="hazard-lat-input"
                    type="text"
                    value={reportLat}
                    onChange={(e) => setReportLat(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-night)',
                      border: '1px solid var(--border-line)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 8px',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-xs)',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                  <label
                    htmlFor="hazard-lon-input"
                    style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                  >
                    Longitude (°E)
                  </label>
                  <input
                    id="hazard-lon-input"
                    type="text"
                    value={reportLon}
                    onChange={(e) => setReportLon(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-night)',
                      border: '1px solid var(--border-line)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 8px',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-xs)',
                    }}
                  />
                </div>
              </div>

              <Button
                variant="thermal"
                size="sm"
                icon={<AlertOctagon size={14} />}
                onClick={handleReportActiveHazard}
                aria-label="Trigger Emergency Hazard Alert"
              >
                Trigger Emergency Hazard Alert
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. Primary Risk Classification Results & 4-Tier Visual Gauge */}
      {analysisResult && (
        <>
          <Card
            heroBorder
            title={`Fire Risk Classification for ${analysisResult.selectedDate}`}
            subtitle={`${analysisResult.regionName} · ${
              analysisResult.isFuturePrediction
                ? 'FUTURE RISK PREDICTION (Experimental Model Forecast)'
                : 'HISTORICAL OBSERVATION (NASA FIRMS Empirical Record)'
            }`}
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Badge tone={analysisResult.isFuturePrediction ? 'demo' : 'modis'}>
                  {analysisResult.isFuturePrediction
                    ? 'FUTURE PREDICTION (Experimental)'
                    : 'HISTORICAL OBSERVATION (Observed)'}
                </Badge>
                <Badge
                  tone={
                    analysisResult.riskLevel === 'EXTREME' || analysisResult.riskLevel === 'HIGH'
                      ? 'anomaly'
                      : 'neutral'
                  }
                >
                  {analysisResult.riskMeta.label}
                </Badge>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Top Summary Banner with Selected Date, Risk Level, and Calibrated Exceedance Percentile */}
              <div
                data-testid="firecast-primary-result-card"
                style={{
                  backgroundColor: analysisResult.riskMeta.bgTint,
                  border: `2px solid ${analysisResult.riskMeta.borderColor}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 20px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    SELECTED ANALYSIS DATE
                  </div>
                  <div
                    className="tabular-nums"
                    data-testid="firecast-selected-date-display"
                    style={{
                      fontSize: 'var(--text-2xl)',
                      fontWeight: 800,
                      color: 'var(--text-bright)',
                      marginTop: '2px',
                    }}
                  >
                    {analysisResult.selectedDate}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#D5DFEE', marginTop: '2px' }}>
                    {analysisResult.isFuturePrediction
                      ? 'Future Forecast Date (No Satellite Overpass Yet)'
                      : 'Historical Archive Date (Observed NASA FIRMS Data)'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {analysisResult.isFuturePrediction
                      ? 'PREDICTED FIRE RISK LEVEL'
                      : 'OBSERVED FIRE RISK LEVEL'}
                  </div>
                  <div
                    data-testid="firecast-risk-tier-display"
                    style={{
                      fontSize: 'var(--text-2xl)',
                      fontWeight: 800,
                      color: analysisResult.riskMeta.color,
                      marginTop: '2px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Flame size={22} color={analysisResult.riskMeta.color} />
                    {analysisResult.riskLevel}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {analysisResult.riskMeta.label}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    CALIBRATED CLIMATOLOGICAL EXCEEDANCE
                  </div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: 'var(--text-xl)',
                      fontWeight: 700,
                      color: '#FFF1B8',
                      marginTop: '2px',
                    }}
                  >
                    {analysisResult.climatologicalPercentile.toFixed(1)}th Percentile
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Empirical rank vs. 2023–2024 training baseline (not a point-ignition probability)
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {analysisResult.isFuturePrediction
                      ? 'PROJECTED ACTIVE 0.05° CELLS'
                      : 'OBSERVED ACTIVE 0.05° CELLS'}
                  </div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: 'var(--text-xl)',
                      fontWeight: 700,
                      color: 'var(--text-bright)',
                      marginTop: '2px',
                    }}
                  >
                    {analysisResult.isFuturePrediction && analysisResult.predictedSummary
                      ? `${analysisResult.predictedSummary.expectedCellDays.toFixed(1)} cells/day`
                      : `${analysisResult.observedSummary?.activeCellDays.toLocaleString() ?? 0} cells/day`}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {analysisResult.isFuturePrediction && analysisResult.predictedSummary
                      ? `Uncertainty band: ${analysisResult.predictedSummary.uncertaintyBandLow.toFixed(1)}–${analysisResult.predictedSummary.uncertaintyBandHigh.toFixed(1)} cells`
                      : `Total FRP: ${analysisResult.observedSummary?.totalFrpMw.toLocaleString() ?? 0} MW · Z = ${analysisResult.observedSummary?.anomalyZ.toFixed(2) ?? '0.00'}σ`}
                  </div>
                </div>
              </div>

              {/* 4-Tier Visual Gauge & Standardized Classification Matrix */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '10px',
                }}
              >
                {ALL_RISK_LEVELS.map((lvl) => {
                  const meta = RISK_LEVEL_CATALOG[lvl];
                  const isCurrent = analysisResult.riskLevel === lvl;
                  return (
                    <div
                      key={lvl}
                      data-testid={`risk-tier-card-${lvl}`}
                      style={{
                        backgroundColor: isCurrent ? meta.bgTint : 'rgba(11, 18, 32, 0.65)',
                        border: `${isCurrent ? '2px' : '1px'} solid ${
                          isCurrent ? meta.color : 'var(--border-line)'
                        }`,
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        boxShadow: isCurrent ? `0 0 18px ${meta.bgTint}` : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 'var(--text-xs)',
                            color: meta.color,
                          }}
                        >
                          {meta.label}
                        </span>
                        {isCurrent && <Badge tone="demo">Active Tier</Badge>}
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '11px',
                          color: isCurrent ? 'var(--text-primary)' : 'var(--text-muted)',
                          lineHeight: 1.38,
                        }}
                      >
                        {meta.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Concise Explanation, Coverage Status & Model Status */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'rgba(11, 18, 32, 0.72)',
                    border: '1px solid var(--border-line)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      color: '#FFF1B8',
                      marginBottom: '4px',
                    }}
                  >
                    <Info size={14} color="#FFC247" />
                    Result Summary &amp; Operational Guidance
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                    {analysisResult.shortExplanation}
                  </p>
                  <p
                    style={{
                      margin: '6px 0 0',
                      fontSize: '11.5px',
                      color: '#9BB2FF',
                      fontWeight: 500,
                    }}
                  >
                    <strong>Posture:</strong> {analysisResult.riskMeta.operationalGuidance}
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(11, 18, 32, 0.72)',
                    border: '1px solid var(--border-line)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      color: '#3CC4C4',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Radio size={14} color="#3CC4C4" />
                      Data Coverage Status
                    </span>
                    <Badge tone="modis">{analysisResult.coverageStatus.statusBadge}</Badge>
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                    {analysisResult.coverageStatus.summaryText}
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(11, 18, 32, 0.72)',
                    border: '1px solid var(--border-line)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      color: '#B79CFF',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldAlert size={14} color="#B79CFF" />
                      Model Status &amp; Scientific Limitations
                    </span>
                    <Badge tone={analysisResult.modelStatus.isExperimental ? 'demo' : 'viirs'}>
                      {analysisResult.modelStatus.isExperimental
                        ? 'Experimental Forecast'
                        : 'Empirical Observation'}
                    </Badge>
                  </div>
                  <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-primary)' }}>
                    {analysisResult.modelStatus.scientificNote}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* 5. Satellite & Sensor Information Section (Terra, Aqua, Suomi-NPP, NOAA-20, NOAA-21) */}
          <Card
            title="Satellite & Sensor Information (Terra, Aqua, Suomi-NPP, NOAA-20, NOAA-21)"
            subtitle="Preserves original satellite identities and native confidence formats (MODIS numeric 0–100% vs. VIIRS categorical l / n / h)"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 5-Satellite Platform Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
                  gap: '10px',
                }}
              >
                {analysisResult.satellitePlatforms.map((sat) => (
                  <div
                    key={sat.satelliteName}
                    style={{
                      backgroundColor: 'rgba(11, 18, 32, 0.78)',
                      border: `1px solid ${
                        sat.sensorName === 'MODIS'
                          ? 'rgba(60, 196, 196, 0.38)'
                          : 'rgba(183, 156, 255, 0.38)'
                      }`,
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 'var(--text-sm)',
                          color: 'var(--text-bright)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Satellite
                          size={13}
                          color={sat.sensorName === 'MODIS' ? '#3CC4C4' : '#B79CFF'}
                        />
                        {sat.satelliteName} ({sat.sensorName})
                      </span>
                      <Badge tone={sat.sensorName === 'MODIS' ? 'modis' : 'viirs'}>
                        {sat.resolutionLabel}
                      </Badge>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Confidence Format:{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {sat.confidenceFormatLabel}
                      </strong>
                    </div>

                    {sat.observedOnDate === null ? (
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#FFC247',
                          fontWeight: 600,
                          marginTop: '2px',
                        }}
                      >
                        Future Date — Overpass Not Yet Acquired
                      </div>
                    ) : (
                      <div
                        className="tabular-nums"
                        style={{
                          fontSize: '11.5px',
                          color: sat.observedOnDate ? '#4ADE80' : '#FF8A80',
                          fontWeight: 600,
                          marginTop: '2px',
                        }}
                      >
                        {sat.observedOnDate ? 'Observed' : 'No Pass Recorded'} · Type 0 Veg:{' '}
                        {sat.vegCandidateDetections?.toLocaleString() ?? 0} · Type 2 Static:{' '}
                        {sat.staticDetections?.toLocaleString() ?? 0}
                      </div>
                    )}

                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      {sat.coverageNote}
                    </div>
                  </div>
                ))}
              </div>

              {/* Explicit Future Date Notice (Strict Separation Rule #6B) */}
              {analysisResult.isFuturePrediction && (
                <div
                  data-testid="future-date-no-observations-notice"
                  style={{
                    backgroundColor: 'rgba(255, 194, 71, 0.12)',
                    border: '1px solid rgba(255, 194, 71, 0.55)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <Info size={18} color="#FFC247" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                    <strong style={{ color: '#FFF1B8', display: 'block', marginBottom: '3px' }}>
                      No Satellite or Sensor Observations Exist Yet for Future Date{' '}
                      {analysisResult.selectedDate}
                    </strong>
                    Because <strong>{analysisResult.selectedDate}</strong> is in the future, live
                    orbital detections from Terra (MODIS), Aqua (MODIS), Suomi-NPP (VIIRS), NOAA-20
                    (VIIRS), and NOAA-21 (VIIRS) do not exist yet. FireCast never fabricates future
                    satellite detections. The table and map below display{' '}
                    <strong>
                      Historical Baseline Context ({analysisResult.historicalContextSummary.windowLabel})
                    </strong>{' '}
                    strictly as supporting seasonal reference.
                  </div>
                </div>
              )}

              {/* Filter Bar & Telemetry Table Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-bright)' }}>
                    {analysisResult.isFuturePrediction
                      ? `Supporting Historical Baseline Context (${analysisResult.historicalContextSummary.windowLabel})`
                      : analysisResult.observedSensorRecords.length > 0
                        ? `Observed Satellite Detections on ${analysisResult.selectedDate}`
                        : `Regional Satellite Telemetry Context around ${analysisResult.selectedDate}`}
                  </strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Showing {displayedTelemetryRecords.length} multi-sensor records · Native MODIS
                    numeric (0–100%) and VIIRS categorical (l / n / h) confidence preserved
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Filter by Satellite:
                  </span>
                  {SATELLITE_FILTER_OPTIONS.map((satOpt) => (
                    <Button
                      key={satOpt}
                      size="sm"
                      variant={satelliteFilter === satOpt ? 'primary' : 'secondary'}
                      active={satelliteFilter === satOpt}
                      onClick={() => setSatelliteFilter(satOpt)}
                    >
                      {satOpt === 'ALL' ? 'All 5 Satellites' : satOpt}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Interactive Multi-Sensor Telemetry Table */}
              <div
                style={{
                  overflowX: 'auto',
                  maxHeight: '340px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-line)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <table
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
                        textAlign: 'left',
                        color: 'var(--text-muted)',
                        backgroundColor: 'rgba(11, 18, 32, 0.95)',
                        position: 'sticky',
                        top: 0,
                      }}
                    >
                      <th style={{ padding: '8px 10px' }}>Satellite</th>
                      <th style={{ padding: '8px 10px' }}>Sensor</th>
                      <th style={{ padding: '8px 10px' }}>Date &amp; UTC Time</th>
                      <th style={{ padding: '8px 10px' }}>Lat / Lon</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Brightness (K)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>FRP (MW)</th>
                      <th style={{ padding: '8px 10px' }}>Native Confidence</th>
                      <th style={{ padding: '8px 10px' }}>Detection Type</th>
                      <th style={{ padding: '8px 10px' }}>Data Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTelemetryRecords.slice(0, 25).map((rec) => (
                      <tr
                        key={rec.record_id}
                        style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.5)' }}
                      >
                        <td
                          style={{
                            padding: '7px 10px',
                            fontWeight: 600,
                            color: 'var(--text-bright)',
                          }}
                        >
                          {rec.satellite_name}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <Badge tone={rec.instrument_name === 'MODIS' ? 'modis' : 'viirs'}>
                            {rec.instrument_name} ({rec.nominal_resolution_m} m)
                          </Badge>
                        </td>
                        <td className="tabular-nums" style={{ padding: '7px 10px' }}>
                          {rec.acquisition_date} {rec.acquisition_time_utc} UTC ({rec.daynight})
                        </td>
                        <td className="tabular-nums" style={{ padding: '7px 10px' }}>
                          {rec.latitude.toFixed(4)}°N, {rec.longitude.toFixed(4)}°E
                        </td>
                        <td
                          className="tabular-nums"
                          style={{ padding: '7px 10px', textAlign: 'right', color: '#FFC247' }}
                        >
                          {rec.brightness_k.toFixed(1)} K (T31: {rec.brightness_t31_k.toFixed(1)} K)
                        </td>
                        <td
                          className="tabular-nums"
                          style={{
                            padding: '7px 10px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#F26B2D',
                          }}
                        >
                          {rec.frp_mw.toFixed(1)} MW
                        </td>
                        <td className="tabular-nums" style={{ padding: '7px 10px' }}>
                          {rec.instrument_name === 'MODIS'
                            ? `${rec.confidence_numeric ?? 70}% (MODIS numeric)`
                            : `${rec.confidence_class ?? 'n'} (${
                                rec.confidence_class === 'h'
                                  ? 'high'
                                  : rec.confidence_class === 'l'
                                    ? 'low'
                                    : 'nominal'
                              } VIIRS class)`}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <Badge tone={rec.hotspot_type === 0 ? 'anomaly' : 'neutral'}>
                            {rec.hotspot_type === 0
                              ? 'Type 0 · Vegetation Fire Candidate'
                              : `Type ${rec.hotspot_type} · Static Thermal`}
                          </Badge>
                        </td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>
                          NASA FIRMS ({rec.sensor_key})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {/* 6. Spatial Context Map + Historical Context & Chronological Validation Split */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: '12px',
              alignItems: 'stretch',
            }}
          >
            <Card
              title={
                analysisResult.isFuturePrediction
                  ? `Historical Baseline Spatial Context Map (${analysisResult.regionName})`
                  : `Observed Spatial Hotspot Map (${analysisResult.selectedDate})`
              }
              subtitle={
                analysisResult.isFuturePrediction
                  ? 'Displays 2023–2025 historical 0.05° grid density strictly as baseline spatial reference for the forecast'
                  : 'Displays observed 0.05° thermal grid cells and satellite hotspot detections'
              }
            >
              <FireMap
                gridCells={gridCells}
                recentPoints={recentPoints}
                dailyRecords={dailyRecords}
                regionMeta={activeRegionMeta}
                metric={metric}
                selectedDate={
                  analysisResult.isFuturePrediction ? null : analysisResult.selectedDate
                }
                peakDate={analysisResult.selectedDate}
                showGridHeat={showGridHeat}
                showModisPoints={showModisPoints}
                showViirsPoints={showViirsPoints}
                onToggleGridHeat={setShowGridHeat}
                onToggleModisPoints={setShowModisPoints}
                onToggleViirsPoints={setShowViirsPoints}
                onSelectDate={(d) => {
                  if (d) {
                    setDateInput(d);
                    runAnalysisForDate(d);
                  }
                }}
                height={360}
              />
            </Card>

            <Card
              title="Historical Context & Chronological Model Validation"
              subtitle="Zero-leakage chronological train (2023–2024 H1), validation (2024 H2), and out-of-sample test (2025) evaluation"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Same-Season Historical Comparison (2023, 2024, 2025) */}
                <div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      color: 'var(--text-bright)',
                      marginBottom: '6px',
                    }}
                  >
                    Same-Date Historical Baseline ({analysisResult.historicalContextSummary.windowLabel})
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                      gap: '8px',
                    }}
                  >
                    {analysisResult.historicalContextSummary.sameSeasonYears.map((sy) => (
                      <div
                        key={sy.year}
                        style={{
                          backgroundColor: 'rgba(11, 18, 32, 0.72)',
                          border: '1px solid var(--border-line)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 10px',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {sy.date}
                        </div>
                        <div
                          className="tabular-nums"
                          style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: 700,
                            color: 'var(--text-bright)',
                            marginTop: '2px',
                          }}
                        >
                          {sy.cellDays} cells · {sy.totalFrpMw} MW
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: RISK_LEVEL_CATALOG[sy.riskLevel].color,
                          }}
                        >
                          Tier: {sy.riskLevel}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chronological Validation & Out-of-Sample Test Table */}
                <div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      color: 'var(--text-bright)',
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <span>Out-of-Sample Chronological Test Results (2025 Full Year)</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      Train: {analysisResult.validationSummary.trainWindow}
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '11.5px',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--border-line)',
                            textAlign: 'left',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <th style={{ padding: '6px 8px' }}>Forecaster</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>MAE</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>RMSE</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Pearson r</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Exact Tier Acc</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>±1 Tier Acc</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResult.validationSummary.testMetrics.map((m) => (
                          <tr
                            key={m.modelName}
                            style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.5)' }}
                          >
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                              {m.modelName}
                            </td>
                            <td
                              className="tabular-nums"
                              style={{ padding: '6px 8px', textAlign: 'right' }}
                            >
                              {m.mae.toFixed(2)}
                            </td>
                            <td
                              className="tabular-nums"
                              style={{ padding: '6px 8px', textAlign: 'right' }}
                            >
                              {m.rmse.toFixed(2)}
                            </td>
                            <td
                              className="tabular-nums"
                              style={{ padding: '6px 8px', textAlign: 'right', color: '#3CC4C4' }}
                            >
                              {m.pearsonR.toFixed(3)}
                            </td>
                            <td
                              className="tabular-nums"
                              style={{ padding: '6px 8px', textAlign: 'right' }}
                            >
                              {m.exactTierAccuracyPct.toFixed(1)}%
                            </td>
                            <td
                              className="tabular-nums"
                              style={{ padding: '6px 8px', textAlign: 'right', color: '#4ADE80' }}
                            >
                              {m.withinOneTierAccuracyPct.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Scientific Limitations & Additional Data Needed */}
                <div
                  style={{
                    backgroundColor: 'rgba(11, 18, 32, 0.65)',
                    border: '1px solid var(--border-line)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '9px 12px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    lineHeight: 1.45,
                  }}
                >
                  <strong style={{ color: '#FFF1B8', display: 'block', marginBottom: '3px' }}>
                    <CheckCircle2
                      size={12}
                      color="#FFC247"
                      style={{ verticalAlign: 'middle', marginRight: '4px' }}
                    />
                    Why Long-Range Forecasts Are Labeled Experimental:
                  </strong>
                  {analysisResult.modelStatus.limitations.map((lim) => (
                    <div key={lim} style={{ marginTop: '2px' }}>
                      • {lim}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
