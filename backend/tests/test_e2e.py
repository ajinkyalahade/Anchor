"""End-to-end user journey test (1G.4).

Simulates: onboarding → home suggestion → focus decompose → reward grant.
Uses dependency injection overrides so no real DB is needed.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.database import get_db
from app.db.models import Profile, RewardState, User
from app.main import app
from tests.helpers import FakeResult, auth_headers_for


class FakeSession:
    def __init__(self) -> None:
        self.objects: list[object] = []
        self._store: dict[tuple, object] = {}

    def add(self, obj: object) -> None:
        self.objects.append(obj)

    async def flush(self) -> None:
        self._assign_ids()

    async def commit(self) -> None:
        self._assign_ids()

    async def refresh(self, obj: object) -> None:
        pass

    async def get(self, model: type[object], key: uuid.UUID) -> object | None:
        if model is User:
            for obj in self.objects:
                if isinstance(obj, User) and obj.id == key:
                    return obj
        if model is RewardState:
            return None
        return None

    async def execute(self, statement):
        return FakeResult()

    async def scalar(self, statement) -> object | None:
        return None

    async def scalars(self, statement):
        class ScalarResult:
            def all(self) -> list[object]:
                return []

        return ScalarResult()

    def _assign_ids(self) -> None:
        for obj in self.objects:
            if isinstance(obj, User) and obj.id is None:
                obj.id = uuid.uuid4()
            if isinstance(obj, Profile) and obj.id is None:
                obj.id = uuid.uuid4()


@pytest.mark.asyncio
async def test_full_onboarding_journey() -> None:
    """New user completes onboarding — verifies profile is persisted."""
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/onboarding",
                json={
                    "deficit_tags": ["EF", "TB"],
                    "crash_window": "Afternoon",
                    "vibe_pref": "focused",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert "user_id" in data
    # Two objects persisted: User + Profile
    assert len(fake_session.objects) == 2


@pytest.mark.asyncio
async def test_home_suggestion_available_after_onboarding() -> None:
    """AI suggestion endpoint works immediately after onboarding (no user_id required)."""
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/v1/ai/suggestion", headers=auth_headers_for(uuid.uuid4()))
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["action"] in ("focus", "calm", "games")
    assert data["route"].startswith("/")


@pytest.mark.asyncio
async def test_focus_decompose_returns_steps() -> None:
    """Focus decompose returns valid micro-steps (with fallback when no API key)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/focus/decompose",
            json={"task_text": "Write the quarterly report"},
            headers=auth_headers_for(uuid.uuid4()),
        )

    assert response.status_code == 200
    data = response.json()
    assert "steps" in data
    assert len(data["steps"]) >= 2
    assert "why_first_step_matters" in data

    first_step = next((s for s in data["steps"] if s.get("first")), None)
    assert first_step is not None, "At least one step must be marked first=True"
    assert first_step["est_minutes"] <= 2, "First step must be ≤2 minutes"


@pytest.mark.asyncio
async def test_rewards_summary_starts_at_zero() -> None:
    """Fresh anonymous user starts with zero XP and building streak."""
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(
                "/v1/rewards/summary",
                headers=auth_headers_for(uuid.uuid4()),
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["total_xp"] == 0
    assert data["streak_state"] == "building"
    assert data["current_streak"] == 0


@pytest.mark.asyncio
async def test_health_check_passes() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/v1/health")
    assert response.status_code == 200
