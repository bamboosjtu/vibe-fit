#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from statistics import mean

DEPLOY_DIR = Path(__file__).resolve().parent.parent
CURRENT_INPUT_FILE = DEPLOY_DIR / "soak" / "observations.jsonl"
INPUT_FILES = (
    [Path(sys.argv[1])]
    if len(sys.argv) > 1
    else [
        CURRENT_INPUT_FILE.with_suffix(".jsonl.3"),
        CURRENT_INPUT_FILE.with_suffix(".jsonl.2"),
        CURRENT_INPUT_FILE.with_suffix(".jsonl.1"),
        CURRENT_INPUT_FILE,
    ]
)
OUTPUT_FILE = DEPLOY_DIR / "soak" / "report.json"


MAINTENANCE_FILE = DEPLOY_DIR / "soak" / "maintenance-windows.jsonl"


def load_maintenance_windows() -> list[tuple[datetime, datetime]]:
    if not MAINTENANCE_FILE.exists():
        return []
    windows = []
    for line in MAINTENANCE_FILE.read_text(encoding="utf-8").splitlines():
        try:
            value = json.loads(line)
            windows.append((datetime.fromisoformat(value["start"]), datetime.fromisoformat(value["end"])))
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            continue
    return windows


def in_maintenance(observed_at: datetime, windows: list[tuple[datetime, datetime]]) -> bool:
    return any(start <= observed_at <= end for start, end in windows)


def maintenance_overlap_seconds(
    period_start: datetime,
    period_end: datetime,
    windows: list[tuple[datetime, datetime]],
) -> float:
    total = 0.0
    for start, end in windows:
        overlap_start = max(period_start, start)
        overlap_end = min(period_end, end)
        if overlap_end > overlap_start:
            total += (overlap_end - overlap_start).total_seconds()
    return total


def longest_failed_sample_run(
    records: list[dict[str, object]],
    observed_times: list[datetime],
    maintenance_windows: list[tuple[datetime, datetime]],
) -> int:
    longest = 0
    current = 0
    for index, record in enumerate(records):
        if index:
            previous_time = observed_times[index - 1]
            current_time = observed_times[index]
            effective_gap = (
                (current_time - previous_time).total_seconds()
                - maintenance_overlap_seconds(previous_time, current_time, maintenance_windows)
            )
            # Missing expected samples are failures and belong to the same
            # outage segment as adjacent failed observations.
            current += max(0, round(effective_gap / 300) - 1)

        if record.get("sampleSuccess"):
            longest = max(longest, current)
            current = 0
        else:
            current += 1
            longest = max(longest, current)
    return max(longest, current)


def main() -> int:
    records = []
    existing_inputs = [path for path in INPUT_FILES if path.exists()]
    for input_file in existing_inputs:
        for line in input_file.read_text(encoding="utf-8").splitlines():
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    if len(records) < 2:
        print("At least two valid observations are required.", file=sys.stderr)
        return 2

    records.sort(key=lambda record: record["observedAt"])
    times = [datetime.fromisoformat(record["observedAt"]) for record in records]
    duration_days = (times[-1] - times[0]).total_seconds() / 86400
    maintenance_windows = load_maintenance_windows()
    included_records = [
        record for record, observed_at in zip(records, times)
        if not in_maintenance(observed_at, maintenance_windows)
    ]
    if len(included_records) < 2:
        print("At least two observations outside maintenance windows are required.", file=sys.stderr)
        return 2
    included_times = [datetime.fromisoformat(record["observedAt"]) for record in included_records]
    successes = sum(bool(record.get("sampleSuccess")) for record in included_records)
    total_seconds = max(0.0, (times[-1] - times[0]).total_seconds())
    excluded_seconds = 0.0
    for start, end in maintenance_windows:
        clipped_start = max(start, times[0])
        clipped_end = min(end, times[-1])
        if clipped_end > clipped_start:
            excluded_seconds += (clipped_end - clipped_start).total_seconds()
    expected_samples = max(
        len(included_records),
        int(max(0.0, total_seconds - excluded_seconds) // 300) + 1,
    )
    availability = successes / expected_samples * 100 if expected_samples else 0.0

    longest_failed_samples = longest_failed_sample_run(
        included_records,
        included_times,
        maintenance_windows,
    )

    oom_kills = any(
        container.get("oomKilled")
        for record in included_records
        for container in record.get("containers", [])
    )
    oom_kills = oom_kills or any(
        (record.get("host", {}).get("oomEvents") or 0) > 0
        for record in included_records
    )
    io_errors = sum(
        record.get("host", {}).get("ioErrors") or 0
        for record in included_records
    )
    max_disk = max(record.get("host", {}).get("diskUsedPercent", 0) for record in included_records)
    temperatures = [
        record.get("host", {}).get("temperatureC")
        for record in included_records
        if record.get("host", {}).get("temperatureC") is not None
    ]
    throttled = [
        record.get("host", {}).get("throttled")
        for record in included_records
        if record.get("host", {}).get("throttled") not in (None, "throttled=0x0")
    ]
    certificate_days = [
        record.get("certificateDaysRemaining")
        for record in included_records
        if record.get("certificateDaysRemaining") is not None
    ]
    telemetry_records = len(included_records)
    kernel_telemetry_complete = all(
        record.get("host", {}).get("ioErrors") is not None
        and record.get("host", {}).get("oomEvents") is not None
        for record in included_records
    )
    thermal_telemetry_complete = all(
        record.get("host", {}).get("temperatureC") is not None
        and record.get("host", {}).get("throttled") is not None
        for record in included_records
    )
    postgres_telemetry_coverage = (
        sum(isinstance(record.get("postgresBytes"), int) for record in included_records)
        / telemetry_records
        * 100
    )
    certificate_telemetry_coverage = len(certificate_days) / telemetry_records * 100
    version_telemetry_coverage = (
        sum(isinstance(record.get("version"), dict) for record in included_records)
        / telemetry_records
        * 100
    )

    memory_by_service: dict[str, list[float]] = defaultdict(list)
    expected_rss_points = 0
    actual_rss_points = 0
    for record in included_records:
        for container in record.get("containers", []):
            if container.get("service") in {"postgres", "worker", "backend", "frontend", "caddy"} \
                    and container.get("status") == "running":
                expected_rss_points += 1
            rss_bytes = container.get("rssBytes")
            if isinstance(rss_bytes, int):
                actual_rss_points += 1
                memory_by_service[container.get("service", "unknown")].append(float(rss_bytes))
    rss_telemetry_coverage = (
        actual_rss_points / expected_rss_points * 100 if expected_rss_points else 0.0
    )

    memory_growth: dict[str, float] = {}
    for service, values in memory_by_service.items():
        window = max(1, len(values) // 4)
        baseline = mean(values[:window])
        recent = mean(values[-window:])
        memory_growth[service] = 0.0 if baseline == 0 else ((recent - baseline) / baseline) * 100
    max_memory_growth = max(memory_growth.values(), default=0.0)

    projected_disk_12_months = max_disk
    if duration_days > 0:
        first_disk = included_records[0].get("host", {}).get("diskUsedPercent", 0)
        last_disk = included_records[-1].get("host", {}).get("diskUsedPercent", 0)
        daily_growth = max(0.0, (last_disk - first_disk) / duration_days)
        projected_disk_12_months = last_disk + daily_growth * 365

    checks = {
        "observationPeriodAtLeast30Days": duration_days >= 30,
        "availabilityAtLeast99_5Percent": availability >= 99.5,
        "noOutageLongerThan5Minutes": longest_failed_samples <= 1,
        "noOomKills": not oom_kills,
        "noFilesystemIoErrors": io_errors == 0,
        "noMigrationErrors": all(record.get("migrationOk") for record in included_records),
        "versionsMatchImageLocks": all(
            record.get("versionMatchesLock")
            for record in included_records
            if isinstance(record.get("version"), dict)
        ),
        "diskBelow80Percent": max_disk < 80,
        "projectedDiskBelow80PercentIn12Months": projected_disk_12_months < 80,
        "memoryGrowthAtMost20Percent": max_memory_growth <= 20,
        "noThrottleFlags": not throttled,
        "certificateAtLeast30Days": bool(certificate_days) and min(certificate_days) >= 30,
        "kernelTelemetryComplete": kernel_telemetry_complete,
        "thermalTelemetryComplete": thermal_telemetry_complete,
        "postgresTelemetryAtLeast99_5Percent": postgres_telemetry_coverage >= 99.5,
        "certificateTelemetryAtLeast99_5Percent": certificate_telemetry_coverage >= 99.5,
        "versionTelemetryAtLeast99_5Percent": version_telemetry_coverage >= 99.5,
        "rssTelemetryAtLeast99_5Percent": rss_telemetry_coverage >= 99.5,
    }
    report = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "inputs": [str(path) for path in existing_inputs],
        "samples": len(records),
        "includedSamples": len(included_records),
        "expectedSamples": expected_samples,
        "excludedMaintenanceSamples": len(records) - len(included_records),
        "durationDays": round(duration_days, 3),
        "availabilityPercent": round(availability, 4),
        "longestFailedMinutes": longest_failed_samples * 5,
        "maxDiskUsedPercent": max_disk,
        "projectedDiskUsedPercentIn12Months": round(projected_disk_12_months, 3),
        "maxTemperatureC": max(temperatures) if temperatures else None,
        "memoryGrowthPercent": {key: round(value, 3) for key, value in memory_growth.items()},
        "telemetryCoveragePercent": {
            "postgres": round(postgres_telemetry_coverage, 3),
            "certificate": round(certificate_telemetry_coverage, 3),
            "version": round(version_telemetry_coverage, 3),
            "rss": round(rss_telemetry_coverage, 3),
        },
        "checks": checks,
        "passed": all(checks.values()),
    }
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
