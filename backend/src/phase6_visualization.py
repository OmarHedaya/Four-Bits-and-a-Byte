"""Phase 6: visualization of the Phase 4 (analysis) and Phase 5 (index) outputs.

Reads only existing CSV/JSON outputs. Never writes outside ``data/visualizations``
and ``reports/phase6_visualization_report.md``. Never recomputes the index or baseline.

Scientific guard rails (see report):
* detections are vegetation-fire candidates (type 0), never confirmed fires
* FAI is an index relative to a frozen reference, not burned area / intensity / counts
* missing or unusable days are shown as gaps, never as zero
* 1-degree blocks are only shown against their own frozen baseline, never ranked
"""

from __future__ import annotations

import hashlib
import json
import textwrap
import traceback
from dataclasses import dataclass, field
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import LogNorm, TwoSlopeNorm
from matplotlib.patches import Patch, Rectangle

HEADLINE_ID = "headline_N20_SNPP_core_all"
YEARS = (2023, 2024, 2025)
SEASONS = ("DJF", "MAM", "JJA", "SON")

# --------------------------------------------------------------------------- sources
ANALYSIS_FILES = {
    "daily_summary": ["date"],
    "monthly_summary": ["series", "year", "month", "used_days", "cell_days_on_used_days", "low_coverage_flag"],
    "seasonal_summary": ["series", "season_year", "season"],
    "yearly_summary": ["series", "year"],
    "spatial_cells": ["grid_cell_id", "grid_cell_lat", "grid_cell_lon", "veg_cell_days_2023",
                      "veg_cell_days_2024", "veg_cell_days_2025", "veg_cell_days_total"],
    "regional_blocks_1deg": ["block_id_1deg", "block_lat_min", "block_lon_min", "block_lat_max", "block_lon_max"],
    "sensor_comparison": ["comparison_type", "sensor_a", "sensor_b", "scope", "day_basis", "jaccard",
                          "pearson_daily_cells", "share_a_also_in_b", "share_b_also_in_a"],
    "coverage_analysis": ["sensor_key", "year", "month", "observed_share", "observed_days", "calendar_days"],
    "coverage_gap_runs": ["sensor_key", "start_date", "end_date", "n_days", "coverage_status"],
    "static_influence_metrics": ["metric", "value"],
    "static_proximity_summary": ["proximity_band", "share_of_cells", "share_of_cell_days"],
    "static_source_cells": ["grid_cell_id", "grid_cell_lat", "grid_cell_lon"],
    "static_source_yearly": ["sensor_key", "year", "n_static_cells"],
    "hourly_profile": ["sensor_key", "hotspot_group", "utc_offset_hours", "local_hour_cairo", "n_detections"],
    "spatial_concentration": ["scope", "cell_filter", "gini"],
    "modis_vs_viirs_agreement": ["sensor_a", "sensor_b", "scope", "day_basis", "jaccard"],
    "sensor_profile": ["sensor_key"],
}
INDEX_FILES = {
    "series_catalog": ["series_id", "role"],
    "fai_daily": ["series_id", "date", "day_status", "FAI_daily"],
    "fai_monthly": ["series_id", "period", "year", "month", "usable_days", "calendar_days_in_window",
                    "FAI", "quality_label", "kappa"],
    "fai_seasonal": ["series_id", "period", "year", "season", "FAI", "quality_label", "na_reason"],
    "fai_yearly": ["series_id", "year", "FAI", "usable_days", "calendar_days_in_window", "quality_label", "kappa"],
    "block_fai": ["block_id", "block_lat_min", "block_lon_min", "period_type", "period", "year", "FAI_block",
                  "quality_label", "coverage_basis", "locally_coverage_normalized", "comparable_between_blocks"],
    "block_eligibility": ["block_id", "eligible"],
    "static_exposure": ["period_type", "period", "year", "FAI_core", "FAI_excl3x3", "sigma_P", "sigma_B", "R_P",
                        "quality_label"],
    "confidence_sensitivity": ["period_type", "period", "year", "FAI_all", "FAI_excl_low",
                               "FAI_difference_excl_low_minus_all", "low_confidence_only_cell_day_share",
                               "quality_label"],
    "inter_sensor_spread": ["period_type", "period", "year", "FAI_NOAA20", "FAI_NOAA21", "FAI_SNPP",
                            "n_sensors_in_spread", "inter_sensor_index_spread", "spread_note"],
    "cell_active_day_frequency": ["grid_cell_id", "grid_cell_lat", "grid_cell_lon", "active_day_frequency",
                                  "active_day_frequency_2023", "active_day_frequency_2024",
                                  "active_day_frequency_2025", "coverage_basis"],
    "low_confidence_share_by_sensor_year": ["sensor_key", "year", "low_confidence_share"],
    "daynight_diagnostic": ["year", "mean_cells_with_day_detection", "mean_cells_with_night_detection",
                            "mean_cell_days_union"],
}
PROTECTED_BASELINE = "data/index/baseline_v1.json"

DISCLAIMER = ("Satellite thermal detections (type 0) are vegetation-fire CANDIDATES, not confirmed fires. "
              "FAI is an index relative to a frozen 2023-2025 reference (v1; 100 = reference average); it is not "
              "burned area, fire intensity or a fire count. Gaps = unusable/missing days, never zero activity.")
BLOCK_NOTE = ("BLOCK COVERAGE LIMITATION: block indices use the NATIONAL usable-day calendar "
              "(coverage_basis = national_calendar_proxy; not locally coverage-normalised). Each block is shown only "
              "relative to its OWN frozen baseline; levels must not be ranked or compared between blocks.")

C = {
    "headline": "#b2182b", "NOAA20": "#1b9e77", "NOAA21": "#7570b3", "SNPP": "#d9a400", "MODIS": "#555555",
    "V3": "#8c564b", 2023: "#4c78a8", 2024: "#f58518", 2025: "#54a24b", "ref": "#444444",
    "core": "#b2182b", "excl": "#2166ac", "all": "#b2182b", "low": "#2166ac",
    "usable": "#4daf4a", "unusable_not_zero": "#e41a1c", "not_expected": "#bdbdbd",
    "reliable": "#2b8cbe", "partial_coverage": "#fdae61", "insufficient_coverage": "#d9d9d9",
    "not_expected_q": "#bdbdbd",
}
SENSOR_ORDER = ("NOAA20", "NOAA21", "SNPP")

# Coarse, schematic outline of Egypt (lon, lat) for map context only. NOT survey-grade; carries no data.
EGYPT_OUTLINE = [
    (25.15, 31.57), (27.2, 31.35), (29.0, 30.95), (29.9, 31.2), (31.0, 31.55), (32.2, 31.3), (32.3, 31.25),
    (34.2, 31.3), (34.25, 31.2), (34.4, 30.5), (34.8, 29.9), (34.9, 29.5), (34.7, 28.5), (34.4, 28.0),
    (34.25, 27.73), (33.95, 28.2), (33.55, 28.9), (32.9, 29.6), (32.55, 29.95), (32.65, 29.7), (32.95, 29.0),
    (33.3, 28.2), (33.6, 27.5), (33.85, 27.2), (33.95, 26.75), (34.9, 25.05), (35.5, 23.9), (36.65, 22.2),
    (36.9, 22.0), (25.0, 22.0), (25.0, 31.4),
]


# --------------------------------------------------------------------------- loading
def check_sources(root: Path) -> dict:
    """Return {relative_path: {'exists': bool, 'missing_columns': [...]}} for every required source."""
    report = {}
    for folder, spec in (("data/analysis", ANALYSIS_FILES), ("data/index", INDEX_FILES)):
        for name, cols in spec.items():
            path = Path(root) / folder / f"{name}.csv"
            entry = {"exists": path.exists(), "missing_columns": []}
            if path.exists():
                header = pd.read_csv(path, nrows=0).columns
                entry["missing_columns"] = [c for c in cols if c not in header]
            report[f"{folder}/{name}.csv"] = entry
    entry = {"exists": (Path(root) / PROTECTED_BASELINE).exists(), "missing_columns": []}
    report[PROTECTED_BASELINE] = entry
    return report


def load_sources(root: Path) -> dict[str, pd.DataFrame]:
    status = check_sources(root)
    problems = [f"{k}: missing file" if not v["exists"] else f"{k}: missing columns {v['missing_columns']}"
                for k, v in status.items() if not v["exists"] or v["missing_columns"]]
    if problems:
        raise FileNotFoundError("Phase 6 source check failed:\n  " + "\n  ".join(problems))
    data = {}
    for folder, spec in (("data/analysis", ANALYSIS_FILES), ("data/index", INDEX_FILES)):
        for name in spec:
            data[name] = pd.read_csv(Path(root) / folder / f"{name}.csv")
    data["fai_daily"]["date"] = pd.to_datetime(data["fai_daily"]["date"])
    data["coverage_gap_runs"]["start_date"] = pd.to_datetime(data["coverage_gap_runs"]["start_date"])
    data["coverage_gap_runs"]["end_date"] = pd.to_datetime(data["coverage_gap_runs"]["end_date"])
    return data


def headline_id(data) -> str:
    cat = data["series_catalog"]
    hl = cat.loc[cat["role"] == "headline", "series_id"]
    return hl.iloc[0] if len(hl) else HEADLINE_ID


def series(df: pd.DataFrame, sid: str) -> pd.DataFrame:
    return df[df["series_id"] == sid].copy()


def month_ts(period: pd.Series) -> pd.Series:
    return pd.to_datetime(period.astype(str) + "-01")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def protected_hashes(root: Path) -> dict[str, str]:
    """SHA-256 of every Phase 4/5 output (analysis + index folders), used to prove they are untouched."""
    out = {}
    for folder in ("data/analysis", "data/index"):
        for p in sorted((Path(root) / folder).glob("*")):
            if p.is_file():
                out[str(p.relative_to(root))] = sha256_file(p)
    return out


# --------------------------------------------------------------------------- figure plumbing
@dataclass
class Registry:
    out_dir: Path
    items: list = field(default_factory=list)
    failures: list = field(default_factory=list)

    def add(self, **kw):
        self.items.append(kw)


def apply_style():
    plt.rcParams.update({
        "figure.dpi": 100, "savefig.dpi": 160, "font.size": 12, "axes.titlesize": 14, "axes.labelsize": 12,
        "axes.grid": True, "grid.alpha": 0.25, "axes.spines.top": False, "axes.spines.right": False,
        "legend.frameon": False, "legend.fontsize": 11, "axes.titleweight": "bold",
    })


def finish(fig, reg: Registry, fig_id: str, subdir: str, title: str, sources: list[str], communicates: str,
           limitations: str, note: str = "", block: bool = False, notes_lines: int = 0):
    """Add title + footer notes, save PNG, register for the report."""
    foot = [DISCLAIMER, "Note: " + limitations]
    if block:
        foot.append(BLOCK_NOTE)
    if note:
        foot.append(note)
    wrapped = "\n".join(textwrap.fill(t, 190) for t in foot)
    n_lines = wrapped.count("\n") + 1
    bottom = min(0.32, 0.03 + 0.03 * n_lines)
    fig.suptitle(title, fontsize=17, fontweight="bold", x=0.01, ha="left", y=0.985)
    fig.text(0.01, 0.01, wrapped, fontsize=9.5, va="bottom", ha="left", color="#333333")
    fig.tight_layout(rect=[0, bottom, 1, 0.955])
    path = Path(reg.out_dir) / subdir / f"{fig_id}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=160)
    plt.close(fig)
    reg.add(id=fig_id, kind="png", file=str(path.relative_to(reg.out_dir.parent.parent)) if
            reg.out_dir.parent.parent in path.parents else str(path), title=title, sources=sources,
            communicates=communicates, limitations=limitations)
    return path


def safe(reg: Registry, name: str):
    """Decorator-like runner: a failing figure is recorded, not fatal."""
    def deco(fn):
        def wrapper(*a, **k):
            try:
                return fn(*a, **k)
            except Exception as exc:  # noqa: BLE001
                plt.close("all")
                reg.failures.append({"id": name, "error": f"{type(exc).__name__}: {exc}",
                                     "trace": traceback.format_exc(limit=3)})
        return wrapper
    return deco


def ref_line(ax, y=100.0, label="Frozen reference = 100"):
    ax.axhline(y, color=C["ref"], ls="--", lw=1.2, label=label)


def maps_with_colorbar(n, figsize):
    """n map axes plus a dedicated narrow colourbar axis (keeps tight_layout valid)."""
    fig = plt.figure(figsize=figsize)
    gs = fig.add_gridspec(1, n + 1, width_ratios=[1] * n + [0.04])
    axes = [fig.add_subplot(gs[0, i]) for i in range(n)]
    return fig, axes, fig.add_subplot(gs[0, n])


def egypt_outline(ax, lw=1.0):
    xs, ys = zip(*(EGYPT_OUTLINE + [EGYPT_OUTLINE[0]]))
    ax.plot(xs, ys, color="#222222", lw=lw, alpha=0.8, zorder=5)


def style_map_axes(ax, extent=(24.8, 37.2, 21.8, 31.9)):
    ax.set_xlim(extent[0], extent[1])
    ax.set_ylim(extent[2], extent[3])
    ax.set_aspect(1.0 / np.cos(np.deg2rad(27)))
    ax.set_xlabel("Longitude (°E)")
    ax.set_ylabel("Latitude (°N)")
    ax.grid(alpha=0.2)
    egypt_outline(ax)


def shade_runs(ax, dates: pd.Series, color, alpha=0.35, label=None, hatch=None):
    """Shade consecutive-day runs given a sorted Series of dates."""
    dates = pd.Series(pd.to_datetime(dates)).sort_values().reset_index(drop=True)
    if dates.empty:
        return
    start = prev = dates.iloc[0]
    first = True
    for d in list(dates.iloc[1:]) + [None]:
        if d is None or (d - prev).days > 1:
            ax.axvspan(start - pd.Timedelta(hours=12), prev + pd.Timedelta(hours=12), color=color, alpha=alpha,
                       lw=0, hatch=hatch, label=label if first else None)
            first = False
            if d is not None:
                start = d
        prev = d if d is not None else prev


def grid_array(df: pd.DataFrame, lat_col: str, lon_col: str, val_col: str, step=0.05):
    """Place cell-centre values on the existing 0.05-degree grid. Absent cells stay NaN."""
    lat0, lon0 = df[lat_col].min(), df[lon_col].min()
    i = np.round((df[lat_col] - lat0) / step).astype(int)
    j = np.round((df[lon_col] - lon0) / step).astype(int)
    arr = np.full((i.max() + 1, j.max() + 1), np.nan)
    arr[i.values, j.values] = df[val_col].values
    lat_edges = lat0 - step / 2 + step * np.arange(arr.shape[0] + 1)
    lon_edges = lon0 - step / 2 + step * np.arange(arr.shape[1] + 1)
    return arr, lon_edges, lat_edges


# --------------------------------------------------------------------------- A. national
def fig_national_annual(d, reg):
    y = series(d["fai_yearly"], headline_id(d))
    y3 = series(d["fai_yearly"], "V3_core_all")
    fig, ax = plt.subplots(figsize=(11, 7))
    cols = [C[int(v)] if int(v) in C else "#888" for v in y["year"]]
    bars = ax.bar(y["year"].astype(str), y["FAI"], color=cols, width=0.55, label="Headline FAI (NOAA-20 + SNPP)")
    if len(y3):
        ax.scatter(y3["year"].astype(str), y3["FAI"], marker="D", color="black", zorder=5, s=50,
                   label="Robustness: 3-sensor VIIRS (own baseline)")
    for b, (_, r) in zip(bars, y.iterrows()):
        ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 2, f"{r.FAI:.1f}\n{int(r.usable_days)}/"
                f"{int(r.calendar_days_in_window)} usable days", ha="center", va="bottom", fontsize=11)
    ref_line(ax)
    ax.set_ylim(0, y["FAI"].max() * 1.25)
    ax.set_ylabel("Fire Activity Index (reference = 100)")
    ax.set_xlabel("Year")
    ax.set_title("Annual FAI, 2023-2025")
    ax.legend(loc="upper right")
    finish(fig, reg, "national_annual_fai", "national", "National activity: annual FAI 2023, 2024, 2025",
           ["data/index/fai_yearly.csv"],
           "Annual detected-candidate activity index per usable day relative to the frozen 2023-2025 reference.",
           "The annual mean over the matched baseline dates is 100 by construction, so 'above/below 100' is relative "
           "to a 3-year reference, not to a normal level. Differences may reflect detection, processing, cloud and "
           "static-source effects as well as real activity; no cause is implied.")


def fig_national_monthly(d, reg):
    m = series(d["fai_monthly"], headline_id(d))
    m["ts"] = month_ts(m["period"])
    fig, (ax, ax2) = plt.subplots(2, 1, figsize=(15, 9), sharex=True, gridspec_kw={"height_ratios": [3, 1]})
    ax.plot(m["ts"], m["FAI"], color=C["headline"], lw=1.8, zorder=3)
    for q, g in m.groupby("quality_label"):
        if g["FAI"].notna().any():
            fc = C.get(q, "#888") if q == "reliable" else "white"
            ax.scatter(g["ts"], g["FAI"], s=60, facecolor=fc, edgecolor=C.get(q, "#888") if q != "reliable" else
                       C["headline"], lw=2, zorder=4, label=f"quality: {q}")
    for ts in m.loc[m["FAI"].isna(), "ts"]:
        ax.axvspan(ts, ts + pd.offsets.MonthEnd(1), color="#d9d9d9", alpha=0.6, lw=0)
    ref_line(ax)
    ax.set_ylabel("FAI (reference = 100)")
    ax.set_title("Monthly headline FAI (NOAA-20 + SNPP, core mask, all confidence)")
    ax.legend(loc="upper left", ncol=3)
    cov = m["usable_days"] / m["calendar_days_in_window"]
    ax2.bar(m["ts"] + pd.Timedelta(days=14), cov, width=26, color=[C["reliable"] if q == "reliable" else
                                                                   C["partial_coverage"] for q in m["quality_label"]])
    ax2.set_ylim(0, 1.05)
    ax2.set_ylabel("Usable-day share")
    ax2.xaxis.set_major_locator(mdates.MonthLocator(bymonth=(1, 4, 7, 10)))
    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%b\n%Y"))
    ax2.set_xlabel("Month (UTC dates)")
    finish(fig, reg, "national_monthly_fai", "national", "National activity: monthly FAI time series",
           ["data/index/fai_monthly.csv"],
           "Month-to-month variation of the headline index, with the share of usable days beneath each month.",
           "Hollow markers = partial coverage; grey shading = no published value. Months with fewer usable days are "
           "less reliable. The strong seasonal pattern should not be read as causal.")


def fig_national_daily(d, reg):
    f = series(d["fai_daily"], headline_id(d)).sort_values("date")
    fig, ax = plt.subplots(figsize=(16, 7.5))
    ax.plot(f["date"], f["FAI_daily"], color=C["headline"], lw=0.8, alpha=0.9, marker="o", ms=2.5,
            label="Daily FAI (usable days only)")
    unusable = f.loc[f["day_status"] == "unusable_not_zero", "date"]
    shade_runs(ax, unusable, C["unusable_not_zero"], 0.30, "Unusable day (data missing - NOT zero)")
    ne = f.loc[f["day_status"] == "not_expected", "date"]
    shade_runs(ax, ne, C["not_expected"], 0.5, "Sensor not expected (before science start)")
    ref_line(ax)
    ax.set_yscale("symlog", linthresh=100, linscale=1.5)
    ax.set_ylim(0, f["FAI_daily"].max() * 1.2)
    ax.set_yticks([0, 25, 50, 100, 200, 400])
    ax.get_yaxis().set_major_formatter(plt.ScalarFormatter())
    ax.set_ylabel("Daily FAI (symlog axis, reference = 100)")
    ax.set_xlabel("Date (UTC)")
    ax.set_title("Daily headline FAI with unusable days highlighted")
    ax.legend(loc="upper right", ncol=2)
    ax.xaxis.set_major_locator(mdates.MonthLocator(bymonth=(1, 4, 7, 10)))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    finish(fig, reg, "national_daily_fai", "national", "National activity: daily FAI time series",
           ["data/index/fai_daily.csv"],
           "Day-level variability of detected candidate activity and where daily values are not available.",
           "Daily values are noisy (small cell-day counts, overpass timing, cloud). Unusable days are drawn as gaps "
           "with red shading and are not interpolated or treated as zero. Axis is symmetric-log above 100.")


def fig_national_seasonal(d, reg):
    s = series(d["fai_seasonal"], headline_id(d))
    s = s[s["year"].isin(YEARS)]
    fig, ax = plt.subplots(figsize=(12, 7))
    w = 0.26
    for k, yr in enumerate(YEARS):
        vals, lbl = [], []
        for ss in SEASONS:
            r = s[(s["year"] == yr) & (s["season"] == ss)]
            vals.append(float(r["FAI"].iloc[0]) if len(r) else np.nan)
        x = np.arange(len(SEASONS)) + (k - 1) * w
        ax.bar(x, np.nan_to_num(vals), width=w, color=C[yr], label=str(yr))
        for xi, v, ss in zip(x, vals, SEASONS):
            if np.isnan(v):
                ax.text(xi, 4, "n/a\nincomplete", ha="center", va="bottom", fontsize=8.5, rotation=90, color="#a00")
            else:
                ax.text(xi, v + 2, f"{v:.0f}", ha="center", fontsize=9.5)
    ref_line(ax)
    ax.set_xticks(np.arange(len(SEASONS)))
    ax.set_xticklabels(["DJF\n(Dec-Feb)", "MAM\n(Mar-May)", "JJA\n(Jun-Aug)", "SON\n(Sep-Nov)"])
    ax.set_ylabel("Seasonal FAI (reference = 100)")
    ax.set_title("Seasonal FAI by year")
    ax.legend(title="Year", loc="upper left")
    finish(fig, reg, "national_seasonal_fai", "national", "National activity: seasonal comparison",
           ["data/index/fai_seasonal.csv"],
           "How each meteorological season compares between years in the headline series.",
           "DJF 2023 is not published because its window is incomplete (Dec 2022 is outside the dataset); marked "
           "n/a, not zero. Seasons use three years only; 'seasonal' differences are descriptive.")


# --------------------------------------------------------------------------- B. spatial
def _cell_map(ax, arr, xe, ye, norm, cmap, title):
    m = ax.pcolormesh(xe, ye, np.ma.masked_invalid(arr), norm=norm, cmap=cmap, shading="flat", rasterized=True)
    style_map_axes(ax)
    ax.set_facecolor("#f4f4f4")
    ax.set_title(title)
    return m


def fig_spatial_total(d, reg):
    sc = d["spatial_cells"]
    arr, xe, ye = grid_array(sc, "grid_cell_lat", "grid_cell_lon", "veg_cell_days_total")
    fig, ax = plt.subplots(figsize=(11, 9))
    mm = _cell_map(ax, arr, xe, ye, LogNorm(vmin=1, vmax=np.nanmax(arr)), "YlOrRd",
                   "VIIRS vegetation-fire-candidate cell-days, 2023-2025 (0.05° grid)")
    cb = fig.colorbar(mm, ax=ax, shrink=0.8)
    cb.set_label("Candidate cell-days (log scale)")
    finish(fig, reg, "spatial_total_heatmap", "spatial", "Geographic distribution: Egypt candidate-activity heatmap",
           ["data/analysis/spatial_cells.csv"],
           "Where VIIRS vegetation-fire candidates were detected most often, on the existing 0.05° grid.",
           "Blank cells = no candidate detected in this product, not 'verified no fire'. Counts are raw cell-days on "
           "observed days (not coverage-normalised); many top cells lie near static thermal sources (see static "
           "overlay figure). Outline is schematic, not survey-grade.")


def fig_spatial_annual(d, reg):
    sc = d["spatial_cells"]
    vmax = max(np.nanmax(sc[f"veg_cell_days_{y}"]) for y in YEARS)
    fig, axes, cax = maps_with_colorbar(3, (21, 7.5))
    mm = None
    for ax, yr in zip(axes, YEARS):
        sub = sc[sc[f"veg_cell_days_{yr}"] > 0]
        arr, xe, ye = grid_array(sc.assign(_v=np.where(sc[f"veg_cell_days_{yr}"] > 0, sc[f"veg_cell_days_{yr}"],
                                                       np.nan)),
                                 "grid_cell_lat", "grid_cell_lon", "_v")
        mm = _cell_map(ax, arr, xe, ye, LogNorm(vmin=1, vmax=vmax), "YlOrRd", f"{yr}  ({len(sub):,} active cells)")
    fig.colorbar(mm, cax=cax).set_label("Candidate cell-days (log scale, shared)")
    finish(fig, reg, "spatial_annual_comparison", "spatial", "Geographic distribution: annual comparison 2023 / 2024 / 2025",
           ["data/analysis/spatial_cells.csv"],
           "Whether the spatial pattern of candidate detections persisted across years, on one shared colour scale.",
           "Raw cell-days; years have different numbers of usable days and NOAA-21 only starts in March 2023, so "
           "year-to-year differences are not purely activity changes. See national figures for index-normalised values.",
           note="Layout uses a shared log colour scale; blank = no detection recorded for that year.")


def fig_spatial_frequency(d, reg):
    cf = d["cell_active_day_frequency"]
    fig, ax = plt.subplots(figsize=(11, 9))
    arr, xe, ye = grid_array(cf, "grid_cell_lat", "grid_cell_lon", "active_day_frequency")
    mm = _cell_map(ax, arr, xe, ye, LogNorm(vmin=max(np.nanmin(arr), 1e-3), vmax=np.nanmax(arr)), "viridis",
                   "Share of national usable days with a candidate detection (2023-2025)")
    fig.colorbar(mm, ax=ax, shrink=0.8).set_label("Active-day frequency (log scale)")
    finish(fig, reg, "spatial_active_cell_frequency", "spatial", "Geographic distribution: active-cell frequency",
           ["data/index/cell_active_day_frequency.csv"],
           "How often each cell had a candidate detection, as a share of national usable days.",
           "Denominator = national usable days (coverage_basis = record_presence_proxy), not cell-specific "
           "observations; high values near static thermal sources may reflect persistent non-vegetation heat.")


def fig_spatial_frequency_annual(d, reg):
    cf = d["cell_active_day_frequency"]
    cols = [f"active_day_frequency_{y}" for y in YEARS]
    vmax = np.nanmax(cf[cols].values)
    fig, axes, cax = maps_with_colorbar(3, (21, 7.5))
    mm = None
    for ax, yr, col in zip(axes, YEARS, cols):
        tmp = cf.assign(_v=cf[col].where(cf[col] > 0))
        arr, xe, ye = grid_array(tmp, "grid_cell_lat", "grid_cell_lon", "_v")
        mm = _cell_map(ax, arr, xe, ye, LogNorm(vmin=1e-3, vmax=vmax), "viridis", str(yr))
    fig.colorbar(mm, cax=cax).set_label("Active-day frequency (log, shared)")
    finish(fig, reg, "spatial_active_cell_frequency_annual", "spatial",
           "Geographic distribution: annual active-cell frequency",
           ["data/index/cell_active_day_frequency.csv"],
           "Annual maps of the share of usable days with a candidate detection per cell.",
           "Same limitations as the all-years frequency map; zero-frequency cells are left blank.")


def fig_spatial_static_overlay(d, reg):
    sc, st = d["spatial_cells"], d["static_source_cells"]
    arr, xe, ye = grid_array(sc, "grid_cell_lat", "grid_cell_lon", "veg_cell_days_total")
    fig, ax = plt.subplots(figsize=(11, 9))
    mm = _cell_map(ax, arr, xe, ye, LogNorm(vmin=1, vmax=np.nanmax(arr)), "YlOrRd", "Candidate cell-days with static thermal-source cells")
    ax.scatter(st["grid_cell_lon"], st["grid_cell_lat"], s=14, facecolor="none", edgecolor="#08306b", lw=0.8,
               zorder=6, label=f"Static thermal-source cell (type 2; n={len(st)})")
    ax.legend(loc="lower left")
    fig.colorbar(mm, ax=ax, shrink=0.8).set_label("Candidate cell-days (log scale)")
    finish(fig, reg, "spatial_static_overlay", "spatial", "Geographic distribution: candidate activity vs static thermal sources",
           ["data/analysis/spatial_cells.csv", "data/analysis/static_source_cells.csv"],
           "Spatial coincidence between high candidate counts and persistent static thermal sources.",
           "Spatial coincidence is descriptive only and does not establish that candidates are caused by, or are "
           "false alarms of, static sources.")


def _block_geometry(d):
    return d["regional_blocks_1deg"][["block_id_1deg", "block_lat_min", "block_lon_min"]].rename(
        columns={"block_id_1deg": "block_id"})


def fig_blocks_map(d, reg):
    geo = _block_geometry(d)
    elig = d["block_eligibility"][["block_id", "eligible"]]
    geo = geo.merge(elig, on="block_id", how="left")
    geo["eligible"] = geo["eligible"].fillna(False).astype(bool)
    by = d["block_fai"][d["block_fai"]["period_type"] == "year"]
    fig, axes, cax = maps_with_colorbar(3, (21, 8))
    norm = TwoSlopeNorm(vmin=0, vcenter=100, vmax=max(200.0, by["FAI_block"].max()))
    cmap = plt.get_cmap("RdBu_r")
    mm = None
    for ax, yr in zip(axes, YEARS):
        sub = by[by["year"] == yr].set_index("block_id")
        for _, g in geo.iterrows():
            rect_kw = dict(lw=0.6, edgecolor="#555555")
            if g["block_id"] in sub.index and not pd.isna(sub.loc[g["block_id"], "FAI_block"]):
                v = sub.loc[g["block_id"], "FAI_block"]
                ax.add_patch(Rectangle((g.block_lon_min, g.block_lat_min), 1, 1, facecolor=cmap(norm(v)), **rect_kw))
                ax.text(g.block_lon_min + 0.5, g.block_lat_min + 0.5, f"{v:.0f}", ha="center", va="center", fontsize=8)
            else:
                ax.add_patch(Rectangle((g.block_lon_min, g.block_lat_min), 1, 1, facecolor="#eeeeee", hatch="////",
                                       **rect_kw))
        style_map_axes(ax)
        ax.set_title(f"{yr}")
        mm = plt.cm.ScalarMappable(norm=norm, cmap=cmap)
    fig.colorbar(mm, cax=cax).set_label("Block FAI vs the block's OWN frozen baseline (100)")
    axes[0].legend(handles=[Patch(facecolor="#eeeeee", hatch="////", edgecolor="#555", label="Block not eligible "
                                  "(baseline < 100 cell-days) / no value")], loc="lower left", fontsize=9)
    finish(fig, reg, "blocks_map_annual", "spatial", "1° blocks: annual FAI relative to each block's own baseline",
           ["data/index/block_fai.csv", "data/index/block_eligibility.csv", "data/analysis/regional_blocks_1deg.csv"],
           "For each eligible block, whether a year was above or below that block's own 2023-2025 reference (100).",
           "Colours show deviation from each block's own baseline, not activity level; blocks are neither ranked nor "
           "comparable in level. Ineligible blocks are hatched, not shown as zero.", block=True)


def fig_blocks_small_multiples(d, reg):
    b = d["block_fai"]
    by = b[b["period_type"] == "year"]
    blocks = by[["block_id", "block_lat_min", "block_lon_min"]].drop_duplicates()
    # geographic order (north to south, west to east) - deliberately NOT by FAI value
    blocks = blocks.sort_values(["block_lat_min", "block_lon_min"], ascending=[False, True])
    n = len(blocks)
    ncol = 7
    nrow = int(np.ceil(n / ncol))
    fig, axes = plt.subplots(nrow, ncol, figsize=(20, 2.5 * nrow + 1), sharey=True)
    axes = np.atleast_2d(axes)
    ymax = by["FAI_block"].max() * 1.1
    for ax in axes.ravel():
        ax.set_visible(False)
    for ax, (_, g) in zip(axes.ravel(), blocks.iterrows()):
        ax.set_visible(True)
        sub = by[by["block_id"] == g.block_id].set_index("year")
        vals = [sub["FAI_block"].get(y, np.nan) for y in YEARS]
        ax.bar([str(y) for y in YEARS], np.nan_to_num(vals), color=[C[y] for y in YEARS], width=0.7)
        ax.axhline(100, color=C["ref"], ls="--", lw=1)
        ax.set_title(g.block_id, fontsize=10)
        ax.set_ylim(0, ymax)
        ax.tick_params(labelsize=8)
        ax.grid(False)
    for ax in axes[:, 0]:
        ax.set_ylabel("Block FAI\n(own baseline = 100)", fontsize=9)
    finish(fig, reg, "blocks_small_multiples", "spatial", "1° blocks: each block against its own baseline (geographic order)",
           ["data/index/block_fai.csv"],
           "Per-block yearly change relative to that block's own frozen reference; panels are in north-to-south, "
           "west-to-east order, never sorted by value.",
           "Only eligible blocks are drawn. Dashed line = the block's own baseline (100). Bars of different blocks "
           "must not be compared as activity levels.", block=True)


# --------------------------------------------------------------------------- C. sensors
def fig_sensor_monthly(d, reg):
    m = d["fai_monthly"]
    fig, ax = plt.subplots(figsize=(15, 7.5))
    ids = [("NOAA20_core_all", "NOAA20", "NOAA-20"), ("NOAA21_core_all", "NOAA21", "NOAA-21"),
           ("SNPP_core_all", "SNPP", "Suomi NPP")]
    for sid, key, lab in ids:
        s = series(m, sid)
        ax.plot(month_ts(s["period"]), s["FAI"], color=C[key], lw=1.6, marker="o", ms=4, label=f"{lab} (own baseline)")
    hl = series(m, headline_id(d))
    ax.plot(month_ts(hl["period"]), hl["FAI"], color="black", lw=2.2, ls="--", label="Headline (NOAA-20 + SNPP)")
    ref_line(ax)
    ax.set_ylabel("Monthly FAI per sensor (reference = 100)")
    ax.set_xlabel("Month (UTC)")
    ax.set_title("Single-sensor VIIRS indices")
    ax.legend(ncol=3, loc="upper left")
    finish(fig, reg, "sensors_monthly_indices", "sensors", "Sensor analysis: individual VIIRS sensor indices",
           ["data/index/fai_monthly.csv"],
           "Each sensor is indexed on its own usable days and own baseline; close tracking indicates robustness.",
           "NOAA-21 science starts 2023-03-01 (no value Jan-Feb 2023, a gap not zero). VIIRS sensors observe the same "
           "fires; counts from different sensors are never summed as independent events. MODIS has no FAI.")


def fig_sensor_yearly(d, reg):
    y = d["fai_yearly"]
    fig, ax = plt.subplots(figsize=(11, 7))
    keys = [("NOAA20_core_all", "NOAA20"), ("NOAA21_core_all", "NOAA21"), ("SNPP_core_all", "SNPP")]
    w = 0.25
    for k, (sid, key) in enumerate(keys):
        s = series(y, sid).set_index("year")
        vals = [s["FAI"].get(yr, np.nan) for yr in YEARS]
        xs = np.arange(len(YEARS)) + (k - 1) * w
        ax.bar(xs, vals, width=w, color=C[key], label=key)
        for x, v in zip(xs, vals):
            if pd.notna(v):
                ax.text(x, v + 1.5, f"{v:.0f}", ha="center", fontsize=9.5)
    ref_line(ax)
    ax.set_xticks(np.arange(len(YEARS)))
    ax.set_xticklabels([str(v) for v in YEARS])
    ax.set_ylabel("Annual FAI (own baseline = 100)")
    ax.set_title("Annual index by VIIRS sensor")
    ax.legend()
    finish(fig, reg, "sensors_yearly_indices", "sensors", "Sensor analysis: annual single-sensor indices",
           ["data/index/fai_yearly.csv"],
           "Whether the 2023 > 2024 > 2025 pattern is consistent across sensors.",
           "Each sensor uses its own usable days and baseline; differences mix sensor characteristics and day sets.")


def fig_sensor_spread(d, reg):
    sp = d["inter_sensor_spread"]
    mo = sp[sp["period_type"] == "month"].copy()
    mo["ts"] = month_ts(mo["period"])
    mo = mo.sort_values("ts")
    fig, (ax, ax2) = plt.subplots(2, 1, figsize=(15, 9), sharex=True, gridspec_kw={"height_ratios": [2, 1.3]})
    for key in SENSOR_ORDER:
        ax.plot(mo["ts"], mo[f"FAI_{key}"], color=C[key], lw=1.1, alpha=0.9, label=key)
    lo = mo[[f"FAI_{k}" for k in SENSOR_ORDER]].min(axis=1)
    hi = mo[[f"FAI_{k}" for k in SENSOR_ORDER]].max(axis=1)
    ax.fill_between(mo["ts"], lo, hi, color="#999999", alpha=0.3, label="Min-max range of single-sensor indices")
    ax.set_ylabel("Single-sensor FAI")
    ax.legend(ncol=4, loc="upper left")
    ax.set_title("Single-sensor indices and their range")
    ax2.bar(mo["ts"] + pd.Timedelta(days=14), mo["inter_sensor_index_spread"], width=26,
            color=["#7a7a7a" if n >= 3 else "#bdbdbd" for n in mo["n_sensors_in_spread"]])
    ax2.set_ylabel("Inter-sensor index spread\n(FAI points, max - min)")
    ax2.set_title("Inter-sensor index spread (light bars: only 2 sensors available)")
    ax2.xaxis.set_major_locator(mdates.MonthLocator(bymonth=(1, 4, 7, 10)))
    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%b\n%Y"))
    ax2.set_xlabel("Month (UTC)")
    ax2.text(0.99, 0.93, "NOT a confidence interval", transform=ax2.transAxes, ha="right", va="top", fontsize=13,
             color="#a00", fontweight="bold")
    finish(fig, reg, "sensors_inter_sensor_spread", "sensors", "Sensor analysis: inter-sensor index spread",
           ["data/index/inter_sensor_spread.csv"],
           "How much the index changes depending on which VIIRS sensor is used.",
           "The spread is the range (max - min) of single-sensor indices computed on their own usable days and "
           "baselines. It is a descriptive sensitivity to sensor choice, NOT a confidence interval, standard error "
           "or uncertainty estimate.",
           note=str(sp["spread_note"].iloc[0]))


def fig_sensor_agreement(d, reg):
    sc = d["sensor_comparison"]
    vv = sc[sc["comparison_type"] == "viirs_pair"].copy()
    vv["pair"] = vv["sensor_a"] + " vs " + vv["sensor_b"]
    mv = sc[(sc["comparison_type"] == "modis_vs_viirs_union") & (sc["day_basis"] == "modis_has_records")].copy()
    mv["pair"] = "MODIS vs VIIRS union"
    allp = pd.concat([vv, mv])
    allp = allp[allp["scope"].astype(str).isin([str(y) for y in YEARS])]
    pairs = list(dict.fromkeys(allp["pair"]))
    fig, axes = plt.subplots(1, 2, figsize=(16, 7))
    w = 0.26
    for ax, col, ttl in ((axes[0], "jaccard", "Cell-day overlap (Jaccard index)"),
                         (axes[1], "pearson_daily_cells", "Daily correlation of active cells (Pearson r)")):
        for k, yr in enumerate(YEARS):
            vals = []
            for p in pairs:
                r = allp[(allp["pair"] == p) & (allp["scope"].astype(str) == str(yr))]
                vals.append(float(r[col].iloc[0]) if len(r) and col in r and pd.notna(r[col].iloc[0]) else np.nan)
            ax.bar(np.arange(len(pairs)) + (k - 1) * w, vals, width=w, color=C[yr], label=str(yr))
        ax.set_xticks(np.arange(len(pairs)))
        ax.set_xticklabels(pairs, rotation=20, ha="right")
        ax.set_title(ttl)
    axes[0].legend(title="Year")
    finish(fig, reg, "sensors_agreement", "sensors", "Sensor analysis: agreement between sensors",
           ["data/analysis/sensor_comparison.csv"],
           "How closely different sensors flag the same 0.05° cells and move together day to day.",
           "MODIS (1 km) and VIIRS (375 m) are kept distinct; MODIS is compared on days when MODIS has records. Low "
           "agreement reflects different overpass times and resolution, not which sensor is 'right'. Counts from "
           "different sensors are not additive.")


def fig_sensor_monthly_raw(d, reg):
    ms = d["monthly_summary"]
    names = [("MODIS", "MODIS (Terra/Aqua, 1 km)"), ("NOAA20", "VIIRS NOAA-20 (375 m)"),
             ("NOAA21", "VIIRS NOAA-21 (375 m)"), ("SNPP", "VIIRS Suomi NPP (375 m)")]
    fig, axes = plt.subplots(4, 1, figsize=(15, 12), sharex=True)
    for ax, (key, lab) in zip(axes, names):
        s = ms[ms["series"] == key].copy()
        s["ts"] = pd.to_datetime(dict(year=s["year"], month=s["month"], day=1))
        bars = ax.bar(s["ts"] + pd.Timedelta(days=14), s["cell_days_on_used_days"], width=26, color=C[key])
        for b, flag in zip(bars, s["low_coverage_flag"]):
            if flag:
                b.set_hatch("///")
                b.set_facecolor("white")
                b.set_edgecolor(C[key])
        ax.set_ylabel("Raw cell-days")
        ax.set_title(lab + " - own axis, not summed with other sensors", fontsize=11)
    axes[-1].xaxis.set_major_locator(mdates.MonthLocator(bymonth=(1, 4, 7, 10)))
    axes[-1].xaxis.set_major_formatter(mdates.DateFormatter("%b\n%Y"))
    axes[-1].set_xlabel("Month (UTC)")
    finish(fig, reg, "sensors_monthly_raw_by_sensor", "sensors", "Sensor analysis: monthly candidate cell-days by sensor (separate panels)",
           ["data/analysis/monthly_summary.csv"],
           "Raw monthly 0.05° cell-days per sensor family on that sensor's used days, one panel each.",
           "Hatched bars = low-coverage month. Raw cell-days depend on the number of usable days and sensor "
           "resolution; panels must not be added up or compared as fire counts.")


# --------------------------------------------------------------------------- D. static sources
def fig_static_core_vs_excl(d, reg):
    se = d["static_exposure"]
    mo = se[se["period_type"] == "month"].copy()
    mo["ts"] = month_ts(mo["period"])
    yr = d["fai_yearly"]
    fig, (ax, ax2) = plt.subplots(1, 2, figsize=(17, 7), gridspec_kw={"width_ratios": [2.4, 1]})
    ax.plot(mo["ts"], mo["FAI_core"], color=C["core"], lw=1.8, marker="o", ms=4, label="core (all type-0 candidates)")
    ax.plot(mo["ts"], mo["FAI_excl3x3"], color=C["excl"], lw=1.8, marker="s", ms=4,
            label="excl3x3 (cells in/adjacent to static sources removed)")
    ref_line(ax, label="Each series' own reference = 100")
    ax.set_ylabel("Monthly FAI")
    ax.set_xlabel("Month (UTC)")
    ax.set_title("Monthly: core vs excl3x3")
    ax.legend(loc="upper left")
    a = series(yr, headline_id(d)).set_index("year")["FAI"]
    b = series(yr, "N20_SNPP_excl3x3_all").set_index("year")["FAI"]
    w = 0.35
    ax2.bar(np.arange(3) - w / 2, [a.get(v, np.nan) for v in YEARS], w, color=C["core"], label="core")
    ax2.bar(np.arange(3) + w / 2, [b.get(v, np.nan) for v in YEARS], w, color=C["excl"], label="excl3x3")
    ref_line(ax2, label="")
    ax2.set_xticks(range(3))
    ax2.set_xticklabels([str(v) for v in YEARS])
    ax2.set_title("Annual")
    ax2.legend()
    finish(fig, reg, "static_core_vs_excl3x3", "static_sources", "Static thermal sources: core vs excl3x3 FAI",
           ["data/index/static_exposure.csv", "data/index/fai_yearly.csv"],
           "Whether the temporal pattern survives when cells in or next to static thermal sources are removed.",
           "Static-source exclusion is a SENSITIVITY ANALYSIS, not a correction: each series has its own baseline, "
           "removing cells removes real vegetation candidates too, and it does not prove remaining detections are "
           "vegetation fires.")


def fig_static_exposure(d, reg):
    se = d["static_exposure"]
    mo = se[se["period_type"] == "month"].copy()
    mo["ts"] = month_ts(mo["period"])
    fig, (ax, ax2) = plt.subplots(2, 1, figsize=(15, 9), sharex=True, gridspec_kw={"height_ratios": [2, 1]})
    ax.bar(mo["ts"] + pd.Timedelta(days=14), mo["sigma_P"], width=26, color="#756bb1",
           label="Share of candidate cell-days in static 3x3 neighbourhoods (period)")
    ax.axhline(mo["sigma_B"].dropna().iloc[0], color=C["ref"], ls="--", label="Same share in frozen baseline")
    ax.set_ylabel("Static-exposure share (sigma)")
    ax.set_ylim(0, 1)
    ax.legend(loc="lower left")
    ax.set_title("Static-exposure share by month")
    ax2.plot(mo["ts"], mo["R_P"], color="#333333", marker="o", ms=4)
    ax2.axhline(1, color=C["ref"], ls="--")
    ax2.set_ylabel("R = FAI_excl3x3 / FAI_core")
    ax2.set_xlabel("Month (UTC)")
    ax2.xaxis.set_major_locator(mdates.MonthLocator(bymonth=(1, 4, 7, 10)))
    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%b\n%Y"))
    finish(fig, reg, "static_exposure_share", "static_sources", "Static thermal sources: exposure share",
           ["data/index/static_exposure.csv"],
           "How much of detected candidate activity falls in cells in or adjacent to static thermal sources.",
           "R < 1 means a higher static-neighbourhood share than in the reference. This is a diagnostic of exposure, "
           "not a correction and not evidence of cause.")


def fig_static_proximity(d, reg):
    pr = d["static_proximity_summary"]
    lab = pr["proximity_band"].str.replace(r"^\d_", "", regex=True).str.replace("_", " ")
    fig, (ax, ax2) = plt.subplots(1, 2, figsize=(17, 7), gridspec_kw={"width_ratios": [1.6, 1]})
    x = np.arange(len(pr))
    ax.bar(x - 0.2, pr["share_of_cells"], 0.4, label="Share of active cells", color="#9ecae1")
    ax.bar(x + 0.2, pr["share_of_cell_days"], 0.4, label="Share of candidate cell-days", color="#08519c")
    ax.set_xticks(x)
    ax.set_xticklabels(lab, rotation=20, ha="right")
    ax.set_ylabel("Share")
    ax.set_title("Cells and cell-days by distance to nearest static cell")
    ax.legend()
    sy = d["static_source_yearly"]
    for key in ("MODIS", "NOAA20", "NOAA21", "SNPP"):
        s = sy[sy["sensor_key"] == key].sort_values("year")
        ax2.plot(s["year"], s["n_static_cells"], marker="o", color=C[key], label=key)
    ax2.set_xticks(list(YEARS))
    ax2.set_ylabel("Static-source cells detected")
    ax2.set_title("Static cells per sensor and year")
    ax2.legend()
    finish(fig, reg, "static_proximity_and_counts", "static_sources", "Static thermal sources: proximity and per-sensor counts",
           ["data/analysis/static_proximity_summary.csv", "data/analysis/static_source_yearly.csv"],
           "A large share of candidate cell-days lies in or next to static-source cells.",
           "Descriptive association only; no causation is claimed. Static cell counts differ by sensor (MODIS vs VIIRS "
           "kept separate) and must not be summed across sensors.")


# --------------------------------------------------------------------------- E. confidence
def fig_confidence(d, reg):
    cs = d["confidence_sensitivity"]
    mo = cs[cs["period_type"] == "month"].copy()
    mo["ts"] = month_ts(mo["period"])
    fig, (ax, ax2) = plt.subplots(2, 1, figsize=(15, 9), sharex=True, gridspec_kw={"height_ratios": [2, 1]})
    ax.plot(mo["ts"], mo["FAI_all"], color=C["all"], lw=1.8, marker="o", ms=4, label="All confidence classes")
    ax.plot(mo["ts"], mo["FAI_excl_low"], color=C["low"], lw=1.8, marker="s", ms=4, label="Excluding low confidence")
    ref_line(ax, label="Own reference = 100")
    ax.set_ylabel("Monthly FAI")
    ax.legend(loc="upper left")
    ax.set_title("All confidence vs excluding low confidence")
    ax2.bar(mo["ts"] + pd.Timedelta(days=14), mo["FAI_difference_excl_low_minus_all"], width=26, color="#636363")
    ax2.axhline(0, color="black", lw=0.8)
    ax2.set_ylabel("FAI(excl low) - FAI(all)")
    ax2.set_xlabel("Month (UTC)")
    ax2.xaxis.set_major_locator(mdates.MonthLocator(bymonth=(1, 4, 7, 10)))
    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%b\n%Y"))
    finish(fig, reg, "confidence_all_vs_excl_low", "confidence", "Confidence analysis: all confidence vs excluding low confidence",
           ["data/index/confidence_sensitivity.csv"],
           "Whether the temporal pattern depends on keeping low-confidence VIIRS detections.",
           "Each series has its own baseline, so level differences are small by design. Confidence classes are the "
           "sensor's own letter classes (n/h kept); MODIS confidence is not used. This is a sensitivity analysis only.")


def fig_confidence_contribution(d, reg):
    cs = d["confidence_sensitivity"]
    mo = cs[cs["period_type"] == "month"].copy()
    mo["ts"] = month_ts(mo["period"])
    lc = d["low_confidence_share_by_sensor_year"]
    fig, (ax, ax2) = plt.subplots(1, 2, figsize=(17, 7), gridspec_kw={"width_ratios": [2.2, 1]})
    ax.bar(mo["ts"] + pd.Timedelta(days=14), mo["low_confidence_only_cell_day_share"] * 100, width=26, color="#2166ac")
    ax.set_ylabel("Cell-days seen only via low-confidence detections (%)")
    ax.set_xlabel("Month (UTC)")
    ax.set_title("Low-confidence-only share of cell-days (headline series)")
    ax.xaxis.set_major_locator(mdates.MonthLocator(bymonth=(1, 4, 7, 10)))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b\n%Y"))
    w = 0.26
    for k, key in enumerate(SENSOR_ORDER):
        s = lc[lc["sensor_key"] == key].set_index("year")["low_confidence_share"]
        ax2.bar(np.arange(3) + (k - 1) * w, [s.get(v, np.nan) * 100 for v in YEARS], w, color=C[key], label=key)
    ax2.set_xticks(range(3))
    ax2.set_xticklabels([str(v) for v in YEARS])
    ax2.set_ylabel("Low-confidence share of type-0 detections (%)")
    ax2.set_title("By sensor and year")
    ax2.legend()
    finish(fig, reg, "confidence_low_confidence_contribution", "confidence",
           "Confidence analysis: low-confidence contribution",
           ["data/index/confidence_sensitivity.csv", "data/index/low_confidence_share_by_sensor_year.csv"],
           "How much of the detected activity rests on low-confidence classes, by month and by sensor-year.",
           "Low confidence does not mean false; high confidence does not mean confirmed fire. The share rising "
           "over years may reflect processing or environmental differences; no cause is implied.")


# --------------------------------------------------------------------------- F. coverage
def fig_coverage_calendar(d, reg):
    f = series(d["fai_daily"], headline_id(d)).sort_values("date")
    cmap = {"usable": 0, "unusable_not_zero": 1, "not_expected": 2}
    colors = [C["usable"], C["unusable_not_zero"], C["not_expected"]]
    fig, axes = plt.subplots(len(YEARS), 1, figsize=(16, 6.5), sharex=True)
    for ax, yr in zip(axes, YEARS):
        sub = f[f["date"].dt.year == yr]
        doy = sub["date"].dt.dayofyear.values
        code = sub["day_status"].map(cmap).values
        for k, c in enumerate(colors):
            ax.bar(doy[code == k], 1, width=1.0, color=c, lw=0)
        ax.set_yticks([])
        ax.set_ylabel(str(yr), rotation=0, labelpad=25, va="center")
        ax.grid(False)
    month_starts = pd.date_range("2023-01-01", periods=12, freq="MS")
    axes[-1].set_xticks(month_starts.dayofyear)
    axes[-1].set_xticklabels(month_starts.strftime("%b"))
    axes[-1].set_xlim(0.5, 366.5)
    axes[0].legend(handles=[Patch(color=colors[0], label="Usable day"),
                            Patch(color=colors[1], label="Unusable day (missing - NOT zero)"),
                            Patch(color=colors[2], label="Not expected")], ncol=3, loc="lower center",
                   bbox_to_anchor=(0.5, 1.02))
    n_unusable = int((f["day_status"] == "unusable_not_zero").sum())
    finish(fig, reg, "coverage_daily_status", "coverage", "Data coverage: usable and unusable days (headline series)",
           ["data/index/fai_daily.csv"],
           f"Which days entered the headline index; {n_unusable} of {len(f)} days were unusable and excluded.",
           "Unusable days are excluded from the index, never counted as zero activity. Usable-day status is "
           "derived from record presence, a proxy for observation coverage.")


def fig_coverage_sensor_heatmap(d, reg):
    ca = d["coverage_analysis"].copy()
    ca["ts"] = pd.to_datetime(dict(year=ca["year"], month=ca["month"], day=1))
    piv = ca.pivot(index="sensor_key", columns="ts", values="observed_share").reindex(
        ["MODIS", "NOAA20", "NOAA21", "SNPP"])
    fig, ax = plt.subplots(figsize=(16, 5))
    im = ax.imshow(piv.values, aspect="auto", cmap="RdYlGn", vmin=0, vmax=1)
    ax.set_yticks(range(len(piv.index)))
    ax.set_yticklabels(piv.index)
    ticks = [i for i, t in enumerate(piv.columns) if t.month in (1, 4, 7, 10)]
    ax.set_xticks(ticks)
    ax.set_xticklabels([piv.columns[i].strftime("%b\n%Y") for i in ticks])
    ax.grid(False)
    fig.colorbar(im, ax=ax, pad=0.01).set_label("Share of calendar days observed")
    ax.set_title("Monthly observed-day share by sensor")
    finish(fig, reg, "coverage_sensor_month_heatmap", "coverage", "Data coverage: observed-day share by sensor and month",
           ["data/analysis/coverage_analysis.csv"],
           "Which sensor-months have records on few days (red) and which are almost complete (green).",
           "MODIS has days with no records that cannot be confirmed as zero-detection days (unconfirmed gaps); "
           "NOAA-21 is expected only from 2023-03-01. Low share = incomplete observation, not low activity.")


def fig_coverage_gaps(d, reg):
    g = d["coverage_gap_runs"]
    keys = ["MODIS", "NOAA20", "NOAA21", "SNPP"]
    cols = {"no_records_unconfirmed": "#fdae61", "documented_source_gap": "#d7191c",
            "not_expected_before_science_start": "#bdbdbd"}
    fig, ax = plt.subplots(figsize=(16, 5.5))
    for i, key in enumerate(keys):
        for _, r in g[g["sensor_key"] == key].iterrows():
            s = mdates.date2num(r["start_date"]) - 0.5
            ax.barh(i, mdates.date2num(r["end_date"]) - s + 0.5, left=s, height=0.6,
                    color=cols.get(r["coverage_status"], "#888"))
    ax.set_yticks(range(len(keys)))
    ax.set_yticklabels(keys)
    ax.xaxis_date()
    ax.xaxis.set_major_locator(mdates.MonthLocator(bymonth=(1, 4, 7, 10)))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    ax.set_xlim(mdates.date2num(pd.Timestamp("2023-01-01")), mdates.date2num(pd.Timestamp("2025-12-31")))
    ax.invert_yaxis()
    ax.legend(handles=[Patch(color=v, label=k.replace("_", " ")) for k, v in cols.items()], ncol=3,
              loc="upper center", bbox_to_anchor=(0.5, -0.12))
    ax.set_title("Coverage gap runs by sensor")
    ax.set_xlabel("Date (UTC)")
    finish(fig, reg, "coverage_gap_runs", "coverage", "Data coverage: gap runs by sensor",
           ["data/analysis/coverage_gap_runs.csv"],
           "Each bar is a run of consecutive days without usable records for that sensor.",
           "'No records (unconfirmed)' means the absence could be real quiet or missing data; it is never read as "
           "zero activity. Documented source gaps are known outages.")


def fig_coverage_quality(d, reg):
    m = series(d["fai_monthly"], headline_id(d)).sort_values("period")
    m["ts"] = month_ts(m["period"])
    fig, ax = plt.subplots(figsize=(16, 4.8))
    for _, r in m.iterrows():
        q = r["quality_label"]
        ax.bar(r["ts"] + pd.Timedelta(days=14), 1, width=27, color=C.get(q, "#888"))
        ax.text(r["ts"] + pd.Timedelta(days=14), 0.5, f"{int(r['usable_days'])}/{int(r['calendar_days_in_window'])}",
                ha="center", va="center", fontsize=8.5, rotation=90,
                color="white" if q == "reliable" else "black")
    ax.set_yticks([])
    ax.set_ylim(0, 1)
    ax.grid(False)
    ax.xaxis.set_major_locator(mdates.MonthLocator(bymonth=(1, 4, 7, 10)))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b\n%Y"))
    labels = [q for q in ("reliable", "partial_coverage", "insufficient_coverage", "not_expected")
              if (m["quality_label"] == q).any()]
    ax.legend(handles=[Patch(color=C.get(q, "#888"), label=q.replace("_", " ")) for q in labels], ncol=4,
              loc="upper center", bbox_to_anchor=(0.5, -0.2))
    ax.set_title("Monthly quality label (numbers = usable / calendar days)")
    finish(fig, reg, "coverage_monthly_quality_labels", "coverage", "Data coverage: monthly quality labels",
           ["data/index/fai_monthly.csv"],
           "Quality label and usable-day counts for each month of the headline series.",
           "Labels come from Phase 5 coverage rules (kappa = usable / expected days); partial-coverage months should "
           "be interpreted with caution.")


# --------------------------------------------------------------------------- G. patterns
def fig_seasonal_cycle(d, reg):
    m = series(d["fai_monthly"], headline_id(d))
    fig, ax = plt.subplots(figsize=(12, 7))
    for yr in YEARS:
        s = m[m["year"] == yr].sort_values("month")
        ax.plot(s["month"], s["FAI"], marker="o", color=C[yr], lw=2, label=str(yr))
        pc = s[s["quality_label"] != "reliable"]
        ax.scatter(pc["month"], pc["FAI"], s=110, facecolor="white", edgecolor=C[yr], lw=2, zorder=5)
    ref_line(ax)
    ax.set_xticks(range(1, 13))
    ax.set_xticklabels(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])
    ax.set_ylabel("Monthly FAI (reference = 100)")
    ax.set_xlabel("Month of year")
    ax.set_title("Seasonal cycle by year (hollow markers = partial coverage)")
    ax.legend(title="Year")
    finish(fig, reg, "seasonal_cycle_by_year", "seasonal", "Seasonal patterns: month-of-year cycle for each year",
           ["data/index/fai_monthly.csv"],
           "Which months tend to show the highest index and whether the pattern repeats across years.",
           "Three years cannot define a climatology; correlation with season is not causation.")


def fig_day_night(d, reg):
    dn = d["daynight_diagnostic"]
    fig, ax = plt.subplots(figsize=(11, 7))
    x = np.arange(len(dn))
    w = 0.27
    ax.bar(x - w, dn["mean_cells_with_day_detection"], w, color="#f2b134", label="Cells with daytime detection")
    ax.bar(x, dn["mean_cells_with_night_detection"], w, color="#2c3e8c", label="Cells with night-time detection")
    ax.bar(x + w, dn["mean_cell_days_union"], w, color="#777777", label="Union (day or night)")
    ax.set_xticks(x)
    ax.set_xticklabels(dn["year"].astype(str))
    ax.set_ylabel("Mean 0.05° cells per matched day")
    ax.set_title("Day vs night detection diagnostic (NOAA-20 + SNPP)")
    ax.legend()
    finish(fig, reg, "patterns_day_vs_night", "patterns", "Daily patterns: day vs night diagnostics",
           ["data/index/daynight_diagnostic.csv"],
           "Whether the 2023-2025 change appears in both daytime and night-time overpasses.",
           "Day/night is the sensor's overpass flag, not a time-of-burning estimate; day and night cells overlap so "
           "the union is not the sum. Only yearly diagnostics exist, so no monthly day/night chart is made.")


def fig_hourly(d, reg):
    h = d["hourly_profile"].copy()
    h["utc_hour"] = (h["local_hour_cairo"] - h["utc_offset_hours"]) % 24
    sensors = ["MODIS", "NOAA20", "NOAA21", "SNPP"]
    groups = [("vegetation_candidate", "Vegetation-fire candidates (type 0)"), ("static_source", "Static sources (type 2)")]
    fig, axes = plt.subplots(2, 4, figsize=(20, 8.5), sharex=True)
    for r, (grp, gl) in enumerate(groups):
        for c, key in enumerate(sensors):
            ax = axes[r, c]
            s = h[(h["sensor_key"] == key) & (h["hotspot_group"] == grp)]
            agg = s.groupby("utc_hour")["n_detections"].sum()
            share = agg / agg.sum() if agg.sum() else agg
            share = share.reindex(range(24), fill_value=0)
            ax.bar(share.index, share.values * 100, color=C[key], width=0.85)
            ax.set_title(f"{key}\n{gl}", fontsize=10.5)
            ax.set_xticks(range(0, 24, 3))
            if c == 0:
                ax.set_ylabel("% of detections")
            if r == 1:
                ax.set_xlabel("Hour (UTC)")
    finish(fig, reg, "patterns_hourly_profile_utc", "patterns", "Daily patterns: hourly profile of detections by sensor",
           ["data/analysis/hourly_profile.csv"],
           "At which hours of the day each sensor's detections occur, separately for candidates and static sources.",
           "Hours are plotted in UTC (the original time reference), derived from the Africa/Cairo local hour and "
           "UTC offset (2 or 3) in the source file; add 2-3 h for Cairo local time. Hours reflect satellite overpass "
           "times, not when fires burn; sensors are not summed.")


# --------------------------------------------------------------------------- interactive HTML
def _html_page(title: str, body: str) -> str:
    return ("<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,"
            f"initial-scale=1'><title>{title}</title><style>body{{font-family:system-ui,Arial,sans-serif;margin:16px;"
            "color:#222}.note{background:#fff3cd;border:1px solid #e0c36a;padding:8px 12px;margin:8px 0;font-size:13px}"
            "canvas{border:1px solid #ccc;max-width:100%}select{font-size:14px;margin-right:12px}"
            f"#tip{{font-size:14px;min-height:20px}}</style></head><body>{body}</body></html>")


def html_spatial_map(d, reg):
    sc = d["spatial_cells"][["grid_cell_id", "grid_cell_lat", "grid_cell_lon", "veg_cell_days_2023",
                             "veg_cell_days_2024", "veg_cell_days_2025", "veg_cell_days_total"]]
    cf = d["cell_active_day_frequency"][["grid_cell_id", "active_day_frequency"]]
    cells = sc.merge(cf, on="grid_cell_id", how="left")
    st = d["static_source_cells"][["grid_cell_lat", "grid_cell_lon"]].round(3).values.tolist()
    rows = [[r.grid_cell_id, round(r.grid_cell_lat, 3), round(r.grid_cell_lon, 3), int(r.veg_cell_days_2023),
             int(r.veg_cell_days_2024), int(r.veg_cell_days_2025), int(r.veg_cell_days_total),
             None if pd.isna(r.active_day_frequency) else round(float(r.active_day_frequency), 5)]
            for r in cells.itertuples()]
    payload = json.dumps({"cells": rows, "static": st, "outline": EGYPT_OUTLINE})
    body = f"""
<h2>FireScope - interactive 0.05&deg; candidate-activity map (2023-2025)</h2>
<div class='note'><b>Read carefully:</b> {DISCLAIMER} Blank cells = no candidate recorded in this product. Counts are raw
cell-days on observed days (VIIRS, not coverage-normalised); frequency uses national usable days as denominator.
Outline is schematic.</div>
<label>Layer <select id='layer'><option value='6'>Cell-days 2023-2025</option><option value='3'>Cell-days 2023</option>
<option value='4'>Cell-days 2024</option><option value='5'>Cell-days 2025</option>
<option value='7'>Active-day frequency (share of usable days)</option></select></label>
<label><input type='checkbox' id='st'> show static thermal-source cells</label>
<div id='tip'>Hover over a cell.</div><canvas id='c' width='900' height='760'></canvas>
<script>
const D={payload};
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const X0=24.8,X1=36.2,Y0=21.8,Y1=31.9,W=cv.width,H=cv.height;
const px=l=>(l-X0)/(X1-X0)*W, py=l=>H-(l-Y0)/(Y1-Y0)*H;
function colour(v,mx){{const t=Math.log(1+v)/Math.log(1+mx);const r=255,g=Math.round(255*(1-t)*0.9+30),b=Math.round(150*(1-t));
return `rgb(${{r}},${{Math.max(0,g-Math.round(t*160))}},${{b}})`;}}
function draw(){{const k=+document.getElementById('layer').value;ctx.clearRect(0,0,W,H);
let mx=0;D.cells.forEach(c=>{{if(c[k]>mx)mx=c[k];}});
const w=0.05*W/(X1-X0),h=0.05*H/(Y1-Y0);
D.cells.forEach(c=>{{const v=c[k];if(!v)return;ctx.fillStyle=colour(v,mx);ctx.fillRect(px(c[2])-w/2,py(c[1])-h/2,w+0.6,h+0.6);}});
if(document.getElementById('st').checked){{ctx.strokeStyle='#08306b';D.static.forEach(s=>ctx.strokeRect(px(s[1])-w/2,py(s[0])-h/2,w,h));}}
ctx.strokeStyle='#222';ctx.lineWidth=1.2;ctx.beginPath();D.outline.forEach((p,i)=>i?ctx.lineTo(px(p[0]),py(p[1])):ctx.moveTo(px(p[0]),py(p[1])));ctx.closePath();ctx.stroke();}}
cv.addEventListener('mousemove',e=>{{const r=cv.getBoundingClientRect(),sx=cv.width/r.width;
const lon=X0+(e.clientX-r.left)*sx/W*(X1-X0),lat=Y1-(e.clientY-r.top)*sx/H*(Y1-Y0);
const c=D.cells.find(c=>Math.abs(c[1]-lat)<=0.025&&Math.abs(c[2]-lon)<=0.025);
document.getElementById('tip').textContent=c?`${{c[0]}} (${{c[1]}}N, ${{c[2]}}E) | cell-days 2023/24/25/total: ${{c[3]}} / ${{c[4]}} / ${{c[5]}} / ${{c[6]}} | active-day freq: ${{c[7]===null?'n/a':(c[7]*100).toFixed(2)+'%'}}`:`${{lat.toFixed(2)}}N, ${{lon.toFixed(2)}}E - no candidate recorded`;}});
document.getElementById('layer').onchange=draw;document.getElementById('st').onchange=draw;draw();
</script>"""
    path = Path(reg.out_dir) / "spatial" / "interactive_spatial_map.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(_html_page("FireScope spatial map", body), encoding="utf-8")
    reg.add(id="interactive_spatial_map", kind="html", file=str(path), title="Interactive spatial candidate-activity map",
            sources=["data/analysis/spatial_cells.csv", "data/index/cell_active_day_frequency.csv",
                     "data/analysis/static_source_cells.csv"],
            communicates="Hover to read per-cell candidate cell-days per year and active-day frequency; toggle static cells.",
            limitations="Same as the static spatial maps; self-contained canvas (no external libraries, plotly not available).")


def html_monthly_chart(d, reg):
    m = series(d["fai_monthly"], headline_id(d)).sort_values("period")
    pts = [[r.period, None if pd.isna(r.FAI) else round(float(r.FAI), 2), r.quality_label, int(r.usable_days),
            int(r.calendar_days_in_window)] for r in m.itertuples()]
    payload = json.dumps(pts)
    body = f"""
<h2>FireScope - monthly headline FAI (interactive)</h2>
<div class='note'>{DISCLAIMER} Months without a published value are shown as gaps, never zero.</div>
<div id='tip'>Hover over a point.</div><canvas id='c' width='1100' height='480'></canvas>
<script>
const P={payload};const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const L=60,R=20,T=20,B=50,W=cv.width,H=cv.height;const vals=P.map(p=>p[1]).filter(v=>v!==null);const mx=Math.max(...vals,100)*1.1;
const x=i=>L+(W-L-R)*i/(P.length-1),y=v=>H-B-(H-T-B)*v/mx;
ctx.strokeStyle='#999';ctx.beginPath();ctx.moveTo(L,T);ctx.lineTo(L,H-B);ctx.lineTo(W-R,H-B);ctx.stroke();
ctx.setLineDash([5,4]);ctx.strokeStyle='#444';ctx.beginPath();ctx.moveTo(L,y(100));ctx.lineTo(W-R,y(100));ctx.stroke();ctx.setLineDash([]);
ctx.fillStyle='#444';ctx.fillText('reference = 100',L+4,y(100)-4);
ctx.strokeStyle='#b2182b';ctx.lineWidth=2;ctx.beginPath();let pen=false;
P.forEach((p,i)=>{{if(p[1]===null){{pen=false;return;}}pen?ctx.lineTo(x(i),y(p[1])):ctx.moveTo(x(i),y(p[1]));pen=true;}});ctx.stroke();
P.forEach((p,i)=>{{if(p[1]===null)return;ctx.beginPath();ctx.arc(x(i),y(p[1]),5,0,6.3);
ctx.fillStyle=p[2]==='reliable'?'#b2182b':'#fff';ctx.fill();ctx.strokeStyle='#b2182b';ctx.stroke();}});
P.forEach((p,i)=>{{if(p[0].endsWith('-01')||p[0].endsWith('-07')){{ctx.fillStyle='#333';ctx.fillText(p[0],x(i)-16,H-B+18);}}}});
cv.addEventListener('mousemove',e=>{{const r=cv.getBoundingClientRect(),sx=cv.width/r.width,mxp=(e.clientX-r.left)*sx;
let bi=0,bd=1e9;P.forEach((p,i)=>{{const dd=Math.abs(x(i)-mxp);if(dd<bd){{bd=dd;bi=i;}}}});const p=P[bi];
document.getElementById('tip').textContent=`${{p[0]}}: FAI ${{p[1]===null?'not published':p[1]}} | quality: ${{p[2]}} | usable days ${{p[3]}}/${{p[4]}}`;}});
</script>"""
    path = Path(reg.out_dir) / "national" / "interactive_monthly_fai.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(_html_page("FireScope monthly FAI", body), encoding="utf-8")
    reg.add(id="interactive_monthly_fai", kind="html", file=str(path), title="Interactive monthly headline FAI",
            sources=["data/index/fai_monthly.csv"],
            communicates="Hover to read monthly FAI, quality label and usable days.",
            limitations="Hollow markers = partial coverage; gaps for unpublished months; self-contained canvas.")


# --------------------------------------------------------------------------- orchestration
FIGURES = [
    fig_national_annual, fig_national_monthly, fig_national_daily, fig_national_seasonal,
    fig_spatial_total, fig_spatial_annual, fig_spatial_frequency, fig_spatial_frequency_annual,
    fig_spatial_static_overlay, fig_blocks_map, fig_blocks_small_multiples,
    fig_sensor_monthly, fig_sensor_yearly, fig_sensor_spread, fig_sensor_agreement, fig_sensor_monthly_raw,
    fig_static_core_vs_excl, fig_static_exposure, fig_static_proximity,
    fig_confidence, fig_confidence_contribution,
    fig_coverage_calendar, fig_coverage_sensor_heatmap, fig_coverage_gaps, fig_coverage_quality,
    fig_seasonal_cycle, fig_day_night, fig_hourly,
    html_spatial_map, html_monthly_chart,
]


def generate_all(root: Path, out_dir: Path | None = None) -> Registry:
    root = Path(root)
    out_dir = Path(out_dir) if out_dir else root / "data" / "visualizations"
    data = load_sources(root)
    apply_style()
    reg = Registry(out_dir=out_dir)
    for fn in FIGURES:
        safe(reg, fn.__name__)(fn)(data, reg)
    return reg


def _rel(path: str, root: Path) -> str:
    try:
        return str(Path(path).relative_to(root))
    except ValueError:
        return str(path)


def write_report(reg: Registry, root: Path, integrity: dict, report_path: Path | None = None) -> Path:
    root = Path(root)
    report_path = Path(report_path) if report_path else root / "reports" / "phase6_visualization_report.md"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    L = ["# Phase 6 - Visualization Report", "",
         "*Generated by `python main.py phase6` from existing Phase 4 and Phase 5 CSV outputs. No values are typed "
         "into charts; Phase 0-5 outputs and the frozen baseline are not modified.*", "",
         "## Scientific reading rules", "",
         "- A satellite thermal detection is not a confirmed fire; type 0 = vegetation-fire candidates.",
         "- FAI is an index relative to the frozen v1 reference (2023-2025, 100 = reference average). It is not "
         "burned area, fire intensity, or a fire count.",
         "- MODIS and VIIRS are kept separate; raw counts of different sensors are never added as independent fires.",
         "- Missing/unusable days are shown as gaps and are never treated as zero activity.",
         "- 1-degree blocks are shown only relative to their own frozen baseline, never ranked or compared in level; "
         "each block figure carries the national-calendar coverage limitation.",
         "- Inter-sensor spread is not a confidence interval. Static-source exclusion is a sensitivity analysis, not a "
         "correction. No causation is claimed from correlation.",
         "- Time axes are UTC unless stated (the hourly profile is derived to UTC from the Cairo-local hour and offset).",
         "- Map outlines are a schematic, hand-approximated Egypt border for context only (no shapefile available offline); "
         "they carry no data.", "",
         "## Generated visualizations", ""]
    for it in reg.items:
        f = _rel(it["file"], root)
        L += [f"### {it['title']}", "", f"- **File:** `{f}`" + ("  (interactive HTML)" if it["kind"] == "html" else ""),
              f"- **Source:** " + ", ".join(f"`{s}`" for s in it["sources"]),
              f"- **Communicates:** {it['communicates']}", f"- **Limitations:** {it['limitations']}", ""]
    L += ["## Visualizations not generated", ""]
    if reg.failures:
        for fl in reg.failures:
            L.append(f"- `{fl['id']}`: {fl['error']}")
    else:
        L.append("- None; every planned figure was generated.")
    L += ["", "Not produced by design (data does not support it):", "",
          "- Monthly or seasonal day-versus-night series: only yearly day/night diagnostics exist in Phase 5.",
          "- FAI for MODIS: the Phase 5 index is VIIRS-only; MODIS appears only in coverage, agreement and raw cell-day "
          "figures, in its own panels.",
          "- Block ranking charts: intentionally not produced.",
          "- Plotly/Folium maps: libraries not installed and network disabled; interactive HTML pages are "
          "self-contained canvas pages instead.", "",
          "## Integrity checks", "",
          f"- Protected Phase 4/5 files hashed before and after: {integrity.get('n_files', 0)} files, "
          f"unchanged = **{integrity.get('unchanged')}**.",
          f"- Frozen baseline `{PROTECTED_BASELINE}` SHA-256 unchanged = **{integrity.get('baseline_unchanged')}** "
          f"(`{integrity.get('baseline_sha256', '')[:16]}...`).", ""]
    report_path.write_text("\n".join(L), encoding="utf-8")
    return report_path
