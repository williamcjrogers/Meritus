"""Versioned scoring rules approved for the first Meritus release."""

from typing import Final

RULE_VERSION: Final = "meritus-v1"


def _rule(
    weight: float,
    half_life_days: int | None,
    family: str,
    *,
    qualifies: bool,
    substantive: bool = False,
    live_dispute: bool = False,
) -> dict:
    return {
        "weight": weight,
        "half_life_days": half_life_days,
        "family": family,
        "qualifies": qualifies,
        "substantive": substantive,
        "live_dispute": live_dispute,
    }


DEFAULT_RULES: Final = {
    "version": RULE_VERSION,
    "recommendation_threshold": 40.0,
    "independence_window_days": 180,
    "family_cap": 45.0,
    "context_cap": 10.0,
    "total_cap": 100.0,
    "kinds": {
        "insolvency_petition": _rule(40, 90, "insolvency", qualifies=True, substantive=True),
        "insolvency_event": _rule(40, 90, "insolvency", qualifies=True, substantive=True),
        "adjudication_enforcement": _rule(
            40, 90, "proceedings", qualifies=True, substantive=True, live_dispute=True
        ),
        "bsa_live_proceeding": _rule(
            35, 90, "proceedings", qualifies=True, substantive=True, live_dispute=True
        ),
        "construction_decision": _rule(20, 180, "proceedings", qualifies=True),
        "adverse_performance": _rule(
            35, 180, "procurement_performance", qualifies=True, substantive=True
        ),
        "adverse_termination": _rule(
            35, 180, "procurement_performance", qualifies=True, substantive=True
        ),
        "debarment": _rule(35, 180, "procurement_performance", qualifies=True, substantive=True),
        "contract_provision": _rule(
            30, 180, "corporate_governance_finance", qualifies=True, substantive=True
        ),
        "payment_deterioration": _rule(
            20, 180, "payment_practice", qualifies=True, substantive=True
        ),
        "auditor_resignation": _rule(
            20, 180, "corporate_governance_finance", qualifies=True, substantive=True
        ),
        "accounts_overdue": _rule(12, 90, "corporate_governance_finance", qualifies=True),
        "accounting_date_change": _rule(12, 90, "corporate_governance_finance", qualifies=True),
        "new_charge": _rule(10, 90, "corporate_governance_finance", qualifies=True),
        "director_departure": _rule(10, 90, "corporate_governance_finance", qualifies=True),
        "group_change": _rule(10, 90, "corporate_governance_finance", qualifies=True),
        "project_delay": _rule(25, 180, "project_delivery", qualifies=True, substantive=True),
        "gateway_project_delay": _rule(
            25, 180, "project_delivery", qualifies=True, substantive=True
        ),
        "claims_hiring": _rule(5, 90, "context_amplifiers", qualifies=False),
        "contract_value_context": _rule(3, None, "context_amplifiers", qualifies=False),
        "contract_duration_context": _rule(3, None, "context_amplifiers", qualifies=False),
        "fixed_price_context": _rule(2, None, "context_amplifiers", qualifies=False),
        "timing_context": _rule(2, None, "context_amplifiers", qualifies=False),
        "payment_report": _rule(0, None, "evidence_only", qualifies=False),
        "gateway_metric": _rule(0, None, "evidence_only", qualifies=False),
        "remediation_metric": _rule(0, None, "evidence_only", qualifies=False),
        "programme_context": _rule(0, None, "evidence_only", qualifies=False),
        "adjudication_metric": _rule(0, None, "evidence_only", qualifies=False),
    },
}
