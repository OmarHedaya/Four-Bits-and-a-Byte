import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'thermal';
  size?: 'sm' | 'md';
  active?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  active = false,
  icon,
  children,
  style,
  ...rest
}: ButtonProps) {
  const bgMap: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: active
      ? 'linear-gradient(135deg, rgba(242, 107, 45, 0.42) 0%, rgba(49, 75, 196, 0.85) 100%)'
      : 'linear-gradient(135deg, rgba(242, 107, 45, 0.28) 0%, rgba(39, 59, 158, 0.82) 100%)',
    secondary: active ? 'var(--bg-panel-active)' : 'rgba(15, 22, 38, 0.72)',
    ghost: active ? 'rgba(255, 194, 71, 0.16)' : 'transparent',
    thermal: 'rgba(242, 107, 45, 0.2)',
  };

  const borderMap: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: active ? '#FFC247' : 'rgba(255, 194, 71, 0.52)',
    secondary: active ? 'var(--orbital-gold)' : 'rgba(255, 214, 138, 0.2)',
    ghost: active ? 'rgba(255, 194, 71, 0.4)' : 'transparent',
    thermal: '#F26B2D',
  };

  const colorMap: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: '#FFF1B8',
    secondary: active ? 'var(--text-bright)' : 'var(--text-primary)',
    ghost: active ? 'var(--text-bright)' : 'var(--text-muted)',
    thermal: '#FFC247',
  };

  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: size === 'sm' ? '5px 11px' : '8px 15px',
        fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
        fontWeight: active || variant === 'primary' ? 600 : 500,
        fontFamily: 'var(--font-sans)',
        background: bgMap[variant],
        color: colorMap[variant],
        border: `1px solid ${borderMap[variant]}`,
        borderRadius: 'var(--radius-md)',
        boxShadow:
          variant === 'primary'
            ? 'inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 14px rgba(36, 56, 168, 0.4)'
            : undefined,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        opacity: rest.disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
