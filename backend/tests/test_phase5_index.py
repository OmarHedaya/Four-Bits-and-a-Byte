"""Phase 5 tests: hand-calculated fixtures, frozen-baseline protocol, and real-output checks."""

import copy
import json
import re
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from config import PROJECT_ROOT
from phase5_index import (
    HEADLINE_ID,
    SERIES_SPECS,
    BaselineMismatchError,
    SeriesSpec,
    _canonical_csv_text,
    baseline_entry,
    build_block_tables,
    build_calendar,
    build_daily_table,
    compute_index,
    compute_period_table,
    create_baseline,
    expected_mask,
    input_fingerprint,
    fai_value,
    inter_sensor_spread,
    list_baseline_versions,
    load_baseline,
    matched_month_days,
    next_baseline_version,
    prepare_type0_viirs,
    quality_label,
    save_baseline,
    select_detections,
    static_exposure,
    sha256_file,
    sha256_text,
    verify_baseline_input_files,
    verify_baseline_inputs,
)

INDEX_DIR = PROJECT_ROOT / "data" / "index"
ANALYSIS_DIR = PROJECT_ROOT / "data" / "analysis"
real_outputs = (INDEX_DIR / "run_info.json").is_file() and (ANALYSIS_DIR / "matched_day_yearly.csv").is_file()
HEAD_SPEC = SeriesSpec("t", "test", ("NOAA20", "SNPP"), "core", "all")


# ---------------------------------------------------------------------------
# Synthetic data helpers
# ---------------------------------------------------------------------------
def _hrow(date, sensor, cell, typ=0, conf="n", dn="D"):
    return {
        "sensor_key": sensor, "sensor_family": "VIIRS", "acquisition_date": date, "grid_cell_id": cell,
        "hotspot_type": typ, "is_vegetation_fire_candidate": typ == 0, "is_static_source": typ == 2,
        "confidence_class": conf, "daynight": dn,
    }


def _synthetic(last="2025-12-31"):
    rows, cov = [], []
    for d in pd.date_range("2023-01-01", last):
        ds = d.strftime("%Y-%m-%d")
        for s, off in (("NOAA20", 0), ("NOAA21", 1), ("SNPP", 2)):
            if s == "NOAA21" and d < pd.Timestamp("2023-03-01"):
                status, n = "not_expected_before_science_start", 0
            elif s == "SNPP" and d.year == 2024 and d.month == 7 and d.day <= 10:
                status, n = "documented_source_gap", 0
            else:
                status = "observed"
                cells = [(d.dayofyear + off + k) % 9 for k in range(1 + d.day % 3)]
                for k, c in enumerate(cells):
                    rows.append(_hrow(ds, s, f"G{600 + c // 3}_{600 + c % 3}", conf="l" if (k == 0 and d.day % 5 == 0) else "n", dn="D" if k % 2 == 0 else "N"))
                if d.day % 2 == 0:
                    rows.append(_hrow(ds, s, "G600_600", typ=2))
                n = len(cells)
            cov.append({"sensor_key": s, "acquisition_date": ds, "n_records": n, "coverage_status": status})
    return pd.DataFrame(rows), pd.DataFrame(cov)


def _daily(dates, used, cell_days, sensors=("NOAA20", "SNPP")):
    idx = pd.DatetimeIndex(dates, name="date")
    exp = expected_mask(idx, sensors)
    return pd.DataFrame({"expected": exp, "used": np.asarray(used, bool), "cell_days": np.asarray(cell_days, float), "day_status": "x"}, index=idx)


# ---------------------------------------------------------------------------
# Hand-calculated fixtures (methodology section 9)
# ---------------------------------------------------------------------------
def test_h1_coverage_normalisation_uses_usable_days_only():
    # B = 20. Month X: 30 days, 24 usable, 600 cell-days -> r = 25, FAI = 125, kappa = 0.8.
    dates = pd.date_range("2024-04-01", periods=30)
    used = [True] * 24 + [False] * 6
    cd = [25.0] * 24 + [np.nan] * 6
    entry = {"series_id": "x", "role": "t", "B": 20.0, "monthly_reference": {}, "seasonal_reference": {}}
    row = compute_period_table(_daily(dates, used, cd), "month", entry, "vt").iloc[0]
    assert row["usable_days"] == 24 and row["cell_days_on_usable_days"] == 600
    assert row["r_cell_days_per_usable_day"] == pytest.approx(25.0)
    assert row["FAI"] == pytest.approx(125.0)
    assert row["kappa"] == pytest.approx(0.8) and row["quality_label"] == "reliable"
    # Dividing by calendar days would give 20 and FAI 100: unusable days must not act as zeros.
    assert 600 / 30 / 20 * 100 == pytest.approx(100.0) and row["FAI"] != pytest.approx(100.0)
    # Month Y: 12 usable of 30 -> kappa 0.4 -> NA.
    used_y = [True] * 12 + [False] * 18
    cd_y = [25.0] * 12 + [np.nan] * 18
    ry = compute_period_table(_daily(dates, used_y, cd_y), "month", entry, "vt").iloc[0]
    assert ry["kappa"] == pytest.approx(0.4) and ry["quality_label"] == "insufficient_coverage" and np.isnan(ry["FAI"])


def test_h2_cell_day_is_union_not_sensor_sum():
    rows = [_hrow("2023-05-01", "NOAA20", "G600_600"), _hrow("2023-05-01", "NOAA20", "G600_601"),
            _hrow("2023-05-01", "SNPP", "G600_601"), _hrow("2023-05-01", "SNPP", "G600_602")]
    det = prepare_type0_viirs(pd.DataFrame(rows))
    cal = pd.DataFrame({"NOAA20": [True], "SNPP": [True]}, index=pd.DatetimeIndex(["2023-05-01"], name="date"))
    daily = build_daily_table(select_detections(det, HEAD_SPEC, np.array([], dtype=np.int64)), cal, HEAD_SPEC.sensors)
    assert len(det) == 4 and daily["cell_days"].iloc[0] == 3  # sensor sum 4, union 3


def test_h3_static_exposure_sigma_and_relative_exposure():
    # B_core = 20, B_excl = 14 -> sigma_B = 0.30. One period: r = 30, sigma_P = 0.40, r_excl = 18.
    def period(total, fai):
        return pd.DataFrame([{"period_type": "month", "period": "2024-05", "year": 2024, "usable_days": 10, "expected_days": 10,
                              "kappa": 1.0, "quality_label": "reliable", "cell_days_on_usable_days": total, "FAI": fai}])
    core, excl = period(300.0, fai_value(30.0, 20.0)), period(180.0, fai_value(18.0, 14.0))
    out = static_exposure(core, excl, {"total_cell_days": 600.0}, {"total_cell_days": 420.0}).iloc[0]
    assert out["FAI_core"] == pytest.approx(150.0)
    assert out["FAI_excl3x3"] == pytest.approx(128.5714, abs=1e-3)
    assert out["sigma_P"] == pytest.approx(0.40) and out["sigma_B"] == pytest.approx(0.30)
    assert out["R_P"] == pytest.approx(0.857143, abs=1e-5)
    assert out["R_P"] == pytest.approx(out["R_identity_check"])
    assert out["R_P"] == pytest.approx(0.6 / 0.7)
    # NA when the core denominator is zero.
    z = static_exposure(period(0.0, np.nan), period(0.0, np.nan), {"total_cell_days": 600.0}, {"total_cell_days": 420.0}).iloc[0]
    assert np.isnan(z["sigma_P"])


def test_h4_block_proxy_arithmetic_and_block_table():
    assert fai_value(40 / 20, 2.0) == pytest.approx(100.0)
    dates = pd.date_range("2024-03-01", periods=20)
    daily = _daily(dates, [True] * 20, [5.0] * 20)
    sel = pd.DataFrame({"date": list(dates[:10]) * 4,
                        "key": [1000 + i for i in range(4) for _ in range(10)],
                        "block_id": "B30N_31E", "block_lat_min": 30.0, "block_lon_min": 31.0})
    nat = pd.DataFrame([{"period": "2024-MAM", "FAI": 100.0, "kappa": 1.0, "quality_label": "reliable", "na_reason": ""}])
    nat_y = nat.assign(period="2024")
    baseline = {"baseline_version": "vt", "blocks": {"min_baseline_cell_days": 100, "table": [
        {"block_id": "B30N_31E", "baseline_cell_days": 300, "B_block": 2.0, "eligible": True},
        {"block_id": "B22N_28E", "baseline_cell_days": 10, "B_block": 0.1, "eligible": False}]}}
    out, elig, part = build_block_tables(sel, daily, {"season": nat, "year": nat_y}, baseline)
    r = out[out["period_type"] == "year"].iloc[0]
    assert r["cell_days_on_usable_days"] == 40 and r["usable_days"] == 20
    assert r["FAI_block"] == pytest.approx(100.0)
    assert r["coverage_basis"] == "national_calendar_proxy" and not r["locally_coverage_normalized"] and not r["comparable_between_blocks"]
    assert set(out["block_id"]) == {"B30N_31E"}  # ineligible block is not published
    assert not any("rank" in c.lower() for c in out.columns)


def test_baseline_matched_dates_hand_calculation():
    # Jan 1,2,3,4 each year; 3 Jan 2024 unusable; 29 Feb 2024 usable with c=100 (must be dropped).
    d23 = pd.date_range("2023-01-01", periods=4)
    d24 = list(pd.date_range("2024-01-01", periods=4)) + [pd.Timestamp("2024-02-29")]
    d25 = pd.date_range("2025-01-01", periods=4)
    dates = list(d23) + d24 + list(d25)
    cd = [1, 2, 3, 4] + [2, 4, np.nan, 8, 100] + [3, 6, 9, 12]
    used = [not np.isnan(v) for v in cd]
    daily = _daily(dates, used, cd)
    assert matched_month_days(daily) == ["01-01", "01-02", "01-04"]
    e = baseline_entry(daily, HEAD_SPEC)
    assert e["per_year_total_cell_days"] == {"2023": 7.0, "2024": 14.0, "2025": 21.0}
    assert e["B"] == pytest.approx(42 / 9)
    fai = [100 * (v / 3) / e["B"] for v in (7, 14, 21)]
    assert fai == [pytest.approx(50.0), pytest.approx(100.0), pytest.approx(150.0)] and np.mean(fai) == pytest.approx(100.0)


def test_quality_rules():
    assert quality_label(30, 24, True, "month") == ("reliable", "")
    assert quality_label(30, 23, True, "month")[0] == "partial_coverage"
    assert quality_label(30, 15, True, "month")[0] == "partial_coverage"
    assert quality_label(30, 14, True, "month") == ("insufficient_coverage", "kappa_below_0.5")
    assert quality_label(28, 14, True, "month")[1] == "fewer_than_15_usable_days"
    assert quality_label(0, 0, True, "month")[0] == "not_expected"
    assert quality_label(59, 59, False, "season")[1] == "incomplete_period_window"
    assert quality_label(90, 45, True, "season")[0] == "partial_coverage"


def test_expected_days_use_science_start_of_every_sensor():
    idx = pd.date_range("2023-02-27", periods=4)
    assert expected_mask(idx, ("NOAA20", "SNPP")).all()
    assert expected_mask(idx, ("NOAA20", "NOAA21")).tolist() == [False, False, True, True]


# ---------------------------------------------------------------------------
# Frozen-baseline protocol (methodology section 7.2)
# ---------------------------------------------------------------------------
def test_protocol_a_recomputed_baseline_equals_frozen():
    h, c = _synthetic()
    b1 = create_baseline(h, c, "v1")
    b2 = create_baseline(h, c, "v2")
    for sid in b1["series"]:
        assert abs(b1["series"][sid]["B"] - b2["series"][sid]["B"]) < 1e-9
        assert b1["series"][sid]["matched_month_days"] == b2["series"][sid]["matched_month_days"]
    assert b1["input_fingerprint"] == b2["input_fingerprint"]


def test_protocol_b_appending_2026_leaves_2023_2025_values_identical():
    h, c = _synthetic()
    base = create_baseline(h, c, "v1")
    h2, c2 = _synthetic(last="2026-03-31")
    verify_baseline_inputs(base, h2, c2)  # baseline-year slice is unchanged, so no error
    t1, t2 = compute_index(h, c, base), compute_index(h2, c2, base)
    for name in ("fai_monthly", "fai_yearly"):
        a, b = t1[name], t2[name]
        pd.testing.assert_frame_equal(a[a["year"] <= 2025].reset_index(drop=True), b[b["year"] <= 2025].reset_index(drop=True))
    a, b = t1["fai_seasonal"], t2["fai_seasonal"]
    ka, kb = a[a["year"] <= 2025], b[b["year"] <= 2025]
    pd.testing.assert_frame_equal(ka[ka["period"] != "2026-DJF"].reset_index(drop=True), kb[kb["period"] != "2026-DJF"].reset_index(drop=True))
    a, b = t1["fai_daily"], t2["fai_daily"]
    pd.testing.assert_frame_equal(a.reset_index(drop=True), b[b["date"] < "2026-01-01"].reset_index(drop=True))
    # A baseline recomputed with 2026 data present is identical, because M uses 2023-2025 only.
    again = create_baseline(h2, c2, "v1")
    assert all(abs(again["series"][s]["B"] - base["series"][s]["B"]) < 1e-9 for s in base["series"])


def test_protocol_c_changed_input_raises():
    h, c = _synthetic()
    base = create_baseline(h, c, "v1")
    h_alt = h.copy()
    i = h_alt.index[(h_alt["acquisition_date"] == "2024-06-15") & (h_alt["sensor_key"] == "NOAA20")][0]
    h_alt.loc[i, "grid_cell_id"] = "G700_700"
    with pytest.raises(BaselineMismatchError):
        verify_baseline_inputs(base, h_alt, c)
    c_alt = c.copy()
    c_alt.loc[c_alt.index[10], "coverage_status"] = "no_records_unconfirmed"
    with pytest.raises(BaselineMismatchError):
        verify_baseline_inputs(base, h, c_alt)
    tampered = copy.deepcopy(base)
    tampered["input_fingerprint"]["harmonized_baseline_years_sha256"] = "0" * 64
    with pytest.raises(BaselineMismatchError):
        verify_baseline_inputs(tampered, h, c)


# ---------------------------------------------------------------------------
# Fingerprint determinism across pandas versions / dtypes (regression)
#
# Baseline v1 stores the hash of the baseline-year slice. The harmonized table has
# missing confidence_class values (MODIS rows). The old implementation did
# `astype(str).to_csv()`, and pandas renders a missing value differently by
# version and dtype: an empty field (pandas 3), "nan" or "<NA>" (pandas 2).
# The raw file bytes were identical, yet harmonized_baseline_years_sha256 changed.
# ---------------------------------------------------------------------------
_FP_COLS = ["sensor_key", "acquisition_date", "grid_cell_id", "hotspot_type", "confidence_class", "daynight"]


def _with_missing_confidence():
    h, c = _synthetic()
    h = h.copy()
    h.loc[h.index[::7], "confidence_class"] = None  # several thousand rows, as with MODIS in the real data
    return h, c


def _legacy_fingerprint_sha(h: pd.DataFrame, missing_text: str) -> str:
    """The pre-fix algorithm, with missing values rendered the way a given pandas version renders them."""
    h = h[_FP_COLS].copy().astype(object)
    h = h.where(h.notna(), missing_text)
    h["acquisition_date"] = h["acquisition_date"].astype(str)
    h = h.astype(str).sort_values(list(h.columns), kind="mergesort")
    return sha256_text(h.to_csv(index=False, lineterminator="\n"))


def test_regression_old_serialization_depended_on_how_missing_values_render():
    h, _ = _with_missing_confidence()
    legacy = {t: _legacy_fingerprint_sha(h, t) for t in ("", "nan", "<NA>")}
    assert len(set(legacy.values())) == 3  # same data, three different hashes: the reported symptom


@pytest.mark.parametrize("make", [
    pytest.param(lambda s: s.astype(object), id="object-nan"),
    pytest.param(lambda s: s.astype(object).where(s.notna(), None), id="object-None"),
    pytest.param(lambda s: s.astype("string"), id="string"),
    pytest.param(lambda s: s.astype(str).where(s.notna(), np.nan), id="str-nan"),
])
def test_fingerprint_identical_for_every_missing_value_representation(make):
    h, c = _with_missing_confidence()
    reference = input_fingerprint(h, c)
    h2 = h.copy()
    for col in ("confidence_class", "daynight", "grid_cell_id", "sensor_key", "acquisition_date"):
        h2[col] = make(h2[col])
    assert input_fingerprint(h2, c) == reference


def test_fingerprint_ignores_row_order_and_numeric_dtype():
    h, c = _with_missing_confidence()
    reference = input_fingerprint(h, c)
    shuffled_h = h.sample(frac=1.0, random_state=3).reset_index(drop=True)
    shuffled_c = c.sample(frac=1.0, random_state=4).reset_index(drop=True)
    assert input_fingerprint(shuffled_h, shuffled_c) == reference
    h_float = h.assign(hotspot_type=h["hotspot_type"].astype(float))
    c_float = c.assign(n_records=c["n_records"].astype(float))
    assert input_fingerprint(h_float, c_float) == reference
    h_text = h.assign(hotspot_type=h["hotspot_type"].astype(str))
    assert input_fingerprint(h_text, c) == reference


def test_fingerprint_text_is_pinned_and_missing_is_an_empty_field():
    h = pd.DataFrame({
        "sensor_key": ["SNPP", "MODIS", "SNPP", "SNPP"],
        "acquisition_date": ["2024-01-02", "2023-05-01", "2024-01-02", "2022-01-01"],
        "grid_cell_id": ["G1_1", "G2_2", "G1_1", "G9_9"],
        "hotspot_type": [0, 0, 0, 0],
        "confidence_class": [pd.NA, "n", "h", "n"],
        "daynight": ["D", "N", "D", "D"],
    })
    text, n = _canonical_csv_text(h, _FP_COLS, (2023, 2024, 2025))
    assert n == 3  # the 2022 row is outside the baseline years
    assert text == (
        "sensor_key,acquisition_date,grid_cell_id,hotspot_type,confidence_class,daynight\n"
        "MODIS,2023-05-01,G2_2,0,n,N\n"
        "SNPP,2024-01-02,G1_1,0,h,D\n"
        "SNPP,2024-01-02,G1_1,0,,D\n"
    )


def test_fingerprint_changes_when_content_changes():
    h, c = _with_missing_confidence()
    reference = input_fingerprint(h, c)
    changed = h.copy()
    i = changed.index[changed["confidence_class"].isna()][0]
    changed.loc[i, "confidence_class"] = "n"  # missing -> value must be detected
    assert input_fingerprint(changed, c)["harmonized_baseline_years_sha256"] != reference["harmonized_baseline_years_sha256"]
    literal = h.copy()
    literal.loc[i, "confidence_class"] = "nan"  # the text "nan" is a value, not a missing marker
    assert input_fingerprint(literal, c)["harmonized_baseline_years_sha256"] != reference["harmonized_baseline_years_sha256"]


def test_raw_input_file_sha256_is_checked_against_the_stored_values(tmp_path):
    h, c = _synthetic()
    f = tmp_path / "firescope_harmonized.csv"
    f.write_bytes(b"raw bytes\n")
    base = create_baseline(h, c, "v1", file_hashes={"firescope_harmonized.csv": sha256_file(f)})
    verify_baseline_input_files(base, {"firescope_harmonized.csv": f})
    verify_baseline_inputs(base, h, c, input_files={"firescope_harmonized.csv": f})
    f.write_bytes(b"raw bytes changed\n")
    with pytest.raises(BaselineMismatchError, match="Raw input file"):
        verify_baseline_input_files(base, {"firescope_harmonized.csv": f})
    with pytest.raises(BaselineMismatchError, match="Raw input file"):
        verify_baseline_inputs(base, h, c, input_files={"firescope_harmonized.csv": f})
    other = tmp_path / "other.csv"
    other.write_bytes(b"x")
    verify_baseline_input_files(base, {"other.csv": other})  # no stored hash for this name: skipped


@pytest.mark.skipif(not (INDEX_DIR / "baseline_v1.json").is_file(), reason="baseline_v1.json not present")
def test_real_inputs_reproduce_frozen_baseline_v1_fingerprint_and_file_hashes():
    from config import HARMONIZED_DIR
    from run_phase4 import load_phase3_outputs

    baseline = load_baseline(INDEX_DIR, "v1")
    files = {n: HARMONIZED_DIR / n for n in ("firescope_harmonized.csv", "coverage_calendar.csv")}
    if not all(p.is_file() for p in files.values()):
        pytest.skip("Phase 3 outputs not present")
    verify_baseline_input_files(baseline, files)
    h, c = load_phase3_outputs()
    assert input_fingerprint(h, c, tuple(baseline["baseline_years"])) == baseline["input_fingerprint"]
    verify_baseline_inputs(baseline, h, c, input_files=files)


def test_baseline_file_versions_are_never_overwritten():
    h, c = _synthetic()
    with tempfile.TemporaryDirectory() as tmp:
        d = Path(tmp)
        assert next_baseline_version(d) == "v1"
        b = create_baseline(h, c, "v1")
        save_baseline(b, d)
        with pytest.raises(FileExistsError):
            save_baseline(b, d)
        assert next_baseline_version(d) == "v2" and list_baseline_versions(d) == ["v1"]
        loaded = load_baseline(d)
        assert loaded["series"][HEADLINE_ID]["B"] == b["series"][HEADLINE_ID]["B"]
        # Tampering with the matched-date list inside the file is detected.
        p = d / "baseline_v1.json"
        data = json.loads(p.read_text())
        data["series"][HEADLINE_ID]["matched_month_days"].append("12-31")
        p.write_text(json.dumps(data))
        with pytest.raises(BaselineMismatchError):
            load_baseline(d)


def test_protocol_d_matched_totals_reconcile_with_phase4_tables():
    if not real_outputs:
        pytest.skip("Run `python main.py phase3`, `phase4`, `phase5` first")
    base = load_baseline(INDEX_DIR)
    p4 = pd.concat([pd.read_csv(ANALYSIS_DIR / "matched_day_yearly.csv"), pd.read_csv(ANALYSIS_DIR / "sensitivity_matched_day_yearly.csv")])
    t = p4[p4["series"] == "VIIRS_NOAA20_SNPP_union"].sort_values("year")["total_cell_days"].tolist()
    mine = base["series"][HEADLINE_ID]["per_year_total_cell_days"]
    assert t == [mine["2023"], mine["2024"], mine["2025"]] == [13940.0, 10862.0, 8053.0]
    assert base["series"][HEADLINE_ID]["n_matched_days"] == 337
    assert base["series"][HEADLINE_ID]["B"] == pytest.approx(32855 / 1011, abs=1e-12)


# ---------------------------------------------------------------------------
# Scientific restrictions
# ---------------------------------------------------------------------------
def test_index_uses_only_type0_viirs_and_headline_set():
    h, c = _synthetic(last="2023-03-31")
    det = prepare_type0_viirs(h)
    modis = pd.DataFrame([{**_hrow("2023-01-02", "MODIS", "G600_600"), "sensor_family": "MODIS"}])
    det2 = prepare_type0_viirs(pd.concat([h, modis], ignore_index=True))
    assert set(det["sensor_key"]) <= {"NOAA20", "NOAA21", "SNPP"} and len(det2) == len(det)
    assert (h["hotspot_type"] == 2).any() and len(det) == int(((h["hotspot_type"] == 0)).sum())
    assert next(s for s in SERIES_SPECS if s.series_id == HEADLINE_ID).sensors == ("NOAA20", "SNPP")


def test_unusable_days_are_not_zeros_and_missing_sensor_blocks_the_day():
    h, c = _synthetic()
    base = create_baseline(h, c, "v1")
    t = compute_index(h, c, base)
    d = t["fai_daily"]
    head = d[d["series_id"] == HEADLINE_ID].set_index("date")
    gap = head.loc["2024-07-05"]  # SNPP documented gap
    assert not gap["used"] and np.isnan(gap["cell_days"]) and np.isnan(gap["FAI_daily"])
    assert head.loc["2024-07-11", "used"]
    n21 = t["fai_yearly"].query("series_id == 'NOAA21_core_all' and period == '2023'").iloc[0]
    assert n21["expected_days"] == 306  # 1 March to 31 December


def test_block_partition_and_no_block_ranking_in_synthetic_run():
    h, c = _synthetic()
    base = create_baseline(h, c, "v1")
    t = compute_index(h, c, base)
    part = t["_partition"]
    assert (part["national_c"] == part["sum_blocks_c"]).all()
    blocks = t["block_fai"]
    assert not any("rank" in col.lower() for col in blocks.columns)
    assert blocks["block_id"].tolist() == sorted(blocks["block_id"].tolist())


def test_spread_is_range_of_eligible_single_sensor_indices_and_na_below_two():
    def tbl(vals):
        return pd.DataFrame([{"period_type": p, "period": "2024", "year": 2024, "FAI": v, "kappa": k, "quality_label": "x"}
                             for p in ("month", "season", "year") for v, k in vals])
    tables = {"NOAA20_core_all": tbl([(100.0, 0.9)]), "NOAA21_core_all": tbl([(80.0, 0.9)]), "SNPP_core_all": tbl([(130.0, 0.4)])}
    row = inter_sensor_spread(tables).query("period_type == 'year'").iloc[0]
    assert row["n_sensors_in_spread"] == 2 and row["inter_sensor_index_spread"] == pytest.approx(20.0)  # SNPP kappa < 0.5 excluded
    tables["NOAA21_core_all"] = tables["NOAA21_core_all"].assign(FAI=np.nan)
    row = inter_sensor_spread(tables).query("period_type == 'year'").iloc[0]
    assert row["n_sensors_in_spread"] == 1 and np.isnan(row["inter_sensor_index_spread"])


# ---------------------------------------------------------------------------
# Checks on the real outputs
# ---------------------------------------------------------------------------
def test_real_outputs_checks_all_passed_and_phase_0_4_unchanged():
    if not real_outputs:
        pytest.skip("Run `python main.py phase5` first")
    checks = pd.read_csv(INDEX_DIR / "phase5_checks.csv")
    assert len(checks) > 40 and checks["passed"].all(), checks[~checks["passed"]].to_string()
    assert checks["check"].str.contains("Phase 0-4 files unchanged").any()


def test_real_headline_values_match_hand_calculation_from_proposal():
    if not real_outputs:
        pytest.skip("Run `python main.py phase5` first")
    v = pd.read_csv(INDEX_DIR / "baseline_validation.csv")
    v = v[v["series_id"] == HEADLINE_ID].set_index("year")["FAI_on_matched_dates"]
    assert v[2023] == pytest.approx(127.287, abs=5e-4) and v[2024] == pytest.approx(99.181, abs=5e-4) and v[2025] == pytest.approx(73.532, abs=5e-4)
    assert v.mean() == pytest.approx(100.0, abs=1e-9)
    base = load_baseline(INDEX_DIR)
    assert base["series"]["N20_SNPP_core_excl_low"]["B"] == pytest.approx(30304 / 1011, abs=1e-12)


def test_real_outputs_carry_labels_and_block_limits():
    if not real_outputs:
        pytest.skip("Run `python main.py phase5` first")
    for name in ("fai_daily", "fai_monthly", "fai_seasonal", "fai_yearly"):
        t = pd.read_csv(INDEX_DIR / f"{name}.csv")
        assert (t["coverage_basis"] == "record_presence_proxy").all() and t["baseline_version"].notna().all()
    b = pd.read_csv(INDEX_DIR / "block_fai.csv")
    assert (b["coverage_basis"] == "national_calendar_proxy").all() and not b["locally_coverage_normalized"].any()
    assert b["block_id"].tolist() == sorted(b["block_id"].tolist())
    y = pd.read_csv(INDEX_DIR / "fai_yearly.csv")
    assert (y[y["quality_label"].isin(["insufficient_coverage", "not_expected"])]["FAI"].isna()).all()


def test_report_wording_follows_interpretation_rules():
    path = PROJECT_ROOT / "reports" / "phase5_index_report.md"
    if not path.is_file():
        pytest.skip("Run `python main.py phase5` first")
    text = path.read_text(encoding="utf-8")
    lower = text.lower()
    for phrase in ("fires increased", "fires decreased", "fire increased", "more fires", "fewer fires", "caused by", "confirmed fires increased"):
        assert phrase not in lower, phrase
    for m in re.finditer(r"confidence interval", lower):
        assert "not a " in lower[max(0, m.start() - 12): m.start()] or "not confidence" in lower[max(0, m.start() - 30): m.start()], lower[m.start() - 60: m.end()]
    for line in text.splitlines():
        for term in ("burned area", "fire intensity"):
            if term in line.lower():
                assert re.search(r"\bnot\b|\bnever\b|\bno\b|\bnor\b", line.lower()), line
    assert "not comparable between blocks" in lower and "not ranked by fai" in lower
    assert "record_presence_proxy" in text and "national_calendar_proxy" in text
