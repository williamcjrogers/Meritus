from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument


def test_evidence_notices_use_current_source_terms_without_raw_configuration(
    authenticated, repo, now
):
    client, _ = authenticated
    repo.ingest_batch(
        "find_tender",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="licence-notice-fixture",
                    source_url="https://www.find-tender.service.gov.uk/Notice/fixture",
                    title="Synthetic licensed evidence",
                    published_at=now,
                    payload={"synthetic": True},
                    entities=[
                        EntityInput(
                            key="TEST:LICENCE",
                            name="Synthetic Licensee",
                            scheme="TEST",
                            identifier="LICENCE",
                            verified=True,
                        )
                    ],
                    observations=[
                        ObservationInput(
                            subject_key="TEST:LICENCE",
                            kind="contract_award",
                            event_key="licence-fixture",
                            headline="Synthetic licensed extract",
                            detail="Synthetic content for notice projection testing.",
                        )
                    ],
                )
            ]
        ),
        observed_at=now,
    )
    terms = {
        "attribution": "Exact attribution \u2013 punctuation preserved.",
        "distribution_conditions": ["Partial coverage.", "Internal analysis only."],
    }
    repo.update_source(
        "find_tender",
        {
            "permissions": {**terms, "private_note": "PRIVATE-PERMISSION-NOTE"},
            "config": {"private_note": "PRIVATE-CONFIGURATION"},
        },
    )
    evidence = client.get("/api/evidence")
    assert evidence.status_code == 200
    item = evidence.json()["items"][0]
    assert item["source_permissions"] == terms
    assert item["source_name"] == repo.get_source("find_tender")["name"]
    assert "PRIVATE-PERMISSION-NOTE" not in evidence.text
    assert "PRIVATE-CONFIGURATION" not in evidence.text
    detail = client.get(f"/api/entities/{item['entity_id']}")
    assert detail.status_code == 200
    assert detail.json()["observations"][0]["source_permissions"] == terms

    repo.update_source("find_tender", {"permissions": {"attribution": "Updated attribution."}})
    revised = client.get("/api/evidence").json()["items"][0]
    assert revised["source_permissions"]["attribution"] == "Updated attribution."
