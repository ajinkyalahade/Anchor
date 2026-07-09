"""Tests for auth hardening: IP rate limiting, logout, password strength (SEC-4/5/6)."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.database import get_db
from app.db.models import User
from app.main import app


class _NoUserSession:
    """A session whose every user lookup misses — enough for login/register
    to reach the rate limiter without touching a real DB."""

    def __init__(self) -> None:
        self.added: list[object] = []

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        for obj in self.added:
            if isinstance(obj, User) and obj.id is None:
                obj.id = uuid.uuid4()

    async def execute(self, statement):  # noqa: ANN001
        from tests.helpers import FakeResult

        return FakeResult()

    async def get(self, model, key):  # noqa: ANN001
        return None


@pytest.mark.asyncio
async def test_login_is_ip_rate_limited() -> None:
    async def override_get_db():
        yield _NoUserSession()

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            statuses = []
            # login limit is 10/min; the 11th from the same IP must be blocked.
            for _ in range(11):
                resp = await client.post(
                    "/v1/auth/login",
                    json={"email": "nobody@example.com", "password": "whatever8"},
                )
                statuses.append(resp.status_code)
    finally:
        app.dependency_overrides.clear()

    assert statuses[:10] == [401] * 10  # allowed through (bad creds)
    assert statuses[10] == 429  # rate limited
    assert statuses.count(429) == 1


@pytest.mark.asyncio
async def test_register_short_password_is_rejected() -> None:
    async def override_get_db():
        yield _NoUserSession()

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/v1/auth/register",
                json={
                    "email": "new@example.com",
                    "first_name": "A",
                    "last_name": "B",
                    "password": "short7!",  # 7 chars < min 8
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_logout_clears_session_cookie() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/v1/auth/logout")

    assert resp.status_code == 200
    assert resp.json() == {"status": "logged_out"}
    # A delete-cookie directive is emitted for the session cookie.
    set_cookie = resp.headers.get("set-cookie", "")
    assert "anchor_session=" in set_cookie
