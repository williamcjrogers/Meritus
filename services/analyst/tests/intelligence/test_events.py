from itertools import permutations

from meritus.intelligence.events import group_observations, independent_event_count


def _observation(
    observation_id: str,
    event_key: str,
    *,
    family: str = "insolvency",
    record_id: str | None = None,
    attributes: dict | None = None,
) -> dict:
    return {
        "id": observation_id,
        "event_key": event_key,
        "record_id": record_id or f"record-{observation_id}",
        "attributes": attributes or {},
        "family": family,
    }


def test_shared_event_key_and_reviewed_grouping_collapse_underlying_occurrence():
    observations = [
        _observation("1", "petition:case-1"),
        _observation("2", "petition:case-1"),
        _observation(
            "3",
            "listing:case-1",
            attributes={
                "event_group_key": "petition:case-1",
                "event_group_review_reference": "review-12",
            },
        ),
    ]

    groups = group_observations(observations)

    assert list(groups) == ["petition:case-1"]
    assert [item["id"] for item in groups["petition:case-1"]] == ["1", "2", "3"]


def test_unreviewed_override_does_not_change_event_identity():
    observations = [
        _observation(
            "1",
            "listing:case-1",
            attributes={"event_group_key": "petition:case-1"},
        )
    ]

    assert list(group_observations(observations)) == ["listing:case-1"]


def test_same_family_requires_reviewed_independence_for_second_event():
    events = [
        _observation("1", "petition:case-1"),
        _observation("2", "petition:case-2"),
    ]
    assert independent_event_count(events) == 1

    events[1]["attributes"] = {
        "independence_confirmed": True,
        "independence_review_reference": "review-99",
    }
    assert independent_event_count(events) == 2


def test_reviewed_same_family_independence_is_order_independent():
    events = [
        _observation("unreviewed", "petition:case-1"),
        _observation(
            "reviewed",
            "petition:case-2",
            attributes={
                "independence_confirmed": True,
                "independence_review_reference": "review-99",
            },
        ),
        _observation("another-unreviewed", "petition:case-3"),
    ]

    assert {independent_event_count(order) for order in permutations(events)} == {2}


def test_distinct_families_need_distinct_original_records():
    events = [
        _observation("1", "petition:case-1", record_id="same-record"),
        _observation(
            "2",
            "accounts:2026",
            family="corporate_governance_finance",
            record_id="same-record",
        ),
    ]
    assert independent_event_count(events) == 1

    events[1]["record_id"] = "another-record"
    assert independent_event_count(events) == 2


def test_reviewed_reused_record_independence_is_order_independent():
    events = [
        _observation("unreviewed", "petition:case-1", record_id="shared-record"),
        _observation(
            "reviewed",
            "accounts:2026",
            family="corporate_governance_finance",
            record_id="shared-record",
            attributes={
                "independence_confirmed": True,
                "independence_review_reference": "review-record",
            },
        ),
    ]

    assert {independent_event_count(order) for order in permutations(events)} == {2}
