"""Runtime configuration and defensive masking for browser-facing data."""

from copy import deepcopy
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_SECRET_PARTS = (
    "access_key",
    "accesskey",
    "api_key",
    "apikey",
    "app_key",
    "authorization",
    "credential",
    "password",
    "secret",
    "signature",
    "stream_key",
    "token",
)
_CREDENTIAL_FIELD_NAMES = {
    "adzuna_app_id",
    "adzuna_app_key",
    "companies_house_api_key",
    "companies_house_stream_key",
    "hmcts_receiver_token",
    "rns_access_key",
    "rns_user",
}
MASK = "********"


def is_secret_name(name: str) -> bool:
    normalised = name.lower().replace("-", "_")
    unprefixed = normalised.removeprefix("meritus_")
    return unprefixed in _CREDENTIAL_FIELD_NAMES or any(
        part in normalised for part in _SECRET_PARTS
    )


def _is_secret_url_key(name: str) -> bool:
    compact = name.lower().replace("-", "").replace("_", "")
    return is_secret_name(name) or compact in {
        "googleaccessid",
        "key",
        "sig",
        "xamzcredential",
        "xamzsecuritytoken",
        "xamzsignature",
        "xgoogcredential",
        "xgoogsignature",
    }


def _fragment_has_credentials(fragment: str) -> bool:
    if not fragment:
        return False
    pairs = parse_qsl(fragment, keep_blank_values=True)
    if pairs:
        return any(_is_secret_url_key(key) for key, _ in pairs)
    lowered = fragment.lower()
    return any(
        marker in lowered for marker in ("credential", "password", "secret", "signature", "token")
    )


def _url_has_credentials(value: Any) -> bool:
    if not isinstance(value, str) or "://" not in value:
        return False
    try:
        parts = urlsplit(value)
    except ValueError:
        return False
    return bool(
        parts.username
        or parts.password
        or _fragment_has_credentials(parts.fragment)
        or any(_is_secret_url_key(key) for key, _ in parse_qsl(parts.query, keep_blank_values=True))
    )


def _mask_url(value: str) -> str:
    if not _url_has_credentials(value):
        return value
    parts = urlsplit(value)
    host = parts.hostname or ""
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    if parts.port:
        host = f"{host}:{parts.port}"
    if parts.username:
        host = f"{parts.username}:{MASK}@{host}"
    query = [
        (key, MASK if _is_secret_url_key(key) else item)
        for key, item in parse_qsl(parts.query, keep_blank_values=True)
    ]
    return urlunsplit((parts.scheme, host, parts.path, urlencode(query), ""))


def mask_secrets(value: Any) -> Any:
    """Return a detached copy with values under secret-looking keys masked."""
    if isinstance(value, dict):
        return {
            key: MASK if is_secret_name(str(key)) and item not in (None, "") else mask_secrets(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [mask_secrets(item) for item in value]
    if isinstance(value, tuple):
        return tuple(mask_secrets(item) for item in value)
    if isinstance(value, str):
        return _mask_url(value)
    return deepcopy(value)


def contains_secret_values(value: Any) -> bool:
    if isinstance(value, dict):
        return any(
            (is_secret_name(str(key)) and item not in (None, "", MASK))
            or _url_has_credentials(str(key))
            or contains_secret_values(item)
            for key, item in value.items()
        )
    if isinstance(value, (list, tuple)):
        return any(contains_secret_values(item) for item in value)
    return _url_has_credentials(value)


class Settings(BaseSettings):
    """Process-only settings. Credential values never enter the Source table."""

    model_config = SettingsConfigDict(env_prefix="MERITUS_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://meritus@localhost:5432/meritus"
    opensearch_url: str = "http://localhost:9200"
    data_dir: Path = Path("data")
    demo_mode: bool = False
    companies_house_api_key: SecretStr | None = None
    companies_house_stream_key: SecretStr | None = None
    adzuna_app_id: SecretStr | None = None
    adzuna_app_key: SecretStr | None = None
    rns_user: SecretStr | None = None
    rns_access_key: SecretStr | None = None
    rns_base_url: str | None = None
    hmcts_receiver_token: SecretStr | None = None
    organisational_contact: str | None = None
    api_allowed_hosts: list[str] = ["localhost", "127.0.0.1", "[::1]", "testserver"]
    api_allowed_origins: list[str] = [
        "http://localhost",
        "http://127.0.0.1",
        "http://testserver",
    ]
    api_setup_trusted_proxies: list[str] = []
    api_cookie_secure: bool = False
    api_session_cookie_name: str = "meritus_session"
    api_static_dir: Path | None = None
    portal_bridge_secret: SecretStr | None = None
    portal_bridge_required: bool = False

    @field_validator("portal_bridge_secret")
    @classmethod
    def bridge_secret_length(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and len(value.get_secret_value()) < 32:
            raise ValueError("The portal bridge secret must contain at least 32 characters")
        return value

    @model_validator(mode="after")
    def bridge_required_configuration(self) -> "Settings":
        if self.portal_bridge_required and self.portal_bridge_secret is None:
            raise ValueError("A portal bridge secret is required in Directors Workspace mode")
        return self

    def masked(self) -> dict[str, Any]:
        return mask_secrets(self.model_dump(mode="json"))
