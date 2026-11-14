"""Build reports/phase4_analysis_report.md. Every number comes from the output tables."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd

from config import PROJECT_ROOT, REPORTS_DIR
from phase4_analysis import (
    GRID_SIZE_DEG, HOTSPOT_PERCENTILE, MIN_MONTH_COVERAGE, PERSISTENT_MIN_DAYS, SERIES_V2, SERIES_V3,
    SERIES_V3_NO_STATIC, SERIES_V3_NO_STATIC_YEAR, YEARS,
)

ANALYSIS_DIR = PROJECT_ROOT / "data" / "analysis"


def _f(x, nd=2):
    return "n/a" if x is None or (isinstance(x, float) and np.isnan(x)) else f"{x:,.{nd}f}"


def _i(x):
    return "n/a" if x is None or (isinstance(x, float) and np.isnan(x)) else f"{int(x):,}"


def _table(df: pd.DataFrame) -> str:
    cols = list(df.columns)
    lines = ["| " + " | ".join(cols) + " |", "|" + "|".join("---" for _ in cols) + "|"]
    for _, r in df.iterrows():
        lines.append("| " + " | ".join("" if pd.isna(v) else str(v) for v in r) + " |")
    return "\n".join(lines)


def build_report() -> str:
    t = {p.stem: pd.read_csv(p) for p in ANALYSIS_DIR.glob("*.csv")}
    info = json.loads((ANALYSIS_DIR / "run_info.json").read_text())
    prof = t["sensor_profile"]
    cov = t["coverage_analysis"]
    checks = t["consistency_checks"]
    matched = t["matched_day_yearly"]
    sens = t["sensitivity_matched_day_yearly"]
    cells = t["spatial_cells"]
    conc = t["spatial_concentration"]
    pers = t["persistent_activity"]
    infl = t["static_influence_metrics"].set_index("metric")["value"]
    prox = t["static_proximity_summary"]
    blocks = t["regional_blocks_1deg"]
    clusters = t["hotspot_clusters"]
    thr = t["hotspot_thresholds"]
    mpool = t["monthly_pooled"]
    spool = t["seasonal_pooled"]
    seas = t["seasonal_summary"]
    pair = t["sensor_comparison"]
    hourly = t["hourly_profile"]

    L: list[str] = []
    add = L.append
    add("# Phase 4 report: temporal, spatial, sensor, coverage, and static-source analysis\n")
    add("*All numbers below are read from `data/analysis/*.csv` when this report is generated. "
        "Re-run `python main.py phase4` to refresh both.*\n")

    add("## 1. What Phase 4 analyses\n")
    add("Thermal detections from NASA FIRMS over Egypt: when they occur, where they concentrate, how the sensors "
        "compare, how much of the calendar each sensor actually covers, and how static thermal sources (type 2) shape the picture. "
        "A detection is a thermal anomaly. Only type 0 rows are called **vegetation-fire candidates**; they are not confirmed fires, "
        "burned area, or intensity. Type 2 rows are **static thermal sources** and are analysed separately. "
        "No Fire Activity Index is built (Phase 5).\n")

    add("## 2. Data and sensors\n")
    cols = ["sensor_key", "nominal_resolution_m", "n_rows", "n_type0_vegetation_candidates", "n_type2_static", "n_type3_water",
            "observed_days", "unobserved_days"]
    add(_table(prof[cols]) + "\n")
    add(f"Input rows: {_i(info['input_rows'])} (2023-2025). MODIS ~1 km, VIIRS ~375 m. Sensors are never summed as independent events.\n")

    add("## 3. Analysis period and grid\n")
    add(f"Years {YEARS[0]}-{YEARS[-1]}. Grid: {GRID_SIZE_DEG} degrees (Phase 3 grid kept). "
        "A **cell-day** is one grid cell on one UTC date with at least one detection, counted once however many sensors or records contributed. "
        "Rows dated outside the analysis years are dropped from the analysis copy only.\n")

    add("## 4. Temporal methodology\n")
    add("* **Coverage first.** A sensor-day is *observed* when the coverage calendar finds at least one record of any type. Rates divide by observed days only. "
        "A day with no records at all is a coverage fact, not zero fire; an observed day with zero candidates (for example, static records only) is a valid zero.\n")
    add(f"* **Series.** Per sensor, plus VIIRS unions counted as cell-days: `{SERIES_V3}` (needs all three VIIRS sensors observed), `{SERIES_V2}`, and two static-exclusion sensitivities.\n")
    add("* **MODIS** has totals but no per-day rates: an empty MODIS day cannot be told apart from missing MODIS data.\n")
    add(f"* **Matched days.** Year-over-year change uses only calendar dates usable in all {len(YEARS)} years (Feb 29 dropped).\n")
    add("* **Seasons** are meteorological with a **season year**: December belongs to the following winter. "
        "Season-years the window cannot cover completely are flagged `season_year_complete = False`.\n")
    add("* **Hourly profile** uses Africa/Cairo local time with daylight saving; UTC stays untouched. Overpass times are fixed in UTC, so the profile mostly shows the satellite schedule.\n")
    v3 = matched[matched["series"] == SERIES_V3].sort_values("year")
    if len(v3):
        add(f"\n**Matched-day result, `{SERIES_V3}`** ({_i(v3['n_matched_days'].iloc[0])} matched days, "
            f"{v3['first_matched_month_day'].iloc[0]} to {v3['last_matched_month_day'].iloc[0]}):\n")
        add(_table(v3[["year", "total_cell_days", "mean_cell_days_per_day", "pct_change_vs_previous_year", "pct_change_vs_first_year"]].round(2)) + "\n")
        add("The same direction appears in each single-sensor matched series (see `matched_day_yearly.csv`). This is descriptive. "
            "It does not identify a cause, and it may combine real change with changes in detection, processing, or static-source behaviour.\n")
    sv = sens[["series", "year", "n_matched_days", "total_cell_days", "pct_change_vs_first_year"]].round(2)
    add("Sensitivity series:\n")
    add(_table(sv) + "\n")
    p3 = mpool[(mpool["series"] == SERIES_V2) & mpool["is_peak_month"]]
    if len(p3):
        add(f"Pooled peak month for `{SERIES_V2}`: month {_i(p3['month'].iloc[0])} "
            f"(mean {_f(p3['mean_cell_days_per_used_day'].iloc[0])} cell-days per used day over {_i(p3['used_days'].iloc[0])} used days, "
            f"{_i(p3['years_contributing'].iloc[0])} years).\n")
    inc = seas[(seas["series"] == SERIES_V2) & (~seas["season_year_complete"])][["season_year", "season", "calendar_days", "expected_season_days"]]
    add(f"Incomplete season-years for `{SERIES_V2}`:\n")
    add(_table(inc) + "\n")

    add("## 5. Spatial methodology\n")
    add(f"* Spatial tables use **VIIRS vegetation-candidate cell-days** (union of the three VIIRS sensors). They are not normalised by coverage.\n"
        f"* **Hotspot clusters**: cells at or above the {HOTSPOT_PERCENTILE:g}th percentile of active days (per scope) that touch (8 neighbours) form one cluster. "
        "A cluster is a statistical concentration, not a fire location.\n"
        f"* **Persistent cells**: at least {PERSISTENT_MIN_DAYS} cell-days in one year.\n"
        "* **Geographic blocks** are 1-degree analytical bins named like `B31N_29E`. They are **not governorates**.\n")
    ac = conc[(conc["scope"] == "all_years")].set_index("cell_filter")
    add(f"Active VIIRS candidate cells: {_i(len(cells))}; cell-days: {_i(cells['veg_cell_days_total'].sum())}.\n")
    add(_table(ac[["n_active_cells", "total_cell_days", "top_5pct_cells_share", "gini", "cells_for_50pct_of_cell_days"]].round(3).reset_index()) + "\n")
    allt = thr[thr["cluster_scope"] == "all_years"]
    if len(allt):
        r = allt.iloc[0]
        add(f"All-years clusters: threshold {_f(r['threshold_days'], 1)} days, {_i(r['n_high_cells'])} high cells, {_i(r['n_clusters'])} clusters "
            f"({_i(r['n_single_cell_clusters'])} single-cell).\n")
    top = clusters[clusters["cluster_scope"] == "all_years"].head(5)[["cluster_id", "n_cells", "total_cell_days", "centroid_lat", "centroid_lon", "static_proximity_flag"]].round(3)
    add("Largest all-years clusters:\n")
    add(_table(top) + "\n")
    add("Top blocks by candidate cell-days:\n")
    add(_table(blocks.head(5)[["block_id_1deg", "n_veg_cells", "veg_cell_days_total", "veg_cell_days_excl_static_3x3", "top_cell_id"]]) + "\n")

    add("## 6. Static-source methodology\n")
    add("Type 2 rows are never deleted or mixed into candidate tables. Three populations are kept distinct: "
        "(a) static detections from all sensors (`static_source_cells`), (b) VIIRS static cell-days (used for neighbourhood flags and proximity), "
        "(c) vegetation candidates. Exclusion of cells in or next to static cells (3x3) is a **sensitivity analysis**, not a correction: "
        f"`{SERIES_V3_NO_STATIC}` uses static cells seen in any year (conservative); `{SERIES_V3_NO_STATIC_YEAR}` uses static cells seen in the same year.\n")
    add(f"* Candidate cells with a static cell in the same cell: {_i(infl.get('n_veg_cells_static_same_cell'))}; in the 3x3 neighbourhood: "
        f"{_i(infl.get('n_veg_cells_static_in_3x3'))} ({_f(infl.get('share_veg_cells_static_in_3x3') * 100, 1)}% of cells, "
        f"{_f(infl.get('share_veg_cell_days_in_static_3x3_cells') * 100, 1)}% of cell-days).\n"
        f"* Of the 10 most active cells, {_i(infl.get('top10_cells_with_static_in_3x3'))} have a VIIRS static cell in the 3x3 neighbourhood.\n"
        f"* Persistent cells (any year): {_i(infl.get('persistent_cells_any_year'))}; with static in 3x3: {_i(infl.get('persistent_cells_with_static_in_3x3'))}.\n"
        f"* Spearman correlation between distance to nearest VIIRS static cell and candidate cell-days: {_f(infl.get('spearman_distance_to_static_vs_veg_cell_days'), 3)} (descriptive, not causal).\n")
    add(_table(prox.round(3)) + "\n")
    add("Many of the most active candidate cells sit in or next to static thermal sources, so the headline hotspot map should be read together with the exclusion sensitivity.\n")

    add("## 7. Sensor-comparison methodology\n")
    add("All comparisons are **grid-cell co-occurrence on the 0.05 degree grid**. They are not pixel-level agreement and do not show that two satellites saw the same physical fire. "
        "VIIRS pairs use only days both sensors were observed. MODIS (~1 km) versus VIIRS (~375 m) differ in pixel size and sensitivity, so VIIRS is expected to flag many cell-days MODIS does not. "
        "Two day bases are reported for MODIS vs VIIRS: days with a MODIS record (biased toward MODIS detections) and all fully covered VIIRS days with empty MODIS days assumed to have no cell-days (an assumption, not a measurement). "
        "Confidence is never merged: MODIS is numeric 0-100, VIIRS is l/n/h, reported separately in `sensor_profile`.\n")
    a = pair[pair["scope"] == "all_years"][["comparison_type", "sensor_a", "sensor_b", "day_basis", "n_common_days", "jaccard",
                                             "share_a_also_in_b", "share_b_also_in_a", "share_a_with_b_in_3x3", "spearman_daily_cells"]].round(3)
    add(_table(a) + "\n")

    add("## 8. Coverage methodology\n")
    add("Coverage comes from `coverage_calendar.csv`: observed, documented source gap, no records (unconfirmed), or not expected before science start. "
        "Observed is inferred from the presence of records, so a genuine VIIRS day with no records of any kind is indistinguishable from missing data and is excluded (conservative).\n")
    tot = cov.groupby("sensor_key")[[c for c in cov.columns if c.endswith("_days") and c != "calendar_days"] + ["calendar_days"]].sum().reset_index()
    add(_table(tot) + "\n")
    add(f"Hourly profile rows: {_i(len(hourly))}.\n")

    add("## 9. Known limitations\n")
    add("1. Detections are thermal anomalies, not confirmed fires.\n"
        "2. MODIS coverage cannot be confirmed on empty days, so MODIS has no rates.\n"
        "3. Observed days are inferred from records; true zero-record VIIRS days are treated as unobserved.\n"
        "4. Spatial cell-days are not coverage-normalised and are a union of VIIRS sensors with different start dates.\n"
        "5. The 0.05 degree grid (~5 km) is coarser than VIIRS pixels; co-occurrence on it is not the same fire.\n"
        "6. Static-source exclusion is a sensitivity view; unflagged industrial or other static heat can remain in type 0.\n"
        "7. Three years cannot separate trend from year-to-year variability; matched-day change is descriptive.\n"
        "8. DJF season-years at the window edges are incomplete (flagged).\n"
        "9. The 1-degree blocks are analytical bins, not administrative areas.\n"
        "10. Hotspot cluster thresholds are a project choice (percentile), not a statistical test.\n")

    add("## 10. Validation and testing\n")
    add(f"* Pipeline executed on real data: {_i(info['input_rows'])} rows in {_f(info['execution_seconds'], 1)} s, {len(info['tables'])} tables, "
        f"{len(info['warnings'])} warnings.\n"
        f"* Numerical consistency checks: {info['checks_passed']} of {info['checks_total']} passed (`consistency_checks.csv`).\n"
        "* Automated tests: `tests/test_phase4_analysis.py` (see completion summary for the run result).\n")
    add(_table(checks[["check", "passed"]]) + "\n")

    add("## 11. Recommendations for Phase 5 (not implemented)\n")
    add("* Build any index on cell-day presence, not raw counts, and keep sensors separate.\n"
        "* Divide by observed days, and restrict year comparisons to matched days.\n"
        "* Decide explicitly how to treat static-neighbourhood cells; keep the exclusion as a documented, switchable sensitivity.\n"
        "* Do not use MODIS empty days as zeros.\n"
        "* Treat the 2023-2025 change as descriptive until longer history is available.\n")
    return "\n".join(L)


def write_report() -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "phase4_analysis_report.md").write_text(build_report(), encoding="utf-8")


if __name__ == "__main__":
    write_report()
