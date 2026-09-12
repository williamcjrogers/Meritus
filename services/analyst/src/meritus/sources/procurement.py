"""OCDS discovery and evidence tied to the specific contract and award."""

import json
import math
import time
from copy import deepcopy
from datetime import UTC, timedelta
from urllib.parse import quote, urlsplit

from meritus.domain import (
    EntityInput,
    FetchBatch,
    ObservationInput,
    ParsedDocument,
    RelationshipInput,
)
from meritus.sources.common import nonfinite_paths, organisation, source_date, source_json
from meritus.sources.http import FetchError, RateLimited, fetch_bytes

ENDPOINTS = {
    "find_tender": "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages",
    "contracts_finder": "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search",
}
RECORD_ENDPOINTS = {
    "find_tender": "https://www.find-tender.service.gov.uk/api/1.0/ocdsRecordPackages/",
    "contracts_finder": "https://www.contractsfinder.service.gov.uk/Published/OCDS/Record/",
}


def _rate_limited_batch(
    error,
    *,
    completed_pages,
    documents,
    interrupted_url,
    window_end,
    now,
    started,
    history_gaps,
    skipped,
):
    if completed_pages == 0:
        raise error
    elapsed = max(0.0, time.monotonic() - started)
    retry_not_before = now + timedelta(seconds=elapsed + error.retry_after)
    warnings = [
        f"Publisher rate limit paused collection after {completed_pages} complete pages; "
        f"retry after {error.retry_after} seconds and no earlier than "
        f"{retry_not_before.astimezone(UTC).strftime('%d %B %Y %H:%M:%S UTC')}."
    ]
    if history_gaps:
        warnings.append(f"Dated supplier history unavailable for {len(history_gaps)} processes.")
    if skipped:
        warnings.append(f"Construction/engineering cohort filter excluded {skipped} releases.")
    return FetchBatch(
        documents=documents,
        cursor=json.dumps(
            {
                "next": interrupted_url,
                "window_end": window_end,
                "retry_not_before": retry_not_before.isoformat(),
            }
        ),
        complete=False,
        warnings=warnings,
    )


def construction_release(release):
    tender = release.get("tender") or {}
    items = [tender, *tender.get("items", [])]
    for award in release.get("awards", []):
        items.extend(award.get("items", []))
    classifications = [
        classification
        for item in items
        for classification in [
            item.get("classification") or {},
            *item.get("additionalClassifications", []),
        ]
    ]
    return tender.get("mainProcurementCategory") == "works" or any(
        item.get("scheme") == "CPV" and str(item.get("id", "")).startswith(("45", "71"))
        for item in classifications
    )


def _needs_supplier_history(release):
    awards = {str(item.get("id")): item for item in release.get("awards", [])}
    parties = {str(item.get("id")): item for item in release.get("parties", [])}
    units = release.get("contracts") or [
        {"awardID": award.get("id")} for award in release.get("awards", [])
    ]
    for contract in units:
        suppliers = awards.get(str(contract.get("awardID")), {}).get("suppliers", [])
        if not suppliers:
            return True
        for supplier in suppliers:
            identity = supplier.get("identifier") or parties.get(str(supplier.get("id")), {}).get(
                "identifier"
            )
            if not identity or not identity.get("scheme") or not identity.get("id"):
                return True
    return False


def _merge(old, new):
    if isinstance(old, dict) and isinstance(new, dict):
        result = deepcopy(old)
        for key, value in new.items():
            result[key] = _merge(result[key], value) if key in result else deepcopy(value)
        return result
    if (
        isinstance(old, list)
        and isinstance(new, list)
        and all(isinstance(item, dict) and "id" in item for item in old + new)
    ):
        result = {str(item["id"]): deepcopy(item) for item in old}
        for item in new:
            key = str(item["id"])
            result[key] = _merge(result.get(key, {}), item)
        return list(result.values())
    return deepcopy(new)


def _context(release, record):
    """Never hydrate an earlier failure with a supplier from a later award change."""
    if record and "records" in record:
        record = next((r for r in record["records"] if r.get("ocid") == release["ocid"]), {})
    end = source_date(release.get("date"))
    candidates = []
    for prior in (record or {}).get("releases", []):
        date = source_date(prior.get("date"))
        if date and end and date <= end:
            candidates.append(prior)
    compiled = (record or {}).get("compiledRelease")
    if not candidates and compiled:
        date = source_date(compiled.get("date"))
        if date and end and date <= end:
            candidates.append(compiled)
    result = {}
    for prior in sorted(candidates, key=lambda r: (source_date(r["date"]), r.get("id", ""))):
        result = _merge(result, prior)
    return _merge(result, release), [item.get("id") for item in candidates]


def _without_contacts(value):
    if isinstance(value, dict):
        return {
            key: _without_contacts(item) for key, item in value.items() if key != "contactPoint"
        }
    if isinstance(value, list):
        return [_without_contacts(item) for item in value]
    return value


def parse_release(release: dict, source_id: str, record: dict | None = None) -> ParsedDocument:
    if source_id not in ENDPOINTS or not release.get("id") or not release.get("ocid"):
        raise ValueError("An OCDS release requires a supported source, release id and process id.")
    for field in ("parties", "awards", "contracts"):
        if field in release and not isinstance(release[field], list):
            raise ValueError(f"OCDS release {field} must be an array.")
    published = source_date(release.get("date"))
    context, prior_ids = _context(release, record)
    numeric_gaps = nonfinite_paths(release)
    ocid = release["ocid"]
    title = context.get("tender", {}).get("title") or f"Procurement process {ocid}"
    project_key = f"project:{source_id}:{ocid}"
    project = EntityInput(
        key=project_key,
        kind="project",
        name=title,
        verified=True,
        properties={
            "ocid": ocid,
            "source_id": source_id,
            "sector": "Construction and engineering" if construction_release(context) else None,
            "classifications": context.get("tender", {}).get("classification"),
            "additional_classifications": context.get("tender", {}).get(
                "additionalClassifications", []
            ),
        },
    )
    entities = {project_key: project}
    party_entities, warnings, relationships, observations = {}, [], [], []
    if not published:
        warnings.append("Release publication date requires review.")
    if numeric_gaps:
        warnings.append(
            "Non-finite source numbers retained as explicit markers: " + ", ".join(numeric_gaps)
        )
    for party in context.get("parties", []):
        if not party.get("id"):
            continue
        identifier = party.get("identifier") or {}
        entity = organisation(
            source_id,
            f"{ocid}:{party['id']}",
            party.get("name") or str(party["id"]),
            identifier.get("scheme"),
            identifier.get("id"),
            {
                "procurement_party_id": party["id"],
                "geography": party.get("address", {}).get("region"),
            },
        )
        party_entities[str(party["id"])] = entity
        entities[entity.key] = entity
        if "buyer" in party.get("roles", []):
            relationships.append(
                RelationshipInput(
                    from_key=entity.key,
                    to_key=project_key,
                    role="buyer",
                    evidence_pointer=f"/parties/{party['id']}/roles",
                    state="verified" if entity.verified else "pending",
                )
            )
    awards = {str(a["id"]): a for a in context.get("awards", []) if a.get("id") is not None}
    prior_contracts = {
        str(c["id"]): c for c in context.get("contracts", []) if c.get("id") is not None
    }
    units = release.get("contracts", [])
    if not units:
        units = [
            {
                "id": f"award:{a['id']}",
                "awardID": a["id"],
                "value": a.get("value"),
                "period": a.get("contractPeriod"),
            }
            for a in release.get("awards", [])
            if "id" in a
        ]
    for contract in units:
        if "id" not in contract:
            raise ValueError("OCDS release contract has no identifier.")
        cid = str(contract["id"])
        enriched = _merge(prior_contracts.get(cid, {}), contract)
        award = awards.get(str(enriched.get("awardID")), {})
        period = enriched.get("period") or award.get("contractPeriod") or {}
        start = source_date(period.get("startDate")) or source_date(award.get("date"))
        end = source_date(period.get("endDate"))
        suppliers = []
        for supplier in award.get("suppliers", []):
            pid = str(supplier.get("id", ""))
            entity = party_entities.get(pid)
            if not entity:
                identifier = supplier.get("identifier") or {}
                entity = organisation(
                    source_id,
                    f"{ocid}:{pid or supplier.get('name')}",
                    supplier.get("name") or "Unresolved supplier",
                    identifier.get("scheme"),
                    identifier.get("id"),
                    {"procurement_party_id": pid},
                )
                entities[entity.key] = entity
                party_entities[pid] = entity
            suppliers.append(entity)
            relationships.append(
                RelationshipInput(
                    from_key=entity.key,
                    to_key=project_key,
                    role="supplier",
                    evidence_pointer=f"/awards/{award.get('id')}/suppliers/{pid}",
                    state="verified" if entity.verified else "pending",
                    valid_from=start,
                    valid_to=end,
                    attributes={"contract_id": cid, "award_id": award.get("id"), "ocid": ocid},
                )
            )
        if not suppliers:
            warnings.append(
                f"Contract {cid}: supplier identity was unavailable in dated source history."
            )

        award_id = award.get("id")

        def emit(
            kind,
            event_suffix,
            headline,
            detail,
            pointer,
            *,
            date=None,
            state="verified",
            value=None,
            unit=None,
            attrs=None,
            responsible=None,
            _suppliers=tuple(suppliers),
            _cid=cid,
            _award_id=award_id,
        ):
            for entity in _suppliers:
                if responsible and entity.properties.get("procurement_party_id") not in responsible:
                    continue
                observations.append(
                    ObservationInput(
                        subject_key=entity.key,
                        kind=kind,
                        event_key=f"procurement:{source_id}:{ocid}:{_cid}:{event_suffix}",
                        headline=headline,
                        detail=detail,
                        occurred_at=date or published,
                        state=state
                        if entity.verified and published and not numeric_gaps
                        else "pending",
                        evidence_pointer=pointer,
                        value=value,
                        unit=unit,
                        attributes={
                            "ocid": ocid,
                            "contract_id": _cid,
                            "award_id": _award_id,
                            **(attrs or {}),
                        },
                    )
                )

        value = enriched.get("value") or award.get("value") or {}
        amount = value.get("amount")
        if isinstance(amount, (int, float)) and not isinstance(amount, bool):
            emit(
                "contract_value_context",
                "value",
                "Published contract value",
                str(value),
                f"/contracts/{cid}/value",
                value=amount,
                unit=value.get("currency"),
                attrs={"currency": value.get("currency")},
            )
        period = enriched.get("period") or award.get("contractPeriod") or {}
        start, end = source_date(period.get("startDate")), source_date(period.get("endDate"))
        if start and end and end >= start:
            months = (end - start).days / (365.2425 / 12)
            emit(
                "contract_duration_context",
                "duration",
                "Published contract duration",
                "Contract period, not certified practical completion.",
                f"/contracts/{cid}/period",
                value=months,
                unit="months",
                attrs={"period_start": start.isoformat(), "period_end": end.isoformat()},
            )
        # Only the current release asserts new performance evidence. Hydration supplies identity.
        implementation = contract.get("implementation") or {}
        for failure in implementation.get("performanceFailures", []):
            fid = failure.get("id")
            if not fid:
                raise ValueError("OCDS performance failure has no stable identifier.")
            if failure.get("events") == 0:
                continue
            responsible = [str(s["id"]) for s in failure.get("suppliers", []) if s.get("id")]
            occurred = source_date(failure.get("decisionDate")) or source_date(
                failure.get("period", {}).get("endDate")
            )
            supported = bool(
                failure.get("events")
                or failure.get("description")
                or failure.get("category")
                or failure.get("penaltyImposed")
            )
            emit(
                "adverse_performance",
                f"failure:{fid}",
                "Published contract performance failure",
                json.dumps(failure, ensure_ascii=False),
                f"/contracts/{cid}/implementation/performanceFailures/{fid}",
                date=occurred,
                state="verified" if supported else "pending",
                responsible=responsible or None,
            )
        for metric in implementation.get("metrics", []):
            for observation in metric.get("observations", []):
                classification = (observation.get("measureClassification") or {}).get("id")
                if classification not in {"below", "significantlyBelow"}:
                    continue
                period_end = observation.get("period", {}).get("endDate")
                event = f"metric:{metric.get('id')}:{period_end or observation.get('id')}"
                emit(
                    "adverse_performance",
                    event,
                    "Published KPI below required standard",
                    json.dumps(observation, ensure_ascii=False),
                    f"/contracts/{cid}/implementation/metrics/{metric.get('id')}",
                    date=source_date(period_end),
                )
        reasons = contract.get("terminationRationaleClassifications") or []
        if contract.get("terminationRationaleClassification"):
            reasons = [*reasons, contract["terminationRationaleClassification"]]
        if (
            contract.get("status") == "terminated"
            and reasons
            and any(reason.get("id") != "contractCompleted" for reason in reasons)
        ):
            emit(
                "adverse_termination",
                "termination",
                "Termination grounds require review",
                json.dumps(reasons, ensure_ascii=False),
                f"/contracts/{cid}/terminationRationaleClassifications",
                state="pending",
                attrs={"termination_reasons": reasons},
            )
    url = (
        f"https://www.find-tender.service.gov.uk/Notice/{quote(str(release['id']), safe='')}"
        if source_id == "find_tender"
        else "https://www.contractsfinder.service.gov.uk/Published/OCDS/Release/"
        + quote(str(release["id"]), safe="")
    )
    return ParsedDocument(
        external_id=str(release["id"]),
        source_url=url,
        title=title,
        published_at=published,
        payload={
            "release": _without_contacts(release),
            "parser_warnings": warnings,
            "identity_context": {
                "release_ids": prior_ids,
                "parties": _without_contacts(context.get("parties", [])),
                "awards": list(awards.values()),
            },
        },
        entities=list(entities.values()),
        observations=observations,
        relationships=relationships,
        warnings=warnings,
    )


class ProcurementAdapter:
    def __init__(self, source_id):
        self.source_id = source_id

    def fetch(self, source, client, now):
        config = source.get("config") or {}
        hosts = {urlsplit(ENDPOINTS[self.source_id]).hostname}
        pages = min(100, max(1, int(config.get("max_pages", 20))))
        limit = min(100, max(1, int(config.get("page_size", 100))))
        cursor = json.loads(source.get("cursor") or "{}")
        retry_value = cursor.get("retry_not_before")
        retry_not_before = source_date(retry_value)
        if retry_value and retry_not_before is None:
            raise ValueError("OCDS retry checkpoint is invalid.")
        if retry_not_before and retry_not_before > now:
            raise RateLimited(max(1, math.ceil((retry_not_before - now).total_seconds())))
        started = time.monotonic()
        window_end = (
            (source_date(cursor.get("window_end")) or now)
            .astimezone(UTC)
            .strftime("%Y-%m-%dT%H:%M:%S")
        )
        url = cursor.get("next") or ENDPOINTS[self.source_id]
        since = (
            (source_date(cursor.get("since")) or now - timedelta(days=30))
            .astimezone(UTC)
            .strftime("%Y-%m-%dT%H:%M:%S")
        )
        params = (
            None
            if cursor.get("next")
            else {
                "limit": limit,
                "updatedFrom" if self.source_id == "find_tender" else "publishedFrom": since,
                "updatedTo" if self.source_id == "find_tender" else "publishedTo": window_end,
            }
        )
        documents, histories, seen = [], {}, set()
        history_gaps = {}
        empty_histories = set()
        record_limit = min(
            256_000_000, max(1_000_000, int(config.get("max_record_bytes", 64_000_000)))
        )
        skipped = 0
        completed_pages = 0
        for _ in range(pages):
            marker = (url, json.dumps(params, sort_keys=True))
            if marker in seen:
                raise FetchError("OCDS pagination repeated a page; checkpoint was not advanced.")
            seen.add(marker)
            try:
                content, _, _ = fetch_bytes(client, url, allowed_hosts=hosts, params=params)
            except RateLimited as error:
                return _rate_limited_batch(
                    error,
                    completed_pages=completed_pages,
                    documents=documents,
                    interrupted_url=url,
                    window_end=window_end,
                    now=now,
                    started=started,
                    history_gaps=history_gaps,
                    skipped=skipped,
                )
            try:
                package = source_json(content)
            except (ValueError, UnicodeDecodeError):
                raise FetchError("OCDS source returned malformed JSON.") from None
            if not isinstance(package, dict) or not isinstance(package.get("releases"), list):
                raise FetchError("OCDS source schema has no releases array.")
            page_documents = []
            page_histories = histories.copy()
            page_history_gaps = history_gaps.copy()
            page_empty_histories = empty_histories.copy()
            page_skipped = 0
            for release in package["releases"]:
                ocid = release.get("ocid")
                if _needs_supplier_history(release):
                    if ocid not in page_histories:
                        record_url = (
                            f"{RECORD_ENDPOINTS[self.source_id]}{quote(str(ocid), safe='')}"
                        )
                        try:
                            raw, _, _ = fetch_bytes(
                                client, record_url, allowed_hosts=hosts, max_bytes=record_limit
                            )
                            if not raw.strip():
                                page_histories[ocid] = None
                                page_history_gaps[ocid] = record_url
                                page_empty_histories.add(ocid)
                            else:
                                try:
                                    page_histories[ocid] = source_json(raw)
                                except (ValueError, UnicodeDecodeError):
                                    raise FetchError(
                                        "OCDS supplier history returned malformed JSON."
                                    ) from None
                        except RateLimited as error:
                            return _rate_limited_batch(
                                error,
                                completed_pages=completed_pages,
                                documents=documents,
                                interrupted_url=url,
                                window_end=window_end,
                                now=now,
                                started=started,
                                history_gaps=history_gaps,
                                skipped=skipped,
                            )
                        except FetchError as error:
                            if "HTTP 404" not in str(error):
                                raise
                            page_histories[ocid] = None
                            page_history_gaps[ocid] = record_url
                    record = page_histories[ocid]
                else:
                    record = None
                candidate_context, _ = _context(release, record)
                if config.get("construction_only", True) and not construction_release(
                    candidate_context
                ):
                    page_skipped += 1
                    continue
                document = parse_release(release, self.source_id, record)
                if ocid in page_history_gaps:
                    warning = (
                        "Optional dated supplier history is unavailable; "
                        "unresolved identities require review."
                    )
                    document.warnings.append(warning)
                    document.payload["parser_warnings"] = document.warnings
                    document.payload["history_lookup"] = {
                        "status": "unavailable",
                        "source_url": page_history_gaps[ocid],
                    }
                    if ocid in page_empty_histories:
                        document.payload["history_lookup"]["reason"] = "empty_response"
                page_documents.append(document)
            documents.extend(page_documents)
            histories = page_histories
            history_gaps = page_history_gaps
            empty_histories = page_empty_histories
            skipped += page_skipped
            completed_pages += 1
            url = (package.get("links") or {}).get("next")
            params = None
            if not url:
                return FetchBatch(
                    documents=documents,
                    cursor=json.dumps({"since": window_end}),
                    complete=not history_gaps,
                    warnings=(
                        [f"Construction/engineering cohort filter excluded {skipped} releases."]
                        if skipped
                        else []
                    )
                    + (
                        [
                            f"Supplier history unavailable for {len(history_gaps)} processes; "
                            "coverage is partial."
                        ]
                        if history_gaps
                        else []
                    ),
                )
        return FetchBatch(
            documents=documents,
            cursor=json.dumps({"next": url, "window_end": window_end}),
            complete=False,
            warnings=[
                f"Collection capped at {pages} pages; coverage is partial.",
                f"Dated supplier history unavailable for {len(history_gaps)} processes.",
                f"Construction/engineering cohort filter excluded {skipped} releases.",
            ],
        )
