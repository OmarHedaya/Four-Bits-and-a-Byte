import { AlertTriangle, ShieldAlert, ArrowUpRight } from 'lucide-react';
import type {
  AnomalyRecord,
  RegionMetaRecord,
  RiskPeriodRecord,
} from '../../contracts/schemas';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

export interface AnomalyRiskPanelProps {
  anomalies: readonly AnomalyRecord[];
  riskPeriods: readonly RiskPeriodRecord[];
  regions: readonly RegionMetaRecord[];
  highlightedRange: { start: string; end: string; label?: string } | null;
  onSelectAnomaly: (anom: AnomalyRecord) => void;
  onSelectRiskPeriod: (risk: RiskPeriodRecord) => void;
  expandToFill?: boolean;
}

export function AnomalyRiskPanel({
  anomalies,
  riskPeriods,
  regions,
  highlightedRange,
  onSelectAnomaly,
  onSelectRiskPeriod,
  expandToFill = false,
}: AnomalyRiskPanelProps) {
  const getRegionName = (regionId: string) =>
    regions.find((r) => r.region_id === regionId)?.name ?? regionId;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: expandToFill ? '14px' : '12px',
        flex: expandToFill ? 1 : undefined,
        height: expandToFill ? '100%' : undefined,
        justifyContent: expandToFill ? 'space-between' : undefined,
      }}
    >
      {/* 1. Ranked Historical Anomalies (ANOMALIES) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: expandToFill ? '8px' : '6px',
          flex: expandToFill ? '1.15 1 0%' : undefined,
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text-bright)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} color="#F26B2D" />
            Unusual conditions (Ranked Z-score departures)
          </span>
          <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {anomalies.length} episodes
          </span>
        </div>

        {anomalies.length === 0 ? (
          <EmptyState
            title="No anomalies in selected window"
            description="No ≥3σ multi-day departures recorded for the active region and year filter."
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: expandToFill ? '8px' : '6px',
              flex: expandToFill ? 1 : undefined,
              maxHeight: expandToFill ? '540px' : '285px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {anomalies.map((anom) => {
              const isSelected =
                highlightedRange?.start === anom.start_date &&
                highlightedRange?.end === anom.end_date;

              return (
                <button
                  key={`${anom.region_id}-${anom.start_date}`}
                  type="button"
                  onClick={() => onSelectAnomaly(anom)}
                  style={{
                    textAlign: 'left',
                    backgroundColor: isSelected
                      ? 'rgba(242, 107, 45, 0.16)'
                      : 'rgba(11, 18, 32, 0.72)',
                    border: `1px solid ${
                      isSelected ? '#F26B2D' : 'var(--border-line)'
                    }`,
                    borderRadius: 'var(--radius-md)',
                    padding: expandToFill ? '10px 12px' : '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    flex: expandToFill && anomalies.length <= 5 ? 1 : undefined,
                    gap: '4px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      className="tabular-nums"
                      style={{
                        fontWeight: 600,
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-bright)',
                      }}
                    >
                      {anom.start_date} → {anom.end_date}
                    </span>
                    <Badge tone="anomaly">+{anom.score.toFixed(2)}σ</Badge>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: '#9BB2FF',
                      fontWeight: 500,
                    }}
                  >
                    <span>{getRegionName(anom.region_id)}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      Jump calendar &amp; map <ArrowUpRight size={12} />
                    </span>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: '11.5px',
                      color: 'var(--text-muted)',
                      lineHeight: 1.35,
                    }}
                  >
                    {anom.reason}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. High-Risk Planning Windows (RISK_PERIODS) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: expandToFill ? '8px' : '6px',
          flex: expandToFill ? '1 1 0%' : undefined,
          minHeight: 0,
          paddingTop: expandToFill ? '12px' : '10px',
          borderTop: '1px solid var(--border-line)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text-bright)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={14} color="#FFC247" />
            High-risk climatological windows
          </span>
          <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {riskPeriods.length} windows
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: expandToFill ? '8px' : '6px',
            flex: expandToFill ? 1 : undefined,
            maxHeight: expandToFill ? '480px' : '235px',
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          {riskPeriods.map((risk) => {
            const driversList = Array.isArray(risk.drivers)
              ? risk.drivers
              : [risk.drivers];

            return (
              <button
                key={`${risk.region_id}-${risk.window}`}
                type="button"
                onClick={() => onSelectRiskPeriod(risk)}
                style={{
                  textAlign: 'left',
                  backgroundColor: 'rgba(11, 18, 32, 0.72)',
                  border: '1px solid var(--border-line)',
                  borderRadius: 'var(--radius-md)',
                  padding: expandToFill ? '10px 12px' : '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  flex: expandToFill && riskPeriods.length <= 5 ? 1 : undefined,
                  gap: '4px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-bright)',
                    }}
                  >
                    {risk.window}
                  </span>
                  <Badge tone="risk">Risk {risk.risk_score}/100</Badge>
                </div>

                <div style={{ fontSize: '11px', color: '#9BB2FF', fontWeight: 500 }}>
                  {getRegionName(risk.region_id)}
                </div>

                <ul
                  style={{
                    margin: '1px 0 0',
                    paddingLeft: '15px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    lineHeight: 1.35,
                  }}
                >
                  {driversList.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
