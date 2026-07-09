"""Tests for focus endpoints."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.helpers import auth_headers_for


@pytest.mark.asyncio
async def test_decompose_endpoint_returns_steps() -> None:
    user_id = uuid.uuid4()
    transport = ASGITransport(app=app)

    with patch("app.api.focus.decompose_task_with_claude", new=AsyncMock()) as mock_decompose:
        mock_decompose.return_value = {
            "steps": [{"label": "Open the document", "est_minutes": 1, "first": True}],
            "why_first_step_matters": "Opening counts as starting.",
        }
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/focus/decompose",
                json={"task_text": "Write the outline"},
                headers=auth_headers_for(user_id),
            )

    assert response.status_code == 200
    assert response.json()["steps"][0]["label"] == "Open the document"


@pytest.mark.asyncio
async def test_decompose_endpoint_rejects_empty_task_text() -> None:
    user_id = uuid.uuid4()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/focus/decompose",
            json={"task_text": ""},
            headers=auth_headers_for(user_id),
        )

    assert response.status_code == 422
