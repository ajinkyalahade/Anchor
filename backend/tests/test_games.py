"""Tests for Word Gym endpoints."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.helpers import auth_headers_for


@pytest.mark.asyncio
async def test_wordgym_start_returns_base_word() -> None:
    user_id = uuid.uuid4()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/v1/games/wordgym/start",
            headers=auth_headers_for(user_id),
        )

    assert response.status_code == 200
    assert response.json()["base_word"]


@pytest.mark.asyncio
async def test_wordgym_evaluate_returns_scored_response() -> None:
    user_id = uuid.uuid4()
    transport = ASGITransport(app=app)

    with patch("app.api.games.route", new=AsyncMock()) as mock_eval:
        mock_eval.return_value = {
            "valid": True,
            "score": 4,
            "reason": "Strong association",
        }
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/games/wordgym/evaluate",
                json={"base_word": "ocean", "user_word": "wave"},
                headers=auth_headers_for(user_id),
            )

    assert response.status_code == 200
    assert response.json()["valid"] is True
    assert response.json()["next_word"] == "wave"


@pytest.mark.asyncio
async def test_wordgym_evaluate_rejects_invalid_word() -> None:
    user_id = uuid.uuid4()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/games/wordgym/evaluate",
            json={"base_word": "ocean", "user_word": ""},
            headers=auth_headers_for(user_id),
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_wordgym_evaluate_handles_timeout_with_fallback() -> None:
    user_id = uuid.uuid4()
    transport = ASGITransport(app=app)

    with patch("app.api.games.route", new=AsyncMock()) as mock_eval:
        mock_eval.side_effect = TimeoutError("provider timeout")
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/games/wordgym/evaluate",
                json={"base_word": "ocean", "user_word": "wave"},
                headers=auth_headers_for(user_id),
            )

    assert response.status_code == 200
    assert response.json()["valid"] is False
    assert response.json()["next_word"] == "ocean"
