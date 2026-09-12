"""Reviewed source policy metadata and stable identifier helpers."""

import re
from copy import deepcopy
from typing import Any

_PREFIX_LENGTHS = {
    "AC": 6,
    "BR": 6,
    "FC": 6,
    "GE": 6,
    "GN": 6,
    "GS": 6,
    "IC": 6,
    "IP": 6,
    "LP": 6,
    "NA": 6,
    "NI": 6,
    "NL": 6,
    "NO": 6,
    "NP": 6,
    "NR": 6,
    "NZ": 6,
    "OC": 6,
    "OE": 6,
    "PC": 6,
    "R": 7,
    "RC": 6,
    "RS": 6,
    "SA": 6,
    "SC": 6,
    "SE": 6,
    "SF": 6,
    "SI": 6,
    "SL": 6,
    "SO": 6,
    "SP": 6,
    "SR": 6,
    "SZ": 6,
    "ZC": 6,
}


def company_key(number: str) -> str:
    """Validate and normalise a Companies House company number."""
    compact = re.sub(r"\s+", "", str(number)).upper()
    if compact.isdigit():
        if not 1 <= len(compact) <= 8:
            raise ValueError("A numeric company number must contain at most eight digits")
        return f"GB-COH:{compact.zfill(8)}"
    match = re.fullmatch(r"([A-Z]{1,2})([0-9]+)", compact)
    if not match:
        raise ValueError("Invalid Companies House company number")
    prefix, digits = match.groups()
    required_length = _PREFIX_LENGTHS.get(prefix)
    if required_length is None or len(digits) != required_length:
        raise ValueError("Invalid Companies House prefixed company number")
    return f"GB-COH:{prefix}{digits}"


def _source(
    source_id: str,
    name: str,
    description: str,
    home_url: str,
    licence_url: str,
    *,
    enabled: bool,
    requires_permission: bool = False,
    credential_names: list[str] | None = None,
    status: str | None = None,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": source_id,
        "name": name,
        "description": description,
        "home_url": home_url,
        "licence_url": licence_url,
        "enabled": enabled,
        "requires_permission": requires_permission,
        "credential_names": credential_names or [],
        "permissions": {},
        "config": config or {},
        "status": status or ("never_run" if enabled else "needs_permission"),
    }


SOURCE_CATALOGUE: tuple[dict[str, Any], ...] = (
    _source(
        "companies_house",
        "Companies House",
        "Company identity, filings, officers and charges.",
        "https://www.gov.uk/government/organisations/companies-house",
        "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
        enabled=False,
        credential_names=[
            "MERITUS_COMPANIES_HOUSE_API_KEY",
            "MERITUS_COMPANIES_HOUSE_STREAM_KEY",
        ],
        status="needs_credentials",
        config={"page_limit": 10},
    ),
    _source(
        "gazette",
        "The Gazette",
        "Official insolvency and statutory notices.",
        "https://www.thegazette.co.uk/",
        "https://www.thegazette.co.uk/datausage",
        enabled=False,
        status="needs_credentials",
        config={"page_limit": 10, "organisational_contact_required": True},
    ),
    _source(
        "find_tender",
        "Find a Tender",
        "UK public procurement notices published under the Procurement Act.",
        "https://www.find-tender.service.gov.uk/",
        "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
        enabled=True,
        config={"max_pages": 20, "page_size": 100},
    ),
    _source(
        "contracts_finder",
        "Contracts Finder",
        "Public contract opportunities, awards and performance notices.",
        "https://www.contractsfinder.service.gov.uk/",
        "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
        enabled=True,
        config={"max_pages": 20, "page_size": 100},
    ),
    _source(
        "payment_practices",
        "Payment Practices Reporting",
        "Successive statutory payment-practice reports.",
        "https://check-payment-practices.service.gov.uk/",
        "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
        enabled=True,
        config={"page_limit": 10},
    ),
    _source(
        "bsr_gateway",
        "Building Safety Regulator gateway data",
        "Published building-control gateway performance data.",
        "https://www.gov.uk/government/organisations/building-safety-regulator",
        "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
        enabled=True,
    ),
    _source(
        "ras_members",
        "Responsible Actors Scheme members",
        "Published membership of the Responsible Actors Scheme.",
        "https://www.gov.uk/government/publications/responsible-actors-scheme-members",
        "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
        enabled=True,
    ),
    _source(
        "ras_prohibitions",
        "Responsible Actors Scheme prohibitions",
        "Published prohibitions under the Responsible Actors Scheme.",
        "https://www.gov.uk/government/collections/responsible-actors-scheme",
        "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
        enabled=True,
    ),
    _source(
        "developer_remediation",
        "Developer remediation data",
        "Published developer remediation contract and programme information.",
        "https://www.gov.uk/government/collections/building-safety",
        "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
        enabled=True,
    ),
    _source(
        "debarment",
        "Procurement debarment list",
        "Published supplier debarment entries.",
        "https://www.gov.uk/government/collections/procurement-act-2023-guidance-documents",
        "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
        enabled=True,
    ),
    _source(
        "hmcts",
        "HMCTS court lists",
        "Court-list feed requiring approved delivery and retention arrangements.",
        "https://www.gov.uk/government/organisations/hm-courts-and-tribunals-service",
        "",
        enabled=False,
        requires_permission=True,
        credential_names=["MERITUS_HMCTS_RECEIVER_TOKEN"],
    ),
    _source(
        "find_case_law",
        "Find Case Law",
        "Judgments and decisions, subject to configured API access and terms.",
        "https://caselaw.nationalarchives.gov.uk/",
        "https://caselaw.nationalarchives.gov.uk/terms-of-use",
        enabled=False,
        requires_permission=True,
    ),
    _source(
        "rns",
        "Regulatory News Service",
        "Licensed listed-company announcement feed.",
        "https://www.londonstockexchange.com/news",
        "",
        enabled=False,
        requires_permission=True,
        credential_names=["MERITUS_RNS_USER", "MERITUS_RNS_ACCESS_KEY"],
    ),
    _source(
        "adzuna",
        "Adzuna",
        "Permitted employment advertisement search used as contextual evidence.",
        "https://www.adzuna.co.uk/",
        "https://developer.adzuna.com/overview",
        enabled=False,
        credential_names=["MERITUS_ADZUNA_APP_ID", "MERITUS_ADZUNA_APP_KEY"],
        status="needs_credentials",
        config={"page_limit": 5},
    ),
    _source(
        "construction_index",
        "The Construction Index",
        "Publisher material retained only when configured rights permit it.",
        "https://www.theconstructionindex.co.uk/",
        "",
        enabled=False,
        requires_permission=True,
    ),
    _source(
        "reviewed_import",
        "Reviewed import",
        "Analyst-reviewed evidence with explicit provenance and permission reference.",
        "",
        "",
        enabled=True,
        config={"page_limit": 1000},
    ),
)


def source_catalogue() -> list[dict[str, Any]]:
    return deepcopy(list(SOURCE_CATALOGUE))


def get_source_definition(source_id: str) -> dict[str, Any]:
    for source in SOURCE_CATALOGUE:
        if source["id"] == source_id:
            return deepcopy(source)
    raise KeyError(f"Unknown source: {source_id}")
