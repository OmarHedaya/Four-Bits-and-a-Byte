# FIRMS Harmonizer — MODIS & VIIRS Active-Fire Intelligence

**NASA Space Apps Challenge 2026 — "Harmonization of MODIS and VIIRS Hot Spots"**  
**Team**: Four-Bits-and-a-Byte

An orbital mission-control web application that unifies active-fire hotspot detections from **MODIS** (~1 km, Terra/Aqua) and **VIIRS** (~375 m, Suomi-NPP/NOAA-20/21) around a multi-year **Fire-Activity Calendar Heatmap**, paired with a **MapLibre GL** dark WebGL map, **Seasonality & Sensor Comparison** charts, an **Anomalies & High-Risk Periods** intelligence panel, **Audience Mode** presets (`Responder`, `Scientist`, `Planner`), and a transparent **Method & Validation** walkthrough.

---

## 1. Quick Start & Scripts

### Prerequisites
- **Node.js** `>= 20.x` and **npm** `>= 10.x`

### Install & Run Locally
```bash
# 1. Install dependencies
npm install

# 2. Start the Vite development server (http://localhost:5173)
npm run dev
```

### Verification & Build Scripts
```bash
# Type-check with TypeScript (strict mode, zero any-types)
npm run typecheck

# Lint with ESLint
npm run lint

# Run unit & end-to-end smoke tests with Vitest + Testing Library
npm run test

# Build optimized production bundle into dist/
npm run build

# Preview production build locally
npm run preview
```

---

## 2. Environment Variables & Swapping Mock Data for Real Data

Copy [.env.example](file:///d:/Hackathon/Four-Bits-and-a-Byte/.env.example) to `.env`:

```ini
VITE_USE_MOCK=true
VITE_DATA_BASE_URL=/sample-data
VITE_BASEMAP_STYLE_URL=https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json
VITE_MAP_KEY=
VITE_PROJECT_NAME=FIRMS Harmonizer
VITE_TAGLINE=Unified MODIS & VIIRS Active-Fire Intelligence
```

### How to Replace Mock Data with Real Harmonized Files (Zero UI Changes)
1. Have the Data / Backend team export the 8 harmonized JSON/GeoJSON files following the exact schema documented in [docs/DATA_CONTRACT.md](file:///d:/Hackathon/Four-Bits-and-a-Byte/docs/DATA_CONTRACT.md):
   - `daily_summary.json`
   - `grid_cells.geojson`
   - `recent_points.json`
   - `seasonality.json`
   - `anomalies.json`
   - `risk_periods.json`
   - `validation.json`
   - `region_meta.json`
2. Place those files inside `public/sample-data/` (or host them on an API/CDN endpoint).
3. Set `VITE_USE_MOCK=false` and `VITE_DATA_BASE_URL=/sample-data` (or your API base URL) in `.env`.
4. The data loader ([src/data/loaders.ts](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/data/loaders.ts)) automatically fetches all 8 endpoints, validates every record at runtime using Zod ([src/contracts/schemas.ts](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/contracts/schemas.ts)), removes the `"Demo data"` badge, and populates all 5 screens without changing a single line of component code.

---

## 3. Architecture & Screens

```text
src/
├── config/placeholders.ts        # Single source of truth for all 12 placeholder groups & tokens
├── contracts/schemas.ts          # Zod runtime validators + TypeScript types
├── data/
│   ├── mockGenerator.ts          # Deterministic seeded (mulberry32) 5-year, 4-region generator
│   ├── loaders.ts                # Environment-switched data fetcher (VITE_USE_MOCK)
│   └── selectors.ts              # Memoized daily, monthly, regional, and KPI selectors
├── store/useFilterStore.ts       # Zustand global state (region, years, sensor, metric, audienceMode)
├── components/
│   ├── ui/                       # Button, Select, Toggle, Card, Badge, Tooltip, EmptyState
│   └── layout/                   # AppShell, TopBar, FilterRail
├── features/
│   ├── calendar/                 # CalendarHeatmap (D3 + SVG), KPIStrip
│   ├── map/                      # FireMap (MapLibre GL), TimeSlider
│   ├── charts/                   # SeasonalityMatrixChart, SensorComparisonChart
│   └── anomalies/                # AnomalyRiskPanel, AudienceModeBanner
└── pages/
    ├── OverviewPage.tsx          # Screen 1: Hero Calendar + KPIs + Map + Charts + Anomaly Panel
    ├── ExplorePage.tsx           # Screen 2: Full-viewport MapLibre GL explorer + linked timeline
    ├── PatternsPage.tsx          # Screen 3: Month × Year seasonality matrix & anomaly catalog
    ├── MethodPage.tsx            # Screen 4: 4-step harmonization pipeline, scatter & limitations
    └── AboutPage.tsx             # Screen 5: Team, MODIS/VIIRS specs, credits & scope
```

---

## 4. Deployment (Vercel & Netlify)

Both [vercel.json](file:///d:/Hackathon/Four-Bits-and-a-Byte/vercel.json) and [netlify.toml](file:///d:/Hackathon/Four-Bits-and-a-Byte/netlify.toml) are pre-configured with SPA routing rewrites and immutable asset caching.

- **Vercel**: Import the GitHub repository in Vercel; it automatically detects Vite (`npm run build`, output directory `dist`).
- **Netlify**: Connect the repository in Netlify (`npm run build`, publish directory `dist`).
