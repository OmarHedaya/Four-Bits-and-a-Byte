import { Satellite, Users, Database, ShieldCheck } from 'lucide-react';
import { PLACEHOLDERS } from '../config/placeholders';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';

export function AboutPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Mission & Brand Showcase */}
      <Card
        heroBorder
        title={`About ${PLACEHOLDERS.PROJECT_NAME}`}
        subtitle="NASA Space Apps Challenge 2026 — Harmonization of MODIS and VIIRS Hot Spots"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >
          <img
            src={PLACEHOLDERS.LOGO}
            alt={`${PLACEHOLDERS.PROJECT_NAME} emblem`}
            width={88}
            height={88}
            style={{
              borderRadius: '18px',
              border: '1px solid rgba(242, 107, 45, 0.65)',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.6)',
            }}
          />
          <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Badge tone="modis">MODIS Terra &amp; Aqua (~1 km)</Badge>
              <Badge tone="viirs">VIIRS Suomi-NPP &amp; NOAA-20/21 (~375 m)</Badge>
              <Badge tone="neutral">Team: Four-Bits-and-a-Byte</Badge>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.55 }}>
              Active-fire hotspot records from NASA&apos;s MODIS and VIIRS instruments provide complementary views of global wildfire activity, but differ in spatial footprint (1 km vs. 375 m), confidence reporting (0–100% vs. categorical classes), and diurnal overpass timing.{' '}
              <strong>{PLACEHOLDERS.PROJECT_NAME}</strong> bridges these two orbital records into a unified fire-activity calendar and mission-control workstation for emergency responders, Earth scientists, and land managers.
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Team Roster (TEAM_NAMES) */}
      <Card
        title="Team Four-Bits-and-a-Byte"
        subtitle="Multidisciplinary engineering, Earth observation, and data visualization team"
        action={<Users size={16} color="#7E9DFF" />}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '12px',
          }}
        >
          {PLACEHOLDERS.TEAM_NAMES.map((member) => (
            <div
              key={member.name}
              style={{
                backgroundColor: 'rgba(11, 18, 32, 0.72)',
                border: '1px solid var(--border-line)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-bright)' }}>
                {member.name}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: '#7E9DFF', fontWeight: 500 }}>
                {member.role}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {member.focus}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Sensor Specifications & Data Credits */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '14px',
        }}
      >
        <Card
          title="Orbital instrument comparison (MODIS vs VIIRS)"
          subtitle="Primary radiometric & orbital characteristics"
          action={<Satellite size={16} color="#3CC4C4" />}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              className="tabular-nums"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 'var(--text-xs)',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-line)', color: 'var(--text-muted)' }}>
                  <th style={{ textAlign: 'left', padding: '7px 8px' }}>Parameter</th>
                  <th style={{ textAlign: 'left', padding: '7px 8px', color: 'var(--sensor-modis)' }}>
                    MODIS (C6.1)
                  </th>
                  <th style={{ textAlign: 'left', padding: '7px 8px', color: 'var(--sensor-viirs)' }}>
                    VIIRS (375 m)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>Spacecraft</td>
                  <td style={{ padding: '7px 8px' }}>Terra (1999), Aqua (2002)</td>
                  <td style={{ padding: '7px 8px' }}>Suomi-NPP (2011), NOAA-20/21</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>Nadir resolution</td>
                  <td style={{ padding: '7px 8px' }}>~1,000 m × 1,000 m</td>
                  <td style={{ padding: '7px 8px' }}>~375 m × 375 m (I-bands)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>Confidence scale</td>
                  <td style={{ padding: '7px 8px' }}>0% to 100% numeric</td>
                  <td style={{ padding: '7px 8px' }}>Low (&quot;l&quot;), Nominal (&quot;n&quot;), High (&quot;h&quot;)</td>
                </tr>
                <tr>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>Local equator crossing</td>
                  <td style={{ padding: '7px 8px' }}>10:30 / 22:30 &amp; 13:30 / 01:30</td>
                  <td style={{ padding: '7px 8px' }}>~13:30 daytime / ~01:30 nighttime</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Data sources, credits & project boundaries"
          subtitle="Attribution and responsible operational usage"
          action={<Database size={16} color="#B79CFF" />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <div>
              <strong style={{ color: 'var(--text-bright)' }}>NASA FIRMS &amp; LANCE:</strong> Active-fire hotspot architecture designed for NASA Fire Information for Resource Management System (FIRMS), Land, Atmosphere Near real-time Capability for EOS (LANCE).
            </div>
            <div>
              <strong style={{ color: 'var(--text-bright)' }}>Basemap &amp; WebGL Engine:</strong> Map rendered with MapLibre GL JS and CARTO Dark Matter vector tiles (© OpenStreetMap contributors, © CARTO).
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#FFC247' }}>
              <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Operational disclaimer:</strong> When the &quot;Demo data&quot; badge is active in the top bar, all displayed counts, FRP totals, and anomalies are generated from our deterministic seeded simulation (`VITE_USE_MOCK=true`) to validate the data contract before ingesting full FIRMS archives.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
