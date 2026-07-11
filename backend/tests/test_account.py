"""Tests for account deletion endpoints."""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.database import async_session_factory, get_db
from app.db.models import AccountDeletionRequest, User
from app.main import app
from tests.helpers import auth_headers_for, register_test_user


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
                json={"deletion_mode": "scheduled"},
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
                json={"deletion_mode": "immediate"},
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
                json={"deletion_mode": "immediate"},
                headers=auth_headers_for(uuid.uuid4()),
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


@pytest.mark.asyncio
async def test_account_deletion_ignores_user_id_in_payload() -> None:
    """Regression (SEC-1): deletion must target the token's user; a user_id
    smuggled into the payload must never select the deletion target."""
    fake_session = FakeSession()
    attacker = User(id=uuid.uuid4())
    victim = User(id=uuid.uuid4())
    fake_session.add(attacker)
    fake_session.add(victim)

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/account/deletion",
                json={"user_id": str(victim.id), "deletion_mode": "immediate"},
                headers=auth_headers_for(attacker.id),
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 202
    # The victim is untouched; only the attacker's own account was deleted.
    assert victim.id in fake_session.users
    assert attacker.id not in fake_session.users
    assert fake_session.deletion_requests[0].target_user_id == attacker.id


@pytest.mark.asyncio
async def test_immediate_deletion_cascades_all_user_content() -> None:
    """Regression (DATA-1): deleting an account must delete the user's content
    rows outright — coaching messages, mood check-ins, sessions, quests — not
    orphan them with a NULL user_id. Runs against the real database so the
    FK ON DELETE behavior is what's actually exercised."""
    from app.db.models import (
        AIMessage,
        CoachingMessage,
        CoachingSession,
        FocusSession,
        GameSession,
        MoodCheckin,
        Quest,
        TimeBlock,
        TimeEstimate,
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        user_id_str, headers = await register_test_user(client)
        user_id = uuid.UUID(user_id_str)

        async with async_session_factory() as db:
            coaching = CoachingSession(user_id=user_id)
            block = TimeBlock(
                user_id=user_id,
                block_date=date(2026, 7, 11),
                start_minute=540,
                duration_minutes=30,
                title="Deep work",
                quadrant="q1",
            )
            db.add_all([coaching, block])
            await db.flush()

            rows: list[object] = [
                CoachingMessage(
                    session_id=coaching.id,
                    user_id=user_id,
                    role="user",
                    content="a private thought",
                ),
                MoodCheckin(user_id=user_id, score=2, note_enc="enc-note"),
                GameSession(user_id=user_id, game_key="echo", level=1),
                FocusSession(user_id=user_id, duration_planned=25),
                Quest(
                    user_id=user_id,
                    quest_key="dance",
                    title="Dance break",
                    duration_seconds=60,
                ),
                AIMessage(
                    user_id=user_id,
                    task="coach",
                    model="test",
                    prompt_id="coach@v1",
                    content_hash="deadbeef",
                    latency_ms=1,
                ),
                TimeEstimate(
                    user_id=user_id, time_block_id=block.id, estimated_minutes=30
                ),
            ]
            db.add_all(rows)
            await db.commit()
            created = [(type(row), row.id) for row in [coaching, block, *rows]]  # type: ignore[attr-defined]

        response = await client.post(
            "/v1/account/deletion",
            json={"deletion_mode": "immediate"},
            headers=headers,
        )
        assert response.status_code == 202, response.text

    async with async_session_factory() as db:
        assert await db.get(User, user_id) is None
        for model, row_id in created:
            leftover = await db.get(model, row_id)
            assert leftover is None, f"{model.__name__} row survived account deletion"
