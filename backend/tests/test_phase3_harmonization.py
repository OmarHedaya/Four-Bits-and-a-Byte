"""Phase 3 checks: synthetic unit tests plus integrity checks on real outputs."""

import pandas as pd
import pytest

from config import HARMONIZED_DIR
from harmonize import (
    HARMONIZED_COLUMNS,
    add_grid,
    build_cell_day_presence,
    build_coverage_calendar,
    harmonize,
)


def _cleaned_row(**overrides):
    row = {
        "latitude": 30.0, "longitude": 31.0, "brightness": 330.0, "scan": 0.4,
        "track": 0.4, "acquisition_date": "2024-03-01", "acquisition_time": "01:30:00",
        "satellite": "SNPP", "instrument": "SNPP", "confidence_numeric": pd.NA,
        "confidence_class": "n", "version": "2", "bright_t31": 285.0, "frp": 1.5,
        "daynight": "N", "hotspot_type": 2, "sensor_key": "SNPP",
        "sensor_family": "VIIRS", "product_id": "SV-C2", "source_file": "x.csv",
        "source_archive": "x.zip", "input_origin": "test",
    }
    row.update(overrides)
    return row


def test_grid_cell_uses_005_degree_cells():
    frame = add_grid(pd.DataFrame({"latitude": [30.01, 30.049, 30.05], "longitude": [31.0, 31.0, 31.0]}))
    assert frame["grid_cell_id"].iloc[0] == frame["grid_cell_id"].iloc[1]
    assert frame["grid_cell_id"].iloc[1] != frame["grid_cell_id"].iloc[2]
    assert frame["grid_cell_lat"].iloc[0] == pytest.approx(30.025)


def test_harmonize_keeps_every_row_and_flags_static_and_duplicates():
    cleaned = pd.DataFrame([
        _cleaned_row(),
        _cleaned_row(),  # exact duplicate of the first row
        _cleaned_row(hotspot_type=0, latitude=27.0),
        _cleaned_row(
            sensor_key="MODIS", sensor_family="MODIS", satellite="Terra", instrument="MODIS",
            confidence_numeric=80, confidence_class=pd.NA, hotspot_type=0, product_id="M-C61",
        ),
    ])
    out = harmonize(cleaned)
    assert len(out) == 4
    assert list(out.columns) == HARMONIZED_COLUMNS
    assert out["is_exact_duplicate_within_sensor"].sum() == 1
    assert out["is_static_source"].sum() == 2
    snpp = out[out["sensor_key"] == "SNPP"]
    assert set(snpp["instrument_name"]) == {"VIIRS"}
    modis = out[out["sensor_key"] == "MODIS"].iloc[0]
    assert modis["confidence_numeric"] == 80 and pd.isna(modis["confidence_class"])
    assert modis["nominal_resolution_m"] == 1000
    assert (snpp["nominal_resolution_m"] == 375).all()
    assert out["record_id"].is_unique


def test_cell_day_presence_does_not_add_sensor_counts():
    cleaned = pd.DataFrame([
        _cleaned_row(hotspot_type=0),
        _cleaned_row(hotspot_type=0, sensor_key="NOAA20", satellite="N20", instrument="VIIRS"),
    ])
    presence = build_cell_day_presence(harmonize(cleaned))
    assert len(presence) == 1
    assert presence["n_sensors_detecting"].iloc[0] == 2
    assert bool(presence["static_source_only"].iloc[0]) is False


def test_coverage_calendar_labels_known_limitations():
    cleaned = pd.DataFrame([
        _cleaned_row(sensor_key="NOAA21", satellite="N21", acquisition_date="2023-03-02"),
        _cleaned_row(sensor_key="SNPP", acquisition_date="2024-01-01"),
    ])
    calendar = build_coverage_calendar(harmonize(cleaned))
    status = calendar.set_index(["sensor_key", "acquisition_date"])["coverage_status"]
    assert status[("NOAA21", "2023-01-15")] == "not_expected_before_science_start"
    assert status[("SNPP", "2024-06-01")] == "documented_source_gap"
    assert status[("SNPP", "2024-01-01")] == "observed"
    assert status[("NOAA21", "2023-03-02")] == "observed"


harmonized_path = HARMONIZED_DIR / "firescope_harmonized.csv"


@pytest.mark.skipif(not harmonized_path.is_file(), reason="Run `python main.py phase3` first")
def test_real_harmonized_output_integrity():
    h = pd.read_csv(harmonized_path, dtype={"confidence_class": "string"}, keep_default_na=False,
                    na_values=[""])
    assert len(h) == 254_175  # 225,243 - 2,093 (old NOAA-20 2023) + 31,025 (full year)
    assert h["record_id"].is_unique
    counts = h.groupby(["sensor_key", h["acquisition_date"].str[:4]]).size()
    assert counts[("NOAA20", "2023")] == 31_025
    assert h.loc[h["sensor_family"] == "MODIS", "confidence_class"].isna().all()
    viirs = h[h["sensor_family"] == "VIIRS"]
    assert viirs["confidence_numeric"].isna().all()
    assert set(viirs["confidence_class"].dropna()) <= {"l", "n", "h"}
    assert (h["is_static_source"] == (h["hotspot_type"] == 2)).all()
    assert h["latitude"].between(21, 33).all() and h["longitude"].between(24, 38).all()
    noaa21_early = h[(h["sensor_key"] == "NOAA21") & (h["acquisition_date"] < "2023-03-01")]
    assert noaa21_early.empty
    noaa20_gap_days = ["2023-07-19", "2023-07-20", "2023-07-21", "2023-07-22", "2023-09-30", "2023-10-01"]
    assert not h[(h["sensor_key"] == "NOAA20") & h["acquisition_date"].isin(noaa20_gap_days)].shape[0]
