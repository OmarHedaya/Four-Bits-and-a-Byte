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
      ? 'linear-gradient(135deg, #2E46C2 0%, #2438A8 100%)'
      : 'linear-gradient(135deg, #273B9E 0%, #1E2E82 100%)',
    secondary: active ? 'var(--bg-panel-active)' : 'rgba(19, 28, 46, 0.78)',
    ghost: active ? 'rgba(93, 123, 222, 0.18)' : 'transparent',
    thermal: 'rgba(242, 107, 45, 0.18)',
  };

  const borderMap: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: active ? '#7E9DFF' : 'rgba(126, 157, 255, 0.45)',
    secondary: active ? 'var(--orbital-periwinkle)' : 'var(--border-line)',
    ghost: active ? 'rgba(126, 157, 255, 0.4)' : 'transparent',
    thermal: '#F26B2D',
  };

  const colorMap: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: '#FFFFFF',
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
