"""Tests for calm endpoints."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.database import get_db
from app.db.models import RsdLog
from app.main import app
from tests.helpers import auth_headers_for


class FakeSession:
    def __init__(self) -> None:
        self.logs: list[RsdLog] = []
        self.commits = 0

    def add(self, obj: object) -> None:
        if isinstance(obj, RsdLog):
            self.logs.append(obj)

    async def commit(self) -> None:
        self.commits += 1


@pytest.mark.asyncio
async def test_rsd_endpoint_returns_ai_response() -> None:
    fake_session = FakeSession()
    user_id = uuid.uuid4()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    try:
        with patch("app.api.calm.route", new=AsyncMock()) as mock_route:
            mock_route.return_value = {
                "validation": "That stings.",
                "normalization": "Your system is reacting to pain, not failing.",
                "reframe": "Pause before deciding what this means.",
            }
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/v1/calm/rsd",
                    json={"trigger_text": "They did not reply to me", "intensity": 7},
                    headers=auth_headers_for(user_id),
                )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["validation"] == "That stings."
    assert len(fake_session.logs) == 1
    assert fake_session.commits == 1


@pytest.mark.asyncio
async def test_rsd_endpoint_returns_crisis_payload_before_ai_call() -> None:
    fake_session = FakeSession()
    user_id = uuid.uuid4()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    try:
        with patch("app.api.calm.route", new=AsyncMock()) as mock_route:
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/v1/calm/rsd",
                    json={"trigger_text": "I want to die", "intensity": 10},
                    headers=auth_headers_for(user_id),
                )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["is_crisis"] is True
    mock_route.assert_not_awaited()
