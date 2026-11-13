# 3-Minute Demo Walkthrough Script (`DEMO_SCRIPT.md`)

**Challenge**: NASA Space Apps Challenge 2026 — *Harmonization of MODIS and VIIRS Hot Spots*  
**Team**: Four-Bits-and-a-Byte  
**Application**: **FIRMS Harmonizer**

---

## [0:00 – 0:45] Screen 1: `Overview` — The Harmonization Problem & Hero Calendar

**Visual on screen**: Open the app on `Overview` (`/`). Point to the top bar (`Terra · Aqua · S-NPP · NOAA-20` orbital badge, `Demo data` indicator, and `Responder · Scientist · Planner` audience switcher) and the **Unified Fire-Activity Calendar Heatmap** in the center.

**Talking points**:
> *"Wildfire responders, scientists, and land managers rely on two NASA satellite constellations: MODIS on Terra and Aqua at 1-kilometer resolution, and VIIRS on Suomi-NPP and NOAA-20 at 375-meter resolution. Because VIIRS pixels are seven times smaller in area and use categorical confidence classes instead of percentages, raw VIIRS counts are over 3.5 times higher than MODIS—creating artificial jumps if you mix them directly.*
>
> *We built **FIRMS Harmonizer**: a night-time orbital mission-control instrument centered on a unified **multi-year Fire-Activity Calendar Heatmap**. Every cell encodes daily harmonized intensity along a 7-stop infrared thermal ramp, while teal (`#3CC4C4`) and lavender (`#B79CFF`) strictly distinguish MODIS and VIIRS across legends and time series."*

**Live interaction**:
- Hover across the August cells in the **2025** and **2023** rows of the calendar to show the **Live Day Inspector Bar** comparing `MODIS`, `VIIRS`, `Harmonized merged clusters`, `Total FRP (MW)`, and `High-confidence share (%)`.
- Click **`Highlight ≥2σ anomaly days`** to isolate extreme fire episodes across all 5 years at a glance.

---

## [0:45 – 1:25] Audience Modes & Jumping to an Anomaly (`Overview` Right Panel)

**Visual on screen**: Point to the **Audience Mode** switcher in the top right and the **Anomalies & High-Risk Periods** panel on the right side of `Overview`.

**Live interaction**:
1. Click **`Responder`** in the top bar:
   - Point out how the workspace automatically shifts to recent 2024–2025 activity, switches the intensity metric to **Radiative Power (`MW`)**, and highlights the July 2025 flash-drought window.
2. In the right-hand **Anomalies & high-risk periods** panel, click the top ranked episode (**`2023-08-18 → 2023-08-29 · +4.68σ · Dadia-Evros complex`**):
   - Point out how clicking a single anomaly card **synchronizes the entire workstation**: the left rail switches to *Eastern Mediterranean & Levant*, the Calendar highlights the August 2023 episode, the MapLibre GL viewport frames the Eastern Mediterranean, and the time-series chart places a golden reference marker on `2023-08-18`.

---

## [1:25 – 2:00] Screen 2: `Explore` — Full-Viewport WebGL Map & Linked Timeline

**Visual on screen**: Click **`Explore`** (`/explore`) in the top navigation bar.

**Talking points**:
> *"To keep the browser fast without ever pushing millions of raw points to the client, our map combines pre-aggregated spatial `GRID_CELLS` thermal polygons with a WebGL `RECENT_POINTS` layer for recent overpasses."*

**Live interaction**:
- Toggle **`MODIS 1 km points`** and **`VIIRS 375 m points`** on and off to demonstrate VIIRS's denser perimeter coverage around MODIS fire cores.
- Click a hotspot point on the map to open the telemetry popup showing sensor, acquisition date, radiative power (`MW`), and harmonized confidence.
- Click **`Play timeline`** (or **`Jump to peak`**) on the bottom **Time Slider** to scrub through daily fire progression.

---

## [2:00 – 2:30] Screen 3: `Patterns & anomalies` — Seasonality & Planner Windows

**Visual on screen**: Click **`Patterns & anomalies`** (`/patterns`) and switch Audience Mode to **`Planner`**.

**Talking points**:
> *"For land managers planning prescribed burns or staging aerial suppression crews, the **Patterns & Anomalies** screen pairs a 60-month **Month × Year Seasonality Matrix** with a 12-month climatological sensor profile and actionable **High-Risk Windows** driven by vapor pressure deficit and fuel moisture thresholds."*

**Live interaction**:
- Switch the left-rail **Monitored region** from *Eastern Mediterranean* (July–August peak) to *Southern Amazonia Arc* (August–October peak) and *Northern Congo & Sudano-Sahelian Belt* (December–February peak) to show the seasonal shift across hemispheres.

---

## [2:30 – 3:00] Screens 4 & 5: `Method & validation` + `About`

**Visual on screen**: Click **`Method & validation`** (`/method`), then finish on **`About`** (`/about`).

**Talking points**:
> *"Scientific transparency is built into the instrument. On **Method & Validation**, we document our 4-step co-registration pipeline, show the monthly MODIS vs. VIIRS scatter plot ($r = 0.942$, scaling factor $0.294$), detail the exact 3-tier confidence mapping table, and state our **methodological limitations** honestly—including cloud/smoke obscuration, Terra vs. Suomi-NPP diurnal overpass timing gaps, and off-nadir bow-tie pixel growth.*
>
> *Finally, the entire front-end is built against a strict Zod-validated data contract: flipping a single environment variable (`VITE_USE_MOCK=false`) swaps our seeded demo dataset for our data team's production FIRMS pipeline with zero UI code changes."*
