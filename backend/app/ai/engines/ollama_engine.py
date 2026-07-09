"""Ollama (local) engine implementation — uses the official ollama Python SDK."""

import logging

import ollama

from app.ai.engines.base import EngineStatus

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "llama3.2"
REASONING_TASKS = {"coach", "rsd_response", "insight_weekly", "quest_weekly"}


class OllamaEngine:
    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        task: str = "",
        fast_model: str = "",
        reasoning_model: str = "",
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = (
            (reasoning_model or _DEFAULT_MODEL)
            if task in REASONING_TASKS
            else (fast_model or _DEFAULT_MODEL)
        )
        self._client = ollama.AsyncClient(host=self._base_url)

    async def complete(
        self,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 512,
    ) -> str:
        ollama_messages = [{"role": "system", "content": system}, *messages]
        response = await self._client.chat(
            model=self._model,
            messages=ollama_messages,
            think=False,   # disable chain-of-thought tokens (qwen3/deepseek-r1 etc.)
            options={"num_predict": max_tokens, "temperature": 0.2},
        )
        return response.message.content or ""

    async def health(self) -> EngineStatus:
        try:
            client = ollama.AsyncClient(host=self._base_url)
            models_response = await client.list()
            # Exclude cloud-routed or unsupported models
            _EXCLUDE = {"kimi"}
            models = [
                m.model for m in (models_response.models or [])
                if m.model and not any(x in m.model for x in _EXCLUDE)
            ]
            return EngineStatus(available=True, models=models)
        except Exception as exc:
            return EngineStatus(available=False, models=[], error=str(exc))

    @property
    def model(self) -> str:
        return self._model
