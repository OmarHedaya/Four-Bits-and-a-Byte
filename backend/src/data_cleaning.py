"""Standardize FIRMS hotspot tables without adding observations."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date, timedelta

import pandas as pd

from config import (
    NUMERIC_COLUMNS,
    SOURCE_TO_STANDARD,
    STANDARD_COLUMNS,
    VIIRS_CONFIDENCE_CLASSES,
    SourceArchive,
)

logger = logging.getLogger(__name__)

TIME_TOKEN = re.compile(r"^\d{1,4}$")


@dataclass
class DateRange:
    start: date
    end: date
    days: int


@dataclass
class CoverageAssessment:
    status: str
    note: str
    redownload_start: str | None = None
    redownload_end: str | None = None
    ranges: list[DateRange] = field(default_factory=list)


@dataclass
class CleanResult:
    cleaned: pd.DataFrame
    rejected: pd.DataFrame
    stats: dict


def _blank_to_na(series: pd.Series) -> pd.Series:
    text = series.fillna("").astype(str).str.strip()
    text = text.mask(text.eq(""))
    return text


def normalize_acquisition_time(raw_value: object) -> tuple[str | None, str | None, str]:
    """Return ``(HH:MM:SS, raw token, status)``.

    Status is ``ok``, ``missing``, or ``invalid``. Invalid clock values are
    not replaced with a guessed time.
    """
    if raw_value is None or (isinstance(raw_value, float) and pd.isna(raw_value)):
        return None, None, "missing"
    token = str(raw_value).strip()
    if token == "" or token.lower() in {"nan", "none", "<na>"}:
        return None, None, "missing"
    if not TIME_TOKEN.match(token):
        return None, token, "invalid"
    hhmm = token.zfill(4)
    hours = int(hhmm[:2])
    minutes = int(hhmm[2:])
    if hours > 23 or minutes > 59:
        return None, token, "invalid"
    return f"{hours:02d}:{minutes:02d}:00", token, "ok"


def split_confidence(raw_value: object, sensor_family: str) -> tuple[str | None, int | None, str | None, str]:
    """Keep MODIS scores and VIIRS classes in separate columns.

    Returns ``(confidence, confidence_numeric, confidence_class, status)``.
    No VIIRS letter is converted into a 0–100 score.
    """
    if raw_value is None or (isinstance(raw_value, float) and pd.isna(raw_value)):
        return None, None, None, "missing"
    token = str(raw_value).strip()
    if token == "":
        return None, None, None, "missing"

    if sensor_family == "MODIS":
        try:
            number = float(token)
        except ValueError:
            return token, None, None, "unrecognized"
        if not number.is_integer() or number < 0 or number > 100:
            return token, None, None, "out_of_range"
        score = int(number)
        return str(score), score, None, "ok"

    code = token.lower()
    if code in VIIRS_CONFIDENCE_CLASSES:
        return code, None, code, "ok"
    return token, None, None, "unrecognized"


def calendar_days_absent(acquisition_dates: pd.Series, year: int) -> list[date]:
    """Calendar days in ``year`` that have no row. This does not create rows."""
    observed = set(pd.to_datetime(acquisition_dates, errors="coerce").dt.date.dropna())
    start = date(year, 1, 1)
    end = date(year, 12, 31)
    absent: list[date] = []
    current = start
    while current <= end:
        if current not in observed:
            absent.append(current)
        current += timedelta(days=1)
    return absent


def group_date_ranges(days: list[date]) -> list[DateRange]:
    if not days:
        return []
    ordered = sorted(days)
    ranges: list[DateRange] = []
    start = previous = ordered[0]
    for current in ordered[1:]:
        if current == previous + timedelta(days=1):
            previous = current
            continue
        ranges.append(DateRange(start, previous, (previous - start).days + 1))
        start = previous = current
    ranges.append(DateRange(start, previous, (previous - start).days + 1))
    return ranges


def _format_ranges(ranges: list[DateRange]) -> str:
    if not ranges:
        return "none"
    parts = []
    for item in ranges:
        if item.start == item.end:
            parts.append(f"{item.start.isoformat()} (1 day)")
        else:
            parts.append(
                f"{item.start.isoformat()} through {item.end.isoformat()} ({item.days} days)"
            )
    return "; ".join(parts)


def assess_coverage(
    sensor_key: str,
    year: int,
    acquisition_dates: pd.Series,
) -> CoverageAssessment:
    """Label the three known coverage cases and leave every gap empty."""
    absent = calendar_days_absent(acquisition_dates, year)
    ranges = group_date_ranges(absent)
    parsed = pd.to_datetime(acquisition_dates, errors="coerce").dt.date.dropna()
    first = min(parsed) if len(parsed) else None
    last = max(parsed) if len(parsed) else None

    if sensor_key == "NOAA20" and year == 2023:
        missing_after_january = [day for day in absent if day >= date(2023, 2, 1)]
        if missing_after_january:
            redownload_start = min(missing_after_january)
            redownload_end = max(missing_after_january)
            observed = (
                f"{first.isoformat()} through {last.isoformat()}"
                if first and last
                else "no parsed dates"
            )
            note = (
                "Incomplete archive. This file is not complete annual coverage for 2023. "
                f"Observed acquisition dates run {observed}. "
                f"No observations are present from {redownload_start.isoformat()} through "
                f"{redownload_end.isoformat()} ({len(missing_after_january)} days). "
                "Download the NOAA-20 VIIRS Collection 2 (J1V-C2) Egypt archive again "
                f"for {redownload_start.isoformat()} through {redownload_end.isoformat()}. "
                "January rows already in the file were kept. No rows were created for the missing months."
            )
            return CoverageAssessment(
                status="incomplete",
                note=note,
                redownload_start=redownload_start.isoformat(),
                redownload_end=redownload_end.isoformat(),
                ranges=ranges,
            )

    if sensor_key == "NOAA21" and year == 2023:
        before_science = [day for day in absent if day < date(2023, 3, 1)]
        after_start = [day for day in absent if day >= date(2023, 3, 1)]
        note = (
            "Expected coverage limitation, not a file error. NOAA-21 active-fire "
            "science data begin on 2023-03-01. "
            f"This file's first acquisition date is {first.isoformat() if first else 'missing'}. "
            f"Days with no row before 2023-03-01: {len(before_science)}. "
            "Those days were not filled."
        )
        if after_start:
            extra = group_date_ranges(after_start)
            note += (
                " Additional dates on or after 2023-03-01 also have no row and were left empty: "
                + _format_ranges(extra)
                + "."
            )
        return CoverageAssessment(
            status="expected_limitation",
            note=note,
            ranges=ranges,
        )

    if sensor_key == "SNPP" and year == 2024 and absent:
        note = (
            "Gaps preserved. The S-NPP 2024 source has no rows on "
            f"{len(absent)} calendar days: {_format_ranges(ranges)}. "
            "No observations were generated, interpolated, or copied into those days."
        )
        return CoverageAssessment(status="gaps_preserved", note=note, ranges=ranges)

    if not absent:
        note = (
            f"Every calendar day in {year} has at least one source row. "
            "No rows were added."
        )
        return CoverageAssessment(status="no_calendar_gaps", note=note, ranges=[])

    note = (
        f"{len(absent)} calendar days in {year} have no row in the source file: "
        f"{_format_ranges(ranges)}. "
        "These days were left empty. No observations were invented. "
        "For MODIS, a day with no row is consistent with a 1 km product that "
        "records few detections; it is not marked as a truncated download."
    )
    return CoverageAssessment(status="empty_days_preserved", note=note, ranges=ranges)


def _reject_frame(source_rows: pd.DataFrame, reasons: pd.Series) -> pd.DataFrame:
    rejected = source_rows.loc[reasons.notna()].copy()
    rejected.insert(0, "reject_reason", reasons.loc[reasons.notna()].astype(str))
    return rejected


def clean_archive_frame(raw: pd.DataFrame, source: SourceArchive) -> CleanResult:
    """Standardize one archive. The returned frame has one row per kept detection."""
    unknown = [column for column in raw.columns if column not in SOURCE_TO_STANDARD]
    missing = [column for column in SOURCE_TO_STANDARD if column not in raw.columns]
    if missing:
        logger.warning("%s is missing source columns: %s", source.csv_name, missing)
    if unknown:
        logger.warning("%s has unexpected columns, which are retained: %s", source.csv_name, unknown)

    working = pd.DataFrame(index=raw.index)
    for source_name, standard_name in SOURCE_TO_STANDARD.items():
        if source_name in raw.columns:
            working[standard_name] = _blank_to_na(raw[source_name])
        else:
            working[standard_name] = pd.NA

    for column in NUMERIC_COLUMNS:
        working[column] = pd.to_numeric(working[column], errors="coerce")

    parsed_dates = pd.to_datetime(
        working["acquisition_date"],
        format="%Y-%m-%d",
        errors="coerce",
    )
    working["acquisition_date"] = parsed_dates.dt.strftime("%Y-%m-%d")
    working.loc[parsed_dates.isna(), "acquisition_date"] = pd.NA

    time_parts = working["acquisition_time_raw"].map(normalize_acquisition_time)
    working["acquisition_time"] = time_parts.map(lambda item: item[0])
    working["acquisition_time_raw"] = time_parts.map(lambda item: item[1])
    time_status = time_parts.map(lambda item: item[2])

    confidence_parts = working["confidence"].map(
        lambda value: split_confidence(value, source.sensor_family)
    )
    working["confidence"] = confidence_parts.map(lambda item: item[0])
    working["confidence_numeric"] = pd.array(
        [item[1] for item in confidence_parts],
        dtype="Int64",
    )
    working["confidence_class"] = confidence_parts.map(lambda item: item[2])
    confidence_status = confidence_parts.map(lambda item: item[3])

    hotspot = working["hotspot_type"]
    hotspot_numeric = pd.to_numeric(hotspot, errors="coerce")
    integral = hotspot_numeric.notna() & (hotspot_numeric % 1 == 0)
    working["hotspot_type"] = pd.array(
        [int(value) if ok else pd.NA for value, ok in zip(hotspot_numeric, integral)],
        dtype="Int64",
    )

    if "daynight" in working:
        working["daynight"] = working["daynight"].map(
            lambda value: None if value is None or pd.isna(value) else str(value).strip().upper()
        )

    for column in ("satellite", "instrument", "version"):
        working[column] = working[column].map(
            lambda value: None if value is None or pd.isna(value) else str(value).strip()
        )

    working["sensor_key"] = source.sensor_key
    working["sensor_family"] = source.sensor_family
    working["product_id"] = source.product_id
    working["source_file"] = source.csv_name
    working["source_archive"] = source.archive_relpath.replace("\\", "/")

    for column in unknown:
        working[column] = _blank_to_na(raw[column])

    invalid_coord = (
        working["latitude"].isna()
        | working["longitude"].isna()
        | ~working["latitude"].between(-90, 90)
        | ~working["longitude"].between(-180, 180)
    )
    invalid_date = parsed_dates.isna()
    reasons = pd.Series(pd.NA, index=working.index, dtype="object")
    reasons = reasons.mask(invalid_coord, "invalid_coordinates")
    reasons = reasons.mask(invalid_date & reasons.isna(), "invalid_acquisition_date")
    reasons = reasons.mask(
        invalid_coord & invalid_date,
        "invalid_coordinates_and_acquisition_date",
    )

    rejected = _reject_frame(working, reasons)
    cleaned = working.loc[reasons.isna()].copy()

    ordered = [column for column in STANDARD_COLUMNS if column in cleaned.columns]
    extras = [column for column in cleaned.columns if column not in ordered]
    cleaned = cleaned[ordered + extras]
    cleaned.reset_index(drop=True, inplace=True)

    coverage = assess_coverage(source.sensor_key, source.year, cleaned["acquisition_date"])
    four_digit_raw = cleaned["acquisition_time_raw"].fillna("").astype(str).str.fullmatch(r"\d{4}")
    raw_present = cleaned["acquisition_time_raw"].notna()

    stats = {
        "sensor_key": source.sensor_key,
        "sensor_family": source.sensor_family,
        "product_id": source.product_id,
        "year": source.year,
        "source_archive": source.archive_relpath.replace("\\", "/"),
        "source_file": source.csv_name,
        "rows_in": int(len(raw)),
        "rows_out": int(len(cleaned)),
        "rows_rejected": int(len(rejected)),
        "rows_synthesized": 0,
        "unknown_columns": unknown,
        "missing_source_columns": missing,
        "reject_reasons": rejected["reject_reason"].value_counts().to_dict() if len(rejected) else {},
        "date_min": None if cleaned["acquisition_date"].dropna().empty else str(cleaned["acquisition_date"].min()),
        "date_max": None if cleaned["acquisition_date"].dropna().empty else str(cleaned["acquisition_date"].max()),
        "unique_dates": int(cleaned["acquisition_date"].nunique(dropna=True)),
        "coverage_status": coverage.status,
        "coverage_note": coverage.note,
        "redownload_start": coverage.redownload_start,
        "redownload_end": coverage.redownload_end,
        "absent_ranges": [
            {
                "start": item.start.isoformat(),
                "end": item.end.isoformat(),
                "days": item.days,
            }
            for item in coverage.ranges
        ],
        "absent_days": int(sum(item.days for item in coverage.ranges)),
        "time_missing": int((time_status.loc[reasons.isna()] == "missing").sum()),
        "time_invalid": int((time_status.loc[reasons.isna()] == "invalid").sum()),
        "time_raw_not_four_digits": int((raw_present & ~four_digit_raw).sum()),
        "confidence_status": confidence_status.loc[reasons.isna()].value_counts().to_dict(),
        "confidence_values": cleaned["confidence"].value_counts(dropna=False).to_dict(),
        "confidence_class_values": cleaned["confidence_class"].value_counts(dropna=False).to_dict(),
        "satellite_values": cleaned["satellite"].value_counts(dropna=False).to_dict(),
        "instrument_values": cleaned["instrument"].value_counts(dropna=False).to_dict(),
        "daynight_values": cleaned["daynight"].value_counts(dropna=False).to_dict(),
        "hotspot_type_values": {
            str(key): int(value)
            for key, value in cleaned["hotspot_type"].value_counts(dropna=False).items()
        },
        "version_values": cleaned["version"].value_counts(dropna=False).to_dict(),
        "frp_zero": int((cleaned["frp"] == 0).sum()),
        "frp_null": int(cleaned["frp"].isna().sum()),
        "null_counts": {column: int(cleaned[column].isna().sum()) for column in cleaned.columns},
        "latitude_min": None if cleaned["latitude"].dropna().empty else float(cleaned["latitude"].min()),
        "latitude_max": None if cleaned["latitude"].dropna().empty else float(cleaned["latitude"].max()),
        "longitude_min": None if cleaned["longitude"].dropna().empty else float(cleaned["longitude"].min()),
        "longitude_max": None if cleaned["longitude"].dropna().empty else float(cleaned["longitude"].max()),
    }
    logger.info(
        "Cleaned %s %s: in=%s out=%s rejected=%s coverage=%s",
        source.sensor_key,
        source.year,
        stats["rows_in"],
        stats["rows_out"],
        stats["rows_rejected"],
        stats["coverage_status"],
    )
    return CleanResult(cleaned=cleaned, rejected=rejected, stats=stats)
