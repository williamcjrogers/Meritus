"""The official company-period CSV, preserving missing and amended values."""

import csv
import io
import json
import math

from meritus.domain import FetchBatch, ObservationInput, ParsedDocument
from meritus.sources.common import organisation, source_date
from meritus.sources.http import FetchError, fetch_bytes

URL = "https://check-payment-practices.service.gov.uk/export/csv/"
HOSTS = {"check-payment-practices.service.gov.uk"}


def _number(value: str | None) -> float | None:
    if value is None or value.strip() in {"", "-", "N/A", "Not applicable"}:
        return None
    try:
        result = float(value.replace(",", "").removesuffix("%"))
    except ValueError:
        raise ValueError("Payment report contains an invalid number.") from None
    if not math.isfinite(result) or result < 0:
        raise ValueError("Payment report contains an invalid number.")
    return result


def parse_payment_csv(text: str) -> list[ParsedDocument]:
    reader = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    fields = set(reader.fieldnames or [])
    if not {"Report Id", "Company number", "Average time to pay"}.issubset(fields):
        raise ValueError("Payment CSV columns have changed or are missing.")
    documents = {}
    for row_number, row in enumerate(reader, 2):
        if None in row or any(value is None for value in row.values()):
            raise ValueError(f"Payment CSV row {row_number} has malformed columns.")
        report_id = row.get("Report Id", "").strip()
        if not report_id:
            raise ValueError(f"Payment CSV row {row_number} has no report identifier.")
        name = row.get("Company") or row.get("Company name") or "Unresolved reporting company"
        entity = organisation(
            "payment_practices", report_id, name, "GB-COH", row.get("Company number")
        )
        start, end = source_date(row.get("Start date")), source_date(row.get("End date"))
        published = source_date(row.get("Filing date"))
        warnings = []
        if not start or not end or not published or (start and end and start > end):
            warnings.append("Reporting or filing dates require review.")
        if not entity.verified:
            warnings.append("Company identity requires review.")
        days = _number(row.get("Average time to pay"))
        late = _number(row.get("% Invoices not paid within agreed terms"))
        if late is not None and late > 100:
            raise ValueError("Payment report percentage is outside 0 to 100.")
        observations = [
            ObservationInput(
                subject_key=entity.key,
                kind="payment_report",
                event_key=f"payment:{report_id}",
                headline=f"Payment practices report {report_id}",
                detail="Company-period aggregate; not an individual debt or dispute.",
                occurred_at=end,
                period_end=end,
                state="pending" if warnings else "verified",
                evidence_pointer=f"CSV report {report_id}; Average time to pay",
                value=days,
                unit="days",
                attributes={
                    "period_start": start.isoformat() if start else None,
                    "reporting_regime": row.get("Policy Regime") or "legacy",
                    "average_payment_days": days,
                    "percent_paid_outside_terms": late,
                    "percent_disputed": _number(row.get("% Invoices not paid due to dispute")),
                    "report_id": report_id,
                },
            )
        ]
        documents[report_id] = ParsedDocument(
            external_id=report_id,
            source_url=row.get("URL") or URL,
            title=f"{name}: payment practices {report_id}",
            published_at=published,
            payload=row,
            entities=[entity],
            observations=observations,
            warnings=warnings,
            media_type="text/csv",
        )
    if not documents:
        raise ValueError("Payment CSV contains no reports; completeness is unverified.")
    return list(documents.values())


class PaymentPracticesAdapter:
    def fetch(self, source, client, now):
        cursor = json.loads(source.get("cursor") or "{}")
        headers = {}
        if cursor.get("etag"):
            headers["If-None-Match"] = cursor["etag"]
        if cursor.get("last_modified"):
            headers["If-Modified-Since"] = cursor["last_modified"]
        content, response_headers, status = fetch_bytes(
            client,
            URL,
            allowed_hosts=HOSTS,
            headers=headers,
            max_bytes=int((source.get("config") or {}).get("max_bytes", 256_000_000)),
        )
        if status == 304:
            return FetchBatch(
                cursor=source.get("cursor"), warnings=["Upstream CSV unchanged (304)."]
            )
        try:
            documents = parse_payment_csv(content.decode("utf-8-sig"))
        except UnicodeDecodeError:
            raise FetchError("Payment CSV is not valid UTF-8.") from None
        cursor = {
            "etag": response_headers.get("etag"),
            "last_modified": response_headers.get("last-modified"),
            "retrieved_at": now.isoformat(),
        }
        return FetchBatch(documents=documents, cursor=json.dumps(cursor))
