#!/usr/bin/env python3
"""Fail CI when a live test report contains skips or no executed tests."""

from __future__ import annotations

import argparse
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


def validate_junit(path: Path) -> tuple[int, int, int]:
    root = ET.parse(path).getroot()
    cases = list(root.iter("testcase"))
    skipped = sum(case.find("skipped") is not None for case in cases)
    failed = sum(
        case.find("failure") is not None or case.find("error") is not None
        for case in cases
    )
    return len(cases), skipped, failed


def validate_playwright(path: Path) -> tuple[int, int, int]:
    report: dict[str, Any] = json.loads(path.read_text(encoding="utf-8-sig"))
    stats = report.get("stats")
    if not isinstance(stats, dict):
        raise ValueError("Playwright report is missing its stats object.")
    executed = int(stats.get("expected", 0)) + int(stats.get("unexpected", 0))
    return executed, int(stats.get("skipped", 0)), int(stats.get("unexpected", 0))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("format", choices=("junit", "playwright"))
    parser.add_argument("report", type=Path)
    arguments = parser.parse_args()

    try:
        if arguments.format == "junit":
            executed, skipped, failed = validate_junit(arguments.report)
        else:
            executed, skipped, failed = validate_playwright(arguments.report)
    except (OSError, ET.ParseError, ValueError, TypeError, json.JSONDecodeError) as error:
        print(f"Live test report validation failed: {error}", file=sys.stderr)
        return 1

    print(f"Live test report: executed={executed}, skipped={skipped}, failed={failed}")
    if executed == 0 or skipped != 0 or failed != 0:
        print("Live verification requires executed tests with zero skips and failures.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
