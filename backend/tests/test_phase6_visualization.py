"""Phase 6 tests: sources, columns, figure generation, NA handling, Phase 4/5 + baseline immutability."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

import phase6_visualization as p6
from run_phase6 import run_phase6

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def pipeline(tmp_path_factory):
    out = tmp_path_factory.mktemp("viz") / "data" / "visualizations"
    report = tmp_path_factory.mktemp("rep") / "phase6_visualization_report.md"
    before = p6.protected_hashes(ROOT)
    res = run_phase6(root=ROOT, out_dir=out, report_path=report)
    return {"out": out, "report": report, "before": before, "res": res}


def test_all_sources_exist_with_required_columns():
    status = p6.check_sources(ROOT)
    for name, st in status.items():
        assert st["exists"], f"missing {name}"
        assert not st["missing_columns"], f"{name}: {st['missing_columns']}"


def test_missing_source_is_reported(tmp_path):
    (tmp_path / "data" / "analysis").mkdir(parents=True)
    (tmp_path / "data" / "index").mkdir(parents=True)
    with pytest.raises(FileNotFoundError):
        p6.load_sources(tmp_path)


def test_all_figures_generated_without_failures(pipeline):
    reg = pipeline["res"]["registry"]
    assert reg.failures == []
    assert len(reg.items) == len(p6.FIGURES)
    for it in reg.items:
        f = Path(it["file"])
        assert f.exists() and f.stat().st_size > (5000 if f.suffix == ".png" else 1500), it["id"]
    pngs = list(pipeline["out"].rglob("*.png"))
    assert len(pngs) >= 25
    assert len(list(pipeline["out"].rglob("*.html"))) >= 2
    for sub in ["national", "spatial", "sensors", "static_sources", "confidence", "coverage", "seasonal"]:
        assert (pipeline["out"] / sub).is_dir()


def test_phase4_and_phase5_outputs_unchanged(pipeline):
    assert pipeline["res"]["integrity"]["unchanged"] is True
    assert p6.protected_hashes(ROOT) == pipeline["before"]


def test_frozen_baseline_unchanged(pipeline):
    assert pipeline["res"]["integrity"]["baseline_unchanged"] is True
    baseline_key = p6.PROTECTED_BASELINE.replace("/", "\\")
    assert p6.sha256_file(ROOT / p6.PROTECTED_BASELINE) == pipeline["before"][baseline_key]


def test_report_documents_every_figure(pipeline):
    text = pipeline["report"].read_text(encoding="utf-8")
    for it in pipeline["res"]["registry"].items:
        assert it["title"] in text
    low = text.lower()
    for phrase in ["not a confidence interval", "not a correction", "never treated as zero", "not a confirmed fire"]:
        assert phrase in low or phrase == "never treated as zero" and "never treated as zero" in low or \
            (phrase == "not a confirmed fire" and "not a confirmed fire" in low), phrase
    assert "Visualizations not generated" in text


def test_na_not_plotted_as_zero():
    """Seasonal table keeps NA for incomplete windows and the plot code must not convert them to published zeros."""
    d = p6.load_sources(ROOT)
    s = p6.series(d["fai_seasonal"], p6.headline_id(d))
    na = s[(s["year"] == 2023) & (s["season"] == "DJF")]
    assert na["FAI"].isna().all()
    daily = p6.series(d["fai_daily"], p6.headline_id(d))
    unusable = daily[daily["day_status"] == "unusable_not_zero"]
    assert len(unusable) > 0 and unusable["FAI_daily"].isna().all()


def test_grid_array_keeps_absent_cells_nan_and_005_grid():
    df = pd.DataFrame({"lat": [30.025, 30.075], "lon": [31.025, 31.125], "v": [1.0, 2.0]})
    arr, xe, ye = p6.grid_array(df, "lat", "lon", "v")
    assert arr.shape == (2, 3)
    assert np.isnan(arr[0, 1]) and arr[0, 0] == 1.0 and arr[1, 2] == 2.0
    assert np.allclose(np.diff(xe), 0.05) and np.allclose(np.diff(ye), 0.05)


def test_shade_runs_groups_consecutive_days():
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots()
    p6.shade_runs(ax, pd.Series(pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-05"])), "red")
    assert len(ax.patches) == 2
    plt.close(fig)


def test_block_figures_carry_coverage_limitation_and_no_ranking():
    import inspect
    src = inspect.getsource(p6.fig_blocks_map) + inspect.getsource(p6.fig_blocks_small_multiples)
    assert src.count("block=True") == 2
    assert "sort_values(\"FAI" not in src and "sort_values('FAI" not in src
    assert "national" in p6.BLOCK_NOTE.lower() and "own" in p6.BLOCK_NOTE.lower()


def test_block_table_not_comparable_flag():
    d = p6.load_sources(ROOT)
    assert not d["block_fai"]["comparable_between_blocks"].any()
    assert (d["block_fai"]["coverage_basis"] == "national_calendar_proxy").all()


def test_spread_note_says_not_confidence_interval():
    d = p6.load_sources(ROOT)
    assert "not a confidence interval" in d["inter_sensor_spread"]["spread_note"].iloc[0]


def test_main_has_phase6_command():
    text = (ROOT / "main.py").read_text()
    assert 'phase == "phase6"' in text
    for old in ["phase2", "phase3", "phase4", "phase5"]:
        assert f'phase == "{old}"' in text
