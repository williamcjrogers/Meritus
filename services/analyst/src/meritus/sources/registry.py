"""Explicit adapter registry; unsupported feeds never pretend to have run."""

from meritus.sources.adzuna import AdzunaAdapter
from meritus.sources.caselaw import CaseLawAdapter
from meritus.sources.companies_house import CompaniesHouseAdapter
from meritus.sources.gazette import GazetteAdapter
from meritus.sources.government import GovernmentAdapter
from meritus.sources.hmcts import HMCTSAdapter
from meritus.sources.news import ConstructionIndexAdapter
from meritus.sources.payment_practices import PaymentPracticesAdapter
from meritus.sources.procurement import ProcurementAdapter
from meritus.sources.rns import RNSAdapter

_ADAPTERS = {
    "find_tender": ProcurementAdapter("find_tender"),
    "contracts_finder": ProcurementAdapter("contracts_finder"),
    "payment_practices": PaymentPracticesAdapter(),
    "companies_house": CompaniesHouseAdapter(),
    "gazette": GazetteAdapter(),
    "hmcts": HMCTSAdapter(),
    "find_case_law": CaseLawAdapter(),
    "rns": RNSAdapter(),
    "adzuna": AdzunaAdapter(),
    "construction_index": ConstructionIndexAdapter(),
    **{
        source_id: GovernmentAdapter(source_id)
        for source_id in (
            "bsr_gateway",
            "ras_members",
            "ras_prohibitions",
            "developer_remediation",
            "debarment",
        )
    },
}


def register_adapter(source_id, adapter):
    if not hasattr(adapter, "fetch"):
        raise TypeError("A source adapter must implement fetch.")
    _ADAPTERS[source_id] = adapter


def get_adapter(source_id):
    try:
        return _ADAPTERS[source_id]
    except KeyError:
        raise ValueError(f"No automatic adapter is installed for source {source_id}.") from None
