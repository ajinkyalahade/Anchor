"""Tests for the onboarding flow."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.database import get_db
from app.db.models import Profile, User
from app.main import app


class ScalarResult:
    def __init__(self, value: object | None) -> None:
        self._value = value

    def scalar_one_or_none(self) -> object | None:
        return self._value


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
        pass

    async def execute(self, statement):
        where_clause = list(statement._where_criteria)[0]
        value = where_clause.right.value
        for obj in self.objects:
            if isinstance(obj, User) and obj.email == value:
                return ScalarResult(obj)
        return ScalarResult(None)

    def _assign_ids(self) -> None:
        for obj in self.objects:
            if isinstance(obj, User) and obj.id is None:
                obj.id = uuid.uuid4()
            if isinstance(obj, Profile) and obj.id is None:
                obj.id = uuid.uuid4()


@pytest.mark.asyncio
async def test_complete_onboarding():
    """Test creating an anonymous user via onboarding."""
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    
    payload = {
        "deficit_tags": ["TB", "EF"],
        "crash_window": "Afternoon",
        "vibe_pref": "gentle"
    }
    
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/v1/onboarding", json=payload)
    finally:
        app.dependency_overrides.clear()
    
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert "user_id" in data
    assert "profile_id" in data
    assert len(fake_session.objects) == 2


@pytest.mark.asyncio
async def test_complete_onboarding_rejects_duplicate_email() -> None:
    fake_session = FakeSession()
    fake_session.add(
        User(
            id=uuid.uuid4(),
            email="dupe@example.com",
            first_name="Dupe",
            last_name="User",
            password_hash="salt$hash",
        )
    )

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    payload = {
        "deficit_tags": ["TB"],
        "crash_window": "Afternoon",
        "vibe_pref": "gentle",
        "email": "dupe@example.com",
        "password": "secret123",
        "first_name": "New",
        "last_name": "User",
    }

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/v1/onboarding", json=payload)
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "An account with this email already exists. Try logging in instead."
    )
