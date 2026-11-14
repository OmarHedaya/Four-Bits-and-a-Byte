"""Run Phase 4 on the Phase 3 outputs and write the analysis tables.

Reads  data/harmonized/firescope_harmonized.csv and coverage_calendar.csv
Writes data/analysis/<table>.csv, one file per table (inputs are never modified).
"""

from __future__ import annotations

import json
import logging
import time
import warnings

import pandas as pd

from config import HARMONIZED_DIR, PROJECT_ROOT
from phase4_analysis import YEARS, run_analysis

logger = logging.getLogger(__name__)
ANALYSIS_DIR = PROJECT_ROOT / "data" / "analysis"

_STRING_COLUMNS = {
    "acquisition_datetime_utc": "string", "acquisition_date": "string", "acquisition_time_utc": "string",
    "grid_cell_id": "string", "sensor_key": "string", "sensor_family": "string", "confidence_class": "string",
    "daynight": "string", "record_id": "string",
}


def load_phase3_outputs():
    harmonized = pd.read_csv(HARMONIZED_DIR / "firescope_harmonized.csv", dtype=_STRING_COLUMNS)
    coverage = pd.read_csv(HARMONIZED_DIR / "coverage_calendar.csv", dtype={"sensor_key": "string", "acquisition_date": "string"})
    return harmonized, coverage


def run_phase4(write: bool = True) -> dict[str, pd.DataFrame]:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    started = time.perf_counter()
    harmonized, coverage = load_phase3_outputs()
    caught: list[str] = []
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        tables = run_analysis(harmonized, coverage)
        caught = sorted({f"{x.category.__name__}: {x.message}" for x in w})
    elapsed = time.perf_counter() - started

    if write:
        ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
        for name, frame in tables.items():
            frame.to_csv(ANALYSIS_DIR / f"{name}.csv", index=False, lineterminator="\n")
        run_info = {
            "years": list(YEARS),
            "input_rows": int(len(harmonized)),
            "tables": {n: int(len(f)) for n, f in tables.items()},
            "execution_seconds": round(elapsed, 2),
            "warnings": caught,
            "checks_passed": int(tables["consistency_checks"]["passed"].sum()),
            "checks_total": int(len(tables["consistency_checks"])),
        }
        (ANALYSIS_DIR / "run_info.json").write_text(json.dumps(run_info, indent=2), encoding="utf-8")
        logger.info("Phase 4 finished in %.1f s; %d tables written to %s", elapsed, len(tables), ANALYSIS_DIR)
        for c in caught:
            logger.warning("%s", c)
    return tables


if __name__ == "__main__":
    run_phase4()
