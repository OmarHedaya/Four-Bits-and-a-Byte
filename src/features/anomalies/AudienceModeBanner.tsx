import { Flame, FlaskConical, CalendarRange } from 'lucide-react';
import type { AudienceMode } from '../../store/useFilterStore';
import { Badge } from '../../components/ui/Badge';

export interface AudienceModeBannerProps {
  mode: AudienceMode;
}

export function AudienceModeBanner({ mode }: AudienceModeBannerProps) {
  const config = {
    responder: {
      icon: <Flame size={15} color="#FFC247" />,
      title: 'Responder operational posture — Recent activity & perimeter radiative power first',
      detail:
        'Focused on 2024–2025 active fire windows, radiative power (MW) intensity, and high-confidence VIIRS 375 m perimeter detections for rapid triage.',
      badge: 'Priority: Recent FRP & Anomalies',
    },
    scientist: {
      icon: <FlaskConical size={15} color="#3CC4C4" />,
      title: 'Scientist analytical posture — Sensor harmonization & co-registration evidence first',
      detail:
        'Comparing raw MODIS (~1 km) vs VIIRS (~375 m) detection ratios (3.54x) against deduplicated harmonized clusters and standardized Z-score departures.',
      badge: 'Priority: Harmonization & Validation',
    },
    planner: {
      icon: <CalendarRange size={15} color="#B79CFF" />,
      title: 'Planner strategic posture — Multi-year seasonality & high-risk fuel windows first',
      detail:
        'Highlighting 5-year recurring seasonal fire regimes, month × year matrix recurrence, and climatological high-risk windows for resource staging.',
      badge: 'Priority: Seasonality & Risk Windows',
    },
  }[mode];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        backgroundColor: 'rgba(19, 28, 46, 0.72)',
        border: '1px solid rgba(93, 123, 222, 0.3)',
        borderRadius: 'var(--radius-md)',
        padding: '9px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {config.icon}
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-bright)' }}>
            {config.title}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {config.detail}
          </div>
        </div>
      </div>
      <Badge tone="neutral">{config.badge}</Badge>
    </div>
  );
}
