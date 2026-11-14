import { useNavigate } from 'react-router-dom';
import { Satellite, Database, ShieldCheck, Server, ArrowRight } from 'lucide-react';
import { PLACEHOLDERS } from '../config/placeholders';
import { Badge, Button, Card } from '../components/ui';

export function AboutPage() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Mission & Brand Showcase */}
      <Card
        heroBorder
        title={`About ${PLACEHOLDERS.PROJECT_NAME}`}
        subtitle="FireScope — Analysis of Thermal Anomaly & Hotspot Activity in Egypt (2023–2025) from NASA FIRMS MODIS & VIIRS"
        action={
          <Button
            size="sm"
            variant="primary"
            icon={<ArrowRight size={14} />}
            onClick={() => navigate('/atlas')}
          >
            Explore Phase 6 Atlas
          </Button>
        }
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
              <Badge tone="neutral">Egypt 2023–2025 · 254,175 Rows</Badge>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.55 }}>
              <strong>{PLACEHOLDERS.PROJECT_NAME} (FireScope)</strong> unifies 254,175 archival NASA FIRMS detections across Egypt (2023–2025) from four orbital instruments—MODIS (Terra/Aqua) and VIIRS (Suomi-NPP, NOAA-20, NOAA-21)—onto a common <strong>0.05° × 0.05° (~5 km) spatial grid</strong> and a <strong>1,096-day coverage calendar</strong>. It separates 84,689 Type 0 vegetation fire candidates from 168,263 Type 2 persistent industrial/gas-flare detections and computes the coverage-normalized <strong>Fire Activity Index (FAI)</strong> anchored to Frozen Baseline v1 (<em>B</em> = 32.4975 cell-days/day).
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Sensor Specifications & Data Credits */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '14px',
        }}
      >
        <Card
          title="Orbital instrument comparison (MODIS vs VIIRS)"
          subtitle="Empirical performance across Egypt (2023–2025)"
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
                  <td style={{ padding: '7px 8px' }}>S-NPP, NOAA-20, NOAA-21 (from 2023-03-01)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>Nadir resolution</td>
                  <td style={{ padding: '7px 8px' }}>~1,000 m × 1,000 m</td>
                  <td style={{ padding: '7px 8px' }}>~375 m × 375 m (I-bands)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>Egypt 2023–25 rows</td>
                  <td style={{ padding: '7px 8px' }}>4,127 (3,457 Veg · 665 Static)</td>
                  <td style={{ padding: '7px 8px' }}>250,048 (81,232 Veg · 167,598 Static)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(38, 52, 77, 0.45)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>Confidence scale</td>
                  <td style={{ padding: '7px 8px' }}>0% to 100% numeric (mean 67.7%)</td>
                  <td style={{ padding: '7px 8px' }}>Low (&quot;l&quot; ~13%), Nominal (&quot;n&quot; ~84%), High (&quot;h&quot; ~3%)</td>
                </tr>
                <tr>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>Cairo overpass peaks</td>
                  <td style={{ padding: '7px 8px' }}>10:00–14:00 &amp; 22:00–02:00 LT</td>
                  <td style={{ padding: '7px 8px' }}>12:00–14:00 daytime / 01:00–02:00 nighttime</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Full-Stack Pipeline & Backend Architecture"
          subtitle="Integrated 6-phase Python pipeline (backend/) + React/MapLibre mission control"
          action={<Server size={16} color="#FFC247" />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <div>
              <strong style={{ color: 'var(--text-bright)' }}>Python Pipeline (`backend/src/`):</strong> End-to-end deterministic modules for Phase 1 Audit, Phase 2 Cleaning (`data_cleaning.py`), Phase 3 Harmonization (`harmonize.py`), Phase 4 Analysis (`phase4_analysis.py`), Phase 5 FAI Index (`phase5_index.py`), and Phase 6 Visualization (`phase6_visualization.py`).
            </div>
            <div>
              <strong style={{ color: 'var(--text-bright)' }}>Backend REST API (`backend/api_server.py`):</strong> Serves `/api/firescope/health`, `/api/firescope/bundle`, `/api/firescope/baseline`, and `/api/firescope/table/:stage/:name` directly from `backend/data/`.
            </div>
            <div>
              <strong style={{ color: 'var(--text-bright)' }}>Frontend Data Bridge (`scripts/build_firescope_frontend_data.mjs`):</strong> Compiles all 49 analytical & index CSV/JSON tables and 28 Phase 6 figures into Zod-validated frontend contracts.
            </div>
          </div>
        </Card>

        <Card
          title="Data sources, credits & scientific reading rules"
          subtitle="Attribution and responsible operational usage"
          action={<Database size={16} color="#B79CFF" />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <div>
              <strong style={{ color: 'var(--text-bright)' }}>NASA FIRMS &amp; LANCE:</strong> Archival thermal anomaly data for Egypt (2023–2025) from NASA Fire Information for Resource Management System (MODIS C6.1 &amp; VIIRS 375 m S-NPP, NOAA-20, NOAA-21).
            </div>
            <div>
              <strong style={{ color: 'var(--text-bright)' }}>Basemap &amp; WebGL Engine:</strong> Map rendered with MapLibre GL JS and CARTO Dark Matter vector tiles (© OpenStreetMap contributors, © CARTO) plus Folium/Leaflet HTML layers.
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#FFC247' }}>
              <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Scientific reading rule:</strong> Raw detections across MODIS and VIIRS are never summed as independent fires. All headline trends use 0.05° × 0.05° cell-day presence normalized by usable sensor coverage days (<em>kappa</em>).
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
