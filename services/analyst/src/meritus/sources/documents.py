"""Safe discovery and location-preserving extraction for official documents."""

from __future__ import annotations

import fcntl
import json
import math
import time
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup
from odf.opendocument import load
from odf.table import Table, TableRow
from odf.text import P
from pypdf import PdfReader

OFFICIAL_DOCUMENT_HOSTS = {"www.gov.uk", "assets.publishing.service.gov.uk"}
SUPPORTED_DOCUMENT_SUFFIXES = (".pdf", ".ods")


@dataclass(frozen=True)
class DocumentCell:
    text: str
    value_type: str | None
    row: int
    column: int


class FileSlidingWindowBudget:
    """A small process-safe request budget for workers sharing one data volume."""

    def __init__(self, path: Path, *, limit: int, window_seconds: int, clock=time.time):
        self.path = Path(path)
        self.limit = limit
        self.window_seconds = window_seconds
        self.clock = clock

    def acquire(self) -> int | None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        now = self.clock()
        with self.path.open("a+", encoding="utf-8") as handle:
            fcntl.flock(handle, fcntl.LOCK_EX)
            handle.seek(0)
            try:
                calls = json.load(handle)
            except (json.JSONDecodeError, ValueError):
                calls = []
            calls = [
                float(item)
                for item in calls
                if isinstance(item, (int, float)) and float(item) > now - self.window_seconds
            ]
            if len(calls) >= self.limit:
                return max(1, math.ceil(self.window_seconds - (now - calls[0])))
            calls.append(now)
            handle.seek(0)
            handle.truncate()
            json.dump(calls, handle)
            handle.flush()
        return None


def discover_official_attachments(
    html: str,
    page_url: str,
    suffixes: tuple[str, ...] = SUPPORTED_DOCUMENT_SUFFIXES,
    *,
    link_text: str | None = None,
) -> list[str]:
    """Return unique supported links while refusing non-official and insecure targets."""
    if urlsplit(page_url).scheme != "https" or urlsplit(page_url).hostname != "www.gov.uk":
        raise ValueError("Publication discovery must start on an official HTTPS GOV.UK page.")
    links: list[str] = []
    seen: set[str] = set()
    for anchor in BeautifulSoup(html, "lxml").find_all("a", href=True):
        if link_text and link_text.casefold() not in anchor.get_text(" ", strip=True).casefold():
            continue
        target = urljoin(page_url, anchor["href"])
        parts = urlsplit(target)
        if parts.scheme != "https" or parts.hostname not in OFFICIAL_DOCUMENT_HOSTS:
            continue
        clean = parts._replace(query="", fragment="").geturl()
        if not parts.path.lower().endswith(tuple(item.lower() for item in suffixes)):
            continue
        if clean not in seen:
            seen.add(clean)
            links.append(clean)
    return links


def pdf_pages(data: bytes) -> list[str]:
    try:
        reader = PdfReader(BytesIO(data))
        return [(page.extract_text() or "").strip() for page in reader.pages]
    except Exception as error:
        raise ValueError("Published PDF could not be parsed.") from error


def _cell_text(cell) -> str:
    paragraphs = []
    for paragraph in cell.getElementsByType(P):
        parts = [node.data for node in paragraph.childNodes if hasattr(node, "data")]
        paragraphs.append("".join(parts))
    return " ".join(item for item in paragraphs if item).strip()


def ods_tables(data: bytes, *, max_rows: int = 20_000, max_columns: int = 256):
    """Expand repeated ODS rows/cells within bounds and retain logical coordinates."""
    try:
        document = load(BytesIO(data))
    except Exception as error:
        raise ValueError("Published ODS workbook could not be parsed.") from error
    result: dict[str, list[list[DocumentCell]]] = {}
    for table in document.spreadsheet.getElementsByType(Table):
        name = table.getAttribute("name") or "Sheet"
        rows: list[list[DocumentCell]] = []
        logical_row = 1
        for row in table.getElementsByType(TableRow):
            repeats = min(int(row.getAttribute("numberrowsrepeated") or 1), max_rows)
            cells: list[DocumentCell] = []
            column = 1
            for cell in row.childNodes:
                if getattr(cell, "qname", (None, None))[1] not in {
                    "table-cell",
                    "covered-table-cell",
                }:
                    continue
                cell_repeats = int(cell.getAttribute("numbercolumnsrepeated") or 1)
                text = _cell_text(cell)
                value_type = cell.getAttribute("valuetype")
                if not text and value_type in {"float", "percentage", "currency"}:
                    text = cell.getAttribute("value") or ""
                for _ in range(min(cell_repeats, max_columns - column + 1)):
                    cells.append(DocumentCell(text, value_type, logical_row, column))
                    column += 1
                if column > max_columns:
                    break
            if repeats > max_rows - len(rows) and not any(item.text for item in cells):
                # Spreadsheet applications commonly encode the unused tail as one repeated row.
                break
            for _ in range(repeats):
                if len(rows) >= max_rows:
                    raise ValueError("Published ODS exceeds the configured row limit.")
                rows.append(
                    [
                        DocumentCell(item.text, item.value_type, logical_row, item.column)
                        for item in cells
                    ]
                )
                logical_row += 1
        result[name] = rows
    return result


def column_name(column: int) -> str:
    if column < 1:
        raise ValueError("ODS columns are one-based.")
    result = ""
    while column:
        column, remainder = divmod(column - 1, 26)
        result = chr(65 + remainder) + result
    return result
