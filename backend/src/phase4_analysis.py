"""Phase 4: temporal, spatial, sensor, coverage, and static-source analysis.

All functions take plain DataFrames and return DataFrames, so every table can
be tested on small synthetic data.

Scientific rules enforced here
------------------------------
* A detection is a thermal anomaly, not a confirmed fire. Hotspot type 0 is a
  "vegetation-fire candidate". Type 2 (static land source) is analysed
  separately and never enters the vegetation-candidate tables.
* Sensors keep their identity. Raw counts of different sensors are never
  treated as independent events. Cross-sensor views use cell-day presence:
  one 0.05 degree cell on one UTC day counts once, however many sensors saw it.
* "Agreement" between sensors is GRID-CELL CO-OCCURRENCE on the 0.05 degree
  grid. It is not pixel-level agreement and does not show that two satellites
  saw the same physical fire.
* A day without records is a coverage fact, not "zero fire". Rates divide by
  days that were actually observed (coverage_status == "observed").
* Year-to-year change is only reported on matched calendar days that have
  usable coverage in all analysed years.
* UTC timestamps are never overwritten. Local-hour columns are added with the
  Africa/Cairo time zone, which handles daylight saving time.
* The 0.05 degree grid from Phase 3 is kept.
* Seasons are meteorological and use a SEASON YEAR: December belongs to the
  winter (DJF) of the following year. Incomplete season-years are flagged.
* No Fire Activity Index is built here (that is Phase 5).
"""

from __future__ import annotations

import logging
import re

import numpy as np
import pandas as pd

from harmonize import GRID_SIZE_DEG, YEARS

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------
# Methodological constants. These are project choices, not universal rules.
# --------------------------------------------------------------------------
LOCAL_TIMEZONE = "Africa/Cairo"
VIIRS_SENSORS = ("NOAA20", "NOAA21", "SNPP")
ALL_SENSORS = ("MODIS",) + VIIRS_SENSORS
SENSOR_PAIRS = (("NOAA20", "NOAA21"), ("NOAA20", "SNPP"), ("NOAA21", "SNPP"))

HOTSPOT_PERCENTILE = 95.0  # among cells with at least one active day
PERSISTENT_MIN_DAYS = 91  # VIIRS vegetation-candidate cell-days in one year (about 25 %)
BLOCK_SIZE_DEG = 1.0  # geographic analysis blocks, NOT administrative boundaries
MIN_MONTH_COVERAGE = 0.5  # a month needs >= 50 % usable days to be a peak candidate
MIN_POOLED_USED_DAYS = 30

SERIES_V3 = "VIIRS_3sensor_union"
SERIES_V2 = "VIIRS_NOAA20_SNPP_union"
SERIES_V3_NO_STATIC = "VIIRS_3sensor_union_excl_static_3x3_any_year"
SERIES_V3_NO_STATIC_YEAR = "VIIRS_3sensor_union_excl_static_3x3_same_year"
# MODIS empty days cannot be told apart from days without data, so MODIS gets
# totals but no per-day rates.
SERIES_WITHOUT_RATES = frozenset({"MODIS"})

SEASON_BY_MONTH = {
    12: "DJF", 1: "DJF", 2: "DJF",
    3: "MAM", 4: "MAM", 5: "MAM",
    6: "JJA", 7: "JJA", 8: "JJA",
    9: "SON", 10: "SON", 11: "SON",
}
_SEASON_START_MONTH = {"DJF": 12, "MAM": 3, "JJA": 6, "SON": 9}

VALID_HOTSPOT_TYPES = frozenset({0, 1, 2, 3})
VALID_COVERAGE_STATUSES = (
    "observed", "documented_source_gap", "no_records_unconfirmed", "not_expected_before_science_start",
)
STATUSES = VALID_COVERAGE_STATUSES

_KEY_LAT = 100_000  # cell key = lat_index * _KEY_LAT + lon_index
_KEY_DAY = 1_000_000_000  # cell-day key = day_index * _KEY_DAY + cell key
_EPOCH = pd.Timestamp(f"{YEARS[0]}-01-01")
_EARTH_RADIUS_KM = 6371.0088

REQUIRED_HARMONIZED_COLUMNS = (
    "record_id", "acquisition_datetime_utc", "acquisition_date", "latitude", "longitude",
    "grid_cell_id", "grid_cell_lat", "grid_cell_lon", "sensor_key", "sensor_family",
    "nominal_resolution_m", "scan_km", "track_km", "confidence_numeric", "confidence_class",
    "frp_mw", "daynight", "hotspot_type", "is_static_source", "is_vegetation_fire_candidate",
    "is_water_detection",
)
REQUIRED_COVERAGE_COLUMNS = ("sensor_key", "acquisition_date", "n_records", "coverage_status")


# --------------------------------------------------------------------------
# Small safe helpers
# --------------------------------------------------------------------------
def _safe_div(num, den) -> float:
    """Division that returns NaN, never inf or a misleading zero, when undefined."""
    try:
        num, den = float(num), float(den)
    except (TypeError, ValueError):
        return np.nan
    if np.isnan(num) or np.isnan(den) or den == 0:
        return np.nan
    return num / den


def _pct_change(new, old) -> float:
    if old is None or pd.isna(old) or old == 0 or pd.isna(new):
        return np.nan
    return float((new - old) / old * 100.0)


def _safe_mean(values) -> float:
    s = pd.Series(values)
    return float(s.mean()) if len(s) else np.nan


def _wide(sensor_day: pd.DataFrame, field: str, fill) -> pd.DataFrame:
    """Date x sensor table. A sensor with no rows becomes a column of ``fill``."""
    data = sensor_day.copy()
    if data[field].dtype == bool:
        data[field] = data[field].astype(int)
    pivot = data.pivot(index="date", columns="sensor_key", values=field)
    pivot = pivot.reindex(columns=list(ALL_SENSORS))
    pivot = pivot.fillna(int(fill) if isinstance(fill, bool) else fill)
    return pivot.astype(bool) if isinstance(fill, bool) else pivot.astype(int)


# --------------------------------------------------------------------------
# Input validation
# --------------------------------------------------------------------------
def validate_inputs(harmonized: pd.DataFrame, coverage: pd.DataFrame) -> None:
    """Fail early, with a clear message, when an input table is unusable."""
    miss = [c for c in REQUIRED_HARMONIZED_COLUMNS if c not in harmonized.columns]
    if miss:
        raise ValueError(f"harmonized table is missing required columns: {miss}")
    miss = [c for c in REQUIRED_COVERAGE_COLUMNS if c not in coverage.columns]
    if miss:
        raise ValueError(f"coverage table is missing required columns: {miss}")
    if harmonized.empty:
        raise ValueError("harmonized table is empty; nothing to analyse")
    if coverage.empty:
        raise ValueError("coverage table is empty; coverage is required for valid rates")

    dup = coverage.duplicated(["sensor_key", "acquisition_date"])
    if dup.any():
        raise ValueError(f"coverage has {int(dup.sum())} duplicated (sensor_key, acquisition_date) rows")
    bad_status = set(coverage["coverage_status"].dropna().unique()) - set(VALID_COVERAGE_STATUSES)
    if bad_status or coverage["coverage_status"].isna().any():
        raise ValueError(f"coverage has unknown or missing coverage_status values: {sorted(map(str, bad_status))}")
    cov_dates = pd.to_datetime(coverage["acquisition_date"], errors="coerce")
    if cov_dates.isna().any():
        raise ValueError("coverage has invalid acquisition_date values")

    bad_sensor = set(harmonized["sensor_key"].dropna().unique()) - set(ALL_SENSORS)
    bad_sensor |= set(coverage["sensor_key"].dropna().unique()) - set(ALL_SENSORS)
    if bad_sensor or harmonized["sensor_key"].isna().any():
        raise ValueError(f"unknown or missing sensor_key values: {sorted(map(str, bad_sensor))}")

    dates = pd.to_datetime(harmonized["acquisition_date"], errors="coerce")
    if dates.isna().any():
        raise ValueError(f"{int(dates.isna().sum())} rows have an invalid acquisition_date")
    lat = pd.to_numeric(harmonized["latitude"], errors="coerce")
    lon = pd.to_numeric(harmonized["longitude"], errors="coerce")
    if lat.isna().any() or lon.isna().any() or not lat.between(-90, 90).all() or not lon.between(-180, 180).all():
        raise ValueError("harmonized table has missing or out-of-range coordinates")

    stamp = harmonized["acquisition_datetime_utc"]
    present = stamp.notna()
    parsed = pd.to_datetime(stamp[present], utc=True, errors="coerce", format="ISO8601")
    if parsed.isna().any():
        raise ValueError(f"{int(parsed.isna().sum())} rows have an unparsable acquisition_datetime_utc")

    types = pd.to_numeric(harmonized["hotspot_type"], errors="coerce")
    if types.isna().any() or not set(types.astype(int).unique()) <= VALID_HOTSPOT_TYPES:
        raise ValueError("hotspot_type must be one of 0, 1, 2, 3 for every row")

    ids = harmonized["grid_cell_id"].astype(str)
    if not ids.str.match(r"^G(-?\d+)_(-?\d+)$").all():
        raise ValueError("grid_cell_id values must look like G<lat_index>_<lon_index>")

    viirs = harmonized["sensor_family"].astype(str).eq("VIIRS")
    classes = harmonized.loc[viirs, "confidence_class"]
    if not classes.dropna().astype(str).isin(["l", "n", "h"]).all():
        raise ValueError("VIIRS confidence_class must be l, n, or h")
    modis_conf = pd.to_numeric(harmonized.loc[~viirs, "confidence_numeric"], errors="coerce").dropna()
    if len(modis_conf) and not modis_conf.between(0, 100).all():
        raise ValueError("MODIS confidence_numeric must be within 0-100")

    # Records may exist only on days the coverage calendar calls "observed".
    cov = coverage.assign(_d=cov_dates.dt.strftime("%Y-%m-%d"))
    observed = set(zip(cov.loc[cov["coverage_status"] == "observed", "sensor_key"], cov.loc[cov["coverage_status"] == "observed", "_d"]))
    in_window = dates.dt.year.isin(YEARS)
    pairs = set(zip(harmonized.loc[in_window, "sensor_key"], dates[in_window].dt.strftime("%Y-%m-%d")))
    orphan = pairs - observed
    if orphan:
        raise ValueError(f"{len(orphan)} sensor-days have records but are not 'observed' in coverage (e.g. {sorted(orphan)[:3]})")


# --------------------------------------------------------------------------
# Preparation
# --------------------------------------------------------------------------
def prepare_detections(harmonized: pd.DataFrame) -> pd.DataFrame:
    """Add analysis columns. Original columns, including UTC, are untouched.

    Added: date, year, month, lat_idx, lon_idx, utc_hour, local_hour_cairo,
    local_date_cairo, utc_offset_hours_cairo. Rows outside the analysis years
    (for example stray 2026 records) are dropped from the returned copy only.
    """
    h = harmonized.copy()
    h["date"] = pd.to_datetime(h["acquisition_date"])
    h["year"] = h["date"].dt.year
    h["month"] = h["date"].dt.month
    outside = ~h["year"].isin(YEARS)
    if outside.any():
        logger.warning("Dropping %d rows outside analysis years %s from the analysis copy", int(outside.sum()), YEARS)
        h = h[~outside].copy()

    idx = h["grid_cell_id"].astype(str).str.extract(r"^G(-?\d+)_(-?\d+)$")
    if idx.isna().any(axis=None):
        raise ValueError("grid_cell_id values must look like G<lat_index>_<lon_index>")
    h["lat_idx"] = idx[0].astype(np.int64)
    h["lon_idx"] = idx[1].astype(np.int64)
    if len(h) and (h["lat_idx"].min() < 0 or h["lon_idx"].min() < 0 or h["lat_idx"].max() >= _KEY_LAT - 1 or h["lon_idx"].max() >= _KEY_LAT - 1):
        raise ValueError("grid indices outside 0.._KEY_LAT-2 are not supported by the integer cell key")

    utc = pd.to_datetime(h["acquisition_datetime_utc"], utc=True, format="ISO8601")
    local = utc.dt.tz_convert(LOCAL_TIMEZONE)
    local_naive = local.dt.tz_localize(None)
    utc_naive = utc.dt.tz_localize(None)
    h["utc_hour"] = utc.dt.hour
    h["local_hour_cairo"] = local.dt.hour
    h["local_date_cairo"] = local_naive.dt.normalize()
    h["utc_offset_hours_cairo"] = (local_naive - utc_naive).dt.total_seconds() / 3600.0
    return h


def encode_cell_key(lat_idx, lon_idx) -> np.ndarray:
    """Pack integer grid indices into one int64 key."""
    return np.asarray(lat_idx, dtype=np.int64) * _KEY_LAT + np.asarray(lon_idx, dtype=np.int64)


def neighborhood_keys(lat_idx, lon_idx, rings: int = 1) -> np.ndarray:
    """Keys of every cell within ``rings`` cells (3x3 block for rings=1), self included."""
    lat = np.asarray(lat_idx, dtype=np.int64)
    lon = np.asarray(lon_idx, dtype=np.int64)
    if len(lat) == 0:
        return np.array([], dtype=np.int64)
    parts = [
        encode_cell_key(lat + dl, lon + dn)
        for dl in range(-rings, rings + 1)
        for dn in range(-rings, rings + 1)
    ]
    return np.unique(np.concatenate(parts))


def block_origin(lat, lon, size: float = BLOCK_SIZE_DEG) -> tuple[np.ndarray, np.ndarray]:
    """Lower-left corner of the geographic block that holds each point."""
    lat = np.asarray(lat, dtype=float)
    lon = np.asarray(lon, dtype=float)
    return np.floor(lat / size + 1e-9) * size, np.floor(lon / size + 1e-9) * size


def block_label(lat_min, lon_min) -> list[str]:
    """Stable text ids such as ``B31N_29E``. Always strings, never numbers."""
    return [f"B{a:g}N_{b:g}E" for a, b in zip(lat_min, lon_min)]


def _unit_vectors(lat_deg, lon_deg) -> np.ndarray:
    lat, lon = np.radians(np.asarray(lat_deg, dtype=float)), np.radians(np.asarray(lon_deg, dtype=float))
    return np.column_stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])


def nearest_distance_km(lat, lon, target_lat, target_lon, chunk: int = 2000) -> np.ndarray:
    """Great-circle distance (km) from each point to its nearest target point.

    Uses a KD-tree on 3-D unit-sphere coordinates. The nearest neighbour by
    chord length is also the nearest by great-circle distance, and the chord is
    converted back exactly (d = 2 R asin(c / 2)), so there is no accuracy loss
    versus an all-pairs haversine. Falls back to a chunked haversine when scipy
    is not installed. Returns NaN for every point when there are no targets.
    """
    lat = np.asarray(lat, dtype=float)
    lon = np.asarray(lon, dtype=float)
    t_lat = np.asarray(target_lat, dtype=float)
    t_lon = np.asarray(target_lon, dtype=float)
    if len(lat) == 0:
        return np.array([], dtype=float)
    if len(t_lat) == 0:
        return np.full(len(lat), np.nan)
    try:
        from scipy.spatial import cKDTree
    except ImportError:  # pragma: no cover - exercised only without scipy
        return _nearest_distance_chunked(lat, lon, t_lat, t_lon, chunk)
    tree = cKDTree(_unit_vectors(t_lat, t_lon))
    chord, _ = tree.query(_unit_vectors(lat, lon), k=1)
    return 2 * _EARTH_RADIUS_KM * np.arcsin(np.clip(chord / 2.0, 0.0, 1.0))


def _nearest_distance_chunked(lat, lon, t_lat, t_lon, chunk: int = 2000) -> np.ndarray:
    lat, lon, t_lat, t_lon = (np.radians(a) for a in (lat, lon, t_lat, t_lon))
    out = np.empty(len(lat))
    for start in range(0, len(lat), chunk):
        sl = slice(start, start + chunk)
        dlat = t_lat[None, :] - lat[sl, None]
        dlon = t_lon[None, :] - lon[sl, None]
        a = np.sin(dlat / 2) ** 2 + np.cos(lat[sl, None]) * np.cos(t_lat[None, :]) * np.sin(dlon / 2) ** 2
        out[sl] = (2 * _EARTH_RADIUS_KM * np.arcsin(np.sqrt(a))).min(axis=1)
    return out


# --------------------------------------------------------------------------
# Seasons (season-year definition)
# --------------------------------------------------------------------------
def season_year_of(year, month):
    """Season year: December belongs to the winter of the NEXT calendar year."""
    year = np.asarray(year)
    month = np.asarray(month)
    return np.where(month == 12, year + 1, year)


def season_expected_days(season: str, season_year: int) -> int:
    """Number of calendar days a complete season-year contains."""
    start_month = _SEASON_START_MONTH[season]
    start_year = season_year - 1 if season == "DJF" else season_year
    start = pd.Timestamp(year=start_year, month=start_month, day=1)
    end = start + pd.DateOffset(months=3)
    return int((end - start).days)


# --------------------------------------------------------------------------
# Sensor-day table and daily series
# --------------------------------------------------------------------------
def build_sensor_day(h: pd.DataFrame, coverage: pd.DataFrame) -> pd.DataFrame:
    """One row per sensor and calendar day with coverage and detection counts.

    ``observed`` means the coverage calendar found at least one record of any
    hotspot type for that sensor and day. A day that is observed but has zero
    vegetation candidates is a valid zero-activity day.
    """
    cov = coverage.copy()
    cov["date"] = pd.to_datetime(cov["acquisition_date"])
    cov["observed"] = cov["coverage_status"].eq("observed")
    cov = cov[cov["date"].dt.year.isin(YEARS)]

    def counts(mask, name):
        sub = h[mask]
        if sub.empty:
            return pd.DataFrame(columns=["sensor_key", "date", name])
        return sub.groupby(["sensor_key", "date"]).size().rename(name).reset_index()

    veg_rows = h[h["is_vegetation_fire_candidate"]]
    if veg_rows.empty:
        veg = pd.DataFrame(columns=["sensor_key", "date", "n_veg_detections", "n_veg_cells"])
    else:
        veg = (
            veg_rows.groupby(["sensor_key", "date"])
            .agg(n_veg_detections=("grid_cell_id", "size"), n_veg_cells=("grid_cell_id", "nunique"))
            .reset_index()
        )
    out = cov.merge(veg, on=["sensor_key", "date"], how="left")
    out = out.merge(counts(h["is_static_source"], "n_static_detections"), on=["sensor_key", "date"], how="left")
    out = out.merge(counts(h["is_water_detection"], "n_water_detections"), on=["sensor_key", "date"], how="left")
    for col in ("n_veg_detections", "n_veg_cells", "n_static_detections", "n_water_detections"):
        out[col] = out[col].fillna(0).astype(int)
    out["year"] = out["date"].dt.year
    out["month"] = out["date"].dt.month
    keep = [
        "sensor_key", "date", "year", "month", "coverage_status", "observed", "n_records",
        "n_veg_detections", "n_veg_cells", "n_static_detections", "n_water_detections",
    ]
    return out[keep].sort_values(["sensor_key", "date"]).reset_index(drop=True)


def _viirs_veg(h: pd.DataFrame) -> pd.DataFrame:
    return h[h["is_vegetation_fire_candidate"] & (h["sensor_family"] == "VIIRS")]


def build_static_neighborhood_keys(h: pd.DataFrame, year: int | None = None) -> np.ndarray:
    """Keys of all cells in or next to a VIIRS static-source (type 2) cell.

    ``year=None`` uses static cells seen in ANY analysed year (conservative);
    an integer uses only static cells seen in that year.
    """
    s = h[h["is_static_source"] & (h["sensor_family"] == "VIIRS")]
    if year is not None:
        s = s[s["year"] == year]
    s = s.drop_duplicates("grid_cell_id")
    return neighborhood_keys(s["lat_idx"], s["lon_idx"], rings=1)


def build_daily_summary(
    sensor_day: pd.DataFrame,
    h: pd.DataFrame,
    static_nbhd_keys: np.ndarray,
    static_nbhd_keys_by_year: dict[int, np.ndarray] | None = None,
) -> pd.DataFrame:
    """One row per day: per-sensor coverage and counts, plus VIIRS cell-day unions.

    The ``viirs_veg_cells_union_*`` columns count each cell once per day even if
    several sensors detected it. They are only comparable between days when the
    matching ``*_full_coverage`` flag is true.
    """
    obs = _wide(sensor_day, "observed", False)
    det = _wide(sensor_day, "n_veg_detections", 0)
    cells = _wide(sensor_day, "n_veg_cells", 0)
    static = _wide(sensor_day, "n_static_detections", 0)

    daily = pd.DataFrame(index=obs.index)
    daily.index.name = "date"
    for s in ALL_SENSORS:
        daily[f"observed_{s}"] = obs[s]
        daily[f"veg_detections_{s}"] = det[s]
        daily[f"veg_cells_{s}"] = cells[s]
        daily[f"static_detections_{s}"] = static[s]
    daily["n_viirs_sensors_observed"] = obs[list(VIIRS_SENSORS)].sum(axis=1).astype(int)
    daily["viirs_3sensor_full_coverage"] = obs[list(VIIRS_SENSORS)].all(axis=1)
    daily["viirs_n20_snpp_full_coverage"] = obs[["NOAA20", "SNPP"]].all(axis=1)

    veg_v = _viirs_veg(h)

    def union(sensors, exclude_by_year=None):
        sub = veg_v[veg_v["sensor_key"].isin(sensors)]
        if exclude_by_year is not None and len(sub):
            keys = encode_cell_key(sub["lat_idx"], sub["lon_idx"])
            bad = np.zeros(len(sub), dtype=bool)
            years = sub["year"].to_numpy()
            for y, ex in exclude_by_year.items():
                m = years == y
                if m.any() and len(ex):
                    bad[m] = np.isin(keys[m], ex)
            sub = sub[~bad]
        if sub.empty:
            return pd.Series(0, index=daily.index, dtype=int)
        return sub.groupby("date")["grid_cell_id"].nunique().reindex(daily.index, fill_value=0).astype(int)

    any_year = {y: static_nbhd_keys for y in YEARS}
    same_year = static_nbhd_keys_by_year if static_nbhd_keys_by_year is not None else any_year
    daily["viirs_veg_cells_union_3sensor"] = union(VIIRS_SENSORS)
    daily["viirs_veg_cells_union_n20_snpp"] = union(("NOAA20", "SNPP"))
    daily["viirs_veg_cells_union_3sensor_excl_static_3x3"] = union(VIIRS_SENSORS, any_year)
    daily["viirs_veg_cells_union_3sensor_excl_static_3x3_same_year"] = union(VIIRS_SENSORS, same_year)
    static_v = h[h["is_static_source"] & (h["sensor_family"] == "VIIRS")]
    daily["viirs_static_cells"] = (
        static_v.groupby("date")["grid_cell_id"].nunique().reindex(daily.index, fill_value=0).astype(int)
        if len(static_v) else 0
    )
    allveg = h[h["is_vegetation_fire_candidate"]]
    daily["all_sensor_veg_cells_union"] = (
        allveg.groupby("date")["grid_cell_id"].nunique().reindex(daily.index, fill_value=0).astype(int)
        if len(allveg) else 0
    )
    daily["year"] = daily.index.year
    daily["month"] = daily.index.month
    daily["season"] = daily["month"].map(SEASON_BY_MONTH)
    daily["season_year"] = season_year_of(daily["year"], daily["month"])
    return daily.reset_index()


def build_series_daily(daily: pd.DataFrame) -> pd.DataFrame:
    """Long table: one row per series and day with a ``used`` flag.

    ``used`` is true only when the series has usable coverage that day. Unused
    days are kept but never treated as zero activity.
    """
    frames = []

    def add(series, used, cell_days, detections):
        frames.append(
            pd.DataFrame(
                {
                    "series": series,
                    "date": daily["date"].to_numpy(),
                    "used": np.asarray(used, dtype=bool),
                    "cell_days": np.asarray(cell_days, dtype=float),
                    "detections": np.asarray(detections, dtype=float),
                }
            )
        )

    nan = np.full(len(daily), np.nan)
    for s in ALL_SENSORS:
        add(s, daily[f"observed_{s}"], daily[f"veg_cells_{s}"], daily[f"veg_detections_{s}"])
    full3, full2 = daily["viirs_3sensor_full_coverage"], daily["viirs_n20_snpp_full_coverage"]
    add(SERIES_V3, full3, daily["viirs_veg_cells_union_3sensor"], nan)
    add(SERIES_V2, full2, daily["viirs_veg_cells_union_n20_snpp"], nan)
    add(SERIES_V3_NO_STATIC, full3, daily["viirs_veg_cells_union_3sensor_excl_static_3x3"], nan)
    add(SERIES_V3_NO_STATIC_YEAR, full3, daily["viirs_veg_cells_union_3sensor_excl_static_3x3_same_year"], nan)
    out = pd.concat(frames, ignore_index=True)
    out["year"] = out["date"].dt.year
    out["month"] = out["date"].dt.month
    out["season"] = out["month"].map(SEASON_BY_MONTH)
    out["season_year"] = season_year_of(out["year"], out["month"])
    return out


# --------------------------------------------------------------------------
# Temporal summaries
# --------------------------------------------------------------------------
_STAT_COLUMNS = (
    "cell_days_on_used_days", "detections_on_used_days", "median_cell_days_per_used_day",
    "p95_cell_days_per_used_day", "max_cell_days_per_used_day",
)


def summarize_series(series_daily: pd.DataFrame, by: list[str]) -> pd.DataFrame:
    """Coverage-aware summary of every series, grouped by ``by``."""
    keys = ["series", *by]
    base = series_daily.groupby(keys).agg(
        calendar_days=("used", "size"),
        used_days=("used", "sum"),
        cell_days_all_available_days=("cell_days", "sum"),
    )
    used = series_daily[series_daily["used"]]
    if used.empty:
        stats = pd.DataFrame(np.nan, index=base.index, columns=list(_STAT_COLUMNS))
    else:
        stats = used.groupby(keys).agg(
            cell_days_on_used_days=("cell_days", "sum"),
            detections_on_used_days=("detections", lambda s: s.sum(min_count=1)),
            median_cell_days_per_used_day=("cell_days", "median"),
            p95_cell_days_per_used_day=("cell_days", lambda s: s.quantile(0.95)),
            max_cell_days_per_used_day=("cell_days", "max"),
        )
    out = base.join(stats, how="left")
    out["cell_days_on_used_days"] = out["cell_days_on_used_days"].fillna(0)
    out["unused_days"] = out["calendar_days"] - out["used_days"]
    has_days = out["used_days"] > 0
    denom = out["used_days"].where(has_days)
    out["mean_cell_days_per_used_day"] = out["cell_days_on_used_days"] / denom
    out["mean_detections_per_used_day"] = out["detections_on_used_days"] / denom
    out = out.reset_index()
    no_rate = out["series"].isin(SERIES_WITHOUT_RATES)
    for col in (
        "mean_cell_days_per_used_day", "mean_detections_per_used_day", "median_cell_days_per_used_day",
        "p95_cell_days_per_used_day", "max_cell_days_per_used_day",
    ):
        out.loc[no_rate, col] = np.nan
    out["rates_valid"] = ~no_rate
    for col in ("calendar_days", "used_days", "unused_days"):
        out[col] = out[col].astype(int)
    return out


def build_yearly_summary(series_daily: pd.DataFrame, sensor_day: pd.DataFrame) -> pd.DataFrame:
    """Per series and year. Year-over-year change is NOT computed here.

    Totals depend on how many days each year was observed. Use the matched-day
    tables for change between years.
    """
    out = summarize_series(series_daily, ["year"])
    extra = (
        sensor_day.groupby(["sensor_key", "year"])
        .agg(
            n_static_detections=("n_static_detections", "sum"),
            n_water_detections=("n_water_detections", "sum"),
            n_veg_detections_all_days=("n_veg_detections", "sum"),
        )
        .reset_index()
        .rename(columns={"sensor_key": "series"})
    )
    out = out.merge(extra, on=["series", "year"], how="left")
    out["used_day_share"] = out["used_days"] / out["calendar_days"]
    return out


def build_monthly_summary(series_daily: pd.DataFrame) -> pd.DataFrame:
    out = summarize_series(series_daily, ["year", "month"])
    out["month_coverage_fraction"] = out["used_days"] / out["calendar_days"]
    out["low_coverage_flag"] = out["month_coverage_fraction"] < MIN_MONTH_COVERAGE
    eligible = out[(~out["low_coverage_flag"]) & out["mean_cell_days_per_used_day"].notna()]
    peak_idx = eligible.groupby(["series", "year"])["mean_cell_days_per_used_day"].idxmax()
    out["is_peak_month_in_year"] = out.index.isin(peak_idx.to_numpy())
    return out


def build_monthly_pooled(series_daily: pd.DataFrame) -> pd.DataFrame:
    """Calendar-month profile pooled over all years (rate per usable day)."""
    out = summarize_series(series_daily, ["month"])
    years = series_daily[series_daily["used"]].groupby(["series", "month"])["year"].nunique().rename("years_contributing")
    out = out.merge(years.reset_index(), on=["series", "month"], how="left")
    out["years_contributing"] = out["years_contributing"].fillna(0).astype(int)
    eligible = out[(out["used_days"] >= MIN_POOLED_USED_DAYS) & out["mean_cell_days_per_used_day"].notna()]
    peak_idx = eligible.groupby("series")["mean_cell_days_per_used_day"].idxmax()
    out["is_peak_month"] = out.index.isin(peak_idx.to_numpy())
    return out


def _add_season_completeness(out: pd.DataFrame) -> pd.DataFrame:
    out["expected_season_days"] = [season_expected_days(s, int(y)) for s, y in zip(out["season"], out["season_year"])]
    out["season_year_complete"] = out["calendar_days"] == out["expected_season_days"]
    return out


def build_seasonal_summary(series_daily: pd.DataFrame) -> pd.DataFrame:
    """Meteorological seasons per SEASON YEAR (DJF of 2024 = Dec 2023 + Jan-Feb 2024).

    Season-years that the analysis window does not cover completely (DJF 2023
    has no December 2022, DJF 2026 has only December 2025) are flagged with
    ``season_year_complete = False``.
    """
    out = summarize_series(series_daily, ["season_year", "season"])
    return _add_season_completeness(out)


def build_seasonal_pooled(series_daily: pd.DataFrame) -> pd.DataFrame:
    out = summarize_series(series_daily, ["season"])
    years = series_daily[series_daily["used"]].groupby(["series", "season"])["season_year"].nunique().rename("season_years_contributing")
    out = out.merge(years.reset_index(), on=["series", "season"], how="left")
    out["season_years_contributing"] = out["season_years_contributing"].fillna(0).astype(int)
    return out


MATCHED_COLUMNS = [
    "series", "year", "n_matched_days", "first_matched_month_day", "last_matched_month_day",
    "total_cell_days", "mean_cell_days_per_day", "median_cell_days_per_day",
    "share_days_higher_than_previous_year", "pct_change_vs_previous_year", "pct_change_vs_first_year",
    "total_detections", "detections_pct_change_vs_first_year",
]


def matched_day_summary(series_daily: pd.DataFrame, series: str, years=YEARS) -> pd.DataFrame:
    """Compare years on calendar dates (month-day) usable in every year.

    Feb 29 is dropped because it exists in one year only. A date missing from
    the usable set in any year is dropped from all years.
    """
    d = series_daily[(series_daily["series"] == series) & series_daily["used"]].copy()
    d["month_day"] = d["date"].dt.strftime("%m-%d")
    d = d[(d["month_day"] != "02-29") & d["year"].isin(years)]
    n_years = d.groupby("month_day")["year"].nunique()
    matched = n_years[n_years == len(years)].index
    d = d[d["month_day"].isin(matched)]
    if d.empty:
        return pd.DataFrame(columns=MATCHED_COLUMNS)

    wide = d.pivot(index="month_day", columns="year", values="cell_days").sort_index()
    det = d.pivot(index="month_day", columns="year", values="detections").sort_index()
    has_det = bool(det.notna().all(axis=None))
    rows = []
    first = years[0]
    for i, y in enumerate(years):
        v = wide[y]
        row = {
            "series": series,
            "year": y,
            "n_matched_days": int(len(v)),
            "first_matched_month_day": wide.index.min(),
            "last_matched_month_day": wide.index.max(),
            "total_cell_days": float(v.sum()),
            "mean_cell_days_per_day": float(v.mean()),
            "median_cell_days_per_day": float(v.median()),
            "share_days_higher_than_previous_year": np.nan,
            "pct_change_vs_previous_year": np.nan,
            "pct_change_vs_first_year": np.nan,
            "total_detections": float(det[y].sum()) if has_det else np.nan,
            "detections_pct_change_vs_first_year": np.nan,
        }
        if i > 0:
            prev = wide[years[i - 1]]
            row["share_days_higher_than_previous_year"] = float((v > prev).mean())
            row["pct_change_vs_previous_year"] = _pct_change(v.sum(), prev.sum())
            row["pct_change_vs_first_year"] = _pct_change(v.sum(), wide[first].sum())
            if has_det:
                row["detections_pct_change_vs_first_year"] = _pct_change(det[y].sum(), det[first].sum())
        rows.append(row)
    return pd.DataFrame(rows, columns=MATCHED_COLUMNS)


def _concat_nonempty(frames: list[pd.DataFrame], columns: list[str]) -> pd.DataFrame:
    frames = [f for f in frames if len(f)]
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=columns)


def build_matched_day_tables(series_daily: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Primary matched-day table and the sensitivity table."""
    primary = _concat_nonempty(
        [matched_day_summary(series_daily, s) for s in (SERIES_V3, "NOAA20", "NOAA21", "SNPP")], MATCHED_COLUMNS
    )
    sensitivity = _concat_nonempty(
        [matched_day_summary(series_daily, s) for s in (SERIES_V2, SERIES_V3_NO_STATIC, SERIES_V3_NO_STATIC_YEAR)],
        MATCHED_COLUMNS,
    )
    return primary, sensitivity


def build_hourly_profile(h: pd.DataFrame) -> pd.DataFrame:
    """Detections by Africa/Cairo local hour, split by sensor and hotspot group.

    Satellite overpass times are fixed in UTC, so this profile mostly reflects
    the overpass schedule, not the daily cycle of fire behaviour.
    """
    d = h[h["hotspot_type"].isin([0, 2]) & h["local_hour_cairo"].notna()].copy()
    cols = ["sensor_key", "hotspot_group", "utc_offset_hours", "local_hour_cairo", "n_detections",
            "median_frp_mw", "share_daytime_flag", "share_of_group"]
    if d.empty:
        return pd.DataFrame(columns=cols)
    d["hotspot_group"] = np.where(d["hotspot_type"] == 0, "vegetation_candidate", "static_source")
    d["utc_offset_hours"] = d["utc_offset_hours_cairo"].round().astype(int)
    d["local_hour_cairo"] = d["local_hour_cairo"].astype(int)
    out = (
        d.groupby(["sensor_key", "hotspot_group", "utc_offset_hours", "local_hour_cairo"])
        .agg(
            n_detections=("record_id", "size"),
            median_frp_mw=("frp_mw", "median"),
            share_daytime_flag=("daynight", lambda s: float((s == "D").mean())),
        )
        .reset_index()
    )
    total = out.groupby(["sensor_key", "hotspot_group", "utc_offset_hours"])["n_detections"].transform("sum")
    out["share_of_group"] = out["n_detections"] / total
    return out


# --------------------------------------------------------------------------
# Spatial analysis
# --------------------------------------------------------------------------
_CELL_DAY_COLUMNS = ["date", "grid_cell_id", "grid_cell_lat", "grid_cell_lon", "lat_idx", "lon_idx",
                     "n_sensors", "n_detections", "mean_frp_mw", "year"]


def build_cell_days(h: pd.DataFrame, mask: pd.Series) -> pd.DataFrame:
    """Unique (date, cell) rows for the selected detections, sensors merged.

    ``n_detections`` is the raw record count across the merged sensors (kept
    for transparency; it is not a count of independent fires).
    """
    sub = h[mask]
    if sub.empty:
        return pd.DataFrame(columns=_CELL_DAY_COLUMNS)
    out = (
        sub.groupby(["date", "grid_cell_id"], sort=True)
        .agg(
            grid_cell_lat=("grid_cell_lat", "first"),
            grid_cell_lon=("grid_cell_lon", "first"),
            lat_idx=("lat_idx", "first"),
            lon_idx=("lon_idx", "first"),
            n_sensors=("sensor_key", "nunique"),
            n_detections=("record_id", "size"),
            mean_frp_mw=("frp_mw", "mean"),
        )
        .reset_index()
    )
    out["year"] = out["date"].dt.year
    return out


def assert_unique_cell_days(frame: pd.DataFrame, keys=("date", "grid_cell_id"), name: str = "cell-day table") -> None:
    """Raise if a cell-day table has duplicated keys."""
    dup = frame.duplicated(list(keys)).sum()
    if dup:
        raise AssertionError(f"{name} has {int(dup)} duplicated {list(keys)} rows")


def _spatial_cell_columns(years) -> list[str]:
    cols = ["grid_cell_id", "grid_cell_lat", "grid_cell_lon", "lat_idx", "lon_idx", "first_date", "last_date",
            "viirs_raw_detections_sum_not_independent", "multi_sensor_cell_days", "mean_frp_mw"]
    cols += [f"veg_cell_days_{y}" for y in years]
    cols += ["veg_cell_days_total", "years_with_activity", "multi_sensor_share", "viirs_static_cell_days_total",
             "has_static_same_cell", "static_in_3x3_neighborhood", "nearest_viirs_static_cell_km"]
    cols += [f"persistent_{y}" for y in years]
    cols += ["persistent_any_year", "block_lat_min", "block_lon_min", "block_id_1deg", "rank_by_total_cell_days"]
    return cols


def build_spatial_cells(veg_cd: pd.DataFrame, static_cd: pd.DataFrame, years=YEARS) -> pd.DataFrame:
    """One row per grid cell with at least one VIIRS vegetation-candidate cell-day."""
    if veg_cd.empty:
        empty = pd.DataFrame(columns=_spatial_cell_columns(years))
        bool_cols = ["has_static_same_cell", "static_in_3x3_neighborhood", "persistent_any_year",
                     *[f"persistent_{y}" for y in years]]
        return empty.astype({c: bool for c in bool_cols})
    assert_unique_cell_days(veg_cd, name="VIIRS vegetation cell-days")
    by_year = (
        veg_cd.groupby(["grid_cell_id", "year"]).size().unstack(fill_value=0).reindex(columns=list(years), fill_value=0)
    )
    by_year.columns = [f"veg_cell_days_{y}" for y in years]
    agg = veg_cd.groupby("grid_cell_id").agg(
        grid_cell_lat=("grid_cell_lat", "first"),
        grid_cell_lon=("grid_cell_lon", "first"),
        lat_idx=("lat_idx", "first"),
        lon_idx=("lon_idx", "first"),
        first_date=("date", "min"),
        last_date=("date", "max"),
        viirs_raw_detections_sum_not_independent=("n_detections", "sum"),
        multi_sensor_cell_days=("n_sensors", lambda s: int((s >= 2).sum())),
        mean_frp_mw=("mean_frp_mw", "mean"),
    )
    cells = agg.join(by_year)
    cells["veg_cell_days_total"] = by_year.sum(axis=1)
    cells["years_with_activity"] = (by_year > 0).sum(axis=1)
    cells["multi_sensor_share"] = cells["multi_sensor_cell_days"] / cells["veg_cell_days_total"]

    if static_cd.empty:
        cells["viirs_static_cell_days_total"] = 0
        cells["has_static_same_cell"] = False
        cells["static_in_3x3_neighborhood"] = False
        cells["nearest_viirs_static_cell_km"] = np.nan
    else:
        assert_unique_cell_days(static_cd, name="VIIRS static cell-days")
        static_days = static_cd.groupby("grid_cell_id").size().rename("viirs_static_cell_days_total")
        cells = cells.join(static_days)
        cells["viirs_static_cell_days_total"] = cells["viirs_static_cell_days_total"].fillna(0).astype(int)
        static_cells = static_cd.drop_duplicates("grid_cell_id")
        keys = encode_cell_key(cells["lat_idx"], cells["lon_idx"])
        cells["has_static_same_cell"] = np.isin(keys, encode_cell_key(static_cells["lat_idx"], static_cells["lon_idx"]))
        cells["static_in_3x3_neighborhood"] = np.isin(
            keys, neighborhood_keys(static_cells["lat_idx"], static_cells["lon_idx"], rings=1)
        )
        cells["nearest_viirs_static_cell_km"] = nearest_distance_km(
            cells["grid_cell_lat"], cells["grid_cell_lon"], static_cells["grid_cell_lat"], static_cells["grid_cell_lon"]
        )
    for y in years:
        cells[f"persistent_{y}"] = cells[f"veg_cell_days_{y}"] >= PERSISTENT_MIN_DAYS
    cells["persistent_any_year"] = cells[[f"persistent_{y}" for y in years]].any(axis=1)

    lat_min, lon_min = block_origin(cells["grid_cell_lat"], cells["grid_cell_lon"])
    cells["block_lat_min"] = lat_min
    cells["block_lon_min"] = lon_min
    cells["block_id_1deg"] = block_label(lat_min, lon_min)
    cells["rank_by_total_cell_days"] = cells["veg_cell_days_total"].rank(method="min", ascending=False).astype(int)
    cells = cells.reset_index().sort_values(["veg_cell_days_total", "grid_cell_id"], ascending=[False, True])
    return cells.reset_index(drop=True)


def label_clusters_8(lat_idx, lon_idx) -> np.ndarray:
    """Connected components of cells using 8-neighbour (queen) connectivity."""
    lat = np.asarray(lat_idx, dtype=np.int64)
    lon = np.asarray(lon_idx, dtype=np.int64)
    position = {(int(a), int(b)): i for i, (a, b) in enumerate(zip(lat, lon))}
    labels = np.full(len(lat), -1, dtype=np.int64)
    current = 0
    for start in range(len(lat)):
        if labels[start] != -1:
            continue
        labels[start] = current
        stack = [start]
        while stack:
            i = stack.pop()
            for dl in (-1, 0, 1):
                for dn in (-1, 0, 1):
                    if dl == 0 and dn == 0:
                        continue
                    j = position.get((int(lat[i]) + dl, int(lon[i]) + dn))
                    if j is not None and labels[j] == -1:
                        labels[j] = current
                        stack.append(j)
        current += 1
    return labels


def build_hotspot_clusters(cells: pd.DataFrame, years=YEARS, percentile: float = HOTSPOT_PERCENTILE):
    """Statistical concentration clusters of high VIIRS vegetation-candidate activity.

    For each scope the threshold is the ``percentile`` of active days among
    cells that have at least one active day (cells with ``>= threshold`` are
    "high"). High cells that touch (8 neighbours) form one cluster. A cluster
    is a statistical concentration, not a confirmed fire location.

    Returns (clusters, thresholds, membership) where membership maps
    grid_cell_id to the all_years cluster id.
    """
    scopes = [("all_years", "veg_cell_days_total")] + [(str(y), f"veg_cell_days_{y}") for y in years]
    cluster_rows, threshold_rows = [], []
    membership: dict[str, str] = {}
    for scope, col in scopes:
        if cells.empty:
            continue
        detected = cells[cells[col] > 0]
        if detected.empty:
            continue
        thr = float(np.percentile(detected[col], percentile))
        high = detected[detected[col] >= thr].copy()
        high["_label"] = label_clusters_8(high["lat_idx"], high["lon_idx"])
        scope_total = float(detected[col].sum())
        built = []
        for _, grp in high.groupby("_label"):
            w = grp[col].astype(float)
            peak = grp.loc[grp[col].idxmax()]
            row = {
                "cluster_scope": scope,
                "percentile": percentile,
                "threshold_days": thr,
                "n_cells": int(len(grp)),
                "total_cell_days": int(grp[col].sum()),
                "share_of_scope_cell_days": _safe_div(grp[col].sum(), scope_total),
                "centroid_lat": float(np.average(grp["grid_cell_lat"], weights=w)),
                "centroid_lon": float(np.average(grp["grid_cell_lon"], weights=w)),
                "lat_min": float(grp["grid_cell_lat"].min() - GRID_SIZE_DEG / 2),
                "lat_max": float(grp["grid_cell_lat"].max() + GRID_SIZE_DEG / 2),
                "lon_min": float(grp["grid_cell_lon"].min() - GRID_SIZE_DEG / 2),
                "lon_max": float(grp["grid_cell_lon"].max() + GRID_SIZE_DEG / 2),
                "peak_cell_id": peak["grid_cell_id"],
                "peak_cell_days": int(peak[col]),
                "n_cells_with_static_same_cell": int(grp["has_static_same_cell"].sum()),
                "n_cells_static_in_3x3": int(grp["static_in_3x3_neighborhood"].sum()),
                "block_ids": "|".join(sorted(grp["block_id_1deg"].unique())),
                "member_cell_ids": "|".join(grp["grid_cell_id"]),
            }
            for y in years:
                row[f"cell_days_{y}"] = int(grp[f"veg_cell_days_{y}"].sum())
            share = row["n_cells_static_in_3x3"] / row["n_cells"]
            row["static_proximity_flag"] = "all_cells" if share == 1 else ("none" if share == 0 else "some_cells")
            built.append(row)
        built.sort(key=lambda r: (-r["total_cell_days"], r["peak_cell_id"]))
        for rank, row in enumerate(built, start=1):
            row["cluster_id"] = f"HC-{scope}-{rank:03d}"
            if scope == "all_years":
                for cid in row["member_cell_ids"].split("|"):
                    membership[cid] = row["cluster_id"]
        cluster_rows.extend(built)
        threshold_rows.append(
            {
                "cluster_scope": scope,
                "percentile": percentile,
                "threshold_days": thr,
                "n_active_cells": int(len(detected)),
                "n_high_cells": int(len(high)),
                "n_clusters": len(built),
                "n_single_cell_clusters": int(sum(r["n_cells"] == 1 for r in built)),
                "high_cells_share_of_cell_days": _safe_div(high[col].sum(), scope_total),
            }
        )
    clusters = pd.DataFrame(cluster_rows)
    if not clusters.empty:
        first = ["cluster_id", "cluster_scope"]
        clusters = clusters[first + [c for c in clusters.columns if c not in first]]
    return clusters, pd.DataFrame(threshold_rows), membership


def gini(values) -> float:
    """Gini coefficient of non-negative values (0 equal, 1 fully concentrated)."""
    x = np.sort(np.asarray(values, dtype=float))
    n = len(x)
    total = x.sum()
    if n == 0 or total <= 0:
        return np.nan
    index = np.arange(1, n + 1)
    return float((2.0 * (index * x).sum()) / (n * total) - (n + 1.0) / n)


_CONCENTRATION_KEYS = (
    "n_active_cells", "total_cell_days", "mean_days_per_cell", "median_days_per_cell", "max_days_per_cell",
    "top1_cell_share", "top10_cells_share", "top50_cells_share", "top_1pct_cells_share", "top_5pct_cells_share",
    "top_10pct_cells_share", "cells_for_50pct_of_cell_days", "cells_for_50pct_share_of_cells", "gini",
)


def concentration_metrics(counts: pd.Series) -> dict:
    """Concentration of cell-days across active cells. Undefined metrics are NaN."""
    x = np.sort(counts.to_numpy(dtype=float))[::-1]
    n, total = len(x), float(x.sum())
    out = {k: np.nan for k in _CONCENTRATION_KEYS}
    out["n_active_cells"], out["total_cell_days"] = n, total
    if n == 0 or total == 0:
        return out
    cum = np.cumsum(x) / total

    def top_share(k):
        return float(cum[min(max(k, 1), n) - 1])

    out.update(
        mean_days_per_cell=float(x.mean()),
        median_days_per_cell=float(np.median(x)),
        max_days_per_cell=float(x[0]),
        top1_cell_share=top_share(1),
        top10_cells_share=top_share(10),
        top50_cells_share=top_share(50),
        top_1pct_cells_share=top_share(int(np.ceil(0.01 * n))),
        top_5pct_cells_share=top_share(int(np.ceil(0.05 * n))),
        top_10pct_cells_share=top_share(int(np.ceil(0.10 * n))),
        cells_for_50pct_of_cell_days=int(np.searchsorted(cum, 0.5) + 1),
        cells_for_50pct_share_of_cells=float((np.searchsorted(cum, 0.5) + 1) / n),
        gini=gini(x),
    )
    return out


def build_spatial_concentration(cells: pd.DataFrame, years=YEARS) -> pd.DataFrame:
    """Concentration by scope and by cell filter.

    The filters show how much the apparent concentration depends on cells in or
    next to static thermal sources, or on persistent cells. They are
    sensitivity views, not corrections.
    """
    rows = []
    scopes = [("all_years", "veg_cell_days_total", "persistent_any_year")] + [
        (str(y), f"veg_cell_days_{y}", f"persistent_{y}") for y in years
    ]
    for scope, col, persistent_col in scopes:
        active = cells[cells[col] > 0] if not cells.empty else cells
        variants = {
            "all_viirs_veg_cells": active,
            "excl_static_3x3_neighborhood": active[~active["static_in_3x3_neighborhood"].astype(bool)],
            "excl_persistent_cells": active[~active[persistent_col].astype(bool)],
        }
        for name, frame in variants.items():
            rows.append({"scope": scope, "cell_filter": name, **concentration_metrics(frame[col])})
    return pd.DataFrame(rows)


def build_persistent_activity(cells: pd.DataFrame, years=YEARS) -> pd.DataFrame:
    """Persistent cells: at least ``PERSISTENT_MIN_DAYS`` VIIRS candidate cell-days in one year.

    Cell-days are the union of the VIIRS sensors, not normalised by coverage.
    """
    rows = []
    for y in years:
        col = f"veg_cell_days_{y}"
        active = cells[cells[col] > 0] if not cells.empty else cells
        pers = active[active[f"persistent_{y}"]]
        rows.append(
            {
                "scope": str(y),
                "threshold_days": PERSISTENT_MIN_DAYS,
                "n_active_cells": int(len(active)),
                "n_persistent_cells": int(len(pers)),
                "persistent_share_of_cell_days": _safe_div(pers[col].sum(), active[col].sum()),
                "n_persistent_with_static_same_cell": int(pers["has_static_same_cell"].sum()),
                "n_persistent_static_in_3x3": int(pers["static_in_3x3_neighborhood"].sum()),
                "max_days_in_a_cell": int(active[col].max()) if len(active) else 0,
            }
        )
    anyp = cells[cells["persistent_any_year"]] if not cells.empty else cells
    rows.append(
        {
            "scope": "any_year",
            "threshold_days": PERSISTENT_MIN_DAYS,
            "n_active_cells": int(len(cells)),
            "n_persistent_cells": int(len(anyp)),
            "persistent_share_of_cell_days": _safe_div(anyp["veg_cell_days_total"].sum(), cells["veg_cell_days_total"].sum()),
            "n_persistent_with_static_same_cell": int(anyp["has_static_same_cell"].sum()),
            "n_persistent_static_in_3x3": int(anyp["static_in_3x3_neighborhood"].sum()),
            "max_days_in_a_cell": int(cells["veg_cell_days_total"].max()) if len(cells) else 0,
        }
    )
    return pd.DataFrame(rows)


def build_static_source_cells(h: pd.DataFrame, cells: pd.DataFrame, years=YEARS) -> pd.DataFrame:
    """One row per cell with any type-2 detection (ALL sensors), kept separate.

    Population note: this table covers static detections from every sensor,
    while the static-neighbourhood flags in the vegetation tables use VIIRS
    static cells only. ``detected_by_viirs`` links the two.
    """
    s = h[h["is_static_source"]]
    if s.empty:
        return pd.DataFrame()
    agg = s.groupby("grid_cell_id").agg(
        grid_cell_lat=("grid_cell_lat", "first"),
        grid_cell_lon=("grid_cell_lon", "first"),
        lat_idx=("lat_idx", "first"),
        lon_idx=("lon_idx", "first"),
        first_date=("date", "min"),
        last_date=("date", "max"),
        static_detections_all_sensors=("record_id", "size"),
    )
    per_sensor = (
        s.groupby(["grid_cell_id", "sensor_key"]).size().unstack(fill_value=0).reindex(columns=list(ALL_SENSORS), fill_value=0)
    )
    per_sensor.columns = [f"static_detections_{c}" for c in per_sensor.columns]
    viirs = s[s["sensor_family"] == "VIIRS"]
    days = (
        viirs.drop_duplicates(["date", "grid_cell_id"])
        .groupby(["grid_cell_id", "year"]).size().unstack(fill_value=0).reindex(columns=list(years), fill_value=0)
        if len(viirs) else pd.DataFrame(columns=list(years), dtype=int)
    )
    days.columns = [f"viirs_static_days_{y}" for y in years]
    out = agg.join(per_sensor).join(days)
    for col in days.columns:
        out[col] = out[col].fillna(0).astype(int)
    out["viirs_static_days_total"] = out[list(days.columns)].sum(axis=1)
    out["viirs_static_years_active"] = (out[list(days.columns)] > 0).sum(axis=1)
    out["viirs_static_mean_frp_mw"] = viirs.groupby("grid_cell_id")["frp_mw"].mean() if len(viirs) else np.nan
    out["detected_by_viirs"] = out["viirs_static_days_total"] > 0

    if len(cells):
        veg_lookup = dict(zip(encode_cell_key(cells["lat_idx"], cells["lon_idx"]).tolist(), cells["veg_cell_days_total"].tolist()))
    else:
        veg_lookup = {}
    keys = encode_cell_key(out["lat_idx"], out["lon_idx"])
    out["veg_cell_days_same_cell"] = [int(veg_lookup.get(int(k), 0)) for k in keys]
    out["veg_cell_days_in_3x3"] = [
        int(sum(veg_lookup.get(int(k) + dl * _KEY_LAT + dn, 0) for dl in (-1, 0, 1) for dn in (-1, 0, 1))) for k in keys
    ]
    out["has_veg_candidate_same_cell"] = out["veg_cell_days_same_cell"] > 0
    lat_min, lon_min = block_origin(out["grid_cell_lat"], out["grid_cell_lon"])
    out["block_lat_min"], out["block_lon_min"] = lat_min, lon_min
    out["block_id_1deg"] = block_label(lat_min, lon_min)
    out = out.reset_index().sort_values(["static_detections_all_sensors", "grid_cell_id"], ascending=[False, True])
    return out.reset_index(drop=True)


def build_static_source_yearly(h: pd.DataFrame) -> pd.DataFrame:
    """Per sensor and year: counts by hotspot type and static cell counts."""
    base = (
        h.groupby(["sensor_key", "year"])
        .agg(
            n_rows=("record_id", "size"),
            n_type0_vegetation_candidates=("is_vegetation_fire_candidate", "sum"),
            n_type2_static=("is_static_source", "sum"),
            n_type3_water=("is_water_detection", "sum"),
            n_type1_volcano=("hotspot_type", lambda s: int((s == 1).sum())),
        )
        .reset_index()
    )
    s = h[h["is_static_source"]]
    if s.empty:
        base["n_static_cells"] = 0
        base["n_static_cell_days"] = 0
    else:
        cell_stats = (
            s.groupby(["sensor_key", "year"])
            .agg(n_static_cells=("grid_cell_id", "nunique"))
            .join(
                s.drop_duplicates(["sensor_key", "date", "grid_cell_id"]).groupby(["sensor_key", "year"]).size().rename("n_static_cell_days")
            )
            .reset_index()
        )
        base = base.merge(cell_stats, on=["sensor_key", "year"], how="left")
        base[["n_static_cells", "n_static_cell_days"]] = base[["n_static_cells", "n_static_cell_days"]].fillna(0).astype(int)
    base["static_share_of_rows"] = base["n_type2_static"] / base["n_rows"]
    base["type0_plus_type2"] = base["n_type0_vegetation_candidates"] + base["n_type2_static"]
    return base


def build_static_cell_turnover(h: pd.DataFrame, years=YEARS) -> pd.DataFrame:
    """How the set of VIIRS static-source cells changes between years."""
    s = h[h["is_static_source"] & (h["sensor_family"] == "VIIRS")]
    sets = {y: set(s.loc[s["year"] == y, "grid_cell_id"]) for y in years}
    rows = []
    for i in range(len(years)):
        for j in range(i + 1, len(years)):
            a, b = sets[years[i]], sets[years[j]]
            union = a | b
            rows.append(
                {
                    "year_a": years[i], "year_b": years[j], "cells_a": len(a), "cells_b": len(b),
                    "in_both": len(a & b), "only_a": len(a - b), "only_b": len(b - a),
                    "jaccard": _safe_div(len(a & b), len(union)),
                }
            )
    return pd.DataFrame(rows)


def build_static_proximity_summary(cells: pd.DataFrame) -> pd.DataFrame:
    """Vegetation-candidate cells grouped by distance to the nearest VIIRS static cell."""
    cols = ["proximity_band", "n_cells", "veg_cell_days", "mean_days_per_cell", "median_days_per_cell",
            "n_persistent_cells", "share_of_cells", "share_of_cell_days"]
    if cells.empty:
        return pd.DataFrame(columns=cols)
    dist = cells["nearest_viirs_static_cell_km"]
    band = np.select(
        [dist.isna(), cells["has_static_same_cell"], cells["static_in_3x3_neighborhood"], dist <= 10, dist <= 50],
        ["no_static_reference", "1_same_cell", "2_adjacent_cell_8neighbour", "3_within_10km", "4_10_to_50km"],
        default="5_beyond_50km",
    )
    work = cells.assign(proximity_band=band)
    total_days = work["veg_cell_days_total"].sum()
    out = (
        work.groupby("proximity_band")
        .agg(
            n_cells=("grid_cell_id", "size"),
            veg_cell_days=("veg_cell_days_total", "sum"),
            mean_days_per_cell=("veg_cell_days_total", "mean"),
            median_days_per_cell=("veg_cell_days_total", "median"),
            n_persistent_cells=("persistent_any_year", "sum"),
        )
        .reset_index()
    )
    out["share_of_cells"] = out["n_cells"] / len(work)
    out["share_of_cell_days"] = out["veg_cell_days"] / total_days if total_days else np.nan
    return out


def build_static_influence_metrics(cells: pd.DataFrame, concentration: pd.DataFrame, persistent: pd.DataFrame) -> pd.DataFrame:
    """Key-value metrics on how static sources relate to candidate concentration.

    Correlation is descriptive only. It says nothing about cause.
    """
    rows = []

    def add(metric, value, note=""):
        rows.append({"metric": metric, "value": value, "note": note})

    n = len(cells)
    add("n_viirs_veg_cells", n)
    if n:
        in_3x3 = cells["static_in_3x3_neighborhood"]
        add("n_veg_cells_static_same_cell", int(cells["has_static_same_cell"].sum()))
        add("n_veg_cells_static_in_3x3", int(in_3x3.sum()))
        add("share_veg_cells_static_in_3x3", float(in_3x3.mean()))
        add("share_veg_cell_days_in_static_3x3_cells", _safe_div(cells.loc[in_3x3, "veg_cell_days_total"].sum(), cells["veg_cell_days_total"].sum()))
        valid = cells["nearest_viirs_static_cell_km"].notna()
        rho = np.nan
        if valid.sum() > 2:
            rho = cells.loc[valid, "nearest_viirs_static_cell_km"].corr(cells.loc[valid, "veg_cell_days_total"], method="spearman")
        add("spearman_distance_to_static_vs_veg_cell_days", float(rho), "descriptive; not causal")
        top10 = cells.head(10)
        add("top10_cells_with_static_in_3x3", int(top10["static_in_3x3_neighborhood"].sum()), "of the 10 most active cells")
        top1pct = cells.head(int(np.ceil(0.01 * n)))
        add("top_1pct_cells_with_static_in_3x3_share", float(top1pct["static_in_3x3_neighborhood"].mean()))
    anyp = persistent[persistent["scope"] == "any_year"]
    if len(anyp):
        a = anyp.iloc[0]
        add("persistent_cells_any_year", int(a["n_persistent_cells"]))
        add("persistent_cells_with_static_in_3x3", int(a["n_persistent_static_in_3x3"]))
    allc = concentration[concentration["scope"] == "all_years"].set_index("cell_filter")
    for flt in ("all_viirs_veg_cells", "excl_static_3x3_neighborhood", "excl_persistent_cells"):
        if flt in allc.index:
            add(f"all_years_top_5pct_cells_share[{flt}]", float(allc.loc[flt, "top_5pct_cells_share"]))
            add(f"all_years_gini[{flt}]", float(allc.loc[flt, "gini"]))
    return pd.DataFrame(rows)


def build_regional_blocks(cells: pd.DataFrame, static_cells: pd.DataFrame, years=YEARS) -> pd.DataFrame:
    """1-degree geographic analysis blocks. These are NOT official governorate boundaries."""
    key = ["block_id_1deg", "block_lat_min", "block_lon_min"]
    if len(cells):
        veg = (
            cells.groupby(key)
            .agg(
                n_veg_cells=("grid_cell_id", "size"),
                veg_cell_days_total=("veg_cell_days_total", "sum"),
                n_persistent_cells=("persistent_any_year", "sum"),
                n_cells_static_in_3x3=("static_in_3x3_neighborhood", "sum"),
                top_cell_days=("veg_cell_days_total", "max"),
                **{f"veg_cell_days_{y}": (f"veg_cell_days_{y}", "sum") for y in years},
            )
            .reset_index()
        )
        top = cells.loc[cells.groupby("block_id_1deg")["veg_cell_days_total"].idxmax(), ["block_id_1deg", "grid_cell_id"]]
        veg = veg.merge(top.rename(columns={"grid_cell_id": "top_cell_id"}), on="block_id_1deg", how="left")
        excl = (
            cells[~cells["static_in_3x3_neighborhood"]]
            .groupby("block_id_1deg")["veg_cell_days_total"].sum().rename("veg_cell_days_excl_static_3x3").reset_index()
        )
        veg = veg.merge(excl, on="block_id_1deg", how="left")
        veg["veg_cell_days_excl_static_3x3"] = veg["veg_cell_days_excl_static_3x3"].fillna(0).astype(int)
    else:
        veg = pd.DataFrame(columns=key + ["n_veg_cells", "veg_cell_days_total", "n_persistent_cells", "n_cells_static_in_3x3",
                                          "top_cell_days", *[f"veg_cell_days_{y}" for y in years], "top_cell_id",
                                          "veg_cell_days_excl_static_3x3"])

    static_cols = ["n_static_cells_any_sensor", "n_static_cells_viirs", "viirs_static_days_total", "static_detections_all_sensors"]
    if len(static_cells):
        stat = (
            static_cells.groupby(key)
            .agg(
                n_static_cells_any_sensor=("grid_cell_id", "size"),
                n_static_cells_viirs=("detected_by_viirs", "sum"),
                viirs_static_days_total=("viirs_static_days_total", "sum"),
                static_detections_all_sensors=("static_detections_all_sensors", "sum"),
            )
            .reset_index()
        )
        out = veg.merge(stat, on=key, how="outer")
    else:
        out = veg.copy()
        for c in static_cols:
            out[c] = 0
    if out.empty:
        return out.assign(block_lat_max=pd.Series(dtype=float), block_lon_max=pd.Series(dtype=float),
                          share_of_veg_cell_days=pd.Series(dtype=float), veg_to_static_cell_day_ratio=pd.Series(dtype=float))
    out["top_cell_id"] = out["top_cell_id"].fillna("").astype(str)
    numeric = [c for c in out.columns if c not in ("block_id_1deg", "top_cell_id", "block_lat_min", "block_lon_min")]
    out[numeric] = out[numeric].fillna(0)
    for c in numeric:
        out[c] = out[c].astype(int)
    out["block_lat_max"] = out["block_lat_min"] + BLOCK_SIZE_DEG
    out["block_lon_max"] = out["block_lon_min"] + BLOCK_SIZE_DEG
    total = out["veg_cell_days_total"].sum()
    out["share_of_veg_cell_days"] = out["veg_cell_days_total"] / total if total else np.nan
    out["veg_to_static_cell_day_ratio"] = np.where(
        out["viirs_static_days_total"] > 0, out["veg_cell_days_total"] / out["viirs_static_days_total"].replace(0, np.nan), np.nan
    )
    return out.sort_values(["veg_cell_days_total", "block_id_1deg"], ascending=[False, True]).reset_index(drop=True)


# --------------------------------------------------------------------------
# Sensor comparison
# --------------------------------------------------------------------------
def build_sensor_profile(h: pd.DataFrame, sensor_day: pd.DataFrame) -> pd.DataFrame:
    """Per sensor descriptive profile. Counts are never summed across sensors."""
    rows = []
    for s in ALL_SENSORS:
        d = h[h["sensor_key"] == s]
        veg = d[d["is_vegetation_fire_candidate"]]
        sd = sensor_day[sensor_day["sensor_key"] == s]
        observed = int(sd["observed"].sum())
        row = {
            "sensor_key": s,
            "sensor_family": d["sensor_family"].iloc[0] if len(d) else ("MODIS" if s == "MODIS" else "VIIRS"),
            "nominal_resolution_m": int(d["nominal_resolution_m"].iloc[0]) if len(d) else np.nan,
            "n_rows": int(len(d)),
            "n_type0_vegetation_candidates": int(len(veg)),
            "n_type2_static": int(d["is_static_source"].sum()),
            "n_type3_water": int(d["is_water_detection"].sum()),
            "static_share_of_rows": _safe_div(d["is_static_source"].sum(), len(d)),
            "observed_days": observed,
            "unobserved_days": int(len(sd) - observed),
            "veg_active_cells": int(veg["grid_cell_id"].nunique()),
            "veg_cell_days": int(len(veg.drop_duplicates(["date", "grid_cell_id"]))),
            "mean_veg_detections_per_observed_day": _safe_div(len(veg), observed) if s not in SERIES_WITHOUT_RATES else np.nan,
            "median_veg_frp_mw": float(veg["frp_mw"].median()) if len(veg) else np.nan,
            "p95_veg_frp_mw": float(veg["frp_mw"].quantile(0.95)) if len(veg) else np.nan,
            "veg_night_share": float((veg["daynight"] == "N").mean()) if len(veg) else np.nan,
            "mean_pixel_scan_km": float(veg["scan_km"].mean()) if len(veg) else np.nan,
            "mean_pixel_track_km": float(veg["track_km"].mean()) if len(veg) else np.nan,
        }
        # The two confidence formats are reported separately and never mixed.
        if s == "MODIS":
            row["veg_mean_confidence_numeric"] = float(veg["confidence_numeric"].astype(float).mean()) if len(veg) else np.nan
            for c in ("l", "n", "h"):
                row[f"veg_confidence_{c}_share"] = np.nan
        else:
            row["veg_mean_confidence_numeric"] = np.nan
            for c in ("l", "n", "h"):
                row[f"veg_confidence_{c}_share"] = float((veg["confidence_class"] == c).mean()) if len(veg) else np.nan
        rows.append(row)
    return pd.DataFrame(rows)


def _safe_corr(a: pd.Series, b: pd.Series, method: str) -> float:
    if len(a) < 3 or a.nunique() < 2 or b.nunique() < 2:
        return np.nan
    return float(a.corr(b, method=method))


def build_pair_daily_correlation(sensor_day: pd.DataFrame, years=YEARS) -> pd.DataFrame:
    """Day-by-day correlation between two VIIRS sensors on days both observed.

    Correlation is descriptive; it does not show that one sensor explains the other.
    """
    obs = _wide(sensor_day, "observed", False)
    det = _wide(sensor_day, "n_veg_detections", 0)
    cel = _wide(sensor_day, "n_veg_cells", 0)
    rows = []
    for a, b in SENSOR_PAIRS:
        common = obs[a] & obs[b]
        frame = pd.DataFrame({"det_a": det[a], "det_b": det[b], "cells_a": cel[a], "cells_b": cel[b]})[common].astype(float)
        frame["year"] = frame.index.year
        ym = frame.index.to_period("M")
        for col in ("cells_a", "cells_b"):
            frame[f"{col}_dm"] = frame[col] - frame.groupby(ym)[col].transform("mean")
        for scope in ["all_years", *years]:
            sub = frame if scope == "all_years" else frame[frame["year"] == scope]
            rows.append(
                {
                    "sensor_a": a, "sensor_b": b, "scope": str(scope), "n_common_days": int(len(sub)),
                    "pearson_daily_detections": _safe_corr(sub["det_a"], sub["det_b"], "pearson"),
                    "spearman_daily_detections": _safe_corr(sub["det_a"], sub["det_b"], "spearman"),
                    "pearson_daily_cells": _safe_corr(sub["cells_a"], sub["cells_b"], "pearson"),
                    "spearman_daily_cells": _safe_corr(sub["cells_a"], sub["cells_b"], "spearman"),
                    "pearson_daily_cells_monthly_demeaned": _safe_corr(sub["cells_a_dm"], sub["cells_b_dm"], "pearson"),
                    "mean_cells_a": _safe_mean(sub["cells_a"]),
                    "mean_cells_b": _safe_mean(sub["cells_b"]),
                }
            )
    return pd.DataFrame(rows)


def build_sensor_cell_days(h: pd.DataFrame) -> pd.DataFrame:
    """Unique vegetation-candidate (sensor, date, cell) rows for every sensor."""
    veg = h[h["is_vegetation_fire_candidate"]]
    out = veg.drop_duplicates(["sensor_key", "date", "grid_cell_id"])[
        ["sensor_key", "date", "grid_cell_id", "lat_idx", "lon_idx", "year"]
    ].copy()
    out["day_idx"] = (out["date"] - _EPOCH).dt.days.astype(np.int64)
    out["key"] = out["day_idx"].to_numpy() * _KEY_DAY + encode_cell_key(out["lat_idx"], out["lon_idx"])
    assert_unique_cell_days(out, keys=("sensor_key", "date", "grid_cell_id"), name="sensor cell-days")
    return out


def _tolerant_hits(a_keys: np.ndarray, b_keys: np.ndarray) -> np.ndarray:
    """True where a cell-day key has a cell-day in b within the 3x3 block, same day."""
    hit = np.zeros(len(a_keys), dtype=bool)
    for dl in (-1, 0, 1):
        for dn in (-1, 0, 1):
            hit |= np.isin(a_keys + dl * _KEY_LAT + dn, b_keys)
    return hit


def _agreement(a: pd.DataFrame, b: pd.DataFrame) -> dict:
    """Grid-cell co-occurrence between two sets of cell-days (exact and 3x3-tolerant)."""
    ak, bk = a["key"].to_numpy(), b["key"].to_numpy()
    both = int(np.isin(ak, bk).sum())
    union = len(ak) + len(bk) - both
    return {
        "measure": "grid_cell_co_occurrence_0.05deg",
        "n_cell_days_a": int(len(ak)),
        "n_cell_days_b": int(len(bk)),
        "n_cell_days_both": both,
        "jaccard": _safe_div(both, union),
        "share_a_also_in_b": _safe_div(both, len(ak)),
        "share_b_also_in_a": _safe_div(both, len(bk)),
        "share_a_with_b_in_3x3": float(_tolerant_hits(ak, bk).mean()) if len(ak) else np.nan,
        "share_b_with_a_in_3x3": float(_tolerant_hits(bk, ak).mean()) if len(bk) else np.nan,
    }


def build_pair_cell_day_agreement(sensor_cd: pd.DataFrame, sensor_day: pd.DataFrame, years=YEARS) -> pd.DataFrame:
    """Grid-cell co-occurrence of vegetation-candidate cell-days between two VIIRS sensors.

    Only days where both sensors were observed are used.
    """
    obs = _wide(sensor_day, "observed", False)
    rows = []
    for a, b in SENSOR_PAIRS:
        common_days = obs.index[obs[a] & obs[b]]
        ca = sensor_cd[(sensor_cd["sensor_key"] == a) & sensor_cd["date"].isin(common_days)]
        cb = sensor_cd[(sensor_cd["sensor_key"] == b) & sensor_cd["date"].isin(common_days)]
        for scope in ["all_years", *years]:
            sa = ca if scope == "all_years" else ca[ca["year"] == scope]
            sb = cb if scope == "all_years" else cb[cb["year"] == scope]
            n_days = len(common_days) if scope == "all_years" else int((common_days.year == scope).sum())
            rows.append({"sensor_a": a, "sensor_b": b, "scope": str(scope), "n_common_days": n_days, **_agreement(sa, sb)})
    return pd.DataFrame(rows)


def build_modis_vs_viirs(sensor_cd: pd.DataFrame, sensor_day: pd.DataFrame, daily: pd.DataFrame, years=YEARS) -> pd.DataFrame:
    """MODIS versus the VIIRS cell-day union: grid-cell co-occurrence on 0.05 degrees.

    What this measures: how often a 0.05 degree cell-day that one product flags
    is also flagged by the other. MODIS (~1 km pixels) and VIIRS (~375 m
    pixels) have different detection sensitivity, so VIIRS is expected to flag
    many cell-days MODIS does not. It does NOT show that two detections are the
    same physical fire.

    Two day bases are reported (``day_basis``):

    * ``modis_has_records``: days with a MODIS record and all three VIIRS
      sensors observed. Conditioning on MODIS having a record favours days with
      MODIS detections, so co-occurrence is biased upward.
    * ``all_viirs_full_days_modis_empty_assumed_zero``: every day with all
      three VIIRS sensors observed. MODIS empty days cannot be separated from
      missing MODIS data, so an empty day is assumed to have no MODIS cell-days.
      This is an assumption, not a measurement.
    """
    ok = daily.set_index("date")
    viirs_full = ok.index[ok["viirs_3sensor_full_coverage"]]
    bases = {
        "modis_has_records": ok.index[ok["observed_MODIS"] & ok["viirs_3sensor_full_coverage"]],
        "all_viirs_full_days_modis_empty_assumed_zero": viirs_full,
    }
    rows = []
    for basis, days in bases.items():
        modis = sensor_cd[(sensor_cd["sensor_key"] == "MODIS") & sensor_cd["date"].isin(days)]
        viirs = sensor_cd[sensor_cd["sensor_key"].isin(VIIRS_SENSORS) & sensor_cd["date"].isin(days)].drop_duplicates("key")
        daily_idx = ok.loc[days]
        for scope in ["all_years", *years]:
            sa = modis if scope == "all_years" else modis[modis["year"] == scope]
            sb = viirs if scope == "all_years" else viirs[viirs["year"] == scope]
            d = daily_idx if scope == "all_years" else daily_idx[daily_idx["year"] == scope]
            rows.append(
                {
                    "sensor_a": "MODIS",
                    "sensor_b": "VIIRS_3sensor_union",
                    "scope": str(scope),
                    "day_basis": basis,
                    "n_common_days": int(len(d)),
                    **_agreement(sa, sb),
                    "pearson_daily_cells": _safe_corr(d["veg_cells_MODIS"], d["viirs_veg_cells_union_3sensor"], "pearson"),
                    "spearman_daily_cells": _safe_corr(d["veg_cells_MODIS"], d["viirs_veg_cells_union_3sensor"], "spearman"),
                }
            )
    return pd.DataFrame(rows)


def build_sensor_comparison(pair_corr: pd.DataFrame, pair_agree: pd.DataFrame, modis_vs_viirs: pd.DataFrame) -> pd.DataFrame:
    """Single tidy table with one row per sensor pair, scope, and day basis."""
    keys = ["sensor_a", "sensor_b", "scope"]
    pairs = pair_corr.merge(pair_agree.drop(columns=["n_common_days"]), on=keys, how="outer")
    pairs.insert(0, "comparison_type", "viirs_pair")
    pairs.insert(4, "day_basis", "both_sensors_observed")
    mv = modis_vs_viirs.copy()
    mv.insert(0, "comparison_type", "modis_vs_viirs_union")
    return pd.concat([pairs, mv], ignore_index=True)


# --------------------------------------------------------------------------
# Coverage
# --------------------------------------------------------------------------
def build_coverage_analysis(coverage: pd.DataFrame) -> pd.DataFrame:
    cov = coverage.copy()
    cov["date"] = pd.to_datetime(cov["acquisition_date"])
    cov["year"] = cov["date"].dt.year
    cov["month"] = cov["date"].dt.month
    counts = cov.groupby(["sensor_key", "year", "month", "coverage_status"]).size().unstack(fill_value=0)
    counts = counts.reindex(columns=list(STATUSES), fill_value=0)
    counts.columns = [f"{c}_days" for c in counts.columns]
    out = counts.reset_index()
    out["calendar_days"] = out[[f"{s}_days" for s in STATUSES]].sum(axis=1)
    out["observed_share"] = out["observed_days"] / out["calendar_days"]
    records = cov.groupby(["sensor_key", "year", "month"])["n_records"].sum().rename("n_records").reset_index()
    return out.merge(records, on=["sensor_key", "year", "month"], how="left")


def build_coverage_gap_runs(coverage: pd.DataFrame) -> pd.DataFrame:
    """Consecutive runs of days that were not observed, per sensor and status."""
    cov = coverage.copy()
    cov["date"] = pd.to_datetime(cov["acquisition_date"])
    rows = []
    for sensor, g in cov[cov["coverage_status"] != "observed"].groupby("sensor_key"):
        g = g.sort_values("date")
        new_run = (g["date"].diff().dt.days != 1) | (g["coverage_status"] != g["coverage_status"].shift())
        run_id = new_run.cumsum()
        runs = g.groupby(run_id).agg(
            start_date=("date", "min"), end_date=("date", "max"), n_days=("date", "size"), coverage_status=("coverage_status", "first")
        )
        runs.insert(0, "sensor_key", sensor)
        rows.append(runs)
    if not rows:
        return pd.DataFrame(columns=["sensor_key", "start_date", "end_date", "n_days", "coverage_status"])
    return pd.concat(rows, ignore_index=True)


# --------------------------------------------------------------------------
# Numerical consistency checks
# --------------------------------------------------------------------------
def run_consistency_checks(h: pd.DataFrame, coverage: pd.DataFrame, tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Cross-table identities that must hold. Returns one row per check."""
    checks: list[dict] = []

    def check(name, ok, detail=""):
        checks.append({"check": name, "passed": bool(ok), "detail": str(detail)})

    cells, sd = tables["spatial_cells"], tables["sensor_day"]
    veg_v = _viirs_veg(h)
    veg_cd = build_cell_days(h, h["is_vegetation_fire_candidate"] & (h["sensor_family"] == "VIIRS"))
    check("VIIRS vegetation cell-days are unique per (date, cell)", not veg_cd.duplicated(["date", "grid_cell_id"]).any())
    check("spatial_cells total cell-days == unique VIIRS veg (date, cell) rows",
          int(cells["veg_cell_days_total"].sum()) == len(veg_cd), f"{int(cells['veg_cell_days_total'].sum())} vs {len(veg_cd)}")
    check("spatial_cells has one row per grid_cell_id", not cells["grid_cell_id"].duplicated().any())
    check("cell-days never exceed raw detections",
          len(veg_cd) <= len(veg_v), f"{len(veg_cd)} cell-days <= {len(veg_v)} detections")
    for s in ALL_SENSORS:
        raw = int(((h["sensor_key"] == s) & h["is_vegetation_fire_candidate"]).sum())
        tab = int(sd.loc[sd["sensor_key"] == s, "n_veg_detections"].sum())
        check(f"sensor_day veg detections == raw rows [{s}]", raw == tab, f"{raw} vs {tab}")
    profile = tables["sensor_profile"]
    check("sensor_profile n_rows sums to total harmonized rows", int(profile["n_rows"].sum()) == len(h), f"{int(profile['n_rows'].sum())} vs {len(h)}")
    types = profile[["n_type0_vegetation_candidates", "n_type2_static", "n_type3_water"]].sum().sum()
    n_other = int((~(h["is_vegetation_fire_candidate"] | h["is_static_source"] | h["is_water_detection"])).sum())
    check("type 0 + 2 + 3 + other == total rows", int(types) + n_other == len(h))
    cov = coverage[pd.to_datetime(coverage["acquisition_date"]).dt.year.isin(YEARS)]
    check("observed days in sensor_day == observed days in coverage calendar",
          int(sd["observed"].sum()) == int((cov["coverage_status"] == "observed").sum()))
    check("every sensor-day has exactly one coverage row", not sd.duplicated(["sensor_key", "date"]).any())
    daily = tables["daily_summary"]
    check("daily_summary has one row per date", not daily["date"].duplicated().any())
    v3 = daily["viirs_veg_cells_union_3sensor"]
    per_sensor_sum = sum(daily[f"veg_cells_{s}"] for s in VIIRS_SENSORS)
    per_sensor_max = pd.concat([daily[f"veg_cells_{s}"] for s in VIIRS_SENSORS], axis=1).max(axis=1)
    check("VIIRS union cells <= sum of sensor cells and >= max sensor cells",
          bool(((v3 <= per_sensor_sum) & (v3 >= per_sensor_max)).all()))
    check("union excl. static <= union (any-year and same-year)",
          bool(((daily["viirs_veg_cells_union_3sensor_excl_static_3x3"] <= v3)
                & (daily["viirs_veg_cells_union_3sensor_excl_static_3x3_same_year"] <= v3)).all()))
    blocks = tables["regional_blocks_1deg"]
    check("regional blocks total cell-days == spatial_cells total",
          int(blocks["veg_cell_days_total"].sum()) == int(cells["veg_cell_days_total"].sum()))
    check("block ids are strings", bool(blocks["block_id_1deg"].map(lambda v: isinstance(v, str)).all()) if len(blocks) else True)
    cl = tables["hotspot_clusters"]
    if len(cl):
        shares = cl.groupby("cluster_scope")["share_of_scope_cell_days"].sum()
        check("cluster shares per scope are <= 1", bool((shares <= 1 + 1e-9).all()))
    matched = tables["matched_day_yearly"]
    if len(matched):
        n_days = matched.groupby("series")["n_matched_days"].nunique()
        check("matched-day counts identical across years per series", bool((n_days == 1).all()))
    series = tables["series_daily"]
    check("series_daily has one row per (series, date)", not series.duplicated(["series", "date"]).any())
    check("no infinite values in any table", not any(
        int(np.isinf(f.select_dtypes(include=[float])).sum().sum()) for f in tables.values() if not f.empty))
    return pd.DataFrame(checks)


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------
def run_analysis(harmonized: pd.DataFrame, coverage: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Compute every Phase 4 table from the harmonized data and coverage calendar."""
    validate_inputs(harmonized, coverage)
    h = prepare_detections(harmonized)
    static_nbhd_keys = build_static_neighborhood_keys(h)
    static_by_year = {y: build_static_neighborhood_keys(h, y) for y in YEARS}

    sensor_day = build_sensor_day(h, coverage)
    daily = build_daily_summary(sensor_day, h, static_nbhd_keys, static_by_year)
    series_daily = build_series_daily(daily)

    matched, sensitivity = build_matched_day_tables(series_daily)
    monthly = build_monthly_summary(series_daily)

    veg_cd = build_cell_days(h, h["is_vegetation_fire_candidate"] & (h["sensor_family"] == "VIIRS"))
    static_cd = build_cell_days(h, h["is_static_source"] & (h["sensor_family"] == "VIIRS"))
    cells = build_spatial_cells(veg_cd, static_cd)
    clusters, thresholds, membership = build_hotspot_clusters(cells)
    cells["hotspot_cluster_id_all_years"] = cells["grid_cell_id"].map(membership).fillna("") if len(cells) else pd.Series(dtype=str)
    concentration = build_spatial_concentration(cells)
    persistent = build_persistent_activity(cells)
    static_cells = build_static_source_cells(h, cells)

    sensor_cd = build_sensor_cell_days(h)
    pair_corr = build_pair_daily_correlation(sensor_day)
    pair_agree = build_pair_cell_day_agreement(sensor_cd, sensor_day)
    modis_vs_viirs = build_modis_vs_viirs(sensor_cd, sensor_day, daily)

    tables = {
        "sensor_day": sensor_day,
        "daily_summary": daily,
        "series_daily": series_daily,
        "yearly_summary": build_yearly_summary(series_daily, sensor_day),
        "monthly_summary": monthly,
        "monthly_pooled": build_monthly_pooled(series_daily),
        "seasonal_summary": build_seasonal_summary(series_daily),
        "seasonal_pooled": build_seasonal_pooled(series_daily),
        "matched_day_yearly": matched,
        "sensitivity_matched_day_yearly": sensitivity,
        "hourly_profile": build_hourly_profile(h),
        "spatial_cells": cells,
        "spatial_concentration": concentration,
        "hotspot_clusters": clusters,
        "hotspot_thresholds": thresholds,
        "persistent_activity": persistent,
        "regional_blocks_1deg": build_regional_blocks(cells, static_cells),
        "static_source_cells": static_cells,
        "static_source_yearly": build_static_source_yearly(h),
        "static_cell_turnover": build_static_cell_turnover(h),
        "static_proximity_summary": build_static_proximity_summary(cells),
        "static_influence_metrics": build_static_influence_metrics(cells, concentration, persistent),
        "sensor_profile": build_sensor_profile(h, sensor_day),
        "sensor_pair_daily_correlation": pair_corr,
        "sensor_pair_cell_day_agreement": pair_agree,
        "modis_vs_viirs_agreement": modis_vs_viirs,
        "sensor_comparison": build_sensor_comparison(pair_corr, pair_agree, modis_vs_viirs),
        "coverage_analysis": build_coverage_analysis(coverage),
        "coverage_gap_runs": build_coverage_gap_runs(coverage),
    }
    tables["consistency_checks"] = run_consistency_checks(h, coverage, tables)
    return tables
