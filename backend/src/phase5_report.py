"""Write reports/phase5_index_report.md from data/index/*.csv.

Every number comes from the computed tables. Wording follows the approved
interpretation rules: detected vegetation-fire-candidate cell-day activity,
relative to a frozen 2023-2025 reference.
"""

from __future__ import annotations

import json

import numpy as np
import pandas as pd

from config import PROJECT_ROOT, REPORTS_DIR

INDEX_DIR = PROJECT_ROOT / "data" / "index"
HEADLINE_ID = "headline_N20_SNPP_core_all"


def _fmt(v, nd=1):
    if v is None or (isinstance(v, float) and np.isnan(v)) or (not isinstance(v, str) and pd.isna(v)):
        return "NA"
    if isinstance(v, (bool, np.bool_)):
        return str(bool(v))
    if isinstance(v, (int, np.integer)):
        return f"{int(v):,}"
    if isinstance(v, (float, np.floating)):
        return f"{v:,.{nd}f}"
    return str(v)


_RAW_COLUMNS = {"year", "period", "year_a", "year_b"}


def md_table(frame: pd.DataFrame, decimals: dict | None = None, default: int = 1) -> str:
    decimals = decimals or {}
    frame = frame.rename(columns=str)
    cols = {c: frame[c].tolist() for c in frame.columns}  # tolist keeps int/float types
    head = "| " + " | ".join(frame.columns) + " |"
    sep = "| " + " | ".join("---" for _ in frame.columns) + " |"
    body = []
    for i in range(len(frame)):
        cells = []
        for c in frame.columns:
            v = cols[c][i]
            if c in _RAW_COLUMNS and not pd.isna(v):
                cells.append(str(int(v)) if isinstance(v, (int, float, np.integer, np.floating)) else str(v))
            else:
                cells.append(_fmt(v, decimals.get(c, default)))
        body.append("| " + " | ".join(cells) + " |")
    return "\n".join([head, sep, *body])


def _read(name: str) -> pd.DataFrame:
    return pd.read_csv(INDEX_DIR / f"{name}.csv", keep_default_na=True)


def render_report() -> str:
    info = json.loads((INDEX_DIR / "run_info.json").read_text(encoding="utf-8"))
    version = info["baseline_version"]
    baseline = json.loads((INDEX_DIR / f"baseline_{version}.json").read_text(encoding="utf-8"))
    cat = _read("series_catalog")
    yearly, monthly, seasonal = _read("fai_yearly"), _read("fai_monthly"), _read("fai_seasonal")
    exposure, conf = _read("static_exposure"), _read("confidence_sensitivity")
    spread, blocks, elig = _read("inter_sensor_spread"), _read("block_fai"), _read("block_eligibility")
    cells, val = _read("cell_active_day_frequency"), _read("baseline_validation")
    lowshare, dn, probe = _read("low_confidence_share_by_sensor_year"), _read("daynight_diagnostic"), _read("static_probe_diagnostic")
    checks = _read("phase5_checks")
    head = yearly[yearly["series_id"] == HEADLINE_ID]
    L: list[str] = []
    add = L.append

    add("# FireScope Phase 5: Fire Activity Index (FAI) report")
    add("")
    add(f"*Generated from `data/index/*.csv`. Baseline version **{version}** (frozen {baseline['created_utc']}). "
        "Re-run `python main.py phase5` to refresh.*")
    add("")
    add("## 1. How to read this index")
    add("")
    add("FAI measures **detected vegetation-fire-candidate cell-day activity per usable day, relative to a frozen 2023-2025 reference** "
        "for the same series. FAI = 100 equals the reference average, 150 is 1.5 times it, 50 is half of it.")
    add("")
    add("It is **not** a count of fires, not burned area, not fire intensity, not a probability, and not a 0-100 score. "
        "Type-0 detections are vegetation-fire **candidates**, not confirmed fires. Differences may come from real activity, detection "
        "and processing differences, cloud, unobserved areas, or static-source behaviour. Nothing here identifies a cause, and 100 is "
        "not a \"normal\" level because the reference is only three years.")
    add("")
    add("Series are self-referenced: **compare shape and direction within a series, not levels between series or between blocks.**")
    add("")
    add("## 2. Definition (Design A)")
    add("")
    add("* Unit: **cell-day** = one 0.05 degree cell, one UTC date, at least one type-0 VIIRS detection; several sensors in the set count once.")
    add("* Headline sensor set: **NOAA-20 + S-NPP**. MODIS is not indexed. Static (type 2) rows never enter the index.")
    add("* Usable day: every sensor in the set has `coverage_status = observed` that day. This is a **record-presence proxy** "
        "(`coverage_basis = record_presence_proxy`): it does not prove that all of Egypt was viewed or cloud-free. Unusable days are never zeros.")
    add("* `r(P)` = mean cell-days per usable day in period P. `FAI(P) = 100 * r(P) / B`.")
    add("* `B` = frozen reference: mean cell-days per day over the matched month-days usable in 2023, 2024 and 2025 (29 February dropped), computed separately for every series.")
    add("* `kappa(P)` = usable days / expected days. Expected days exclude days before a sensor's science start (NOAA-21: 2023-03-01). "
        "Quality: `reliable` kappa >= 0.8; `partial_coverage` 0.5 to < 0.8; `insufficient_coverage` (FAI = NA) kappa < 0.5, "
        "fewer than 15 usable days in a month, or a period cut by the data window (incomplete season); `not_expected` before science start (NA).")
    add("* `FAI_sa` (secondary, descriptive): `100 * r(P) / B_calendar-month` (or season) using the matched-date mean of that calendar month; indicative only with three years.")
    add("")
    add("## 3. Frozen baseline")
    add("")
    fp = baseline["input_fingerprint"]
    add(f"* Baseline file: `data/index/baseline_{version}.json`. Years: {baseline['baseline_years']}. Static mask: {baseline['static_mask']['n_static_cells']} "
        f"VIIRS type-2 cells seen in any baseline year, expanded to 3x3 (hash `{baseline['static_mask']['cell_ids_sha256'][:16]}...`).")
    add(f"* Input fingerprint (baseline-year slice of the Phase 3 files): harmonized `{fp['harmonized_baseline_years_sha256'][:16]}...` "
        f"({fp['harmonized_baseline_years_rows']:,} rows), coverage `{fp['coverage_baseline_years_sha256'][:16]}...` ({fp['coverage_baseline_years_rows']:,} rows). "
        "A mismatch stops the run. Only 2023-2025 rows are hashed, so appending later years does not change it.")
    same = info["input_file_sha256_at_freeze"] == info["input_file_sha256_now"]
    add(f"* Whole-file SHA-256 of the Phase 3 inputs equal to the values at freeze: **{same}**.")
    add("* Index runs read B from the file and never recompute it. A new baseline requires `--new-baseline` and writes a new version; old versions stay on disk.")
    add("")
    c = cat[["series_id", "role", "sensors", "mask", "confidence_rule", "n_matched_days", "baseline_total_cell_days", "baseline_B"]]
    add(md_table(c, {"baseline_B": 4, "baseline_total_cell_days": 0}))
    add("")
    h = val[val["series_id"] == HEADLINE_ID][["year", "n_matched_days", "total_cell_days", "mean_cell_days_per_matched_day", "FAI_on_matched_dates"]]
    add("Headline annual index on the matched dates (their mean is 100 by construction, a validation check, not a finding):")
    add("")
    add(md_table(h, {"total_cell_days": 0, "mean_cell_days_per_matched_day": 4, "FAI_on_matched_dates": 3}))
    add("")
    add("## 4. Headline results (NOAA-20 + S-NPP, core, all confidence classes)")
    add("")
    add("Yearly, over all usable days of each year:")
    add("")
    add(md_table(head[["period", "expected_days", "usable_days", "kappa", "cell_days_on_usable_days", "r_cell_days_per_usable_day", "FAI", "quality_label"]],
                 {"kappa": 3, "cell_days_on_usable_days": 0, "r_cell_days_per_usable_day": 3, "FAI": 1}))
    add("")
    add("Seasonal (meteorological; December belongs to the following winter). Incomplete season-years at the window edges are NA:")
    add("")
    s = seasonal[seasonal["series_id"] == HEADLINE_ID]
    add(md_table(s[["period", "calendar_days_in_window", "expected_days", "usable_days", "kappa", "FAI", "FAI_sa", "quality_label", "na_reason"]], {"kappa": 3}))
    add("")
    add("Monthly:")
    add("")
    m = monthly[monthly["series_id"] == HEADLINE_ID]
    add(md_table(m[["period", "expected_days", "usable_days", "kappa", "FAI", "FAI_sa", "quality_label"]], {"kappa": 3}))
    add("")
    flagged = m[m["quality_label"] != "reliable"]
    if len(flagged):
        add("Months that are not `reliable`: " + "; ".join(f"{r.period} ({r.quality_label}, kappa {r.kappa:.2f})" for r in flagged.itertuples()) + ".")
    else:
        add("All headline months are `reliable`.")
    pub = m.dropna(subset=["FAI"])
    add("")
    add(f"Highest and lowest published monthly values: {pub.loc[pub['FAI'].idxmax(), 'period']} ({pub['FAI'].max():.1f}) and "
        f"{pub.loc[pub['FAI'].idxmin(), 'period']} ({pub['FAI'].min():.1f}). These describe detected cell-day activity relative to the reference; "
        "they are not a statement about fire occurrence.")
    add("")
    add("Yearly and monthly values average over all usable days of the period, so they differ slightly from the matched-date annual values in section 3 "
        "(which use only dates usable in all three years). Both use the same frozen B.")
    add("")
    add("The daily raw series is in `fai_daily.csv`. Unusable days carry NA, not zero.")
    add("")
    add("## 5. Static-source sensitivity (always published next to the headline)")
    add("")
    add("`excl3x3` removes cells in or adjacent to any VIIRS type-2 cell (time-invariant any-year mask) and has its own baseline. "
        "`sigma(P) = 1 - sum(c_excl3x3) / sum(c_core)` over the usable days of P (period totals; NA if the denominator is zero). "
        "`R(P) = FAI_excl3x3 / FAI_core = (1 - sigma_P) / (1 - sigma_B)`; R < 1 means the static-neighbourhood share is higher than in the reference.")
    add("")
    ey = exposure[exposure["period_type"] == "year"][["period", "FAI_core", "FAI_excl3x3", "sigma_P", "sigma_B", "R_P"]]
    add(md_table(ey, {"sigma_P": 4, "sigma_B": 4, "R_P": 4}))
    add("")
    em = exposure[exposure["period_type"] == "month"].dropna(subset=["sigma_P"])
    add(f"Monthly sigma ranges from {em['sigma_P'].min():.3f} to {em['sigma_P'].max():.3f}; monthly R from {em['R_P'].min():.3f} to {em['R_P'].max():.3f}.")
    add("Exclusion is a sensitivity analysis, not a correction: it may remove genuine vegetation-fire candidates in those cells, and unflagged static heat can remain in type 0. "
        "sigma and R are not contamination estimates.")
    add("")
    add("## 6. Confidence sensitivity")
    add("")
    add("`excl_low` keeps VIIRS classes n and h only, with its own baseline. Letters are never converted to numbers and MODIS confidence is not used.")
    add("")
    cy = conf[conf["period_type"] == "year"][["period", "FAI_all", "FAI_excl_low", "FAI_difference_excl_low_minus_all", "low_confidence_only_cell_day_share"]]
    add(md_table(cy, {"low_confidence_only_cell_day_share": 4}))
    add("")
    add("Share of type-0 detections with confidence class l, by sensor and year (diagnostic):")
    add("")
    add(md_table(lowshare, {"low_confidence_share": 4}))
    add("")
    add("## 7. Single sensors, 3-sensor union, and Inter-sensor Index Spread")
    add("")
    add("Each single-sensor index uses that sensor's own usable days and own baseline. The Inter-sensor Index Spread is the range (max - min) of the "
        "single-sensor indices with kappa >= 0.5. It is a **descriptive sensitivity to which VIIRS sensor is used. It is not a confidence interval, "
        "standard error, or uncertainty estimate**, and it mixes sensor differences with different day sets.")
    add("")
    rb = yearly[yearly["series_id"].isin(["headline_N20_SNPP_core_all", "V3_core_all", "NOAA20_core_all", "NOAA21_core_all", "SNPP_core_all"])]
    piv = rb.pivot(index="series_id", columns="period", values="FAI").reset_index()
    add(md_table(piv, default=1))
    add("")
    sy = spread[spread["period_type"] == "year"][["period", "FAI_NOAA20", "FAI_NOAA21", "FAI_SNPP", "n_sensors_in_spread", "inter_sensor_index_spread"]]
    add(md_table(sy))
    add("")
    sm = spread[spread["period_type"] == "month"].dropna(subset=["inter_sensor_index_spread"])
    add(f"Monthly spread (months with at least two eligible sensors, n = {len(sm)}): median {sm['inter_sensor_index_spread'].median():.1f}, "
        f"maximum {sm['inter_sensor_index_spread'].max():.1f} index points ({sm.loc[sm['inter_sensor_index_spread'].idxmax(), 'period']}).")
    add("")
    add("## 8. 1-degree geographic blocks (not governorates)")
    add("")
    nb, ne = len(elig), int(elig["eligible"].sum())
    add(f"Blocks with any headline cell-days on the matched dates: {nb}; eligible (at least 100 baseline cell-days under the headline definition): **{ne}**. "
        f"Eligible blocks hold {elig.loc[elig['eligible'], 'baseline_cell_days'].sum() / elig['baseline_cell_days'].sum():.1%} of baseline cell-days. "
        "The earlier count of 45 of 83 in the proposal came from the all-days 3-sensor table; this count is recomputed on the matched-date headline totals.")
    add("")
    add("**Presentation limits.** The block index is *not locally coverage-normalised* (`coverage_basis = national_calendar_proxy`, "
        "`locally_coverage_normalized = False`): a block's rate is its mean cell-days over NATIONAL usable days, so missing local coverage can only bias it downward by an unknown amount. "
        "Each block is relative to its own 2023-2025 reference, so **values are not comparable between blocks and blocks are not ranked by FAI**. "
        "The table below is ordered by block id only.")
    add("")
    by = blocks[blocks["period_type"] == "year"].pivot(index="block_id", columns="period", values="FAI_block")
    by.columns = [f"FAI_{c}" for c in by.columns]
    sh = blocks[blocks["period_type"] == "year"].groupby("block_id")["block_share_of_national_cell_days"].mean().rename("mean_yearly_share_of_national_cell_days")
    tbl = by.join(sh).reset_index().sort_values("block_id")
    add(md_table(tbl, {"mean_yearly_share_of_national_cell_days": 3}))
    add("")
    add("Seasonal block values are in `block_fai.csv` (period_type = season). The share column says where detected activity concentrated; it is not a share of fires or burned area.")
    add("")
    add("## 9. Cells (not indexed)")
    add("")
    q = cells["active_day_frequency"].quantile([0.5, 0.9, 0.99])
    add(f"{len(cells):,} cells have at least one headline cell-day on usable days. Active-day frequency (active usable days / national usable days; not a probability) "
        f"has median {q[0.5]:.4f}, 90th percentile {q[0.9]:.4f}, 99th percentile {q[0.99]:.4f}. Per-cell values are in `cell_active_day_frequency.csv`.")
    add("")
    add("## 10. Diagnostics (not part of the index)")
    add("")
    add("Day/night split on the headline matched dates (a cell seen in both overpasses counts in both columns):")
    add("")
    add(md_table(dn, default=2))
    add("")
    add("Static-probe diagnostic (VIIRS static cells detected on at least half of a sensor's observed days). Probe misses mix cloud, intermittent flares and true coverage "
        "and cannot be separated, so this is never used to correct the index:")
    add("")
    add(md_table(probe.drop(columns=["use"]), default=3))
    add("")
    add("## 11. Validation")
    add("")
    add(f"Pipeline: {info['input_rows']:,} Phase 3 rows, {info['execution_seconds']} s. Consistency checks passed: **{info['checks_passed']} of {info['checks_total']}** (`phase5_checks.csv`).")
    add("")
    add(md_table(checks[["check", "passed", "detail"]]))
    add("")
    add("## 12. Limitations")
    add("")
    for i, t in enumerate([
        "Detections are thermal anomalies. Type 0 are vegetation-fire candidates, not confirmed fires, burned area, or intensity.",
        "Usable days are a record-presence proxy. They do not verify that all of Egypt, or any block or cell, was viewed or cloud-free.",
        "The block index is not locally coverage-normalised and is biased downward by unknown local gaps. No stronger correction is supported by the data.",
        "Cloud, swath edges, and detection thresholds hide some activity. Detected activity is not actual activity.",
        "The reference is the 2023-2025 average, not a long-term climatology. FAI = 100 is not \"normal\".",
        "Three years cannot separate trend from year-to-year variability. Changes are descriptive and not causal.",
        "Series are self-referenced. Levels of different series, and of different blocks, are not comparable; only shape and direction are.",
        "The 0.05 degree grid (about 5 km) is coarser than VIIRS pixels. Cell area varies about 8 % with latitude and no boundary mask exists.",
        "Static exclusion is a sensitivity analysis that may remove genuine candidates and may miss unflagged static heat.",
        "VIIRS (l/n/h) and MODIS (numeric) confidence are never merged; MODIS is outside the index.",
        "Inter-sensor Index Spread is a range of three variants, not an uncertainty interval.",
        "Quality thresholds (kappa 0.8 and 0.5, 15 usable days per month, incomplete-season rule, 100 block cell-days) are project choices.",
        "The 1-degree blocks are analytical bins, not governorates.",
        "Source gaps (S-NPP 2024, NOAA-21 before 2023-03-01) are preserved and reduce usable days.",
        "Changed upstream data (for example NASA reprocessing) require a new baseline version.",
    ], start=1):
        add(f"{i}. {t}")
    add("")
    add("Not implemented (optional in the approved methodology): the day-resampling interval (its autocorrelation and stationarity assumptions were not demonstrated, so it is off), "
        "same-cell-only and persistent-cell exclusion variants, and any swath or cloud-mask coverage correction.")
    add("")
    return "\n".join(L) + "\n"


def write_report() -> str:
    text = render_report()
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORTS_DIR / "phase5_index_report.md"
    path.write_text(text, encoding="utf-8")
    return str(path)
