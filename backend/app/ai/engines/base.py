"""Base protocol and shared types for AI engine implementations."""

from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol, runtime_checkable


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
    ) -> str:
        """Send a completion request and return raw text response."""
        ...

    async def health(self) -> EngineStatus:
        """Check engine availability and list available models."""
        ...
