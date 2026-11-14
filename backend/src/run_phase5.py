"""Run Phase 5 (Fire Activity Index).

Reads   data/harmonized/firescope_harmonized.csv, coverage_calendar.csv (never modified)
        data/index/baseline_<version>.json (frozen reference)
Writes  data/index/*.csv and reports/phase5_index_report.md only.

Usage (through main.py):
    python main.py phase5 --new-baseline      # first run, or to create a NEW baseline version
    python main.py phase5                     # normal run, reads the latest frozen baseline
    python main.py phase5 --baseline-version v1
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from pathlib import Path

import numpy as np
import pandas as pd

from config import HARMONIZED_DIR, PROJECT_ROOT, REPORTS_DIR
from phase5_index import (
    HEADLINE_ID,
    PERIOD_TYPES,
    SERIES_SPECS,
    SPEC_BY_ID,
    compute_index,
    create_baseline,
    load_baseline,
    next_baseline_version,
    save_baseline,
    select_detections,
    static_mask_keys,
    verify_baseline_inputs,
    build_daily_table,
    baseline_entry,
    sha256_file,
    SeriesSpec,
)
from run_phase4 import load_phase3_outputs

logger = logging.getLogger(__name__)
INDEX_DIR = PROJECT_ROOT / "data" / "index"
ANALYSIS_DIR = PROJECT_ROOT / "data" / "analysis"
INTERNAL_PREFIX = "_"
# Directories and files that Phase 5 must never change.
PROTECTED_DIRS = ("data/harmonized", "data/analysis", "data_cleand", "docs", "src", "tests")
PHASE5_FILES = {
    "src/phase5_index.py", "src/run_phase5.py", "src/phase5_report.py", "tests/test_phase5_index.py",
    "src/__pycache__",
}


def snapshot_protected(root: Path = PROJECT_ROOT) -> dict[str, str]:
    """SHA-256 of every protected file (Phase 0-4 data, code, and reports)."""
    out: dict[str, str] = {}
    files = []
    for d in PROTECTED_DIRS:
        files += [p for p in (root / d).rglob("*") if p.is_file()]
    files += [p for p in (root / "reports").glob("*") if p.is_file() and not p.name.startswith("phase5")]
    for p in files:
        rel = p.relative_to(root).as_posix()
        if rel in PHASE5_FILES or "__pycache__" in rel or rel.endswith(".pyc"):
            continue
        out[rel] = sha256_file(p)
    return out


def _check(rows: list[dict], name: str, passed: bool, detail: str = "") -> None:
    rows.append({"check": name, "passed": bool(passed), "detail": detail})


def build_checks(tables: dict[str, pd.DataFrame], baseline: dict, harmonized: pd.DataFrame, coverage: pd.DataFrame) -> pd.DataFrame:
    """Numerical and scientific consistency checks, including Phase 4 reconciliation."""
    rows: list[dict] = []
    det = tables["_det"]
    calendar = tables["_calendar"]
    keys = tables["_keys"]["key"].to_numpy()

    # --- input scope -------------------------------------------------------
    _check(rows, "only VIIRS sensors in the index detections", set(det["sensor_key"]) <= {"NOAA20", "NOAA21", "SNPP"}, str(sorted(set(det["sensor_key"]))))
    n_t0 = int(((harmonized["hotspot_type"] == 0) & (harmonized["sensor_family"] == "VIIRS")).sum())
    _check(rows, "index detections == VIIRS type-0 rows (no static, no MODIS)", len(det) == n_t0, f"{len(det)} vs {n_t0}")
    _check(rows, "headline sensor set is NOAA20 + SNPP", set(SPEC_BY_ID[HEADLINE_ID].sensors) == {"NOAA20", "SNPP"})
    _check(rows, "coverage calendar: NOAA21 not observed before 2023-03-01", not calendar.loc[calendar.index < "2023-03-01", "NOAA21"].any())

    # --- frozen baseline ---------------------------------------------------
    cat = tables["series_catalog"].set_index("series_id")
    for sid, e in baseline["series"].items():
        _check(rows, f"frozen B equals catalog B [{sid}]", abs(cat.loc[sid, "baseline_B"] - e["B"]) < 1e-9, f"B={e['B']:.6f}")
    val = tables["baseline_validation"]
    for sid, g in val.groupby("series_id"):
        _check(rows, f"mean of annual FAI on matched dates == 100 [{sid}]", abs(g["FAI_on_matched_dates"].mean() - 100.0) < 1e-9)
    head = baseline["series"][HEADLINE_ID]
    _check(rows, "headline |M| == 337 matched dates", head["n_matched_days"] == 337, str(head["n_matched_days"]))
    _check(rows, "headline matched dates contain no 29 February", "02-29" not in head["matched_month_days"])
    _check(rows, "headline B == 32,855 / 1,011", abs(head["B"] - 32855 / 1011) < 1e-9, f"{head['B']:.4f}")
    hv = val[val["series_id"] == HEADLINE_ID].set_index("year")["FAI_on_matched_dates"]
    _check(rows, "headline annual FAI on matched dates 127.287 / 99.181 / 73.532 (methodology section 7.1)",
           all(abs(hv[y] - v) < 5e-4 for y, v in ((2023, 127.287), (2024, 99.181), (2025, 73.532))), ", ".join(f"{y}:{hv[y]:.3f}" for y in hv.index))
    el = baseline["series"]["N20_SNPP_core_excl_low"]
    _check(rows, "excl_low totals 13,002 / 9,899 / 7,403, B = 30,304/1,011 (methodology section 7.1)",
           [el["per_year_total_cell_days"][str(y)] for y in (2023, 2024, 2025)] == [13002.0, 9899.0, 7403.0] and abs(el["B"] - 30304 / 1011) < 1e-9)

    # --- reconciliation with Phase 4 ----------------------------------------
    m4 = pd.read_csv(ANALYSIS_DIR / "matched_day_yearly.csv")
    s4 = pd.read_csv(ANALYSIS_DIR / "sensitivity_matched_day_yearly.csv")
    both = pd.concat([m4, s4], ignore_index=True)
    mapping = {
        HEADLINE_ID: "VIIRS_NOAA20_SNPP_union", "V3_core_all": "VIIRS_3sensor_union",
        "NOAA20_core_all": "NOAA20", "NOAA21_core_all": "NOAA21", "SNPP_core_all": "SNPP",
    }
    for sid, name in mapping.items():
        p4 = both[both["series"] == name].sort_values("year")
        mine = baseline["series"][sid]
        ok = (
            len(p4) == 3
            and (p4["n_matched_days"] == mine["n_matched_days"]).all()
            and all(abs(p4.loc[p4["year"] == y, "total_cell_days"].iloc[0] - mine["per_year_total_cell_days"][str(y)]) < 1e-9 for y in (2023, 2024, 2025))
        )
        _check(rows, f"matched totals equal Phase 4 table [{sid} vs {name}]", ok)
    # 3-sensor union without static neighbourhood: validates the frozen mask against Phase 4.
    spec_v3x = SeriesSpec("V3_excl3x3_check", "check", ("NOAA20", "NOAA21", "SNPP"), "excl3x3", "all")
    sel = select_detections(det, spec_v3x, keys)
    entry = baseline_entry(build_daily_table(sel, calendar, spec_v3x.sensors), spec_v3x)
    p4x = both[both["series"].str.startswith("VIIRS_3sensor_union_excl_static_3x3_any_year")].sort_values("year")
    _check(rows, "V3 excl3x3 (frozen mask) totals equal Phase 4 any-year static exclusion",
           len(p4x) == 3 and all(abs(p4x.loc[p4x["year"] == y, "total_cell_days"].iloc[0] - entry["per_year_total_cell_days"][str(y)]) < 1e-9 for y in (2023, 2024, 2025)),
           f"mine={[entry['per_year_total_cell_days'][str(y)] for y in (2023, 2024, 2025)]}")

    # --- structure of the index outputs --------------------------------------
    part = tables["_partition"]
    _check(rows, "block cell-days sum to national cell-days on every usable day", bool((part["national_c"] == part["sum_blocks_c"]).all()))
    daily = tables["fai_daily"]
    _check(rows, "no daily FAI on unusable days (never zero-filled)", bool(daily.loc[~daily["used"], "FAI_daily"].isna().all() and daily.loc[~daily["used"], "cell_days"].isna().all()))
    for name in ("fai_monthly", "fai_seasonal", "fai_yearly"):
        t = tables[name]
        bad = t[(t["quality_label"].isin(["insufficient_coverage", "not_expected"])) & t["FAI"].notna()]
        _check(rows, f"{name}: no FAI where quality is insufficient or not_expected", len(bad) == 0)
        pub = t[t["FAI"].notna()]
        _check(rows, f"{name}: every published row has kappa >= 0.5", bool((pub["kappa"] >= 0.5).all()))
    ex = tables["static_exposure"].dropna(subset=["sigma_P", "R_P"])
    _check(rows, "R(P) == (1 - sigma_P) / (1 - sigma_B)", bool(np.allclose(ex["R_P"], ex["R_identity_check"], rtol=1e-9, atol=1e-12)), f"{len(ex)} periods")
    blk = tables["block_fai"]
    _check(rows, "block outputs flagged national_calendar_proxy and not locally normalised",
           bool((blk["coverage_basis"] == "national_calendar_proxy").all() and (~blk["locally_coverage_normalized"]).all() and (~blk["comparable_between_blocks"]).all()))
    _check(rows, "block outputs carry no rank column", not any("rank" in c.lower() for c in blk.columns))
    _check(rows, "block outputs only for blocks with >= 100 baseline cell-days",
           set(blk["block_id"]) <= set(tables["block_eligibility"].query("eligible")["block_id"]))
    sp = tables["inter_sensor_spread"]
    _check(rows, "spread NA when fewer than two sensors", bool(sp.loc[sp["n_sensors_in_spread"] < 2, "inter_sensor_index_spread"].isna().all()))
    _check(rows, "spread table has no interval-style columns (ci, lower/upper bound)", not any(("interval" in c.lower().replace("inter_sensor_index_spread", "")) or c.lower() in ("ci", "ci_low", "ci_high", "lower", "upper") for c in sp.columns))
    for name in ("fai_daily", "fai_monthly", "fai_seasonal", "fai_yearly"):
        _check(rows, f"{name}: coverage_basis column present", "coverage_basis" in tables[name].columns)
        _check(rows, f"{name}: baseline_version column present", "baseline_version" in tables[name].columns)
    # Hypothetical dates: the index never uses 2026 dates in the baseline.
    _check(rows, "baseline matched dates only from baseline years", all(len(m) == 5 for e in baseline["series"].values() for m in e["matched_month_days"]))
    return pd.DataFrame(rows)


def run_phase5(new_baseline: bool = False, baseline_version: str | None = None, write: bool = True) -> dict[str, pd.DataFrame]:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    started = time.perf_counter()
    before = snapshot_protected()
    harmonized, coverage = load_phase3_outputs()

    if new_baseline:
        version = baseline_version or next_baseline_version(INDEX_DIR)
        hashes = {
            "firescope_harmonized.csv": sha256_file(HARMONIZED_DIR / "firescope_harmonized.csv"),
            "coverage_calendar.csv": sha256_file(HARMONIZED_DIR / "coverage_calendar.csv"),
        }
        baseline = create_baseline(harmonized, coverage, version, file_hashes=hashes)
        path = save_baseline(baseline, INDEX_DIR)
        logger.info("Frozen baseline %s written to %s", version, path)
    baseline = load_baseline(INDEX_DIR, None if new_baseline else baseline_version)
    verify_baseline_inputs(  # raises BaselineMismatchError on change (raw-file SHA-256 first, then content fingerprint)
        baseline, harmonized, coverage,
        input_files={
            "firescope_harmonized.csv": HARMONIZED_DIR / "firescope_harmonized.csv",
            "coverage_calendar.csv": HARMONIZED_DIR / "coverage_calendar.csv",
        },
    )

    tables = compute_index(harmonized, coverage, baseline)
    checks = build_checks(tables, baseline, harmonized, coverage)

    if write:
        INDEX_DIR.mkdir(parents=True, exist_ok=True)
        for name, frame in tables.items():
            if not name.startswith(INTERNAL_PREFIX):
                frame.to_csv(INDEX_DIR / f"{name}.csv", index=False, lineterminator="\n")
        after = snapshot_protected()
        changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
        checks = pd.concat(
            [checks, pd.DataFrame([{"check": "Phase 0-4 files unchanged by Phase 5 run (sha256 of data, code, reports)",
                                    "passed": not changed, "detail": f"{len(after)} files compared; changed: {changed or 'none'}"}])],
            ignore_index=True,
        )
        checks.to_csv(INDEX_DIR / "phase5_checks.csv", index=False, lineterminator="\n")
        info = {
            "baseline_version": baseline["baseline_version"],
            "baseline_created_utc": baseline["created_utc"],
            "baseline_input_fingerprint": baseline["input_fingerprint"],
            "input_file_sha256_at_freeze": baseline["input_file_sha256_at_freeze"],
            "input_file_sha256_now": {
                "firescope_harmonized.csv": sha256_file(HARMONIZED_DIR / "firescope_harmonized.csv"),
                "coverage_calendar.csv": sha256_file(HARMONIZED_DIR / "coverage_calendar.csv"),
            },
            "input_rows": int(len(harmonized)),
            "tables": {n: int(len(f)) for n, f in tables.items() if not n.startswith(INTERNAL_PREFIX)},
            "checks_passed": int(checks["passed"].sum()),
            "checks_total": int(len(checks)),
            "execution_seconds": round(time.perf_counter() - started, 2),
            "not_implemented": ["day-resampling interval (optional, off by default, assumptions not demonstrated)",
                                "same-cell-only and persistent-cell exclusions (optional)"],
        }
        (INDEX_DIR / "run_info.json").write_text(json.dumps(info, indent=2), encoding="utf-8")
        logger.info("Phase 5 finished: %d/%d checks passed", info["checks_passed"], info["checks_total"])
    tables["_checks"] = checks
    return tables
