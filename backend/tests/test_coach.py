"""Tests for the deeper coach surface."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.ai.prompts.registry import COACH_SPEC, validate_output
from app.main import app
from tests.helpers import auth_headers_for


def test_coach_spec_validates_expected_shape() -> None:
    payload = {
        "opening": "That makes sense.",
        "reflection": "This looks like overload, not a character flaw.",
        "next_steps": ["One", "Two", "Three"],
    }
    assert validate_output(COACH_SPEC, payload) is True


@pytest.mark.asyncio
async def test_coach_endpoint_returns_fallback_shape() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/ai/coach",
            json={"message": "I know what to do but I cannot start."},
            headers=auth_headers_for(uuid.uuid4()),
        )

    assert response.status_code == 200
    data = response.json()
    assert data["opening"]
    assert data["reflection"]
    assert len(data["next_steps"]) == 3


@pytest.mark.asyncio
async def test_coach_endpoint_uses_crisis_branch_when_needed() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/ai/coach",
            json={"message": "I want to die."},
            headers=auth_headers_for(uuid.uuid4()),
        )

    assert response.status_code == 200
    data = response.json()
    assert data["is_crisis"] is True
    assert data["resources"]
