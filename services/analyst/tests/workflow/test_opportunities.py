from meritus.workflow.opportunities import (
    possible_introduction_routes,
    project_exposures,
    relationship_review_prompts,
)

ENTITIES = [
    {
        "id": "supplier",
        "key": "GB-COH:00000001",
        "name": "Supplier Ltd",
        "kind": "organisation",
        "verified": True,
    },
    {
        "id": "main",
        "key": "GB-COH:00000002",
        "name": "Main Contractor Ltd",
        "kind": "organisation",
        "verified": True,
    },
    {
        "id": "project",
        "key": "project:1",
        "name": "Project One",
        "kind": "project",
        "verified": True,
    },
    {"id": "lawyer", "key": "person:1", "name": "Alex Counsel", "kind": "person", "verified": True},
    {
        "id": "party-a",
        "key": "GB-COH:00000003",
        "name": "Party A",
        "kind": "organisation",
        "verified": True,
    },
    {
        "id": "party-b",
        "key": "GB-COH:00000004",
        "name": "Party B",
        "kind": "organisation",
        "verified": True,
    },
]


def _observation(entity_id: str, observation_id: str, record_id: str):
    return {
        "id": observation_id,
        "entity_id": entity_id,
        "record_id": record_id,
        "kind": "insolvency_event",
        "state": "verified",
        "source_id": "gazette",
        "source_url": f"https://www.thegazette.co.uk/{observation_id}",
        "occurred_at": "2026-09-01T00:00:00+00:00",
    }


def _relationship(
    relationship_id: str,
    from_id: str,
    to_id: str,
    role: str,
    record_id: str,
    *,
    matter: str | None = None,
):
    return {
        "id": relationship_id,
        "from_entity_id": from_id,
        "to_entity_id": to_id,
        "role": role,
        "record_id": record_id,
        "state": "verified",
        "source_id": "find_tender",
        "source_url": f"https://www.find-tender.service.gov.uk/{relationship_id}",
        "evidence_pointer": f"/contracts/{relationship_id}",
        "valid_from": "2026-01-01T00:00:00+00:00",
        "valid_to": None,
        "attributes": {"matter_entity_id": matter} if matter else {"contract_id": "contract-1"},
    }


def test_supplier_insolvency_creates_source_backed_possible_project_exposure_only():
    observations = [
        _observation("supplier", "supplier-insolvency", "insolvency-record"),
        _observation("main", "main-insolvency", "main-insolvency-record"),
    ]
    relationships = [
        _relationship("supplier-role", "supplier", "project", "supplier", "contract-record"),
        _relationship("main-role", "main", "project", "main_contractor", "main-role-record"),
    ]

    result = project_exposures(ENTITIES, observations, relationships)

    assert len(result) == 1
    exposure = result[0]
    assert exposure["kind"] == "possible_commercial_exposure"
    assert exposure["supplier"]["id"] == "supplier"
    assert exposure["project"]["id"] == "project"
    assert exposure["status"] == "review_required"
    assert exposure["no_main_contractor_attribution"] is True
    assert exposure["lineage"] == {
        "insolvency": {
            "observation_id": "supplier-insolvency",
            "record_id": "insolvency-record",
            "source_id": "gazette",
            "source_url": "https://www.thegazette.co.uk/supplier-insolvency",
        },
        "project_role": {
            "relationship_id": "supplier-role",
            "record_id": "contract-record",
            "source_id": "find_tender",
            "source_url": "https://www.find-tender.service.gov.uk/supplier-role",
            "evidence_pointer": "/contracts/supplier-role",
            "evidence_mode": None,
            "human_basis": None,
            "valid_from": "2026-01-01T00:00:00+00:00",
            "valid_to": None,
        },
    }


def test_project_exposure_requires_both_lineages_and_verified_supplier_role():
    observation = _observation("supplier", "insolvency", "insolvency-record")
    missing_role_lineage = _relationship("role", "supplier", "project", "supplier", "")
    assert project_exposures(ENTITIES, [observation], [missing_role_lineage]) == []
    assert (
        project_exposures(
            ENTITIES,
            [{**observation, "record_id": ""}],
            [_relationship("role", "supplier", "project", "supplier", "contract-record")],
        )
        == []
    )


def test_project_exposure_requires_role_to_exist_at_the_insolvency_event():
    observation = _observation("supplier", "insolvency", "insolvency-record")
    later_role = _relationship("later", "supplier", "project", "supplier", "contract-record")
    later_role["valid_from"] = "2026-09-02T00:00:00+00:00"
    ended_role = _relationship("ended", "supplier", "project", "supplier", "old-contract")
    ended_role["valid_to"] = "2026-08-31T00:00:00+00:00"
    assert project_exposures(ENTITIES, [observation], [later_role, ended_role]) == []

    ended_role["attributes"]["past_contract_exposure_basis"] = (
        "Retained defect and warranty obligations reviewed against the contract"
    )
    result = project_exposures(ENTITIES, [observation], [ended_role])
    assert len(result) == 1
    assert result[0]["past_contract_exposure_basis"].startswith("Retained defect")


def test_matter_specific_professional_roles_offer_routes_and_review_prompts_only():
    relationships = [
        _relationship(
            "adviser-a", "lawyer", "party-a", "counsel", "legal-record-a", matter="project"
        ),
        _relationship(
            "adviser-b", "lawyer", "party-b", "counsel", "legal-record-b", matter="project"
        ),
        _relationship("general", "main", "party-a", "owner", "general-record"),
    ]

    routes = possible_introduction_routes(ENTITIES, relationships)
    prompts = relationship_review_prompts(ENTITIES, relationships)

    assert [route["relationship_id"] for route in routes] == ["adviser-a", "adviser-b"]
    assert all(route["status"] == "review_required" for route in routes)
    assert all(route["availability_inferred"] is False for route in routes)
    assert len(prompts) == 1
    prompt = prompts[0]
    assert prompt["kind"] == "potential_conflict_review_prompt"
    assert prompt["matter"] == {"entity_id": "project", "reference": None}
    assert [party["id"] for party in prompt["parties"]] == ["party-a", "party-b"]
    assert prompt["conflict_conclusion"] is None
    assert prompt["status"] == "human_clearance_required"
    assert [item["record_id"] for item in prompt["lineages"]] == [
        "legal-record-a",
        "legal-record-b",
    ]


def test_unverified_or_non_matter_professional_links_cannot_create_routes_or_prompts():
    no_matter = _relationship("no-matter", "lawyer", "party-a", "solicitor", "record")
    no_matter["attributes"] = {}
    pending = {
        **_relationship("pending", "lawyer", "party-b", "expert", "record-2", matter="project"),
        "state": "pending",
    }
    assert possible_introduction_routes(ENTITIES, [no_matter, pending]) == []
    assert relationship_review_prompts(ENTITIES, [no_matter, pending]) == []


def test_unverified_professional_or_party_identity_cannot_generate_routes():
    relationship = _relationship(
        "role", "lawyer", "party-a", "solicitor", "record", matter="project"
    )
    for identifier in ("lawyer", "party-a"):
        entities = [
            {**entity, "verified": False} if entity["id"] == identifier else entity
            for entity in ENTITIES
        ]
        assert possible_introduction_routes(entities, [relationship]) == []
        assert relationship_review_prompts(entities, [relationship]) == []


def test_explicit_human_professional_lineage_can_offer_a_route_without_source_record():
    relationship = _relationship(
        "human-route", "lawyer", "party-a", "solicitor", "", matter="project"
    )
    relationship["attributes"].update(
        evidence_mode="human",
        human_basis="Partner confirmed the prior matter role in a reviewed interview note",
    )
    route = possible_introduction_routes(ENTITIES, [relationship])[0]
    assert route["lineage"]["record_id"] == ""
    assert route["lineage"]["evidence_mode"] == "human"
    assert route["lineage"]["human_basis"].startswith("Partner confirmed")
    assert route["valid_from"] == "2026-01-01T00:00:00+00:00"


def test_conflict_prompt_pairing_is_partitioned_before_comparison(monkeypatch):
    import meritus.workflow.opportunities as opportunities

    routes = [
        {
            "relationship_id": f"relationship-{index}",
            "professional": {"id": f"professional-{index}", "name": f"Professional {index}"},
            "party": {"id": f"party-{index}", "name": f"Party {index}"},
            "matter": {"entity_id": f"matter-{index}", "reference": None},
            "lineage": {"record_id": f"record-{index}"},
        }
        for index in range(1_000)
    ]
    original_combinations = opportunities.combinations

    def bounded_combinations(values, size):
        values = list(values)
        assert len(values) <= 2
        return original_combinations(values, size)

    monkeypatch.setattr(opportunities, "_professional_routes", lambda *_args: routes)
    monkeypatch.setattr(opportunities, "combinations", bounded_combinations)

    assert opportunities.relationship_review_prompts([], [], result_limit=10_000) == []
