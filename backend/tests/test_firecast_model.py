"""
Automated Backend Tests for FireCast Forecasting & Emergency Alert Engine
Compatible with both `unittest` (`python -m unittest`) and `pytest`.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from src.firecast_model import (  # noqa: E402
    DateValidationError,
    build_firecast_artifacts,
    classify_risk_tier,
    predict_for_date,
    validate_target_date,
)


class TestFireCastModel(unittest.TestCase):
    def test_validate_target_date_accepts_valid_historical_and_future_dates(self) -> None:
        d_hist, mode_hist = validate_target_date("2023-10-20")
        self.assertEqual(d_hist.isoformat(), "2023-10-20")
        self.assertEqual(mode_hist, "historical")

        d_fut, mode_fut = validate_target_date("2026-10-15")
        self.assertEqual(d_fut.isoformat(), "2026-10-15")
        self.assertEqual(mode_fut, "future_forecast")

    def test_validate_target_date_rejects_invalid_dates(self) -> None:
        bad_dates = [
            "",
            "   ",
            "2024/10/15",
            "15-10-2024",
            "2025-02-29",  # 2025 is not a leap year
            "2024-13-01",
            "2022-12-31",  # precedes 2023-01-01 archive start
            "2031-01-01",  # exceeds 2030-12-31 horizon
        ]
        for bad_date in bad_dates:
            with self.subTest(bad_date=bad_date):
                with self.assertRaises(DateValidationError):
                    validate_target_date(bad_date)

    def test_historical_vs_future_strict_separation(self) -> None:
        # 1. Historical peak fire day in Egypt (2023-10-20)
        hist_res = predict_for_date("2023-10-20", region_id="all")
        self.assertEqual(hist_res["temporal_mode"], "historical_observation")
        self.assertFalse(hist_res["is_future_prediction"])
        self.assertIsNotNone(hist_res["observed_metrics"])
        self.assertGreater(hist_res["observed_metrics"]["active_cell_days"], 100)
        self.assertEqual(hist_res["risk_level"], "EXTREME")
        self.assertTrue(hist_res["trigger_emergency_alert"])
        self.assertFalse(hist_res["model_status"]["is_experimental_forecast"])

        # 2. Future date (2026-10-15) -> must be labeled as prediction and have NO observed_metrics
        fut_res = predict_for_date("2026-10-15", region_id="all")
        self.assertEqual(fut_res["temporal_mode"], "future_prediction")
        self.assertTrue(fut_res["is_future_prediction"])
        self.assertIsNone(fut_res["observed_metrics"])
        self.assertIsNotNone(fut_res["predicted_metrics"])
        self.assertIsNone(fut_res["coverage_status"]["usable_day"])
        self.assertIn(
            "No NASA FIRMS satellite or sensor observations exist yet",
            fut_res["coverage_status"]["detail"],
        )
        self.assertTrue(fut_res["model_status"]["is_experimental_forecast"])

    def test_chronological_splits_and_evaluation_metrics(self) -> None:
        artifacts = build_firecast_artifacts()
        self.assertEqual(artifacts["splits"]["train"]["start"], "2023-01-01")
        self.assertEqual(artifacts["splits"]["train"]["end"], "2024-06-30")
        self.assertEqual(artifacts["splits"]["validation"]["start"], "2024-07-01")
        self.assertEqual(artifacts["splits"]["validation"]["end"], "2024-12-31")
        self.assertEqual(artifacts["splits"]["test"]["start"], "2025-01-01")
        self.assertEqual(artifacts["splits"]["test"]["end"], "2025-12-31")

        all_reg = artifacts["regions"]["all"]
        thresholds = all_reg["thresholds"]
        self.assertTrue(0 < thresholds["p50"] < thresholds["p80"] < thresholds["p95"])

        val_metrics = all_reg["validation_2024_h2"]["seasonal_harmonic_trend"]
        test_metrics = all_reg["test_2025_out_of_sample"]["seasonal_harmonic_trend"]
        self.assertGreater(val_metrics["n_days"], 150)
        self.assertGreater(test_metrics["n_days"], 300)
        self.assertTrue(0.0 <= test_metrics["exact_tier_accuracy"] <= 1.0)
        self.assertTrue(0.0 <= test_metrics["within_one_tier_accuracy"] <= 1.0)

    def test_classify_risk_tier_four_levels(self) -> None:
        thresholds = {"p50": 25.0, "p80": 42.0, "p95": 75.0}
        self.assertEqual(classify_risk_tier(10.0, thresholds), "LOW")
        self.assertEqual(classify_risk_tier(30.0, thresholds), "MODERATE")
        self.assertEqual(classify_risk_tier(50.0, thresholds), "HIGH")
        self.assertEqual(classify_risk_tier(85.0, thresholds), "EXTREME")
        self.assertEqual(classify_risk_tier(35.0, thresholds, anomaly_z=2.35), "EXTREME")


if __name__ == "__main__":
    unittest.main()
