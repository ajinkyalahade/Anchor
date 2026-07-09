"""Anchor backend — core configuration."""

from functools import lru_cache

from pydantic_settings import BaseSettings


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

    # Push notifications (VAPID)
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_contact_email: str = "noreply@anchor.app"

    # Auth
    jwt_secret: str = "change-me-in-production"
    magic_link_secret: str = "change-me-in-production"

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
