"""Base protocol and shared types for AI engine implementations."""

from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Protocol, runtime_checkable


class EngineType(StrEnum):
    ANTHROPIC = "anthropic"
    OLLAMA = "ollama"


@dataclass
class EngineStatus:
    available: bool
    models: list[str]
    error: str | None = None


@runtime_checkable
class AIEngine(Protocol):
    """Unified interface for all AI engine backends."""

    async def complete(
        self,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 512,
        output_schema: dict[str, Any] | None = None,
    ) -> str:
        """Send a completion request and return raw text response.

        When output_schema is given, the engine enforces it server-side
        (AI-5: structured outputs), so the returned text is valid JSON
        matching the schema — no code-fence parsing needed.
        """
        ...

    async def health(self) -> EngineStatus:
        """Check engine availability and list available models."""
        ...
