import type { ReactNode } from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  variant?: 'empty' | 'error' | 'loading';
}

export function EmptyState({
  title = 'No fires recorded in this period',
  description = 'Try expanding the year range, selecting a broader region, or resetting the date filter.',
  actionLabel,
  onAction,
  icon,
  variant = 'empty',
}: EmptyStateProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px 20px',
        backgroundColor: 'rgba(11, 18, 32, 0.55)',
        border: `1px dashed ${variant === 'error' ? '#C9306B' : 'var(--border-line)'}`,
        borderRadius: 'var(--radius-md)',
        gap: '8px',
        minHeight: '160px',
      }}
    >
      {icon && <div style={{ color: 'var(--text-muted)' }}>{icon}</div>}
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: variant === 'error' ? '#FFC247' : 'var(--text-primary)',
        }}
      >
        {title}
      </p>
      <p
        style={{
          margin: 0,
          maxWidth: '420px',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}
      >
        {description}
      </p>
      {actionLabel && onAction && (
        <div style={{ marginTop: '6px' }}>
          <Button size="sm" variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
