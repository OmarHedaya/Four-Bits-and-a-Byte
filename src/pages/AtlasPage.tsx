import { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge, Button, Card } from '../components/ui';
import {
  FIRESCOPE_BUNDLE,
  type FireScopeReportEntry,
  type FireScopeVizEntry,
} from '../data/firescopeBundle';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Figures (28)',
  national: 'National FAI (5)',
  spatial: 'Spatial & 1° Blocks (8)',
  sensors: '4-Sensor Diagnostics (5)',
  static_sources: 'Static Thermal Sources (3)',
  confidence: 'Confidence Sensitivity (2)',
  coverage: 'Coverage & Gaps (4)',
  seasonal: 'Seasonal Cycle (1)',
  patterns: 'Diurnal & Day/Night (2)',
};

export function AtlasPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeLightbox, setActiveLightbox] = useState<FireScopeVizEntry | null>(null);
  const [activeInteractiveUrl, setActiveInteractiveUrl] = useState<{
    title: string;
    url: string;
  } | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string>('phase5');

  const pngFigures = useMemo(
    () =>
      FIRESCOPE_BUNDLE.visualizations.filter((v) => {
        if (selectedCategory !== 'all' && v.category !== selectedCategory) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            v.title.toLowerCase().includes(q) ||
            v.figure_id.toLowerCase().includes(q) ||
            v.category.toLowerCase().includes(q) ||
            v.source_tables.some((t) => t.toLowerCase().includes(q))
          );
        }
        return true;
      }),
    [selectedCategory, searchQuery],
  );

  const interactiveEntries = useMemo(
    () => FIRESCOPE_BUNDLE.visualizations.filter((v) => v.format === 'html'),
    [],
  );

  const activeReport: FireScopeReportEntry =
    FIRESCOPE_BUNDLE.reports.find((r) => r.id === selectedReportId) ??
    FIRESCOPE_BUNDLE.reports[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Header Banner */}
      <Card
        heroBorder
        title="Phase 6 Scientific Visualization Atlas & Pipeline Reports (Egypt 2023–2025)"
        subtitle="Complete suite of 26 publication-grade scientific PNG figures, 2 interactive HTML canvases, and Phase 1–6 technical documentation"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Badge tone="modis">26 PNG Figures</Badge>
            <Badge tone="viirs">2 Interactive HTML Maps</Badge>
            <Badge tone="neutral">7 Pipeline Reports</Badge>
          </div>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(11, 18, 32, 0.75)',
              border: '1px solid rgba(60, 196, 196, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Harmonized Egypt Archive
            </div>
            <div
              className="tabular-nums"
              style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: '#3CC4C4', marginTop: '2px' }}
            >
              {FIRESCOPE_BUNDLE.project.total_harmonized_rows.toLocaleString()} rows
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              84,689 Type 0 Veg · 168,263 Type 2 Static
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(11, 18, 32, 0.75)',
              border: '1px solid rgba(255, 194, 71, 0.38)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Headline FAI Trajectory (v1)
            </div>
            <div
              className="tabular-nums"
              style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: '#FFC247', marginTop: '2px' }}
            >
              126.0 → 98.7 → 73.5
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              2023 to 2025 (-40.6% on 337 matched days)
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(11, 18, 32, 0.75)',
              border: '1px solid rgba(183, 156, 255, 0.38)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              0.05° Grid &amp; 1° Analytical Blocks
            </div>
            <div
              className="tabular-nums"
              style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: '#B79CFF', marginTop: '2px' }}
            >
              3,596 cells · 39 blocks
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              45,595 VIIRS veg cell-days · 96 clusters
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(11, 18, 32, 0.75)',
              border: '1px solid rgba(60, 196, 196, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Automated Verification Suite
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                color: '#4ADE80',
                marginTop: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 size={18} color="#4ADE80" />
              74 / 74 Passed
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              21 Phase 4 checks + 53 Phase 5 FAI checks
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Interactive HTML Visualizations Launcher */}
      <Card
        title="Interactive HTML Scientific Canvases (Folium Spatial Map & Monthly FAI Explorer)"
        subtitle="Generated directly by Phase 6 (src/phase6_visualization.py) from the frozen baseline v1 tables"
        action={<Sparkles size={16} color="#FFC247" />}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '14px',
          }}
        >
          {interactiveEntries.map((item) => (
            <div
              key={item.figure_id}
              style={{
                backgroundColor: 'rgba(11, 18, 32, 0.82)',
                border: '1px solid rgba(255, 194, 71, 0.35)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <Badge tone="modis">{item.figure_id}</Badge>
                  <Badge tone="neutral">{(item.bytes / 1024).toFixed(1)} KB HTML</Badge>
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-md)',
                    fontWeight: 600,
                    color: 'var(--text-bright)',
                    marginTop: '8px',
                  }}
                >
                  {item.title}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Sources: {item.source_tables.join(', ')}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Eye size={14} />}
                  onClick={() =>
                    setActiveInteractiveUrl({
                      title: item.title,
                      url: item.web_path,
                    })
                  }
                >
                  Open interactive canvas inline
                </Button>
                <a
                  href={item.web_path}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: 'var(--text-xs)',
                    color: '#FFC247',
                    textDecoration: 'none',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 194, 71, 0.35)',
                  }}
                >
                  <ExternalLink size={13} />
                  New tab
                </a>
              </div>
            </div>
          ))}
        </div>

        {activeInteractiveUrl && (
          <div
            style={{
              marginTop: '14px',
              border: '1px solid rgba(255, 194, 71, 0.5)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              backgroundColor: '#0B1220',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(19, 28, 46, 0.95)',
                borderBottom: '1px solid var(--border-line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: '#FFF1B8' }}>
                {activeInteractiveUrl.title}
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon={<X size={14} />}
                onClick={() => setActiveInteractiveUrl(null)}
              >
                Close canvas
              </Button>
            </div>
            <iframe
              src={activeInteractiveUrl.url}
              title={activeInteractiveUrl.title}
              style={{ width: '100%', height: '520px', border: 'none', backgroundColor: '#fff' }}
            />
          </div>
        )}
      </Card>

      {/* 3. Filterable Phase 6 Scientific Figure Gallery */}
      <Card
        title="Phase 6 Publication-Grade Scientific Figures"
        subtitle="Click any figure to inspect full-resolution chart details and underlying Phase 4 & Phase 5 CSV tables"
        action={<ImageIcon size={16} color="#3CC4C4" />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Category Pills & Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <Filter size={14} color="#8FA0BA" />
              {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => {
                const active = selectedCategory === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedCategory(catKey)}
                    style={{
                      padding: '5px 11px',
                      borderRadius: '999px',
                      fontSize: '11.5px',
                      fontWeight: active ? 600 : 500,
                      cursor: 'pointer',
                      color: active ? '#FFF1B8' : 'var(--text-primary)',
                      backgroundColor: active
                        ? 'rgba(242, 107, 45, 0.28)'
                        : 'rgba(11, 18, 32, 0.7)',
                      border: active
                        ? '1px solid rgba(255, 194, 71, 0.65)'
                        : '1px solid var(--border-line)',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <input
              type="search"
              placeholder="Search figure title or CSV table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                backgroundColor: 'rgba(11, 18, 32, 0.85)',
                border: '1px solid var(--border-line)',
                borderRadius: '7px',
                padding: '6px 12px',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-xs)',
                minWidth: '230px',
              }}
            />
          </div>

          {/* Grid of Figures */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
              gap: '14px',
            }}
          >
            {pngFigures.map((fig) => (
              <div
                key={fig.figure_id}
                style={{
                  backgroundColor: 'rgba(11, 18, 32, 0.82)',
                  border: '1px solid var(--border-line)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  {fig.format === 'png' ? (
                    <div
                      onClick={() => setActiveLightbox(fig)}
                      style={{
                        position: 'relative',
                        cursor: 'zoom-in',
                        backgroundColor: '#fff',
                        borderBottom: '1px solid var(--border-line)',
                        height: '220px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={fig.web_path}
                        alt={fig.title}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          backgroundColor: 'rgba(11, 18, 32, 0.86)',
                          color: '#FFF1B8',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: '1px solid rgba(255, 194, 71, 0.4)',
                        }}
                      >
                        <Maximize2 size={12} />
                        Zoom
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        height: '220px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background:
                          'radial-gradient(circle at center, rgba(46, 70, 194, 0.28), rgba(11, 18, 32, 0.95))',
                        borderBottom: '1px solid var(--border-line)',
                        padding: '16px',
                        textAlign: 'center',
                      }}
                    >
                      <Layers size={32} color="#FFC247" />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#FFF1B8' }}>
                        Interactive HTML Visualization
                      </span>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          setActiveInteractiveUrl({ title: fig.title, url: fig.web_path })
                        }
                      >
                        Launch interactive view
                      </Button>
                    </div>
                  )}

                  <div style={{ padding: '12px 14px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        marginBottom: '6px',
                      }}
                    >
                      <Badge tone="modis">{fig.category}</Badge>
                      <span
                        className="tabular-nums"
                        style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                      >
                        {(fig.bytes / 1024).toFixed(0)} KB · {fig.format.toUpperCase()}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        color: 'var(--text-bright)',
                        lineHeight: 1.35,
                      }}
                    >
                      {fig.title}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginTop: '6px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Tables: {fig.source_tables.join(', ')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 4. Phase 1-6 Technical Reports & Data Dictionary Viewer */}
      <Card
        title="FireScope Phase 1–6 Pipeline Reports & Schema Dictionary"
        subtitle="Full engineering & scientific documentation generated across all 6 pipeline phases"
        action={<BookOpen size={16} color="#B79CFF" />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {FIRESCOPE_BUNDLE.reports.map((rep) => {
              const active = rep.id === selectedReportId;
              return (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => setSelectedReportId(rep.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: 'var(--text-xs)',
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    color: active ? '#FFF1B8' : 'var(--text-primary)',
                    backgroundColor: active
                      ? 'rgba(46, 70, 194, 0.55)'
                      : 'rgba(11, 18, 32, 0.75)',
                    border: active
                      ? '1px solid rgba(255, 194, 71, 0.6)'
                      : '1px solid var(--border-line)',
                  }}
                >
                  <FileText size={13} />
                  {rep.title.split('—')[0].trim()}
                </button>
              );
            })}
          </div>

          <div
            style={{
              backgroundColor: 'rgba(8, 13, 24, 0.88)',
              border: '1px solid var(--border-line)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 18px',
              maxHeight: '520px',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '10px',
                marginBottom: '12px',
                borderBottom: '1px solid var(--border-line)',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 'var(--text-md)', color: '#FFF1B8' }}>
                {activeReport.title}
              </span>
              <Badge tone="neutral">backend/reports/{activeReport.file}</Badge>
            </div>
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                lineHeight: 1.55,
                color: '#D5DFEE',
              }}
            >
              {activeReport.content}
            </pre>
          </div>
        </div>
      </Card>

      {/* Lightbox Modal for PNG Figures */}
      {activeLightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeLightbox.title}
          onClick={() => setActiveLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            backgroundColor: 'rgba(4, 7, 15, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '1150px',
              width: '100%',
              maxHeight: '92vh',
              backgroundColor: '#131C2E',
              border: '1px solid rgba(255, 194, 71, 0.55)',
              borderRadius: '14px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85)',
            }}
          >
            <div
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--border-line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-md)', color: '#FFF1B8' }}>
                  {activeLightbox.title}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Figure ID: {activeLightbox.figure_id} · Category: {activeLightbox.category} · Tables:{' '}
                  {activeLightbox.source_tables.join(', ')}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={<X size={14} />}
                onClick={() => setActiveLightbox(null)}
              >
                Close
              </Button>
            </div>
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '16px',
                overflow: 'auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                maxHeight: 'calc(92vh - 70px)',
              }}
            >
              <img
                src={activeLightbox.web_path}
                alt={activeLightbox.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '78vh',
                  objectFit: 'contain',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
