import { AlertOctagon, AlertTriangle, BellOff, CheckCircle2, MapPin, Volume2, VolumeX } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { FireRiskLevel } from './firecastEngine';
import { Button } from '../../components/ui/Button';

export interface EmergencyHazardPayload {
  heading: string;
  dangerType: string;
  severity: FireRiskLevel;
  locationLabel: string;
  coordinates: { lat: number; lon: number };
  selectedDate: string;
  isReportedIncident?: boolean;
}

export interface EmergencyAlertSystemProps {
  activeEmergency: boolean;
  acknowledged: boolean;
  soundPlaying: boolean;
  soundMuted: boolean;
  highRiskWarningOnly: boolean;
  hazard: EmergencyHazardPayload;
  onAcknowledge: () => void;
  onMuteSound: () => void;
  onReplaySound: () => void;
}

export function EmergencyAlertSystem({
  activeEmergency,
  acknowledged,
  soundPlaying,
  soundMuted,
  highRiskWarningOnly,
  hazard,
  onAcknowledge,
  onMuteSound,
  onReplaySound,
}: EmergencyAlertSystemProps) {
  const reducedMotion = useReducedMotion();

  if (!activeEmergency && !highRiskWarningOnly) {
    return null;
  }

  // HIGH Risk Warning Banner (Strong visual warning without full emergency flashing/alarm)
  if (highRiskWarningOnly && !activeEmergency) {
    return (
      <section
        role="alert"
        aria-live="polite"
        data-testid="high-risk-warning-banner"
        style={{
          background:
            'linear-gradient(95deg, rgba(242, 107, 45, 0.24) 0%, rgba(19, 28, 46, 0.92) 100%)',
          border: '2px solid #F26B2D',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 8px 28px rgba(242, 107, 45, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <AlertTriangle size={24} color="#FFC247" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 700,
                color: '#FFF1B8',
                letterSpacing: '0.02em',
              }}
            >
              HIGH FIRE RISK WARNING — ELEVATED SEASONAL THERMAL ACTIVITY
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: '#E6ECF5', marginTop: '3px' }}>
              <strong>Danger Type:</strong> {hazard.dangerType} ·{' '}
              <strong>Severity:</strong> {hazard.severity} ·{' '}
              <strong>Location:</strong> {hazard.locationLabel} ({hazard.coordinates.lat.toFixed(3)}°N,{' '}
              {hazard.coordinates.lon.toFixed(3)}°E)
            </div>
          </div>
        </div>
        <div style={{ fontSize: '11.5px', color: '#FFC247', fontWeight: 600 }}>
          Visual Warning Active (Audible Siren Reserved for EXTREME Risk)
        </div>
      </section>
    );
  }

  // EXTREME Risk or Active Reported Hazard -> Full Emergency Alert System
  const isFlashingActive = activeEmergency && !acknowledged;

  return (
    <>
      {/* Non-blocking Full-Viewport Perimeter Screen Effect (respects prefers-reduced-motion) */}
      {isFlashingActive && (
        <div
          aria-hidden="true"
          data-testid="emergency-screen-effect"
          className={
            reducedMotion ? 'emergency-screen-static' : 'emergency-screen-flash'
          }
        />
      )}

      {/* High-Visibility Emergency Alert Banner & Control Deck */}
      <section
        role="alertdialog"
        aria-live="assertive"
        aria-label={hazard.heading}
        data-testid="emergency-alert-banner"
        className={
          isFlashingActive && !reducedMotion
            ? 'emergency-banner-pulse'
            : undefined
        }
        style={{
          position: 'relative',
          zIndex: 35,
          background: acknowledged
            ? 'linear-gradient(100deg, rgba(68, 18, 24, 0.88) 0%, rgba(19, 28, 46, 0.96) 100%)'
            : 'linear-gradient(100deg, rgba(168, 18, 24, 0.94) 0%, rgba(78, 12, 18, 0.96) 60%, rgba(28, 12, 20, 0.98) 100%)',
          border: `2px solid ${acknowledged ? 'rgba(255, 59, 48, 0.65)' : '#FF3B30'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          boxShadow: acknowledged
            ? '0 8px 24px rgba(0, 0, 0, 0.5)'
            : '0 0 36px rgba(255, 59, 48, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 59, 48, 0.28)',
                border: '1px solid #FF8A80',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertOctagon size={26} color="#FFF1B8" />
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                >
                  {hazard.heading}
                </span>
                <span
                  style={{
                    padding: '2px 10px',
                    borderRadius: '999px',
                    backgroundColor: '#FF3B30',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  SEVERITY: {hazard.severity}
                </span>
                {acknowledged && (
                  <span
                    data-testid="alert-acknowledged-badge"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 10px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(46, 196, 182, 0.24)',
                      border: '1px solid #2EC4B6',
                      color: '#A8F5EC',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle2 size={12} />
                    Alert Acknowledged &amp; Alarm Silenced
                  </span>
                )}
              </div>

              <div
                style={{
                  marginTop: '6px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '8px 18px',
                  fontSize: 'var(--text-xs)',
                  color: '#FFE4E1',
                }}
              >
                <div>
                  <strong style={{ color: '#FFF1B8' }}>Type of Danger:</strong>{' '}
                  {hazard.dangerType}
                </div>
                <div>
                  <strong style={{ color: '#FFF1B8' }}>Target Date:</strong>{' '}
                  <span className="tabular-nums">{hazard.selectedDate}</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <MapPin size={13} color="#FFF1B8" />
                  <strong style={{ color: '#FFF1B8' }}>Location &amp; Coordinates:</strong>{' '}
                  <span className="tabular-nums">
                    {hazard.locationLabel} ({hazard.coordinates.lat.toFixed(4)}°N,{' '}
                    {hazard.coordinates.lon.toFixed(4)}°E)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Action & Audio Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {soundPlaying && !soundMuted ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<VolumeX size={14} />}
                onClick={onMuteSound}
                aria-label="Mute / Stop Sound"
              >
                Mute / Stop Sound
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                icon={soundMuted ? <BellOff size={14} /> : <Volume2 size={14} />}
                onClick={onReplaySound}
                aria-label="Test / Replay Alarm Sound"
              >
                {soundMuted ? 'Sound Muted (Replay)' : 'Sound Stopped (Replay)'}
              </Button>
            )}

            {!acknowledged && (
              <Button
                size="sm"
                variant="primary"
                icon={<CheckCircle2 size={14} />}
                onClick={onAcknowledge}
                aria-label="Acknowledge & Stop Alarm"
              >
                Acknowledge &amp; Stop Alarm
              </Button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
