"""AI Router — provider-agnostic dispatch with fallback and latency logging (1F.1)."""

import json
import logging
import time
from dataclasses import dataclass, field
from enum import StrEnum
from typing import TYPE_CHECKING, Any, cast

if TYPE_CHECKING:
    from app.ai.engines.anthropic_engine import AnthropicEngine
    from app.ai.engines.ollama_engine import OllamaEngine

from anthropic import AsyncAnthropic

from app.core.config import get_settings
from app.core.input_safety import sanitize_prompt_payload

logger = logging.getLogger(__name__)

# Keep a bare Anthropic client available for the legacy streaming endpoint
anthropic_client = (
    AsyncAnthropic(api_key=get_settings().anthropic_api_key)
    if get_settings().anthropic_api_key
    else None
)


@dataclass
class PromptContext:
    """Enriched user context injected into AI prompts for personalization."""

    user_state: dict[str, Any] = field(default_factory=dict)
    relevant_memories: list[str] = field(default_factory=list)
    recent_session_summaries: list[str] = field(default_factory=list)
    time_of_day: str = ""
    streak_state: str = ""

    def to_system_block(self) -> str:
        has_context = any([
            self.user_state,
            self.relevant_memories,
            self.recent_session_summaries,
            self.streak_state,
        ])
        if not has_context:
            return ""
        lines: list[str] = ["", "[User Context]"]
        if self.user_state:
            energy = self.user_state.get("energy_level", "?")
            load = self.user_state.get("emotional_load", "?")
            freshness = self.user_state.get("cognitive_freshness", "?")
            lines.append(
                f"Energy: {energy}/5 | Emotional load: {load}/5"
                f" | Cognitive freshness: {freshness}/5"
            )
            if self.streak_state:
                lines.append(f"Streak state: {self.streak_state}")
            if self.time_of_day:
                lines.append(f"Time context: {self.time_of_day}")
        if self.recent_session_summaries:
            lines.append("Recent coaching sessions:")
            for s in self.recent_session_summaries[:3]:
                lines.append(f"  - {s}")
        if self.relevant_memories:
            lines.append("User's data (use to answer factual questions directly):")
            for m in self.relevant_memories:
                lines.append(f"  - {m}")
        return "\n".join(lines)


class AITask(StrEnum):
    COACH = "coach"
    DECOMPOSE = "decompose"
    EVALUATE_WORD = "evaluate_word"
    RSD_RESPONSE = "rsd_response"
    INSIGHT_WEEKLY = "insight_weekly"
    QUEST_WEEKLY = "quest_weekly"
    CLASSIFY_GAME_SESSION = "classify_game_session"
    DAILY_BRIEFING = "daily_briefing"
    NUDGE = "nudge"


class AIProvider(StrEnum):
    CLAUDE = "claude"


ROUTING_TABLE: dict[AITask, AIProvider] = {
    AITask.DECOMPOSE: AIProvider.CLAUDE,
    AITask.COACH: AIProvider.CLAUDE,
    AITask.EVALUATE_WORD: AIProvider.CLAUDE,
    AITask.RSD_RESPONSE: AIProvider.CLAUDE,
    AITask.INSIGHT_WEEKLY: AIProvider.CLAUDE,
    AITask.QUEST_WEEKLY: AIProvider.CLAUDE,
    AITask.CLASSIFY_GAME_SESSION: AIProvider.CLAUDE,
    AITask.DAILY_BRIEFING: AIProvider.CLAUDE,
    AITask.NUDGE: AIProvider.CLAUDE,
}

_FALLBACKS: dict[AITask, dict[str, Any]] = {
    AITask.DECOMPOSE: {
        "steps": [
            {"label": "Open the file or app", "est_minutes": 1, "first": True},
            {"label": "Do the first obvious part", "est_minutes": 10, "first": False},
            {"label": "Wrap up and save", "est_minutes": 4, "first": False},
        ],
        "why_first_step_matters": "Starting is the hardest part. Just open it.",
    },
    AITask.COACH: {
        "opening": "I'm here. What's going on right now?",
        "reflection": None,
        "next_steps": [],
    },
    AITask.EVALUATE_WORD: {"valid": True, "score": 3, "reason": "Looks connected"},
    AITask.RSD_RESPONSE: {
        "validation": "I hear you. That hurts.",
        "normalization": "RSD makes everything feel louder. Your reaction is real.",
        "reframe": None,
    },
    AITask.INSIGHT_WEEKLY: {
        "title": "Weekly pattern read",
        "summary": (
            "Your strongest work still lands earlier in the day."
            " Protect the first clean block before urgency starts grabbing the wheel."
        ),
        "bullets": [
            "Morning focus is outperforming late-day sessions.",
            "20-25 minute blocks are giving you the best return.",
            "Keep the next week simple: one protected first block.",
        ],
        "delivery_label": "Sunday, 9:00 AM",
    },
    AITask.QUEST_WEEKLY: {
        "title": "What is actually shifting your state",
        "summary": "Short physical resets are helping most when activation is flat.",
        "recommendation": "Start with Dance break when energy is low and stuck.",
    },
    AITask.CLASSIFY_GAME_SESSION: {
        "state": "focused",
        "confidence": 0.5,
        "next_game": "echo",
        "reason": "Default suggestion — keep building.",
    },
    AITask.NUDGE: {
        "title": "One step when ready",
        "body": "Anchor is here whenever you want to move something forward.",
    },
    AITask.DAILY_BRIEFING: {
        "greeting": "Good to see you.",
        "energy_read": "Your state looks steady — a good time to pick one thing.",
        "suggested_first_action": "Open your task list and pick the smallest next step.",
        "affirmation": "One step is enough.",
    },
}


# ── Engine resolution ─────────────────────────────────────────────────────────

def get_engine(task: str = "", engine_pref: str = "") -> "AnthropicEngine | OllamaEngine":
    """Return the right engine for (task, engine_pref).

    engine_pref: 'anthropic' | 'ollama' | 'auto' | '' (uses settings default)
    'auto' tries Ollama health check at call time; falls back to Anthropic.
    """
    from app.ai.engines.anthropic_engine import AnthropicEngine
    from app.ai.engines.ollama_engine import OllamaEngine

    settings = get_settings()
    pref = engine_pref or settings.ai_default_engine

    if pref == "ollama":
        return OllamaEngine(
            base_url=settings.ollama_base_url,
            task=task,
            fast_model=settings.ollama_fast_model,
            reasoning_model=settings.ollama_reasoning_model,
        )
    return AnthropicEngine(api_key=settings.anthropic_api_key, task=task)


async def _resolve_engine(
    task: str, engine_pref: str = ""
) -> "AnthropicEngine | OllamaEngine":
    """Resolve engine with 'auto' fallback logic."""
    settings = get_settings()
    pref = engine_pref or settings.ai_default_engine
    if pref != "auto":
        return get_engine(task, pref)

    from app.ai.engines.ollama_engine import OllamaEngine
    ollama = OllamaEngine(base_url=settings.ollama_base_url, task=task,
                          fast_model=settings.ollama_fast_model,
                          reasoning_model=settings.ollama_reasoning_model)
    status = await ollama.health()
    if status.available:
        return ollama
    return get_engine(task, "anthropic")


# ── Public route() entrypoint ─────────────────────────────────────────────────

async def route(
    task: AITask,
    payload: dict[str, Any],
    context: PromptContext | None = None,
    engine_pref: str = "",
) -> dict[str, Any]:
    """Dispatch an AI task to the correct engine with automatic fallback."""
    start = time.monotonic()
    payload = sanitize_prompt_payload(payload)
    engine = await _resolve_engine(task.value, engine_pref)
    engine_name = type(engine).__name__

    from app.ai.metrics import record_call

    try:
        from app.core.telemetry import get_tracer
        tracer = get_tracer()
        with tracer.start_as_current_span(f"ai.{task.value}"):
            result = await _dispatch(task, payload, context, engine)
        _log("ai_call", task, engine_name, start)
        record_call(task.value, engine_name, fallback=False)
        return result
    except Exception as exc:
        _log("ai_fallback", task, engine_name, start, error=str(exc))
        record_call(task.value, engine_name, fallback=True)
        return dict(_FALLBACKS[task])


# ── Dispatch ──────────────────────────────────────────────────────────────────

async def _dispatch(
    task: AITask,
    payload: dict[str, Any],
    context: PromptContext | None,
    engine: Any,
) -> dict[str, Any]:
    if task == AITask.DECOMPOSE:
        return await _run_decompose(payload["task_text"], context, engine)
    if task == AITask.COACH:
        return await _run_coach(payload["message"], payload.get("history", []), context, engine)
    if task == AITask.EVALUATE_WORD:
        return await _run_evaluate_word(payload["base_word"], payload["user_word"], engine)
    if task == AITask.RSD_RESPONSE:
        return await _run_rsd(payload["trigger_text"], payload["intensity"], context, engine)
    if task == AITask.INSIGHT_WEEKLY:
        return await _run_insight_weekly(payload, engine)
    if task == AITask.QUEST_WEEKLY:
        return await _run_quest_weekly(payload, engine)
    if task == AITask.CLASSIFY_GAME_SESSION:
        return await _run_classify_game(
            payload["rt_mean"], payload["rt_var"], payload["accuracy"], payload["game_key"], engine
        )
    if task == AITask.DAILY_BRIEFING:
        return await _run_daily_briefing(payload, context, engine)
    if task == AITask.NUDGE:
        return await _run_nudge(payload, engine)
    raise ValueError(f"Unknown task: {task}")


def _log(
    event: str, task: AITask, engine_name: str, start: float, error: str | None = None
) -> None:
    latency_ms = int((time.monotonic() - start) * 1000)
    if error:
        logger.warning(
            "%s task=%s engine=%s latency_ms=%d error=%s",
            event, task.value, engine_name, latency_ms, error,
        )
    else:
        logger.info(
            "%s task=%s engine=%s latency_ms=%d", event, task.value, engine_name, latency_ms
        )
    try:
        from opentelemetry import trace
        span = trace.get_current_span()
        if span.is_recording():
            span.set_attribute("ai.task", task.value)
            span.set_attribute("ai.engine", engine_name)
            span.set_attribute("ai.latency_ms", latency_ms)
            if error:
                span.set_attribute("ai.error", error)
    except Exception:
        pass


# ── Task implementations (engine-agnostic) ────────────────────────────────────

def _parse_json(text: str) -> dict[str, Any]:
    """Extract JSON from text, handling markdown code fences."""
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return cast(dict[str, Any], json.loads(text.strip()))


async def _run_decompose(
    task_text: str, context: PromptContext | None, engine: Any
) -> dict[str, Any]:
    from app.ai.prompts.decompose import DECOMPOSE_PROMPT_SYSTEM
    from app.ai.prompts.registry import DECOMPOSE_SPEC, validate_output

    context_block = context.to_system_block() if context else ""
    text = await engine.complete(
        system=DECOMPOSE_PROMPT_SYSTEM + context_block,
        messages=[{
            "role": "user",
            "content": f"Task: {task_text}\n\nRespond with strictly valid JSON.",
        }],
        max_tokens=1024,
    )
    result = _parse_json(text)
    return result if validate_output(DECOMPOSE_SPEC, result) else dict(_FALLBACKS[AITask.DECOMPOSE])


async def _run_coach(
    message: str,
    history: list[dict[str, str]] | None,
    context: PromptContext | None,
    engine: Any,
) -> dict[str, Any]:
    from app.ai.prompts.coach import COACH_SYSTEM_PROMPT

    context_block = context.to_system_block() if context else ""
    messages: list[dict[str, str]] = list(history or [])
    messages.append({"role": "user", "content": message})
    text = await engine.complete(
        system=COACH_SYSTEM_PROMPT + context_block,
        messages=messages,
        max_tokens=512,
    )
    try:
        result = _parse_json(text)
        # Accept new schema {"message", "has_steps", "steps"} or old {"opening", ...}
        if "message" in result:
            return {
                "opening": result["message"],
                "reflection": None,
                "next_steps": result.get("steps", []) if result.get("has_steps") else [],
            }
        if "opening" in result:
            return result
    except Exception:
        pass
    # Plain text fallback — model returned prose instead of JSON
    if text.strip():
        return {"opening": text.strip(), "reflection": None, "next_steps": []}
    return dict(_FALLBACKS[AITask.COACH])


async def _run_evaluate_word(base_word: str, user_word: str, engine: Any) -> dict[str, Any]:
    from app.ai.prompts.registry import WORDGYM_SPEC, validate_output
    from app.ai.prompts.wordgym import WORDGYM_SYSTEM_PROMPT

    text = await engine.complete(
        system=WORDGYM_SYSTEM_PROMPT + "\nRespond ONLY with valid JSON.",
        messages=[{"role": "user", "content": f"Base word: {base_word}\nUser word: {user_word}"}],
        max_tokens=128,
    )
    result = _parse_json(text)
    if validate_output(WORDGYM_SPEC, result):
        return result
    return dict(_FALLBACKS[AITask.EVALUATE_WORD])


async def _run_rsd(
    trigger_text: str, intensity: int, context: PromptContext | None, engine: Any
) -> dict[str, Any]:
    from app.ai.prompts.registry import RSD_SPEC, validate_output
    from app.ai.prompts.rsd import RSD_SYSTEM_PROMPT

    context_block = context.to_system_block() if context else ""
    text = await engine.complete(
        system=RSD_SYSTEM_PROMPT + context_block,
        messages=[{
            "role": "user",
            "content": (
                f"Intensity: {intensity}/10\nTrigger: {trigger_text}"
                "\n\nRespond with strictly valid JSON."
            ),
        }],
        max_tokens=256,
    )
    result = _parse_json(text)
    return result if validate_output(RSD_SPEC, result) else dict(_FALLBACKS[AITask.RSD_RESPONSE])


async def _run_insight_weekly(payload: dict[str, Any], engine: Any) -> dict[str, Any]:
    from app.ai.prompts.insight_weekly import INSIGHT_WEEKLY_SYSTEM_PROMPT
    from app.ai.prompts.registry import INSIGHT_WEEKLY_SPEC, validate_output

    text = await engine.complete(
        system=INSIGHT_WEEKLY_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": json.dumps(payload)}],
        max_tokens=384,
    )
    result = _parse_json(text)
    if validate_output(INSIGHT_WEEKLY_SPEC, result):
        return result
    return dict(_FALLBACKS[AITask.INSIGHT_WEEKLY])


async def _run_quest_weekly(payload: dict[str, Any], engine: Any) -> dict[str, Any]:
    from app.ai.prompts.quest_weekly import QUEST_WEEKLY_SYSTEM_PROMPT
    from app.ai.prompts.registry import QUEST_WEEKLY_SPEC, validate_output

    text = await engine.complete(
        system=QUEST_WEEKLY_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": json.dumps(payload)}],
        max_tokens=256,
    )
    result = _parse_json(text)
    if validate_output(QUEST_WEEKLY_SPEC, result):
        return result
    return dict(_FALLBACKS[AITask.QUEST_WEEKLY])


async def _run_classify_game(
    rt_mean: int, rt_var: int, accuracy: int, game_key: str, engine: Any
) -> dict[str, Any]:
    from app.ai.prompts.classify_game import CLASSIFY_GAME_SYSTEM_PROMPT
    from app.ai.prompts.registry import CLASSIFY_GAME_SESSION_SPEC, validate_output

    text = await engine.complete(
        system=CLASSIFY_GAME_SYSTEM_PROMPT + "\nRespond ONLY with valid JSON.",
        messages=[{
            "role": "user",
            "content": (
                f"rt_mean={rt_mean}ms, rt_var={rt_var}ms,"
                f" accuracy={accuracy}%, game={game_key}"
            ),
        }],
        max_tokens=128,
    )
    result = _parse_json(text)
    if validate_output(CLASSIFY_GAME_SESSION_SPEC, result):
        return result
    return dict(_FALLBACKS[AITask.CLASSIFY_GAME_SESSION])


async def _run_daily_briefing(
    payload: dict[str, Any], context: PromptContext | None, engine: Any
) -> dict[str, Any]:
    from app.ai.prompts.briefing import BRIEFING_SYSTEM_PROMPT

    context_block = context.to_system_block() if context else ""
    text = await engine.complete(
        system=BRIEFING_SYSTEM_PROMPT + context_block,
        messages=[{"role": "user", "content": json.dumps(payload)}],
        max_tokens=256,
    )
    result = _parse_json(text)
    required = {"greeting", "energy_read", "suggested_first_action", "affirmation"}
    return result if required.issubset(result) else dict(_FALLBACKS[AITask.DAILY_BRIEFING])


async def _run_nudge(payload: dict[str, Any], engine: Any) -> dict[str, Any]:
    from app.ai.prompts.nudge import NUDGE_SYSTEM_PROMPT

    text = await engine.complete(
        system=NUDGE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": json.dumps(payload)}],
        max_tokens=128,
    )
    result = _parse_json(text)
    return result if {"title", "body"}.issubset(result) else dict(_FALLBACKS[AITask.NUDGE])


# ── Engine status ─────────────────────────────────────────────────────────────

async def get_engines_status() -> dict[str, Any]:
    import asyncio

    from app.ai.engines.anthropic_engine import AnthropicEngine
    from app.ai.engines.ollama_engine import OllamaEngine
    settings = get_settings()
    anthropic = AnthropicEngine(api_key=settings.anthropic_api_key)
    ollama = OllamaEngine(base_url=settings.ollama_base_url)
    a_status, o_status = await asyncio.gather(anthropic.health(), ollama.health())
    return {
        "anthropic": {"available": a_status.available, "models": a_status.models},
        "ollama": {"available": o_status.available, "models": o_status.models},
    }


# ── Backward-compatible wrappers ──────────────────────────────────────────────

async def decompose_task_with_claude(
    task_text: str, schema: dict[str, Any], system_prompt: str
) -> dict[str, Any]:
    return await route(AITask.DECOMPOSE, {"task_text": task_text})


async def evaluate_word_association(base_word: str, user_word: str) -> dict[str, Any]:
    return await route(AITask.EVALUATE_WORD, {"base_word": base_word, "user_word": user_word})


async def rsd_response_with_claude(trigger_text: str, intensity: int) -> dict[str, Any]:
    return await route(AITask.RSD_RESPONSE, {"trigger_text": trigger_text, "intensity": intensity})
