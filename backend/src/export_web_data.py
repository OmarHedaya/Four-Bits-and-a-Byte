"""Export FireScope results to the 8 JSON/GeoJSON files the website consumes.

Reads  : data/harmonized/firescope_harmonized.csv  (Phase 3, one row per detection)
         data/analysis/sensor_day.csv               (Phase 4, coverage per sensor-day)
Writes : data/web_export/*.json|geojson + export_manifest.json

Rules inherited from the project (README "Important limits"):
  * Only hotspot_type 0 (vegetation-fire candidates) is exported. Type 2 (static
    land sources) and type 3 (water) are excluded from every file.
  * MODIS and VIIRS counts are never added together as independent fires.
    ``count_merged`` is a cell-day count: one 0.05 deg grid cell on one UTC date
    with at least one detection from any sensor, counted once.
  * VIIRS confidence classes (l / n / h) are never converted to numbers and the
    MODIS numeric confidence is never mixed with them.
  * A hotspot is a satellite thermal detection, not a confirmed fire.

The website regions are analytical bins of Egypt (rectangles on the cell centre),
not administrative boundaries.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
HARMONIZED = ROOT / "data" / "harmonized" / "firescope_harmonized.csv"
SENSOR_DAY = ROOT / "data" / "analysis" / "sensor_day.csv"
OUT_DIR = ROOT / "data" / "web_export"

# Evaluated in this order; the first matching rule wins (a partition of Egypt).
REGIONS = [
    ("sinai-suez", "Sinai & Gulf of Suez",
     "East of the Suez Canal and north of 27.6N: the Sinai peninsula and the Gulf of Suez coast."),
    ("delta-cairo", "Nile Delta & Greater Cairo",
     "North of 29.8N between 29.5E and the Suez Canal: the Delta, Greater Cairo and the Canal cities."),
    ("north-west", "Mediterranean West Coast",
     "North of 29.8N and west of 29.5E: Alexandria hinterland, the north-west coast and the western desert edge."),
    ("middle-egypt", "Middle Egypt & Central Desert",
     "Between 27.0N and 29.8N: Fayoum, Beni Suef, Minya, the oases and the central Eastern Desert."),
    ("upper-egypt", "Upper Egypt & Southern Desert",
     "South of 27.0N: Assiut to Aswan, the Red Sea coast and the southern deserts."),
]
REGION_NAMES = {r[0]: r[1] for r in REGIONS}
REGION_DESC = {r[0]: r[2] for r in REGIONS}
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July",
               "August", "September", "October", "November", "December"]
CONF_LABEL = {"l": "low", "n": "nominal", "h": "high"}
MAX_RECENT_POINTS = 14000
RECENT_DAYS = 30
MAX_EPISODE_DAYS_FOR_POINTS = 14


def assign_region(lat: pd.Series, lon: pd.Series) -> pd.Series:
    conds = [
        (lon >= 32.55) & (lat >= 27.6),
        (lat >= 29.8) & (lon >= 29.5),
        (lat >= 29.8) & (lon < 29.5),
        (lat >= 27.0),
    ]
    ids = [r[0] for r in REGIONS]
    return pd.Series(np.select(conds, ids[:4], default=ids[4]), index=lat.index)


def load_veg() -> pd.DataFrame:
    cols = [
        "acquisition_date", "latitude", "longitude", "grid_cell_id", "grid_cell_lat",
        "grid_cell_lon", "sensor_key", "sensor_family", "confidence_numeric",
        "confidence_class", "frp_mw", "hotspot_type",
    ]
    df = pd.read_csv(HARMONIZED, usecols=cols)
    df = df[df["hotspot_type"] == 0].copy()
    df["date"] = df["acquisition_date"].astype(str)
    df["region_id"] = assign_region(df["grid_cell_lat"], df["grid_cell_lon"])
    df["frp_mw"] = df["frp_mw"].fillna(0.0).clip(lower=0.0)
    return df


def all_dates(df: pd.DataFrame) -> list[str]:
    years = sorted(df["date"].str[:4].astype(int).unique())
    return [d.strftime("%Y-%m-%d")
            for d in pd.date_range(f"{years[0]}-01-01", f"{years[-1]}-12-31", freq="D")]


def build_daily(df: pd.DataFrame, dates: list[str]) -> pd.DataFrame:
    """One row per region x date (zeros kept: every date had at least one observing sensor)."""
    fam = df.groupby(["region_id", "date", "sensor_family"]).agg(
        n=("frp_mw", "size"), frp=("frp_mw", "sum")).reset_index()
    modis = fam[fam.sensor_family == "MODIS"].set_index(["region_id", "date"])
    viirs = fam[fam.sensor_family == "VIIRS"].set_index(["region_id", "date"])

    cell_day = df.groupby(["region_id", "date", "grid_cell_id"])["frp_mw"].max().reset_index()
    merged = cell_day.groupby(["region_id", "date"]).agg(
        count_merged=("grid_cell_id", "size"), total_frp=("frp_mw", "sum"))

    v = df[(df.sensor_family == "VIIRS") & df.confidence_class.notna()]
    hc = v.groupby(["region_id", "date"]).agg(
        n=("confidence_class", "size"), h=("confidence_class", lambda s: int((s == "h").sum())))

    idx = pd.MultiIndex.from_product([[r[0] for r in REGIONS], dates], names=["region_id", "date"])
    out = pd.DataFrame(index=idx)
    out["count_modis"] = modis["n"].reindex(idx).fillna(0).astype(int)
    out["count_viirs"] = viirs["n"].reindex(idx).fillna(0).astype(int)
    out["count_merged"] = merged["count_merged"].reindex(idx).fillna(0).astype(int)
    out["total_frp"] = merged["total_frp"].reindex(idx).fillna(0.0).round(1)
    out["frp_modis"] = modis["frp"].reindex(idx).fillna(0.0).round(1)
    out["frp_viirs"] = viirs["frp"].reindex(idx).fillna(0.0).round(1)
    hn = hc["n"].reindex(idx).fillna(0)
    hh = hc["h"].reindex(idx).fillna(0)
    out["high_conf_share"] = np.where(hn > 0, hh / hn.where(hn > 0, 1), 0.0).round(3)
    out = out.reset_index()
    out["month"] = out["date"].str[5:7].astype(int)
    out["year"] = out["date"].str[:4].astype(int)

    # anomaly_z: z-score of log(1 + active cells) against the same calendar month of the
    # same region, using all years. Small days (<5 active cells) are capped below the 2-sigma flag.
    x = np.log1p(out["count_merged"].astype(float))
    grp = x.groupby([out["region_id"], out["month"]])
    mu, sd = grp.transform("mean"), grp.transform("std").fillna(0.0)
    z = (x - mu) / np.maximum(sd, 0.25)
    z = np.where(out["count_merged"] < 5, np.minimum(z, 1.9), z)
    out["anomaly_z"] = np.round(z, 2)
    return out


def build_seasonality(daily: pd.DataFrame) -> list[dict]:
    rows = []
    g = daily.groupby(["region_id", "year", "month"]).agg(
        frp_sum=("total_frp", "sum"), count=("count_merged", "sum"),
        count_modis=("count_modis", "sum"), count_viirs=("count_viirs", "sum")).reset_index()
    nat = g.groupby(["year", "month"]).agg(
        frp_sum=("frp_sum", "sum"), count=("count", "sum"),
        count_modis=("count_modis", "sum"), count_viirs=("count_viirs", "sum")).reset_index()
    nat["region_id"] = "all"
    for r in pd.concat([nat, g], ignore_index=True).itertuples():
        rows.append({
            "year": int(r.year), "month": int(r.month), "frp_sum": round(float(r.frp_sum), 1),
            "count": int(r.count), "count_modis": int(r.count_modis),
            "count_viirs": int(r.count_viirs), "region_id": r.region_id,
        })
    return rows


def build_validation(daily: pd.DataFrame) -> dict:
    m = daily.groupby(["year", "month"]).agg(
        modis=("count_modis", "sum"), viirs=("count_viirs", "sum"),
        harmonized=("count_merged", "sum"), frp_modis=("frp_modis", "sum"),
        frp_viirs=("frp_viirs", "sum")).reset_index()
    pairs = [{
        "month": f"{int(r.year)}-{int(r.month):02d}", "modis": int(r.modis), "viirs": int(r.viirs),
        "harmonized": int(r.harmonized), "frp_modis": round(float(r.frp_modis), 1),
        "frp_viirs": round(float(r.frp_viirs), 1), "region_id": "all",
    } for r in m.itertuples()]
    mo, vi = m["modis"].to_numpy(float), m["viirs"].to_numpy(float)
    r = float(np.corrcoef(mo, vi)[0, 1])
    k = float((mo * vi).sum() / (vi * vi).sum())  # least squares through the origin
    resid = mo - k * vi
    return {
        "monthly_pairs": pairs,
        "correlation": round(r, 4),
        "bias": round(float(resid.mean()), 2),
        "scaling_factor": round(k, 4),
        "rmse": round(float(np.sqrt((resid ** 2).mean())), 2),
        "sample_size": int(len(m)),
    }


def build_grid(df: pd.DataFrame) -> dict:
    d = df.copy()
    d["month"] = d["date"].str[5:7].astype(int)
    cd = d.groupby(["grid_cell_id", "grid_cell_lat", "grid_cell_lon", "region_id", "month", "date"])[
        "frp_mw"].max().reset_index()
    g = cd.groupby(["grid_cell_id", "grid_cell_lat", "grid_cell_lon", "region_id", "month"]).agg(
        count=("date", "size"), frp_sum=("frp_mw", "sum")).reset_index()
    h = 0.025
    feats = []
    for r in g.itertuples():
        lat, lon = float(r.grid_cell_lat), float(r.grid_cell_lon)
        ring = [[round(lon - h, 3), round(lat - h, 3)], [round(lon + h, 3), round(lat - h, 3)],
                [round(lon + h, 3), round(lat + h, 3)], [round(lon - h, 3), round(lat + h, 3)],
                [round(lon - h, 3), round(lat - h, 3)]]
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [ring]},
            "properties": {
                "cell_id": r.grid_cell_id, "lat": round(lat, 3), "lon": round(lon, 3),
                "month": int(r.month), "frp_sum": round(float(r.frp_sum), 1),
                "count": int(r.count), "region_id": r.region_id,
            },
        })
    return {"type": "FeatureCollection", "features": feats}


def episodes(daily: pd.DataFrame, df: pd.DataFrame) -> list[dict]:
    out: list[dict] = []
    for rid, g in daily.groupby("region_id"):
        g = g.sort_values("date").reset_index(drop=True)
        flag = (g["anomaly_z"] >= 2.0) & (g["count_merged"] >= 5)
        days = g[flag]
        if days.empty:
            continue
        groups, cur = [], [days.index[0]]
        for i in days.index[1:]:
            gap = (pd.Timestamp(g.loc[i, "date"]) - pd.Timestamp(g.loc[cur[-1], "date"])).days
            if gap <= 2:
                cur.append(i)
            else:
                groups.append(cur)
                cur = [i]
        groups.append(cur)
        clim = g.groupby("month")["count_merged"].median()
        for grp in groups:
            sub = g.loc[grp]
            peak = sub.loc[sub["anomaly_z"].idxmax()]
            typical = float(clim.loc[int(peak["month"])])
            reg_df = df[(df.region_id == rid) & (df.date == peak["date"])]
            blocks = (np.floor(reg_df["grid_cell_lat"]).astype(int).astype(str) + "N_"
                      + np.floor(reg_df["grid_cell_lon"]).astype(int).astype(str) + "E")
            top_block = blocks.value_counts().index[0] if len(blocks) else "n/a"
            ratio = f"{peak['count_merged'] / typical:.1f}x" if typical > 0 else "well above"
            sensors = ", ".join(sorted(reg_df["sensor_key"].unique()))
            out.append({
                "start_date": str(sub["date"].iloc[0]),
                "end_date": str(sub["date"].iloc[-1]),
                "region_id": rid,
                "score": float(round(peak["anomaly_z"], 2)),
                "reason": (
                    f"Peak on {peak['date']}: {int(peak['count_merged'])} active 0.05-degree cells "
                    f"({ratio} the {MONTHS_LONG[int(peak['month']) - 1]} median of {typical:.0f}), "
                    f"{float(peak['total_frp']):.0f} MW summed cell FRP, most detections in 1-degree block "
                    f"{top_block}; seen by {sensors}. Satellite thermal detections (vegetation-fire "
                    f"candidates), not confirmed fires; the data alone cannot tell crop-residue burning "
                    f"from wildfire."
                ),
            })
    out.sort(key=lambda e: -e["score"])
    per_region: dict[str, int] = {}
    kept = []
    for e in out:
        per_region[e["region_id"]] = per_region.get(e["region_id"], 0) + 1
        if per_region[e["region_id"]] <= 5:
            kept.append(e)
    return kept


def build_risk(daily: pd.DataFrame) -> list[dict]:
    res: list[dict] = []
    for rid, g in daily.groupby("region_id"):
        mean_m = g.groupby("month")["count_merged"].mean().reindex(range(1, 13)).fillna(0.0)
        annual = float(g["count_merged"].mean())
        top = float(mean_m.max())
        if top <= 0:
            continue
        score = (mean_m / top * 100).round(0)
        hot = [m for m in range(1, 13) if score[m] >= 60]
        # contiguous runs (Dec-Jan wrap handled)
        runs: list[list[int]] = []
        for m in hot:
            if runs and m == runs[-1][-1] + 1:
                runs[-1].append(m)
            else:
                runs.append([m])
        if len(runs) > 1 and runs[0][0] == 1 and runs[-1][-1] == 12:
            runs[0] = runs.pop() + runs[0]
        year_means = g.groupby(["year", "month"])["count_merged"].mean()
        year_all = g.groupby("year")["count_merged"].mean()
        runs.sort(key=lambda r: -max(score[m] for m in r))
        for run in runs[:2]:
            a, b = run[0], run[-1]
            label = MONTHS_LONG[a - 1] if a == b else f"{MONTHS_LONG[a - 1]} - {MONTHS_LONG[b - 1]}"
            peak_m = max(run, key=lambda m: score[m])
            win_mean = float(np.mean([mean_m[m] for m in run]))
            above = sum(
                1 for y in year_all.index
                if np.mean([year_means.get((y, m), 0.0) for m in run]) > year_all[y])
            share = float(sum(g[g.month.isin(run)]["count_merged"]) / max(1, g["count_merged"].sum()) * 100)
            res.append({
                "window": f"{label} (peak month: {MONTHS_LONG[peak_m - 1]})",
                "region_id": rid,
                "risk_score": float(score[peak_m]),
                "drivers": [
                    f"Mean {win_mean:.1f} active cells/day vs {annual:.1f} annual mean "
                    f"({win_mean / annual:.1f}x)" if annual > 0 else f"Mean {win_mean:.1f} active cells/day",
                    f"Above that year's mean in {above} of {len(year_all)} years",
                    f"{share:.0f}% of the region's active cell-days fall in these months",
                ],
                "start_month": int(a),
                "end_month": int(b),
            })
    res.sort(key=lambda r: -r["risk_score"])
    return res


def build_region_meta(df: pd.DataFrame, dates: list[str]) -> list[dict]:
    def bbox(sub: pd.DataFrame) -> list[float]:
        return [round(float(sub.longitude.min()) - 0.1, 2), round(float(sub.latitude.min()) - 0.1, 2),
                round(float(sub.longitude.max()) + 0.1, 2), round(float(sub.latitude.max()) + 0.1, 2)]
    meta = [{
        "region_id": "all", "name": "All of Egypt", "bbox": bbox(df),
        "date_min": dates[0], "date_max": dates[-1],
        "biome": "Desert, Nile valley and delta agriculture, coastal and Sinai landscapes",
        "description": "Sum of the five analytical regions. Vegetation-fire candidates from MODIS and "
                       "VIIRS (S-NPP, NOAA-20, NOAA-21), 2023-2025.",
    }]
    for rid, name, desc in REGIONS:
        sub = df[df.region_id == rid]
        meta.append({
            "region_id": rid, "name": name, "bbox": bbox(sub), "date_min": dates[0],
            "date_max": dates[-1], "biome": "Analytical bin of Egypt (not an administrative boundary)",
            "description": desc,
        })
    return meta


def build_recent(df: pd.DataFrame, eps: list[dict], dates: list[str]) -> list[dict]:
    want = set(dates[-RECENT_DAYS:])
    base = df[df.date.isin(want)]
    chosen = [base]
    total = len(base)
    for e in eps:  # highest score first
        days = [d.strftime("%Y-%m-%d") for d in pd.date_range(e["start_date"], e["end_date"])]
        days = [d for d in days[:MAX_EPISODE_DAYS_FOR_POINTS] if d not in want]
        sub = df[(df.region_id == e["region_id"]) & df.date.isin(days)]
        if total + len(sub) > MAX_RECENT_POINTS:
            continue
        chosen.append(sub)
        total += len(sub)
        want.update(days)
    pts = pd.concat(chosen).drop_duplicates().sort_values(["date", "latitude", "longitude"])
    out = []
    for i, r in enumerate(pts.itertuples(), start=1):
        if r.sensor_family == "MODIS":
            conf: str | float = float(r.confidence_numeric) if pd.notna(r.confidence_numeric) else "nominal"
        else:
            conf = CONF_LABEL.get(r.confidence_class, "nominal")
        out.append({
            "id": f"PT-{i:05d}", "lat": round(float(r.latitude), 4), "lon": round(float(r.longitude), 4),
            "date": r.date, "sensor": r.sensor_family, "frp": round(float(r.frp_mw), 1),
            "confidence": conf, "region_id": r.region_id,
        })
    return out


def dump(obj, name: str) -> int:
    path = OUT_DIR / name
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    return path.stat().st_size


def run_export() -> dict:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    df = load_veg()
    dates = all_dates(df)
    daily = build_daily(df, dates)
    eps = episodes(daily, df)

    daily_records = daily[["date", "region_id", "count_modis", "count_viirs", "count_merged",
                           "total_frp", "frp_modis", "frp_viirs", "high_conf_share", "anomaly_z"]]
    daily_records = daily_records.sort_values(["date", "region_id"]).to_dict("records")
    for r in daily_records:  # plain python types
        for k in ("count_modis", "count_viirs", "count_merged"):
            r[k] = int(r[k])
        for k in ("total_frp", "frp_modis", "frp_viirs", "high_conf_share", "anomaly_z"):
            r[k] = float(r[k])

    sizes = {
        "daily_summary.json": dump(daily_records, "daily_summary.json"),
        "grid_cells.geojson": dump(build_grid(df), "grid_cells.geojson"),
        "recent_points.json": dump(build_recent(df, eps, dates), "recent_points.json"),
        "seasonality.json": dump(build_seasonality(daily), "seasonality.json"),
        "anomalies.json": dump(eps, "anomalies.json"),
        "risk_periods.json": dump(build_risk(daily), "risk_periods.json"),
        "validation.json": dump(build_validation(daily), "validation.json"),
        "region_meta.json": dump(build_region_meta(df, dates), "region_meta.json"),
    }
    manifest = {
        "source": "data/harmonized/firescope_harmonized.csv",
        "veg_detections_exported": int(len(df)),
        "date_range": [dates[0], dates[-1]],
        "regions": [r[0] for r in REGIONS],
        "file_bytes": sizes,
    }
    dump(manifest, "export_manifest.json")
    return manifest


if __name__ == "__main__":
    print(json.dumps(run_export(), indent=2))
