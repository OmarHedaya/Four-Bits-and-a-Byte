"""
FireScope Backend REST API Server (Phases 1-6 Data & Verification Bridge)
Serves harmonized Egypt 2023-2025 MODIS & VIIRS (S-NPP, NOAA-20, NOAA-21)
analytical tables, Phase 5 Fire Activity Index (FAI) series, and Phase 6 manifest.

Usage:
    python backend/api_server.py --port 8000
"""

from __future__ import annotations

import argparse
import csv
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

BACKEND_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_ROOT.parent
ANALYSIS_DIR = BACKEND_ROOT / "data" / "analysis"
INDEX_DIR = BACKEND_ROOT / "data" / "index"
VIZ_DIR = BACKEND_ROOT / "data" / "visualizations"
REPORTS_DIR = BACKEND_ROOT / "reports"
SAMPLE_DATA_DIR = PROJECT_ROOT / "public" / "sample-data"


def read_csv_records(csv_path: Path, limit: int | None = None) -> list[dict]:
    if not csv_path.exists():
        return []
    rows: list[dict] = []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            if limit is not None and idx >= limit:
                break
            parsed: dict = {}
            for k, v in row.items():
                if v is None or v == "":
                    parsed[k] = None
                elif v in ("True", "true"):
                    parsed[k] = True
                elif v in ("False", "false"):
                    parsed[k] = False
                else:
                    try:
                        parsed[k] = int(v) if v.isdigit() else float(v)
                    except ValueError:
                        parsed[k] = v
            rows.append(parsed)
    return rows


class FireScopeAPIHandler(BaseHTTPRequestHandler):
    def _send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed_url = urlparse(self.path)
        route = parsed_url.path.rstrip("/")
        query = parse_qs(parsed_url.query)
        limit_param = query.get("limit", [None])[0]
        limit = int(limit_param) if limit_param and limit_param.isdigit() else None

        if route in ("", "/", "/api/firescope/health"):
            p4_checks = read_csv_records(ANALYSIS_DIR / "consistency_checks.csv")
            p5_checks = read_csv_records(INDEX_DIR / "phase5_checks.csv")
            self._send_json(
                {
                    "status": "ok",
                    "service": "FireScope Egypt 2023-2025 Backend API",
                    "baseline_version": "v1",
                    "headline_series": "headline_N20_SNPP_core_all",
                    "phase4_checks_passed": sum(1 for c in p4_checks if c.get("passed") is True),
                    "phase4_checks_total": len(p4_checks),
                    "phase5_checks_passed": sum(1 for c in p5_checks if c.get("passed") is True),
                    "phase5_checks_total": len(p5_checks),
                    "available_endpoints": [
                        "/api/firescope/health",
                        "/api/firescope/bundle",
                        "/api/firescope/baseline",
                        "/api/firescope/visualizations",
                        "/api/firescope/table/analysis/<table_name>",
                        "/api/firescope/table/index/<table_name>",
                    ],
                }
            )
            return

        if route == "/api/firescope/bundle":
            bundle_path = SAMPLE_DATA_DIR / "firescope_bundle.json"
            if bundle_path.exists():
                self._send_json(json.loads(bundle_path.read_text(encoding="utf-8")))
            else:
                self._send_json({"error": "firescope_bundle.json not built yet"}, 404)
            return

        if route == "/api/firescope/baseline":
            b_path = INDEX_DIR / "baseline_v1.json"
            if b_path.exists():
                self._send_json(json.loads(b_path.read_text(encoding="utf-8")))
            else:
                self._send_json({"error": "baseline_v1.json not found"}, 404)
            return

        if route == "/api/firescope/visualizations":
            m_path = VIZ_DIR / "phase6_manifest.json"
            if m_path.exists():
                self._send_json(json.loads(m_path.read_text(encoding="utf-8")))
            else:
                self._send_json({"error": "phase6_manifest.json not found"}, 404)
            return

        if route.startswith("/api/firescope/table/"):
            parts = route.split("/")
            if len(parts) == 6:
                stage, table_name = parts[4], parts[5]
                base_dir = ANALYSIS_DIR if stage == "analysis" else INDEX_DIR if stage == "index" else None
                if base_dir is not None:
                    csv_file = base_dir / f"{table_name}.csv"
                    if csv_file.exists():
                        self._send_json(
                            {
                                "stage": stage,
                                "table": table_name,
                                "rows": read_csv_records(csv_file, limit=limit),
                            }
                        )
                        return
            self._send_json({"error": f"Unknown table route: {route}"}, 404)
            return

        self._send_json({"error": f"Not found: {route}"}, 404)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run FireScope REST API Server")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", type=int, default=8000, help="Bind port")
    args = parser.parse_args()

    server = HTTPServer((args.host, args.port), FireScopeAPIHandler)
    print(f"FireScope Backend API running on http://{args.host}:{args.port}/api/firescope/health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
