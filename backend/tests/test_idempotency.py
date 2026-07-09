"""Tests for POST idempotency middleware."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.cache import AppCache
from app.db.database import get_db
from app.db.models import Profile, User
from app.main import app


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
