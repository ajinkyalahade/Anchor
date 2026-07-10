"""Anchor backend — core configuration."""

import base64
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings

_INSECURE_SECRETS = {
    "",
    "change-me-in-production",
    "dev-secret-not-for-production",
    "dev-magic-not-for-production",
}
_MIN_SECRET_LENGTH = 32


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    app_env: str = "development"
    app_debug: bool = True

    # Database
    database_url: str = "postgresql+asyncpg://anchor:anchor_dev@localhost:5432/anchor"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # AI Providers
    anthropic_api_key: str = ""

    # Security
    field_encryption_key: str = ""  # base64-encoded 32 bytes; empty = dev zero-key

    # Observability
    otlp_endpoint: str = ""
    otlp_service_name: str = "anchor-backend"
    metrics_enabled: bool = True
    log_level: str = "INFO"
    log_json: bool = True  # structured JSON logs; set false for human-readable dev logs
    sentry_dsn: str = ""  # error tracking; empty = disabled

    # Push notifications (VAPID)
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_contact_email: str = "noreply@anchor.app"

    # Auth
    jwt_secret: str = "change-me-in-production"
    magic_link_secret: str = "change-me-in-production"

    # Email (password reset). Empty smtp_host → console sender (dev).
    email_from: str = "noreply@anchor.app"
    email_from_name: str = "Anchor"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = True
    public_app_url: str = "http://localhost:4173"

    # Ollama (local AI)
    ollama_base_url: str = "http://localhost:11434"
    ollama_fast_model: str = "qwen3.5:2b"
    ollama_reasoning_model: str = "qwen3.5:2b"

    # Default AI engine: "anthropic" | "ollama" | "auto"
    # "auto" tries Ollama first; falls back to Anthropic if unavailable.
    ai_default_engine: str = "anthropic"

    # Live rooms
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    # CORS
    cors_origins: str = "http://localhost:4173,http://127.0.0.1:4173"

    model_config = {"env_file": "../.env", "env_file_encoding": "utf-8"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @model_validator(mode="after")
    def _refuse_insecure_production_config(self) -> "Settings":
        """Fail fast at boot rather than run production traffic on dev secrets."""
        if self.app_env != "production":
            return self

        problems: list[str] = []
        if self.app_debug:
            problems.append("APP_DEBUG must be false in production")
        if self.jwt_secret in _INSECURE_SECRETS or len(self.jwt_secret) < _MIN_SECRET_LENGTH:
            problems.append(
                f"JWT_SECRET must be a strong random value (>= {_MIN_SECRET_LENGTH} chars)"
            )
        if (
            self.magic_link_secret in _INSECURE_SECRETS
            or len(self.magic_link_secret) < _MIN_SECRET_LENGTH
        ):
            problems.append(
                f"MAGIC_LINK_SECRET must be a strong random value (>= {_MIN_SECRET_LENGTH} chars)"
            )
        if not self._has_valid_encryption_key():
            problems.append(
                "FIELD_ENCRYPTION_KEY must be base64-encoded 32 random bytes"
            )

        if problems:
            raise ValueError(
                "Refusing to start with insecure production configuration: "
                + "; ".join(problems)
            )
        return self

    def _has_valid_encryption_key(self) -> bool:
        try:
            key = base64.b64decode(self.field_encryption_key, validate=True)
        except (ValueError, TypeError):
            return False
        return len(key) == 32 and key != b"\x00" * 32


@lru_cache
def get_settings() -> Settings:
    return Settings()
