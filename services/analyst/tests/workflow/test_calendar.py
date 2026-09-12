import pytest

from meritus.domain import EntityInput, FetchBatch, ParsedDocument
from meritus.workflow.calendar import (
    actionable_entries,
    create_calendar_entry,
    illustrative_accrual_timing,
    post_completion_timing,
    validate_calendar_entry,
)


def test_uncertain_legal_date_cannot_be_confirmed_without_basis():
    with pytest.raises(ValueError, match="reviewed basis"):
        validate_calendar_entry(
            {
                "entity_id": "co-1",
                "kind": "limitation",
                "date": "2030-01-01",
                "status": "confirmed",
                "source_url": "https://example.org/contract",
                "reviewer": "WR",
            }
        )


def test_provisional_legal_date_is_not_actionable_and_optional_fields_survive():
    item = validate_calendar_entry(
        {
            "entity_id": "co-1",
            "kind": "limitation",
            "date": "2030-01-01",
            "status": "illustrative",
            "jurisdiction": "",
            "basis": "",
        }
    )
    assert item["status"] == "provisional"
    assert actionable_entries([item]) == []


def test_forecast_completion_cannot_drive_post_pc_window():
    with pytest.raises(ValueError, match="practical completion"):
        post_completion_timing(
            {
                "entity_id": "project-1",
                "kind": "forecast_completion",
                "date": "2026-09-30",
                "status": "confirmed",
                "source_url": "https://example.org/programme",
            }
        )


def test_confirmed_practical_completion_drives_labelled_window():
    result = post_completion_timing(
        {
            "entity_id": "project-1",
            "kind": "practical_completion",
            "date": "2026-02-28",
            "status": "confirmed",
            "source_url": "https://example.org/certificate",
        }
    )
    assert result == {
        "basis_kind": "practical_completion",
        "basis_date": "2026-02-28",
        "window_start": "2027-02-28",
        "window_end": "2028-02-28",
        "status": "derived_from_confirmed_practical_completion",
    }


def test_accrual_plus_period_is_illustrative_provisional_and_not_actionable():
    result = illustrative_accrual_timing(
        "2024-02-29",
        6,
        input_basis="Counsel-reviewed pleaded accrual date supplied by the analyst",
        reviewer="WR",
        entity_id="matter-1",
    )

    assert result["date"] == "2030-02-28"
    assert result["kind"] == "legal_review"
    assert result["status"] == "provisional"
    assert result["reviewer"] == "WR"
    assert result["calculation"] == {
        "basis_date_type": "entered_accrual_date",
        "accrual_date": "2024-02-29",
        "selected_period_years": 6,
        "result_type": "illustrative_review_date",
    }
    assert result["legal_conclusion"] is False
    assert actionable_entries([result]) == []


def test_illustrative_accrual_calculation_requires_basis_and_positive_whole_years():
    with pytest.raises(ValueError, match="input basis"):
        illustrative_accrual_timing("2024-01-01", 6, input_basis="")
    with pytest.raises(ValueError, match="positive whole number"):
        illustrative_accrual_timing("2024-01-01", 0, input_basis="Reviewed accrual")


def test_calendar_persists_source_record_lineage(repo, now):
    repo.ingest_batch(
        "reviewed_import",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="calendar-evidence",
                    source_url="https://example.org/certificate",
                    title="Certificate",
                    published_at=now,
                    payload={},
                    entities=[
                        EntityInput(
                            key="GB-COH:00000003",
                            name="Three",
                            scheme="GB-COH",
                            identifier="00000003",
                        )
                    ],
                )
            ]
        ),
        now,
    )
    entity = repo.list_entities()[0]
    record = repo.list_records()[0]

    entry = create_calendar_entry(
        repo,
        {
            "entity_id": entity["id"],
            "kind": "practical_completion",
            "date": "2026-02-28",
            "status": "confirmed",
            "source_record_id": record["id"],
        },
    )

    assert entry["source_url"] == record["source_url"]
    assert entry["evidence"]["source_record_id"] == record["id"]
