"""Anthropic (Claude) engine implementation."""

import logging
from typing import Any, cast

from anthropic import AsyncAnthropic
from anthropic.types import MessageParam, TextBlock

from app.ai.engines.base import EngineStatus

logger = logging.getLogger(__name__)

# Task-based model tiers
_HAIKU = "claude-haiku-4-5-20251001"
_SONNET = "claude-sonnet-4-6"

# Tasks that need deeper reasoning get Sonnet; fast tasks get Haiku
REASONING_TASKS = {"coach", "rsd_response", "insight_weekly", "quest_weekly"}


class AnthropicEngine:
    def __init__(self, api_key: str, task: str = "") -> None:
        self._client = AsyncAnthropic(api_key=api_key) if api_key else None
        self._model = _SONNET if task in REASONING_TASKS else _HAIKU

    async def complete(
        self,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 512,
        output_schema: dict[str, Any] | None = None,
    ) -> str:
        if not self._client:
            raise RuntimeError("Anthropic API key not configured")

        kwargs: dict[str, Any] = {}
        if output_schema is not None:
            # Structured outputs (AI-5): the API guarantees the text block is
            # valid JSON matching the schema — replaces fence-splitting.
            kwargs["output_config"] = {
                "format": {"type": "json_schema", "schema": output_schema}
            }

        response = await self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=cast(list[MessageParam], messages),
            **kwargs,
        )
        block = response.content[0]
        return block.text if isinstance(block, TextBlock) else ""

    async def health(self) -> EngineStatus:
        if not self._client:
            return EngineStatus(available=False, models=[], error="API key not set")
        try:
            # Lightweight check — just verify the client is configured
            return EngineStatus(available=True, models=[_HAIKU, _SONNET])
        except Exception as exc:
            return EngineStatus(available=False, models=[], error=str(exc))

    @property
    def model(self) -> str:
        return self._model
