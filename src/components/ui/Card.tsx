import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  heroBorder?: boolean;
  noPadding?: boolean;
  as?: 'section' | 'article' | 'div';
  children: ReactNode;
}

export function Card({
  title,
  subtitle,
  action,
  heroBorder = false,
  noPadding = false,
  as: Component = 'section',
  children,
  style,
  ...rest
}: CardProps) {
  return (
    <Component
      style={{
        background:
          'linear-gradient(180deg, rgba(14, 21, 36, 0.72) 0%, rgba(19, 28, 46, 0.88) 100%)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${heroBorder ? 'rgba(255, 194, 71, 0.52)' : 'rgba(255, 214, 138, 0.14)'}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: heroBorder ? 'var(--shadow-hero)' : 'var(--shadow-panel)',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
      {...rest}
    >
      {(title || subtitle || action) && (
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '13px 18px',
            borderBottom: '1px solid rgba(255, 214, 138, 0.12)',
            background:
              'linear-gradient(180deg, rgba(255, 241, 184, 0.04) 0%, rgba(255, 255, 255, 0) 100%)',
            flexWrap: 'wrap',
          }}
        >
          <div>
            {title && (
              <h2
                style={{
                  margin: 0,
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--text-bright)',
                  lineHeight: 1.35,
                  letterSpacing: '-0.01em',
                }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  lineHeight: 1.4,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{action}</div>}
        </header>
      )}
      <div
        style={{
          padding: noPadding ? 0 : '15px 18px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </Component>
  );
}
