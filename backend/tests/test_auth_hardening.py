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


# ── SEC-9: argon2 hashing with legacy scrypt compatibility ───────────────────

def test_new_hashes_are_argon2() -> None:
    from app.core.auth import hash_password, verify_password

    stored = hash_password("correct horse battery")
    assert stored.startswith("$argon2")
    assert verify_password("correct horse battery", stored)
    assert not verify_password("wrong password", stored)


def test_legacy_scrypt_hashes_still_verify_and_want_rehash() -> None:
    import hashlib
    import os

    from app.core.auth import password_needs_rehash, verify_password

    salt = os.urandom(16)
    derived = hashlib.scrypt(b"legacy-pass", salt=salt, n=16384, r=8, p=1, dklen=32)
    legacy = salt.hex() + "$" + derived.hex()

    assert verify_password("legacy-pass", legacy)
    assert not verify_password("not-it", legacy)
    assert password_needs_rehash(legacy)

    from app.core.auth import hash_password
    assert not password_needs_rehash(hash_password("fresh"))


def test_access_token_decodes_with_pyjwt() -> None:
    import jwt as pyjwt

    from app.core.auth import build_access_token

    token, expires_at = build_access_token(
        user_id="user-123", email="t@example.com", secret="s" * 32
    )
    claims = pyjwt.decode(token, "s" * 32, algorithms=["HS256"])
    assert claims["sub"] == "user-123"
    assert claims["exp"] == expires_at
    assert claims["jti"]


@pytest.mark.asyncio
async def test_login_upgrades_legacy_scrypt_hash() -> None:
    """A pre-migration user logs in fine and their hash is silently
    upgraded to argon2 (real-DB test)."""
    import hashlib
    import os
    import uuid as uuid_mod

    from httpx import ASGITransport, AsyncClient

    from app.db.database import async_session_factory
    from app.db.models import User
    from app.main import app

    email = f"legacy-{uuid_mod.uuid4().hex[:10]}@example.com"
    salt = os.urandom(16)
    derived = hashlib.scrypt(b"OldPassword9", salt=salt, n=16384, r=8, p=1, dklen=32)
    legacy_hash = salt.hex() + "$" + derived.hex()

    async with async_session_factory() as db:
        user = User(id=uuid_mod.uuid4(), email=email, password_hash=legacy_hash)
        db.add(user)
        await db.commit()
        user_id = user.id

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/auth/login", json={"email": email, "password": "OldPassword9"}
        )
    assert response.status_code == 200, response.text

    async with async_session_factory() as db:
        refreshed = await db.get(User, user_id)
        assert refreshed is not None
        assert refreshed.password_hash is not None
        assert refreshed.password_hash.startswith("$argon2")
        await db.delete(refreshed)
        await db.commit()
