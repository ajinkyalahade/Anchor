import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.database import get_db
from app.db.models import RewardLedger, RewardState, User, UserStateSnapshot
from app.main import app
from tests.helpers import auth_headers_for


class FakeSession:
    def __init__(self) -> None:
        self.users: dict[uuid.UUID, User] = {}
        self.snapshots: dict[uuid.UUID, UserStateSnapshot] = {}
        self.rewards: list[RewardLedger] = []
        self.reward_states: dict[uuid.UUID, RewardState] = {}

    def add(self, obj: object) -> None:
        if isinstance(obj, User):
            self.users[obj.id] = obj
        elif isinstance(obj, UserStateSnapshot):
            self.snapshots[obj.user_id] = obj

    async def commit(self) -> None:
        return None
        
    async def flush(self) -> None:
        return None

    async def get(self, model: type[object], key: uuid.UUID) -> object | None:
        if model is User:
            return self.users.get(key)
        if model is UserStateSnapshot:
            return self.snapshots.get(key)
        if model is RewardState:
            return self.reward_states.get(key)
        return None

    async def scalar(self, stmt) -> object | None:
        return 0

    async def execute(self, stmt):
        class Row:
            def __init__(self, source, total):
                self.source = source
                self.total = total
        return []

@pytest.mark.asyncio
async def test_wearable_hrv_ingestion():
    fake_session = FakeSession()
    user_id = uuid.uuid4()
    from app.db.models import Profile
    user = User(id=user_id)
    user.profile = Profile(crash_window=None)
    fake_session.add(user)

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/v1/wearable/hrv",
                json={"hrv_score": 60.0},
                headers=auth_headers_for(user_id),
            )
            assert res.status_code == 200
            data = res.json()
            assert data["new_emotional_load"] == 1
            
            res2 = await client.post(
                "/v1/wearable/hrv",
                json={"hrv_score": 25.0},
                headers=auth_headers_for(user_id),
            )
            assert res2.status_code == 200
            data2 = res2.json()
            assert data2["new_emotional_load"] == 2
            assert data2["emotional_load_updated"] is True
            
            snapshot = await fake_session.get(UserStateSnapshot, user_id)
            assert snapshot is not None
            assert snapshot.snapshot["recent_hrv"] == 25.0
            assert snapshot.snapshot["emotional_load"] == 2
    finally:
        app.dependency_overrides.clear()
