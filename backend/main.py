"""FireScope entry point.

Usage:
    python main.py            # Phase 2 cleaning (rewrites cleaned files)
    python main.py phase3     # Phase 3 sensor harmonization
    python main.py phase4     # Phase 4 analysis (reads Phase 3 outputs)
    python main.py phase5 --new-baseline   # Phase 5 Fire Activity Index, freezes a baseline version
    python main.py phase5                  # Phase 5 using the latest frozen baseline
    python main.py phase5 --baseline-version v1
    python main.py phase6     # Phase 6 visualizations (read-only on Phase 4/5 outputs)
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))


def main() -> None:
    phase = sys.argv[1].lower() if len(sys.argv) > 1 else "phase2"
    if phase == "phase2":
        from run_phase2 import run_phase2

        run_phase2()
    elif phase == "phase3":
        from run_phase3 import run_phase3

        run_phase3()
    elif phase == "phase4":
        from run_phase4 import run_phase4
        from phase4_report import write_report

        run_phase4()
        write_report()
    elif phase == "phase5":
        from run_phase5 import run_phase5
        from phase5_report import write_report as write_phase5_report

        args = sys.argv[2:]
        version = args[args.index("--baseline-version") + 1] if "--baseline-version" in args else None
        run_phase5(new_baseline="--new-baseline" in args, baseline_version=version)
        write_phase5_report()
    elif phase == "phase6":
        from run_phase6 import run_phase6

        run_phase6()
    else:
        raise SystemExit(f"Unknown phase: {phase}. Use phase2, phase3, phase4, phase5 or phase6.")


if __name__ == "__main__":
    main()
