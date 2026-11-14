"""Unit checks for Phase 2. They do not read or write the raw archives."""

from datetime import date

import pandas as pd

from config import SourceArchive
from data_cleaning import (
    assess_coverage,
    clean_archive_frame,
    group_date_ranges,
    normalize_acquisition_time,
    split_confidence,
)


def _archive() -> SourceArchive:
    return SourceArchive(
        sensor_key="SNPP",
        sensor_family="VIIRS",
        product_id="SV-C2",
        year=2024,
        archive_relpath="unused.zip",
        csv_name="example.csv",
    )


def test_time_keeps_leading_zeros_and_rejects_impossible_clocks():
    assert normalize_acquisition_time("0051") == ("00:51:00", "0051", "ok")
    assert normalize_acquisition_time("0000") == ("00:00:00", "0000", "ok")
    assert normalize_acquisition_time("1143") == ("11:43:00", "1143", "ok")
    assert normalize_acquisition_time("2359") == ("23:59:00", "2359", "ok")
    assert normalize_acquisition_time("51") == ("00:51:00", "51", "ok")
    assert normalize_acquisition_time("") == (None, None, "missing")
    standardized, raw, status = normalize_acquisition_time("2360")
    assert standardized is None
    assert raw == "2360"
    assert status == "invalid"
    assert normalize_acquisition_time("2461")[2] == "invalid"


def test_confidence_formats_stay_separate():
    assert split_confidence("66", "MODIS") == ("66", 66, None, "ok")
    assert split_confidence("0", "MODIS") == ("0", 0, None, "ok")
    assert split_confidence("100", "MODIS") == ("100", 100, None, "ok")
    assert split_confidence("101", "MODIS")[3] == "out_of_range"
    assert split_confidence("n", "VIIRS") == ("n", None, "n", "ok")
    assert split_confidence("H", "VIIRS") == ("h", None, "h", "ok")
    text, numeric, klass, status = split_confidence("n", "VIIRS")
    assert numeric is None
    assert klass == "n"
    assert status == "ok"
    assert text == "n"
    assert split_confidence("nominal", "VIIRS")[3] == "unrecognized"


def test_cleaning_does_not_invent_gap_rows_or_numeric_viirs_confidence():
    raw = pd.DataFrame(
        [
            {
                "latitude": "22.5000",
                "longitude": "31.2500",
                "brightness": "335.98",
                "scan": "0.40",
                "track": "0.37",
                "acq_date": "2024-01-01",
                "acq_time": "0051",
                "satellite": "SNPP",
                "instrument": "SNPP",
                "confidence": "n",
                "version": "2",
                "bright_t31": "281.23",
                "frp": "0",
                "daynight": "N",
                "type": "2",
            },
            {
                "latitude": "95",
                "longitude": "31.0",
                "brightness": "300",
                "scan": "0.40",
                "track": "0.37",
                "acq_date": "2024-01-02",
                "acq_time": "2360",
                "satellite": "SNPP",
                "instrument": "SNPP",
                "confidence": "l",
                "version": "2",
                "bright_t31": "280",
                "frp": "1.5",
                "daynight": "D",
                "type": "0",
            },
        ]
    )
    result = clean_archive_frame(raw, _archive())
    assert result.stats["rows_in"] == 2
    assert result.stats["rows_out"] == 1
    assert result.stats["rows_rejected"] == 1
    assert result.stats["rows_synthesized"] == 0
    assert result.rejected.iloc[0]["reject_reason"] == "invalid_coordinates"
    kept = result.cleaned.iloc[0]
    assert kept["acquisition_time"] == "00:51:00"
    assert kept["acquisition_time_raw"] == "0051"
    assert kept["satellite"] == "SNPP"
    assert kept["instrument"] == "SNPP"
    assert kept["confidence"] == "n"
    assert pd.isna(kept["confidence_numeric"])
    assert kept["confidence_class"] == "n"
    assert kept["frp"] == 0
    assert kept["source_file"] == "example.csv"
    assert list(result.cleaned["acquisition_date"]) == ["2024-01-01"]


def test_modis_confidence_is_not_stored_as_a_viirs_class():
    source = SourceArchive(
        "MODIS", "MODIS", "M-C61", 2023, "unused.zip", "modis.csv"
    )
    raw = pd.DataFrame(
        [
            {
                "latitude": "25.6114",
                "longitude": "28.873",
                "brightness": "377",
                "scan": "1.2",
                "track": "1.1",
                "acq_date": "2023-01-01",
                "acq_time": "1143",
                "satellite": "Aqua",
                "instrument": "MODIS",
                "confidence": "100",
                "version": "61.03",
                "bright_t31": "298.7",
                "frp": "179.2",
                "daynight": "D",
                "type": "0",
            }
        ]
    )
    result = clean_archive_frame(raw, source)
    row = result.cleaned.iloc[0]
    assert row["confidence"] == "100"
    assert row["confidence_numeric"] == 100
    assert pd.isna(row["confidence_class"])
    assert row["satellite"] == "Aqua"
    assert row["instrument"] == "MODIS"
    assert row["version"] == "61.03"
    assert row["acquisition_time"] == "11:43:00"


def test_coverage_labels_for_the_three_reviewed_cases():
    noaa20 = pd.Series(pd.date_range("2023-01-01", "2023-01-31", freq="D").strftime("%Y-%m-%d"))
    assessed = assess_coverage("NOAA20", 2023, noaa20)
    assert assessed.status == "incomplete"
    assert assessed.redownload_start == "2023-02-01"
    assert assessed.redownload_end == "2023-12-31"

    noaa21 = pd.Series(pd.date_range("2023-03-01", "2023-12-31", freq="D").strftime("%Y-%m-%d"))
    assessed = assess_coverage("NOAA21", 2023, noaa21)
    assert assessed.status == "expected_limitation"
    assert assessed.ranges[0].start == date(2023, 1, 1)
    assert assessed.ranges[0].end == date(2023, 2, 28)

    present = pd.date_range("2024-01-01", "2024-12-31", freq="D")
    gaps = pd.to_datetime(
        [
            "2024-05-30",
            "2024-05-31",
            "2024-06-01",
            "2024-06-02",
            "2024-06-03",
            "2024-07-10",
            "2024-07-11",
            "2024-07-12",
            "2024-07-13",
            "2024-07-14",
            "2024-07-15",
            "2024-07-25",
            "2024-07-26",
            "2024-07-27",
            "2024-07-28",
            "2024-09-26",
            "2024-11-03",
            "2024-11-04",
            "2024-11-05",
        ]
    )
    snpp = pd.Series(present.difference(gaps).strftime("%Y-%m-%d"))
    assessed = assess_coverage("SNPP", 2024, snpp)
    assert assessed.status == "gaps_preserved"
    assert [(item.start.isoformat(), item.end.isoformat(), item.days) for item in assessed.ranges] == [
        ("2024-05-30", "2024-06-03", 5),
        ("2024-07-10", "2024-07-15", 6),
        ("2024-07-25", "2024-07-28", 4),
        ("2024-09-26", "2024-09-26", 1),
        ("2024-11-03", "2024-11-05", 3),
    ]


def test_group_date_ranges_keeps_isolated_days_separate():
    ranges = group_date_ranges([date(2024, 2, 4), date(2024, 2, 27), date(2024, 2, 28)])
    assert [(item.start, item.end, item.days) for item in ranges] == [
        (date(2024, 2, 4), date(2024, 2, 4), 1),
        (date(2024, 2, 27), date(2024, 2, 28), 2),
    ]
