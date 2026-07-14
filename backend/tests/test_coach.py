"""Tests for the deeper coach surface."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.ai.prompts.registry import COACH_SPEC, validate_output
from app.main import app
from tests.helpers import register_test_user


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
    fallback = {
        "opening": "I'm here. What's going on right now?",
        "reflection": None,
        "next_steps": [],
    }
    with patch("app.api.ai.route", new=AsyncMock(return_value=fallback)):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            _, headers = await register_test_user(client)
            response = await client.post(
                "/v1/ai/coach",
                json={"message": "I know what to do but I cannot start."},
                headers=headers,
            )

    assert response.status_code == 200
    data = response.json()
    assert data["opening"]
    assert data["session_id"]
    assert data["next_steps"] == []


@pytest.mark.asyncio
async def test_coach_endpoint_uses_crisis_branch_when_needed() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        _, headers = await register_test_user(client)
        response = await client.post(
            "/v1/ai/coach",
            json={"message": "I want to die."},
            headers=headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["is_crisis"] is True
    assert data["resources"]


@pytest.mark.asyncio
async def test_coach_messages_are_encrypted_at_rest() -> None:
    """DATA-2: conversation content must not be readable in the database."""
    import uuid as uuid_mod

    from sqlalchemy import select

    from app.core.encryption import decrypt_text
    from app.db.database import async_session_factory
    from app.db.models import CoachingMessage

    plaintext = "I feel overwhelmed by everything today"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        _, headers = await register_test_user(client)
        response = await client.post(
            "/v1/ai/coach", json={"message": plaintext}, headers=headers
        )
    assert response.status_code == 200
    session_id = uuid_mod.UUID(response.json()["session_id"])

    async with async_session_factory() as db:
        rows = await db.execute(
            select(CoachingMessage).where(CoachingMessage.session_id == session_id)
        )
        messages = rows.scalars().all()
        assert messages, "expected the user message to be stored"
        user_msg = next(m for m in messages if m.role == "user")
        assert plaintext not in user_msg.content  # ciphertext, not plaintext
        assert decrypt_text(user_msg.content) == plaintext
