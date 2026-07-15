"""Versioned prompt registry with output validators (1F.2)."""

from dataclasses import dataclass
from typing import Any

from app.ai.prompts.classify_game import CLASSIFY_GAME_SYSTEM_PROMPT
from app.ai.prompts.coach import COACH_SYSTEM_PROMPT
from app.ai.prompts.decompose import DECOMPOSE_PROMPT_SYSTEM
from app.ai.prompts.insight_weekly import INSIGHT_WEEKLY_SYSTEM_PROMPT
from app.ai.prompts.quest_weekly import QUEST_WEEKLY_SYSTEM_PROMPT
from app.ai.prompts.rsd import RSD_SYSTEM_PROMPT
from app.ai.prompts.wordgym import WORDGYM_SYSTEM_PROMPT


@dataclass(frozen=True)
class PromptSpec:
    id: str                        # e.g. "decompose@v1"
    version: int
    system_prompt: str
    required_keys: frozenset[str]  # top-level keys that must exist in output
    # JSON schema for structured outputs (AI-5). When set, engines enforce it
    # server-side and the model cannot return malformed JSON. None for
    # conversational tasks that deliberately allow prose (coach).
    output_schema: dict[str, Any] | None = None


def validate_output(spec: PromptSpec, output: dict[str, Any]) -> bool:
    """Return True if output contains all required top-level keys."""
    return all(k in output for k in spec.required_keys)


def _obj(properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    """Object schema in the shape structured outputs demands:
    additionalProperties false and every listed key required."""
    return {
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": False,
    }


_STR = {"type": "string"}
_INT = {"type": "integer"}
_NUM = {"type": "number"}
_BOOL = {"type": "boolean"}


DECOMPOSE_SPEC = PromptSpec(
    id="decompose@v1",
    version=1,
    system_prompt=DECOMPOSE_PROMPT_SYSTEM,
    required_keys=frozenset({"steps", "why_first_step_matters"}),
    output_schema=_obj(
        {
            "steps": {
                "type": "array",
                "items": _obj(
                    {"label": _STR, "est_minutes": _INT, "first": _BOOL},
                    ["label", "est_minutes", "first"],
                ),
            },
            "why_first_step_matters": _STR,
        },
        ["steps", "why_first_step_matters"],
    ),
)

# Coach deliberately has no output_schema: it accepts two JSON shapes and has
# a graceful plain-prose path (see router._run_coach) — forcing a schema
# would flatten the conversational quality.
COACH_SPEC = PromptSpec(
    id="coach@v1",
    version=1,
    system_prompt=COACH_SYSTEM_PROMPT,
    required_keys=frozenset({"opening", "reflection", "next_steps"}),
)

WORDGYM_SPEC = PromptSpec(
    id="wordgym@v1",
    version=1,
    system_prompt=WORDGYM_SYSTEM_PROMPT,
    required_keys=frozenset({"valid", "score", "reason"}),
    output_schema=_obj(
        {"valid": _BOOL, "score": _INT, "reason": _STR},
        ["valid", "score", "reason"],
    ),
)

RSD_SPEC = PromptSpec(
    id="rsd@v1",
    version=1,
    system_prompt=RSD_SYSTEM_PROMPT,
    required_keys=frozenset({"validation", "normalization"}),
    output_schema=_obj(
        {"validation": _STR, "normalization": _STR, "reframe": _STR},
        ["validation", "normalization", "reframe"],
    ),
)

INSIGHT_WEEKLY_SPEC = PromptSpec(
    id="insight-weekly@v1",
    version=1,
    system_prompt=INSIGHT_WEEKLY_SYSTEM_PROMPT,
    required_keys=frozenset({"title", "summary", "bullets", "delivery_label"}),
    output_schema=_obj(
        {
            "title": _STR,
            "summary": _STR,
            "bullets": {"type": "array", "items": _STR},
            "delivery_label": _STR,
        },
        ["title", "summary", "bullets", "delivery_label"],
    ),
)

QUEST_WEEKLY_SPEC = PromptSpec(
    id="quest-weekly@v1",
    version=1,
    system_prompt=QUEST_WEEKLY_SYSTEM_PROMPT,
    required_keys=frozenset({"title", "summary", "recommendation"}),
    output_schema=_obj(
        {"title": _STR, "summary": _STR, "recommendation": _STR},
        ["title", "summary", "recommendation"],
    ),
)

CLASSIFY_GAME_SESSION_SPEC = PromptSpec(
    id="classify-game-session@v1",
    version=1,
    system_prompt=CLASSIFY_GAME_SYSTEM_PROMPT,
    required_keys=frozenset({"state", "confidence", "next_game", "reason"}),
    output_schema=_obj(
        {"state": _STR, "confidence": _NUM, "next_game": _STR, "reason": _STR},
        ["state", "confidence", "next_game", "reason"],
    ),
)

# Schemas for tasks without a registered PromptSpec (prompts live in router).
BRIEFING_SCHEMA = _obj(
    {
        "greeting": _STR,
        "energy_read": _STR,
        "suggested_first_action": _STR,
        "affirmation": _STR,
    },
    ["greeting", "energy_read", "suggested_first_action", "affirmation"],
)

NUDGE_SCHEMA = _obj({"title": _STR, "body": _STR}, ["title", "body"])

ALL_SPECS: dict[str, PromptSpec] = {
    spec.id: spec
    for spec in (
        COACH_SPEC,
        DECOMPOSE_SPEC,
        WORDGYM_SPEC,
        RSD_SPEC,
        INSIGHT_WEEKLY_SPEC,
        QUEST_WEEKLY_SPEC,
        CLASSIFY_GAME_SESSION_SPEC,
    )
}
