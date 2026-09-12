"""Small source parsing primitives, without identity inference."""

import hashlib
import json
import math
from datetime import UTC, datetime

from meritus.domain import EntityInput
from meritus.sources.catalogue import company_key

NONFINITE_MARKER = "source_non_finite_number"


def source_json(data: bytes | str):
    """Retain non-standard upstream Infinity/NaN tokens without silently converting to null."""

    def finite_float(token):
        value = float(token)
        return value if math.isfinite(value) else {NONFINITE_MARKER: token}

    return json.loads(
        data, parse_constant=lambda token: {NONFINITE_MARKER: token}, parse_float=finite_float
    )


def nonfinite_paths(value, prefix="") -> list[str]:
    if isinstance(value, dict):
        if NONFINITE_MARKER in value:
            return [prefix]
        return [
            path for key, item in value.items() for path in nonfinite_paths(item, f"{prefix}/{key}")
        ]
    if isinstance(value, list):
        return [
            path
            for index, item in enumerate(value)
            for path in nonfinite_paths(item, f"{prefix}/{index}")
        ]
    return []


def source_date(value) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    value = value.strip()
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        for pattern in ("%d/%m/%Y", "%d %B %Y", "%d %b %Y"):
            try:
                parsed = datetime.strptime(value, pattern)
                break
            except ValueError:
                continue
        else:
            return None
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def organisation(
    source_id: str, stable_id: str, name: str, scheme=None, identifier=None, properties=None
) -> EntityInput:
    properties = properties or {}
    if scheme == "GB-COH" and identifier:
        try:
            key = company_key(str(identifier))
            return EntityInput(
                key=key,
                name=name,
                scheme=scheme,
                identifier=key.split(":", 1)[1],
                verified=True,
                properties=properties,
            )
        except ValueError:
            properties = {**properties, "invalid_source_identifier": str(identifier)}
    elif scheme and identifier:
        return EntityInput(
            key=f"{scheme}:{identifier}",
            name=name,
            scheme=scheme,
            identifier=str(identifier),
            verified=True,
            properties=properties,
        )
    digest = hashlib.sha256(stable_id.encode()).hexdigest()[:24]
    return EntityInput(key=f"unresolved:{source_id}:{digest}", name=name, properties=properties)
