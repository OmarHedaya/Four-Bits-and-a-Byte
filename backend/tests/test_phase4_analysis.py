"""Phase 4 tests on small synthetic data with hand-computed expected values."""

import numpy as np
import pandas as pd
import pytest

import phase4_analysis as p4


# ---------------------------------------------------------------- helpers
def rec(sensor, date, time="10:00:00", lat_idx=100, lon_idx=200, htype=0, frp=5.0, conf="n"):
    family = "MODIS" if sensor == "MODIS" else "VIIRS"
    return {
        "record_id": f"R{abs(hash((sensor, date, time, lat_idx, lon_idx, htype, frp))) % 10**9}",
        "acquisition_datetime_utc": f"{date}T{time}Z",
        "acquisition_date": date,
        "latitude": (lat_idx + 0.5) * 0.05,
        "longitude": (lon_idx + 0.5) * 0.05,
        "grid_cell_id": f"G{lat_idx}_{lon_idx}",
        "grid_cell_lat": round((lat_idx + 0.5) * 0.05, 4),
        "grid_cell_lon": round((lon_idx + 0.5) * 0.05, 4),
        "sensor_key": sensor,
        "sensor_family": family,
        "nominal_resolution_m": 1000 if family == "MODIS" else 375,
        "scan_km": 1.0 if family == "MODIS" else 0.4,
        "track_km": 1.0 if family == "MODIS" else 0.4,
        "confidence_numeric": 80 if family == "MODIS" else pd.NA,
        "confidence_class": pd.NA if family == "MODIS" else conf,
        "frp_mw": frp,
        "daynight": "D",
        "hotspot_type": htype,
        "is_static_source": htype == 2,
        "is_vegetation_fire_candidate": htype == 0,
        "is_water_detection": htype == 3,
    }


def make_h(rows):
    df = pd.DataFrame(rows)
    df["record_id"] = [f"FS{i:07d}" for i in range(len(df))]
    return df


def make_cov(h, extra_status=None):
    """Full 2023-2025 calendar for all sensors; observed where records exist."""
    days = pd.date_range("2023-01-01", "2025-12-31").strftime("%Y-%m-%d")
    rows = []
    have = set(zip(h["sensor_key"], h["acquisition_date"]))
    counts = h.groupby(["sensor_key", "acquisition_date"]).size().to_dict()
    for s in p4.ALL_SENSORS:
        for d in days:
            obs = (s, d) in have
            status = "observed" if obs else "no_records_unconfirmed"
            if extra_status and (s, d) in extra_status and not obs:
                status = extra_status[(s, d)]
            rows.append({"sensor_key": s, "acquisition_date": d, "n_records": counts.get((s, d), 0),
                         "n_non_static_records": 0, "coverage_status": status})
    return pd.DataFrame(rows)


# ---------------------------------------------------------------- 1-3 time and grid
def test_utc_to_cairo_winter_and_summer():
    h = make_h([rec("SNPP", "2023-01-15", "10:30:00"), rec("SNPP", "2023-07-01", "10:30:00")])
    out = p4.prepare_detections(h)
    assert list(out["local_hour_cairo"]) == [12, 13]
    assert list(out["utc_offset_hours_cairo"]) == [2.0, 3.0]


def test_dst_transition_dates_2023_to_2025():
    stamps = ["2023-04-27", "2023-04-28", "2023-10-26", "2023-10-27", "2024-04-25", "2024-04-26", "2025-04-24", "2025-04-25"]
    out = p4.prepare_detections(make_h([rec("SNPP", d, "12:00:00") for d in stamps]))
    assert list(out["utc_offset_hours_cairo"]) == [2, 3, 3, 2, 2, 3, 2, 3]


def test_local_date_rolls_over_and_utc_is_preserved():
    h = make_h([rec("SNPP", "2023-07-01", "22:30:00")])
    out = p4.prepare_detections(h)
    assert out["local_date_cairo"].iloc[0] == pd.Timestamp("2023-07-02")
    assert out["local_hour_cairo"].iloc[0] == 1
    assert out["acquisition_datetime_utc"].iloc[0] == "2023-07-01T22:30:00Z"
    assert out["acquisition_date"].iloc[0] == "2023-07-01"


def test_date_and_grid_index_extraction():
    out = p4.prepare_detections(make_h([rec("MODIS", "2024-03-05", lat_idx=620, lon_idx=595)]))
    assert out["year"].iloc[0] == 2024 and out["month"].iloc[0] == 3
    assert (out["lat_idx"].iloc[0], out["lon_idx"].iloc[0]) == (620, 595)


def test_bad_grid_id_is_rejected():
    h = make_h([rec("MODIS", "2024-03-05")])
    h.loc[0, "grid_cell_id"] = "bad"
    with pytest.raises(ValueError):
        p4.validate_inputs(h, make_cov(make_h([rec("MODIS", "2024-03-05")])))


# ---------------------------------------------------------------- 4-5 cell-day construction
def test_unique_cell_days_and_multi_sensor():
    h = make_h([
        rec("NOAA20", "2024-06-01", lat_idx=10, lon_idx=20),
        rec("NOAA20", "2024-06-01", lat_idx=10, lon_idx=20, frp=9.0),   # same sensor, same cell-day
        rec("SNPP", "2024-06-01", lat_idx=10, lon_idx=20),              # second sensor, same cell-day
        rec("SNPP", "2024-06-01", lat_idx=11, lon_idx=20),              # different cell
        rec("NOAA21", "2024-06-02", lat_idx=10, lon_idx=20),            # different day
    ])
    hh = p4.prepare_detections(h)
    cd = p4.build_cell_days(hh, hh["is_vegetation_fire_candidate"])
    assert len(cd) == 3
    assert not cd.duplicated(["date", "grid_cell_id"]).any()
    first = cd[(cd["date"] == "2024-06-01") & (cd["grid_cell_id"] == "G10_20")].iloc[0]
    assert first["n_sensors"] == 2 and first["n_detections"] == 3
    p4.assert_unique_cell_days(cd)


def test_assert_unique_cell_days_raises_on_duplicates():
    dup = pd.DataFrame({"date": ["2024-01-01"] * 2, "grid_cell_id": ["G1_1"] * 2})
    with pytest.raises(AssertionError):
        p4.assert_unique_cell_days(dup)


# ---------------------------------------------------------------- 6 daily summary (hand-computed)
def _three_sensor_case():
    rows = [
        rec("NOAA20", "2024-06-01", lat_idx=10, lon_idx=20), rec("NOAA20", "2024-06-01", lat_idx=10, lon_idx=21),
        rec("NOAA21", "2024-06-01", lat_idx=10, lon_idx=20),
        rec("SNPP", "2024-06-01", lat_idx=10, lon_idx=22), rec("SNPP", "2024-06-01", lat_idx=10, lon_idx=22, frp=7.0),
    ]
    return make_h(rows)


def test_daily_summary_counts_and_union():
    h = _three_sensor_case()
    cov = make_cov(h)
    t = p4.run_analysis(h, cov)
    day = t["daily_summary"].set_index("date").loc[pd.Timestamp("2024-06-01")]
    assert day["veg_detections_NOAA20"] == 2 and day["veg_cells_NOAA20"] == 2
    assert day["veg_detections_NOAA21"] == 1
    assert day["veg_detections_SNPP"] == 2 and day["veg_cells_SNPP"] == 1
    assert day["viirs_veg_cells_union_3sensor"] == 3        # cells 20, 21, 22 (20 counted once)
    assert day["viirs_3sensor_full_coverage"]
    assert day["n_viirs_sensors_observed"] == 3


def test_zero_activity_observed_day_is_zero_not_nan():
    h = make_h([rec("SNPP", "2024-06-01", htype=2), rec("SNPP", "2024-06-02", lat_idx=5, lon_idx=5)])
    t = p4.run_analysis(h, make_cov(h))
    sd = t["series_daily"]
    row = sd[(sd["series"] == "SNPP") & (sd["date"] == "2024-06-01")].iloc[0]
    assert row["used"] and row["cell_days"] == 0           # observed (static record only), no candidates
    gap = sd[(sd["series"] == "SNPP") & (sd["date"] == "2024-06-03")].iloc[0]
    assert (not gap["used"])                                 # no records at all: not a zero day


# ---------------------------------------------------------------- 7 monthly / yearly summaries
def test_monthly_and_yearly_rates_use_used_days_only():
    rows = []
    for d, n in [("2024-06-01", 2), ("2024-06-02", 4)]:
        rows += [rec("SNPP", d, lat_idx=10 + i, lon_idx=20) for i in range(n)]
    h = make_h(rows)
    t = p4.run_analysis(h, make_cov(h))
    m = t["monthly_summary"]
    r = m[(m["series"] == "SNPP") & (m["year"] == 2024) & (m["month"] == 6)].iloc[0]
    assert r["calendar_days"] == 30 and r["used_days"] == 2 and r["unused_days"] == 28
    assert r["cell_days_on_used_days"] == 6
    assert r["mean_cell_days_per_used_day"] == pytest.approx(3.0)     # 6 / 2, not 6 / 30
    assert r["low_coverage_flag"]
    y = t["yearly_summary"]
    ry = y[(y["series"] == "SNPP") & (y["year"] == 2024)].iloc[0]
    assert ry["used_days"] == 2 and ry["mean_cell_days_per_used_day"] == pytest.approx(3.0)


def test_modis_has_totals_but_no_rates():
    h = make_h([rec("MODIS", "2024-06-01"), rec("MODIS", "2024-06-02", lat_idx=3, lon_idx=3)])
    t = p4.run_analysis(h, make_cov(h))
    y = t["yearly_summary"]
    r = y[(y["series"] == "MODIS") & (y["year"] == 2024)].iloc[0]
    assert r["cell_days_on_used_days"] == 2
    assert np.isnan(r["mean_cell_days_per_used_day"]) and not r["rates_valid"]


# ---------------------------------------------------------------- 8 seasons
def test_season_year_assigns_december_to_next_winter():
    assert list(p4.season_year_of([2023, 2023, 2024], [12, 1, 12])) == [2024, 2023, 2025]
    assert p4.season_expected_days("DJF", 2024) == 91      # Dec 2023 (31) + Jan (31) + Feb 2024 (29)
    assert p4.season_expected_days("DJF", 2025) == 90
    assert p4.season_expected_days("JJA", 2024) == 92


def test_seasonal_summary_flags_incomplete_season_years():
    h = make_h([rec("SNPP", "2023-12-15"), rec("SNPP", "2024-01-15", lat_idx=2, lon_idx=2)])
    t = p4.run_analysis(h, make_cov(h))
    s = t["seasonal_summary"]
    s = s[s["series"] == "SNPP"].set_index(["season_year", "season"])
    assert s.loc[(2024, "DJF"), "cell_days_on_used_days"] == 2          # Dec 2023 + Jan 2024 together
    assert s.loc[(2024, "DJF"), "season_year_complete"]
    assert not s.loc[(2023, "DJF"), "season_year_complete"]             # Jan-Feb 2023 only
    assert not s.loc[(2026, "DJF"), "season_year_complete"]             # Dec 2025 only


# ---------------------------------------------------------------- 9 matched days
def test_matched_day_summary_values_and_feb29():
    rows = []
    for y, n in [(2023, 2), (2024, 3), (2025, 1)]:
        rows += [rec("SNPP", f"{y}-06-01", lat_idx=10 + i, lon_idx=20) for i in range(n)]
    rows.append(rec("SNPP", "2024-02-29", lat_idx=50, lon_idx=50))       # leap day must be ignored
    h = make_h(rows)
    h_cov = make_cov(h)
    # make 2023-06-02 observed in 2023 only: it must not be a matched day
    extra = make_h(rows + [rec("SNPP", "2023-06-02", lat_idx=70, lon_idx=70)])
    t = p4.run_analysis(extra, make_cov(extra))
    m = t["matched_day_yearly"]
    m = m[m["series"] == "SNPP"].set_index("year")
    assert (m["n_matched_days"] == m["n_matched_days"].iloc[0]).all()
    assert m.loc[2023, "total_cell_days"] == 2 and m.loc[2024, "total_cell_days"] == 3 and m.loc[2025, "total_cell_days"] == 1
    assert m.loc[2024, "pct_change_vs_previous_year"] == pytest.approx(50.0)
    assert m.loc[2025, "pct_change_vs_first_year"] == pytest.approx(-50.0)
    assert m.loc[2024, "n_matched_days"] < 365


def test_matched_day_missing_year_returns_empty():
    h = make_h([rec("SNPP", "2023-06-01"), rec("SNPP", "2024-06-01")])
    t = p4.run_analysis(h, make_cov(h))
    sd = t["series_daily"]
    sd = sd[~((sd["series"] == "SNPP") & (sd["year"] == 2025))]
    only = sd[(sd["series"] == "SNPP") & sd["used"] & (sd["year"] != 2025)]
    assert p4.matched_day_summary(only, "SNPP").empty


# ---------------------------------------------------------------- 10 coverage gaps
def test_coverage_gap_runs_detect_consecutive_days():
    h = make_h([rec("SNPP", "2023-01-01")])
    cov = make_cov(h)
    runs = p4.build_coverage_gap_runs(cov)
    r = runs[(runs["sensor_key"] == "SNPP")].iloc[0]
    assert r["start_date"] == pd.Timestamp("2023-01-02") and r["n_days"] == 1095
    cov2 = cov.copy()
    cov2.loc[(cov2["sensor_key"] == "SNPP") & cov2["acquisition_date"].isin(["2023-01-02", "2023-01-03"]), "coverage_status"] = "documented_source_gap"
    runs2 = p4.build_coverage_gap_runs(cov2)
    first = runs2[runs2["sensor_key"] == "SNPP"].iloc[0]
    assert first["n_days"] == 2 and first["coverage_status"] == "documented_source_gap"
    assert runs2[runs2["sensor_key"] == "SNPP"].iloc[1]["coverage_status"] == "no_records_unconfirmed"


def test_documented_gap_days_are_not_used_and_not_zero():
    h = make_h([rec("SNPP", "2024-05-29"), rec("SNPP", "2024-06-04", lat_idx=2, lon_idx=2)])
    cov = make_cov(h, {("SNPP", "2024-05-30"): "documented_source_gap"})
    t = p4.run_analysis(h, cov)
    sd = t["series_daily"]
    g = sd[(sd["series"] == "SNPP") & (sd["date"] == "2024-05-30")].iloc[0]
    assert not g["used"]
    cov_a = t["coverage_analysis"]
    r = cov_a[(cov_a["sensor_key"] == "SNPP") & (cov_a["year"] == 2024) & (cov_a["month"] == 5)].iloc[0]
    assert r["documented_source_gap_days"] == 1 and r["observed_days"] == 1


# ---------------------------------------------------------------- 11-12 static sources and neighbourhoods
def test_static_sources_are_separate_from_vegetation_candidates():
    h = make_h([
        rec("SNPP", "2024-06-01", lat_idx=10, lon_idx=20, htype=2),
        rec("SNPP", "2024-06-01", lat_idx=10, lon_idx=21, htype=0),
        rec("SNPP", "2024-06-01", lat_idx=60, lon_idx=60, htype=0),
        rec("MODIS", "2024-06-01", lat_idx=10, lon_idx=20, htype=2),
    ])
    t = p4.run_analysis(h, make_cov(h))
    cells = t["spatial_cells"]
    assert set(cells["grid_cell_id"]) == {"G10_21", "G60_60"}            # type 2 never enters veg cells
    sc = t["static_source_cells"]
    assert list(sc["grid_cell_id"]) == ["G10_20"]
    assert sc.iloc[0]["static_detections_all_sensors"] == 2 and sc.iloc[0]["static_detections_MODIS"] == 1
    assert sc.iloc[0]["viirs_static_days_total"] == 1
    near = cells.set_index("grid_cell_id")
    assert near.loc["G10_21", "static_in_3x3_neighborhood"] and not near.loc["G10_21", "has_static_same_cell"]
    assert not near.loc["G60_60", "static_in_3x3_neighborhood"]
    assert len(h[h["hotspot_type"] == 2]) == 2                           # nothing deleted


def test_neighborhood_keys_and_3x3():
    keys = p4.neighborhood_keys([10], [20], rings=1)
    assert len(keys) == 9
    assert p4.encode_cell_key(11, 21) in keys and p4.encode_cell_key(12, 20) not in keys
    assert len(p4.neighborhood_keys([], [], rings=1)) == 0


def test_static_exclusion_any_year_vs_same_year():
    h = make_h([
        rec("NOAA20", "2023-06-01", lat_idx=10, lon_idx=20, htype=2),    # static seen in 2023 only
        rec("NOAA20", "2023-06-01", lat_idx=10, lon_idx=21),             # near static, 2023
        rec("NOAA20", "2024-06-01", lat_idx=10, lon_idx=21),             # near static cell, but static not seen in 2024
        rec("NOAA21", "2024-06-01", lat_idx=10, lon_idx=21),
        rec("SNPP", "2024-06-01", lat_idx=10, lon_idx=21),
        rec("NOAA21", "2024-06-01", lat_idx=10, lon_idx=21, htype=0),
    ])
    t = p4.run_analysis(h, make_cov(h))
    d = t["daily_summary"].set_index("date")
    day = d.loc[pd.Timestamp("2024-06-01")]
    assert day["viirs_veg_cells_union_3sensor"] == 1
    assert day["viirs_veg_cells_union_3sensor_excl_static_3x3"] == 0         # any-year exclusion removes it
    assert day["viirs_veg_cells_union_3sensor_excl_static_3x3_same_year"] == 1  # static not present in 2024


# ---------------------------------------------------------------- 13 distances
def test_distance_known_values():
    d = p4.nearest_distance_km([0.0], [0.0], [0.0], [1.0])
    assert d[0] == pytest.approx(111.195, abs=0.01)                         # 1 degree of equator
    d = p4.nearest_distance_km([30.0], [31.0], [30.0], [31.0])
    assert d[0] == pytest.approx(0.0, abs=1e-6)
    d = p4.nearest_distance_km([30.0], [30.0], [31.0], [30.0])
    assert d[0] == pytest.approx(111.195, abs=0.01)


def test_distance_kdtree_matches_all_pairs_haversine():
    rng = np.random.default_rng(0)
    lat, lon = rng.uniform(22, 31.5, 300), rng.uniform(25, 35.5, 300)
    t_lat, t_lon = rng.uniform(22, 31.5, 40), rng.uniform(25, 35.5, 40)
    fast = p4.nearest_distance_km(lat, lon, t_lat, t_lon)
    slow = p4._nearest_distance_chunked(lat, lon, t_lat, t_lon, chunk=50)
    assert np.allclose(fast, slow, atol=1e-6)


def test_distance_empty_inputs():
    assert len(p4.nearest_distance_km([], [], [1.0], [1.0])) == 0
    out = p4.nearest_distance_km([1.0, 2.0], [1.0, 2.0], [], [])
    assert len(out) == 2 and np.isnan(out).all()


# ---------------------------------------------------------------- 14-15 agreement
def test_pair_agreement_exact_and_tolerant():
    h = make_h([
        rec("NOAA20", "2024-06-01", lat_idx=10, lon_idx=20), rec("NOAA21", "2024-06-01", lat_idx=10, lon_idx=20),   # exact
        rec("NOAA20", "2024-06-01", lat_idx=30, lon_idx=30), rec("NOAA21", "2024-06-01", lat_idx=31, lon_idx=30),   # adjacent
        rec("NOAA20", "2024-06-01", lat_idx=50, lon_idx=50),                                                      # alone
        rec("SNPP", "2024-06-01", lat_idx=99, lon_idx=99),
    ])
    t = p4.run_analysis(h, make_cov(h))
    a = t["sensor_pair_cell_day_agreement"]
    r = a[(a["sensor_a"] == "NOAA20") & (a["sensor_b"] == "NOAA21") & (a["scope"] == "all_years")].iloc[0]
    assert r["n_cell_days_a"] == 3 and r["n_cell_days_b"] == 2 and r["n_cell_days_both"] == 1
    assert r["jaccard"] == pytest.approx(1 / 4)
    assert r["share_a_also_in_b"] == pytest.approx(1 / 3) and r["share_b_also_in_a"] == pytest.approx(1 / 2)
    assert r["share_a_with_b_in_3x3"] == pytest.approx(2 / 3) and r["share_b_with_a_in_3x3"] == pytest.approx(1.0)
    assert r["measure"] == "grid_cell_co_occurrence_0.05deg"


def test_agreement_only_uses_days_both_sensors_observed():
    h = make_h([rec("NOAA20", "2024-06-01"), rec("NOAA20", "2024-06-02", lat_idx=3, lon_idx=3), rec("NOAA21", "2024-06-01")])
    t = p4.run_analysis(h, make_cov(h))
    a = t["sensor_pair_cell_day_agreement"]
    r = a[(a["sensor_a"] == "NOAA20") & (a["sensor_b"] == "NOAA21") & (a["scope"] == "all_years")].iloc[0]
    assert r["n_common_days"] == 1 and r["n_cell_days_a"] == 1        # 06-02 excluded: NOAA21 not observed


def test_modis_vs_viirs_two_day_bases():
    h = make_h([
        rec("MODIS", "2024-06-01", lat_idx=10, lon_idx=20),
        rec("NOAA20", "2024-06-01", lat_idx=10, lon_idx=20), rec("NOAA21", "2024-06-01", lat_idx=11, lon_idx=20),
        rec("SNPP", "2024-06-01", lat_idx=12, lon_idx=20),
        rec("NOAA20", "2024-06-02", lat_idx=40, lon_idx=40), rec("NOAA21", "2024-06-02", lat_idx=40, lon_idx=40),
        rec("SNPP", "2024-06-02", lat_idx=40, lon_idx=40),                                      # no MODIS record this day
    ])
    t = p4.run_analysis(h, make_cov(h))
    m = t["modis_vs_viirs_agreement"]
    a = m[(m["scope"] == "all_years") & (m["day_basis"] == "modis_has_records")].iloc[0]
    assert a["n_common_days"] == 1 and a["n_cell_days_a"] == 1 and a["n_cell_days_b"] == 3 and a["n_cell_days_both"] == 1
    b = m[(m["scope"] == "all_years") & (m["day_basis"] == "all_viirs_full_days_modis_empty_assumed_zero")].iloc[0]
    assert b["n_common_days"] == 2 and b["n_cell_days_b"] == 4 and b["n_cell_days_both"] == 1
    assert b["share_b_also_in_a"] == pytest.approx(1 / 4)


# ---------------------------------------------------------------- 16-18 empty / missing inputs
def test_empty_harmonized_raises_clear_error():
    h = make_h([rec("SNPP", "2024-06-01")])
    with pytest.raises(ValueError):
        p4.run_analysis(h.iloc[0:0], make_cov(h))


def test_missing_required_column_raises():
    h = make_h([rec("SNPP", "2024-06-01")]).drop(columns=["frp_mw"])
    with pytest.raises(ValueError):
        p4.validate_inputs(h, make_cov(make_h([rec("SNPP", "2024-06-01")])))


def test_missing_sensors_do_not_crash_or_invent_zeros():
    h = make_h([rec("SNPP", "2024-06-01"), rec("SNPP", "2024-06-02", lat_idx=4, lon_idx=4)])   # only one sensor
    t = p4.run_analysis(h, make_cov(h))
    corr = t["sensor_pair_daily_correlation"]
    assert corr["n_common_days"].eq(0).all()                      # no pair has two sensors observed
    r = corr[(corr["sensor_a"] == "NOAA20") & (corr["sensor_b"] == "NOAA21") & (corr["scope"] == "all_years")].iloc[0]
    assert r["n_common_days"] == 0 and np.isnan(r["pearson_daily_cells"])
    prof = t["sensor_profile"].set_index("sensor_key")
    assert prof.loc["MODIS", "n_rows"] == 0 and np.isnan(prof.loc["MODIS", "median_veg_frp_mw"])
    v3 = t["yearly_summary"]
    v3 = v3[(v3["series"] == p4.SERIES_V3) & (v3["year"] == 2024)].iloc[0]
    assert v3["used_days"] == 0 and np.isnan(v3["mean_cell_days_per_used_day"])


def test_missing_year_does_not_crash():
    h = make_h([rec("SNPP", "2023-06-01"), rec("SNPP", "2025-06-01", lat_idx=4, lon_idx=4)])      # no 2024 records
    t = p4.run_analysis(h, make_cov(h))
    y = t["yearly_summary"]
    r = y[(y["series"] == "SNPP") & (y["year"] == 2024)].iloc[0]
    assert r["used_days"] == 0 and np.isnan(r["mean_cell_days_per_used_day"])
    assert t["static_cell_turnover"]["jaccard"].isna().all()


def test_no_static_sources_and_no_vegetation():
    only_static = make_h([rec("SNPP", "2024-06-01", htype=2), rec("NOAA20", "2024-06-01", htype=2)])
    t = p4.run_analysis(only_static, make_cov(only_static))
    assert t["spatial_cells"].empty and t["hotspot_clusters"].empty
    assert t["regional_blocks_1deg"]["veg_cell_days_total"].sum() == 0
    assert len(t["static_source_cells"]) == 1
    no_static = make_h([rec("SNPP", "2024-06-01")])
    t2 = p4.run_analysis(no_static, make_cov(no_static))
    assert t2["static_source_cells"].empty
    assert not t2["spatial_cells"]["has_static_same_cell"].any()
    assert t2["spatial_cells"]["nearest_viirs_static_cell_km"].isna().all()
    assert t2["consistency_checks"]["passed"].all()


# ---------------------------------------------------------------- 19 zero-activity covered above; 20 duplicate coverage
def test_duplicate_coverage_records_raise():
    h = make_h([rec("SNPP", "2024-06-01")])
    cov = make_cov(h)
    cov = pd.concat([cov, cov.iloc[[0]]], ignore_index=True)
    with pytest.raises(ValueError):
        p4.run_analysis(h, cov)


def test_records_on_unobserved_day_raise():
    h = make_h([rec("SNPP", "2024-06-01")])
    cov = make_cov(h)
    cov.loc[(cov["sensor_key"] == "SNPP") & (cov["acquisition_date"] == "2024-06-01"), "coverage_status"] = "documented_source_gap"
    with pytest.raises(ValueError):
        p4.run_analysis(h, cov)


# ---------------------------------------------------------------- input validation
def test_invalid_inputs_raise():
    base = make_h([rec("SNPP", "2024-06-01")])
    cov = make_cov(base)
    bad_sensor = base.copy(); bad_sensor.loc[0, "sensor_key"] = "GOES"
    with pytest.raises(ValueError):
        p4.validate_inputs(bad_sensor, cov)
    bad_type = base.copy(); bad_type.loc[0, "hotspot_type"] = 7
    with pytest.raises(ValueError):
        p4.validate_inputs(bad_type, cov)
    bad_lat = base.copy(); bad_lat.loc[0, "latitude"] = 95.0
    with pytest.raises(ValueError):
        p4.validate_inputs(bad_lat, cov)
    bad_ts = base.copy(); bad_ts.loc[0, "acquisition_datetime_utc"] = "not-a-time"
    with pytest.raises(ValueError):
        p4.validate_inputs(bad_ts, cov)
    bad_conf = base.copy(); bad_conf.loc[0, "confidence_class"] = "x"
    with pytest.raises(ValueError):
        p4.validate_inputs(bad_conf, cov)
    bad_status = cov.copy(); bad_status.loc[0, "coverage_status"] = "weird"
    with pytest.raises(ValueError):
        p4.validate_inputs(base, bad_status)


# ---------------------------------------------------------------- blocks, concentration, gini, clusters
def test_block_ids_are_stable_strings_and_not_governorates():
    lat, lon = p4.block_origin([31.025, 30.975], [29.975, 30.025])
    assert list(lat) == [31.0, 30.0] and list(lon) == [29.0, 30.0]
    assert p4.block_label(lat, lon) == ["B31N_29E", "B30N_30E"]


def test_regional_blocks_merge_static_only_block_and_top_cell():
    h = make_h([
        rec("SNPP", "2024-06-01", lat_idx=620, lon_idx=595), rec("SNPP", "2024-06-02", lat_idx=620, lon_idx=595),
        rec("SNPP", "2024-06-02", lat_idx=621, lon_idx=595),
        rec("SNPP", "2024-06-01", lat_idx=400, lon_idx=500, htype=2),       # static-only block
    ])
    t = p4.run_analysis(h, make_cov(h))
    b = t["regional_blocks_1deg"].set_index("block_id_1deg")
    veg_block = b.loc["B31N_29E"] if "B31N_29E" in b.index else b.iloc[0]
    assert b["veg_cell_days_total"].sum() == 3
    assert veg_block["top_cell_id"] == "G620_595" and veg_block["top_cell_days"] == 2
    static_only = b[b["veg_cell_days_total"] == 0].iloc[0]
    assert static_only["top_cell_id"] == "" and static_only["n_static_cells_any_sensor"] == 1
    assert all(isinstance(i, str) for i in b.index)


def test_gini_and_concentration_known_values():
    assert p4.gini([1, 1, 1, 1]) == pytest.approx(0.0)
    assert p4.gini([0, 0, 0, 10]) == pytest.approx(0.75)
    assert np.isnan(p4.gini([])) and np.isnan(p4.gini([0, 0]))
    m = p4.concentration_metrics(pd.Series([6, 2, 1, 1]))
    assert m["top1_cell_share"] == pytest.approx(0.6) and m["cells_for_50pct_of_cell_days"] == 1
    empty = p4.concentration_metrics(pd.Series([], dtype=float))
    assert empty["n_active_cells"] == 0 and np.isnan(empty["gini"]) and np.isnan(empty["top1_cell_share"])


def test_cluster_labels_use_8_neighbours():
    labels = p4.label_clusters_8([0, 1, 5], [0, 1, 5])        # diagonal neighbours join; far cell is separate
    assert labels[0] == labels[1] and labels[2] != labels[0]


def test_hotspot_clusters_threshold_and_share():
    rows = []
    for i in range(20):
        for day in range(1, 1 + (i + 1)):
            rows.append(rec("SNPP", f"2024-06-{day:02d}", lat_idx=10 + 5 * i, lon_idx=30))
    h = make_h(rows)
    t = p4.run_analysis(h, make_cov(h))
    cl = t["hotspot_clusters"]
    allc = cl[cl["cluster_scope"] == "all_years"]
    assert allc["n_cells"].sum() == 1 and allc.iloc[0]["peak_cell_id"] == "G105_30"   # only the 20-day cell reaches the 95th percentile
    thr = t["hotspot_thresholds"].set_index("cluster_scope").loc["all_years"]
    assert thr["threshold_days"] == pytest.approx(np.percentile(np.arange(1, 21), 95))
    assert allc["share_of_scope_cell_days"].sum() <= 1.0


def test_safe_division_and_pct_change():
    assert np.isnan(p4._safe_div(1, 0)) and np.isnan(p4._safe_div(np.nan, 2)) and p4._safe_div(1, 4) == 0.25
    assert np.isnan(p4._pct_change(5, 0)) and p4._pct_change(15, 10) == pytest.approx(50.0)


def test_hourly_profile_shares_sum_to_one_per_group():
    h = make_h([rec("SNPP", "2024-01-10", "10:30:00"), rec("SNPP", "2024-01-11", "10:40:00", lat_idx=3, lon_idx=3),
                rec("SNPP", "2024-07-10", "10:30:00", lat_idx=4, lon_idx=4), rec("SNPP", "2024-07-10", "10:30:00", htype=2)])
    t = p4.run_analysis(h, make_cov(h))
    hp = t["hourly_profile"]
    veg = hp[(hp["hotspot_group"] == "vegetation_candidate")]
    assert set(veg["utc_offset_hours"]) == {2, 3}
    assert veg.groupby("utc_offset_hours")["share_of_group"].sum().round(9).eq(1.0).all()
    assert set(veg[veg["utc_offset_hours"] == 2]["local_hour_cairo"]) == {12}
    assert set(veg[veg["utc_offset_hours"] == 3]["local_hour_cairo"]) == {13}


def test_consistency_checks_all_pass_on_synthetic_data():
    h = _three_sensor_case()
    t = p4.run_analysis(h, make_cov(h))
    assert t["consistency_checks"]["passed"].all()
