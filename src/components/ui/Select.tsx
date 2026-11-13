import type { SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
}

export function Select({
  label,
  options,
  value,
  onChange,
  helperText,
  id,
  style,
  ...rest
}: SelectProps) {
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label
        htmlFor={selectId}
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 500,
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '7px 10px',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-night)',
          border: '1px solid var(--border-line)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          ...style,
        }}
        {...rest}
      >
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            style={{
              backgroundColor: '#0B1220',
              color: '#E6ECF5',
            }}
          >
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && (
        <span style={{ fontSize: '11px', color: 'var(--text-subtle)', lineHeight: 1.35 }}>
          {helperText}
        </span>
      )}
    </div>
  );
}
