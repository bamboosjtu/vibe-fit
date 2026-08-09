#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

DEPLOY_DIR = Path(__file__).resolve().parent.parent
SOAK_DIR = DEPLOY_DIR / "soak"
ACTIVE_FILE = SOAK_DIR / "maintenance-active.json"
HISTORY_FILE = SOAK_DIR / "maintenance-windows.jsonl"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> int:
    parser = argparse.ArgumentParser(description="Record an excluded maintenance window")
    subparsers = parser.add_subparsers(dest="command", required=True)
    start = subparsers.add_parser("start")
    start.add_argument("reason")
    end = subparsers.add_parser("end")
    end.add_argument("--result", default="completed")
    args = parser.parse_args()
    SOAK_DIR.mkdir(parents=True, exist_ok=True)

    if args.command == "start":
        if ACTIVE_FILE.exists():
            active = json.loads(ACTIVE_FILE.read_text(encoding="utf-8"))
            raise SystemExit(f"maintenance window already active: {active}")
        temporary = ACTIVE_FILE.with_suffix(".tmp")
        temporary.write_text(
            json.dumps({"start": now(), "reason": args.reason}, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        os.replace(temporary, ACTIVE_FILE)
        print(f"maintenance window started: {args.reason}")
        return 0

    if not ACTIVE_FILE.exists():
        raise SystemExit("no active maintenance window")
    record = json.loads(ACTIVE_FILE.read_text(encoding="utf-8"))
    record.update({"end": now(), "result": args.result})
    with HISTORY_FILE.open("a", encoding="utf-8") as history:
        history.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
    ACTIVE_FILE.unlink()
    print(f"maintenance window ended: {record['reason']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
