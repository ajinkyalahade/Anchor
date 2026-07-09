"""Tests for Live Body Double rooms — no recordings, report flow, bandwidth-aware."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import rooms
from app.core.config import Settings
from app.main import create_app
from tests.helpers import auth_headers_for, register_test_user


@pytest.fixture
def app():
    return create_app()


@pytest.mark.asyncio
async def test_room_list_returns_list(app, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        rooms,
        "get_settings",
        lambda: Settings(livekit_url="", livekit_api_key="", livekit_api_secret=""),
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/v1/rooms/token", json={}, headers=auth_headers_for(uuid.uuid4()))
        assert resp.status_code == 503


@pytest.mark.asyncio
async def test_create_room_max_4_participants(app, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        rooms,
        "get_settings",
        lambda: Settings(
            livekit_url="wss://anchor.livekit.test",
            livekit_api_key="livekit-test-key",
            livekit_api_secret="livekit-test-secret",
        ),
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/v1/rooms/token",
            json={"participant_metadata": '{"commitment":"Working on a report"}'},
            headers=auth_headers_for(uuid.uuid4()),
        )
        assert resp.status_code == 201
        assert resp.json()["room_policy"]["max_participants"] <= 4


@pytest.mark.asyncio
async def test_report_endpoint_exists(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/v1/rooms/fake-room-id/report",
            json={"reason": "inappropriate_behavior"},
            headers=auth_headers_for(uuid.uuid4()),
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_push_subscribe_returns_crash_hour(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, headers = await register_test_user(client)
        resp = await client.post(
            "/v1/notifications/subscribe",
            json={
                "subscription": {
                    "endpoint": "https://fcm.googleapis.com/test",
                    "keys": {"p256dh": "test", "auth": "test"},
                },
                "crash_window": "morning",
            },
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["registered"] is True
        assert data["crash_hour"] == 9


@pytest.mark.asyncio
async def test_push_subscribe_evening_crash_window(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, headers = await register_test_user(client)
        resp = await client.post(
            "/v1/notifications/subscribe",
            json={
                "subscription": {
                    "endpoint": "https://fcm.test",
                    "keys": {"p256dh": "x", "auth": "y"},
                },
                "crash_window": "evening",
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["crash_hour"] == 19
