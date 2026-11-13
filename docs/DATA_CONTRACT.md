# Data Contract Specification (`DATA_CONTRACT.md`)

**Project**: NASA Space Apps Challenge 2026 — *Harmonization of MODIS and VIIRS Hot Spots*  
**Team**: Four-Bits-and-a-Byte  
**Contract Version**: `1.0.0`

---

## 1. Overview & Zero-Code Swap Mechanism

The front-end application consumes **pre-aggregated, harmonized JSON and GeoJSON files** rather than raw multi-gigabyte FIRMS CSV exports.

Switching the entire web app from synthetic seeded demo data to your real harmonized outputs requires **zero UI code changes**—only setting two environment variables in `.env` (or Vercel/Netlify dashboard):

```ini
VITE_USE_MOCK=false
VITE_DATA_BASE_URL=/sample-data   # or https://your-api-or-cdn.example.com/v1
```

When `VITE_USE_MOCK=false`, the front-end loader fetches the following files from `VITE_DATA_BASE_URL` and validates them at runtime using `zod` (`src/contracts/schemas.ts`):

| Placeholder Key | Relative File Path | Format | Target File Size | Producer |
| :--- | :--- | :--- | :--- | :--- |
| `{{DAILY_SUMMARY}}` | `/daily_summary.json` | JSON Array | `150 KB – 1.5 MB` (gzipped `< 250 KB`) | Data Team |
| `{{GRID_CELLS}}` | `/grid_cells.geojson` | GeoJSON `FeatureCollection` | `250 KB – 3.0 MB` (gzipped `< 500 KB`) | Data Team |
| `{{RECENT_POINTS}}` | `/recent_points.json` | JSON Array | `100 KB – 1.2 MB` (last $N$ days only) | Data Team |
| `{{SEASONALITY}}` | `/seasonality.json` | JSON Array | `10 KB – 80 KB` | Data Team |
| `{{ANOMALIES}}` | `/anomalies.json` | JSON Array | `5 KB – 50 KB` | Data Team |
| `{{RISK_PERIODS}}` | `/risk_periods.json` | JSON Array | `5 KB – 30 KB` | Data Team |
| `{{VALIDATION}}` | `/validation.json` | JSON Object | `10 KB – 100 KB` | Data Team |
| `{{REGION_META}}` | `/region_meta.json` | JSON Array | `2 KB – 20 KB` | Data Team |

---

## 2. Detailed Entity Schemas, Units & Samples

### 2.1 `DAILY_SUMMARY` (`/daily_summary.json`)
Powers the hero **Fire-Activity Calendar Heatmap**, top **KPI strip**, and **daily time-series charts**.

| Field | Type | Unit / Range | Description |
| :--- | :--- | :--- | :--- |
| `date` | `string` | ISO `YYYY-MM-DD` (UTC) | Observation date in UTC. |
| `region_id` | `string` | Identifier (e.g. `"med-east"`) | Matches `region_id` in `REGION_META`. |
| `count_modis` | `integer` | `hotspots / day` ($\ge 0$) | Raw MODIS (Terra + Aqua, ~1 km) active-fire detections with nominal/high confidence. |
| `count_viirs` | `integer` | `hotspots / day` ($\ge 0$) | Raw VIIRS (S-NPP + NOAA-20/21, ~375 m) active-fire detections with nominal/high confidence. |
| `count_merged` | `integer` | `harmonized clusters / day` ($\ge 0$) | Harmonized fire event count after spatial-temporal co-registration and scaling. |
| `total_frp` | `number` | Megawatts (`MW`, $\ge 0$) | Integrated Fire Radiative Power across harmonized clusters for that date & region. |
| `high_conf_share` | `number` | Proportion `0.0 – 1.0` | Fraction of detections classified in the harmonized **High Confidence** tier (multiply by 100 for `%`). |
| `anomaly_z` | `number` | Standard deviations ($\sigma$, `Z-score`) | Standardized departure from the regional day-of-year climatological mean ($\ge 2.0\sigma$ flags an unusual day). |

**Sample Payload**:
```json
[
  {
    "date": "2023-08-21",
    "region_id": "med-east",
    "count_modis": 248,
    "count_viirs": 842,
    "count_merged": 541,
    "total_frp": 28410.5,
    "high_conf_share": 0.842,
    "anomaly_z": 4.68
  }
]
```

---

### 2.2 `GRID_CELLS` (`/grid_cells.geojson`)
Powers the **MapLibre GL thermal grid heat layer** so the browser renders pre-aggregated spatial cells rather than millions of raw points.

| Property Field | Type | Unit / Range | Description |
| :--- | :--- | :--- | :--- |
| `cell_id` | `string` | Unique grid ID | Deterministic spatial cell identifier (e.g., `0.25°` or `0.5°` grid or H3 cell ID). |
| `lat` | `number` | Decimal degrees (`-90..90`) | Cell centroid latitude (WGS84). |
| `lon` | `number` | Decimal degrees (`-180..180`) | Cell centroid longitude (WGS84). |
| `month` | `integer \| string` | `1..12` or `YYYY-MM` | Calendar month (`1..12`) or year-month (`YYYY-MM`). |
| `frp_sum` | `number` | Megawatts (`MW`, $\ge 0$) | Cumulative Fire Radiative Power inside the grid cell. |
| `count` | `integer` | `harmonized hotspots` ($\ge 0$) | Harmonized fire count inside the grid cell. |
| `region_id` *(optional)* | `string` | Identifier | Optional region tag; if omitted, the UI filters spatially via `REGION_META.bbox`. |

**Sample Payload**:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[23.48, 37.98], [23.92, 37.98], [23.92, 38.42], [23.48, 38.42], [23.48, 37.98]]]
      },
      "properties": {
        "cell_id": "CELL-MED-EAST-0001",
        "lat": 38.2,
        "lon": 23.7,
        "month": 8,
        "frp_sum": 11420.4,
        "count": 312,
        "region_id": "med-east"
      }
    }
  ]
}
```

---

### 2.3 `RECENT_POINTS` (`/recent_points.json`)
Powers the **detailed hotspot point layer** on the map for the most recent $N$ days (recommended: last 14–30 days plus key benchmark anomaly dates, capped at `< 15,000` points total).

| Field | Type | Unit / Range | Description |
| :--- | :--- | :--- | :--- |
| `lat` | `number` | Decimal degrees (`-90..90`) | Pixel centroid latitude (WGS84). |
| `lon` | `number` | Decimal degrees (`-180..180`) | Pixel centroid longitude (WGS84). |
| `date` | `string` | ISO `YYYY-MM-DD` | Overpass acquisition date. |
| `sensor` | `"MODIS" \| "VIIRS"` | Sensor family | Source instrument (`"MODIS"` colored `#3CC4C4`, `"VIIRS"` colored `#B79CFF`). |
| `frp` | `number` | Megawatts (`MW`, $\ge 0$) | Pixel Fire Radiative Power. |
| `confidence` | `"low" \| "nominal" \| "high" \| number` | Harmonized tier or `0..100` | Harmonized confidence class (`"low"`, `"nominal"`, `"high"`) or numeric percentage. |
| `region_id` *(optional)* | `string` | Identifier | Optional region identifier. |

---

### 2.4 `SEASONALITY` (`/seasonality.json`)
Powers the **Month × Year Seasonality Matrix** and **Planner Seasonal Profile**.

| Field | Type | Unit / Range | Description |
| :--- | :--- | :--- | :--- |
| `year` | `integer` | Four-digit year (e.g. `2021..2025`) | Observation year. |
| `month` | `integer` | `1..12` | Calendar month (`1 = Jan`, `12 = Dec`). |
| `frp_sum` | `number` | Megawatts (`MW`, $\ge 0$) | Monthly sum of Fire Radiative Power. |
| `count` | `integer` | `harmonized hotspots` ($\ge 0$) | Monthly sum of harmonized hotspot counts. |
| `count_modis` *(optional)* | `integer` | `hotspots` ($\ge 0$) | Optional monthly MODIS count for sensor split charts. |
| `count_viirs` *(optional)* | `integer` | `hotspots` ($\ge 0$) | Optional monthly VIIRS count for sensor split charts. |
| `region_id` *(optional)* | `string` | Identifier | Optional region identifier (`"all"` for global composite). |

---

### 2.5 `ANOMALIES` (`/anomalies.json`)
Powers the **Unusual Conditions / Anomalies** ranking in the right intelligence panel and the **Patterns & Anomalies** screen.

| Field | Type | Unit / Range | Description |
| :--- | :--- | :--- | :--- |
| `start_date` | `string` | ISO `YYYY-MM-DD` | Start date of the anomalous fire episode. |
| `end_date` | `string` | ISO `YYYY-MM-DD` | End date of the anomalous fire episode. |
| `region_id` | `string` | Identifier | Region where the anomaly occurred. |
| `score` | `number` | Peak Z-score ($\sigma$, e.g. `3.2 – 5.0`) | Standardized anomaly severity score used for ranking. |
| `reason` | `string` | Plain text explanation | Physical/meteorological and sensor-level explanation of the episode. |

---

### 2.6 `RISK_PERIODS` (`/risk_periods.json`)
Powers the **High-Risk Periods** planning list for land managers and emergency responders.

| Field | Type | Unit / Range | Description |
| :--- | :--- | :--- | :--- |
| `window` | `string` | Human-readable window | Seasonal or weekly window label (e.g. `"July 20 – August 31 (Peak Etesian Window)"`). |
| `region_id` | `string` | Identifier | Associated region ID. |
| `risk_score` | `number` | Index `0 – 100` | Composite climatological & fuel-aridity fire risk score. |
| `drivers` | `string[] \| string` | List of drivers | Primary physical drivers (e.g., `["VPD > 4.5 kPa", "10-hr fuel moisture < 6%"]`). |
| `start_month` *(optional)* | `integer` | `1..12` | Start month used to jump the calendar view when clicked. |
| `end_month` *(optional)* | `integer` | `1..12` | End month used to highlight the calendar window. |

---

### 2.7 `VALIDATION` (`/validation.json`)
Powers the **Method & Validation** scatter plot, regression line, and statistical agreement metrics.

| Field | Type | Unit / Range | Description |
| :--- | :--- | :--- | :--- |
| `monthly_pairs` | `Array<{ month, modis, viirs, harmonized? }>` | Monthly paired counts | Paired monthly MODIS (`modis`) and VIIRS (`viirs`) totals for scatter & regression plotting. |
| `correlation` | `number` | Pearson $r$ (`-1.0 .. 1.0`) | Linear correlation coefficient between MODIS and harmonized VIIRS monthly series. |
| `bias` | `number` | Mean difference (`hotspots/month` or `%`) | Residual systematic bias after applying the harmonization scaling factor. |
| `scaling_factor` | `number` | Dimensionless ratio ($> 0$) | Calibrated MODIS-to-VIIRS scaling coefficient (typically `~0.28 – 0.33`). |
| `rmse` *(optional)* | `number` | `hotspots / month` | Root Mean Square Error of monthly harmonized residuals. |

---

### 2.8 `REGION_META` (`/region_meta.json`)
Powers the **Region Filter** and automatic **Map Camera Bounds (`fitBounds`)**.

| Field | Type | Unit / Range | Description |
| :--- | :--- | :--- | :--- |
| `region_id` | `string` | Slug identifier | Unique key (e.g., `"med-east"`, `"amazon-south"`, `"west-na"`, `"congo-basin"`). |
| `name` | `string` | Display title | Human-readable region name. |
| `bbox` | `[number, number, number, number]` | `[minLon, minLat, maxLon, maxLat]` | WGS84 bounding box for MapLibre camera framing and spatial filtering. |
| `date_min` | `string` | ISO `YYYY-MM-DD` | Earliest available date for this region. |
| `date_max` | `string` | ISO `YYYY-MM-DD` | Latest available date for this region. |
