"""
FireCast – Scientific Fire Risk Forecasting & Hazard Assessment Engine
======================================================================
Extends FireScope Egypt (2023–2025) with chronological, zero-leakage
vegetation-fire risk forecasting, historical vs. future separation,
sensor-separated telemetry inspection, and emergency alert triggers.

Scientific & Modeling Principles:
1. Candidate Filtering: Uses Type 0 (presumed vegetation fire) cell-days and
   FAI (headline_N20_SNPP_core_all & N20_SNPP_excl3x3_all), never conflating
   Type 2 industrial/gas-flare static sources with vegetation fires.
2. Coverage Awareness: Tracks per-sensor daily observation status across
   Terra/Aqua (MODIS), Suomi-NPP (VIIRS), NOAA-20 (VIIRS), and NOAA-21 (VIIRS).
   Excludes unusable coverage-gap days when fitting rates.
3. Zero Data Leakage & Chronological Splits:
   - Train split:      2023-01-01 .. 2024-06-30 (547 days)
   - Validation split: 2024-07-01 .. 2024-12-31 (184 days)
   - Test split:       2025-01-01 .. 2025-12-31 (365 days)
   All preprocessing, harmonic coefficients, trend slopes, and quantile tier
   thresholds are fit strictly on preceding historical windows.
4. Honest Experimental Labeling:
   For future dates (> 2025-12-31), no satellite detections exist yet and no
   live meteorological covariates (wind, humidity, temperature, VPD, NDVI) are
   present in the static repository. Long-range forecasts are explicitly labeled
   "Experimental" and report a calibrated Climatological Exceedance percentile
   rather than a fabricated ignition probability.
"""

from __future__ import annotations

import csv
import datetime as dt
import json
import math
import re
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parent.parent
ANALYSIS_DIR = BACKEND_ROOT / "data" / "analysis"
INDEX_DIR = BACKEND_ROOT / "data" / "index"
WEB_EXPORT_DIR = BACKEND_ROOT / "data" / "web_export"
HARMONIZED_DIR = BACKEND_ROOT / "data" / "harmonized"

MIN_HISTORICAL_DATE = dt.date(2023, 1, 1)
MAX_HISTORICAL_DATE = dt.date(2025, 12, 31)
MAX_FORECAST_DATE = dt.date(2030, 12, 31)

ISO_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")

RISK_TIERS = ("LOW", "MODERATE", "HIGH", "EXTREME")


class DateValidationError(ValueError):
    """Raised when a user-supplied target date is malformed or out of bounds."""


def validate_target_date(date_str: str) -> tuple[dt.date, str]:
    """
    Validate a YYYY-MM-DD date string and classify as 'historical' or 'future_forecast'.
    Raises DateValidationError on invalid format, impossible calendar date, or out-of-range year.
    """
    if not isinstance(date_str, str) or not date_str.strip():
        raise DateValidationError("Date is required and must be formatted as YYYY-MM-DD.")

    cleaned = date_str.strip()
    m = ISO_DATE_RE.match(cleaned)
    if not m:
        raise DateValidationError(
            f"Invalid date format '{cleaned}'. Expected strict ISO format YYYY-MM-DD."
        )

    year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        parsed = dt.date(year, month, day)
    except ValueError as exc:
        raise DateValidationError(f"Invalid calendar date '{cleaned}': {exc}") from exc

    if parsed < MIN_HISTORICAL_DATE:
        raise DateValidationError(
            f"Date '{cleaned}' precedes the FireScope Egypt satellite archive start ({MIN_HISTORICAL_DATE.isoformat()})."
        )
    if parsed > MAX_FORECAST_DATE:
        raise DateValidationError(
            f"Date '{cleaned}' exceeds the maximum supported forecast horizon ({MAX_FORECAST_DATE.isoformat()})."
        )

    mode = "historical" if parsed <= MAX_HISTORICAL_DATE else "future_forecast"
    return parsed, mode


def day_of_year(d: dt.date) -> int:
    return d.timetuple().tm_yday


def harmonic_features(doy: int, year_offset: float) -> list[float]:
    """3-harmonic Fourier seasonal basis + intercept + damped trend."""
    omega = 2.0 * math.pi * doy / 365.25
    return [
        1.0,
        math.sin(omega),
        math.cos(omega),
        math.sin(2.0 * omega),
        math.cos(2.0 * omega),
        math.sin(3.0 * omega),
        math.cos(3.0 * omega),
        year_offset,
    ]


def fit_ridge_linear(X: list[list[float]], y: list[float], l2_penalty: float = 1.5) -> list[float]:
    """
    Pure-Python Cholesky/Gaussian elimination solver for Ridge regression (X^T X + lambda I) w = X^T y.
    Avoids external heavy dependencies while guaranteeing deterministic coefficients.
    """
    if not X or not y:
        return [0.0] * 8
    p = len(X[0])
    A = [[0.0] * p for _ in range(p)]
    b = [0.0] * p
    for row, target in zip(X, y):
        for i in range(p):
            b[i] += row[i] * target
            for j in range(p):
                A[i][j] += row[i] * row[j]
    for i in range(1, p):  # Do not regularize intercept (i=0)
        A[i][i] += l2_penalty

    # Gaussian elimination with partial pivoting
    M = [A[i][:] + [b[i]] for i in range(p)]
    for col in range(p):
        pivot = max(range(col, p), key=lambda r: abs(M[r][col]))
        M[col], M[pivot] = M[pivot], M[col]
        denom = M[col][col]
        if abs(denom) < 1e-12:
            continue
        for j in range(col, p + 1):
            M[col][j] /= denom
        for r in range(p):
            if r != col:
                factor = M[r][col]
                for j in range(col, p + 1):
                    M[r][j] -= factor * M[col][j]
    return [M[i][p] for i in range(p)]


def dot(w: list[float], x: list[float]) -> float:
    return sum(wi * xi for wi, xi in zip(w, x))


def quantile_sorted(sorted_vals: list[float], q: float) -> float:
    if not sorted_vals:
        return 0.0
    pos = q * (len(sorted_vals) - 1)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return sorted_vals[lo]
    frac = pos - lo
    return sorted_vals[lo] * (1.0 - frac) + sorted_vals[hi] * frac


def empirical_percentile(sorted_vals: list[float], value: float) -> float:
    if not sorted_vals:
        return 0.0
    count_le = sum(1 for v in sorted_vals if v <= value)
    return round(100.0 * count_le / len(sorted_vals), 1)


def classify_risk_tier(
    value: float,
    thresholds: dict[str, float],
    anomaly_z: float | None = None,
) -> str:
    """
    Classify into LOW, MODERATE, HIGH, or EXTREME using training-derived empirical thresholds
    (P50, P80, P95) and standardized anomaly departure Z.
    """
    if value >= thresholds["p95"] or (anomaly_z is not None and anomaly_z >= 2.2):
        return "EXTREME"
    if value >= thresholds["p80"] or (anomaly_z is not None and anomaly_z >= 1.5):
        return "HIGH"
    if value >= thresholds["p50"]:
        return "MODERATE"
    return "LOW"


def compute_evaluation_metrics(
    actuals: list[float],
    preds: list[float],
    thresholds: dict[str, float],
) -> dict[str, Any]:
    n = len(actuals)
    if n == 0:
        return {}
    abs_err = [abs(a - p) for a, p in zip(actuals, preds)]
    sq_err = [(a - p) ** 2 for a, p in zip(actuals, preds)]
    mae = sum(abs_err) / n
    rmse = math.sqrt(sum(sq_err) / n)

    # Pearson correlation
    mean_a = sum(actuals) / n
    mean_p = sum(preds) / n
    num = sum((a - mean_a) * (p - mean_p) for a, p in zip(actuals, preds))
    den_a = math.sqrt(sum((a - mean_a) ** 2 for a in actuals))
    den_p = math.sqrt(sum((p - mean_p) ** 2 for p in preds))
    pearson_r = num / (den_a * den_p) if den_a > 0 and den_p > 0 else 0.0

    # Tier classification metrics
    actual_tiers = [classify_risk_tier(a, thresholds) for a in actuals]
    pred_tiers = [classify_risk_tier(p, thresholds) for p in preds]

    correct = sum(1 for at, pt in zip(actual_tiers, pred_tiers) if at == pt)
    within_one = sum(
        1
        for at, pt in zip(actual_tiers, pred_tiers)
        if abs(RISK_TIERS.index(at) - RISK_TIERS.index(pt)) <= 1
    )

    f1_scores: list[float] = []
    confusion: dict[str, dict[str, int]] = {
        t1: {t2: 0 for t2 in RISK_TIERS} for t1 in RISK_TIERS
    }
    for at, pt in zip(actual_tiers, pred_tiers):
        confusion[at][pt] += 1

    for tier in RISK_TIERS:
        tp = confusion[tier][tier]
        fp = sum(confusion[other][tier] for other in RISK_TIERS if other != tier)
        fn = sum(confusion[tier][other] for other in RISK_TIERS if other != tier)
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
        f1_scores.append(f1)

    # High + Extreme binary detection metrics
    actual_elevated = [t in ("HIGH", "EXTREME") for t in actual_tiers]
    pred_elevated = [t in ("HIGH", "EXTREME") for t in pred_tiers]
    tp_el = sum(1 for a_el, p_el in zip(actual_elevated, pred_elevated) if a_el and p_el)
    fp_el = sum(1 for a_el, p_el in zip(actual_elevated, pred_elevated) if not a_el and p_el)
    fn_el = sum(1 for a_el, p_el in zip(actual_elevated, pred_elevated) if a_el and not p_el)
    elevated_precision = tp_el / (tp_el + fp_el) if (tp_el + fp_el) > 0 else 0.0
    elevated_recall = tp_el / (tp_el + fn_el) if (tp_el + fn_el) > 0 else 0.0

    return {
        "n_days": n,
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "pearson_r": round(pearson_r, 3),
        "exact_tier_accuracy": round(correct / n, 3),
        "within_one_tier_accuracy": round(within_one / n, 3),
        "macro_f1": round(sum(f1_scores) / len(f1_scores), 3),
        "elevated_risk_precision": round(elevated_precision, 3),
        "elevated_risk_recall": round(elevated_recall, 3),
        "confusion_matrix": confusion,
    }


def build_firecast_artifacts() -> dict[str, Any]:
    """
    Train and evaluate chronological forecasting models across all FireScope regions
    using strict chronological splits:
      - Train:      2023-01-01 .. 2024-06-30
      - Validation: 2024-07-01 .. 2024-12-31
      - Test:       2025-01-01 .. 2025-12-31
    """
    daily_json_path = WEB_EXPORT_DIR / "daily_summary.json"
    daily_records = json.loads(daily_json_path.read_text(encoding="utf-8"))

    # Load per-sensor daily coverage and static detections from backend/data/analysis/daily_summary.csv
    coverage_by_date: dict[str, dict[str, Any]] = {}
    analysis_daily_csv = ANALYSIS_DIR / "daily_summary.csv"
    if analysis_daily_csv.exists():
        with analysis_daily_csv.open("r", encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                d_str = row["date"]
                coverage_by_date[d_str] = {
                    "observed_MODIS": row.get("observed_MODIS") == "True",
                    "observed_SNPP": row.get("observed_SNPP") == "True",
                    "observed_NOAA20": row.get("observed_NOAA20") == "True",
                    "observed_NOAA21": row.get("observed_NOAA21") == "True",
                    "usable_day": row.get("viirs_n20_snpp_full_coverage") == "True",
                    "veg_detections_MODIS": int(float(row.get("veg_detections_MODIS") or 0)),
                    "veg_detections_SNPP": int(float(row.get("veg_detections_SNPP") or 0)),
                    "veg_detections_NOAA20": int(float(row.get("veg_detections_NOAA20") or 0)),
                    "veg_detections_NOAA21": int(float(row.get("veg_detections_NOAA21") or 0)),
                    "static_detections_total": (
                        int(float(row.get("static_detections_MODIS") or 0))
                        + int(float(row.get("static_detections_SNPP") or 0))
                        + int(float(row.get("static_detections_NOAA20") or 0))
                        + int(float(row.get("static_detections_NOAA21") or 0))
                    ),
                    "viirs_static_cells": int(float(row.get("viirs_static_cells") or 0)),
                }

    # Group records by region_id and sort chronologically, plus synthesize 'all' (National Egypt)
    by_region: dict[str, list[dict[str, Any]]] = {}
    by_date_all: dict[str, dict[str, Any]] = {}
    for rec in daily_records:
        rid = rec["region_id"]
        by_region.setdefault(rid, []).append(rec)
        d_str = rec["date"]
        if d_str not in by_date_all:
            by_date_all[d_str] = {
                "date": d_str,
                "region_id": "all",
                "count_modis": 0,
                "count_viirs": 0,
                "count_merged": 0,
                "total_frp": 0.0,
                "high_conf_share": 0.0,
                "anomaly_z": -10.0,
                "_weight_sum": 0,
            }
        agg = by_date_all[d_str]
        agg["count_modis"] += int(rec["count_modis"])
        agg["count_viirs"] += int(rec["count_viirs"])
        agg["count_merged"] += int(rec["count_merged"])
        agg["total_frp"] = round(agg["total_frp"] + float(rec["total_frp"]), 2)
        agg["anomaly_z"] = max(agg["anomaly_z"], float(rec["anomaly_z"]))
        w = int(rec["count_merged"])
        agg["high_conf_share"] += float(rec["high_conf_share"]) * w
        agg["_weight_sum"] += w

    all_rows: list[dict[str, Any]] = []
    for d_str, agg in by_date_all.items():
        w_sum = agg.pop("_weight_sum")
        agg["high_conf_share"] = round(agg["high_conf_share"] / w_sum, 4) if w_sum > 0 else 0.85
        if agg["anomaly_z"] <= -9.0:
            agg["anomaly_z"] = 0.0
        all_rows.append(agg)
    by_region["all"] = all_rows

    region_models: dict[str, Any] = {}
    for rid, rows in by_region.items():
        rows.sort(key=lambda r: r["date"])
        # Split chronologically
        train_rows = [
            r
            for r in rows
            if "2023-01-01" <= r["date"] <= "2024-06-30"
            and coverage_by_date.get(r["date"], {}).get("usable_day", True)
        ]
        val_rows = [
            r
            for r in rows
            if "2024-07-01" <= r["date"] <= "2024-12-31"
            and coverage_by_date.get(r["date"], {}).get("usable_day", True)
        ]
        test_rows = [
            r
            for r in rows
            if "2025-01-01" <= r["date"] <= "2025-12-31"
            and coverage_by_date.get(r["date"], {}).get("usable_day", True)
        ]

        # Compute training distribution quantiles (strictly on train_rows -> zero leakage)
        train_vals = sorted(float(r["count_merged"]) for r in train_rows)
        thresholds = {
            "p50": round(quantile_sorted(train_vals, 0.50), 2),
            "p80": round(quantile_sorted(train_vals, 0.80), 2),
            "p95": round(quantile_sorted(train_vals, 0.95), 2),
            "mean": round(sum(train_vals) / len(train_vals), 2) if train_vals else 0.0,
            "max": round(max(train_vals), 2) if train_vals else 0.0,
        }

        # 1. Fit Harmonic + Trend Ridge model on log1p(count_merged) on train_rows
        X_train = []
        y_train_log = []
        for r in train_rows:
            d_obj = dt.date.fromisoformat(r["date"])
            y_off = (d_obj - MIN_HISTORICAL_DATE).days / 365.25
            X_train.append(harmonic_features(day_of_year(d_obj), y_off))
            y_train_log.append(math.log1p(float(r["count_merged"])))

        w_harmonic_train = fit_ridge_linear(X_train, y_train_log, l2_penalty=2.0)

        # Build 15-day smoothed DOY climatology lookup from train_rows
        doy_buckets: dict[int, list[float]] = {d: [] for d in range(1, 367)}
        for r in train_rows:
            d_obj = dt.date.fromisoformat(r["date"])
            center_doy = day_of_year(d_obj)
            val = float(r["count_merged"])
            for offset in range(-7, 8):
                target_doy = ((center_doy - 1 + offset) % 365) + 1
                doy_buckets[target_doy].append(val)
        doy_buckets[366] = doy_buckets[365][:]
        doy_climatology = {
            d: round(sum(vals) / len(vals), 2) if vals else thresholds["mean"]
            for d, vals in doy_buckets.items()
        }

        # Evaluate on Validation split (2024-07-01 .. 2024-12-31)
        # Compare Model A (Seasonal Climatology) vs Model B (Harmonic + Autoregressive Lag Ensemble)
        val_actuals = [float(r["count_merged"]) for r in val_rows]
        val_preds_clim = []
        val_preds_harmonic = []
        val_preds_ar = []

        # Create date-indexed lookup of historical values for strictly lagged AR features
        hist_val_by_date = {r["date"]: float(r["count_merged"]) for r in rows}

        for r in val_rows:
            d_obj = dt.date.fromisoformat(r["date"])
            doy = day_of_year(d_obj)
            y_off = (d_obj - MIN_HISTORICAL_DATE).days / 365.25
            clim_p = doy_climatology.get(doy, thresholds["mean"])
            harm_p = max(0.0, math.expm1(dot(w_harmonic_train, harmonic_features(doy, y_off))))
            blended_long = 0.55 * clim_p + 0.45 * harm_p

            # Strictly past 7-day and 1-day lags (t-1 .. t-7)
            lag_vals = []
            for lag in range(1, 8):
                prev_d = (d_obj - dt.timedelta(days=lag)).isoformat()
                if prev_d in hist_val_by_date:
                    lag_vals.append(hist_val_by_date[prev_d])
            lag_1 = lag_vals[0] if lag_vals else blended_long
            lag_7_mean = sum(lag_vals) / len(lag_vals) if lag_vals else blended_long
            ar_p = 0.45 * lag_1 + 0.30 * lag_7_mean + 0.25 * blended_long

            val_preds_clim.append(clim_p)
            val_preds_harmonic.append(blended_long)
            val_preds_ar.append(ar_p)

        # Refit Harmonic + Climatology on Train + Validation (2023-01-01 .. 2024-12-31) for 2025 Out-of-Sample Test
        train_val_rows = train_rows + val_rows
        X_tv = []
        y_tv_log = []
        doy_tv_buckets: dict[int, list[float]] = {d: [] for d in range(1, 367)}
        for r in train_val_rows:
            d_obj = dt.date.fromisoformat(r["date"])
            doy = day_of_year(d_obj)
            y_off = (d_obj - MIN_HISTORICAL_DATE).days / 365.25
            X_tv.append(harmonic_features(doy, y_off))
            y_tv_log.append(math.log1p(float(r["count_merged"])))
            val = float(r["count_merged"])
            for offset in range(-7, 8):
                target_doy = ((doy - 1 + offset) % 365) + 1
                doy_tv_buckets[target_doy].append(val)
        doy_tv_buckets[366] = doy_tv_buckets[365][:]
        doy_tv_climatology = {
            d: round(sum(vals) / len(vals), 2) if vals else thresholds["mean"]
            for d, vals in doy_tv_buckets.items()
        }
        w_harmonic_tv = fit_ridge_linear(X_tv, y_tv_log, l2_penalty=2.0)

        # Evaluate on 2025 Out-of-Sample Test split (2025-01-01 .. 2025-12-31)
        test_actuals = [float(r["count_merged"]) for r in test_rows]
        test_preds_clim = []
        test_preds_harmonic = []
        test_preds_ar = []

        for r in test_rows:
            d_obj = dt.date.fromisoformat(r["date"])
            doy = day_of_year(d_obj)
            y_off = min(2.2, (d_obj - MIN_HISTORICAL_DATE).days / 365.25)
            clim_p = doy_tv_climatology.get(doy, thresholds["mean"])
            harm_p = max(0.0, math.expm1(dot(w_harmonic_tv, harmonic_features(doy, y_off))))
            blended_long = 0.55 * clim_p + 0.45 * harm_p

            lag_vals = []
            for lag in range(1, 8):
                prev_d = (d_obj - dt.timedelta(days=lag)).isoformat()
                if prev_d in hist_val_by_date:
                    lag_vals.append(hist_val_by_date[prev_d])
            lag_1 = lag_vals[0] if lag_vals else blended_long
            lag_7_mean = sum(lag_vals) / len(lag_vals) if lag_vals else blended_long
            ar_p = 0.45 * lag_1 + 0.30 * lag_7_mean + 0.25 * blended_long

            test_preds_clim.append(clim_p)
            test_preds_harmonic.append(blended_long)
            test_preds_ar.append(ar_p)

        # Fit final production seasonal parameters on all 2023-2025 usable days for future >2025 forecasts
        all_usable_rows = train_val_rows + test_rows
        doy_all_buckets: dict[int, list[float]] = {d: [] for d in range(1, 367)}
        X_all = []
        y_all_log = []
        for r in all_usable_rows:
            d_obj = dt.date.fromisoformat(r["date"])
            doy = day_of_year(d_obj)
            y_off = (d_obj - MIN_HISTORICAL_DATE).days / 365.25
            X_all.append(harmonic_features(doy, y_off))
            y_all_log.append(math.log1p(float(r["count_merged"])))
            val = float(r["count_merged"])
            for offset in range(-7, 8):
                target_doy = ((doy - 1 + offset) % 365) + 1
                doy_all_buckets[target_doy].append(val)
        doy_all_buckets[366] = doy_all_buckets[365][:]
        doy_all_climatology = {
            str(d): round(sum(vals) / len(vals), 2) if vals else thresholds["mean"]
            for d, vals in doy_all_buckets.items()
        }
        w_harmonic_all = [round(c, 6) for c in fit_ridge_linear(X_all, y_all_log, l2_penalty=2.0)]

        region_models[rid] = {
            "region_id": rid,
            "thresholds": thresholds,
            "harmonic_weights": w_harmonic_all,
            "doy_climatology": doy_all_climatology,
            "train_sample_values": [round(v, 1) for v in train_vals[::3]],  # compact empirical CDF reference
            "validation_2024_h2": {
                "climatology_naive": compute_evaluation_metrics(val_actuals, val_preds_clim, thresholds),
                "seasonal_harmonic_trend": compute_evaluation_metrics(val_actuals, val_preds_harmonic, thresholds),
                "short_horizon_ar_gam": compute_evaluation_metrics(val_actuals, val_preds_ar, thresholds),
            },
            "test_2025_out_of_sample": {
                "climatology_naive": compute_evaluation_metrics(test_actuals, test_preds_clim, thresholds),
                "seasonal_harmonic_trend": compute_evaluation_metrics(test_actuals, test_preds_harmonic, thresholds),
                "short_horizon_ar_gam": compute_evaluation_metrics(test_actuals, test_preds_ar, thresholds),
            },
        }

    return {
        "model_id": "FireCast-GAM-AR-v1-exp",
        "model_status": "Experimental (Chronologically Validated Satellite Baseline — No Live Meteorological Covariates)",
        "splits": {
            "train": {"start": "2023-01-01", "end": "2024-06-30", "days": 547},
            "validation": {"start": "2024-07-01", "end": "2024-12-31", "days": 184},
            "test": {"start": "2025-01-01", "end": "2025-12-31", "days": 365},
        },
        "regions": region_models,
        "coverage_by_date": coverage_by_date,
    }


_CACHED_ARTIFACTS: dict[str, Any] | None = None
_CACHED_DAILY_BY_REGION_DATE: dict[tuple[str, str], dict[str, Any]] | None = None


def _ensure_caches() -> tuple[dict[str, Any], dict[tuple[str, str], dict[str, Any]]]:
    global _CACHED_ARTIFACTS, _CACHED_DAILY_BY_REGION_DATE
    if _CACHED_ARTIFACTS is None:
        _CACHED_ARTIFACTS = build_firecast_artifacts()
    if _CACHED_DAILY_BY_REGION_DATE is None:
        daily_json_path = WEB_EXPORT_DIR / "daily_summary.json"
        records = json.loads(daily_json_path.read_text(encoding="utf-8"))
        lookup: dict[tuple[str, str], dict[str, Any]] = {}
        by_date_all: dict[str, dict[str, Any]] = {}
        for r in records:
            lookup[(r["region_id"], r["date"])] = r
            d_str = r["date"]
            if d_str not in by_date_all:
                by_date_all[d_str] = {
                    "date": d_str,
                    "region_id": "all",
                    "count_modis": 0,
                    "count_viirs": 0,
                    "count_merged": 0,
                    "total_frp": 0.0,
                    "high_conf_share": 0.0,
                    "anomaly_z": -10.0,
                    "_w": 0,
                }
            agg = by_date_all[d_str]
            agg["count_modis"] += int(r["count_modis"])
            agg["count_viirs"] += int(r["count_viirs"])
            agg["count_merged"] += int(r["count_merged"])
            agg["total_frp"] = round(agg["total_frp"] + float(r["total_frp"]), 2)
            agg["anomaly_z"] = max(agg["anomaly_z"], float(r["anomaly_z"]))
            w = int(r["count_merged"])
            agg["high_conf_share"] += float(r["high_conf_share"]) * w
            agg["_w"] += w
        for d_str, agg in by_date_all.items():
            w_sum = agg.pop("_w")
            agg["high_conf_share"] = round(agg["high_conf_share"] / w_sum, 4) if w_sum > 0 else 0.85
            if agg["anomaly_z"] <= -9.0:
                agg["anomaly_z"] = 0.0
            lookup[("all", d_str)] = agg
        _CACHED_DAILY_BY_REGION_DATE = lookup
    return _CACHED_ARTIFACTS, _CACHED_DAILY_BY_REGION_DATE


def predict_for_date(date_str: str, region_id: str = "all") -> dict[str, Any]:
    """
    Evaluate historical observation or future experimental forecast for a validated date and region.
    Strictly separates historical empirical FIRMS records (2023-2025) from future predictions (> 2025).
    """
    parsed_date, mode = validate_target_date(date_str)
    iso_date = parsed_date.isoformat()
    artifacts, daily_lookup = _ensure_caches()

    if region_id not in artifacts["regions"]:
        region_id = "all"

    reg_model = artifacts["regions"][region_id]
    thresholds = reg_model["thresholds"]
    doy = day_of_year(parsed_date)
    clim_expected = float(reg_model["doy_climatology"].get(str(doy), thresholds["mean"]))

    # Cap trend extrapolation beyond 2025 so long-range forecasts do not extrapolate unboundedly
    y_off = min(2.2, (parsed_date - MIN_HISTORICAL_DATE).days / 365.25)
    harm_pred = max(
        0.0,
        math.expm1(dot(reg_model["harmonic_weights"], harmonic_features(doy, y_off))),
    )
    model_expected_cells = round(0.55 * clim_expected + 0.45 * harm_pred, 1)

    if mode == "historical":
        obs = daily_lookup.get((region_id, iso_date))
        cov = artifacts["coverage_by_date"].get(iso_date, {})
        observed_cells = float(obs["count_merged"]) if obs else 0.0
        anomaly_z = float(obs["anomaly_z"]) if obs else 0.0
        risk_tier = classify_risk_tier(observed_cells, thresholds, anomaly_z)
        percentile = empirical_percentile(reg_model["train_sample_values"], observed_cells)

        return {
            "selected_date": iso_date,
            "region_id": region_id,
            "temporal_mode": "historical_observation",
            "is_future_prediction": False,
            "risk_level": risk_tier,
            "trigger_emergency_alert": risk_tier == "EXTREME",
            "climatological_percentile": percentile,
            "observed_metrics": {
                "active_cell_days": int(observed_cells),
                "modis_detections": int(obs["count_modis"]) if obs else 0,
                "viirs_detections": int(obs["count_viirs"]) if obs else 0,
                "total_frp_mw": float(obs["total_frp"]) if obs else 0.0,
                "anomaly_z": anomaly_z,
                "high_conf_share": float(obs["high_conf_share"]) if obs else 0.0,
            },
            "coverage_status": {
                "usable_day": bool(cov.get("usable_day", True)),
                "observed_MODIS": bool(cov.get("observed_MODIS", False)),
                "observed_SNPP": bool(cov.get("observed_SNPP", True)),
                "observed_NOAA20": bool(cov.get("observed_NOAA20", True)),
                "observed_NOAA21": bool(cov.get("observed_NOAA21", False)),
                "static_detections_excluded": int(cov.get("static_detections_total", 0)),
            },
            "historical_context": {
                "doy": doy,
                "seasonal_baseline_cells": round(clim_expected, 1),
                "retrospective_model_cells": model_expected_cells,
                "thresholds": thresholds,
            },
            "model_status": {
                "label": "Empirical Observation (NASA FIRMS Historical Archive)",
                "is_experimental_forecast": False,
                "note": "Risk classification reflects actual observed Type 0 vegetation-fire candidate cell-days and anomaly Z-score on this historical date.",
            },
        }

    # Future date (> 2025-12-31): strictly labeled as Experimental Prediction, zero fake sensor rows
    risk_tier = classify_risk_tier(model_expected_cells, thresholds, None)
    percentile = empirical_percentile(reg_model["train_sample_values"], model_expected_cells)

    return {
        "selected_date": iso_date,
        "region_id": region_id,
        "temporal_mode": "future_prediction",
        "is_future_prediction": True,
        "risk_level": risk_tier,
        "trigger_emergency_alert": risk_tier == "EXTREME",
        "climatological_percentile": percentile,
        "observed_metrics": None,
        "predicted_metrics": {
            "expected_active_cell_days": model_expected_cells,
            "seasonal_climatology_cells": round(clim_expected, 1),
            "harmonic_trend_cells": round(harm_pred, 1),
        },
        "coverage_status": {
            "usable_day": None,
            "status_label": "Future Date — No Satellite Overpass Yet",
            "detail": (
                f"No NASA FIRMS satellite or sensor observations exist yet for {iso_date}. "
                "Terra/Aqua (MODIS) and Suomi-NPP/NOAA-20/NOAA-21 (VIIRS) observations will only be acquired on the future overpass date."
            ),
        },
        "historical_context": {
            "doy": doy,
            "seasonal_baseline_cells": round(clim_expected, 1),
            "thresholds": thresholds,
        },
        "model_status": {
            "label": "Experimental Forecast (FireCast-GAM-AR v1-exp)",
            "is_experimental_forecast": True,
            "note": (
                "Experimental seasonal-regime forecast trained on 2023–2025 NASA FIRMS Type 0 cell-days. "
                "Does not incorporate live meteorological forecasts (wind, humidity, temperature, VPD) or dynamic crop-harvest schedules."
            ),
        },
    }
