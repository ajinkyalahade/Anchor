"""Tests for production configuration validation (SEC-3)."""

import base64
import os

import pytest
from pydantic import ValidationError

from app.core.config import Settings

STRONG_SECRET = "x" * 48
VALID_KEY = base64.b64encode(os.urandom(32)).decode()

PRODUCTION_KWARGS = {
    "app_env": "production",
    "app_debug": False,
    "jwt_secret": STRONG_SECRET,
    "magic_link_secret": STRONG_SECRET,
    "field_encryption_key": VALID_KEY,
}


def test_development_defaults_are_allowed() -> None:
    settings = Settings(app_env="development")
    assert settings.app_env == "development"


def test_valid_production_config_is_allowed() -> None:
    settings = Settings(**PRODUCTION_KWARGS)
    assert settings.app_env == "production"


@pytest.mark.parametrize(
    "override",
    [
        {"app_debug": True},
        {"jwt_secret": "change-me-in-production"},
        {"jwt_secret": "short"},
        {"magic_link_secret": "change-me-in-production"},
        {"field_encryption_key": ""},
        {"field_encryption_key": "not-base64!!"},
        {"field_encryption_key": base64.b64encode(b"\x00" * 32).decode()},
        {"field_encryption_key": base64.b64encode(os.urandom(16)).decode()},
    ],
)
def test_insecure_production_config_is_rejected(override: dict) -> None:
    kwargs = {**PRODUCTION_KWARGS, **override}
    with pytest.raises(ValidationError, match="insecure production configuration"):
        Settings(**kwargs)


def test_encryption_refuses_zero_key_fallback_in_production(monkeypatch) -> None:
    from app.core import encryption

    class FakeSettings:
        field_encryption_key = ""
        app_env = "production"

    encryption._get_key.cache_clear()
    monkeypatch.setattr(encryption, "get_settings", lambda: FakeSettings())
    try:
        with pytest.raises(RuntimeError, match="FIELD_ENCRYPTION_KEY"):
            encryption._get_key()
    finally:
        encryption._get_key.cache_clear()


def test_encryption_roundtrip_with_dev_fallback_key() -> None:
    from app.core.encryption import decrypt_text, encrypt_text

    assert decrypt_text(encrypt_text("hello")) == "hello"


def test_database_url_scheme_is_normalized_for_paas() -> None:
    """Render/Heroku hand out postgres:// URLs; the app must accept them."""
    from app.core.config import Settings

    for given in (
        "postgres://u:p@host:5432/db",
        "postgresql://u:p@host:5432/db",
        "postgresql+asyncpg://u:p@host:5432/db",
    ):
        settings = Settings(database_url=given)
        assert settings.database_url == "postgresql+asyncpg://u:p@host:5432/db"
