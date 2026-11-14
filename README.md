# MODIS & VIIRS Harmonizer — FireScope Egypt (2023–2025)

**Full-Stack Orbital Active-Fire Harmonization, Fire Activity Index (FAI), and Mission-Control Web Application**

Built by **Team Four-Bits-and-a-Byte** for the NASA Space Apps Challenge.

---

## 1. Project Overview

**FireScope (`MODIS & VIIRS Harmonizer`)** unifies **254,175 archival NASA FIRMS thermal anomaly detections** across **Egypt (2023–2025)** from four orbital instruments across two sensor families:

- **MODIS (`Terra & Aqua`, Collection 6.1, ~1,000 m nadir resolution)**: `4,127` harmonized rows (`3,457` Type 0 vegetation-fire candidates, `665` Type 2 persistent static sources, `5` Type 3 water detections).
- **VIIRS (`Suomi-NPP`, `NOAA-20`, and `NOAA-21`, ~375 m I-band resolution)**: `250,048` harmonized rows (`81,232` Type 0 vegetation-fire candidates, `167,598` Type 2 persistent static sources, `1,218` Type 3 water detections).

Instead of naively summing raw pixel detections across sensors of different spatial resolutions, FireScope:
1. Maps all records onto a common **`0.05° × 0.05°` (~5 km) spatial grid** (`3,596` active vegetation-candidate cells and `267` persistent static thermal cells) and a **1,096-day × 4-sensor coverage calendar**.
2. Separates **Type 0 vegetation fire candidates** (`84,689` rows) from **Type 2 persistent industrial / gas-flaring static heat sources** (`168,263` rows).
3. Computes the coverage-normalized **Phase 5 Fire Activity Index (FAI)** anchored to **Frozen Baseline `v1`** (`B = 32.4975` cell-days/day across `337` matched calendar dates per year for the `NOAA-20 ∪ S-NPP` headline union), alongside explicit **static-source `3×3` neighborhood exclusion (`N20_SNPP_excl3x3_all`)** and **low-confidence exclusion (`N20_SNPP_core_excl_low`)** sensitivity series.

---

## 2. Repository Structure

```text
Four-Bits-and-a-Byte/
├── backend/                              # Python Phase 1–6 FireScope Pipeline & REST API
│   ├── api_server.py                     # REST API serving Phase 4/5/6 CSVs, JSONs & reports
│   ├── main.py                           # CLI runner for Phases 1–6
│   ├── requirements.txt                  # Python scientific dependencies
│   ├── src/                              # Phase 1–6 Python modules
│   │   ├── config.py
│   │   ├── data_cleaning.py              # Phase 2 cleaning & validation
│   │   ├── harmonize.py                  # Phase 3 0.05° grid & coverage calendar
│   │   ├── phase4_analysis.py            # Phase 4 spatio-temporal & static source analytics
│   │   ├── phase5_index.py               # Phase 5 Fire Activity Index (FAI) & Baseline v1
│   │   └── phase6_visualization.py       # Phase 6 26 PNG + 2 HTML visualization generator
│   ├── data/
│   │   ├── analysis/                     # 31 Phase 4 CSV/JSON analytical tables
│   │   ├── index/                        # 18 Phase 5 FAI CSV tables & baseline_v1.json
│   │   └── visualizations/               # 28 Phase 6 PNG/HTML figures & phase6_manifest.json
│   ├── reports/                          # Phase 0–6 Markdown scientific & audit reports
│   ├── docs/data_dictionary.md           # Full schema & column dictionary
│   └── tests/                            # Pytest suite for Phases 2–6
├── scripts/
│   └── build_firescope_frontend_data.mjs # Compiles backend CSV/JSONs into frontend contracts
├── public/
│   ├── sample-data/                      # Zod-validated JSON/GeoJSON frontend contracts
│   └── visualizations/                   # Static served Phase 6 PNG & Folium HTML figures
└── src/                                  # React 19 + TypeScript + MapLibre GL + D3 + Recharts UI
    ├── components/                       # Layout shell, TopBar, FilterRail, and UI primitives
    ├── config/placeholders.ts            # Single source of truth for endpoints & rules
    ├── contracts/schemas.ts              # Runtime Zod schemas for all data contracts
    ├── data/                             # Data loaders, selectors & embedded Egypt bundles
    ├── features/                         # CalendarHeatmap, FireMap, Charts, Anomaly panels
    └── pages/                            # Overview, Explore, Patterns, Method, Atlas, About
```

---

## 3. Quick Start

### Frontend Web Application
```bash
npm install
npm run data:sync   # Recompiles public/sample-data/ & embedded bundles from backend/data/
npm run dev         # Starts Vite mission-control UI at http://localhost:5173
```

### Optional Backend REST API Server
```bash
npm run backend:api
# Serves http://127.0.0.1:8000/api/firescope/health (proxied automatically by Vite)
```

### Quality & Verification Checks
```bash
npm run typecheck   # TypeScript strict check
npm run lint        # ESLint check
npm run test        # Vitest unit, schema & end-to-end smoke tests
npm run build       # Full data sync + production bundle build
```
