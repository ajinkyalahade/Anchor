"""In-process AI call / fallback metrics.

The AI router falls back to canned responses on any provider or parsing
failure. Silent fallbacks were invisible in production (AI-1); this module
makes the fallback rate observable so it can be alerted on. Counters are
process-local (reset on restart) and also mirrored to an OpenTelemetry
counter when telemetry is configured.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field

logger = logging.getLogger("anchor.ai.metrics")

_lock = threading.Lock()


@dataclass
class _TaskCounters:
    calls: int = 0
    fallbacks: int = 0


@dataclass
class _Registry:
    by_task: dict[str, _TaskCounters] = field(default_factory=dict)
    # Rolling window of recent outcomes (True = fallback) for alerting, plus the
    # last time we alerted so we can honor the cooldown. Sized to the default
    # window; _maybe_alert resizes lazily if the config differs.
    recent: deque[bool] = field(default_factory=lambda: deque(maxlen=20))
    last_alert_at: float = 0.0

    def _get(self, task: str) -> _TaskCounters:
        return self.by_task.setdefault(task, _TaskCounters())


_registry = _Registry()


def record_call(task: str, engine: str, *, fallback: bool) -> None:
    """Record one AI dispatch; set fallback=True when the canned response was
    returned instead of a real model result."""
    with _lock:
        counters = _registry._get(task)
        counters.calls += 1
        if fallback:
            counters.fallbacks += 1
        _registry.recent.append(fallback)

    # Mirror to OpenTelemetry if a metrics pipeline is configured.
    try:
        from opentelemetry import metrics

        meter = metrics.get_meter("anchor.ai")
        meter.create_counter("ai.calls").add(1, {"task": task, "engine": engine})
        if fallback:
            meter.create_counter("ai.fallbacks").add(1, {"task": task, "engine": engine})
    except Exception:
        pass

    if fallback:
        _maybe_alert(engine)


def _maybe_alert(engine: str) -> None:
    """Emit an ERROR log + Sentry message when the recent fallback rate crosses
    the configured threshold. Cooldown-limited so an outage alerts once, not on
    every request. All failures here are swallowed — alerting must never break
    an AI call."""
    try:
        from app.core.config import get_settings

        settings = get_settings()
        window = max(1, settings.ai_fallback_alert_window)
        threshold = settings.ai_fallback_alert_threshold
        cooldown = settings.ai_fallback_alert_cooldown_seconds

        now = time.monotonic()
        with _lock:
            # Resize the rolling window lazily if the setting changed.
            if _registry.recent.maxlen != window:
                _registry.recent = deque(_registry.recent, maxlen=window)
            samples = list(_registry.recent)
            if len(samples) < window:
                return  # not enough signal yet
            rate = sum(samples) / len(samples)
            if rate < threshold or (now - _registry.last_alert_at) < cooldown:
                return
            _registry.last_alert_at = now
    except Exception:
        return

    message = (
        f"AI fallback-rate alert: {rate:.0%} of the last {window} AI calls fell "
        f"back to canned responses (engine={engine}, threshold={threshold:.0%}). "
        "The AI provider may be down or returning unparseable output."
    )
    logger.error(message)
    try:
        from app.core.observability import capture_message

        capture_message(message, level="error")
    except Exception:
        pass


def snapshot() -> dict[str, object]:
    """Return a JSON-friendly snapshot of call/fallback counts and rates."""
    with _lock:
        tasks = {
            task: {
                "calls": c.calls,
                "fallbacks": c.fallbacks,
                "fallback_rate": round(c.fallbacks / c.calls, 4) if c.calls else 0.0,
            }
            for task, c in _registry.by_task.items()
        }
    total_calls = sum(t["calls"] for t in tasks.values())
    total_fallbacks = sum(t["fallbacks"] for t in tasks.values())
    return {
        "tasks": tasks,
        "total_calls": total_calls,
        "total_fallbacks": total_fallbacks,
        "overall_fallback_rate": (
            round(total_fallbacks / total_calls, 4) if total_calls else 0.0
        ),
    }


def reset() -> None:
    """Clear all counters (used by tests)."""
    with _lock:
        _registry.by_task.clear()
        _registry.recent.clear()
        _registry.last_alert_at = 0.0
