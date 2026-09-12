"""Bounded Companies House watchlist bootstrap and resumable stream parsing."""

from __future__ import annotations

import base64
import fcntl
import hashlib
import json
import re
from contextlib import contextmanager
from pathlib import Path
from typing import ClassVar
from urllib.parse import quote

from meritus.config import Settings
from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.sources.catalogue import company_key
from meritus.sources.common import source_date
from meritus.sources.documents import FileSlidingWindowBudget
from meritus.sources.http import FetchError, RateLimited, fetch_bytes

REST_BASE_URL = "https://api.company-information.service.gov.uk"
REST_HOSTS = {"api.company-information.service.gov.uk"}
REST_LIMIT = 500
REST_WINDOW_SECONDS = 300
STREAM_CONNECTION_LIMIT = 2
_COMPANY_URI = re.compile(r"(?:^|/)company/([^/]+)", re.IGNORECASE)
_VALID_TIMEPOINT = re.compile(r"^[0-9]+$")


@contextmanager
def stream_connection_slot(data_dir: Path | str | None = None):
    """Claim one of two account-wide stream slots on the shared worker volume."""
    root = Path(data_dir or Settings().data_dir) / "source-rate-limits"
    root.mkdir(parents=True, exist_ok=True)
    claimed = None
    for slot in range(STREAM_CONNECTION_LIMIT):
        handle = (root / f"companies-house-stream-{slot}.lock").open("a+")
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            handle.close()
            continue
        claimed = handle
        break
    if claimed is None:
        raise RateLimited(5)
    try:
        yield
    finally:
        fcntl.flock(claimed, fcntl.LOCK_UN)
        claimed.close()


def _acquire_rest_budget(data_dir: Path | str) -> None:
    retry = FileSlidingWindowBudget(
        Path(data_dir) / "source-rate-limits" / "companies-house-rest.json",
        limit=REST_LIMIT,
        window_seconds=REST_WINDOW_SECONDS,
    ).acquire()
    if retry is not None:
        raise RateLimited(retry)


def _basic_auth(key: str) -> str:
    token = base64.b64encode(f"{key}:".encode()).decode()
    return f"Basic {token}"


def rest_headers(settings: Settings | None = None) -> dict[str, str]:
    settings = settings or Settings()
    secret = settings.companies_house_api_key
    if not secret or not secret.get_secret_value().strip():
        raise FetchError("Companies House REST credentials are not configured.")
    return {"Authorization": _basic_auth(secret.get_secret_value())}


def stream_headers(settings: Settings | None = None) -> dict[str, str]:
    settings = settings or Settings()
    secret = settings.companies_house_stream_key
    if not secret or not secret.get_secret_value().strip():
        raise FetchError("Companies House stream credentials are not configured.")
    return {"Authorization": _basic_auth(secret.get_secret_value())}


def _company_number(event: dict) -> str | None:
    data = event.get("data") or {}
    number = data.get("company_number") or data.get("companyNumber")
    if not number:
        match = _COMPANY_URI.search(str(event.get("resource_uri") or ""))
        number = match.group(1) if match else None
    if not number:
        return None
    try:
        return company_key(str(number)).split(":", 1)[1]
    except ValueError:
        return None


def _event_metadata(event: dict) -> dict:
    metadata = event.get("event") or {}
    if not isinstance(metadata, dict):
        raise ValueError("Companies House stream event metadata must be an object.")
    return metadata


def _event_document_id(event: dict, number: str | None) -> str:
    metadata = _event_metadata(event)
    return str(
        event.get("resource_uri")
        or event.get("resource_id")
        or f"stream:{number or 'unknown'}:{metadata.get('timepoint') or 'uncheckpointed'}"
    )


def _profile_observations(number: str, profile: dict) -> list[ObservationInput]:
    subject = company_key(number)
    observations: list[ObservationInput] = []
    accounts = profile.get("accounts") or {}
    if accounts.get("overdue") is True:
        due = source_date(
            accounts.get("next_due") or accounts.get("next_accounts", {}).get("due_on")
        )
        event_date = due.date().isoformat() if due else "overdue"
        observations.append(
            ObservationInput(
                subject_key=subject,
                kind="accounts_overdue",
                event_key=f"companies-house:{number}:accounts:{event_date}",
                headline="Companies House accounts shown as overdue",
                detail="The company profile explicitly reports overdue accounts.",
                occurred_at=due,
                state="verified",
                evidence_pointer="/profile/accounts/overdue",
                attributes={"next_due": accounts.get("next_due")},
            )
        )
    return observations


def parse_company_snapshot(number: str, resources: dict) -> ParsedDocument:
    """Normalise one bounded REST bootstrap without deriving unsupported roles."""
    normalised = company_key(number).split(":", 1)[1]
    profile = resources.get("profile") or {}
    name = profile.get("company_name") or f"Company {normalised}"
    entity = EntityInput(
        key=company_key(normalised),
        name=name,
        scheme="GB-COH",
        identifier=normalised,
        verified=True,
        properties={
            "company_status": profile.get("company_status"),
            "company_type": profile.get("type"),
            "registered_office_region": (profile.get("registered_office_address") or {}).get(
                "region"
            ),
        },
    )
    observations = _profile_observations(normalised, profile)
    for filing in (resources.get("filings") or {}).get("items", []):
        filing_id = filing.get("transaction_id")
        description = str(filing.get("description") or "")
        if not filing_id:
            continue
        if description.startswith("change-account-reference-date-"):
            kind = "accounting_date_change"
            headline = "Accounting reference date changed"
        elif description in {
            "auditors-resignation-company",
            "auditors-resignation-limited-company",
            "auditors-resignation-limited-liability-partnership",
        }:
            kind = "auditor_resignation"
            headline = "Auditor resignation filed"
        else:
            continue
        occurred = source_date(filing.get("date"))
        observations.append(
            ObservationInput(
                subject_key=entity.key,
                kind=kind,
                event_key=f"companies-house:{normalised}:filing:{filing_id}",
                headline=headline,
                detail=f"Companies House filing description ID: {description}.",
                occurred_at=occurred,
                state="verified" if occurred else "pending",
                evidence_pointer=f"/filings/items/{filing_id}",
                attributes={"filing_description_id": description},
            )
        )
    for charge in (resources.get("charges") or {}).get("items", []):
        charge_id = charge.get("charge_code") or charge.get("etag")
        if not charge_id:
            continue
        occurred = source_date(charge.get("created_on") or charge.get("delivered_on"))
        observations.append(
            ObservationInput(
                subject_key=entity.key,
                kind="new_charge",
                event_key=f"companies-house:{normalised}:charge:{charge_id}",
                headline="New registered charge",
                detail=str(charge.get("classification") or "Companies House charge record"),
                occurred_at=occurred,
                state="verified" if occurred else "pending",
                evidence_pointer=f"/charges/items/{charge_id}",
                attributes={"charge_code": charge_id, "status": charge.get("status")},
            )
        )
    insolvency = resources.get("insolvency") or {}
    for case in insolvency.get("cases", []):
        case_id = case.get("case_number") or case.get("number")
        if case_id is None:
            continue
        dates = case.get("dates") or []
        occurred = source_date(next((item.get("date") for item in dates if item.get("date")), None))
        observations.append(
            ObservationInput(
                subject_key=entity.key,
                kind="insolvency_event",
                event_key=f"insolvency:companies-house:{normalised}:{case_id}",
                headline="Companies House insolvency case",
                detail=str(case.get("type") or "Published insolvency case"),
                occurred_at=occurred,
                state="verified" if occurred else "pending",
                evidence_pointer=f"/insolvency/cases/{case_id}",
                attributes={"case_number": str(case_id), "case_type": case.get("type")},
            )
        )
    warnings = []
    if not profile:
        warnings.append("Company profile was missing from the bootstrap response.")
    return ParsedDocument(
        external_id=f"bootstrap:{normalised}",
        source_url=f"https://find-and-update.company-information.service.gov.uk/company/{normalised}",
        title=name,
        published_at=None,
        payload=resources,
        entities=[entity],
        observations=observations,
        warnings=warnings,
    )


def _source_payload_for_observation(observation: ObservationInput, resources: dict) -> dict:
    pointer = observation.evidence_pointer
    if pointer == "/profile/accounts/overdue":
        return {"accounts": (resources.get("profile") or {}).get("accounts") or {}}
    if pointer.startswith("/filings/items/"):
        identifier = pointer.rsplit("/", 1)[-1]
        item = next(
            (
                value
                for value in (resources.get("filings") or {}).get("items", [])
                if str(value.get("transaction_id")) == identifier
            ),
            {},
        )
        return {"filing": item}
    if pointer.startswith("/charges/items/"):
        identifier = pointer.rsplit("/", 1)[-1]
        item = next(
            (
                value
                for value in (resources.get("charges") or {}).get("items", [])
                if str(value.get("charge_code") or value.get("etag")) == identifier
            ),
            {},
        )
        return {"charge": item}
    if pointer.startswith("/insolvency/cases/"):
        identifier = pointer.rsplit("/", 1)[-1]
        item = next(
            (
                value
                for value in (resources.get("insolvency") or {}).get("cases", [])
                if str(value.get("case_number") or value.get("number")) == identifier
            ),
            {},
        )
        return {"insolvency_case": item}
    return {"evidence_pointer": pointer}


def _company_documents(
    number: str, resources: dict, *, include_profile: bool = True
) -> list[ParsedDocument]:
    """Split one REST response into a profile record and independently dated evidence records."""
    snapshot = parse_company_snapshot(number, resources)
    normalised = company_key(number).split(":", 1)[1]
    documents = []
    if include_profile and resources.get("profile"):
        documents.append(
            snapshot.model_copy(
                update={
                    "external_id": f"bootstrap:{normalised}:profile",
                    "payload": {
                        "profile": resources["profile"],
                        "filings": {},
                        "officers": {},
                        "charges": {},
                        "insolvency": {},
                    },
                    "observations": [],
                }
            )
        )
    for observation in snapshot.observations:
        documents.append(
            snapshot.model_copy(
                update={
                    "external_id": f"bootstrap:{normalised}:event:{observation.event_key}",
                    "title": f"{snapshot.title}: {observation.headline}",
                    "published_at": observation.occurred_at,
                    "payload": _source_payload_for_observation(observation, resources),
                    "observations": [observation],
                    "warnings": (
                        []
                        if observation.occurred_at
                        else [
                            "The source resource has no evidenced date; this observation cannot "
                            "enter cutoff scoring."
                        ]
                    ),
                }
            )
        )
    return documents


def _resource_context_document(
    number: str,
    profile: dict,
    resource_name: str,
    resource: dict,
    start_index: int,
) -> ParsedDocument | None:
    collection = resource.get("items") if resource_name != "insolvency" else resource.get("cases")
    if not collection:
        return None
    snapshot = parse_company_snapshot(number, {"profile": profile})
    suffix = f":page:{start_index}" if resource_name in {"filings", "officers", "charges"} else ""
    return snapshot.model_copy(
        update={
            "external_id": f"bootstrap:{number}:{resource_name}{suffix}",
            "title": f"{snapshot.title}: Companies House {resource_name}",
            "payload": {resource_name: resource},
            "observations": [],
            "warnings": [
                "The raw resource collection is retained as undated context; independently "
                "dated supported evidence is stored in separate records."
            ],
        }
    )


def parse_stream_event(event: dict) -> ParsedDocument | None:
    if not isinstance(event, dict):
        raise ValueError("Companies House stream event must be an object.")
    metadata = _event_metadata(event)
    number = _company_number(event)
    deleted = metadata.get("type") == "deleted" or event.get("deleted") is True
    if not number and not deleted:
        return None
    data = event.get("data") or {}
    entity = None
    if number:
        entity = EntityInput(
            key=company_key(number),
            name=data.get("company_name") or data.get("companyName") or f"Company {number}",
            scheme="GB-COH",
            identifier=number,
            verified=True,
        )
    published = source_date(metadata.get("published_at") or metadata.get("publishedAt"))
    resource_uri = str(event.get("resource_uri") or "")
    observations: list[ObservationInput] = []
    if entity and not deleted:
        if "/officers/" in resource_uri and data.get("resigned_on"):
            role = data.get("officer_role")
            if role == "director":
                occurred = source_date(data.get("resigned_on"))
                observations.append(
                    ObservationInput(
                        subject_key=entity.key,
                        kind="director_departure",
                        event_key=f"companies-house:{number}:officer:{event.get('resource_id')}:departure",
                        headline="Director departure filed",
                        detail="Companies House records a director resignation.",
                        occurred_at=occurred,
                        state="verified" if occurred else "pending",
                        evidence_pointer="/data/resigned_on",
                        attributes={
                            "officer_id": event.get("resource_id"),
                            "officer_role": role,
                        },
                    )
                )
        elif "/charges/" in resource_uri:
            charge_id = data.get("charge_code") or event.get("resource_id")
            occurred = source_date(data.get("created_on") or data.get("delivered_on"))
            observations.append(
                ObservationInput(
                    subject_key=entity.key,
                    kind="new_charge",
                    event_key=f"companies-house:{number}:charge:{charge_id}",
                    headline="New registered charge",
                    detail="Companies House published a charge update.",
                    occurred_at=occurred,
                    state="verified" if occurred else "pending",
                    evidence_pointer="/data",
                    attributes={"charge_code": charge_id},
                )
            )
        elif "/insolvency" in resource_uri:
            case_id = data.get("case_number") or event.get("resource_id")
            observations.append(
                ObservationInput(
                    subject_key=entity.key,
                    kind="insolvency_event",
                    event_key=f"insolvency:companies-house:{number}:{case_id}",
                    headline="Companies House insolvency update",
                    detail=str(data.get("type") or "Published insolvency event"),
                    occurred_at=published,
                    state="verified" if published else "pending",
                    evidence_pointer="/data",
                    attributes={"case_number": case_id},
                )
            )
        elif resource_uri.rstrip("/").endswith(f"/company/{number}"):
            observations.extend(_profile_observations(number, data))
    warnings = []
    timepoint = metadata.get("timepoint")
    if timepoint is not None and not _VALID_TIMEPOINT.fullmatch(str(timepoint)):
        warnings.append("Stream timepoint is invalid; checkpoint reconciliation is required.")
    return ParsedDocument(
        external_id=_event_document_id(event, number),
        source_url=(
            f"https://find-and-update.company-information.service.gov.uk/company/{number}"
            if number
            else "https://find-and-update.company-information.service.gov.uk/"
        ),
        title=(
            entity.name
            if entity
            else f"Deleted Companies House resource {event.get('resource_id') or ''}"
        ),
        published_at=published,
        payload=event,
        entities=[entity] if entity else [],
        observations=observations,
        warnings=warnings,
        withdrawn=deleted,
    )


def parse_stream_line(line: str | bytes) -> ParsedDocument | None:
    if isinstance(line, bytes):
        line = line.decode("utf-8")
    if not line.strip():
        return None
    try:
        event = json.loads(line)
    except json.JSONDecodeError as error:
        raise ValueError("Companies House stream line is not valid JSON.") from error
    return parse_stream_event(event)


def parse_stream_lines(
    lines,
    *,
    watched_company_keys: set[str] | None = None,
    cursor: str | None = None,
    status_code: int = 200,
) -> FetchBatch:
    if status_code == 416:
        return FetchBatch(
            cursor=cursor,
            complete=False,
            warnings=["Companies House stream returned HTTP 416; reconcile before resuming."],
        )
    if status_code != 200:
        raise FetchError(f"Companies House stream returned HTTP {status_code}.")
    watched_company_keys = set(watched_company_keys or ())
    documents: list[ParsedDocument] = []
    warnings: list[str] = []
    checkpoint = cursor
    for line in lines:
        if isinstance(line, bytes):
            line = line.decode("utf-8")
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError("Companies House stream line is not valid JSON.") from error
        metadata = _event_metadata(event)
        timepoint = str(metadata.get("timepoint") or "")
        number = _company_number(event)
        key = company_key(number) if number else None
        if not _VALID_TIMEPOINT.fullmatch(timepoint):
            warnings.append("Stream timepoint is invalid; checkpoint reconciliation is required.")
            continue
        document = parse_stream_event(event)
        if document and (not watched_company_keys or key in watched_company_keys):
            documents.append(document)
        if checkpoint is None or int(timepoint) > int(checkpoint):
            checkpoint = timepoint
    return FetchBatch(
        documents=documents,
        cursor=checkpoint,
        complete=not warnings,
        warnings=warnings,
    )


class CompaniesHouseAdapter:
    """Bootstrap an explicitly approved company set through bounded REST reads."""

    _resources: ClassVar[dict[str, str]] = {
        "profile": "/company/{number}",
        "filings": "/company/{number}/filing-history",
        "officers": "/company/{number}/officers",
        "charges": "/company/{number}/charges",
        "insolvency": "/company/{number}/insolvency",
    }
    _paged_resources: ClassVar[set[str]] = {"filings", "officers", "charges"}

    @staticmethod
    def _cursor(
        company_index: int,
        resource: str,
        start_index: int,
        profile: dict | None,
        watchlist_hash: str,
    ) -> str:
        payload = {
            "watchlist_hash": watchlist_hash,
            "company_index": company_index,
            "resource": resource,
            "start_index": start_index,
        }
        if profile is not None:
            payload["profile"] = profile
        return json.dumps(payload, sort_keys=True)

    @staticmethod
    def _identity_profile(profile: dict) -> dict:
        fields = {
            "company_number",
            "company_name",
            "company_status",
            "type",
            "registered_office_address",
        }
        return {key: value for key, value in profile.items() if key in fields}

    @staticmethod
    def _next_page(payload: dict, requested_start: int, page_size: int) -> int | None:
        items = payload.get("items") or []
        if not isinstance(items, list):
            raise ValueError("Companies House collection items must be an array.")
        try:
            response_start = int(payload.get("start_index", requested_start))
            total = int(payload.get("total_count", payload.get("total_results", len(items))))
        except (TypeError, ValueError) as error:
            raise ValueError("Companies House pagination metadata is invalid.") from error
        if response_start != requested_start or total < 0:
            raise ValueError("Companies House pagination metadata is inconsistent.")
        next_start = requested_start + len(items)
        if next_start < total and not items:
            raise ValueError("Companies House pagination made no progress.")
        if next_start < total:
            return next_start
        if (
            "total_count" not in payload
            and "total_results" not in payload
            and len(items) >= page_size
        ):
            return next_start
        return None

    @staticmethod
    def _request_json(client, url, headers, params=None) -> dict:
        _acquire_rest_budget(Settings().data_dir)
        raw, _, _ = fetch_bytes(
            client,
            url,
            allowed_hosts=REST_HOSTS,
            params=params,
            headers=headers,
            max_bytes=8_000_000,
        )
        try:
            value = json.loads(raw)
        except json.JSONDecodeError as error:
            raise ValueError("Companies House returned invalid JSON.") from error
        if not isinstance(value, dict):
            raise ValueError("Companies House response must be an object.")
        return value

    def fetch(self, source, client, now):
        config = source.get("config") or {}
        raw_watchlist = (
            config.get("company_keys")
            or config.get("company_numbers")
            or config.get("watchlist")
            or []
        )
        if not isinstance(raw_watchlist, list):
            raise ValueError("Companies House watchlist must be an array.")
        if len(raw_watchlist) > 200:
            raise ValueError("Companies House watchlist is limited to 200 approved companies.")
        numbers = []
        for item in raw_watchlist:
            value = str(item).removeprefix("GB-COH:")
            numbers.append(company_key(value).split(":", 1)[1])
        if not numbers:
            raise FetchError("Companies House has no approved watched company keys.")
        request_limit = min(REST_LIMIT, max(1, int(config.get("max_requests", REST_LIMIT))))
        page_limit = min(100, max(1, int(config.get("page_size", 100))))
        try:
            cursor_data = json.loads(source.get("cursor") or "{}")
        except json.JSONDecodeError as error:
            raise ValueError("Companies House cursor is invalid.") from error
        watchlist_hash = hashlib.sha256(json.dumps(numbers).encode()).hexdigest()
        if cursor_data and cursor_data.get("watchlist_hash") != watchlist_hash:
            restarted = self.fetch({**source, "cursor": None}, client, now)
            return restarted.model_copy(
                update={
                    "warnings": [
                        *restarted.warnings,
                        (
                            "Watchlist changed or legacy cursor lacks identity binding; "
                            "bootstrap restarted safely."
                        ),
                    ]
                }
            )
        start = max(0, int(cursor_data.get("company_index", 0)))
        resource_names = list(self._resources)
        resource_name = str(cursor_data.get("resource") or "filings")
        if resource_name not in resource_names[1:]:
            raise ValueError("Companies House cursor resource is invalid.")
        resume_resource = resource_names.index(resource_name)
        resume_start = max(0, int(cursor_data.get("start_index", 0)))
        resume_profile = cursor_data.get("profile")
        if resume_profile is not None and not isinstance(resume_profile, dict):
            raise ValueError("Companies House cursor profile is invalid.")
        headers = rest_headers()
        documents = []
        requests = 0
        index = start
        while index < len(numbers):
            number = numbers[index]
            profile = resume_profile if index == start else None
            if profile is None:
                if requests >= request_limit:
                    return FetchBatch(
                        documents=documents,
                        cursor=self._cursor(index, "filings", 0, None, watchlist_hash),
                        complete=False,
                        warnings=[
                            "Companies House REST request cap reached before the next company; "
                            "bootstrap is resumable."
                        ],
                    )
                profile_url = REST_BASE_URL + self._resources["profile"].format(
                    number=quote(number, safe="")
                )
                try:
                    profile = self._request_json(client, profile_url, headers)
                except RateLimited as error:
                    return FetchBatch(
                        documents=documents,
                        cursor=self._cursor(index, "filings", 0, None, watchlist_hash),
                        complete=False,
                        warnings=[
                            "Companies House REST budget reached before the next profile; "
                            f"retry after {error.retry_after} seconds."
                        ],
                    )
                requests += 1
                documents.extend(_company_documents(number, {"profile": profile}))
            identity_profile = self._identity_profile(profile)
            resource_index = resume_resource if index == start else 1
            page_start = resume_start if index == start else 0
            while resource_index < len(resource_names):
                name = resource_names[resource_index]
                template = self._resources[name]
                if requests >= request_limit:
                    return FetchBatch(
                        documents=documents,
                        cursor=self._cursor(
                            index, name, page_start, identity_profile, watchlist_hash
                        ),
                        complete=False,
                        warnings=[
                            "Companies House REST request cap reached; bootstrap is resumable."
                        ],
                    )
                url = REST_BASE_URL + template.format(number=quote(number, safe=""))
                params = (
                    {"items_per_page": page_limit, "start_index": page_start}
                    if name in self._paged_resources
                    else None
                )
                try:
                    resource = self._request_json(client, url, headers, params)
                except RateLimited as error:
                    return FetchBatch(
                        documents=documents,
                        cursor=self._cursor(
                            index, name, page_start, identity_profile, watchlist_hash
                        ),
                        complete=False,
                        warnings=[
                            "Companies House REST budget reached during collection; "
                            f"retry after {error.retry_after} seconds."
                        ],
                    )
                except FetchError as error:
                    if name not in {"charges", "insolvency"} or "HTTP 404" not in str(error):
                        raise
                    resource = {}
                    requests += 1
                else:
                    requests += 1
                documents.extend(
                    _company_documents(
                        number,
                        {"profile": identity_profile, name: resource},
                        include_profile=False,
                    )
                )
                context_document = _resource_context_document(
                    number, identity_profile, name, resource, page_start
                )
                if context_document:
                    documents.append(context_document)
                if name in self._paged_resources:
                    next_page = self._next_page(resource, page_start, page_limit)
                    if next_page is not None:
                        page_start = next_page
                        continue
                resource_index += 1
                page_start = 0
            index += 1
            resume_resource = 1
            resume_start = 0
            resume_profile = None
        return FetchBatch(documents=documents, cursor=None, complete=True)
