import { useMemo } from 'react';
import { DESIGN_TOKENS, PLACEHOLDERS, USE_MOCK } from './config/placeholders';
import { generateMockDataset } from './data/mockGenerator';

export function App() {
  const dataset = useMemo(() => generateMockDataset(202610), []);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: DESIGN_TOKENS.night,
        color: DESIGN_TOKENS.text,
        padding: '24px',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          backgroundColor: DESIGN_TOKENS.panel,
          border: `1px solid ${DESIGN_TOKENS.line}`,
          borderRadius: '8px',
          padding: '16px 20px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={PLACEHOLDERS.LOGO}
            alt="Project logo"
            width={36}
            height={36}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
              {PLACEHOLDERS.PROJECT_NAME}
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: DESIGN_TOKENS.muted }}>
              {PLACEHOLDERS.TAGLINE}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {USE_MOCK && (
            <span
              style={{
                backgroundColor: 'rgba(242, 107, 45, 0.16)',
                border: '1px solid #F26B2D',
                color: '#FFC247',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Demo data — synthetic seeded dataset
            </span>
          )}
          <span
            className="tabular-nums"
            style={{
              backgroundColor: DESIGN_TOKENS.night,
              border: `1px solid ${DESIGN_TOKENS.line}`,
              color: DESIGN_TOKENS.muted,
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          >
            Phase F0: Data contract verified
          </span>
        </div>
      </header>

      <main
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '14px',
        }}
      >
        <section
          style={{
            backgroundColor: DESIGN_TOKENS.panel,
            border: `1px solid ${DESIGN_TOKENS.line}`,
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: '15px', color: DESIGN_TOKENS.muted }}>
            Daily summary records
          </h2>
          <p className="tabular-nums" style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>
            {dataset.dailySummary.length.toLocaleString()}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: DESIGN_TOKENS.muted }}>
            5 years (2021–2025) across {dataset.regionMeta.length - 1} regional benchmarks
          </p>
        </section>

        <section
          style={{
            backgroundColor: DESIGN_TOKENS.panel,
            border: `1px solid ${DESIGN_TOKENS.line}`,
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: '15px', color: DESIGN_TOKENS.muted }}>
            Spatial grid cells &amp; recent points
          </h2>
          <p className="tabular-nums" style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>
            {dataset.gridCells.features.length.toLocaleString()} cells ·{' '}
            {dataset.recentPoints.length.toLocaleString()} pts
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: DESIGN_TOKENS.muted }}>
            Pre-aggregated GeoJSON polygons + recent sensor detections
          </p>
        </section>

        <section
          style={{
            backgroundColor: DESIGN_TOKENS.panel,
            border: `1px solid ${DESIGN_TOKENS.line}`,
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: '15px', color: DESIGN_TOKENS.muted }}>
            Validation &amp; anomaly catalog
          </h2>
          <p className="tabular-nums" style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>
            r = {dataset.validation.correlation} · {dataset.anomalies.length} anomalies
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: DESIGN_TOKENS.muted }}>
            Scaling factor {dataset.validation.scaling_factor} across{' '}
            {dataset.validation.monthly_pairs.length} monthly pairs
          </p>
        </section>
      </main>
    </div>
  );
}

export default App;
