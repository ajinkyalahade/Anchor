"""Tests for reward progression rules and reward endpoints."""

import uuid
from datetime import UTC, date, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.database import get_db
from app.db.models import RewardLedger, RewardState, User
from app.domain.rewards.service import (
    advance_streak_after_activity,
    calculate_weighted_xp,
    compute_newly_unlocked,
    get_catalog_with_status,
    refresh_streak_for_today,
    summarize_rewards,
)
from app.main import app
from tests.helpers import auth_headers_for


class ScalarListResult:
    def __init__(self, values: list[datetime]) -> None:
        self._values = values

    def all(self) -> list[datetime]:
        return list(self._values)


class FakeSession:
    def __init__(self) -> None:
        self.users: dict[uuid.UUID, User] = {}
        self.reward_states: dict[uuid.UUID, RewardState] = {}
        self.ledger: list[RewardLedger] = []

    def add(self, obj: object) -> None:
        if isinstance(obj, User):
            self.users[obj.id] = obj
        elif isinstance(obj, RewardState):
            self.reward_states[obj.user_id] = obj
        elif isinstance(obj, RewardLedger):
            if obj.id is None:
                obj.id = uuid.uuid4()
            if getattr(obj, "ts", None) is None:
                obj.ts = datetime.now(UTC)
            self.ledger.append(obj)

    async def flush(self) -> None:
        return None

    async def get(self, model: type[object], key: uuid.UUID) -> object | None:
        if model is User:
            return self.users.get(key)
        if model is RewardState:
            return self.reward_states.get(key)
        return None

    async def scalar(self, statement):
        query = str(statement)
        user_id = list(statement._where_criteria)[0].right.value
        matching = [entry for entry in self.ledger if entry.user_id == user_id]
        if "sum(rewards_ledger.xp)" in query:
            return sum(entry.xp for entry in matching)
        if "rewards_ledger.ts" in query:
            timestamps = sorted((entry.ts for entry in matching), reverse=True)
            return timestamps[0] if timestamps else None
        return None

    async def scalars(self, statement):
        user_id = list(statement._where_criteria)[0].right.value
        timestamps = sorted(
            (entry.ts for entry in self.ledger if entry.user_id == user_id),
            reverse=True,
        )
        return ScalarListResult(timestamps)


def test_calculate_weighted_xp_by_source() -> None:
    assert calculate_weighted_xp("focus", 10) == 12
    assert calculate_weighted_xp("wordgym", 10) == 10
    assert calculate_weighted_xp("calm", 10) == 11
    assert calculate_weighted_xp("games", 10) == 10
    assert calculate_weighted_xp("quests", 10) == 10


def test_calculate_weighted_xp_applies_comeback_bonus() -> None:
    assert calculate_weighted_xp("focus", 10, comeback_bonus=True) == 24


def test_calculate_weighted_xp_rejects_non_positive_base() -> None:
    with pytest.raises(ValueError, match="base_xp must be positive"):
        calculate_weighted_xp("calm", 0)


def test_summarize_rewards_returns_empty_state() -> None:
    summary = summarize_rewards(total_xp=0, activity_timestamps=[])

    assert summary.total_xp == 0
    assert summary.current_streak == 0
    assert summary.streak_state == "building"
    assert summary.comeback_bonus_active is False


def test_summarize_rewards_counts_current_streak() -> None:
    now = datetime.now(UTC)
    timestamps = [now, now - timedelta(days=1), now - timedelta(days=2)]

    summary = summarize_rewards(total_xp=120, activity_timestamps=timestamps)

    assert summary.total_xp == 120
    assert summary.current_streak == 3
    assert summary.streak_state == "steady"
    assert summary.comeback_bonus_active is False


def test_summarize_rewards_marks_recovering_after_gap() -> None:
    timestamp = datetime.now(UTC) - timedelta(days=5)

    summary = summarize_rewards(total_xp=40, activity_timestamps=[timestamp])

    assert summary.current_streak == 0
    assert summary.streak_state == "recovering"
    assert summary.comeback_bonus_active is True


def test_refresh_streak_keeps_streak_count_after_missed_days() -> None:
    today = date(2026, 5, 4)

    snapshot = refresh_streak_for_today(
        current_streak=4,
        last_activity_date=date(2026, 4, 29),
        today=today,
    )

    assert snapshot.current_streak == 4
    assert snapshot.streak_state == "recovering"
    assert snapshot.comeback_bonus_active is True


def test_advance_streak_consumes_comeback_and_moves_forward() -> None:
    today = date(2026, 5, 4)

    snapshot = advance_streak_after_activity(
        current_streak=4,
        last_activity_date=date(2026, 4, 29),
        today=today,
    )

    assert snapshot.current_streak == 5
    assert snapshot.streak_state == "steady"
    assert snapshot.comeback_bonus_active is False


@pytest.mark.asyncio
async def test_rewards_summary_returns_authenticated_user_state() -> None:
    fake_session = FakeSession()
    user_id = uuid.uuid4()
    fake_session.add(User(id=user_id, email="summary@example.com"))
    fake_session.reward_states[user_id] = RewardState(
        user_id=user_id,
        current_streak=2,
        current_streak_state="steady",
        last_activity_date=date.today() - timedelta(days=1),
        comeback_bonus_active=False,
    )
    fake_session.ledger.append(
        RewardLedger(
            user_id=user_id,
            source="focus",
            xp=12,
            reason="Started",
            ts=datetime.now(UTC) - timedelta(days=1),
        )
    )
    fake_session.ledger.append(
        RewardLedger(
            user_id=user_id,
            source="calm",
            xp=11,
            reason="Reset",
            ts=datetime.now(UTC),
        )
    )

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(
                "/v1/rewards/summary",
                headers=auth_headers_for(user_id, "summary@example.com"),
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["total_xp"] == 23
    assert response.json()["current_streak"] >= 2


@pytest.mark.asyncio
async def test_grant_reward_creates_ledger_entry_and_updates_summary() -> None:
    fake_session = FakeSession()
    user_id = uuid.uuid4()
    fake_session.add(User(id=user_id, email="reward@example.com"))
    fake_session.reward_states[user_id] = RewardState(
        user_id=user_id,
        current_streak=0,
        current_streak_state="building",
        last_activity_date=None,
        comeback_bonus_active=False,
    )

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)

    try:
        with patch("app.api.rewards._upsert_user_state_snapshot", new=AsyncMock(return_value=None)):
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/v1/rewards/grant",
                    json={"source": "focus", "base_xp": 10, "reason": "Finished a session"},
                    headers=auth_headers_for(user_id, "reward@example.com"),
                )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["xp_granted"] == 12
    assert data["total_xp"] == 12
    assert data["current_streak"] == 1
    assert len(fake_session.ledger) == 1
    assert fake_session.reward_states[user_id].last_activity_date == date.today()


# ---------------------------------------------------------------------------
# Unlock catalog — unit tests
# ---------------------------------------------------------------------------


def test_compute_newly_unlocked_returns_item_when_threshold_crossed() -> None:
    newly = compute_newly_unlocked(total_xp=55, previous_xp=30)
    assert len(newly) == 1
    assert newly[0].id == "theme_focus_blue"


def test_compute_newly_unlocked_empty_when_no_threshold_crossed() -> None:
    assert compute_newly_unlocked(total_xp=40, previous_xp=10) == []


def test_compute_newly_unlocked_multiple_thresholds_in_one_grant() -> None:
    newly = compute_newly_unlocked(total_xp=110, previous_xp=40)
    ids = {item.id for item in newly}
    assert "theme_focus_blue" in ids
    assert "sound_rain" in ids


def test_compute_newly_unlocked_excludes_previously_surpassed() -> None:
    newly = compute_newly_unlocked(total_xp=200, previous_xp=160)
    ids = {item.id for item in newly}
    assert "theme_focus_blue" not in ids
    assert "sound_rain" not in ids


def test_get_catalog_with_status_marks_unlocked_at_threshold() -> None:
    catalog = get_catalog_with_status(total_xp=50)
    entry = next(c for c in catalog if c["id"] == "theme_focus_blue")
    assert entry["unlocked"] is True


def test_get_catalog_with_status_marks_locked_below_threshold() -> None:
    catalog = get_catalog_with_status(total_xp=49)
    entry = next(c for c in catalog if c["id"] == "theme_focus_blue")
    assert entry["unlocked"] is False


def test_get_catalog_with_status_all_locked_at_zero() -> None:
    catalog = get_catalog_with_status(total_xp=0)
    assert all(not c["unlocked"] for c in catalog)


def test_get_catalog_with_status_all_unlocked_at_max() -> None:
    catalog = get_catalog_with_status(total_xp=9999)
    assert all(c["unlocked"] for c in catalog)
