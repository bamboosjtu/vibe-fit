#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEPLOY_DIR = Path(__file__).resolve().parent.parent
CONFIG_FILE = Path(os.environ.get("CONFIG_FILE", DEPLOY_DIR / "config.env"))
IMAGE_LOCK_FILE = Path(os.environ.get("IMAGE_LOCK_FILE", DEPLOY_DIR / "images.lock.env"))
COMPOSE_FILE = DEPLOY_DIR / "compose.yaml"
OUTPUT_FILE = DEPLOY_DIR / "soak" / "observations.jsonl"
MAX_LOG_BYTES = 10 * 1024 * 1024
COMPOSE_ENV = os.environ.copy()


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value
    return values


def config_path(config: dict[str, str], key: str, default: str) -> Path:
    value = config.get(key, default)
    path = Path(value)
    return path if path.is_absolute() else DEPLOY_DIR / value.removeprefix("./")


def run(
    command: list[str],
    timeout: int = 20,
    compose_secrets: bool = False,
) -> tuple[int, str, str]:
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
        env=COMPOSE_ENV if compose_secrets else None,
    )
    return completed.returncode, completed.stdout.strip(), completed.stderr.strip()


def compose_command(*args: str) -> list[str]:
    return [
        "docker",
        "compose",
        "--env-file",
        str(CONFIG_FILE),
        "--env-file",
        str(IMAGE_LOCK_FILE),
        "--file",
        str(COMPOSE_FILE),
        *args,
    ]


def load_compose_secret_environment(config: dict[str, str]) -> None:
    secret_paths = {
        "VIBEFIT_SECRET_POSTGRES_PASSWORD": ("POSTGRES_PASSWORD_FILE_PATH", "./secrets/postgres_password"),
        "VIBEFIT_SECRET_DATABASE_URL": ("DATABASE_URL_FILE_PATH", "./secrets/database_url"),
        "VIBEFIT_SECRET_JWT_SECRET": ("JWT_SECRET_FILE_PATH", "./secrets/jwt_secret"),
        "VIBEFIT_SECRET_SMTP_PASSWORD": ("SMTP_PASSWORD_FILE_PATH", "./secrets/smtp_password"),
        "VIBEFIT_SECRET_TLS_CERT": ("TLS_CERT_FILE_PATH", "./secrets/tls_cert.pem"),
        "VIBEFIT_SECRET_TLS_KEY": ("TLS_KEY_FILE_PATH", "./secrets/tls_key.pem"),
        "VIBEFIT_SECRET_ROOT_CA": ("ROOT_CA_FILE_PATH", "./secrets/root_ca.pem"),
    }
    for environment_name, (config_key, default) in secret_paths.items():
        value = config_path(config, config_key, default).read_text(encoding="utf-8")
        COMPOSE_ENV[environment_name] = value.rstrip("\r\n")

    restic_password = config_path(
        config,
        "RESTIC_PASSWORD_FILE_PATH",
        "./secrets/restic_password",
    )
    if restic_password.is_file():
        COMPOSE_ENV["VIBEFIT_SECRET_RESTIC_PASSWORD"] = (
            restic_password.read_text(encoding="utf-8").rstrip("\r\n")
        )
    elif config.get("BACKUP_ENABLED", "false") == "true":
        raise FileNotFoundError(
            f"BACKUP_ENABLED=true but Restic password is missing: {restic_password}"
        )
    else:
        COMPOSE_ENV.pop("VIBEFIT_SECRET_RESTIC_PASSWORD", None)


def parse_json_output(output: str) -> list[dict[str, Any]]:
    if not output:
        return []
    try:
        parsed = json.loads(output)
        return parsed if isinstance(parsed, list) else [parsed]
    except json.JSONDecodeError:
        records: list[dict[str, Any]] = []
        for line in output.splitlines():
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                records.append(value)
    return records


def get_process_rss_bytes(container_id: str) -> int | None:
    code, output, _ = run(
        [
            "docker",
            "exec",
            container_id,
            "sh",
            "-c",
            "awk '/^VmRSS:/ { total += $2 } END { printf \"%.0f\\n\", total * 1024 }' "
            "/proc/[0-9]*/status 2>/dev/null",
        ]
    )
    return int(output) if code == 0 and output.isdigit() else None


def get_container_state() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    _, ids_output, _ = run(
        compose_command("ps", "--all", "--quiet"),
        compose_secrets=True,
    )
    container_ids = [value for value in ids_output.splitlines() if value]
    if not container_ids:
        return [], []

    _, inspect_output, _ = run(["docker", "inspect", *container_ids])
    inspected = parse_json_output(inspect_output)
    states = []
    for container in inspected:
        state = container.get("State", {})
        health = state.get("Health", {}).get("Status")
        labels = container.get("Config", {}).get("Labels", {}) or {}
        container_id = str(container.get("Id", ""))
        rss_bytes = (
            get_process_rss_bytes(container_id)
            if container_id and state.get("Status") == "running"
            else None
        )
        states.append(
            {
                "service": labels.get("com.docker.compose.service", container.get("Name", "").lstrip("/")),
                "status": state.get("Status"),
                "health": health,
                "restartCount": container.get("RestartCount", 0),
                "oomKilled": bool(state.get("OOMKilled", False)),
                "exitCode": state.get("ExitCode"),
                "rssBytes": rss_bytes,
            }
        )

    _, stats_output, _ = run(
        ["docker", "stats", "--no-stream", "--format", "{{json .}}", *container_ids],
        timeout=30,
    )
    return states, parse_json_output(stats_output)


def get_temperature() -> tuple[float | None, str | None]:
    if not shutil.which("vcgencmd"):
        return None, None
    _, temp_output, _ = run(["vcgencmd", "measure_temp"])
    match = re.search(r"([0-9.]+)", temp_output)
    _, throttle_output, _ = run(["vcgencmd", "get_throttled"])
    return (float(match.group(1)) if match else None), (throttle_output or None)


def get_kernel_errors() -> tuple[int | None, int | None, str | None]:
    code, output, error = run(["dmesg", "--level=err", "--since", "6 minutes ago"])
    if code != 0:
        return None, None, error or "dmesg unavailable"
    io_matches = re.findall(r"I/O error|Buffer I/O|EXT4-fs error|mmc[^\n]*error", output, re.IGNORECASE)
    oom_matches = re.findall(r"out of memory|oom-kill|killed process", output, re.IGNORECASE)
    return len(io_matches), len(oom_matches), None


def get_database_size(config: dict[str, str]) -> int | None:
    code, output, _ = run(
        compose_command(
            "exec",
            "-T",
            "postgres",
            "psql",
            "-U",
            config.get("POSTGRES_USER", "vibefit"),
            "-d",
            config.get("POSTGRES_DB", "vibefit"),
            "-Atc",
            "SELECT pg_database_size(current_database());",
        ),
        compose_secrets=True,
    )
    if code != 0 or not output.isdigit():
        return None
    return int(output)


def get_certificate_days(config: dict[str, str]) -> int | None:
    certificate = config_path(config, "TLS_CERT_FILE_PATH", "./secrets/tls_cert.pem")
    code, output, _ = run(["openssl", "x509", "-in", str(certificate), "-enddate", "-noout"])
    if code != 0 or "=" not in output:
        return None
    expires = datetime.strptime(output.split("=", 1)[1], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    return max(0, int((expires - datetime.now(timezone.utc)).total_seconds() // 86400))


def get_running_version(config: dict[str, str]) -> dict[str, str] | None:
    host = config.get("VIBEFIT_HOST", "")
    if not host:
        return None
    root_ca = config_path(config, "ROOT_CA_FILE_PATH", "./secrets/root_ca.pem")
    code, output, _ = run(
        [
            "curl",
            "--fail",
            "--silent",
            "--show-error",
            "--cacert",
            str(root_ca),
            "--resolve",
            f"{host}:443:127.0.0.1",
            "--noproxy",
            host,
            f"https://{host}/api/version",
        ]
    )
    if code != 0:
        return None
    try:
        value = json.loads(output)
    except json.JSONDecodeError:
        return None
    fields = ("releaseVersion", "gitRevision", "databaseSchemaVersion")
    if not isinstance(value, dict) or not all(str(value.get(field, "")) for field in fields):
        return None
    return {field: str(value[field]) for field in fields}


def rotate_log() -> None:
    if not OUTPUT_FILE.exists() or OUTPUT_FILE.stat().st_size < MAX_LOG_BYTES:
        return
    oldest = OUTPUT_FILE.with_suffix(".jsonl.3")
    if oldest.exists():
        oldest.unlink()
    for index in (2, 1):
        source = OUTPUT_FILE.with_suffix(f".jsonl.{index}")
        target = OUTPUT_FILE.with_suffix(f".jsonl.{index + 1}")
        if source.exists():
            source.replace(target)
    OUTPUT_FILE.replace(OUTPUT_FILE.with_suffix(".jsonl.1"))


def main() -> int:
    config = read_env_file(CONFIG_FILE)
    image_lock = read_env_file(IMAGE_LOCK_FILE)
    load_compose_secret_environment(config)
    states, stats = get_container_state()
    expected_services = {"postgres", "worker", "backend", "frontend", "caddy"}
    healthy_services = {
        state["service"]
        for state in states
        if state["status"] == "running" and state["health"] in (None, "healthy")
    }
    data_path = Path(config.get("VIBEFIT_DATA_DIR", "/srv/vibefit/data"))
    disk = shutil.disk_usage(data_path if data_path.exists() else "/")
    temperature, throttled = get_temperature()
    io_errors, oom_events, io_error_detail = get_kernel_errors()
    running_version = get_running_version(config)
    certificate_days_remaining = get_certificate_days(config)
    certificate_ok = (
        certificate_days_remaining is not None
        and certificate_days_remaining >= 30
    )
    version_matches_lock = bool(
        running_version
        and running_version["releaseVersion"] == image_lock.get("RELEASE_VERSION")
        and running_version["gitRevision"] == image_lock.get("GIT_REVISION")
    )
    migration_ok = any(
        state["service"] == "migrate"
        and state["status"] == "exited"
        and state["exitCode"] == 0
        for state in states
    )

    record = {
        "observedAt": datetime.now(timezone.utc).isoformat(),
        "sampleSuccess": (
            expected_services.issubset(healthy_services)
            and migration_ok
            and version_matches_lock
            and certificate_ok
        ),
        "migrationOk": migration_ok,
        "version": running_version,
        "versionMatchesLock": version_matches_lock,
        "containers": states,
        "stats": stats,
        "host": {
            "diskUsedPercent": round((disk.used / disk.total) * 100, 3),
            "diskFreeBytes": disk.free,
            "temperatureC": temperature,
            "throttled": throttled,
            "ioErrors": io_errors,
            "oomEvents": oom_events,
            "ioErrorDetail": io_error_detail,
        },
        "postgresBytes": get_database_size(config),
        "certificateDaysRemaining": certificate_days_remaining,
        "certificateOk": certificate_ok,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    rotate_log()
    with OUTPUT_FILE.open("a", encoding="utf-8") as output:
        output.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps(record, ensure_ascii=False))
    return 0 if record["sampleSuccess"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
