"""Tests for the AI suggestion engine and first-week scaffolding (1G.1)."""

import uuid
from datetime import date

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.database import get_db
from app.db.models import RewardState, User
from app.domain.suggestion.service import first_week_label, pick_next_anchor
from app.main import app
from tests.helpers import FakeResult, auth_headers_for


class FakeSession:
    async def execute(self, statement):
        return FakeResult()

    async def get(self, model: type[object], key: uuid.UUID) -> object | None:
        if model is RewardState:
            return None
        if model is User:
            return None
        return None


# ── pick_next_anchor unit tests ───────────────────────────────────────────────

def test_high_emotional_load_suggests_calm() -> None:
    state = {"emotional_load": 4, "energy_level": 3, "comeback_bonus_active": False}
    result = pick_next_anchor(state)
    assert result["action"] == "calm"
    assert result["route"] == "/calm"


def test_emotional_load_5_also_suggests_calm() -> None:
    result = pick_next_anchor(
        {"emotional_load": 5, "energy_level": 3, "comeback_bonus_active": False}
    )
    assert result["action"] == "calm"


def test_comeback_bonus_suggests_games() -> None:
    state = {"emotional_load": 2, "energy_level": 3, "comeback_bonus_active": True}
    result = pick_next_anchor(state)
    assert result["action"] == "games"


def test_low_energy_suggests_games() -> None:
    state = {"emotional_load": 2, "energy_level": 2, "comeback_bonus_active": False}
    result = pick_next_anchor(state)
    assert result["action"] == "games"


def test_energy_1_suggests_games() -> None:
    result = pick_next_anchor(
        {"emotional_load": 1, "energy_level": 1, "comeback_bonus_active": False}
    )
    assert result["action"] == "games"


def test_good_state_suggests_focus() -> None:
    state = {"emotional_load": 2, "energy_level": 4, "comeback_bonus_active": False}
    result = pick_next_anchor(state)
    assert result["action"] == "focus"
    assert result["route"] == "/focus"


def test_suggestion_has_all_required_fields() -> None:
    result = pick_next_anchor({})
    for field in ("action", "label", "route", "duration", "reason"):
        assert field in result, f"Missing field: {field}"


def test_calm_has_priority_over_comeback() -> None:
    # emotional_load >= 4 beats comeback_bonus
    state = {"emotional_load": 4, "energy_level": 3, "comeback_bonus_active": True}
    result = pick_next_anchor(state)
    assert result["action"] == "calm"


# ── first_week_label unit tests ───────────────────────────────────────────────

def test_first_week_label_day_0() -> None:
    today = date(2026, 5, 4)
    label = first_week_label(first_session_date=today, today=today)
    assert label is not None
    assert "Day 1" in label


def test_first_week_label_day_6() -> None:
    start = date(2026, 5, 1)
    today = date(2026, 5, 7)
    label = first_week_label(first_session_date=start, today=today)
    assert label is not None
    assert "Day 7" in label


def test_first_week_label_returns_none_after_week() -> None:
    start = date(2026, 4, 20)
    today = date(2026, 5, 4)
    assert first_week_label(first_session_date=start, today=today) is None


def test_first_week_label_returns_none_for_no_first_session() -> None:
    assert first_week_label(None) is None


# ── Suggestion HTTP endpoint ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_suggestion_without_user_returns_default() -> None:
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
    assert "label" in data
    assert "reason" in data
