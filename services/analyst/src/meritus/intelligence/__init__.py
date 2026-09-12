"""Pure, versioned intelligence calculations."""

from meritus.intelligence.rules import DEFAULT_RULES, RULE_VERSION
from meritus.intelligence.scoring import score_entities
from meritus.intelligence.trends import derive_payment_trends

__all__ = [
    "DEFAULT_RULES",
    "RULE_VERSION",
    "IntelligenceService",
    "derive_payment_trends",
    "score_entities",
]


def __getattr__(name):
    if name == "IntelligenceService":
        from meritus.intelligence.service import IntelligenceService

        return IntelligenceService
    raise AttributeError(name)
