import { NavLink } from 'react-router-dom';
import { Orbit } from 'lucide-react';
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
  { to: '/patterns', label: 'Patterns & anomalies' },
  { to: '/method', label: 'Method & validation' },
  { to: '/about', label: 'About' },
];

export function TopBar({ isDemoData }: TopBarProps) {
  const audienceMode = useFilterStore((s) => s.audienceMode);
  const setAudienceMode = useFilterStore((s) => s.setAudienceMode);

  return (
    <header
      style={{
        backgroundColor: 'rgba(13, 19, 33, 0.84)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(59, 81, 120, 0.45)',
        boxShadow: '0 4px 24px rgba(4, 8, 18, 0.45)',
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
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(242, 107, 45, 0.55)',
              boxShadow: '0 0 14px rgba(242, 107, 45, 0.25)',
              flexShrink: 0,
              backgroundColor: '#0B1220',
            }}
          >
            <img
              src={PLACEHOLDERS.LOGO}
              alt={`${PLACEHOLDERS.PROJECT_NAME} satellite-fire emblem`}
              width={40}
              height={40}
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
              }}
            >
              <span>{PLACEHOLDERS.PROJECT_NAME}</span>
              <span className="orbital-pill" style={{ padding: '2px 8px', fontSize: '11px' }}>
                <Orbit size={11} />
                Terra · Aqua · S-NPP · NOAA-20
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.25, marginTop: '2px' }}>
              Next-generation satellite earth observation &amp; active-fire harmonization
            </div>
          </div>
        </NavLink>

        {isDemoData && (
          <Badge
            tone="demo"
            title="All statistics and hotspots currently rendered come from the deterministic seeded mock generator until real teammate files are switched via VITE_USE_MOCK=false."
          >
            Demo data
          </Badge>
        )}
      </div>

      {/* Center: 5 Demo Screens Navigation (Figma Satellite Cobalt Pill Active State) */}
      <nav
        aria-label="Primary views"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexWrap: 'wrap',
          backgroundColor: 'rgba(11, 18, 32, 0.65)',
          border: '1px solid rgba(59, 81, 120, 0.38)',
          borderRadius: '10px',
          padding: '3px',
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
              color: isActive ? '#FFFFFF' : 'var(--text-muted)',
              background: isActive
                ? 'linear-gradient(135deg, #273B9E 0%, #1E2E82 100%)'
                : 'transparent',
              border: isActive
                ? '1px solid rgba(126, 157, 255, 0.45)'
                : '1px solid transparent',
              boxShadow: isActive
                ? 'inset 0 1px 0 rgba(255,255,255,0.16), 0 2px 10px rgba(36, 56, 168, 0.35)'
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
