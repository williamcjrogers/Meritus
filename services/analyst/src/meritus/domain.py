"""Normalised source envelopes shared by ingestion adapters and persistence."""

import math
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any, Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

EntityKind = Literal["organisation", "project", "building", "proceeding", "person"]
ReviewState = Literal["verified", "pending", "rejected"]
NonEmptyString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


def _require_aware(value: datetime | None) -> datetime | None:
    if value is not None and (value.tzinfo is None or value.utcoffset() is None):
        raise ValueError("datetimes must include a UTC offset")
    return value


def _reject_non_finite_numbers(value: Any, path: str) -> None:
    if isinstance(value, float) and not math.isfinite(value):
        label = "NaN" if math.isnan(value) else f"{'-' if value < 0 else ''}Infinity"
        raise ValueError(f"non-finite numeric value {label} at {path}")
    if isinstance(value, Decimal) and not value.is_finite():
        label = "NaN" if value.is_nan() else f"{'-' if value.is_signed() else ''}Infinity"
        raise ValueError(f"non-finite numeric value {label} at {path}")
    if isinstance(value, BaseModel):
        for field_name in type(value).model_fields:
            _reject_non_finite_numbers(getattr(value, field_name), f"{path}.{field_name}")
    elif isinstance(value, dict):
        for key, item in value.items():
            _reject_non_finite_numbers(item, f"{path}.{key}")
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            _reject_non_finite_numbers(item, f"{path}.{index}")


class Envelope(BaseModel):
    """Strict base model so adapter mistakes are visible rather than discarded."""

    model_config = ConfigDict(extra="forbid", revalidate_instances="always")

    @model_validator(mode="after")
    def reject_non_finite_numbers(self) -> Self:
        for field_name in type(self).model_fields:
            _reject_non_finite_numbers(getattr(self, field_name), field_name)
        return self


class EntityInput(Envelope):
    key: NonEmptyString
    kind: EntityKind = "organisation"
    name: NonEmptyString
    scheme: str | None = None
    identifier: str | None = None
    verified: bool = False
    properties: dict[str, Any] = Field(default_factory=dict)


class ObservationInput(Envelope):
    subject_key: NonEmptyString
    kind: NonEmptyString
    event_key: NonEmptyString
    headline: NonEmptyString
    detail: str
    occurred_at: datetime | None = None
    period_end: datetime | None = None
    state: ReviewState = "pending"
    evidence_pointer: str = ""
    value: float | None = None
    unit: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)

    _aware_occurred_at = field_validator("occurred_at")(_require_aware)
    _aware_period_end = field_validator("period_end")(_require_aware)


class RelationshipInput(Envelope):
    from_key: NonEmptyString
    to_key: NonEmptyString
    role: NonEmptyString
    evidence_pointer: str
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    state: ReviewState = "pending"
    attributes: dict[str, Any] = Field(default_factory=dict)

    _aware_valid_from = field_validator("valid_from")(_require_aware)
    _aware_valid_to = field_validator("valid_to")(_require_aware)


class ParsedDocument(Envelope):
    external_id: NonEmptyString
    source_url: NonEmptyString
    title: str
    published_at: datetime | None
    payload: dict[str, Any]
    entities: list[EntityInput] = Field(default_factory=list)
    observations: list[ObservationInput] = Field(default_factory=list)
    relationships: list[RelationshipInput] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    withdrawn: bool = False
    expires_at: datetime | None = None
    media_type: str = "application/json"
    raw_text: str | None = None

    _aware_published_at = field_validator("published_at")(_require_aware)
    _aware_expires_at = field_validator("expires_at")(_require_aware)


class FetchBatch(Envelope):
    documents: list[ParsedDocument] = Field(default_factory=list)
    cursor: str | None = None
    complete: bool = True
    warnings: list[str] = Field(default_factory=list)
