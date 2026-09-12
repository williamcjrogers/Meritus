from datetime import UTC, datetime, timedelta

import pytest

from meritus.intelligence.trends import derive_payment_trends

NOW = datetime(2026, 9, 12, tzinfo=UTC)


def report(
    observation_id: str,
    period_start: datetime,
    period_end: datetime,
    *,
    average_days: float | None = None,
    outside_terms: float | None = None,
    regime: str = "UK-payment-practices",
    event_key: str | None = None,
    revision: int = 1,
    **changes,
) -> dict:
    attributes = {
        "period_start": period_start.isoformat(),
        "reporting_regime": regime,
        "average_payment_days": average_days,
        "percent_paid_outside_terms": outside_terms,
    }
    row = {
        "id": observation_id,
        "record_id": f"record-{observation_id}",
        "entity_id": "co-1",
        "entity_key": "GB-COH:08834019",
        "kind": "payment_report",
        "event_key": event_key or f"payment-report:{period_end.date().isoformat()}",
        "headline": "Payment report",
        "detail": "Structured payment metrics",
        "state": "verified",
        "occurred_at": None,
        "period_end": period_end.isoformat(),
        "published_at": (period_end + timedelta(days=20)).isoformat(),
        "observed_at": (period_end + timedelta(days=20)).isoformat(),
        "expires_at": None,
        "active": True,
        "withdrawn": False,
        "source_id": "payment_practices",
        "source_url": f"https://example.org/{observation_id}",
        "revision": revision,
        "attributes": attributes,
    }
    row.update(changes)
    return row


PERIOD_1_START = datetime(2025, 7, 1, tzinfo=UTC)
PERIOD_1_END = datetime(2025, 12, 31, tzinfo=UTC)
PERIOD_2_START = datetime(2026, 1, 1, tzinfo=UTC)
PERIOD_2_END = datetime(2026, 6, 30, tzinfo=UTC)


def test_ten_day_deterioration_emits_one_traceable_observation():
    previous = report("old", PERIOD_1_START, PERIOD_1_END, average_days=30)
    current = report("new", PERIOD_2_START, PERIOD_2_END, average_days=40)

    trends = derive_payment_trends([current, previous], NOW)

    assert len(trends) == 1
    trend = trends[0]
    assert trend["kind"] == "payment_deterioration"
    assert trend["entity_id"] == "co-1"
    assert trend["occurred_at"] == PERIOD_2_END.isoformat()
    assert trend["attributes"]["previous_observation_id"] == "old"
    assert trend["attributes"]["current_observation_id"] == "new"
    assert trend["attributes"]["average_payment_days_change"] == 10
    assert trend["attributes"]["trigger_metrics"] == ["average_payment_days"]


def test_percentage_point_threshold_and_two_metrics_still_emit_one_event():
    previous = report("old", PERIOD_1_START, PERIOD_1_END, average_days=20, outside_terms=30)
    current = report("new", PERIOD_2_START, PERIOD_2_END, average_days=31, outside_terms=41)

    trends = derive_payment_trends([previous, current], NOW)

    assert len(trends) == 1
    assert trends[0]["attributes"]["trigger_metrics"] == [
        "average_payment_days",
        "percent_paid_outside_terms",
    ]


@pytest.mark.parametrize(
    "reports",
    [
        [
            report("old", PERIOD_1_START, PERIOD_1_END, average_days=30),
            report("new", PERIOD_2_START, PERIOD_2_END, average_days=39.9),
        ],
        [
            report("old", PERIOD_1_START, PERIOD_1_END),
            report("new", PERIOD_2_START, PERIOD_2_END, average_days=50),
        ],
        [
            report("old", PERIOD_1_START, PERIOD_1_END, average_days=30),
            report("new", PERIOD_1_END, PERIOD_2_END, average_days=50),
        ],
        [
            report("old", PERIOD_1_START, PERIOD_1_END, average_days=30, regime="old-regime"),
            report("new", PERIOD_2_START, PERIOD_2_END, average_days=50, regime="new-regime"),
        ],
    ],
)
def test_incompatible_or_below_threshold_reports_do_not_create_trend(reports):
    assert derive_payment_trends(reports, NOW) == []


@pytest.mark.parametrize(
    "changes",
    [
        {"published_at": (NOW + timedelta(days=1)).isoformat()},
        {"observed_at": (NOW + timedelta(days=1)).isoformat()},
        {"period_end": (NOW + timedelta(days=1)).isoformat()},
        {"published_at": None},
        {"observed_at": None},
        {"state": "pending"},
        {"active": False},
        {"withdrawn": True},
    ],
)
def test_future_or_ineligible_report_prevents_comparison(changes):
    previous = report("old", PERIOD_1_START, PERIOD_1_END, average_days=30)
    current = report("new", PERIOD_2_START, PERIOD_2_END, average_days=50)
    current.update(changes)
    assert derive_payment_trends([previous, current], NOW) == []


def test_correction_replaces_report_and_preserves_comparison_event_key():
    previous = report("old", PERIOD_1_START, PERIOD_1_END, average_days=20)
    first = report(
        "new-v1",
        PERIOD_2_START,
        PERIOD_2_END,
        average_days=35,
        event_key="payment-report:2026-H1",
        revision=1,
    )
    corrected = report(
        "new-v2",
        PERIOD_2_START,
        PERIOD_2_END,
        average_days=31,
        event_key="payment-report:2026-H1",
        revision=2,
    )

    before_key = derive_payment_trends([previous, first], NOW)[0]["event_key"]
    after = derive_payment_trends([previous, first, corrected], NOW)

    assert len(after) == 1
    assert after[0]["event_key"] == before_key
    assert after[0]["attributes"]["current_observation_id"] == "new-v2"
    assert after[0]["attributes"]["average_payment_days_change"] == 11


def test_correction_identity_is_scoped_by_subject_and_regime():
    reports = []
    for entity_id, entity_key, regime in (
        ("co-1", "GB-COH:00000001", "regime-a"),
        ("co-2", "GB-COH:00000002", "regime-a"),
        ("co-3", "GB-COH:00000003", "regime-b"),
    ):
        previous = report(
            f"{entity_id}-old",
            PERIOD_1_START,
            PERIOD_1_END,
            average_days=20,
            event_key="shared-previous-key",
            regime=regime,
        )
        current = report(
            f"{entity_id}-new",
            PERIOD_2_START,
            PERIOD_2_END,
            average_days=31,
            event_key="shared-current-key",
            regime=regime,
        )
        previous.update(entity_id=entity_id, entity_key=entity_key)
        current.update(entity_id=entity_id, entity_key=entity_key)
        reports.extend([previous, current])

    trends = derive_payment_trends(reports, NOW)

    assert {trend["entity_id"] for trend in trends} == {"co-1", "co-2", "co-3"}
    assert len({trend["event_key"] for trend in trends}) == 3


def test_generic_metric_shape_is_supported_when_category_and_unit_match():
    previous = report("old", PERIOD_1_START, PERIOD_1_END)
    current = report("new", PERIOD_2_START, PERIOD_2_END)
    previous["value"] = 25
    previous["unit"] = "days"
    previous["attributes"]["metric"] = "average_payment_days"
    current["value"] = 36
    current["unit"] = "days"
    current["attributes"]["metric"] = "average_payment_days"

    assert len(derive_payment_trends([previous, current], NOW)) == 1
