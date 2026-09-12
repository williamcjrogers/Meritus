"""Official GOV.UK register and building-safety publication adapters."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from io import BytesIO
from urllib.parse import urlsplit

from bs4 import BeautifulSoup
from pypdf import PdfReader

from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.sources.common import organisation, source_date
from meritus.sources.documents import (
    column_name,
    discover_official_attachments,
    ods_tables,
    pdf_pages,
)
from meritus.sources.http import FetchError, fetch_bytes

GOVERNMENT_HOSTS = {"www.gov.uk", "assets.publishing.service.gov.uk"}
PUBLICATION_URLS = {
    "bsr_gateway": "https://www.gov.uk/government/publications/building-safety-regulator-building-control-approval-application-data-june-to-august-2026",
    "ras_members": "https://www.gov.uk/government/publications/responsible-actors-scheme/responsible-actors-scheme-members-list",
    "ras_prohibitions": "https://www.gov.uk/government/publications/responsible-actors-scheme/responsible-actors-scheme-prohibitions-list",
    "developer_remediation": "https://www.gov.uk/government/publications/building-safety-remediation-monthly-data-release-july-2026",
    "debarment": "https://www.gov.uk/guidance/debarment-review-service-drs",
}
_DATE = re.compile(
    r"\b([0-3]?\d\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2})\b",
    re.IGNORECASE,
)
_NUMBER = re.compile(r"^-?[0-9][0-9,]*(?:\.[0-9]+)?%?$")
_NUMERIC_CELL = re.compile(
    r"^(?P<number>-?[0-9][0-9,]*(?:\.[0-9]+)?)"
    r"\s*(?P<unit>%|weeks?|days?)?"
    r"(?:\s*\(\s*-?[0-9][0-9,]*\s*\))?$",
    re.IGNORECASE,
)

_CATEGORY_ALIASES = {
    "new build": "new_hrbs_and_conversions",
    "new hrbs and conversions": "new_hrbs_and_conversions",
    "external remediation": "external_remediation",
    "external remediations": "external_remediation",
    "hrb internal works": "hrb_internal_works",
    "hrb internal works (category a and b)": "hrb_internal_works",
    "nhs": "nhs_internal_works",
    "nhs applications": "nhs_internal_works",
    "nhs internal works": "nhs_internal_works",
    "nhs internal works (category a and b)": "nhs_internal_works",
}
_METRIC_ALIASES = {
    "in progress": "in_progress",
    "units": "units_in_progress",
    "units in progress": "units_in_progress",
    "invalid or withdrawn": "invalid_or_withdrawn",
    "invalid / withdrawn": "invalid_or_withdrawn",
    "decisions made": "decisions_made",
    "new in": "new_in",
    "approval rate": "approval_rate",
    "approval % (#)": "approval_rate",
    "median approval time": "median_approval_time",
    "median processing time": "median_processing_time",
    "approval weeks": "median_approval_time",
    "units approved": "units_approved",
    "live major change requests": "live_major_change_requests",
    "closed": "closed_major_change_requests",
    "median weeks to close": "median_weeks_to_close",
    "rejection % (#)": "rejection_rate",
    "rejection weeks": "median_rejection_time",
}
_COMPLEX_METRIC_ALIASES = {
    "in progress complex cases": "in_progress",
    "complex cases approval weeks": "median_approval_time",
}
_METRIC_UNITS = {
    "median_approval_time": "weeks",
    "median_processing_time": "weeks",
    "median_rejection_time": "weeks",
    "median_weeks_to_close": "weeks",
}
_DEBARMENT_HEADER_TERMS = (
    ("name", "supplier"),
    ("public", "procurement", "organisation", "number", "ppon"),
    ("company", "charity", "registration", "number"),
    ("exclusion", "ground", "applies"),
    ("exclusion", "ground", "mandatory", "discretionary"),
    ("entry", "schedule", "supplier"),
    ("date", "exclusion", "ground", "cease"),
    ("link", "drs", "report"),
)
_DEBARMENT_COLUMNS = (
    "supplier",
    "ppon",
    "registration",
    "ground",
    "ground_type",
    "national_security_scope",
    "expiry",
    "report",
)


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _date_from_text(text: str) -> datetime | None:
    match = _DATE.search(text or "")
    return source_date(match.group(1)) if match else None


def _numeric(text: str) -> tuple[float | None, str | None, str]:
    clean = re.sub(r"[➔↑↓→]", "", text).strip()
    if clean in {"-", "..", "[c]", "[x]"}:
        return None, None, "suppressed"
    if re.fullmatch(r"N/?A(?:\s*[0-9]+|\s*[*†‡]+)?", clean, re.IGNORECASE):
        return None, None, "not_applicable"
    if not clean:
        return None, None, "missing"
    match = _NUMERIC_CELL.fullmatch(clean)
    if not match:
        return None, None, "unknown"
    token = match.group("number")
    unit = None
    reported_unit = (match.group("unit") or "").lower()
    if reported_unit == "%":
        unit = "percent"
    elif reported_unit.startswith("week"):
        unit = "weeks"
    elif reported_unit.startswith("day"):
        unit = "days"
    return float(token.replace(",", "")), unit, "reported"


def _category(candidate: str) -> str | None:
    for label, normalised in _CATEGORY_ALIASES.items():
        if candidate == label or candidate.startswith(label + " ("):
            return normalised
        if candidate.startswith("gateway 2:") and re.search(rf"\b{re.escape(label)}\b", candidate):
            return normalised
    return None


def _gateway_entity() -> EntityInput:
    return EntityInput(
        key="UK-GOV:BSR",
        name="Building Safety Regulator",
        scheme="UK-GOV",
        identifier="BSR",
        verified=True,
        properties={"reporting_level": "aggregate"},
    )


def parse_gateway_text(
    text: str,
    source_url: str,
    reporting_date: str | datetime,
    *,
    page: int = 1,
) -> list[ParsedDocument]:
    """Parse labelled aggregate table cells and ignore historical narrative numbers."""
    period_end = (
        reporting_date if isinstance(reporting_date, datetime) else source_date(reporting_date)
    )
    if period_end is None:
        raise ValueError("Gateway reporting date is missing or invalid.")
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]
    category: str | None = None
    observations: dict[str, list[ObservationInput]] = {}
    index = 0
    while index < len(lines):
        lowered = lines[index].lower()
        category_match = None
        consumed_category_lines = 1
        for candidate, consumed in (
            (lowered, 1),
            (
                f"{lowered} {lines[index + 1].lower()}" if index + 1 < len(lines) else "",
                2,
            ),
        ):
            category_match = _category(candidate)
            if category_match:
                consumed_category_lines = consumed
                break
        if category_match:
            category = category_match
            index += consumed_category_lines
            continue
        metric_label = None
        metric_category = category
        inline_value = None
        consumed_metric_lines = 1
        for candidate, consumed in (
            (
                f"{lowered} {lines[index + 1].lower()}" if index + 1 < len(lines) else "",
                2,
            ),
            (lowered, 1),
        ):
            for label, normalised in {
                **_COMPLEX_METRIC_ALIASES,
                **_METRIC_ALIASES,
            }.items():
                if candidate == label:
                    metric_label = normalised
                    consumed_metric_lines = consumed
                elif candidate.startswith(label + ":"):
                    metric_label = normalised
                    consumed_metric_lines = consumed
                    inline_value = candidate.split(":", 1)[1].strip()
                else:
                    continue
                if label in _COMPLEX_METRIC_ALIASES and category:
                    metric_category = f"{category}_complex_cases"
                break
            if metric_label:
                break
        if category and metric_label:
            value_line = inline_value
            value_index = index + consumed_metric_lines
            if value_line is None and value_index < len(lines):
                candidate = lines[value_index]
                if _NUMBER.match(
                    re.sub(r"[➔↑↓→\s]*(weeks?|days?)?$", "", candidate, flags=re.I)
                ) or re.search(r"[0-9]|N/A|^-+$", candidate, re.IGNORECASE):
                    value_line = candidate
                    index += consumed_metric_lines
            if value_line is None:
                index += consumed_metric_lines - 1
            if value_line is not None:
                value, unit, status = _numeric(value_line)
                unit = unit or _METRIC_UNITS.get(metric_label)
                pointer = f"pdf:p{page}:category:{metric_category}:metric:{metric_label}"
                observations.setdefault(str(metric_category), []).append(
                    ObservationInput(
                        subject_key="UK-GOV:BSR",
                        kind="gateway_metric",
                        event_key=(
                            f"bsr-gateway:{period_end.date().isoformat()}:{metric_category}:"
                            f"{metric_label}"
                        ),
                        headline=f"BSR Gateway metric: {metric_label.replace('_', ' ')}",
                        detail=(
                            f"Published aggregate value for "
                            f"{str(metric_category).replace('_', ' ')}."
                        ),
                        occurred_at=period_end,
                        period_end=period_end,
                        state="verified" if status in {"reported", "not_applicable"} else "pending",
                        evidence_pointer=pointer,
                        value=value,
                        unit=unit,
                        attributes={
                            "category": metric_category,
                            "metric": metric_label,
                            "reporting_date": period_end.date().isoformat(),
                            "reporting_level": "aggregate",
                            "value_status": status,
                            "page": page,
                            "raw_value": value_line,
                        },
                    )
                )
        index += 1
    documents = []
    for item_category, items in observations.items():
        documents.append(
            ParsedDocument(
                external_id=f"gateway:{period_end.date().isoformat()}:{item_category}:p{page}",
                source_url=source_url,
                title=f"BSR Gateway: {item_category.replace('_', ' ')}",
                published_at=period_end,
                payload={
                    "original_url": source_url,
                    "page": page,
                    "category": item_category,
                    "reporting_date": period_end.date().isoformat(),
                },
                entities=[_gateway_entity()],
                observations=items,
                media_type="application/pdf",
            )
        )
    return documents


def parse_gateway_pdf(
    data: bytes, source_url: str, published_at: datetime | str | None = None
) -> list[ParsedDocument]:
    pages = pdf_pages(data)
    reporting_date = _date_from_text(pages[0] if pages else "")
    publication_date = (
        published_at
        if isinstance(published_at, datetime)
        else source_date(published_at)
        if published_at
        else None
    )
    if not reporting_date:
        reporting_date = publication_date
    if not reporting_date:
        raise ValueError("Gateway PDF has no reporting date.")
    documents = []
    for page, text in enumerate(pages, start=1):
        page_documents = parse_gateway_text(text, source_url, reporting_date, page=page)
        if publication_date:
            page_documents = [
                document.model_copy(update={"published_at": publication_date})
                for document in page_documents
            ]
        documents.extend(page_documents)
    if not documents:
        raise ValueError("Gateway PDF contained no supported labelled metrics.")
    return documents


def _html_published_at(soup: BeautifulSoup) -> datetime | None:
    for key in ("govuk:public-updated-at", "article:modified_time", "article:published_time"):
        tag = soup.find("meta", attrs={"name": key}) or soup.find("meta", attrs={"property": key})
        if tag and tag.get("content"):
            parsed = source_date(tag["content"])
            if parsed:
                return parsed
    time_tag = soup.find("time", datetime=True)
    return source_date(time_tag["datetime"]) if time_tag else None


def parse_ras_html(html: str, source_url: str, source_id: str) -> list[ParsedDocument]:
    if source_id not in {"ras_members", "ras_prohibitions"}:
        raise ValueError("Unsupported Responsible Actors Scheme register.")
    soup = BeautifulSoup(html, "lxml")
    published = _html_published_at(soup)
    main = soup.find("main")
    scope = soup.select_one(".govspeak")
    if scope is None and main and main.select_one(".publication-external"):
        return []
    scope = scope or main or soup.find("article") or soup.body or soup
    candidates: list[str] = []
    for row in scope.find_all("tr"):
        cells = row.find_all(["th", "td"])
        if cells:
            candidates.append(cells[0].get_text(" ", strip=True))
    for item in scope.find_all("li"):
        candidates.append(item.get_text(" ", strip=True))
    names = []
    seen = set()
    for candidate in candidates:
        name = re.sub(r"\s+", " ", candidate).strip(" .")
        lowered = name.lower()
        if not name or lowered in {"company", "developer", "members", "member"}:
            continue
        if name not in seen:
            seen.add(name)
            names.append(name)
    documents = []
    for position, name in enumerate(names, start=1):
        stable_id = hashlib.sha256(name.casefold().encode()).hexdigest()[:20]
        entity = organisation(source_id, stable_id, name)
        label = "membership" if source_id == "ras_members" else "published prohibition"
        documents.append(
            ParsedDocument(
                external_id=f"{source_id}:{stable_id}",
                source_url=source_url,
                title=name,
                published_at=published,
                payload={
                    "original_url": source_url,
                    "register": source_id,
                    "name": name,
                    "position": position,
                },
                entities=[entity],
                observations=[
                    ObservationInput(
                        subject_key=entity.key,
                        kind="programme_context",
                        event_key=f"{source_id}:{stable_id}",
                        headline=f"Responsible Actors Scheme {label}",
                        detail=f"The official register publishes {name} in this context.",
                        occurred_at=published,
                        state="pending",
                        evidence_pointer=f"html:register-entry:{position}",
                        attributes={"register": source_id, "context_only": True},
                    )
                ],
            )
        )
    return documents


def _row_date(rows) -> datetime | None:
    text = " ".join(cell.text for row in rows[:4] for cell in row)
    return _date_from_text(text)


def _cell_at(row, column):
    return next((cell for cell in row if cell.column == column), None)


def _developer_headers(sheet: str, rows) -> tuple[int, dict[int, str]]:
    if sheet == "Developer_3":
        header_row = 5
        return header_row, {
            cell.column: re.sub(r"\s+", " ", cell.text).strip()
            for cell in rows[header_row - 1]
            if cell.column > 1 and cell.text
        }
    if sheet == "Developer_4":

        def header(row_number: int, column: int) -> str:
            cell = _cell_at(rows[row_number - 1], column)
            if not cell:
                return ""
            text = cell.text.replace("\u200e", "").replace("\u200f", "")
            return re.sub(r"\s+", " ", text).strip().casefold()

        groups = {
            3: "not yet started",
            5: "started or completed",
            7: "started",
            9: "completed, awaiting building control sign-off",
            11: "completed",
        }
        no_extra_headers = all(
            not cell.text.strip() for row in rows[4:8] for cell in row if cell.column > 12
        )
        valid = (
            header(5, 3) == "remediation status"
            and header(6, 3).startswith("buildings being remediated by the developer directly")
            and header(8, 1).startswith("developer")
            and header(8, 2).startswith("number of buildings found to require remediation")
            and all(expected in header(7, column) for column, expected in groups.items())
            and all(
                header(8, column) == ("number" if column % 2 else "percentage")
                for column in range(3, 13)
            )
            and no_extra_headers
        )
        if not valid:
            raise ValueError("Developer_4 header does not match the supported multirow layout.")
        return 8, {
            2: "Buildings requiring direct remediation",
            3: "Remediation not yet started - number",
            4: "Remediation not yet started - percentage",
            5: "Remediation started or completed - number",
            6: "Remediation started or completed - percentage",
            7: "Remediation started - number",
            8: "Remediation started - percentage",
            9: "Remediation completed awaiting sign-off - number",
            10: "Remediation completed awaiting sign-off - percentage",
            11: "Remediation completed - number",
            12: "Remediation completed - percentage",
        }
    raise ValueError(f"Unsupported remediation worksheet {sheet}.")


def parse_remediation_ods(
    data: bytes, source_url: str, published_at: datetime | str | None
) -> list[ParsedDocument]:
    publication_date = (
        published_at
        if isinstance(published_at, datetime)
        else source_date(published_at)
        if published_at
        else None
    )
    tables = ods_tables(data)
    documents = []
    for sheet in ("Developer_3", "Developer_4"):
        rows = tables.get(sheet)
        if not rows:
            continue
        period_end = _row_date(rows)
        if not period_end:
            raise ValueError(f"{sheet} has no reporting date.")
        header_row, headers = _developer_headers(sheet, rows)
        for row in rows[header_row:]:
            name_cell = _cell_at(row, 1)
            name = name_cell.text.strip() if name_cell else ""
            if not name:
                continue
            total = name.lower().startswith(("total", "all developers"))
            if total:
                entity = EntityInput(
                    key="UK-GOV:DEVELOPER-REMEDIATION",
                    name="Developer remediation programme",
                    scheme="UK-GOV",
                    identifier="DEVELOPER-REMEDIATION",
                    verified=True,
                    properties={"reporting_level": "aggregate"},
                )
            else:
                stable = hashlib.sha256(name.casefold().encode()).hexdigest()[:20]
                entity = organisation("developer_remediation", stable, name)
            observations = []
            for column, header in headers.items():
                cell = _cell_at(row, column)
                raw = cell.text.strip() if cell else ""
                value, unit, value_status = _numeric(raw)
                if unit is None and "percentage" in header.lower() and value_status == "reported":
                    unit = "percent"
                pointer = f"ods:{sheet}!{column_name(column)}{name_cell.row}"
                observations.append(
                    ObservationInput(
                        subject_key=entity.key,
                        kind="remediation_metric",
                        event_key=(
                            f"developer-remediation:{period_end.date().isoformat()}:"
                            f"{_slug(name)}:{sheet}:{column}"
                        ),
                        headline=header,
                        detail=f"Published remediation table value for {name}.",
                        occurred_at=period_end,
                        period_end=period_end,
                        state="verified" if total and value_status == "reported" else "pending",
                        evidence_pointer=pointer,
                        value=value,
                        unit=unit,
                        attributes={
                            "table": sheet,
                            "row": name_cell.row,
                            "column": column,
                            "header": header,
                            "reporting_date": period_end.date().isoformat(),
                            "publication_date": (
                                publication_date.date().isoformat() if publication_date else None
                            ),
                            "reporting_level": "aggregate" if total else "developer",
                            "value_status": value_status,
                            "raw_value": raw,
                        },
                    )
                )
            document_id = hashlib.sha256(f"{sheet}:{name}".encode()).hexdigest()[:20]
            documents.append(
                ParsedDocument(
                    external_id=f"remediation:{period_end.date().isoformat()}:{sheet}:{document_id}",
                    source_url=source_url,
                    title=name,
                    published_at=publication_date,
                    payload={
                        "original_url": source_url,
                        "table": sheet,
                        "row": name_cell.row,
                        "reporting_date": period_end.date().isoformat(),
                    },
                    entities=[entity],
                    observations=observations,
                    media_type="application/vnd.oasis.opendocument.spreadsheet",
                )
            )
    if not documents:
        raise ValueError("Remediation workbook has no supported developer tables.")
    return documents


def _normalised_cell(value: str) -> str:
    clean = re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()
    return clean.replace("disc retionary", "discretionary")


def _point(matrix, x: float, y: float) -> tuple[float, float]:
    return (
        x * float(matrix[0]) + y * float(matrix[2]) + float(matrix[4]),
        x * float(matrix[1]) + y * float(matrix[3]) + float(matrix[5]),
    )


def _text_in_box(text_items, box) -> str:
    x, y, width, height = box
    selected = [
        item
        for item in text_items
        if x - 1 <= item[0] <= x + width + 1 and y - 2 <= item[1] <= y + height + 2
    ]
    selected.sort(key=lambda item: (-item[1], item[0]))
    return " ".join(item[2] for item in selected).strip()


def _debarment_page_rows(page, page_number: int) -> tuple[str, list[tuple[int, dict[str, str]]]]:
    rectangles: set[tuple[float, float, float, float]] = set()
    text_items: list[tuple[float, float, str]] = []

    def rectangle_visitor(operator, operands, current_matrix, _text_matrix):
        if operator != b"re":
            return
        x, y, width, height = (float(value) for value in operands)
        first = _point(current_matrix, x, y)
        second = _point(current_matrix, x + width, y + height)
        left, right = sorted((first[0], second[0]))
        bottom, top = sorted((first[1], second[1]))
        if right - left > 10 and top - bottom > 8:
            rectangles.add(
                (
                    round(left, 1),
                    round(bottom, 1),
                    round(right - left, 1),
                    round(top - bottom, 1),
                )
            )

    def text_visitor(value, current_matrix, text_matrix, _font, _font_size):
        clean = " ".join(value.split())
        if clean:
            x, y = _point(current_matrix, float(text_matrix[4]), float(text_matrix[5]))
            text_items.append((x, y, clean))

    page_text = (
        page.extract_text(
            visitor_operand_before=rectangle_visitor,
            visitor_text=text_visitor,
        )
        or ""
    )
    rectangle_groups: dict[tuple[float, float], list[tuple[float, float, float, float]]] = {}
    for rectangle in rectangles:
        rectangle_groups.setdefault((rectangle[1], rectangle[3]), []).append(rectangle)
    eight_column_groups = [
        sorted(group)
        for group in rectangle_groups.values()
        if len(group) == len(_DEBARMENT_COLUMNS)
    ]
    header = next(
        (
            group
            for group in eight_column_groups
            if all(
                all(term in _normalised_cell(_text_in_box(text_items, box)) for term in terms)
                for box, terms in zip(group, _DEBARMENT_HEADER_TERMS, strict=True)
            )
        ),
        None,
    )
    if header is None:
        raise ValueError(f"Debarment PDF page {page_number} has no recognised eight-column header.")
    header_bottom = min(box[1] for box in header)
    rows = []
    row_groups = [
        group
        for group in eight_column_groups
        if max(box[1] + box[3] for box in group) <= header_bottom + 1
        and all(abs(box[0] - expected[0]) <= 2 for box, expected in zip(group, header, strict=True))
    ]
    row_groups.sort(key=lambda group: max(box[1] for box in group), reverse=True)
    for row_number, group in enumerate(row_groups, start=1):
        values = [_text_in_box(text_items, box) for box in group]
        if any(values):
            rows.append((row_number, dict(zip(_DEBARMENT_COLUMNS, values, strict=True))))
    return page_text, rows


def _debarment_identity(row: dict[str, str], row_number: int) -> EntityInput:
    name = row["supplier"]
    properties = {"ppon": row.get("ppon"), "registration": row.get("registration")}
    registration = (row.get("registration") or "").strip()
    meaningful_registration = (
        "" if _normalised_cell(registration) in {"", "n a", "not applicable"} else registration
    )
    company = re.fullmatch(
        r"(?:(?:company|companies house|gb-coh)\s*[:#-]?\s*)?([A-Z]{1,2}\d{6}|\d{8})",
        meaningful_registration,
        re.IGNORECASE,
    )
    charity = re.fullmatch(
        r"(?:charity|charity commission|gb-chc)\s*[:#-]?\s*(\d{6,8})",
        meaningful_registration,
        re.IGNORECASE,
    )
    if company:
        return organisation(
            "debarment", f"row:{row_number}:{name}", name, "GB-COH", company.group(1), properties
        )
    if charity:
        return organisation(
            "debarment", f"row:{row_number}:{name}", name, "GB-CHC", charity.group(1), properties
        )
    ppon_value = re.sub(r"\s+", "", row.get("ppon") or "")
    ppon = re.fullmatch(
        r"(?:GB-PPON[-:]?)?([A-Z]{4}-\d{4}-[A-Z]{4})",
        ppon_value,
        re.IGNORECASE,
    )
    if ppon and not meaningful_registration:
        return organisation(
            "debarment",
            f"row:{row_number}:{name}",
            name,
            "GB-PPON",
            ppon.group(1).upper(),
            properties,
        )
    return organisation("debarment", f"row:{row_number}:{name}", name, properties=properties)


def _debarment_documents(
    rows: list[tuple[int, dict[str, str], str]],
    source_url: str,
    published_at: datetime | str | None,
    *,
    official_layout: bool,
) -> list[ParsedDocument]:
    date = published_at if isinstance(published_at, datetime) else source_date(published_at)
    documents = []
    for row_number, row, pointer in rows:
        name = row.get("supplier") or ""
        ground = row.get("ground") or ""
        status = row.get("status") or ("active" if official_layout else "")
        ground_type = _normalised_cell(row.get("ground_type") or "")
        report_reference = row.get("report") or ""
        if not name or not ground or not status:
            raise ValueError(f"Debarment table row {row_number} is missing a required value.")
        if official_layout and ground_type not in {"mandatory", "discretionary"}:
            raise ValueError(
                f"Debarment table row {row_number} has no valid mandatory/discretionary ground."
            )
        if official_layout and not report_reference:
            raise ValueError(f"Debarment table row {row_number} has no DRS report reference.")
        if official_layout:
            row = {**row, "ground_type": ground_type}
        entity = _debarment_identity(row, row_number)
        expiry_text = row.get("expiry") or ""
        expiry = source_date(expiry_text)
        warnings = []
        if expiry is None:
            warnings.append(
                "Debarment expiry is missing or invalid; the observation remains pending."
            )
        supplier = entity.key if entity.verified else " ".join(name.casefold().split())
        stable = hashlib.sha256(
            json.dumps(
                [report_reference, supplier, " ".join(ground.casefold().split())],
                ensure_ascii=False,
            ).encode()
        ).hexdigest()[:24]
        documents.append(
            ParsedDocument(
                external_id=f"debarment:{stable}",
                source_url=source_url,
                title=f"Debarment list entry: {name}",
                published_at=date,
                expires_at=expiry,
                payload={"original_url": source_url, "row": row, "row_number": row_number},
                entities=[entity],
                observations=[
                    ObservationInput(
                        subject_key=entity.key,
                        kind="debarment",
                        event_key=f"debarment:{stable}",
                        headline="Published procurement debarment",
                        detail=ground,
                        occurred_at=date,
                        state="verified" if entity.verified and date and expiry else "pending",
                        evidence_pointer=pointer,
                        attributes={
                            "ground": ground,
                            "ground_type": ground_type or None,
                            "national_security_scope": row.get("national_security_scope") or None,
                            "status": status,
                            "ppon": row.get("ppon") or None,
                            "registration": row.get("registration") or None,
                            "expiry": expiry.isoformat() if expiry else None,
                            "report_reference": report_reference or None,
                        },
                    )
                ],
                warnings=warnings,
                media_type="application/pdf",
            )
        )
    return documents


def parse_debarment_pdf(
    data: bytes, source_url: str, published_at: datetime | str | None
) -> list[ParsedDocument]:
    """Parse the official DRS table by its validated eight-column PDF geometry."""
    try:
        pages = PdfReader(BytesIO(data)).pages
        extracted = [_debarment_page_rows(page, number) for number, page in enumerate(pages, 1)]
    except ValueError:
        raise
    except Exception as error:
        raise ValueError("Debarment PDF could not be parsed.") from error
    rows = [
        (row_number, row, f"pdf:p{page_number}:table:debarment:row:{row_number}")
        for page_number, (_, page_rows) in enumerate(extracted, 1)
        for row_number, row in page_rows
    ]
    if not rows:
        text = "\n".join(page_text for page_text, _ in extracted).casefold()
        current_blank_statement = all(
            phrase in text
            for phrase in ("until a ministerial decision", "list will remain", "blank")
        )
        if current_blank_statement:
            return []
        raise ValueError(
            "Debarment PDF has an empty table without the official current blank-list statement."
        )
    return _debarment_documents(rows, source_url, published_at, official_layout=True)


def parse_debarment_text(
    text: str, source_url: str, published_at: datetime | str | None
) -> list[ParsedDocument]:
    """Parse delimited fixtures and fail closed when no explicit supplier row is present."""
    if not text.strip():
        raise ValueError("Debarment publication is blank without a validated table.")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    separator = "|" if any("|" in line for line in lines) else "\t"
    header_index = next(
        (
            index
            for index, line in enumerate(lines)
            if "supplier" in line.lower() and "ground" in line.lower() and separator in line
        ),
        None,
    )
    if header_index is None:
        raise ValueError("Debarment table header or separator is not recognised.")
    headers = [item.strip().lower() for item in lines[header_index].split(separator)]
    rows = []
    for row_number, line in enumerate(lines[header_index + 1 :], start=header_index + 2):
        values = [item.strip() for item in line.split(separator)]
        if len(values) != len(headers):
            raise ValueError(f"Debarment table row {row_number} has an unexpected width.")
        source_row = dict(zip(headers, values, strict=True))
        number = source_row.get("company number") or source_row.get("companies house number") or ""
        rows.append(
            (
                row_number,
                {
                    "supplier": source_row.get("supplier")
                    or source_row.get("supplier name")
                    or source_row.get("name")
                    or "",
                    "ppon": source_row.get("ppon") or "",
                    "registration": f"Company: {number}" if number else "",
                    "ground": source_row.get("ground") or source_row.get("grounds") or "",
                    "ground_type": source_row.get("ground type") or "",
                    "national_security_scope": source_row.get("national security scope") or "",
                    "expiry": source_row.get("expiry") or source_row.get("expiry date") or "",
                    "report": source_row.get("report") or source_row.get("report reference") or "",
                    "status": source_row.get("status") or "",
                },
                f"pdf:row:{row_number}",
            )
        )
    if not rows:
        raise ValueError("Debarment table contains no explicit supplier rows.")
    return _debarment_documents(rows, source_url, published_at, official_layout=False)


class GovernmentAdapter:
    def __init__(self, source_id: str):
        if source_id not in PUBLICATION_URLS:
            raise ValueError(f"Unsupported GOV.UK source {source_id}.")
        self.source_id = source_id

    def fetch(self, source, client, now):
        config = source.get("config") or {}
        page_url = config.get("publication_url") or PUBLICATION_URLS[self.source_id]
        parts = urlsplit(page_url)
        if parts.scheme != "https" or parts.hostname != "www.gov.uk":
            raise FetchError("Government adapter requires an official HTTPS publication page.")
        raw, _, _ = fetch_bytes(
            client,
            page_url,
            allowed_hosts=GOVERNMENT_HOSTS,
            max_bytes=12_000_000,
            headers={"Accept": "text/html"},
        )
        html = raw.decode("utf-8", errors="replace")
        soup = BeautifulSoup(html, "lxml")
        published = _html_published_at(soup)
        if self.source_id in {"ras_members", "ras_prohibitions"}:
            documents = parse_ras_html(html, page_url, self.source_id)
            warnings = []
            if not documents:
                scope = soup.select_one(".govspeak") or soup.find("main")
                statement = scope.get_text(" ", strip=True) if scope else ""
                verified_empty = self.source_id == "ras_prohibitions" and re.search(
                    r"There are currently no persons to whom prohibitions apply under "
                    r"the Building Safety \(Responsible Actors Scheme and Prohibitions\) "
                    r"Regulations 2023\.",
                    statement,
                    flags=re.IGNORECASE,
                )
                if not verified_empty:
                    raise FetchError(
                        "RAS register extraction is empty without a publisher statement."
                    )
                warnings.append(
                    "The publisher explicitly states that no persons are currently subject "
                    "to these prohibitions; this is not an adverse finding."
                )
            return FetchBatch(documents=documents, cursor=page_url, warnings=warnings)
        suffix = ".ods" if self.source_id == "developer_remediation" else ".pdf"
        links = discover_official_attachments(
            html,
            page_url,
            (suffix,),
            link_text="Debarment List" if self.source_id == "debarment" else None,
        )
        if not links:
            raise FetchError(f"Official publication page has no supported {suffix} attachment.")
        asset_url = links[0]
        asset, _, _ = fetch_bytes(
            client,
            asset_url,
            allowed_hosts=GOVERNMENT_HOSTS,
            max_bytes=64_000_000,
        )
        if self.source_id == "bsr_gateway":
            documents = parse_gateway_pdf(asset, asset_url, published)
        elif self.source_id == "developer_remediation":
            documents = parse_remediation_ods(asset, asset_url, published)
        else:
            documents = parse_debarment_pdf(asset, asset_url, published)
        warnings = []
        if self.source_id == "debarment" and not documents:
            warnings.append(
                "The published debarment list has no entries; "
                "this says nothing about investigations."
            )
        return FetchBatch(
            documents=documents,
            cursor=json.dumps({"publication": page_url, "asset": asset_url}, sort_keys=True),
            warnings=warnings,
        )
