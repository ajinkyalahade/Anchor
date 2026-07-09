"""Helpers for sanitizing user-controlled text before prompt construction."""

from __future__ import annotations

import re
from typing import Any

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")


def sanitize_prompt_text(value: str) -> str:
    """Normalize prompt-bound text by stripping control chars and trimming edges."""
    normalized = value.replace("\r\n", "\n").replace("\r", "\n")
    normalized = _CONTROL_CHARS_RE.sub("", normalized)
    return normalized.strip()


def sanitize_prompt_payload(value: Any) -> Any:
    """Recursively sanitize strings in prompt payloads before provider dispatch."""
    if isinstance(value, str):
        return sanitize_prompt_text(value)
    if isinstance(value, list):
        return [sanitize_prompt_payload(item) for item in value]
    if isinstance(value, dict):
        return {key: sanitize_prompt_payload(item) for key, item in value.items()}
    return value
