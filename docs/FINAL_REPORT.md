# Final Engineering & Verification Report (`FINAL_REPORT.md`)

**Project**: NASA Space Apps Challenge 2026 — *Harmonization of MODIS and VIIRS Hot Spots*  
**Team**: Four-Bits-and-a-Byte

---

## 1. What Was Built Per Phase (F0 to F8)

| Phase | Git Branch | Summary of Deliverables Built | Verification Status |
| :--- | :--- | :--- | :--- |
| **F0** | `frontend/project-setup` | Initialized Vite + React 19 + TypeScript project; centralized all 12 placeholder groups in [placeholders.ts](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/config/placeholders.ts); implemented strict `zod` schemas in [schemas.ts](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/contracts/schemas.ts); built deterministic seeded generator (`7,304` daily records, `540` spatial grid cells, `1,176` recent points) in [mockGenerator.ts](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/data/mockGenerator.ts); exported static sample files to `public/sample-data/`; authored [DATA_CONTRACT.md](file:///d:/Hackathon/Four-Bits-and-a-Byte/docs/DATA_CONTRACT.md). | `typecheck`, `lint`, `test` (`6/6`), `build`, and live browser screenshot verified. |
| **F1** | `frontend/design-tokens` | Implemented Night mission-control design tokens (`#0B1220` Night, `#131C2E` Panel, `#26344D` Line, `#3CC4C4` MODIS, `#B79CFF` VIIRS, 7-stop thermal ramp `#1a2140`→`#FFF1B8`) enhanced with the deep-space orbital aesthetic from the Figma `Satellite Company Website` design and custom satellite-fire emblem ([logo-satellite-fire.jpg](file:///d:/Hackathon/Four-Bits-and-a-Byte/public/logo-satellite-fire.jpg)); built UI primitives and `AppShell` (`TopBar` + `FilterRail`). | `typecheck`, `lint`, `test`, `build`, and live browser screenshot verified. |
| **F2** | `frontend/data-layer` | Built Zustand global filter store ([useFilterStore.ts](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/store/useFilterStore.ts)), environment-switched data loader ([loaders.ts](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/data/loaders.ts)), memoized daily/monthly/regional/KPI selectors ([selectors.ts](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/data/selectors.ts)), [useFireData.ts](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/hooks/useFireData.ts) hook, and unit tests ([selectors.test.ts](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/test/selectors.test.ts)). | `typecheck`, `lint`, `test` (`13/13`), `build`, and browser verification passed. |
| **F3** | `frontend/calendar-heatmap` | Built the hero multi-year D3 + SVG [CalendarHeatmap.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/features/calendar/CalendarHeatmap.tsx) and [KPIStrip.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/features/calendar/KPIStrip.tsx) with 7-stop thermal quantile scaling, left-to-right load animation (`prefers-reduced-motion` aware), keyboard arrow navigation, anomaly isolation toggle (`≥2σ`), and live MODIS vs. VIIRS day inspector. | `typecheck`, `lint`, `test`, `build`, and live browser screenshot verified. |
| **F4** | `frontend/map-view` | Built [FireMap.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/features/map/FireMap.tsx) using MapLibre GL (`react-map-gl/maplibre`) with dark basemap + offline fallback style, `GRID_CELLS` thermal polygon layer, `RECENT_POINTS` WebGL sensor layer, per-sensor toggles, interactive popups, linked [TimeSlider.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/features/map/TimeSlider.tsx), and full-screen [ExplorePage.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/pages/ExplorePage.tsx). | `typecheck`, `lint`, `test`, `build`, and browser verification passed. |
| **F5** | `frontend/charts` | Built [SeasonalityMatrixChart.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/features/charts/SeasonalityMatrixChart.tsx) (Month × Year thermal matrix + 12-month climatology bar/line chart), [SensorComparisonChart.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/features/charts/SensorComparisonChart.tsx), and dedicated [PatternsPage.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/pages/PatternsPage.tsx). | `typecheck`, `lint`, `test`, `build`, and browser verification passed. |
| **F6** | `frontend/anomaly-panel` | Built [AnomalyRiskPanel.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/features/anomalies/AnomalyRiskPanel.tsx) and [AudienceModeBanner.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/features/anomalies/AudienceModeBanner.tsx) with one-click synchronization across Calendar, Map, and Charts, plus `Responder`, `Scientist`, and `Planner` operational presets in [OverviewPage.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/pages/OverviewPage.tsx). | `typecheck`, `lint`, `test`, `build`, and browser verification passed. |
| **F7** | `frontend/method-page` | Built [MethodPage.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/pages/MethodPage.tsx) (4-step harmonization walkthrough, MODIS vs. VIIRS monthly scatter & scaling plot, confidence mapping table from `CONF_MAPPING_TEXT`, and honest limitations) and [AboutPage.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/pages/AboutPage.tsx). | `typecheck`, `lint`, `test`, `build`, and browser verification passed. |
| **F8** | `frontend/polish` | Added lazy route splitting (`React.lazy`), end-to-end smoke test ([smoke.test.tsx](file:///d:/Hackathon/Four-Bits-and-a-Byte/src/test/smoke.test.tsx)), deployment configs ([vercel.json](file:///d:/Hackathon/Four-Bits-and-a-Byte/vercel.json), [netlify.toml](file:///d:/Hackathon/Four-Bits-and-a-Byte/netlify.toml)), [DEMO_SCRIPT.md](file:///d:/Hackathon/Four-Bits-and-a-Byte/docs/DEMO_SCRIPT.md), and [README.md](file:///d:/Hackathon/Four-Bits-and-a-Byte/README.md). | Full test suite (`14/14` tests across 3 test suites), `lint`, `typecheck`, `build`, and multi-screen browser verification passed. |

---

## 2. Known Limitations

1. **Synthetic Demo Data Until Real Pipeline Handoff**: While `VITE_USE_MOCK=true`, all statistics, grid cells, and monthly pairs are deterministically generated (`seed = 202610`). The UI displays a persistent `"Demo data"` badge whenever mock mode is active.
2. **Pre-Aggregated Spatial Resolution**: To maintain 60 fps WebGL performance and avoid transferring hundreds of megabytes of raw CSV points to the browser, spatial heat layers use 0.5° pre-aggregated `GRID_CELLS` polygons and `RECENT_POINTS` is scoped to the most recent $N$ days plus benchmark anomaly episodes.
3. **Physical Sensor Constraints**: As documented on the `Method & validation` screen, harmonized counts remain subject to optically thick cloud/smoke obscuration, diurnal overpass timing differences between Terra (`10:30 LT`) and Aqua/S-NPP/NOAA-20 (`13:30 LT / 01:30 LT`), and off-nadir MODIS scan geometry stretching.

---

## 3. Exact List of Files Needed from Teammates

Hand [docs/DATA_CONTRACT.md](file:///d:/Hackathon/Four-Bits-and-a-Byte/docs/DATA_CONTRACT.md) to the Data & Backend teammates and request these **8 files** (placed in `public/sample-data/` or served from `VITE_DATA_BASE_URL`):

1. **`daily_summary.json`** (`DAILY_SUMMARY`): Array of `{ date, region_id, count_modis, count_viirs, count_merged, total_frp, high_conf_share, anomaly_z }`.
2. **`grid_cells.geojson`** (`GRID_CELLS`): GeoJSON `FeatureCollection` with feature properties `{ cell_id, lat, lon, month, frp_sum, count, region_id? }`.
3. **`recent_points.json`** (`RECENT_POINTS`): Array of `{ lat, lon, date, sensor, frp, confidence, region_id? }` for the last 14–30 days.
4. **`seasonality.json`** (`SEASONALITY`): Array of `{ year, month, frp_sum, count, count_modis?, count_viirs?, region_id? }`.
5. **`anomalies.json`** (`ANOMALIES`): Array of `{ start_date, end_date, region_id, score, reason }`.
6. **`risk_periods.json`** (`RISK_PERIODS`): Array of `{ window, region_id, risk_score, drivers, start_month?, end_month? }`.
7. **`validation.json`** (`VALIDATION`): Object `{ monthly_pairs: [{ month, modis, viirs, harmonized? }], correlation, bias, scaling_factor, rmse? }`.
8. **`region_meta.json`** (`REGION_META`): Array of `{ region_id, name, bbox: [minLon, minLat, maxLon, maxLat], date_min, date_max }`.
