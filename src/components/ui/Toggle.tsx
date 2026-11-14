import type { ReactNode } from 'react';

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
  dotColor?: string;
  badge?: string;
}

export interface SegmentedToggleProps<T extends string> {
  label?: string;
  options: ReadonlyArray<ToggleOption<T>>;
  value: T;
  onChange: (next: T) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  ariaLabel?: string;
}

export function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  ariaLabel,
}: SegmentedToggleProps<T>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {label && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
      )}
      <div
        role="group"
        aria-label={ariaLabel || label || 'Segmented options'}
        style={{
          display: fullWidth ? 'grid' : 'inline-flex',
          gridTemplateColumns: fullWidth ? `repeat(${options.length}, minmax(0, 1fr))` : undefined,
          backgroundColor: 'var(--bg-night)',
          border: '1px solid var(--border-line)',
          borderRadius: 'var(--radius-md)',
          padding: '2px',
          gap: '2px',
        }}
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(opt.value)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: size === 'sm' ? '4px 8px' : '6px 10px',
                fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
                fontWeight: isSelected ? 600 : 500,
                fontFamily: 'var(--font-sans)',
                color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                backgroundColor: isSelected ? 'var(--bg-panel-active)' : 'transparent',
                border: isSelected
                  ? '1px solid var(--border-line-strong)'
                  : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {opt.dotColor && (
                <span
                  aria-hidden="true"
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: opt.dotColor,
                    flexShrink: 0,
                  }}
                />
              )}
              <span>{opt.label}</span>
              {opt.badge && (
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                  }}
                >
                  {opt.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface SwitchToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  accentColor?: string;
}

export function SwitchToggle({
  checked,
  onChange,
  label,
  accentColor = 'var(--sensor-modis)',
}: SwitchToggleProps) {
  return (
    <label
      style={{
        display: ' inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-primary)',
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          accentColor,
          width: '15px',
          height: '15px',
          cursor: 'pointer',
        }}
      />
      <span>{label}</span>
    </label>
  );
}
