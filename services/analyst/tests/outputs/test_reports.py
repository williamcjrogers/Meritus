import csv
import io

from meritus.outputs.reports import export_conditions, render_csv, render_html


def test_csv_does_not_execute_formula():
    snapshot = {"payload": {"items": [{"name": '=HYPERLINK("x")', "score": 0}]}}
    assert "'=HYPERLINK" in render_csv(snapshot)


def test_html_escapes_imported_values_and_discloses_incompleteness():
    snapshot = {
        "as_of": "2026-09-12T00:00:00+00:00",
        "rule_version": "v1",
        "payload": {
            "items": [{"name": "<script>alert(1)</script>", "score": 1}],
            "coverage": {"complete": False},
        },
    }
    report = render_html(snapshot)
    assert "<script>alert(1)</script>" not in report
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in report
    assert "Coverage is incomplete" in report


def test_restricted_only_item_is_omitted_from_exports():
    snapshot = {
        "payload": {
            "items": [
                {"name": "Restricted", "score": 50, "source_ids": ["rns"]},
                {"name": "Public", "score": 20, "source_ids": ["find_tender"]},
            ],
            "export_policy": {"rns": False, "find_tender": True},
        }
    }
    report = render_csv(snapshot)
    assert "Restricted" not in report
    assert "Public" in report


def test_mixed_rights_recompute_every_evidence_derived_field():
    public_event = {
        "observation_id": "public",
        "record_id": "public-record",
        "kind": "accounts_overdue",
        "event_group_key": "accounts:1",
        "family": "corporate_governance_finance",
        "qualifies": True,
        "substantive": False,
        "age_days": 10,
        "event_at": "2026-08-01T00:00:00+00:00",
        "applied_points": 12,
        "source_id": "find_tender",
        "evidence_url": "https://public.example/evidence",
        "exclusion_reason": None,
        "attributes": {},
    }
    restricted_event = {
        **public_event,
        "observation_id": "restricted",
        "record_id": "restricted-record",
        "kind": "insolvency_petition",
        "event_group_key": "petition:1",
        "family": "insolvency",
        "substantive": True,
        "event_at": "2026-09-01T00:00:00+00:00",
        "applied_points": 40,
        "source_id": "rns",
        "evidence_url": "https://restricted.example/evidence",
    }
    snapshot = {
        "payload": {
            "items": [
                {
                    "name": "Mixed Ltd",
                    "score": 52,
                    "eligible": True,
                    "independent_events": 2,
                    "latest_evidence_at": restricted_event["event_at"],
                    "change_since_previous": 20,
                    "source_ids": ["find_tender", "rns"],
                    "contributions": [public_event, restricted_event],
                    "gaps": [],
                }
            ],
            "export_policy": {"find_tender": True, "rns": False},
        }
    }

    row = next(csv.DictReader(io.StringIO(render_csv(snapshot))))

    assert row["score"] == "12.0"
    assert row["eligible"] == "false"
    assert row["independent_events"] == "1"
    assert row["latest_evidence_at"] == public_event["event_at"]
    assert row["change_since_previous"] == ""
    assert "restricted.example" not in row["evidence_links"]


def test_csv_rows_agree_exactly_with_frozen_snapshot_values():
    item = {
        "rank": 1,
        "name": "Example Ltd",
        "kind": "organisation",
        "score": 42.5,
        "eligible": True,
        "independent_events": 2,
        "sector": "construction",
        "geography": "London",
        "lead_time_band": "12-24 months",
        "reviewer": "WR",
        "review_state": "verified",
        "pipeline_stage": "shortlisted",
        "change_since_previous": 3.5,
        "suggested_review_route": "Introducer A",
        "latest_evidence_at": "2026-09-01T00:00:00+00:00",
        "reasons": ["evidence"],
        "source_ids": ["find_tender"],
        "gaps": [],
    }
    row = next(csv.DictReader(io.StringIO(render_csv({"payload": {"items": [item]}}))))
    assert row["name"] == item["name"]
    assert row["score"] == str(item["score"])
    assert row["suggested_review_route"] == item["suggested_review_route"]


def test_export_promotes_permitted_duplicate_after_restricted_winner_removed():
    event = {
        "kind": "insolvency_petition",
        "family": "insolvency",
        "event_key": "petition:1",
        "event_group_key": "petition:1",
        "qualifies": True,
        "substantive": True,
        "age_days": 1,
        "event_at": "2026-09-11T00:00:00+00:00",
        "points": 40,
        "attributes": {},
    }
    public = {
        **event,
        "observation_id": "public",
        "record_id": "public-record",
        "source_id": "gazette",
        "applied_points": 0,
        "exclusion_reason": "duplicate_event: selected observation restricted",
    }
    snapshot = {
        "payload": {
            "items": [
                {
                    "name": "Mixed Ltd",
                    "score": 40,
                    "source_ids": ["rns", "gazette"],
                    "contributions": [
                        {
                            **event,
                            "observation_id": "restricted",
                            "record_id": "restricted-record",
                            "source_id": "rns",
                            "applied_points": 40,
                            "exclusion_reason": None,
                        },
                        public,
                        {**public, "observation_id": "public-repeat", "record_id": "public-repeat"},
                    ],
                }
            ],
            "export_policy": {"rns": False, "gazette": True},
        }
    }
    row = next(csv.DictReader(io.StringIO(render_csv(snapshot))))
    assert row["score"] == "40.0"
    assert row["independent_events"] == "1"
    assert "40.0 points" in row["reasons"]
    assert "restricted" not in row["reasons"]
    assert snapshot["payload"]["items"][0]["contributions"][1]["exclusion_reason"] is not None


def _mixed_snapshot(gaps=None, applied_rules=None):
    events = [
        {
            "source_id": source,
            "record_id": str(index),
            "observation_id": str(index),
            "event_key": str(index),
            "event_group_key": str(index),
            "family": family,
            "points": 40,
            "applied_points": 40,
            "exclusion_reason": None,
            "qualifies": True,
            "substantive": True,
            "age_days": 10,
        }
        for index, (source, family) in enumerate(
            [
                ("gazette", "insolvency"),
                ("find_tender", "procurement_performance"),
                ("rns", "proceedings"),
            ]
        )
    ]
    payload = {
        "items": [
            {
                "name": "Synthetic",
                "source_ids": ["gazette", "find_tender", "rns"],
                "contributions": events,
                "gaps": gaps or [],
                "eligible": False,
            }
        ],
        "export_policy": {"rns": False},
    }
    if applied_rules:
        payload["applied_rules"] = applied_rules
    return {"rule_version": "meritus-v1", "payload": payload}


def test_export_retains_unconfirmed_identity_gate_after_rights_recalculation():
    row = next(
        csv.DictReader(io.StringIO(render_csv(_mixed_snapshot(["subject_identity_unconfirmed"]))))
    )
    assert row["score"] == "80.0" and row["independent_events"] == "2"
    assert row["eligible"] == "false"


def test_export_uses_frozen_rule_parameters_instead_of_current_defaults():
    rules = {
        "recommendation_threshold": 10,
        "independence_window_days": 5,
        "family_cap": 15,
        "context_cap": 3,
        "total_cap": 25,
    }
    row = next(csv.DictReader(io.StringIO(render_csv(_mixed_snapshot(applied_rules=rules)))))
    assert row["score"] == "25.0"
    assert row["independent_events"] == "0" and row["eligible"] == "false"


def test_exports_show_only_permitted_source_and_record_conditions():
    public = {
        "observation_id": "public-observation",
        "record_id": "public-record",
        "source_id": "find_tender",
        "kind": "adverse_performance",
        "event_key": "event:public",
        "family": "procurement_performance",
        "points": 35,
        "applied_points": 35,
        "qualifies": True,
        "substantive": True,
        "age_days": 1,
        "exclusion_reason": None,
        "attributes": {},
    }
    restricted = {
        **public,
        "observation_id": "restricted-observation",
        "record_id": "restricted-record",
        "source_id": "rns",
        "event_key": "event:restricted",
    }
    snapshot = {
        "kind": "digest",
        "payload": {
            "items": [
                {
                    "name": "Synthetic Ltd",
                    "source_ids": ["find_tender", "rns"],
                    "contributions": [public, restricted],
                }
            ],
            "export_policy": {"find_tender": True, "rns": False},
            "source_permissions": {
                "find_tender": {
                    "scope": "OGL use with attribution",
                    "operations": ["retrieve", "analyse", "export"],
                    "retention_days": 365,
                    "distribution_conditions": "Include source attribution",
                },
                "rns": {
                    "scope": "SECRET LICENSED SCOPE",
                    "distribution_conditions": "SECRET NO REDISTRIBUTION",
                },
            },
            "current_permissions": {
                "find_tender": {"distribution_conditions": "Internal circulation only"},
                "rns": {"distribution_conditions": "SECRET CURRENT CONDITION"},
            },
            "source_records": [
                {
                    "id": "public-record",
                    "source_id": "find_tender",
                    "observed_at": "2026-09-01T00:00:00+00:00",
                    "expires_at": "2027-09-01T00:00:00+00:00",
                    "import_permission": {
                        "retention_days": 180,
                        "distribution_conditions": "Team review only",
                    },
                },
                {
                    "id": "restricted-record",
                    "source_id": "rns",
                    "import_permission": {
                        "scope": "SECRET RECORD SCOPE",
                        "content_expires_at": "2026-10-01T00:00:00+00:00",
                    },
                },
            ],
        },
    }

    conditions = export_conditions(snapshot)
    csv_report = render_csv(snapshot)
    html_report = render_html(snapshot)
    row = next(csv.DictReader(io.StringIO(csv_report)))

    assert [item["source_id"] for item in conditions["sources"]] == ["find_tender"]
    assert "365 days" in row["permitted_retention_conditions"]
    assert "180 days" in row["permitted_retention_conditions"]
    assert "Internal circulation only" in row["permitted_distribution_conditions"]
    assert "Team review only" in html_report
    assert "SECRET" not in csv_report + html_report


def test_digest_html_uses_digest_title_and_weekly_uses_watchlist_title():
    digest = render_html({"kind": "digest", "payload": {"items": []}})
    weekly = render_html({"kind": "weekly", "payload": {"items": []}})
    assert "<title>Meritus fortnightly digest</title>" in digest
    assert "<h1>Meritus fortnightly digest</h1>" in digest
    assert "<title>Meritus weekly watchlist</title>" in weekly


def test_csv_indexes_frozen_record_conditions_once_for_all_rows():
    class CountedRecords(list):
        iterations = 0

        def __iter__(self):
            self.iterations += 1
            return super().__iter__()

    records = CountedRecords(
        {
            "id": f"record-{index}",
            "source_id": "find_tender",
            "import_permission": {"attribution": "Crown copyright"},
        }
        for index in range(200)
    )
    snapshot = {
        "payload": {
            "items": [
                {
                    "name": f"Company {index}",
                    "source_ids": ["find_tender"],
                    "contributions": [
                        {
                            "record_id": f"record-{index}",
                            "source_id": "find_tender",
                        }
                    ],
                }
                for index in range(200)
            ],
            "source_records": records,
            "export_policy": {"find_tender": True},
        }
    }

    report = render_csv(snapshot)

    assert report.count("Crown copyright") == 200
    assert records.iterations == 1
