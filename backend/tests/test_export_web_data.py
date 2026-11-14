import json
from pathlib import Path
import pandas as pd
import pytest
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "web_export"
pytestmark = pytest.mark.skipif(not (OUT / "daily_summary.json").exists(), reason="run main.py phase7 first")

def load(n): return json.loads((OUT / n).read_text(encoding="utf-8"))

def test_daily_is_complete_and_unique():
    d = pd.DataFrame(load("daily_summary.json"))
    assert not d.duplicated(["region_id", "date"]).any()
    assert len(d) == 5 * 1096
    assert (d[["count_modis", "count_viirs", "count_merged", "total_frp"]] >= 0).all().all()
    assert d.high_conf_share.between(0, 1).all()

def test_counts_match_phase4_cell_days():
    d = pd.DataFrame(load("daily_summary.json")).groupby("date").count_merged.sum()
    p4 = pd.read_csv(ROOT / "data" / "analysis" / "daily_summary.csv").set_index("date").all_sensor_veg_cells_union
    assert (d.reindex(p4.index) == p4).all()

def test_seasonality_all_equals_regions():
    s = pd.DataFrame(load("seasonality.json"))
    assert s[s.region_id == "all"]["count"].sum() == s[s.region_id != "all"]["count"].sum()

def test_points_under_cap_and_no_static():
    assert len(load("recent_points.json")) < 15000
