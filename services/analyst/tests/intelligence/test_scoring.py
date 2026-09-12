from datetime import UTC, datetime, timedelta

import pytest

from meritus.intelligence.rules import DEFAULT_RULES, RULE_VERSION
from meritus.intelligence.scoring import score_entities

NOW = datetime(2026, 9, 12, tzinfo=UTC)
ENTITY = {
    "id": "co-1",
    "key": "GB-COH:08834019",
    "name": "Example Ltd",
    "kind": "organisation",
    "verified": True,
}


def observation(
    observation_id: str,
    kind: str,
    event: str,
    age: int = 0,
    source: str = "gazette",
    **changes,
) -> dict:
    row = {
        "id": observation_id,
        "record_id": f"record-{observation_id}",
        "entity_id": "co-1",
        "kind": kind,
        "event_key": event,
        "headline": kind,
        "detail": "Source fact",
        "state": "verified",
        "occurred_at": (NOW - timedelta(days=age)).isoformat(),
        "period_end": None,
        "published_at": NOW.isoformat(),
        "observed_at": NOW.isoformat(),
        "expires_at": None,
        "active": True,
        "withdrawn": False,
        "source_id": source,
        "source_url": f"https://example.org/{observation_id}",
        "attributes": {},
    }
    row.update(changes)
    return row


def scored(observations: list[dict], entity: dict | None = None) -> dict:
    return score_entities([entity or ENTITY], observations, NOW)[0]


RULE_CASES = [
    ("insolvency_petition", 40, 90, "insolvency", 82, True, False, {}),
    ("insolvency_event", 40, 90, "insolvency", 82, True, False, {}),
    (
        "adjudication_enforcement",
        40,
        90,
        "proceedings",
        67,
        True,
        True,
        {"party_role": "claimant"},
    ),
    (
        "bsa_live_proceeding",
        35,
        90,
        "proceedings",
        67,
        True,
        True,
        {"party_role": "applicant"},
    ),
    (
        "construction_decision",
        20,
        180,
        "proceedings",
        62,
        False,
        False,
        {"party_role": "claimant"},
    ),
    ("adverse_performance", 35, 180, "procurement_performance", 77, True, False, {}),
    ("adverse_termination", 35, 180, "procurement_performance", 77, True, False, {}),
    ("debarment", 35, 180, "procurement_performance", 77, True, False, {}),
    (
        "contract_provision",
        30,
        180,
        "corporate_governance_finance",
        65,
        True,
        False,
        {},
    ),
    ("payment_deterioration", 20, 180, "payment_practice", 62, True, False, {}),
    (
        "auditor_resignation",
        20,
        180,
        "corporate_governance_finance",
        62,
        True,
        False,
        {},
    ),
    ("accounts_overdue", 12, 90, "corporate_governance_finance", 54, False, False, {}),
    (
        "accounting_date_change",
        12,
        90,
        "corporate_governance_finance",
        54,
        False,
        False,
        {},
    ),
    ("new_charge", 10, 90, "corporate_governance_finance", 52, False, False, {}),
    (
        "director_departure",
        10,
        90,
        "corporate_governance_finance",
        52,
        False,
        False,
        {},
    ),
    ("group_change", 10, 90, "corporate_governance_finance", 52, False, False, {}),
    ("project_delay", 25, 180, "project_delivery", 67, True, False, {}),
    ("gateway_project_delay", 25, 180, "project_delivery", 67, True, False, {}),
    ("claims_hiring", 5, 90, "context_amplifiers", 47, False, False, {}),
    (
        "contract_value_context",
        3,
        None,
        "context_amplifiers",
        45,
        False,
        False,
        {"value": 5_000_000, "unit": "GBP"},
    ),
    (
        "contract_duration_context",
        3,
        None,
        "context_amplifiers",
        45,
        False,
        False,
        {"value": 24, "unit": "months"},
    ),
    (
        "fixed_price_context",
        2,
        None,
        "context_amplifiers",
        44,
        False,
        False,
        {"value": True, "unit": "boolean"},
    ),
    (
        "timing_context",
        2,
        None,
        "context_amplifiers",
        44,
        False,
        False,
        {"active_timing_window": True},
    ),
    ("payment_report", 0, None, "evidence_only", 42, False, False, {}),
    ("gateway_metric", 0, None, "evidence_only", 42, False, False, {}),
    ("remediation_metric", 0, None, "evidence_only", 42, False, False, {}),
    ("programme_context", 0, None, "evidence_only", 42, False, False, {}),
    ("adjudication_metric", 0, None, "evidence_only", 42, False, False, {}),
]


@pytest.mark.parametrize(
    (
        "kind",
        "weight",
        "half_life",
        "family",
        "expected_score",
        "expected_substantive",
        "expected_live_dispute",
        "case",
    ),
    RULE_CASES,
)
def test_every_rule_has_literal_configuration_and_observable_result(
    kind,
    weight,
    half_life,
    family,
    expected_score,
    expected_substantive,
    expected_live_dispute,
    case,
):
    assert RULE_VERSION == "meritus-v1"
    rule = DEFAULT_RULES["kinds"][kind]
    assert (rule["weight"], rule["half_life_days"], rule["family"]) == (
        weight,
        half_life,
        family,
    )
    assert rule["substantive"] is expected_substantive
    assert rule["live_dispute"] is expected_live_dispute
    attributes = {
        "independence_confirmed": True,
        "independence_review_reference": "review-target",
    }
    changes = {}
    if "active_timing_window" in case:
        attributes["active_timing_window"] = case["active_timing_window"]
    elif "party_role" in case:
        attributes["party_role"] = case["party_role"]
    else:
        changes = case
    target = observation("target", kind, f"target:{kind}", attributes=attributes, **changes)
    non_substantive_baseline = [
        observation(
            "baseline-decision",
            "construction_decision",
            "baseline:decision",
            attributes={"party_role": "claimant"},
        ),
        observation("baseline-accounts", "accounts_overdue", "baseline:accounts"),
        observation("baseline-charge", "new_charge", "baseline:charge"),
    ]
    row = scored([*non_substantive_baseline, target])

    assert row["score"] == expected_score
    assert row["eligible"] is (expected_substantive or expected_live_dispute)
    target_contribution = next(
        item for item in row["contributions"] if item["observation_id"] == "target"
    )
    assert target_contribution["base_weight"] == weight
    assert target_contribution["family"] == family


def test_one_event_reported_twice_cannot_recommend():
    observations = [
        observation("1", "insolvency_petition", "petition:case1"),
        observation(
            "2",
            "insolvency_event",
            "petition:case1",
            source="companies_house",
        ),
    ]
    row = scored(observations)

    assert row["score"] == 40
    assert row["independent_events"] == 1
    assert row["eligible"] is False
    assert row["source_ids"] == ["companies_house", "gazette"]
    excluded = [item for item in row["contributions"] if item["exclusion_reason"]]
    assert len(excluded) == 1
    assert excluded[0]["exclusion_reason"].startswith("duplicate_event:")


def test_two_independent_source_facts_can_recommend():
    row = scored(
        [
            observation("1", "insolvency_petition", "petition:case1"),
            observation(
                "2",
                "accounts_overdue",
                "accounts:2026",
                source="companies_house",
            ),
        ]
    )

    assert row["score"] == 52
    assert row["independent_events"] == 2
    assert row["eligible"] is True


def test_decay_halves_contribution():
    row = scored([observation("1", "contract_provision", "contract:1", 180)])
    assert row["score"] == 15
    assert row["contributions"][0]["decay"] == 0.5


def test_independence_window_uses_unrounded_age_at_180_day_boundary():
    baseline = observation("baseline", "insolvency_petition", "petition:baseline")
    at_boundary = observation(
        "boundary",
        "accounts_overdue",
        "accounts:boundary",
        occurred_at=(NOW - timedelta(days=180)).isoformat(),
    )
    beyond_boundary = {
        **at_boundary,
        "id": "beyond",
        "record_id": "record-beyond",
        "event_key": "accounts:beyond",
        "occurred_at": (NOW - timedelta(days=180, minutes=1)).isoformat(),
    }

    boundary_row = scored([baseline, at_boundary])
    beyond_row = scored([baseline, beyond_boundary])

    assert boundary_row["contributions"][1]["age_days"] == 180
    assert boundary_row["independent_events"] == 2
    assert boundary_row["eligible"] is True
    assert beyond_row["contributions"][1]["age_days"] == 180
    assert beyond_row["independent_events"] == 1
    assert beyond_row["eligible"] is False


@pytest.mark.parametrize(
    ("changes", "reason"),
    [
        ({"published_at": (NOW + timedelta(seconds=1)).isoformat()}, "published_after_cutoff"),
        ({"observed_at": (NOW + timedelta(seconds=1)).isoformat()}, "observed_after_cutoff"),
        ({"published_at": None}, "missing_published_at"),
        ({"observed_at": None}, "missing_observed_at"),
        ({"occurred_at": None, "period_end": None}, "missing_event_date"),
        ({"occurred_at": (NOW + timedelta(seconds=1)).isoformat()}, "event_after_cutoff"),
        ({"state": "pending"}, "evidence_pending"),
        ({"state": "rejected"}, "evidence_rejected"),
        ({"active": False}, "inactive_record"),
        ({"withdrawn": True}, "withdrawn_record"),
        ({"expires_at": NOW.isoformat()}, "expired_record"),
    ],
)
def test_knowledge_cutoff_and_evidence_state_exclusions_are_explained(changes, reason):
    row = scored([observation("1", "insolvency_petition", "petition:1", **changes)])

    assert row["score"] == 0
    assert row["contributions"][0]["exclusion_reason"] == reason


def test_unverified_entity_cannot_score_or_recommend():
    entity = {**ENTITY, "verified": False}
    row = scored([observation("1", "insolvency_petition", "petition:1")], entity)

    assert row["score"] == 0
    assert row["eligible"] is False
    assert row["contributions"][0]["exclusion_reason"] == "unverified_subject"
    assert "subject_identity_unconfirmed" in row["gaps"]


def test_period_end_is_used_when_event_date_is_absent():
    row = scored(
        [
            observation(
                "1",
                "accounts_overdue",
                "accounts:2026",
                occurred_at=None,
                period_end=(NOW - timedelta(days=90)).isoformat(),
            )
        ]
    )
    assert row["score"] == 6
    assert row["contributions"][0]["age_days"] == 90


def test_family_and_total_context_caps_show_applied_points():
    observations = [
        observation("1", "adverse_performance", "performance:1"),
        observation(
            "2",
            "adverse_termination",
            "termination:2",
            attributes={
                "independence_confirmed": True,
                "independence_review_reference": "review-2",
            },
        ),
        observation(
            "3",
            "contract_value_context",
            "contract:value",
            value=8_000_000,
            unit="GBP",
        ),
        observation(
            "4",
            "contract_duration_context",
            "contract:duration",
            value=36,
            unit="months",
        ),
        observation(
            "5",
            "fixed_price_context",
            "contract:form",
            value=1,
            unit="boolean",
        ),
        observation(
            "6",
            "timing_context",
            "contract:window",
            attributes={"active_timing_window": True},
        ),
        observation("7", "claims_hiring", "hiring:1"),
    ]
    row = scored(observations)

    assert row["score"] == 55
    assert row["eligible"] is True
    family_applied = sum(
        item["applied_points"]
        for item in row["contributions"]
        if item["family"] == "procurement_performance"
    )
    context_applied = sum(
        item["applied_points"]
        for item in row["contributions"]
        if item["family"] == "context_amplifiers"
    )
    assert family_applied == 45
    assert context_applied == 10
    assert any(item["cap_reduction"] > 0 for item in row["contributions"])


@pytest.mark.parametrize(
    "context",
    [
        observation("1", "contract_value_context", "value:1", value=4_999_999, unit="GBP"),
        observation("1", "contract_duration_context", "duration:1", value=23, unit="months"),
        observation("1", "fixed_price_context", "form:1", value=0, unit="boolean"),
        observation("1", "timing_context", "timing:1", attributes={}),
    ],
)
def test_context_requires_evidenced_threshold(context):
    row = scored([context])
    assert row["score"] == 0
    assert row["contributions"][0]["exclusion_reason"] == "context_condition_not_met"


def test_two_same_family_adverts_do_not_establish_independence_without_review():
    row = scored(
        [
            observation("1", "insolvency_petition", "petition:1"),
            observation("2", "insolvency_event", "petition:2"),
        ]
    )
    assert row["score"] == 45
    assert row["independent_events"] == 1
    assert row["eligible"] is False


def test_review_can_confirm_distinct_same_family_events():
    row = scored(
        [
            observation("1", "insolvency_petition", "petition:1"),
            observation(
                "2",
                "insolvency_event",
                "petition:2",
                attributes={
                    "independence_confirmed": True,
                    "independence_review_reference": "review-2",
                },
            ),
        ]
    )
    assert row["independent_events"] == 2
    assert row["eligible"] is True


def test_repeated_period_reports_and_same_case_records_count_once():
    repeated = scored(
        [
            observation("1", "payment_deterioration", "payment:2026-H1"),
            observation("2", "payment_deterioration", "payment:2026-H1"),
        ]
    )
    assert repeated["independent_events"] == 1

    same_case = scored(
        [
            observation(
                "3",
                "bsa_live_proceeding",
                "listing:case-7",
                attributes={"party_role": "respondent"},
            ),
            observation(
                "4",
                "construction_decision",
                "judgment:case-7",
                attributes={
                    "party_role": "respondent",
                    "event_group_key": "listing:case-7",
                    "event_group_review_reference": "review-case-7",
                },
            ),
        ]
    )
    assert same_case["score"] == 35
    assert same_case["independent_events"] == 1


@pytest.mark.parametrize(
    "role",
    [
        "associated_company",
        "mentioned_adviser",
        "claimant",
        "defendant",
        "employer",
        "contractor",
        "referring_party",
        "responding_party",
    ],
)
def test_bsa_contextual_associations_score_zero(role):
    row = scored(
        [
            observation(
                "1",
                "bsa_live_proceeding",
                "bsa:1",
                attributes={"party_role": role, "instrument": "remediation_order"},
            )
        ]
    )
    assert row["score"] == 0
    assert row["contributions"][0]["exclusion_reason"] == "subject_role_not_scoring"


@pytest.mark.parametrize("role", ["applicant", "respondent"])
def test_bsa_evidenced_applicant_or_respondent_has_live_dispute_footprint(role):
    row = scored(
        [
            observation(
                "1",
                "bsa_live_proceeding",
                "bsa:1",
                attributes={"party_role": role, "instrument": "remediation_order"},
            )
        ]
    )
    assert row["score"] == 35
    assert row["contributions"][0]["exclusion_reason"] is None


def test_evidence_only_metrics_and_unknown_kinds_never_score():
    row = scored(
        [
            observation("1", "payment_report", "report:1"),
            observation("2", "associated_company", "relationship:1"),
        ]
    )
    assert row["score"] == 0
    assert [item["exclusion_reason"] for item in row["contributions"]] == [
        "evidence_only",
        "unsupported_kind",
    ]


def test_ordering_uses_score_then_latest_evidence_then_entity_key():
    entities = [
        {**ENTITY, "id": "co-z", "key": "GB-COH:00000003", "name": "Z"},
        {**ENTITY, "id": "co-b", "key": "GB-COH:00000002", "name": "B"},
        {**ENTITY, "id": "co-a", "key": "GB-COH:00000001", "name": "A"},
    ]
    observations = [
        {**observation("z", "accounts_overdue", "accounts:z", age=5), "entity_id": "co-z"},
        {**observation("b", "accounts_overdue", "accounts:b"), "entity_id": "co-b"},
        {**observation("a", "accounts_overdue", "accounts:a"), "entity_id": "co-a"},
    ]

    rows = score_entities(entities, observations, NOW)
    assert [row["entity_id"] for row in rows] == ["co-a", "co-b", "co-z"]
    assert rows[0]["latest_evidence_at"] == NOW.isoformat()


def test_custom_rules_do_not_mutate_default_rules():
    custom = {
        **DEFAULT_RULES,
        "kinds": {
            **DEFAULT_RULES["kinds"],
            "accounts_overdue": {
                **DEFAULT_RULES["kinds"]["accounts_overdue"],
                "weight": 20,
            },
        },
    }
    row = score_entities(
        [ENTITY], [observation("1", "accounts_overdue", "accounts:1")], NOW, custom
    )[0]

    assert row["score"] == 20
    assert DEFAULT_RULES["kinds"]["accounts_overdue"]["weight"] == 12
