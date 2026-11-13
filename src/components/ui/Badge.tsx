import type { ReactNode } from 'react';

export interface BadgeProps {
  tone?: 'neutral' | 'modis' | 'viirs' | 'demo' | 'anomaly' | 'risk';
  children: ReactNode;
  title?: string;
}

export function Badge({ tone = 'neutral', children, title }: BadgeProps) {
  const stylesByTone: Record<
    NonNullable<BadgeProps['tone']>,
    { bg: string; border: string; color: string }
  > = {
    neutral: {
      bg: 'var(--bg-night)',
      border: 'var(--border-line)',
      color: 'var(--text-muted)',
    },
    modis: {
      bg: 'var(--sensor-modis-bg)',
      border: 'var(--sensor-modis)',
      color: 'var(--sensor-modis)',
    },
    viirs: {
      bg: 'var(--sensor-viirs-bg)',
      border: 'var(--sensor-viirs)',
      color: 'var(--sensor-viirs)',
    },
    demo: {
      bg: 'rgba(242, 107, 45, 0.14)',
      border: '#F26B2D',
      color: '#FFC247',
    },
    anomaly: {
      bg: 'rgba(201, 48, 107, 0.18)',
      border: '#C9306B',
      color: '#FFF1B8',
    },
    risk: {
      bg: 'rgba(242, 107, 45, 0.18)',
      border: '#F26B2D',
      color: '#FFF1B8',
    },
  };

  const current = stylesByTone[tone];

  return (
    <span
      title={title}
      className="tabular-nums"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        borderRadius: 'var(--radius-pill)',
        backgroundColor: current.bg,
        border: `1px solid ${current.border}`,
        color: current.color,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
