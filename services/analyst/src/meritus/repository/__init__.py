"""Transactional repository facade."""

from meritus.repository.evidence import EvidenceRepository
from meritus.repository.sources import SourceRepositoryMixin
from meritus.repository.workflow import WorkflowRepositoryMixin


class Repository(SourceRepositoryMixin, WorkflowRepositoryMixin, EvidenceRepository):
    """Stable JSON-ready persistence interface for the application."""


__all__ = ["Repository"]
