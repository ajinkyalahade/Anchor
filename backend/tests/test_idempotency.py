"""Tests for POST idempotency middleware."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.cache import AppCache
from app.core.idempotency import InMemoryIdempotencyStore, StoredIdempotentResponse
from app.db.database import get_db
from app.db.models import Profile, User
from app.main import app


def _stored(tag: str = "x") -> StoredIdempotentResponse:
    return StoredIdempotentResponse(
        request_hash=tag, status_code=201, body=b"{}", headers={}, media_type="application/json"
    )


def test_in_memory_store_expires_entries(monkeypatch: pytest.MonkeyPatch) -> None:
    """Regression (BE-2): the per-process store must not retain entries
    beyond the TTL — previously it grew forever."""
    clock = {"now": 1000.0}
    monkeypatch.setattr("app.core.idempotency.time.monotonic", lambda: clock["now"])

    store = InMemoryIdempotencyStore(ttl_seconds=10)
    store["a"] = _stored()
    assert store.get("a") is not None

    clock["now"] += 11
    assert store.get("a") is None
    assert len(store) == 0

    # Expired entries are also purged when a new key is written.
    store["b"] = _stored()
    clock["now"] += 11
    store["c"] = _stored()
    assert len(store) == 1


def test_in_memory_store_caps_size() -> None:
    store = InMemoryIdempotencyStore(max_entries=3)
    for i in range(5):
        store[f"k{i}"] = _stored()
    assert len(store) == 3
    assert store.get("k0") is None  # oldest evicted first
    assert store.get("k4") is not None


def test_in_memory_store_rewrite_refreshes_position() -> None:
    store = InMemoryIdempotencyStore(max_entries=2)
    store["a"] = _stored()
    store["b"] = _stored()
    store["a"] = _stored("new")  # re-set moves 'a' to newest
    store["c"] = _stored()
    assert store.get("b") is None  # 'b' was the oldest at the cap
    assert store.get("a") is not None


class FakeSession:
    def __init__(self) -> None:
        self.objects: list[object] = []

    def add(self, obj: object) -> None:
        self.objects.append(obj)

    async def flush(self) -> None:
        self._assign_ids()

    async def commit(self) -> None:
        self._assign_ids()

    async def refresh(self, obj: object) -> None:
        return None

    def _assign_ids(self) -> None:
        for obj in self.objects:
            if isinstance(obj, User) and obj.id is None:
                obj.id = uuid.uuid4()
            if isinstance(obj, Profile) and obj.id is None:
                obj.id = uuid.uuid4()


@pytest.mark.asyncio
async def test_post_with_same_idempotency_key_replays_first_response() -> None:
    fake_session = FakeSession()
    app.state.idempotency_store.clear()
    original_cache = app.state.cache
    app.state.cache = AppCache("redis://localhost:6379/99")

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    payload = {
        "deficit_tags": ["EF", "TB"],
        "crash_window": "Afternoon",
        "vibe_pref": "focused",
    }

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            first = await client.post(
                "/v1/onboarding",
                json=payload,
                headers={"Idempotency-Key": "onboarding-1"},
            )
            second = await client.post(
                "/v1/onboarding",
                json=payload,
                headers={"Idempotency-Key": "onboarding-1"},
            )
    finally:
        app.dependency_overrides.clear()
        app.state.idempotency_store.clear()
        app.state.cache = original_cache

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json() == second.json()
    assert second.headers["x-idempotent-replayed"] == "true"
    assert len(fake_session.objects) == 2


@pytest.mark.asyncio
async def test_post_with_same_idempotency_key_and_different_body_is_rejected() -> None:
    fake_session = FakeSession()
    app.state.idempotency_store.clear()
    original_cache = app.state.cache
    app.state.cache = AppCache("redis://localhost:6379/99")

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post(
                "/v1/onboarding",
                json={
                    "deficit_tags": ["EF"],
                    "crash_window": "Morning",
                    "vibe_pref": "gentle",
                },
                headers={"Idempotency-Key": "onboarding-2"},
            )
            conflict = await client.post(
                "/v1/onboarding",
                json={
                    "deficit_tags": ["TB"],
                    "crash_window": "Evening",
                    "vibe_pref": "playful",
                },
                headers={"Idempotency-Key": "onboarding-2"},
            )
    finally:
        app.dependency_overrides.clear()
        app.state.idempotency_store.clear()
        app.state.cache = original_cache

    assert conflict.status_code == 409
    assert (
        conflict.json()["detail"]
        == "Idempotency-Key has already been used with a different request body"
    )


@pytest.mark.asyncio
async def test_post_replays_from_cache_after_memory_store_is_cleared() -> None:
    fake_session = FakeSession()
    original_cache = app.state.cache
    app.state.cache = AppCache("redis://localhost:6379/99")
    app.state.idempotency_store.clear()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    payload = {
        "deficit_tags": ["EF", "TB"],
        "crash_window": "Afternoon",
        "vibe_pref": "focused",
    }

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            first = await client.post(
                "/v1/onboarding",
                json=payload,
                headers={"Idempotency-Key": "onboarding-3"},
            )
            app.state.idempotency_store.clear()
            second = await client.post(
                "/v1/onboarding",
                json=payload,
                headers={"Idempotency-Key": "onboarding-3"},
            )
    finally:
        app.dependency_overrides.clear()
        app.state.idempotency_store.clear()
        app.state.cache = original_cache

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json() == second.json()
    assert second.headers["x-idempotent-replayed"] == "true"
    assert len(fake_session.objects) == 2


@pytest.mark.asyncio
async def test_idempotency_key_is_scoped_per_caller() -> None:
    """Regression (SEC-2): the same Idempotency-Key from two different callers
    must never replay the first caller's response to the second."""
    fake_session = FakeSession()
    app.state.idempotency_store.clear()
    original_cache = app.state.cache
    app.state.cache = AppCache("redis://localhost:6379/99")

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    payload = {
        "deficit_tags": ["EF", "TB"],
        "crash_window": "Afternoon",
        "vibe_pref": "focused",
    }

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            first = await client.post(
                "/v1/onboarding",
                json=payload,
                headers={
                    "Idempotency-Key": "shared-key",
                    "Authorization": "Bearer caller-a-token",
                },
            )
            second = await client.post(
                "/v1/onboarding",
                json=payload,
                headers={
                    "Idempotency-Key": "shared-key",
                    "Authorization": "Bearer caller-b-token",
                },
            )
    finally:
        app.dependency_overrides.clear()
        app.state.idempotency_store.clear()
        app.state.cache = original_cache

    assert first.status_code == 201
    assert second.status_code == 201
    # Different callers → independent responses, never a cross-caller replay.
    assert "x-idempotent-replayed" not in second.headers
    assert first.json()["user_id"] != second.json()["user_id"]
    # Two users + two profiles were actually created.
    assert len(fake_session.objects) == 4
