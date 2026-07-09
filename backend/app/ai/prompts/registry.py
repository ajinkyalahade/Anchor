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


def validate_output(spec: PromptSpec, output: dict[str, Any]) -> bool:
    """Return True if output contains all required top-level keys."""
    return all(k in output for k in spec.required_keys)


DECOMPOSE_SPEC = PromptSpec(
    id="decompose@v1",
    version=1,
    system_prompt=DECOMPOSE_PROMPT_SYSTEM,
    required_keys=frozenset({"steps", "why_first_step_matters"}),
)

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
)

RSD_SPEC = PromptSpec(
    id="rsd@v1",
    version=1,
    system_prompt=RSD_SYSTEM_PROMPT,
    required_keys=frozenset({"validation", "normalization"}),
)

INSIGHT_WEEKLY_SPEC = PromptSpec(
    id="insight-weekly@v1",
    version=1,
    system_prompt=INSIGHT_WEEKLY_SYSTEM_PROMPT,
    required_keys=frozenset({"title", "summary", "bullets", "delivery_label"}),
)

QUEST_WEEKLY_SPEC = PromptSpec(
    id="quest-weekly@v1",
    version=1,
    system_prompt=QUEST_WEEKLY_SYSTEM_PROMPT,
    required_keys=frozenset({"title", "summary", "recommendation"}),
)

CLASSIFY_GAME_SESSION_SPEC = PromptSpec(
    id="classify-game-session@v1",
    version=1,
    system_prompt=CLASSIFY_GAME_SYSTEM_PROMPT,
    required_keys=frozenset({"state", "confidence", "next_game", "reason"}),
)

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
