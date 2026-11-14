"""Run Phase 6 (visualization). Read-only on Phase 4/5 outputs; writes data/visualizations and the Phase 6 report."""

from __future__ import annotations

import json
import time
from pathlib import Path

from config import PROJECT_ROOT
from phase6_visualization import (
    PROTECTED_BASELINE,
    generate_all,
    protected_hashes,
    sha256_file,
    write_report,
)


def run_phase6(root: Path | None = None, out_dir: Path | None = None, report_path: Path | None = None) -> dict:
    root = Path(root) if root else PROJECT_ROOT
    out_dir = Path(out_dir) if out_dir else root / "data" / "visualizations"
    t0 = time.time()
    before = protected_hashes(root)
    reg = generate_all(root, out_dir)
    after = protected_hashes(root)
    integrity = {
        "n_files": len(before),
        "unchanged": before == after,
        "baseline_unchanged": before.get(PROTECTED_BASELINE) == after.get(PROTECTED_BASELINE),
        "baseline_sha256": after.get(PROTECTED_BASELINE, ""),
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {"figures": reg.items, "failures": reg.failures, "integrity": integrity,
                "protected_sha256_before": before, "seconds": round(time.time() - t0, 1)}
    (out_dir / "phase6_manifest.json").write_text(json.dumps(manifest, indent=1, default=str), encoding="utf-8")
    write_report(reg, root, integrity, report_path)
    print(f"Phase 6: {len(reg.items)} visualizations, {len(reg.failures)} failures, "
          f"phase 4/5 outputs unchanged = {integrity['unchanged']}, baseline unchanged = {integrity['baseline_unchanged']}")
    for f in reg.failures:
        print("  FAILED:", f["id"], f["error"])
    return {"registry": reg, "integrity": integrity}
