"""Phase 5: Fire Activity Index (FAI), Design A (approved methodology, revision 2).

FAI(P) = 100 * r(P) / B

* c(d)   distinct 0.05 degree cells with at least one type-0 VIIRS detection on
         UTC date d, any sensor in the set S counted once (cell-day).
* used   a day is usable only if EVERY sensor in S has coverage_status
         "observed" (a record-presence proxy, not verified spatial coverage).
* r(P)   mean of c(d) over usable days of period P. Unusable days are never zeros.
* B      frozen reference: mean of c(d) over the matched month-days (usable in
         all of 2023, 2024, 2025; 29 February dropped), per series.

FAI is a relative index of DETECTED vegetation-fire-candidate cell-day activity.
It is not a count of fires, burned area, intensity, or a confidence statement.
Inter-sensor spread is a range of single-sensor indices, never an uncertainty
interval. Blocks are never ranked by FAI level.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from harmonize import GRID_SIZE_DEG
from phase4_analysis import (
    SEASON_BY_MONTH,
    YEARS,
    block_label,
    block_origin,
    encode_cell_key,
    neighborhood_keys,
    season_expected_days,
    season_year_of,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Project choices (documented in the methodology, section 5.2 and 12)
# ---------------------------------------------------------------------------
COVERAGE_BASIS_NATIONAL = "record_presence_proxy"
COVERAGE_BASIS_BLOCK = "national_calendar_proxy"
KAPPA_RELIABLE = 0.8
KAPPA_MIN_PUBLISHED = 0.5
MIN_USABLE_DAYS_MONTH = 15
BLOCK_MIN_BASELINE_CELL_DAYS = 100
# Science start per sensor. Sensors not listed are expected from the first day.
SCIENCE_START = {"NOAA21": pd.Timestamp("2023-03-01")}
HIGH_OR_NOMINAL = ("n", "h")
PERIOD_TYPES = ("month", "season", "year")
BASELINE_FILE_TEMPLATE = "baseline_{version}.json"


class BaselineMismatchError(RuntimeError):
    """Raised when the data no longer match the frozen baseline."""


@dataclass(frozen=True)
class SeriesSpec:
    series_id: str
    role: str
    sensors: tuple[str, ...]
    mask: str  # "core" or "excl3x3"
    confidence: str  # "all" or "excl_low"


HEADLINE_ID = "headline_N20_SNPP_core_all"
SERIES_SPECS: tuple[SeriesSpec, ...] = (
    SeriesSpec(HEADLINE_ID, "headline", ("NOAA20", "SNPP"), "core", "all"),
    SeriesSpec("N20_SNPP_excl3x3_all", "static_sensitivity", ("NOAA20", "SNPP"), "excl3x3", "all"),
    SeriesSpec("N20_SNPP_core_excl_low", "confidence_sensitivity", ("NOAA20", "SNPP"), "core", "excl_low"),
    SeriesSpec("V3_core_all", "robustness_3sensor_union", ("NOAA20", "NOAA21", "SNPP"), "core", "all"),
    SeriesSpec("NOAA20_core_all", "single_sensor", ("NOAA20",), "core", "all"),
    SeriesSpec("NOAA21_core_all", "single_sensor", ("NOAA21",), "core", "all"),
    SeriesSpec("SNPP_core_all", "single_sensor", ("SNPP",), "core", "all"),
)
SPEC_BY_ID = {s.series_id: s for s in SERIES_SPECS}
SINGLE_SENSOR_IDS = {"NOAA20": "NOAA20_core_all", "NOAA21": "NOAA21_core_all", "SNPP": "SNPP_core_all"}


# ---------------------------------------------------------------------------
# Input preparation
# ---------------------------------------------------------------------------
def parse_cell_ids(ids: pd.Series) -> tuple[np.ndarray, np.ndarray]:
    idx = ids.astype(str).str.extract(r"^G(-?\d+)_(-?\d+)$")
    if idx.isna().any(axis=None):
        raise ValueError("grid_cell_id values must look like G<lat_index>_<lon_index>")
    return idx[0].astype(np.int64).to_numpy(), idx[1].astype(np.int64).to_numpy()


def _with_cell_columns(frame: pd.DataFrame) -> pd.DataFrame:
    lat_idx, lon_idx = parse_cell_ids(frame["grid_cell_id"])
    out = frame.copy()
    out["lat_idx"], out["lon_idx"] = lat_idx, lon_idx
    out["key"] = encode_cell_key(lat_idx, lon_idx)
    lat_c = np.round((lat_idx + 0.5) * GRID_SIZE_DEG, 4)
    lon_c = np.round((lon_idx + 0.5) * GRID_SIZE_DEG, 4)
    out["grid_cell_lat"], out["grid_cell_lon"] = lat_c, lon_c
    lat_min, lon_min = block_origin(lat_c, lon_c)
    out["block_lat_min"], out["block_lon_min"] = lat_min, lon_min
    out["block_id"] = block_label(lat_min, lon_min)
    return out


def prepare_type0_viirs(harmonized: pd.DataFrame) -> pd.DataFrame:
    """Type-0 VIIRS detections only. MODIS and static rows never enter the index."""
    mask = harmonized["is_vegetation_fire_candidate"].astype(bool) & (harmonized["sensor_family"] == "VIIRS")
    if "hotspot_type" in harmonized.columns:
        mask &= harmonized["hotspot_type"] == 0
    sub = harmonized.loc[mask, ["sensor_key", "acquisition_date", "grid_cell_id", "confidence_class", "daynight"]]
    out = pd.DataFrame(
        {
            "sensor_key": sub["sensor_key"].astype(str).to_numpy(),
            "date": pd.to_datetime(sub["acquisition_date"].astype(str)).to_numpy(),
            "grid_cell_id": sub["grid_cell_id"].astype(str).to_numpy(),
            "confidence_class": sub["confidence_class"].fillna("").astype(str).to_numpy(),
            "daynight": sub["daynight"].fillna("").astype(str).to_numpy(),
        }
    )
    out = _with_cell_columns(out)
    out["year"] = out["date"].dt.year
    return out


def prepare_static_viirs(harmonized: pd.DataFrame) -> pd.DataFrame:
    """Type-2 VIIRS rows, used only for the mask and the probe diagnostic."""
    mask = harmonized["is_static_source"].astype(bool) & (harmonized["sensor_family"] == "VIIRS")
    sub = harmonized.loc[mask, ["sensor_key", "acquisition_date", "grid_cell_id"]]
    out = pd.DataFrame(
        {
            "sensor_key": sub["sensor_key"].astype(str).to_numpy(),
            "date": pd.to_datetime(sub["acquisition_date"].astype(str)).to_numpy(),
            "grid_cell_id": sub["grid_cell_id"].astype(str).to_numpy(),
        }
    )
    out = _with_cell_columns(out)
    out["year"] = out["date"].dt.year
    return out


def static_cell_ids(static: pd.DataFrame, years=YEARS) -> list[str]:
    """VIIRS type-2 cells seen in any baseline year (time-invariant mask source)."""
    return sorted(static.loc[static["year"].isin(years), "grid_cell_id"].unique().tolist())


def static_mask_keys(cell_ids: list[str]) -> np.ndarray:
    """Keys of all cells in or adjacent to (3x3) the given static cells."""
    if not cell_ids:
        return np.array([], dtype=np.int64)
    lat, lon = parse_cell_ids(pd.Series(cell_ids))
    return neighborhood_keys(lat, lon, rings=1)


def build_calendar(coverage: pd.DataFrame) -> pd.DataFrame:
    """Date x sensor table of ``observed`` flags from the Phase 3 coverage calendar."""
    cov = coverage.copy()
    cov["date"] = pd.to_datetime(cov["acquisition_date"].astype(str))
    cov["observed"] = cov["coverage_status"].astype(str).eq("observed")
    cal = cov.pivot(index="date", columns="sensor_key", values="observed").fillna(False).astype(bool)
    cal.columns = [str(c) for c in cal.columns]
    return cal.sort_index()


def expected_mask(dates: pd.DatetimeIndex, sensors) -> np.ndarray:
    """A day is expected when every sensor in the set has started science data."""
    ok = np.ones(len(dates), dtype=bool)
    for s in sensors:
        start = SCIENCE_START.get(s)
        if start is not None:
            ok &= np.asarray(dates >= start)
    return ok


def select_detections(det: pd.DataFrame, spec: SeriesSpec, static_keys: np.ndarray) -> pd.DataFrame:
    sel = det[det["sensor_key"].isin(spec.sensors)]
    if spec.confidence == "excl_low":
        sel = sel[sel["confidence_class"].isin(HIGH_OR_NOMINAL)]
    elif spec.confidence != "all":
        raise ValueError(f"unknown confidence rule {spec.confidence}")
    if spec.mask == "excl3x3":
        sel = sel[~np.isin(sel["key"].to_numpy(), static_keys)]
    elif spec.mask != "core":
        raise ValueError(f"unknown mask {spec.mask}")
    return sel


def build_daily_table(sel: pd.DataFrame, calendar: pd.DataFrame, sensors) -> pd.DataFrame:
    """Per calendar day: expected, used, c(d). ``cell_days`` is NaN on unusable days."""
    missing = [s for s in sensors if s not in calendar.columns]
    if missing:
        raise KeyError(f"sensors missing from coverage calendar: {missing}")
    idx = calendar.index
    expected = expected_mask(idx, sensors)
    used = calendar[list(sensors)].all(axis=1).to_numpy() & expected
    counts = sel.drop_duplicates(["date", "key"]).groupby("date").size().reindex(idx).fillna(0)
    out = pd.DataFrame(index=idx)
    out.index.name = "date"
    out["expected"] = expected
    out["used"] = used
    out["cell_days"] = np.where(used, counts.to_numpy(dtype=float), np.nan)
    out["day_status"] = np.where(~expected, "not_expected", np.where(used, "usable", "unusable_not_zero"))
    return out


# ---------------------------------------------------------------------------
# Baseline (frozen reference)
# ---------------------------------------------------------------------------
def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def matched_month_days(daily: pd.DataFrame, years=YEARS) -> list[str]:
    """Month-days usable in every baseline year. 29 February is dropped."""
    d = daily[daily["used"] & daily.index.year.isin(years)]
    md = pd.Series(d.index.strftime("%m-%d"), index=d.index)
    frame = pd.DataFrame({"md": md.to_numpy(), "year": d.index.year})
    frame = frame[frame["md"] != "02-29"]
    n = frame.groupby("md")["year"].nunique()
    return sorted(n[n == len(years)].index.tolist())


def baseline_entry(daily: pd.DataFrame, spec: SeriesSpec, years=YEARS) -> dict:
    """B = sum of c(d) over matched dates in all years / (n_years * |M|)."""
    matched = matched_month_days(daily, years)
    d = daily[daily["used"] & daily.index.year.isin(years)]
    d = d[pd.Series(d.index.strftime("%m-%d"), index=d.index).isin(matched).to_numpy()]
    per_year = {int(y): float(v) for y, v in d.groupby(d.index.year)["cell_days"].sum().items()}
    for y in years:
        per_year.setdefault(int(y), 0.0)
    total = float(sum(per_year.values()))
    n = len(matched)
    b = total / (len(years) * n) if n else None
    md_month = pd.Series(d.index.month, index=d.index)
    n_md_by_month = pd.Series([int(m[:2]) for m in matched]).value_counts().to_dict()
    monthly_ref, seasonal_sum, seasonal_n = {}, {}, {}
    for month in range(1, 13):
        k = n_md_by_month.get(month, 0)
        s = float(d.loc[(md_month == month).to_numpy(), "cell_days"].sum())
        monthly_ref[str(month)] = s / (len(years) * k) if k else None
        season = SEASON_BY_MONTH[month]
        seasonal_sum[season] = seasonal_sum.get(season, 0.0) + s
        seasonal_n[season] = seasonal_n.get(season, 0) + k
    seasonal_ref = {k: (seasonal_sum[k] / (len(years) * seasonal_n[k]) if seasonal_n[k] else None) for k in seasonal_sum}
    return {
        "series_id": spec.series_id,
        "role": spec.role,
        "sensors": list(spec.sensors),
        "mask": spec.mask,
        "confidence_rule": spec.confidence,
        "n_matched_days": n,
        "matched_month_days": matched,
        "matched_month_days_sha256": sha256_text("\n".join(matched)),
        "per_year_total_cell_days": {str(k): v for k, v in sorted(per_year.items())},
        "total_cell_days": total,
        "B": b,
        "monthly_reference": monthly_ref,
        "seasonal_reference": seasonal_ref,
    }


_FP_HARMONIZED_COLUMNS = ["sensor_key", "acquisition_date", "grid_cell_id", "hotspot_type", "confidence_class", "daynight"]
_FP_COVERAGE_COLUMNS = ["sensor_key", "acquisition_date", "n_records", "coverage_status"]


def _canonical_cell(value):
    """Version-independent text for one cell; missing values become None.

    pandas renders missing values differently by version and dtype (an empty
    field, "nan", "<NA>" or "None"), so nothing here relies on pandas string
    conversion. Integral numbers are written as integers whatever their dtype.
    """
    if value is None or value is pd.NA or value is pd.NaT or (isinstance(value, float) and value != value):
        return None
    if isinstance(value, (bool, np.bool_)):
        return str(bool(value))
    if isinstance(value, (int, np.integer)):
        return str(int(value))
    if isinstance(value, (float, np.floating)):
        return str(int(value)) if float(value).is_integer() else repr(float(value))
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.strftime("%Y-%m-%d")
    return str(value)


def _canonical_csv_text(frame: pd.DataFrame, columns: list[str], years) -> tuple[str, int]:
    """Deterministic CSV text of the baseline-year rows of ``frame[columns]``.

    Rows are filtered on the year in ``acquisition_date`` and sorted by the
    column values as text (missing last, per column). Missing cells are written
    as empty fields, which is the convention the frozen baselines were created
    with. Only the standard-library ``csv`` writer produces the text ("\n" line
    endings, minimal quoting), so the result does not depend on pandas'
    ``to_csv``, dtype backend or version.
    """
    cells = [[_canonical_cell(v) for v in frame[col].astype(object).tolist()] for col in columns]
    date_idx = columns.index("acquisition_date")
    year_set = {int(y) for y in years}
    rows = [r for r in zip(*cells) if r[date_idx] is not None and int(r[date_idx][:4]) in year_set]
    rows.sort(key=lambda r: tuple((v is None, v or "") for v in r))
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(columns)
    writer.writerows(["" if v is None else v for v in r] for r in rows)
    return buffer.getvalue(), len(rows)


def input_fingerprint(harmonized: pd.DataFrame, coverage: pd.DataFrame, years=YEARS) -> dict:
    """Content hash of the baseline-year slice of the Phase 3 inputs.

    Only 2023-2025 rows are hashed, so appending later years does not change it,
    while any change to the baseline-period data does. Serialization is
    independent of the pandas version (see ``_canonical_csv_text``) and yields
    exactly the hashes stored in baseline v1.
    """
    h_text, h_rows = _canonical_csv_text(harmonized, _FP_HARMONIZED_COLUMNS, years)
    c_text, c_rows = _canonical_csv_text(coverage, _FP_COVERAGE_COLUMNS, years)
    return {
        "harmonized_baseline_years_sha256": sha256_text(h_text),
        "harmonized_baseline_years_rows": int(h_rows),
        "coverage_baseline_years_sha256": sha256_text(c_text),
        "coverage_baseline_years_rows": int(c_rows),
    }


def block_baseline_table(sel_head: pd.DataFrame, daily_head: pd.DataFrame, matched: list[str], years=YEARS) -> pd.DataFrame:
    """Per 1-degree block: reference B_b over the matched dates and eligibility."""
    used = daily_head[daily_head["used"] & daily_head.index.year.isin(years)]
    md = pd.Series(used.index.strftime("%m-%d"), index=used.index)
    dates = used.index[md.isin(matched).to_numpy()]
    cells = sel_head.drop_duplicates(["date", "key"])
    cells = cells[cells["date"].isin(dates)]
    totals = cells.groupby("block_id").size()
    out = totals.rename("baseline_cell_days").reset_index()
    denom = len(years) * len(matched)
    out["B_block"] = out["baseline_cell_days"] / denom if denom else np.nan
    out["eligible"] = out["baseline_cell_days"] >= BLOCK_MIN_BASELINE_CELL_DAYS
    return out.sort_values("block_id").reset_index(drop=True)


def create_baseline(harmonized: pd.DataFrame, coverage: pd.DataFrame, version: str, years=YEARS, file_hashes: dict | None = None) -> dict:
    """Compute and return a new baseline dictionary (caller writes it to disk)."""
    det = prepare_type0_viirs(harmonized)
    static = prepare_static_viirs(harmonized)
    mask_ids = static_cell_ids(static, years)
    keys = static_mask_keys(mask_ids)
    calendar = build_calendar(coverage)
    entries, head_daily, head_sel = {}, None, None
    for spec in SERIES_SPECS:
        sel = select_detections(det, spec, keys)
        daily = build_daily_table(sel, calendar, spec.sensors)
        entries[spec.series_id] = baseline_entry(daily, spec, years)
        if spec.series_id == HEADLINE_ID:
            head_daily, head_sel = daily, sel
    blocks = block_baseline_table(head_sel, head_daily, entries[HEADLINE_ID]["matched_month_days"], years)
    return {
        "baseline_version": version,
        "created_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "baseline_years": list(years),
        "grid_size_deg": GRID_SIZE_DEG,
        "note": "Frozen reference. Index runs read this file and never recompute it.",
        "static_mask": {
            "definition": "cells in or adjacent (3x3) to any VIIRS type-2 cell seen in any baseline year",
            "n_static_cells": len(mask_ids),
            "cell_ids": mask_ids,
            "cell_ids_sha256": sha256_text("\n".join(mask_ids)),
        },
        "input_fingerprint": input_fingerprint(harmonized, coverage, years),
        "input_file_sha256_at_freeze": file_hashes or {},
        "series": entries,
        "blocks": {
            "series_id": HEADLINE_ID,
            "min_baseline_cell_days": BLOCK_MIN_BASELINE_CELL_DAYS,
            "table": blocks.to_dict(orient="records"),
        },
    }


def save_baseline(baseline: dict, directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / BASELINE_FILE_TEMPLATE.format(version=baseline["baseline_version"])
    if path.exists():
        raise FileExistsError(f"{path.name} already exists; a new baseline needs a new version id")
    path.write_text(json.dumps(baseline, indent=2, sort_keys=True), encoding="utf-8")
    return path


def list_baseline_versions(directory: Path) -> list[str]:
    found = sorted(directory.glob("baseline_v*.json"), key=lambda p: int(p.stem.split("_v")[-1]))
    return [p.stem.replace("baseline_", "") for p in found]


def next_baseline_version(directory: Path) -> str:
    versions = list_baseline_versions(directory)
    return f"v{int(versions[-1][1:]) + 1}" if versions else "v1"


def load_baseline(directory: Path, version: str | None = None) -> dict:
    version = version or (list_baseline_versions(directory) or [None])[-1]
    if version is None:
        raise FileNotFoundError("No frozen baseline found. Run `python main.py phase5 --new-baseline` once.")
    path = directory / BASELINE_FILE_TEMPLATE.format(version=version)
    if not path.is_file():
        raise FileNotFoundError(f"Baseline file not found: {path}")
    baseline = json.loads(path.read_text(encoding="utf-8"))
    for sid, entry in baseline["series"].items():  # internal integrity of the frozen file
        if sha256_text("\n".join(entry["matched_month_days"])) != entry["matched_month_days_sha256"]:
            raise BaselineMismatchError(f"matched-date hash mismatch inside baseline for {sid}")
    mask = baseline["static_mask"]
    if sha256_text("\n".join(mask["cell_ids"])) != mask["cell_ids_sha256"]:
        raise BaselineMismatchError("static mask hash mismatch inside baseline")
    return baseline


def verify_baseline_input_files(baseline: dict, input_files: dict[str, Path]) -> None:
    """Check the raw input files against the SHA-256 values stored at the freeze.

    ``input_files`` maps file name to path. Names the baseline stored no hash
    for are skipped; a stored hash that does not match raises.
    """
    stored = baseline.get("input_file_sha256_at_freeze") or {}
    for name, path in input_files.items():
        expected = stored.get(name)
        if expected is None:
            continue
        actual = sha256_file(Path(path))
        if actual != expected:
            raise BaselineMismatchError(
                f"Raw input file {name} changed since baseline {baseline['baseline_version']} was frozen "
                f"(sha256 {actual} != stored {expected}). Create a new baseline version explicitly with --new-baseline."
            )


def verify_baseline_inputs(
    baseline: dict,
    harmonized: pd.DataFrame,
    coverage: pd.DataFrame,
    input_files: dict[str, Path] | None = None,
) -> None:
    """Stop the run if the baseline-year Phase 3 data changed since the freeze.

    Two independent checks: the raw files' SHA-256 (when ``input_files`` is given)
    and the content fingerprint of the baseline-year slice.
    """
    if input_files:
        verify_baseline_input_files(baseline, input_files)
    now = input_fingerprint(harmonized, coverage, tuple(baseline["baseline_years"]))
    for key, value in baseline["input_fingerprint"].items():
        if now[key] != value:
            raise BaselineMismatchError(
                f"Phase 3 input changed since baseline {baseline['baseline_version']} was frozen ({key}). "
                "Create a new baseline version explicitly with --new-baseline."
            )


# ---------------------------------------------------------------------------
# Periods, quality, FAI
# ---------------------------------------------------------------------------
def period_labels(dates: pd.DatetimeIndex, period_type: str) -> pd.Series:
    if period_type == "year":
        lab = dates.year.astype(str)
    elif period_type == "month":
        lab = [f"{y}-{m:02d}" for y, m in zip(dates.year, dates.month)]
    elif period_type == "season":
        sy = season_year_of(dates.year, dates.month)
        lab = [f"{y}-{SEASON_BY_MONTH[m]}" for y, m in zip(sy, dates.month)]
    else:
        raise ValueError(period_type)
    return pd.Series(lab, index=dates, dtype=str)


def full_period_days(period_type: str, label: str) -> int:
    if period_type == "year":
        return int(pd.Timestamp(f"{label}-12-31").dayofyear)
    if period_type == "month":
        return int(pd.Period(label, "M").days_in_month)
    year, season = label.split("-")
    return season_expected_days(season, int(year))


def quality_label(expected: int, usable: int, complete: bool, period_type: str) -> tuple[str, str]:
    """Approved rules: kappa 0.8 / 0.5, 15 usable days per month, not_expected."""
    if expected == 0:
        return "not_expected", "before_science_start"
    if not complete:
        return "insufficient_coverage", "incomplete_period_window"
    kappa = usable / expected
    if kappa < KAPPA_MIN_PUBLISHED:
        return "insufficient_coverage", "kappa_below_0.5"
    if period_type == "month" and usable < MIN_USABLE_DAYS_MONTH:
        return "insufficient_coverage", "fewer_than_15_usable_days"
    if kappa < KAPPA_RELIABLE:
        return "partial_coverage", ""
    return "reliable", ""


def fai_value(r: float, b: float | None) -> float:
    """FAI = 100 * r / B. NaN when r or B is missing or B is not positive."""
    if b is None or pd.isna(b) or b <= 0 or pd.isna(r):
        return np.nan
    return 100.0 * r / b


def compute_period_table(daily: pd.DataFrame, period_type: str, entry: dict, version: str) -> pd.DataFrame:
    d = daily.copy()
    d["period"] = period_labels(d.index, period_type).to_numpy()
    rows = []
    b = entry["B"]
    for label, g in d.groupby("period", sort=True):
        expected, usable = int(g["expected"].sum()), int(g["used"].sum())
        total = float(g["cell_days"].sum())
        r = total / usable if usable else np.nan
        complete = len(g) == full_period_days(period_type, label)
        q, reason = quality_label(expected, usable, complete, period_type)
        published = q in ("reliable", "partial_coverage") and usable > 0
        fai = fai_value(r, b) if published else np.nan
        year = int(label.split("-")[0])
        month = int(label.split("-")[1]) if period_type == "month" else np.nan
        season = label.split("-")[1] if period_type == "season" else ""
        ref = None
        if period_type == "month":
            ref = entry["monthly_reference"].get(str(int(month)))
        elif period_type == "season":
            ref = entry["seasonal_reference"].get(season)
        rows.append(
            {
                "series_id": entry["series_id"],
                "role": entry["role"],
                "period_type": period_type,
                "period": label,
                "year": year,
                "month": month,
                "season": season,
                "period_start": g.index.min().strftime("%Y-%m-%d"),
                "period_end": g.index.max().strftime("%Y-%m-%d"),
                "calendar_days_in_window": int(len(g)),
                "expected_days": expected,
                "usable_days": usable,
                "unusable_days": expected - usable,
                "cell_days_on_usable_days": total,
                "r_cell_days_per_usable_day": r,
                "baseline_B": b,
                "FAI": fai,
                "FAI_sa": fai_value(r, ref) if (published and period_type in ("month", "season")) else np.nan,
                "kappa": usable / expected if expected else np.nan,
                "quality_label": q,
                "na_reason": reason,
                "period_complete": complete,
                "baseline_version": version,
                "coverage_basis": COVERAGE_BASIS_NATIONAL,
            }
        )
    return pd.DataFrame(rows)


def compute_daily_fai(daily: pd.DataFrame, entry: dict, version: str) -> pd.DataFrame:
    out = daily.reset_index()
    out.insert(0, "series_id", entry["series_id"])
    out.insert(1, "role", entry["role"])
    out["FAI_daily"] = [fai_value(c, entry["B"]) if u else np.nan for c, u in zip(out["cell_days"], out["used"])]
    out["baseline_version"] = version
    out["coverage_basis"] = COVERAGE_BASIS_NATIONAL
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    return out


# ---------------------------------------------------------------------------
# Derived products
# ---------------------------------------------------------------------------
def static_exposure(core: pd.DataFrame, excl: pd.DataFrame, entry_core: dict, entry_excl: dict) -> pd.DataFrame:
    """sigma(P) = 1 - sum(c_excl3x3)/sum(c_core) over the usable days of P (period totals).

    NA when the core denominator is zero. R(P) = FAI_excl / FAI_core.
    """
    keys = ["period_type", "period"]
    m = core[keys + ["year", "usable_days", "expected_days", "kappa", "quality_label", "cell_days_on_usable_days", "FAI"]].merge(
        excl[keys + ["cell_days_on_usable_days", "FAI", "usable_days"]], on=keys, suffixes=("_core", "_excl3x3")
    )
    if not (m["usable_days_core"] == m["usable_days_excl3x3"]).all():
        raise ValueError("core and excl3x3 must use the same usable days")
    sum_core, sum_excl = m["cell_days_on_usable_days_core"], m["cell_days_on_usable_days_excl3x3"]
    m["sigma_P"] = np.where(sum_core > 0, 1.0 - sum_excl / sum_core.where(sum_core > 0, 1), np.nan)
    tc, te = entry_core["total_cell_days"], entry_excl["total_cell_days"]
    sigma_b = 1.0 - te / tc if tc > 0 else np.nan
    m["sigma_B"] = sigma_b
    m["R_P"] = np.where(m["FAI_core"].notna() & (m["FAI_core"] > 0), m["FAI_excl3x3"] / m["FAI_core"].where(m["FAI_core"] > 0, 1), np.nan)
    m["R_identity_check"] = (1.0 - m["sigma_P"]) / (1.0 - sigma_b) if sigma_b == sigma_b and sigma_b < 1 else np.nan
    # Period totals are only meaningful where the headline index itself is published.
    unpublished = m["FAI_core"].isna()
    m.loc[unpublished, ["sigma_P", "R_P", "R_identity_check"]] = np.nan
    m = m.rename(columns={"usable_days_core": "usable_days"}).drop(columns=["usable_days_excl3x3"])
    m["coverage_basis"] = COVERAGE_BASIS_NATIONAL
    return m


def confidence_sensitivity(all_conf: pd.DataFrame, excl_low: pd.DataFrame) -> pd.DataFrame:
    keys = ["period_type", "period"]
    m = all_conf[keys + ["year", "quality_label", "cell_days_on_usable_days", "FAI"]].merge(
        excl_low[keys + ["cell_days_on_usable_days", "FAI"]], on=keys, suffixes=("_all", "_excl_low")
    )
    m["FAI_difference_excl_low_minus_all"] = m["FAI_excl_low"] - m["FAI_all"]
    s_all, s_low = m["cell_days_on_usable_days_all"], m["cell_days_on_usable_days_excl_low"]
    m["low_confidence_only_cell_day_share"] = np.where(s_all > 0, 1.0 - s_low / s_all.where(s_all > 0, 1), np.nan)
    return m


def inter_sensor_spread(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Range of single-sensor FAI, sensors with kappa >= 0.5 and a published value.

    This is a descriptive sensitivity to which VIIRS sensor is used. It is not a
    confidence interval or uncertainty estimate.
    """
    rows = []
    for ptype in PERIOD_TYPES:
        frames = []
        for sensor, sid in SINGLE_SENSOR_IDS.items():
            t = tables[sid]
            t = t[t["period_type"] == ptype][["period", "year", "FAI", "kappa", "quality_label"]].copy()
            t["sensor"] = sensor
            frames.append(t)
        allt = pd.concat(frames)
        for period, g in allt.groupby("period", sort=True):
            ok = g[(g["kappa"] >= KAPPA_MIN_PUBLISHED) & g["FAI"].notna()]
            row = {"period_type": ptype, "period": period, "year": int(g["year"].iloc[0])}
            for sensor in SINGLE_SENSOR_IDS:
                v = g.loc[g["sensor"] == sensor, "FAI"]
                row[f"FAI_{sensor}"] = float(v.iloc[0]) if len(v) and pd.notna(v.iloc[0]) else np.nan
            row["n_sensors_in_spread"] = int(len(ok))
            row["inter_sensor_index_spread"] = float(ok["FAI"].max() - ok["FAI"].min()) if len(ok) >= 2 else np.nan
            row["spread_note"] = "range of single-sensor indices (own baselines, own usable days); not a confidence interval"
            rows.append(row)
    return pd.DataFrame(rows)


def build_block_tables(
    sel_head: pd.DataFrame,
    daily_head: pd.DataFrame,
    national_periods: dict[str, pd.DataFrame],
    baseline: dict,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Block seasonal/yearly FAI on the NATIONAL usable-day calendar.

    Returns (block_periods, eligibility, partition_check_by_day). Output is sorted
    by block id and period. Blocks are never ranked by FAI.
    """
    version = baseline["baseline_version"]
    btable = pd.DataFrame(baseline["blocks"]["table"])
    eligible_ids = set(btable.loc[btable["eligible"], "block_id"])
    b_map = dict(zip(btable["block_id"], btable["B_block"]))
    used_dates = daily_head.index[daily_head["used"]]
    cells = sel_head.drop_duplicates(["date", "key"])
    cells = cells[cells["date"].isin(used_dates)]
    counts = cells.groupby(["block_id", "date"]).size().unstack(fill_value=0).reindex(columns=used_dates, fill_value=0)
    national_c = daily_head.loc[used_dates, "cell_days"]
    partition = pd.DataFrame({"national_c": national_c.to_numpy(), "sum_blocks_c": counts.sum(axis=0).to_numpy()}, index=used_dates)
    coords = cells.drop_duplicates("block_id").set_index("block_id")[["block_lat_min", "block_lon_min"]]

    rows = []
    for ptype in ("season", "year"):
        labels = period_labels(used_dates, ptype)
        nat = national_periods[ptype].set_index("period")
        for period, dates in labels.groupby(labels):
            idx = dates.index
            nrow = nat.loc[period]
            nat_total = float(national_c.loc[idx].sum())
            for block in sorted(eligible_ids & set(counts.index)):
                tot = float(counts.loc[block, idx].sum())
                u = int(len(idx))
                r = tot / u if u else np.nan
                fai = fai_value(r, b_map.get(block)) if nrow["FAI"] == nrow["FAI"] else np.nan
                rows.append(
                    {
                        "block_id": block,
                        "block_lat_min": float(coords.loc[block, "block_lat_min"]),
                        "block_lon_min": float(coords.loc[block, "block_lon_min"]),
                        "period_type": ptype,
                        "period": period,
                        "year": int(period.split("-")[0]),
                        "usable_days": u,
                        "cell_days_on_usable_days": tot,
                        "r_block_cell_days_per_national_usable_day": r,
                        "baseline_B_block": b_map.get(block),
                        "FAI_block": fai,
                        "block_share_of_national_cell_days": tot / nat_total if nat_total > 0 else np.nan,
                        "kappa_national": nrow["kappa"],
                        "quality_label": nrow["quality_label"],
                        "na_reason": nrow["na_reason"],
                        "coverage_basis": COVERAGE_BASIS_BLOCK,
                        "locally_coverage_normalized": False,
                        "comparable_between_blocks": False,
                        "baseline_version": version,
                    }
                )
    out = pd.DataFrame(rows).sort_values(["block_id", "period_type", "period"]).reset_index(drop=True)
    elig = btable.copy()
    elig["min_baseline_cell_days"] = baseline["blocks"]["min_baseline_cell_days"]
    elig["baseline_version"] = version
    return out, elig, partition


def cell_active_day_frequency(sel_head: pd.DataFrame, daily_head: pd.DataFrame, years=YEARS) -> pd.DataFrame:
    """Active-day frequency per cell: active usable days / national usable days. Not indexed."""
    used = daily_head[daily_head["used"]]
    usable_total = int(len(used[used.index.year.isin(years)]))
    cd = sel_head.drop_duplicates(["date", "key"])
    cd = cd[cd["date"].isin(used.index) & cd["year"].isin(years)]
    out = cd.groupby("grid_cell_id").agg(
        grid_cell_lat=("grid_cell_lat", "first"), grid_cell_lon=("grid_cell_lon", "first"), block_id=("block_id", "first"),
        active_usable_days=("date", "size"),
    )
    out["national_usable_days"] = usable_total
    out["active_day_frequency"] = out["active_usable_days"] / usable_total if usable_total else np.nan
    for y in years:
        uy = int((used.index.year == y).sum())
        ay = cd[cd["year"] == y].groupby("grid_cell_id").size()
        out[f"active_usable_days_{y}"] = ay.reindex(out.index).fillna(0).astype(int)
        out[f"national_usable_days_{y}"] = uy
        out[f"active_day_frequency_{y}"] = out[f"active_usable_days_{y}"] / uy if uy else np.nan
    out["coverage_basis"] = COVERAGE_BASIS_NATIONAL
    return out.reset_index().sort_values("grid_cell_id").reset_index(drop=True)


def low_confidence_share(det: pd.DataFrame) -> pd.DataFrame:
    g = det.groupby(["sensor_key", "year"]).agg(
        n_type0_detections=("key", "size"), n_low=("confidence_class", lambda s: int((s == "l").sum()))
    ).reset_index()
    g["low_confidence_share"] = g["n_low"] / g["n_type0_detections"]
    return g


def daynight_diagnostic(sel_head: pd.DataFrame, entry: dict, daily_head: pd.DataFrame, years=YEARS) -> pd.DataFrame:
    """Diagnostic only: headline cell-days on matched dates split by day/night flag.

    A cell-day seen in both a day and a night overpass counts in both columns.
    """
    matched = set(entry["matched_month_days"])
    used = daily_head[daily_head["used"]]
    dates = used.index[pd.Series(used.index.strftime("%m-%d"), index=used.index).isin(matched).to_numpy() & used.index.year.isin(years)]
    s = sel_head[sel_head["date"].isin(dates)]
    flags = s.groupby(["date", "key"])["daynight"].agg(has_day=lambda x: (x == "D").any(), has_night=lambda x: (x == "N").any()).reset_index()
    flags["year"] = flags["date"].dt.year
    rows = []
    for y in years:
        f = flags[flags["year"] == y]
        n_days = int((dates.year == y).sum())
        rows.append(
            {
                "year": y, "n_matched_days": n_days,
                "mean_cells_with_day_detection": float(f["has_day"].sum() / n_days) if n_days else np.nan,
                "mean_cells_with_night_detection": float(f["has_night"].sum() / n_days) if n_days else np.nan,
                "mean_cell_days_union": float(len(f) / n_days) if n_days else np.nan,
            }
        )
    out = pd.DataFrame(rows)
    for col in ("mean_cells_with_day_detection", "mean_cells_with_night_detection"):
        first = out[col].iloc[0]
        out[f"{col}_pct_change_vs_first_year"] = (out[col] / first - 1.0) * 100.0 if first else np.nan
    return out


def static_probe_diagnostic(static: pd.DataFrame, calendar: pd.DataFrame, sensors=("NOAA20", "SNPP"), years=YEARS) -> pd.DataFrame:
    """Diagnostic only, never fed into the index.

    Probe = VIIRS static cell detected on at least half of the sensor's observed days.
    Reports how many probes exist and how many are seen per observed day.
    """
    rows = []
    for sensor in sensors:
        observed = calendar.index[calendar[sensor] & calendar.index.year.isin(years)]
        sd = static[(static["sensor_key"] == sensor) & static["date"].isin(observed)].drop_duplicates(["date", "key"])
        n_obs = len(observed)
        freq = sd.groupby("key").size() / n_obs if n_obs else pd.Series(dtype=float)
        probes = freq[freq >= 0.5].index
        row = {"sensor_key": sensor, "observed_days": n_obs, "n_static_cells_detected": int(len(freq)),
               "n_probes_ge_50pct_days": int(len(probes)), "n_probes_ge_80pct_days": int((freq >= 0.8).sum())}
        if len(probes):
            seen = sd[sd["key"].isin(probes)].groupby("date").size().reindex(observed).fillna(0) / len(probes)
            row.update({"mean_share_probes_seen_per_day": float(seen.mean()), "days_share_below_0.5": int((seen < 0.5).sum())})
        else:
            row.update({"mean_share_probes_seen_per_day": np.nan, "days_share_below_0.5": 0})
        row["use"] = "diagnostic only; not part of the index"
        rows.append(row)
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def compute_index(harmonized: pd.DataFrame, coverage: pd.DataFrame, baseline: dict) -> dict[str, pd.DataFrame]:
    """Compute every Phase 5 table from the Phase 3 data and a FROZEN baseline."""
    version = baseline["baseline_version"]
    years = tuple(baseline["baseline_years"])
    det = prepare_type0_viirs(harmonized)
    static = prepare_static_viirs(harmonized)
    keys = static_mask_keys(baseline["static_mask"]["cell_ids"])
    calendar = build_calendar(coverage)

    dailies, sels, daily_tables = {}, {}, {}
    period_tables: dict[str, dict[str, pd.DataFrame]] = {p: {} for p in PERIOD_TYPES}
    catalog = []
    for spec in SERIES_SPECS:
        entry = baseline["series"][spec.series_id]
        sel = select_detections(det, spec, keys)
        daily = build_daily_table(sel, calendar, spec.sensors)
        sels[spec.series_id], dailies[spec.series_id] = sel, daily
        daily_tables[spec.series_id] = compute_daily_fai(daily, entry, version)
        for p in PERIOD_TYPES:
            period_tables[p][spec.series_id] = compute_period_table(daily, p, entry, version)
        y = entry["per_year_total_cell_days"]
        catalog.append(
            {
                "series_id": spec.series_id, "role": spec.role, "sensors": "+".join(spec.sensors), "mask": spec.mask,
                "confidence_rule": spec.confidence, "n_matched_days": entry["n_matched_days"],
                "baseline_total_cell_days": entry["total_cell_days"], "baseline_B": entry["B"],
                **{f"matched_total_{k}": v for k, v in y.items()}, "baseline_version": version,
                "coverage_basis": COVERAGE_BASIS_NATIONAL,
            }
        )

    by_series = {sid: pd.concat([period_tables[p][sid] for p in PERIOD_TYPES], ignore_index=True) for sid in SPEC_BY_ID}
    def stack(p):
        return pd.concat(period_tables[p].values(), ignore_index=True)

    head, excl, low = HEADLINE_ID, "N20_SNPP_excl3x3_all", "N20_SNPP_core_excl_low"
    exposure = pd.concat(
        [static_exposure(period_tables[p][head], period_tables[p][excl], baseline["series"][head], baseline["series"][excl]) for p in PERIOD_TYPES],
        ignore_index=True,
    )
    conf = pd.concat([confidence_sensitivity(period_tables[p][head], period_tables[p][low]) for p in PERIOD_TYPES], ignore_index=True)
    spread = inter_sensor_spread(by_series)
    nat_for_blocks = {p: period_tables[p][head] for p in ("season", "year")}
    block_periods, block_elig, partition = build_block_tables(sels[head], dailies[head], nat_for_blocks, baseline)

    # Baseline validation: annual index on the matched dates (mean must be 100 by construction).
    val_rows = []
    for sid, e in baseline["series"].items():
        n, b = e["n_matched_days"], e["B"]
        for y, tot in e["per_year_total_cell_days"].items():
            val_rows.append(
                {"series_id": sid, "year": int(y), "n_matched_days": n, "total_cell_days": tot,
                 "mean_cell_days_per_matched_day": tot / n if n else np.nan, "baseline_B": b,
                 "FAI_on_matched_dates": fai_value(tot / n, b) if n else np.nan}
            )
    validation = pd.DataFrame(val_rows)
    validation["mean_of_annual_FAI_on_matched_dates"] = validation.groupby("series_id")["FAI_on_matched_dates"].transform("mean")

    return {
        "series_catalog": pd.DataFrame(catalog),
        "fai_daily": pd.concat(daily_tables.values(), ignore_index=True),
        "fai_monthly": stack("month"),
        "fai_seasonal": stack("season"),
        "fai_yearly": stack("year"),
        "static_exposure": exposure,
        "confidence_sensitivity": conf,
        "inter_sensor_spread": spread,
        "block_fai": block_periods,
        "block_eligibility": block_elig,
        "cell_active_day_frequency": cell_active_day_frequency(sels[head], dailies[head], years),
        "baseline_validation": validation,
        "low_confidence_share_by_sensor_year": low_confidence_share(det),
        "daynight_diagnostic": daynight_diagnostic(sels[head], baseline["series"][head], dailies[head], years),
        "static_probe_diagnostic": static_probe_diagnostic(static, calendar, years=years),
        "_partition": partition,  # internal, used by checks; not written
        "_det": det,
        "_keys": pd.DataFrame({"key": keys}),
        "_calendar": calendar,
    }
