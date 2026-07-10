"""In-process AI call / fallback metrics.

The AI router falls back to canned responses on any provider or parsing
failure. Silent fallbacks were invisible in production (AI-1); this module
makes the fallback rate observable so it can be alerted on. Counters are
process-local (reset on restart) and also mirrored to an OpenTelemetry
counter when telemetry is configured.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field

_lock = threading.Lock()


@dataclass
class _TaskCounters:
    calls: int = 0
    fallbacks: int = 0


@dataclass
class _Registry:
    by_task: dict[str, _TaskCounters] = field(default_factory=dict)

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

    # Mirror to OpenTelemetry if a metrics pipeline is configured.
    try:
        from opentelemetry import metrics

        meter = metrics.get_meter("anchor.ai")
        meter.create_counter("ai.calls").add(1, {"task": task, "engine": engine})
        if fallback:
            meter.create_counter("ai.fallbacks").add(1, {"task": task, "engine": engine})
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
