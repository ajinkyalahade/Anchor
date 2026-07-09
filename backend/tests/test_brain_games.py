"""Tests for brain game session endpoints and Gemini classifier."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app
from tests.helpers import auth_headers_for


@pytest.fixture
def app():
    return create_app()


@pytest.mark.asyncio
async def test_game_session_start_returns_90s_cap(app):
    user_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/v1/games/sessions",
            json={"game_key": "echo"},
            headers=auth_headers_for(user_id),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["max_duration_seconds"] == 90
        assert data["why_this_matters"] != ""
        assert data["level"] >= 1


@pytest.mark.asyncio
async def test_game_session_start_all_game_keys(app):
    user_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for game_key in ["echo", "mirror", "spotter", "lockstep", "switch", "tracker"]:
            resp = await client.post(
                "/v1/games/sessions",
                json={"game_key": game_key},
                headers=auth_headers_for(user_id),
            )
            assert resp.status_code == 200, f"Failed for {game_key}"
            data = resp.json()
            assert data["why_this_matters"] != "", f"Missing why_this_matters for {game_key}"
            assert data["max_duration_seconds"] <= 90, f"{game_key} exceeds 90s cap"


@pytest.mark.asyncio
async def test_game_session_complete_returns_xp_and_next(app):
    user_id = uuid.uuid4()
    with patch("app.api.games.route", new_callable=AsyncMock) as mock_route:
        mock_route.return_value = {
            "state": "focused",
            "confidence": 0.8,
            "next_game": "switch",
            "reason": "You're focused — try something harder.",
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            start = await client.post(
                "/v1/games/sessions",
                json={"game_key": "echo"},
                headers=auth_headers_for(user_id),
            )
            session_id = start.json()["session_id"]

            resp = await client.patch(
                f"/v1/games/sessions/{session_id}",
                json={
                    "score": 80,
                    "accuracy": 78,
                    "rt_mean": 420,
                    "rt_var": 55,
                    "completed": True,
                },
                headers=auth_headers_for(user_id),
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["xp_awarded"] > 0
            assert data["next_game"] in {
                "echo",
                "mirror",
                "spotter",
                "lockstep",
                "switch",
                "tracker",
            }
            assert data["why_this_matters"] != ""


@pytest.mark.asyncio
async def test_get_next_game_endpoint(app):
    user_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/v1/games/next", headers=auth_headers_for(user_id))
        assert resp.status_code == 200
        data = resp.json()
        assert "next_game" in data
        assert "reason" in data


def test_classify_game_session_fallback_is_valid():
    from app.ai.router import _FALLBACKS, AITask

    fb = _FALLBACKS[AITask.CLASSIFY_GAME_SESSION]
    assert fb["state"] in ("focused", "distracted", "fatigued")
    assert fb["next_game"] in ("echo", "mirror", "spotter", "lockstep", "switch", "tracker")
    assert "reason" in fb
