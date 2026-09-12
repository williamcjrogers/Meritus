#!/usr/bin/env python3
"""Compare browser-downloaded exports with a saved snapshot under current rights."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import stat
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from meritus.db import create_engine_for_url, session_scope
from meritus.outputs.reports import (
    _FIELDS,
    _condition_context,
    _permitted_items,
    export_conditions,
    render_csv,
    render_html,
)
from meritus.read_access import sanitise_ranked_items
from meritus.repository import Repository
from meritus.sources.policy import permission_allows

_COMPARED_FIELDS = (
    "rank",
    "subject",
    "name",
    "score",
    "eligible",
    "independent_events",
    "latest_evidence_at",
    "evidence_links",
    "source_ids",
)


class _ReportTable(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_table = False
        self.cell: list[str] | None = None
        self.row: list[str] | None = None
        self.rows: list[list[str]] = []
        self.text: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        del attrs
        if tag == "table":
            self.in_table = True
        elif self.in_table and tag == "tr":
            self.row = []
        elif self.in_table and tag in {"th", "td"}:
            self.cell = []

    def handle_endtag(self, tag: str) -> None:
        if self.in_table and tag in {"th", "td"} and self.cell is not None:
            assert self.row is not None
            self.row.append("".join(self.cell))
            self.cell = None
        elif self.in_table and tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None
        elif tag == "table":
            self.in_table = False

    def handle_data(self, data: str) -> None:
        self.text.append(data)
        if self.cell is not None:
            self.cell.append(data)


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "run_dir",
        type=Path,
        help="Browser acceptance directory containing report.json, snapshot.csv and snapshot.html",
    )
    parser.add_argument(
        "--database-env",
        default="MERITUS_DATABASE_URL",
        help="Environment variable containing the private acceptance database URL",
    )
    return parser.parse_args()


def _load_browser_run(run_dir: Path) -> tuple[dict[str, Any], str, bytes, bytes]:
    resolved = run_dir.resolve()
    verification_root = (Path.cwd() / "data" / "verification" / "browser-acceptance").resolve()
    if resolved.parent != verification_root:
        raise ValueError("run_dir must be a direct child of data/verification/browser-acceptance")
    report = json.loads((resolved / "report.json").read_text())
    if report.get("mocked_responses") is not False:
        raise ValueError("browser report must explicitly record mocked_responses=false")
    step = next(
        (
            item
            for item in report.get("steps") or []
            if item.get("name") == "Saved snapshot and actual CSV/HTML exports"
        ),
        None,
    )
    if (
        not step
        or step.get("status") != "passed"
        or not (step.get("result") or {}).get("snapshot_id")
    ):
        raise ValueError("browser report has no passed saved-export step")
    csv_path = resolved / "snapshot.csv"
    html_path = resolved / "snapshot.html"
    for path in (csv_path, html_path):
        mode = stat.S_IMODE(path.stat().st_mode)
        if mode & 0o077:
            raise ValueError(f"{path.name} must not be group/world accessible")
    return report, str(step["result"]["snapshot_id"]), csv_path.read_bytes(), html_path.read_bytes()


def _current_snapshot(repo: Repository, snapshot_id: str, now: datetime) -> dict[str, Any]:
    snapshot = repo.get_snapshot(snapshot_id)
    payload = snapshot.get("payload") or {}
    frozen_policy = payload.get("export_policy") or {}
    current = {source["id"]: source for source in repo.list_sources()}
    payload["export_policy"] = {
        source_id: frozen_policy.get(source_id) is True
        and source_id in current
        and permission_allows(current[source_id], "export", now)
        for source_id in set(frozen_policy) | set(current)
    }
    with session_scope(repo.engine) as session:
        payload["items"] = sanitise_ranked_items(
            session,
            payload.get("items", payload.get("rankings", [])),
            rule_version=snapshot.get("rule_version"),
            knowledge_cutoff=payload.get("knowledge_cutoff"),
            applied_rules=payload.get("applied_rules"),
            frozen_inputs=payload,
            export_policy=payload["export_policy"],
            now=now,
        )
    payload["current_permissions"] = {
        source_id: source.get("permissions") or {} for source_id, source in current.items()
    }
    snapshot["payload"] = payload
    return snapshot


def _json_cell(value: str) -> Any:
    return json.loads(value) if value else []


def _report_cell(value: Any) -> str:
    if value is None:
        text = ""
    elif isinstance(value, bool):
        text = "true" if value else "false"
    elif isinstance(value, (dict, list, tuple)):
        text = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    else:
        text = str(value)
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) else text


def _validate_csv(
    snapshot: dict[str, Any], downloaded: bytes, condition_context: dict[str, Any]
) -> int:
    text = downloaded.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    if tuple(reader.fieldnames or ()) != _FIELDS:
        raise AssertionError("CSV field order does not match the approved report contract")
    rows = list(reader)
    items = _permitted_items(snapshot)
    if len(rows) != len(items):
        raise AssertionError(f"CSV has {len(rows)} rows; expected {len(items)}")
    for position, (row, item) in enumerate(zip(rows, items, strict=True), start=1):
        expected_scalars = {
            field: _report_cell(item.get(field))
            for field in (
                "rank",
                "subject",
                "name",
                "score",
                "eligible",
                "independent_events",
                "latest_evidence_at",
            )
        }
        for field, expected in expected_scalars.items():
            if row[field] != expected:
                raise AssertionError(
                    f"CSV row {position} {field} differs from the rights-filtered snapshot"
                )
        for field in ("evidence_links", "source_ids"):
            if _json_cell(row[field]) != (item.get(field) or []):
                raise AssertionError(
                    f"CSV row {position} {field} differs from the rights-filtered snapshot"
                )
        conditions = export_conditions(snapshot, [item], _context=condition_context)
        if _json_cell(row["permitted_retention_conditions"]) != conditions["retention_conditions"]:
            raise AssertionError(f"CSV row {position} retention conditions differ")
        if (
            _json_cell(row["permitted_distribution_conditions"])
            != conditions["distribution_conditions"]
        ):
            raise AssertionError(f"CSV row {position} distribution conditions differ")
    return len(rows)


def _validate_html(
    snapshot: dict[str, Any], downloaded: bytes, condition_context: dict[str, Any]
) -> int:
    parser = _ReportTable()
    parser.feed(downloaded.decode("utf-8"))
    if not parser.rows or tuple(parser.rows[0]) != tuple(
        field.replace("_", " ").title() for field in _FIELDS
    ):
        raise AssertionError("HTML table headings do not match the approved report contract")
    rows = parser.rows[1:]
    items = _permitted_items(snapshot)
    if len(rows) != len(items):
        raise AssertionError(f"HTML has {len(rows)} rows; expected {len(items)}")
    field_positions = {field: _FIELDS.index(field) for field in _COMPARED_FIELDS}
    for position, (html_row, item) in enumerate(zip(rows, items, strict=True), start=1):
        for field, index in field_positions.items():
            if html_row[index] != _report_cell(item.get(field)):
                raise AssertionError(f"HTML row {position} {field} differs from the saved snapshot")
    all_text = " ".join(" ".join(parser.text).split())
    conditions = export_conditions(snapshot, items, _context=condition_context)
    for condition in [
        *conditions["retention_conditions"],
        *conditions["distribution_conditions"],
    ]:
        if condition not in all_text:
            raise AssertionError("HTML omits a permitted retention or distribution condition")
    return len(rows)


def main() -> int:
    args = _arguments()
    report, snapshot_id, downloaded_csv, downloaded_html = _load_browser_run(args.run_dir)
    database_url = os.environ.get(args.database_env)
    if not database_url:
        raise ValueError(f"{args.database_env} is not configured")
    now = datetime.now(UTC)
    repo = Repository(create_engine_for_url(database_url))
    snapshot = _current_snapshot(repo, snapshot_id, now)
    condition_context = _condition_context(snapshot)
    expected_csv = render_csv(snapshot).encode("utf-8")
    expected_html = render_html(snapshot).encode("utf-8")
    if downloaded_csv != expected_csv:
        raise AssertionError("downloaded CSV bytes differ from the current-rights saved snapshot")
    if downloaded_html != expected_html:
        raise AssertionError("downloaded HTML bytes differ from the current-rights saved snapshot")
    csv_rows = _validate_csv(snapshot, downloaded_csv, condition_context)
    html_rows = _validate_html(snapshot, downloaded_html, condition_context)
    result = {
        "verified_at": now.isoformat(),
        "run_id": report.get("run_id"),
        "snapshot_id": snapshot_id,
        "current_rights_applied": True,
        "csv": {
            "rows": csv_rows,
            "bytes": len(downloaded_csv),
            "sha256": hashlib.sha256(downloaded_csv).hexdigest(),
            "exact_saved_snapshot_match": True,
        },
        "html": {
            "rows": html_rows,
            "bytes": len(downloaded_html),
            "sha256": hashlib.sha256(downloaded_html).hexdigest(),
            "exact_saved_snapshot_match": True,
        },
        "compared_fields": list(_COMPARED_FIELDS),
        "conditions_compared": ["retention", "distribution"],
        "frozen_record_condition_index_built_once": True,
        "passed": True,
    }
    output_path = args.run_dir.resolve() / "export-verification.json"
    output_path.write_text(json.dumps(result, indent=2) + "\n")
    output_path.chmod(0o600)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
