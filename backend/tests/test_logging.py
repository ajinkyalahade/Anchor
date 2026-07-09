import logging
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.ai.router import AITask, route
from app.main import app


class StubEngine:
    async def complete(self, system: str, messages: list, max_tokens: int = 512) -> str:
        return (
            '{"steps": [{"label": "Open it", "est_minutes": 1, "first": true}],'
            ' "why_first_step_matters": "Starting counts."}'
        )


@pytest.mark.asyncio
async def test_request_logging_emits_structured_json(caplog: pytest.LogCaptureFixture) -> None:
    transport = ASGITransport(app=app)
    with caplog.at_level(logging.INFO, logger="anchor.http"):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/v1/health")

    assert response.status_code == 200
    messages = [record.message for record in caplog.records if record.name == "anchor.http"]
    assert messages
    assert '"event":"http_request"' in messages[-1]
    assert '"path":"/v1/health"' in messages[-1]
    assert '"duration_ms":' in messages[-1]


@pytest.mark.asyncio
async def test_ai_router_logs_latency_and_engine(caplog: pytest.LogCaptureFixture) -> None:
    with (
        caplog.at_level(logging.INFO, logger="app.ai.router"),
        patch("app.ai.router._resolve_engine", new=AsyncMock(return_value=StubEngine())),
    ):
        await route(AITask.DECOMPOSE, {"task_text": "write report"})

    messages = [record.message for record in caplog.records if record.name == "app.ai.router"]
    assert any("ai_call" in message for message in messages)
    assert any("latency_ms=" in message for message in messages)
    assert any("engine=" in message for message in messages)
