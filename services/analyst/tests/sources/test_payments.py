import csv
import io

import pytest

from meritus.sources.payment_practices import parse_payment_csv


def csv_text(rows):
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()


def report(**changes):
    return {
        "Report Id": "100",
        "Policy Regime": "2025",
        "Company": "Synthetic Ltd",
        "Company number": "08834019",
        "Start date": "01/01/2026",
        "End date": "30/06/2026",
        "Filing date": "15/07/2026",
        "Average time to pay": "75",
        "% Invoices not paid within agreed terms": "31",
        "% Invoices not paid due to dispute": "",
        "Retention clause money release description": "After completion, subject to review",
        "URL": "https://check-payment-practices.service.gov.uk/report/100",
        **changes,
    }


def test_payment_nulls_retained_without_inventing_zero_and_dates():
    doc = parse_payment_csv(csv_text([report(**{"Average time to pay": ""})]))[0]
    assert doc.entities[0].identifier == "08834019"
    obs = doc.observations[0]
    assert obs.value is None
    assert obs.attributes["average_payment_days"] is None
    assert obs.attributes["percent_paid_outside_terms"] == 31
    assert obs.attributes["period_start"].startswith("2026-01-01")
    assert obs.period_end.isoformat().startswith("2026-06-30")
    assert doc.published_at.isoformat().startswith("2026-07-15")
    assert doc.payload["Retention clause money release description"].startswith("After completion")


def test_duplicate_report_id_correction_and_missing_company_identity():
    docs = parse_payment_csv(csv_text([report(), report(**{"Average time to pay": "85"})]))
    assert len(docs) == 1 and docs[0].observations[0].value == 85
    doc = parse_payment_csv(csv_text([report(**{"Company number": ""})]))[0]
    assert doc.entities[0].verified is False
    assert doc.entities[0].key.startswith("unresolved:payment_practices:")
    assert doc.observations[0].state == "pending"


def test_schema_change_and_malformed_numbers_fail_instead_of_empty_success():
    with pytest.raises(ValueError, match="columns"):
        parse_payment_csv("different,columns\nx,y\n")
    with pytest.raises(ValueError, match="number"):
        parse_payment_csv(csv_text([report(**{"Average time to pay": "unknown value"})]))


def test_missing_dates_are_retained_for_review():
    doc = parse_payment_csv(csv_text([report(**{"Filing date": "", "Start date": ""})]))[0]
    assert doc.published_at is None
    assert doc.observations[0].state == "pending"
    assert doc.warnings


def test_header_only_csv_is_not_a_successful_empty_dataset():
    with pytest.raises(ValueError, match="no reports"):
        parse_payment_csv("Report Id,Company number,Average time to pay\n")
