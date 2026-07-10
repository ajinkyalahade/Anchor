"""Tests for server-side token revocation (SEC-5)."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.cache import AppCache
from app.core.token_revocation import is_token_revoked, revoke_token
from app.db.database import get_db
from app.db.models import User
from app.main import app
from tests.helpers import auth_headers_for


class _MemoryCache:
    """Minimal AppCache-compatible in-memory cache for unit tests."""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def set_text(self, key: str, value: str, ttl_seconds: int) -> None:
        self.store[key] = value

    async def get_text(self, key: str) -> str | None:
        return self.store.get(key)


@pytest.mark.asyncio
async def test_revoke_then_is_revoked() -> None:
    cache = _MemoryCache()
    import time

    exp = int(time.time()) + 3600
    await revoke_token(cache, "jti-1", exp)
    assert await is_token_revoked(cache, "jti-1") is True
    assert await is_token_revoked(cache, "jti-2") is False


@pytest.mark.asyncio
async def test_expired_token_is_not_written_to_denylist() -> None:
    cache = _MemoryCache()
    import time

    await revoke_token(cache, "old", int(time.time()) - 10)
    assert await is_token_revoked(cache, "old") is False


@pytest.mark.asyncio
async def test_is_revoked_fails_open_when_cache_missing() -> None:
    assert await is_token_revoked(None, "anything") is False


@pytest.mark.asyncio
async def test_logout_revokes_token_and_blocks_reuse() -> None:
    """End-to-end: a token works, logout revokes it, the same token is then
    rejected on a protected route."""
    user_id = uuid.uuid4()
    app.state.cache = AppCache("redis://localhost:6379/99")
    app.state.cache._redis = None  # deterministic in-memory path
    headers = auth_headers_for(user_id)

    class FakeSession:
        async def get(self, model, key):  # noqa: ANN001
            return User(id=user_id) if model is User else None

        def add(self, obj: object) -> None:
            return None

        async def flush(self) -> None:
            return None

        async def execute(self, statement):  # noqa: ANN001
            from tests.helpers import FakeResult

            return FakeResult()

    async def override_get_db():
        yield FakeSession()

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Works before logout.
            before = await client.get("/v1/account/preferences", headers=headers)
            assert before.status_code == 200

            # Logout revokes the presented token.
            out = await client.post("/v1/auth/logout", headers=headers)
            assert out.status_code == 200

            # Same token is now rejected.
            after = await client.get("/v1/account/preferences", headers=headers)
            assert after.status_code == 401
            assert after.json()["detail"] == "token_revoked"
    finally:
        app.dependency_overrides.clear()
