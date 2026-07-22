"""Tests for AI fallback observability (AI-1)."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.ai import metrics
from app.ai.router import AITask, route
from app.main import app


@pytest.fixture(autouse=True)
def _reset_metrics():
    metrics.reset()
    yield
    metrics.reset()


def test_record_call_tracks_calls_and_fallbacks() -> None:
    metrics.record_call("decompose", "OllamaEngine", fallback=False)
    metrics.record_call("decompose", "OllamaEngine", fallback=True)
    metrics.record_call("coach", "AnthropicEngine", fallback=True)

    snap = metrics.snapshot()
    assert snap["total_calls"] == 3
    assert snap["total_fallbacks"] == 2
    assert snap["tasks"]["decompose"]["fallback_rate"] == 0.5
    assert snap["tasks"]["coach"]["fallback_rate"] == 1.0
    assert snap["overall_fallback_rate"] == round(2 / 3, 4)


@pytest.mark.asyncio
async def test_route_records_a_fallback_when_no_api_key() -> None:
    # No engine configured in tests → route() falls back and must count it.
    await route(AITask.DECOMPOSE, {"task_text": "Write a report"})

    snap = metrics.snapshot()
    assert snap["tasks"]["decompose"]["calls"] == 1
    assert snap["tasks"]["decompose"]["fallbacks"] == 1


def test_fallback_alert_fires_once_when_rate_exceeds_threshold(monkeypatch) -> None:
    """AI-1: a run of fallbacks past the threshold emits exactly one alert
    (cooldown suppresses repeats)."""
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "ai_fallback_alert_window", 5, raising=False)
    monkeypatch.setattr(settings, "ai_fallback_alert_threshold", 0.5, raising=False)
    monkeypatch.setattr(settings, "ai_fallback_alert_cooldown_seconds", 300, raising=False)

    alerts: list[str] = []
    monkeypatch.setattr(
        "app.core.observability.capture_message",
        lambda msg, level="error": alerts.append(msg),
    )

    # 5 straight fallbacks → 100% over the window → one alert.
    for _ in range(5):
        metrics.record_call("coach", "AnthropicEngine", fallback=True)
    assert len(alerts) == 1
    assert "fallback-rate alert" in alerts[0]

    # More fallbacks within the cooldown must NOT re-alert.
    for _ in range(5):
        metrics.record_call("coach", "AnthropicEngine", fallback=True)
    assert len(alerts) == 1


def test_no_alert_below_threshold(monkeypatch) -> None:
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "ai_fallback_alert_window", 5, raising=False)
    monkeypatch.setattr(settings, "ai_fallback_alert_threshold", 0.9, raising=False)

    alerts: list[str] = []
    monkeypatch.setattr(
        "app.core.observability.capture_message",
        lambda msg, level="error": alerts.append(msg),
    )

    # 3 fallbacks + 2 successes = 60% < 90% threshold → no alert.
    for fb in (True, False, True, False, True):
        metrics.record_call("coach", "AnthropicEngine", fallback=fb)
    assert alerts == []


@pytest.mark.asyncio
async def test_ai_metrics_endpoint_is_unauthenticated_and_reports() -> None:
    metrics.record_call("nudge", "OllamaEngine", fallback=True)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # No Authorization header — endpoint must be scrapeable.
        resp = await client.get("/v1/metrics/ai")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total_fallbacks"] >= 1
    assert "nudge" in body["tasks"]
