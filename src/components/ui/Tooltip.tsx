import { useState, type ReactNode } from 'react';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="tabular-nums"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            backgroundColor: '#0B1220',
            border: '1px solid var(--border-line-strong)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-primary)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
