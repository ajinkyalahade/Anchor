"""Tests for account deletion endpoints."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.database import get_db
from app.db.models import AccountDeletionRequest, User
from app.main import app
from tests.helpers import auth_headers_for


class FakeSession:
    def __init__(self) -> None:
        self.users: dict[uuid.UUID, User] = {}
        self.deletion_requests: list[AccountDeletionRequest] = []

    def add(self, obj: object) -> None:
        if isinstance(obj, User):
            self.users[obj.id] = obj
        elif isinstance(obj, AccountDeletionRequest):
            if obj.id is None:
                obj.id = uuid.uuid4()
            self.deletion_requests.append(obj)

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        return None

    async def refresh(self, obj: object) -> None:
        return None

    async def get(self, model: type[object], key: uuid.UUID) -> object | None:
        if model is User:
            return self.users.get(key)
        return None

    async def delete(self, obj: object) -> None:
        if isinstance(obj, User):
            self.users.pop(obj.id, None)


@pytest.mark.asyncio
async def test_account_deletion_can_be_scheduled() -> None:
    fake_session = FakeSession()
    user = User(id=uuid.uuid4())
    fake_session.add(user)

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/account/deletion",
                json={"user_id": str(user.id), "deletion_mode": "scheduled"},
                headers=auth_headers_for(user.id),
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "pending"
    assert data["deletion_mode"] == "scheduled"
    assert data["deleted_now"] is False
    assert data["scheduled_for"] is not None
    scheduled_for = datetime.fromisoformat(data["scheduled_for"].replace("Z", "+00:00"))
    assert (
        timedelta(days=29, hours=23)
        < (scheduled_for - datetime.now(UTC))
        <= timedelta(days=30, minutes=1)
    )
    assert len(fake_session.deletion_requests) == 1
    assert fake_session.deletion_requests[0].target_user_id == user.id
    assert fake_session.deletion_requests[0].status == "pending"


@pytest.mark.asyncio
async def test_account_deletion_can_hard_delete_immediately() -> None:
    fake_session = FakeSession()
    user = User(id=uuid.uuid4())
    fake_session.add(user)

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/account/deletion",
                json={"user_id": str(user.id), "deletion_mode": "immediate"},
                headers=auth_headers_for(user.id),
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "completed"
    assert data["deleted_now"] is True
    assert data["scheduled_for"] is None
    assert user.id not in fake_session.users
    assert len(fake_session.deletion_requests) == 1
    assert fake_session.deletion_requests[0].target_user_id == user.id
    assert fake_session.deletion_requests[0].status == "completed"


@pytest.mark.asyncio
async def test_account_deletion_rejects_unknown_user() -> None:
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/account/deletion",
                json={"user_id": str(uuid.uuid4()), "deletion_mode": "immediate"},
                headers=auth_headers_for(uuid.uuid4()),
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"
