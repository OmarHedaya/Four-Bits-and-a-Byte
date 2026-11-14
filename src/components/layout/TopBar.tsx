import { NavLink } from 'react-router-dom';
import { PLACEHOLDERS } from '../../config/placeholders';
import { useFilterStore, type AudienceMode } from '../../store/useFilterStore';
import { Badge } from '../ui/Badge';
import { SegmentedToggle, type ToggleOption } from '../ui/Toggle';

export interface TopBarProps {
  isDemoData: boolean;
}

const AUDIENCE_OPTIONS: ReadonlyArray<ToggleOption<AudienceMode>> = [
  { value: 'responder', label: 'Responder' },
  { value: 'scientist', label: 'Scientist' },
  { value: 'planner', label: 'Planner' },
];

const NAV_ITEMS: ReadonlyArray<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Overview', end: true },
  { to: '/explore', label: 'Explore' },
  { to: '/patterns', label: 'Patterns & FAI' },
  { to: '/method', label: 'Method & validation' },
  { to: '/atlas', label: 'Phase 6 Atlas' },
  { to: '/about', label: 'About' },
];

export function TopBar({ isDemoData }: TopBarProps) {
  const audienceMode = useFilterStore((s) => s.audienceMode);
  const setAudienceMode = useFilterStore((s) => s.setAudienceMode);

  return (
    <header
      style={{
        background:
          'linear-gradient(180deg, rgba(6, 10, 18, 0.42) 0%, rgba(10, 16, 28, 0.62) 100%)',
        backdropFilter: 'blur(10px) saturate(135%)',
        WebkitBackdropFilter: 'blur(10px) saturate(135%)',
        borderBottom: '1px solid rgba(255, 194, 71, 0.24)',
        boxShadow: '0 6px 28px rgba(4, 7, 15, 0.45)',
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Left: Uploaded Satellite-Fire Emblem & Project Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <NavLink
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            textDecoration: 'none',
            color: 'var(--text-primary)',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 194, 71, 0.65)',
              boxShadow: '0 0 16px rgba(242, 107, 45, 0.32)',
              flexShrink: 0,
              backgroundColor: '#0B1220',
            }}
          >
            <img
              src={PLACEHOLDERS.LOGO}
              alt={`${PLACEHOLDERS.PROJECT_NAME} satellite-fire emblem`}
              width={42}
              height={42}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: 'var(--text-md)',
                fontWeight: 600,
                color: 'var(--text-bright)',
                letterSpacing: '-0.015em',
                lineHeight: 1.2,
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.65)',
              }}
            >
              <span>{PLACEHOLDERS.PROJECT_NAME}</span>
            </div>
            <div
              style={{
                fontSize: '11.5px',
                color: '#C8D4E8',
                lineHeight: 1.25,
                marginTop: '2px',
                textShadow: '0 1px 6px rgba(0, 0, 0, 0.7)',
              }}
            >
              FireScope Egypt (2023–2025) · MODIS &amp; VIIRS (S-NPP, NOAA-20, NOAA-21)
            </div>
          </div>
        </NavLink>

        {isDemoData ? (
          <Badge
            tone="demo"
            title="All statistics and hotspots currently rendered come from the deterministic seeded mock generator."
          >
            Demo data
          </Badge>
        ) : (
          <Badge
            tone="modis"
            title="Empirical Egypt 2023–2025 NASA FIRMS archive (254,175 harmonized rows · Phase 5 Frozen Baseline v1)"
          >
            Egypt 2023–2025 · Baseline v1
          </Badge>
        )}
      </div>

      {/* Center: 5 Demo Screens Navigation (Galactic Gold + Orbital Indigo Pill Active State) */}
      <nav
        aria-label="Primary views"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexWrap: 'wrap',
          backgroundColor: 'rgba(8, 13, 24, 0.56)',
          border: '1px solid rgba(255, 214, 138, 0.22)',
          borderRadius: '10px',
          padding: '3px',
          boxShadow: 'inset 0 1px 0 rgba(255, 241, 184, 0.08)',
        }}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              padding: '6px 13px',
              borderRadius: '7px',
              fontSize: 'var(--text-sm)',
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              color: isActive ? '#FFF1B8' : 'var(--text-primary)',
              background: isActive
                ? 'linear-gradient(135deg, rgba(242, 107, 45, 0.28) 0%, rgba(46, 70, 194, 0.65) 100%)'
                : 'transparent',
              border: isActive
                ? '1px solid rgba(255, 194, 71, 0.55)'
                : '1px solid transparent',
              boxShadow: isActive
                ? 'inset 0 1px 0 rgba(255, 241, 184, 0.22), 0 2px 12px rgba(242, 107, 45, 0.22)'
                : undefined,
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Right: Audience Mode Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Audience mode:
        </span>
        <SegmentedToggle
          ariaLabel="Audience mode"
          size="sm"
          options={AUDIENCE_OPTIONS}
          value={audienceMode}
          onChange={setAudienceMode}
        />
      </div>
    </header>
  );
}
