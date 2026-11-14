"""Run Phase 2 cleaning and write the validation report.

Harmonization, spatial aggregation, and the Fire Activity Index are out of scope.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd

from config import EXTRACTED_RAW_CSVS, PROCESSED_DIR, PROJECT_ROOT, RAW_DIR, REPORTS_DIR, SOURCE_ARCHIVES
from data_cleaning import clean_archive_frame
from data_loader import file_sha256, load_archive_csv

logger = logging.getLogger(__name__)

SNPP_2024_GAP_RANGES = (
    ("2024-05-30", "2024-06-03", 5),
    ("2024-07-10", "2024-07-15", 6),
    ("2024-07-25", "2024-07-28", 4),
    ("2024-09-26", "2024-09-26", 1),
    ("2024-11-03", "2024-11-05", 3),
)


def _raw_fingerprint_paths() -> list[Path]:
    paths = [source.archive_path for source in SOURCE_ARCHIVES]
    paths.extend(RAW_DIR / Path(*relative.replace("\\", "/").split("/")) for relative in EXTRACTED_RAW_CSVS)
    return paths


def _fingerprint(paths: list[Path]) -> dict[str, str]:
    found = {}
    for path in paths:
        if not path.is_file():
            raise FileNotFoundError(f"Expected raw file is missing: {path}")
        found[str(path.relative_to(PROJECT_ROOT)).replace("\\", "/")] = file_sha256(path)
    return found


def _jsonable(value):
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _validate_against_rules(stats: dict, cleaned: pd.DataFrame) -> list[str]:
    """Return hard failures. Empty means this file passed the Phase 2 checks."""
    failures: list[str] = []
    label = f"{stats['sensor_key']} {stats['year']}"
    if stats["rows_out"] + stats["rows_rejected"] != stats["rows_in"]:
        failures.append(f"{label}: output rows plus rejected rows do not equal input rows")
    if stats["rows_synthesized"] != 0:
        failures.append(f"{label}: synthesized rows were produced")
    if cleaned["source_file"].nunique() != 1 or cleaned["source_file"].iloc[0] != stats["source_file"]:
        failures.append(f"{label}: source_file was not kept on every row")
    if cleaned["satellite"].isna().any() or cleaned["instrument"].isna().any():
        failures.append(f"{label}: satellite or instrument is missing")

    if stats["sensor_family"] == "MODIS":
        if cleaned["confidence_class"].notna().any():
            failures.append(f"{label}: MODIS rows received a VIIRS confidence class")
        if cleaned["confidence_numeric"].isna().any():
            failures.append(f"{label}: a MODIS confidence score could not be kept as an integer")
    if stats["sensor_family"] == "VIIRS":
        if cleaned["confidence_numeric"].notna().any():
            failures.append(f"{label}: a VIIRS confidence letter was converted to a number")
        if cleaned["confidence_class"].isna().any():
            failures.append(f"{label}: a VIIRS confidence value was not kept as l, n, or h")
        if not set(cleaned["confidence_class"].dropna().unique()).issubset({"l", "n", "h"}):
            failures.append(f"{label}: unexpected VIIRS confidence class")

    if stats["sensor_key"] == "NOAA20" and stats["year"] == 2023:
        if stats["coverage_status"] != "incomplete":
            failures.append("NOAA-20 2023 was not marked incomplete")
        if stats["date_min"] != "2023-01-01" or stats["date_max"] != "2023-01-31":
            failures.append(
                f"NOAA-20 2023 date span is {stats['date_min']} to {stats['date_max']}, expected January only"
            )
        if stats["redownload_start"] != "2023-02-01" or stats["redownload_end"] != "2023-12-31":
            failures.append("NOAA-20 2023 re-download range is not 2023-02-01 through 2023-12-31")
        outside_january = ~cleaned["acquisition_date"].str.startswith("2023-01")
        if outside_january.any():
            failures.append("NOAA-20 2023 contains rows outside January")

    if stats["sensor_key"] == "NOAA21" and stats["year"] == 2023:
        if stats["coverage_status"] != "expected_limitation":
            failures.append("NOAA-21 2023 was not marked as an expected coverage limitation")
        if stats["date_min"] != "2023-03-01":
            failures.append(f"NOAA-21 2023 starts on {stats['date_min']}, expected 2023-03-01")
        early = cleaned["acquisition_date"] < "2023-03-01"
        if early.any():
            failures.append("NOAA-21 2023 contains rows before the March science-data start")

    if stats["sensor_key"] == "SNPP" and stats["year"] == 2024:
        if stats["coverage_status"] != "gaps_preserved":
            failures.append("S-NPP 2024 gaps were not marked as preserved")
        observed = [
            (item["start"], item["end"], item["days"]) for item in stats["absent_ranges"]
        ]
        if tuple(observed) != SNPP_2024_GAP_RANGES:
            failures.append(f"S-NPP 2024 gap ranges changed: {observed}")
        absent = set()
        for start, end, _days in SNPP_2024_GAP_RANGES:
            for day in pd.date_range(start, end, freq="D"):
                absent.add(day.strftime("%Y-%m-%d"))
        leaked = set(cleaned["acquisition_date"]).intersection(absent)
        if leaked:
            failures.append(f"S-NPP 2024 has invented or unexpected rows on gap days: {sorted(leaked)}")

    if stats["sensor_key"] == "SNPP":
        instruments = set(cleaned["instrument"].unique())
        if instruments != {"SNPP"}:
            failures.append(f"S-NPP instrument values were changed: {instruments}")

    return failures


def _write_cleaned_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False, na_rep="", lineterminator="\n")


def _render_report(file_stats: list[dict], fingerprints_match: bool) -> str:
    lines = [
        "# FireScope Phase 2 — Cleaning and Validation Report",
        "",
        "Phase 2 standardizes the 12 archive CSVs. It does not harmonize sensors,",
        "aggregate grid cells, or calculate a Fire Activity Index.",
        "Raw zip archives and the extracted MODIS CSVs were opened for reading only.",
        f"Raw-file SHA-256 fingerprints unchanged after the run: **{fingerprints_match}**.",
        "",
        "## Coverage decisions",
        "",
    ]
    for stats in file_stats:
        if stats["coverage_status"] not in {"incomplete", "expected_limitation", "gaps_preserved"}:
            continue
        lines.append(f"### {stats['sensor_key']} {stats['year']} — {stats['coverage_status']}")
        lines.append("")
        lines.append(stats["coverage_note"])
        lines.append("")
        lines.append(
            f"Rows in: {stats['rows_in']}. Rows written: {stats['rows_out']}. "
            f"Rows rejected: {stats['rows_rejected']}. Rows synthesized: {stats['rows_synthesized']}."
        )
        lines.append("")

    lines.extend(
        [
            "## Transformations applied to every kept row",
            "",
            "- Read each CSV from its zip as text. Default pandas NA tokens were disabled so the VIIRS confidence code `n` cannot be dropped, and `acq_time` values such as `0051` stay four-digit text.",
            "- Renamed columns by name: `acq_date` to `acquisition_date`, `acq_time` to `acquisition_time_raw`, `type` to `hotspot_type`. Latitude, longitude, brightness, `bright_t31`, FRP, scan, track, satellite, instrument, confidence, version, and daynight keep their source names.",
            "- Parsed `acquisition_date` with the strict format `YYYY-MM-DD` and wrote it back in that format.",
            "- Validated `acquisition_time_raw` as HHMM and wrote `acquisition_time` as `HH:MM:SS`. The raw token is kept. An impossible clock is left blank rather than replaced.",
            "- Parsed latitude, longitude, brightness, `bright_t31`, FRP, scan, and track as numbers. Empty input stays empty. FRP values of 0 stay 0.",
            "- Stored MODIS `confidence` as the original integer text and copied it to `confidence_numeric` (0–100). `confidence_class` is empty for MODIS.",
            "- Stored VIIRS `confidence` as `l`, `n`, or `h` and copied it to `confidence_class`. `confidence_numeric` is empty for VIIRS. Letters were not mapped onto the MODIS 0–100 scale.",
            "- Left `satellite` and `instrument` as stored. S-NPP stays `instrument=SNPP`. Terra and Aqua stay together in the MODIS year file, distinguished by `satellite`.",
            "- Added `sensor_key`, `sensor_family`, and `product_id` from the archive identity, plus `source_file` and `source_archive` on every row.",
            "- Removed a row only when coordinates were null or outside -90/90 and -180/180, or when the acquisition date did not match `YYYY-MM-DD`. No row was added for a missing calendar day.",
            "- `bright_t31` was kept under that source name. The cleaner does not rename it to a VIIRS channel.",
            "",
            "## Per-file validation",
            "",
            "| File | Rows in | Rows out | Rejected | Date min | Date max | Days with rows | Absent days | Coverage |",
            "| --- | ---: | ---: | ---: | --- | --- | ---: | ---: | --- |",
        ]
    )
    for stats in file_stats:
        lines.append(
            "| {sensor}_{year} | {rows_in} | {rows_out} | {rows_rejected} | {date_min} | {date_max} | {unique_dates} | {absent_days} | {coverage_status} |".format(
                sensor=stats["sensor_key"],
                year=stats["year"],
                rows_in=f"{stats['rows_in']:,}",
                rows_out=f"{stats['rows_out']:,}",
                rows_rejected=f"{stats['rows_rejected']:,}",
                date_min=stats["date_min"],
                date_max=stats["date_max"],
                unique_dates=f"{stats['unique_dates']:,}",
                absent_days=f"{stats['absent_days']:,}",
                coverage_status=stats["coverage_status"],
            )
        )

    lines.extend(["", "## Confidence, satellite, and instrument", ""])
    for stats in file_stats:
        lines.append(f"### {stats['sensor_key']} {stats['year']}")
        lines.append("")
        lines.append(f"- Output: `data/processed/{stats['year']}/{stats['sensor_key']}_{stats['year']}.csv`")
        lines.append(f"- Source: `{stats['source_archive']}` / `{stats['source_file']}`")
        lines.append(f"- Satellite values: `{stats['satellite_values']}`")
        lines.append(f"- Instrument values: `{stats['instrument_values']}`")
        lines.append(f"- Confidence status counts: `{stats['confidence_status']}`")
        lines.append(f"- Version values: `{stats['version_values']}`")
        lines.append(
            f"- Time tokens that were not already four digits: {stats['time_raw_not_four_digits']}. "
            f"Invalid clocks left blank: {stats['time_invalid']}. Missing times: {stats['time_missing']}."
        )
        lines.append(
            f"- FRP equal to 0 (kept): {stats['frp_zero']}. FRP null: {stats['frp_null']}."
        )
        lines.append(f"- Null counts: `{stats['null_counts']}`")
        lines.append(f"- Hotspot type counts: `{stats['hotspot_type_values']}`")
        lines.append(f"- Day/night counts: `{stats['daynight_values']}`")
        if stats["absent_ranges"]:
            rendered = "; ".join(
                f"{item['start']} to {item['end']} ({item['days']} days)"
                for item in stats["absent_ranges"]
            )
            lines.append(f"- Calendar days with no source row, left empty: {rendered}")
        lines.append(f"- Coverage: {stats['coverage_note']}")
        lines.append("")

    total_in = sum(item["rows_in"] for item in file_stats)
    total_out = sum(item["rows_out"] for item in file_stats)
    total_rejected = sum(item["rows_rejected"] for item in file_stats)
    lines.extend(
        [
            "## Result",
            "",
            f"Input rows: {total_in:,}. Cleaned rows: {total_out:,}. Rejected rows: {total_rejected:,}. Synthesized rows: 0.",
            "",
            "Phase 3 has not been run.",
            "",
        ]
    )
    return "\n".join(lines)


def run_phase2() -> list[dict]:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    log_path = REPORTS_DIR / "phase2_cleaning.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(log_path, mode="w", encoding="utf-8"),
        ],
        force=True,
    )

    raw_paths = _raw_fingerprint_paths()
    before = _fingerprint(raw_paths)
    failures: list[str] = []
    file_stats: list[dict] = []

    for source in SOURCE_ARCHIVES:
        raw = load_archive_csv(source)
        result = clean_archive_frame(raw, source)
        output_path = PROCESSED_DIR / str(source.year) / source.output_name
        _write_cleaned_csv(result.cleaned, output_path)
        if len(result.rejected):
            rejected_path = PROCESSED_DIR / "rejected" / source.output_name
            _write_cleaned_csv(result.rejected, rejected_path)
            result.stats["rejected_file"] = str(rejected_path.relative_to(PROJECT_ROOT)).replace("\\", "/")
        else:
            result.stats["rejected_file"] = None
        result.stats["output_file"] = str(output_path.relative_to(PROJECT_ROOT)).replace("\\", "/")
        result.stats["output_sha256"] = file_sha256(output_path)
        failures.extend(_validate_against_rules(result.stats, result.cleaned))
        file_stats.append(result.stats)

    after = _fingerprint(raw_paths)
    fingerprints_match = before == after
    if not fingerprints_match:
        failures.append("A raw archive or extracted MODIS CSV changed during Phase 2")

    summary_rows = []
    for stats in file_stats:
        summary_rows.append(
            {
                "sensor_key": stats["sensor_key"],
                "year": stats["year"],
                "rows_in": stats["rows_in"],
                "rows_out": stats["rows_out"],
                "rows_rejected": stats["rows_rejected"],
                "rows_synthesized": stats["rows_synthesized"],
                "date_min": stats["date_min"],
                "date_max": stats["date_max"],
                "unique_dates": stats["unique_dates"],
                "absent_days": stats["absent_days"],
                "coverage_status": stats["coverage_status"],
                "redownload_start": stats["redownload_start"],
                "redownload_end": stats["redownload_end"],
                "time_invalid": stats["time_invalid"],
                "time_raw_not_four_digits": stats["time_raw_not_four_digits"],
                "frp_zero": stats["frp_zero"],
                "output_file": stats["output_file"],
                "output_sha256": stats["output_sha256"],
                "source_archive": stats["source_archive"],
                "source_file": stats["source_file"],
            }
        )
    summary = pd.DataFrame(summary_rows)
    summary_path = REPORTS_DIR / "phase2_validation_summary.csv"
    summary.to_csv(summary_path, index=False, lineterminator="\n")

    report = _render_report(file_stats, fingerprints_match)
    report_path = REPORTS_DIR / "phase2_cleaning_report.md"
    report_path.write_text(report, encoding="utf-8")

    details_path = REPORTS_DIR / "phase2_cleaning_details.json"
    details_path.write_text(
        json.dumps(
            {
                "raw_fingerprints_unchanged": fingerprints_match,
                "failures": failures,
                "files": _jsonable(file_stats),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    if failures:
        for failure in failures:
            logger.error("Validation failure: %s", failure)
        raise RuntimeError("Phase 2 validation failed:\n- " + "\n- ".join(failures))

    logger.info("Phase 2 complete. Report: %s", report_path)
    return file_stats
