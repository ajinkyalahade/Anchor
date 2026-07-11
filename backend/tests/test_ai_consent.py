"""Consent gating for AI context sharing (DATA-4).

Stored user context (memories, state, session summaries) must only be
injected into AI prompts when the user has explicitly opted in via
consent_flags.share_ai_context — default OFF. These tests run against the
real database because the gate lives inside the context builder's queries.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.ai import _build_prompt_context
from app.db.database import async_session_factory
from app.main import app
from tests.helpers import register_test_user


async def _register(client: AsyncClient) -> tuple[uuid.UUID, dict[str, str]]:
    user_id_str, headers = await register_test_user(client)
    return uuid.UUID(user_id_str), headers


@pytest.mark.asyncio
async def test_prompt_context_is_empty_without_consent() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        user_id, _ = await _register(client)

    async with async_session_factory() as db:
        ctx = await _build_prompt_context(db, user_id)

    assert ctx.relevant_memories == []
    assert ctx.recent_session_summaries == []
    assert ctx.user_state == {}
    assert ctx.to_system_block() == ""


@pytest.mark.asyncio
async def test_prompt_context_is_enriched_after_consent() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        user_id, headers = await _register(client)
        resp = await client.patch(
            "/v1/ai/consent", json={"share_ai_context": True}, headers=headers
        )
        assert resp.status_code == 200

    async with async_session_factory() as db:
        ctx = await _build_prompt_context(db, user_id)

    assert ctx.relevant_memories  # XP/streak memory lines are always present
    assert ctx.user_state
    assert "[User Context]" in ctx.to_system_block()


@pytest.mark.asyncio
async def test_consent_can_be_revoked() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        user_id, headers = await _register(client)
        for flag in (True, False):
            resp = await client.patch(
                "/v1/ai/consent", json={"share_ai_context": flag}, headers=headers
            )
            assert resp.status_code == 200

    async with async_session_factory() as db:
        ctx = await _build_prompt_context(db, user_id)

    assert ctx.to_system_block() == ""


@pytest.mark.asyncio
async def test_user_state_reports_consent_flag() -> None:
    """The Settings page reads share_ai_context from /ai/user-state."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        _, headers = await _register(client)

        resp = await client.get("/v1/ai/user-state", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["share_ai_context"] is False

        await client.patch(
            "/v1/ai/consent", json={"share_ai_context": True}, headers=headers
        )
        resp = await client.get("/v1/ai/user-state", headers=headers)
        assert resp.json()["share_ai_context"] is True
