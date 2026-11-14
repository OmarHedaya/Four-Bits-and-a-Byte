"""Paths and the twelve source archives used by Phase 2.

Raw files stay where they were downloaded. This module only points at them.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
# Raw FIRMS downloads. Archive paths below are relative to this folder.
RAW_DIR = PROJECT_ROOT / "Data_Before_cleaning"
# The cleaned Phase 2 files live in ``data_cleand/processed`` in this project.
PROCESSED_DIR = PROJECT_ROOT / "data_cleand" / "processed"
HARMONIZED_DIR = PROJECT_ROOT / "data" / "harmonized"
REPORTS_DIR = PROJECT_ROOT / "reports"

# Columns a cleaned file always has, in this order. Fields a sensor does not
# provide are written as empty cells. They are not filled with guessed values.
STANDARD_COLUMNS = [
    "latitude",
    "longitude",
    "acquisition_date",
    "acquisition_time",
    "satellite",
    "instrument",
    "confidence",
    "confidence_numeric",
    "confidence_class",
    "brightness",
    "bright_t31",
    "frp",
    "daynight",
    "scan",
    "track",
    "hotspot_type",
    "version",
    "acquisition_time_raw",
    "sensor_key",
    "sensor_family",
    "product_id",
    "source_file",
    "source_archive",
]

SOURCE_TO_STANDARD = {
    "latitude": "latitude",
    "longitude": "longitude",
    "brightness": "brightness",
    "scan": "scan",
    "track": "track",
    "acq_date": "acquisition_date",
    "acq_time": "acquisition_time_raw",
    "satellite": "satellite",
    "instrument": "instrument",
    "confidence": "confidence",
    "version": "version",
    "bright_t31": "bright_t31",
    "frp": "frp",
    "daynight": "daynight",
    "type": "hotspot_type",
}

NUMERIC_COLUMNS = (
    "latitude",
    "longitude",
    "brightness",
    "bright_t31",
    "frp",
    "scan",
    "track",
)

VIIRS_CONFIDENCE_CLASSES = {"l", "n", "h"}


@dataclass(frozen=True)
class SourceArchive:
    """One FIRMS CSV inside a zip. Terra and Aqua share the MODIS file."""

    sensor_key: str
    sensor_family: str
    product_id: str
    year: int
    archive_relpath: str
    csv_name: str

    @property
    def archive_path(self) -> Path:
        # Relative paths were recorded with Windows separators. Normalize them
        # so the same config works on Windows, Linux, and macOS.
        return RAW_DIR / Path(*self.archive_relpath.replace("\\", "/").split("/"))

    @property
    def output_name(self) -> str:
        return f"{self.sensor_key}_{self.year}.csv"


# Explicit list. The 2026 zips, including the NOAA-20 file copied into the
# S-NPP folder, are outside this phase.
SOURCE_ARCHIVES: tuple[SourceArchive, ...] = (
    SourceArchive("MODIS", "MODIS", "M-C61", 2023, r"Modis\DL_FIRE_M-C61_844811_2023.zip", "fire_archive_M-C61_844811.csv"),
    SourceArchive("MODIS", "MODIS", "M-C61", 2024, r"Modis\DL_FIRE_M-C61_844824_2024.zip", "fire_archive_M-C61_844824.csv"),
    SourceArchive("MODIS", "MODIS", "M-C61", 2025, r"Modis\DL_FIRE_M-C61_844838_2025.zip", "fire_archive_M-C61_844838.csv"),
    SourceArchive("NOAA20", "VIIRS", "J1V-C2", 2023, r"VIIRS NOAA-20\DL_FIRE_J1V-C2_844848_2023.zip", "fire_archive_J1V-C2_844848.csv"),
    SourceArchive("NOAA20", "VIIRS", "J1V-C2", 2024, r"VIIRS NOAA-20\DL_FIRE_J1V-C2_844849_2024.zip", "fire_archive_J1V-C2_844849.csv"),
    SourceArchive("NOAA20", "VIIRS", "J1V-C2", 2025, r"VIIRS NOAA-20\DL_FIRE_J1V-C2_844850_2025.zip", "fire_archive_J1V-C2_844850.csv"),
    SourceArchive("NOAA21", "VIIRS", "J2V-C2", 2023, r"VIIRS NOAA-21\DL_FIRE_J2V-C2_844851_2023.zip", "fire_archive_J2V-C2_844851.csv"),
    SourceArchive("NOAA21", "VIIRS", "J2V-C2", 2024, r"VIIRS NOAA-21\DL_FIRE_J2V-C2_844852_2024.zip", "fire_archive_J2V-C2_844852.csv"),
    SourceArchive("NOAA21", "VIIRS", "J2V-C2", 2025, r"VIIRS NOAA-21\DL_FIRE_J2V-C2_844853_2025.zip", "fire_archive_J2V-C2_844853.csv"),
    SourceArchive("SNPP", "VIIRS", "SV-C2", 2023, r"VIIRS S-NPP\DL_FIRE_SV-C2_844842_2023.zip", "fire_archive_SV-C2_844842.csv"),
    SourceArchive("SNPP", "VIIRS", "SV-C2", 2024, r"VIIRS S-NPP\DL_FIRE_SV-C2_844845_2024.zip", "fire_archive_SV-C2_844845.csv"),
    SourceArchive("SNPP", "VIIRS", "SV-C2", 2025, r"VIIRS S-NPP\DL_FIRE_SV-C2_844847_2025.zip", "fire_archive_SV-C2_844847.csv"),
)

# Extracted MODIS copies that already sit beside the zips. Hashed to prove
# Phase 2 does not rewrite them. VIIRS files were never extracted.
EXTRACTED_RAW_CSVS: tuple[str, ...] = (
    r"Modis\DL_FIRE_M-C61_844811_2023\fire_archive_M-C61_844811.csv",
    r"Modis\DL_FIRE_M-C61_844824_2024\fire_archive_M-C61_844824.csv",
    r"Modis\DL_FIRE_M-C61_844838_2025\fire_archive_M-C61_844838.csv",
)
