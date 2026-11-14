"""Read FIRMS CSVs from zip archives without writing to those archives."""

from __future__ import annotations

import hashlib
import io
import logging
import zipfile
from pathlib import Path

import pandas as pd

from config import SourceArchive

logger = logging.getLogger(__name__)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_archive_csv(source: SourceArchive) -> pd.DataFrame:
    """Load one CSV as text.

    ``keep_default_na=False`` is required. The default NA list would not match
    the VIIRS confidence code ``n`` today, but reading every cell as text
    avoids any parser treating a real code or a zero-padded time as a number
    or a null. Empty cells stay empty strings and are converted later.
    """
    path = source.archive_path
    if not path.is_file():
        raise FileNotFoundError(f"Source archive not found: {path}")

    logger.info("Reading %s :: %s", source.archive_relpath, source.csv_name)
    try:
        with zipfile.ZipFile(path) as archive:
            try:
                payload = archive.read(source.csv_name)
            except KeyError as exc:
                names = archive.namelist()
                raise FileNotFoundError(
                    f"{source.csv_name} is not in {path}. Archive members: {names}"
                ) from exc
    except zipfile.BadZipFile as exc:
        raise ValueError(f"Cannot read zip archive: {path}") from exc

    frame = pd.read_csv(
        io.BytesIO(payload),
        dtype=str,
        keep_default_na=False,
        na_filter=False,
    )
    frame.columns = [str(column).strip() for column in frame.columns]
    logger.info(
        "Loaded %s rows and %s columns from %s",
        len(frame),
        len(frame.columns),
        source.csv_name,
    )
    return frame
