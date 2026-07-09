import logging

import pytest
from httpx import ASGITransport, AsyncClient

from app.ai.router import AITask, route
from app.main import app


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
async def test_ai_router_logs_latency_and_model(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="app.ai.router"):
        await route(AITask.DECOMPOSE, {"task_text": "write report"})

    messages = [record.message for record in caplog.records if record.name == "app.ai.router"]
    assert any("ai_call" in message for message in messages)
    assert any("latency_ms=" in message for message in messages)
    assert any("model=" in message for message in messages)
