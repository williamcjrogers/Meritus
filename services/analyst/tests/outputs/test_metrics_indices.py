from datetime import UTC, datetime, timedelta

import pytest

from meritus.outputs.indices import build_indices
from meritus.outputs.metrics import build_metrics


@pytest.mark.parametrize(
    "day, expected_start, expected_end",
    [
        ("2026-09-12", "2026-09-11T23:00:00+00:00", "2026-09-12T22:59:59.999999+00:00"),
        ("2026-03-29", "2026-03-29T00:00:00+00:00", "2026-03-29T22:59:59.999999+00:00"),
        ("2026-10-25", "2026-10-24T23:00:00+00:00", "2026-10-25T23:59:59.999999+00:00"),
    ],
)
def test_date_only_metric_filters_use_whole_london_days(day, expected_start, expected_end):
    start, end = datetime.fromisoformat(expected_start), datetime.fromisoformat(expected_end)
    actions = [
        {"entity_id": "inside", "stage": "review", "occurred_at": start},
        {
            "entity_id": "too_early",
            "stage": "review",
            "occurred_at": start - timedelta(microseconds=1),
        },
        {
            "entity_id": "too_late",
            "stage": "review",
            "occurred_at": end + timedelta(microseconds=1),
        },
    ]
    result = build_metrics(actions, [], end + timedelta(days=1), date_from=day, date_to=day)
    assert result["counts"]["reviewed_recommendations"] == 1
    assert result["filters"]["date_from"] == expected_start
    assert result["filters"]["date_to"] == expected_end
    assert result["filters"]["date_timezone"] == "Europe/London"


NOW = datetime(2026, 9, 12, tzinfo=UTC)


def test_metrics_return_both_conversation_denominators_and_filters():
    reviews = [
        {
            "target_type": "entity",
            "target_id": entity,
            "action": "verified",
            "created_at": (NOW - timedelta(days=10)).isoformat(),
            "payload": {"cohort": "north"},
        }
        for entity in ("one", "two", "three")
    ]
    actions = [
        {
            "entity_id": "one",
            "stage": "contacted",
            "occurred_at": (NOW - timedelta(days=8)).isoformat(),
            "cohort": "north",
        },
        {
            "entity_id": "one",
            "stage": "conversation",
            "occurred_at": (NOW - timedelta(days=7)).isoformat(),
            "cohort": "north",
        },
        {
            "entity_id": "two",
            "stage": "contacted",
            "occurred_at": (NOW - timedelta(days=6)).isoformat(),
            "cohort": "north",
        },
    ]
    result = build_metrics(
        actions,
        reviews,
        NOW,
        cohort="north",
        date_from=NOW - timedelta(days=20),
        date_to=NOW,
    )
    assert result["counts"] == {
        "reviewed_recommendations": 3,
        "contacted_opportunities": 2,
        "conversations": 1,
        "instructions": 0,
    }
    assert result["conversation_rate_reviewed"] == 0.3333
    assert result["conversation_rate_contacted"] == 0.5
    assert result["filters"]["cohort"] == "north"


def test_metrics_only_count_later_transitions_for_reviewed_cohort():
    reviews = [
        {
            "target_type": "entity",
            "target_id": "in-cohort",
            "action": "verified",
            "created_at": (NOW - timedelta(days=20)).isoformat(),
            "payload": {"cohort": "north"},
        },
        {
            "target_type": "entity",
            "target_id": "outside-window",
            "action": "verified",
            "created_at": (NOW - timedelta(days=200)).isoformat(),
            "payload": {"cohort": "north"},
        },
    ]
    actions = [
        {
            "entity_id": "in-cohort",
            "stage": "conversation",
            "occurred_at": (NOW - timedelta(days=2)).isoformat(),
        },
        {
            "entity_id": "outside-window",
            "stage": "conversation",
            "occurred_at": (NOW - timedelta(days=2)).isoformat(),
        },
        {
            "entity_id": "never-reviewed",
            "stage": "instruction",
            "occurred_at": (NOW - timedelta(days=1)).isoformat(),
            "cohort": "north",
        },
    ]

    result = build_metrics(
        actions,
        reviews,
        NOW,
        cohort="north",
        date_from=NOW - timedelta(days=30),
        date_to=NOW - timedelta(days=10),
    )

    assert result["counts"] == {
        "reviewed_recommendations": 1,
        "contacted_opportunities": 1,
        "conversations": 1,
        "instructions": 0,
    }
    assert result["conversation_rate_reviewed"] == 1
    assert result["conversation_rate_contacted"] == 1


def test_benchmark_sufficiency_uses_actual_cohort_age_not_requested_range():
    recent_review = {
        "target_type": "entity",
        "target_id": "recent",
        "action": "verified",
        "created_at": (NOW - timedelta(days=10)).isoformat(),
    }
    old_review = {
        **recent_review,
        "target_id": "old",
        "created_at": (NOW - timedelta(days=190)).isoformat(),
    }

    recent = build_metrics(
        [],
        [recent_review],
        NOW,
        date_from=NOW - timedelta(days=500),
    )
    mature = build_metrics([], [old_review], NOW)
    empty = build_metrics([], [], NOW, date_from=NOW - timedelta(days=500))

    assert recent["benchmark_assessment"] == "insufficient_observation_time"
    assert mature["benchmark_assessment"] == "observation_window_available"
    assert empty["benchmark_assessment"] == "insufficient_observation_time"


def test_indices_preserve_source_category_window_unit_and_correction():
    base = {
        "kind": "gateway_metric",
        "source_id": "bsr_gateway",
        "entity_id": "market",
        "event_key": "gateway:major",
        "unit": "days",
        "period_end": "2026-06-30T00:00:00+00:00",
        "published_at": "2026-07-15T00:00:00+00:00",
        "observed_at": "2026-07-15T00:00:00+00:00",
        "source_url": "https://gov.uk/report",
        "active": True,
        "withdrawn": False,
        "attributes": {"category": "major", "window": "2026-Q2"},
    }
    result = build_indices(
        [
            {**base, "id": "old", "record_id": "r1", "revision": 1, "value": 18},
            {**base, "id": "new", "record_id": "r2", "revision": 2, "value": 16},
        ]
    )
    series = result["series"][0]
    assert (series["source_id"], series["category"], series["unit"]) == (
        "bsr_gateway",
        "major",
        "days",
    )
    assert series["points"][0]["window"] == "2026-Q2"
    assert series["points"][0]["value"] == 16


def test_suppressed_indices_preserve_provenance_without_prohibited_value():
    suppressed = {
        "kind": "adjudication_metric",
        "source_id": "find_case_law",
        "entity_id": "market",
        "id": "suppressed-observation",
        "record_id": "suppressed-record",
        "revision": 3,
        "value": 27,
        "unit": "cases",
        "period_end": "2026-06-30T00:00:00+00:00",
        "published_at": "2026-07-15T00:00:00+00:00",
        "observed_at": "2026-07-15T00:00:00+00:00",
        "active": True,
        "withdrawn": False,
        "attributes": {
            "category": "enforcement",
            "window": "2026-Q2",
            "suppressed": True,
            "suppression_reason": "publisher threshold",
        },
    }

    result = build_indices([suppressed])

    assert result["suppressed_points"] == 1
    assert result["suppressed"] == [
        {
            "source_id": "find_case_law",
            "kind": "adjudication_metric",
            "category": "enforcement",
            "window": "2026-Q2",
            "unit": "cases",
            "reason": "publisher threshold",
            "record_id": "suppressed-record",
            "observation_id": "suppressed-observation",
            "revision": 3,
        }
    ]
    assert "value" not in result["suppressed"][0]


def test_adjudication_methodology_does_not_claim_national_total():
    result = build_indices([])
    assert "not total national adjudications" in result["methodology"]


def test_unitless_suppression_remains_visible_with_null_unit():
    result = build_indices(
        [
            {
                "id": "withheld",
                "record_id": "source-record",
                "kind": "gateway_metric",
                "source_id": "bsr_gateway",
                "unit": None,
                "value": None,
                "active": True,
                "attributes": {
                    "category": "major",
                    "window": "2026-Q2",
                    "suppressed": True,
                    "suppression_reason": "publisher withheld",
                },
            }
        ]
    )
    assert result["series"] == []
    assert result["suppressed_points"] == 1
    assert result["suppressed"][0]["unit"] is None
    assert result["suppressed"][0]["record_id"] == "source-record"
