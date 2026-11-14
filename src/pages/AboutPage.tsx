import { Satellite, Database, ShieldCheck, PlayCircle } from 'lucide-react';
import { PLACEHOLDERS } from '../config/placeholders';
import { Badge, Card } from '../components/ui';

export function AboutPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Mission & Brand Showcase */}
      <Card
        heroBorder
        title={`About ${PLACEHOLDERS.PROJECT_NAME}`}
        subtitle="Satellite Thermal Anomaly & Hotspot Monitoring Across Egypt (2023–2025)"
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
              <Badge tone="modis">MODIS Terra &amp; Aqua (~1,000 m)</Badge>
              <Badge tone="viirs">VIIRS S-NPP, NOAA-20 &amp; NOAA-21 (~375 m)</Badge>
              <Badge tone="neutral">Egypt 2023–2025</Badge>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.55 }}>
              <strong>{PLACEHOLDERS.PROJECT_NAME}</strong> combines NASA FIRMS satellite fire detections across Egypt (2023–2025) from four orbital instruments—MODIS (Terra and Aqua) and VIIRS (Suomi-NPP, NOAA-20, and NOAA-21)—into a unified daily and regional fire monitoring view for emergency responders, planners, and researchers.
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Sensor Specifications & Data Credits */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '14px',
        }}
      >
        <Card
          title="Orbital instrument comparison (MODIS vs VIIRS)"
          subtitle="Complementary satellite sensors monitoring Egypt"
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
                    VIIRS (S-NPP, NOAA-20/21)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>Spacecraft</td>
                  <td style={{ padding: '7px 8px' }}>Terra (1999), Aqua (2002)</td>
                  <td style={{ padding: '7px 8px' }}>S-NPP, NOAA-20, NOAA-21</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>Spatial resolution</td>
                  <td style={{ padding: '7px 8px' }}>~1,000 m × 1,000 m</td>
                  <td style={{ padding: '7px 8px' }}>~375 m × 375 m</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>Small-fire sensitivity</td>
                  <td style={{ padding: '7px 8px' }}>Moderate (large perimeters)</td>
                  <td style={{ padding: '7px 8px' }}>High (detects smaller agricultural fires)</td>
                </tr>
                <tr>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>Local overpass times</td>
                  <td style={{ padding: '7px 8px' }}>10:00–14:00 &amp; 22:00–02:00 Cairo</td>
                  <td style={{ padding: '7px 8px' }}>12:00–14:00 daytime / 01:00–02:00 nighttime</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Data sources & usage notes"
          subtitle="Attribution and operational guidance"
          action={<Database size={16} color="#B79CFF" />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <div>
              <strong style={{ color: 'var(--text-bright)' }}>NASA FIRMS &amp; LANCE:</strong> Thermal anomaly data for Egypt (2023–2025) provided by the NASA Fire Information for Resource Management System (MODIS &amp; VIIRS).
            </div>
            <div>
              <strong style={{ color: 'var(--text-bright)' }}>Interactive Map Engine:</strong> Powered by MapLibre GL JS and CARTO Dark Matter vector tiles (© OpenStreetMap contributors, © CARTO).
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#FFC247' }}>
              <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>How to read the numbers:</strong> Overlapping MODIS and VIIRS passes on the same day and ~5 km grid cell are combined into a single unified active fire cell-day so the same fire is not counted twice.
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Project Overview Video Showcase at the Bottom */}
      <Card
        heroBorder
        title="Mission Overview & Platform Walkthrough"
        subtitle="Visualizing satellite thermal anomaly harmonization and fire risk intelligence across Egypt"
        action={<PlayCircle size={18} color="#FFC247" />}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            backgroundColor: 'rgba(6, 10, 18, 0.78)',
            border: '1px solid rgba(255, 194, 71, 0.25)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: '0 10px 32px rgba(0, 0, 0, 0.55)',
          }}
        >
          <video
            src="/About_Video.mp4"
            controls
            playsInline
            preload="metadata"
            data-testid="about-overview-video"
            style={{
              width: '100%',
              maxHeight: '540px',
              display: 'block',
              objectFit: 'contain',
              backgroundColor: '#050811',
            }}
          >
            Your browser does not support the HTML5 video tag.
          </video>
        </div>
      </Card>
    </div>
  );
}
