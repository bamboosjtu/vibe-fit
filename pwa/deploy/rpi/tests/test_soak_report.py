from __future__ import annotations

import importlib.util
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "soak-report.py"
SPEC = importlib.util.spec_from_file_location("vibefit_soak_report", SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Cannot load {SCRIPT}")
SOAK_REPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SOAK_REPORT)


class LongestFailedSampleRunTests(unittest.TestCase):
    def setUp(self) -> None:
        self.start = datetime(2026, 8, 1, tzinfo=timezone.utc)

    def test_combines_failed_observation_with_missing_sample(self) -> None:
        records = [{"sampleSuccess": False}, {"sampleSuccess": True}]
        times = [self.start, self.start + timedelta(minutes=10)]

        self.assertEqual(
            SOAK_REPORT.longest_failed_sample_run(records, times, []),
            2,
        )

    def test_counts_missing_samples_between_successes(self) -> None:
        records = [{"sampleSuccess": True}, {"sampleSuccess": True}]
        times = [self.start, self.start + timedelta(minutes=15)]

        self.assertEqual(
            SOAK_REPORT.longest_failed_sample_run(records, times, []),
            2,
        )

    def test_regular_successful_samples_have_no_outage(self) -> None:
        records = [
            {"sampleSuccess": True},
            {"sampleSuccess": True},
            {"sampleSuccess": True},
        ]
        times = [
            self.start,
            self.start + timedelta(minutes=5),
            self.start + timedelta(minutes=10),
        ]

        self.assertEqual(
            SOAK_REPORT.longest_failed_sample_run(records, times, []),
            0,
        )


if __name__ == "__main__":
    unittest.main()
