"""Tests for the scheduled account-deletion worker (BE-6 / DATA-1)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.database import get_db
from app.db.models import AccountDeletionRequest, User
from app.main import app
from tests.helpers import auth_headers_for


@pytest.mark.asyncio
async def test_scheduled_deletion_is_executed_after_grace_period() -> None:
    """A pending scheduled deletion whose time has passed removes the user."""
    from app.domain.workers import deletion_worker

    user_id = uuid.uuid4()
    user = User(id=user_id, email="leaving@example.com")
    request = AccountDeletionRequest(
        id=uuid.uuid4(),
        target_user_id=user_id,
        deletion_mode="scheduled",
        status="pending",
        scheduled_for=datetime.now(UTC) - timedelta(minutes=1),
    )

    class FakeSession:
        def __init__(self) -> None:
            self.users = {user_id: user}
            self.deleted: list[uuid.UUID] = []
            self.committed = False

        async def execute(self, statement):  # noqa: ANN001
            from tests.helpers import FakeResult

            return FakeResult([request])

        async def get(self, model, key):  # noqa: ANN001
            return self.users.get(key)

        async def delete(self, obj) -> None:  # noqa: ANN001
            self.deleted.append(obj.id)
            self.users.pop(obj.id, None)

        async def commit(self) -> None:
            self.committed = True

        async def __aenter__(self) -> "FakeSession":
            return self

        async def __aexit__(self, *exc) -> None:  # noqa: ANN002
            return None

    fake = FakeSession()

    def factory() -> FakeSession:
        return fake

    original = deletion_worker.async_session_factory
    deletion_worker.async_session_factory = factory  # type: ignore[assignment]
    try:
        summary = await deletion_worker.run_due_deletions()
    finally:
        deletion_worker.async_session_factory = original  # type: ignore[assignment]

    assert summary == {"processed": 1, "already_gone": 0}
    assert user_id in fake.deleted
    assert request.status == "completed"
    assert request.completed_at is not None
    assert fake.committed is True


@pytest.mark.asyncio
async def test_scheduled_deletion_request_is_recorded_and_pending() -> None:
    """The endpoint records a pending request the worker will later pick up."""

    class FakeSession:
        def __init__(self) -> None:
            self.user = User(id=uuid.uuid4())
            self.requests: list[AccountDeletionRequest] = []

        def add(self, obj: object) -> None:
            if isinstance(obj, AccountDeletionRequest):
                obj.id = uuid.uuid4()
                self.requests.append(obj)

        async def flush(self) -> None:
            return None

        async def get(self, model, key):  # noqa: ANN001
            return self.user

    fake = FakeSession()

    async def override_get_db():
        yield fake

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/v1/account/deletion",
                json={"deletion_mode": "scheduled"},
                headers=auth_headers_for(fake.user.id),
            )
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 202
    assert fake.requests[0].status == "pending"
    assert fake.requests[0].target_user_id == fake.user.id
