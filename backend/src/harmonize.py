"""Phase 3: harmonize the cleaned FIRMS tables into one common schema.

Design rules
------------
* No record is dropped, added, or merged. One input row is one output row.
* Sensor identity, native resolution, and the two confidence formats are kept.
* Counts from different sensors are never added up as independent fires.
  Cross-sensor views are built on a 0.05 degree grid as "cell-day presence".
* Static thermal sources (hotspot type 2) are flagged, never deleted.
* A day with no record is a coverage fact, not proof of "no fire".
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from config import (
    HARMONIZED_DIR,
    PROCESSED_DIR,
    SOURCE_ARCHIVES,
    SourceArchive,
)
from data_cleaning import clean_archive_frame
from data_loader import file_sha256

logger = logging.getLogger(__name__)

GRID_SIZE_DEG = 0.05
YEARS = (2023, 2024, 2025)

# Satellite codes used by FIRMS -> readable platform names.
SATELLITE_NAMES = {
    "Terra": "Terra",
    "Aqua": "Aqua",
    "N20": "NOAA-20",
    "N21": "NOAA-21",
    "SNPP": "Suomi NPP",
}

# Nominal pixel size at nadir. Real pixels are larger toward the scan edge;
# the per-record ``scan_km`` and ``track_km`` columns keep that detail.
NOMINAL_RESOLUTION_M = {"MODIS": 1000, "VIIRS": 375}

HOTSPOT_TYPE_LABELS = {
    0: "presumed_vegetation_fire",
    1: "active_volcano",
    2: "other_static_land_source",
    3: "water_detection",
}

# First date with NOAA-21 active-fire science data (documented limitation).
NOAA21_SCIENCE_START = pd.Timestamp("2023-03-01")

# Source gaps documented for S-NPP 2024 (inclusive ranges).
SNPP_2024_DOCUMENTED_GAPS = (
    ("2024-05-30", "2024-06-03"),
    ("2024-07-10", "2024-07-15"),
    ("2024-07-25", "2024-07-28"),
    ("2024-09-26", "2024-09-26"),
    ("2024-11-03", "2024-11-05"),
)

# Days with no rows in the replacement NOAA-20 2023 file.
NOAA20_2023_DOCUMENTED_GAPS = (
    ("2023-07-19", "2023-07-22"),
    ("2023-09-30", "2023-10-01"),
)

# The validated full-year NOAA-20 2023 file replaces the January-only file
# in the harmonized dataset. The old file stays on disk as a backup.
NOAA20_2023_CANDIDATE = SourceArchive(
    sensor_key="NOAA20",
    sensor_family="VIIRS",
    product_id="J1V-C2",
    year=2023,
    archive_relpath="candidate",
    csv_name="firescope_noaa20_2023_candidate.csv",
)
NOAA20_2023_CANDIDATE_PATH = PROCESSED_DIR / "2023" / NOAA20_2023_CANDIDATE.csv_name

HARMONIZED_COLUMNS = [
    "record_id",
    "acquisition_datetime_utc",
    "acquisition_date",
    "acquisition_time_utc",
    "latitude",
    "longitude",
    "grid_cell_id",
    "grid_cell_lat",
    "grid_cell_lon",
    "sensor_key",
    "sensor_family",
    "instrument_name",
    "satellite_code",
    "satellite_name",
    "product_id",
    "product_version",
    "nominal_resolution_m",
    "scan_km",
    "track_km",
    "confidence_numeric",
    "confidence_class",
    "brightness_k",
    "brightness_t31_k",
    "frp_mw",
    "daynight",
    "hotspot_type",
    "hotspot_type_label",
    "is_static_source",
    "is_vegetation_fire_candidate",
    "is_water_detection",
    "is_exact_duplicate_within_sensor",
    "source_file",
    "source_archive",
    "input_origin",
]


@dataclass
class HarmonizationResult:
    harmonized: pd.DataFrame
    cell_day_presence: pd.DataFrame
    coverage_calendar: pd.DataFrame
    input_summary: pd.DataFrame


def _read_cleaned_csv(path) -> pd.DataFrame:
    """Read a Phase 2 output file. Strings stay strings; numbers are typed."""
    frame = pd.read_csv(
        path,
        dtype={
            "acquisition_time_raw": "string",
            "acquisition_time": "string",
            "acquisition_date": "string",
            "confidence": "string",
            "confidence_class": "string",
            "satellite": "string",
            "instrument": "string",
            "version": "string",
            "daynight": "string",
            "sensor_key": "string",
            "sensor_family": "string",
            "product_id": "string",
            "source_file": "string",
            "source_archive": "string",
        },
        keep_default_na=True,
    )
    # "n" is a real VIIRS confidence code. Pandas does not treat it as NA, but
    # keep an explicit guard so a future parser change cannot null it.
    return frame


def load_cleaned_inputs() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return all cleaned rows plus a per-file input summary.

    The 11 unchanged Phase 2 files are verified against the SHA-256 values
    recorded in the Phase 2 validation summary. NOAA-20 2023 comes from the
    full-year file, which is cleaned here with the same Phase 2 rules.
    """
    from config import REPORTS_DIR

    summary_path = REPORTS_DIR / "phase2_validation_summary.csv"
    recorded = pd.read_csv(summary_path)
    expected_hash = {
        (row.sensor_key, int(row.year)): row.output_sha256
        for row in recorded.itertuples()
    }

    frames: list[pd.DataFrame] = []
    summary_rows: list[dict] = []

    for source in SOURCE_ARCHIVES:
        key = (source.sensor_key, source.year)
        if key == ("NOAA20", 2023):
            continue
        path = PROCESSED_DIR / str(source.year) / source.output_name
        if not path.is_file():
            raise FileNotFoundError(f"Missing cleaned file: {path}")
        digest = file_sha256(path)
        if digest != expected_hash[key]:
            raise ValueError(f"Hash mismatch for {path.name}: file changed since Phase 2")
        frame = _read_cleaned_csv(path)
        frame["input_origin"] = "phase2_cleaned_file"
        frames.append(frame)
        summary_rows.append(
            {
                "sensor_key": source.sensor_key,
                "year": source.year,
                "input_file": path.name,
                "input_origin": "phase2_cleaned_file",
                "rows": len(frame),
                "sha256_matches_phase2": True,
            }
        )

    if not NOAA20_2023_CANDIDATE_PATH.is_file():
        raise FileNotFoundError(f"Missing NOAA-20 2023 candidate: {NOAA20_2023_CANDIDATE_PATH}")
    raw_candidate = pd.read_csv(
        NOAA20_2023_CANDIDATE_PATH,
        dtype=str,
        keep_default_na=False,
        na_filter=False,
    )
    result = clean_archive_frame(raw_candidate, NOAA20_2023_CANDIDATE)
    if len(result.rejected):
        raise ValueError(f"{len(result.rejected)} candidate rows were rejected; review before use")
    candidate = result.cleaned.copy()
    candidate["source_archive"] = "DL_FIRE_J1V-C2_845121 (1).zip (Shapefile, converted to CSV)"
    candidate["input_origin"] = "noaa20_2023_full_year_candidate"
    frames.append(candidate)
    summary_rows.append(
        {
            "sensor_key": "NOAA20",
            "year": 2023,
            "input_file": NOAA20_2023_CANDIDATE.csv_name,
            "input_origin": "noaa20_2023_full_year_candidate",
            "rows": len(candidate),
            "sha256_matches_phase2": None,
        }
    )

    combined = pd.concat(frames, ignore_index=True)
    return combined, pd.DataFrame(summary_rows)


def add_grid(frame: pd.DataFrame, size: float = GRID_SIZE_DEG) -> pd.DataFrame:
    """Add a regular grid cell id (lower-left corner) and cell center."""
    lat_index = np.floor(frame["latitude"].to_numpy() / size + 1e-9).astype(int)
    lon_index = np.floor(frame["longitude"].to_numpy() / size + 1e-9).astype(int)
    frame = frame.copy()
    frame["grid_cell_lat"] = np.round((lat_index + 0.5) * size, 4)
    frame["grid_cell_lon"] = np.round((lon_index + 0.5) * size, 4)
    frame["grid_cell_id"] = [f"G{a}_{b}" for a, b in zip(lat_index, lon_index)]
    return frame


def harmonize(frame: pd.DataFrame) -> pd.DataFrame:
    """Map cleaned rows to the harmonized schema without removing any row."""
    out = pd.DataFrame(index=frame.index)

    out["acquisition_date"] = frame["acquisition_date"].astype("string")
    out["acquisition_time_utc"] = frame["acquisition_time"].astype("string")
    out["acquisition_datetime_utc"] = (
        out["acquisition_date"] + "T" + out["acquisition_time_utc"] + "Z"
    )
    # A row without a valid time has no datetime. It keeps its date.
    out.loc[out["acquisition_time_utc"].isna(), "acquisition_datetime_utc"] = pd.NA

    out["latitude"] = frame["latitude"].astype(float)
    out["longitude"] = frame["longitude"].astype(float)

    out["sensor_key"] = frame["sensor_key"].astype("string")
    out["sensor_family"] = frame["sensor_family"].astype("string")
    # S-NPP rows carry instrument="SNPP" in the FIRMS file. The instrument is
    # still VIIRS, so the harmonized name is derived from the sensor family.
    out["instrument_name"] = frame["sensor_family"].astype("string")
    out["satellite_code"] = frame["satellite"].astype("string")
    out["satellite_name"] = frame["satellite"].map(SATELLITE_NAMES).astype("string")
    out["product_id"] = frame["product_id"].astype("string")
    out["product_version"] = frame["version"].astype("string")
    out["nominal_resolution_m"] = frame["sensor_family"].map(NOMINAL_RESOLUTION_M).astype("Int64")
    out["scan_km"] = frame["scan"].astype(float)
    out["track_km"] = frame["track"].astype(float)

    out["confidence_numeric"] = frame["confidence_numeric"].astype("Int64")
    out["confidence_class"] = frame["confidence_class"].astype("string")

    out["brightness_k"] = frame["brightness"].astype(float)
    out["brightness_t31_k"] = frame["bright_t31"].astype(float)
    out["frp_mw"] = frame["frp"].astype(float)
    out["daynight"] = frame["daynight"].astype("string")

    out["hotspot_type"] = frame["hotspot_type"].astype("Int64")
    out["hotspot_type_label"] = (
        out["hotspot_type"].map(HOTSPOT_TYPE_LABELS).astype("string")
    )
    out["is_static_source"] = (out["hotspot_type"] == 2).fillna(False).astype(bool)
    out["is_vegetation_fire_candidate"] = (out["hotspot_type"] == 0).fillna(False).astype(bool)
    out["is_water_detection"] = (out["hotspot_type"] == 3).fillna(False).astype(bool)

    out["source_file"] = frame["source_file"].astype("string")
    out["source_archive"] = frame["source_archive"].astype("string")
    out["input_origin"] = frame["input_origin"].astype("string")

    out = add_grid(out)

    # Flag, do not delete, rows that repeat the same sensor, instant, and place.
    duplicate_keys = [
        "sensor_key",
        "satellite_code",
        "acquisition_date",
        "acquisition_time_utc",
        "latitude",
        "longitude",
    ]
    out["is_exact_duplicate_within_sensor"] = out.duplicated(duplicate_keys, keep="first")

    out = out.sort_values(
        ["acquisition_date", "acquisition_time_utc", "sensor_key", "latitude", "longitude"],
        kind="mergesort",
        na_position="last",
    ).reset_index(drop=True)
    out.insert(0, "record_id", [f"FS{idx + 1:07d}" for idx in range(len(out))])
    return out[HARMONIZED_COLUMNS]


def build_cell_day_presence(harmonized: pd.DataFrame) -> pd.DataFrame:
    """One row per (date, grid cell) with at least one detection.

    This is the cross-sensor view. It answers "did any sensor see a detection
    in this cell on this day" and does not add sensor counts together.
    ``n_detections_by_sensor`` is kept per sensor only for transparency.
    """
    grouped = harmonized.groupby(["acquisition_date", "grid_cell_id"], sort=True)
    presence = grouped.agg(
        grid_cell_lat=("grid_cell_lat", "first"),
        grid_cell_lon=("grid_cell_lon", "first"),
        n_sensors_detecting=("sensor_key", "nunique"),
        sensors_detecting=("sensor_key", lambda s: "|".join(sorted(s.unique()))),
        has_vegetation_fire_candidate=("is_vegetation_fire_candidate", "any"),
        has_static_source=("is_static_source", "any"),
        has_water_detection=("is_water_detection", "any"),
    ).reset_index()
    presence["static_source_only"] = (
        presence["has_static_source"]
        & ~presence["has_vegetation_fire_candidate"]
        & ~presence["has_water_detection"]
    )
    return presence


def _documented_gap_days(ranges) -> set[str]:
    days: set[str] = set()
    for start, end in ranges:
        days.update(pd.date_range(start, end, freq="D").strftime("%Y-%m-%d"))
    return days


def build_coverage_calendar(harmonized: pd.DataFrame) -> pd.DataFrame:
    """Per sensor and calendar day, say whether the source has records.

    ``coverage_status`` values:
    * observed: at least one record exists.
    * not_expected_before_science_start: NOAA-21 before 2023-03-01.
    * documented_source_gap: a gap listed in the project notes.
    * no_records_unconfirmed: no record and no documented reason. This is a
      coverage fact. It is not evidence that no thermal activity happened.
    """
    all_days = pd.date_range(f"{YEARS[0]}-01-01", f"{YEARS[-1]}-12-31", freq="D")
    counts = (
        harmonized.groupby(["sensor_key", "acquisition_date"])
        .agg(
            n_records=("record_id", "size"),
            n_non_static_records=("is_static_source", lambda s: int((~s).sum())),
        )
        .reset_index()
    )
    sensors = sorted(harmonized["sensor_key"].unique())
    grid = pd.MultiIndex.from_product(
        [sensors, all_days.strftime("%Y-%m-%d")], names=["sensor_key", "acquisition_date"]
    ).to_frame(index=False)
    calendar = grid.merge(counts, on=["sensor_key", "acquisition_date"], how="left")
    calendar["n_records"] = calendar["n_records"].fillna(0).astype(int)
    calendar["n_non_static_records"] = calendar["n_non_static_records"].fillna(0).astype(int)

    snpp_gaps = _documented_gap_days(SNPP_2024_DOCUMENTED_GAPS)
    noaa20_gaps = _documented_gap_days(NOAA20_2023_DOCUMENTED_GAPS)

    status = np.where(calendar["n_records"] > 0, "observed", "no_records_unconfirmed")
    is_noaa21_early = (calendar["sensor_key"] == "NOAA21") & (
        pd.to_datetime(calendar["acquisition_date"]) < NOAA21_SCIENCE_START
    )
    status = np.where(
        (calendar["n_records"] == 0) & is_noaa21_early,
        "not_expected_before_science_start",
        status,
    )
    is_snpp_gap = (
        (calendar["sensor_key"] == "SNPP")
        & calendar["acquisition_date"].isin(snpp_gaps)
        & (calendar["n_records"] == 0)
    )
    is_noaa20_gap = (
        (calendar["sensor_key"] == "NOAA20")
        & calendar["acquisition_date"].isin(noaa20_gaps)
        & (calendar["n_records"] == 0)
    )
    status = np.where(is_snpp_gap | is_noaa20_gap, "documented_source_gap", status)
    calendar["coverage_status"] = status
    return calendar


def run_harmonization(write: bool = True) -> HarmonizationResult:
    combined, input_summary = load_cleaned_inputs()
    harmonized = harmonize(combined)
    presence = build_cell_day_presence(harmonized)
    coverage = build_coverage_calendar(harmonized)

    if write:
        HARMONIZED_DIR.mkdir(parents=True, exist_ok=True)
        harmonized.to_csv(
            HARMONIZED_DIR / "firescope_harmonized.csv", index=False, na_rep="", lineterminator="\n"
        )
        presence.to_csv(
            HARMONIZED_DIR / "cell_day_presence.csv", index=False, lineterminator="\n"
        )
        coverage.to_csv(
            HARMONIZED_DIR / "coverage_calendar.csv", index=False, lineterminator="\n"
        )
        input_summary.to_csv(
            HARMONIZED_DIR / "harmonization_inputs.csv", index=False, lineterminator="\n"
        )
    return HarmonizationResult(harmonized, presence, coverage, input_summary)
