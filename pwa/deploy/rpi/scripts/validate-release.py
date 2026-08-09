#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

DEPLOY_DIR = Path(__file__).resolve().parent.parent
EXPECTED_IMAGES = {
    "BACKEND_IMAGE",
    "WORKER_IMAGE",
    "FRONTEND_IMAGE",
    "MAINTENANCE_IMAGE",
    "POSTGRES_IMAGE",
    "CADDY_IMAGE",
}
LONG_RUNNING_SERVICES = {"postgres", "worker", "backend", "frontend", "caddy"}
ACR_DIGEST = re.compile(
    r"^[^/\s]+\.personal\.cr\.aliyuncs\.com/[^/\s]+/[^/@\s]+@sha256:[0-9a-f]{64}$"
)


def fail(message: str) -> None:
    raise ValueError(message)


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value
    return values


def service_blocks(compose_text: str) -> dict[str, str]:
    blocks: dict[str, list[str]] = {}
    in_services = False
    current: str | None = None
    for line in compose_text.splitlines():
        if line == "services:":
            in_services = True
            continue
        if not in_services:
            continue
        if in_services and line and not line.startswith(" "):
            break
        service_match = re.match(r"^  ([a-z0-9-]+):\s*$", line)
        if service_match:
            current = service_match.group(1)
            blocks[current] = []
        elif current is not None:
            blocks[current].append(line)
    return {name: "\n".join(lines) for name, lines in blocks.items()}


def validate_compose(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if re.search(r"^\s+build:\s*", text, re.MULTILINE):
        fail("production Compose contains build:")
    if re.search(r"^\s+container_name:\s*", text, re.MULTILINE):
        fail("production Compose contains container_name:")
    if re.search(r"(^|[:/@-])latest([@\s]|$)", text, re.IGNORECASE):
        fail("production Compose contains latest")
    for forbidden in ("vibefit_dev_password", "replace-with", "dev-only-secret"):
        if forbidden in text:
            fail(f"production Compose contains forbidden development value: {forbidden}")
    if re.search(r"^\s+file:\s*\$\{.*(?:PASSWORD|SECRET|KEY)", text, re.MULTILINE):
        fail("sensitive Compose secrets must not use file-backed bind mounts")
    for secret_name in (
        "POSTGRES_PASSWORD",
        "DATABASE_URL",
        "JWT_SECRET",
        "SMTP_PASSWORD",
        "TLS_CERT",
        "TLS_KEY",
        "ROOT_CA",
        "RESTIC_PASSWORD",
    ):
        if f"environment: VIBEFIT_SECRET_{secret_name}" not in text:
            fail(f"missing environment-backed secret: {secret_name}")

    blocks = service_blocks(text)
    expected = LONG_RUNNING_SERVICES | {"migrate", "maintenance"}
    if set(blocks) != expected:
        fail(f"unexpected service set: {sorted(blocks)}")
    for name, block in blocks.items():
        if "image: ${" not in block:
            fail(f"{name} does not use an image-lock variable")
        if name != "caddy" and re.search(r"^    ports:\s*$", block, re.MULTILINE):
            fail(f"{name} exposes a host port")
        if "no-new-privileges:true" not in block:
            fail(f"{name} is missing no-new-privileges")
        if "cap_drop:\n      - ALL" not in block:
            fail(f"{name} does not drop all Linux capabilities")
        if "read_only: true" not in block:
            fail(f"{name} does not use a read-only root filesystem")
    for name in LONG_RUNNING_SERVICES:
        block = blocks[name]
        if "restart: unless-stopped" not in block:
            fail(f"{name} is missing restart: unless-stopped")
        if "healthcheck:" not in block:
            fail(f"{name} is missing a health check")
        if "mem_limit:" not in block:
            fail(f"{name} is missing a memory limit")

    caddy_ports = blocks["caddy"]
    if '"80:80"' not in caddy_ports or '"443:443"' not in caddy_ports:
        fail("Caddy must be the only 80/443 entry point")
    print(f"PASS compose policy: {path}")


def validate_lock(path: Path, check_manifests: bool) -> None:
    values = read_env(path)
    if set(values) & EXPECTED_IMAGES != EXPECTED_IMAGES:
        fail(f"image lock is missing keys: {sorted(EXPECTED_IMAGES - set(values))}")
    if not re.fullmatch(r"\d+\.\d+\.\d+", values.get("RELEASE_VERSION", "")):
        fail("image lock RELEASE_VERSION is not exact semver")
    if not re.fullmatch(r"[0-9a-f]{7,40}", values.get("GIT_REVISION", "")):
        fail("image lock GIT_REVISION is not a Git SHA")

    for key in sorted(EXPECTED_IMAGES):
        image = values[key]
        if not ACR_DIGEST.fullmatch(image):
            fail(f"{key} is not an immutable Alibaba ACR Personal digest: {image}")
        if image.endswith("0" * 64):
            fail(f"{key} still uses the example digest")
        if check_manifests:
            result = subprocess.run(
                ["docker", "buildx", "imagetools", "inspect", image],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode != 0:
                fail(f"cannot inspect {image}: {result.stderr.strip()}")
            for platform in ("linux/amd64", "linux/arm64"):
                if platform not in result.stdout:
                    fail(f"{image} is missing {platform}")
    print(f"PASS immutable image lock: {path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the immutable VibeFit Pi release")
    parser.add_argument("--compose", type=Path, default=DEPLOY_DIR / "compose.yaml")
    parser.add_argument("--lock", type=Path)
    parser.add_argument("--check-manifests", action="store_true")
    args = parser.parse_args()
    try:
        validate_compose(args.compose)
        if args.lock:
            validate_lock(args.lock, args.check_manifests)
    except (OSError, ValueError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
