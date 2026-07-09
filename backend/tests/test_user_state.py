"""Tests for user state (1F.3), AI feedback (1F.4), and privacy utils (1F.5)."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.ai import pseudonymise_user_id
from app.db.database import get_db
from app.db.models import RewardState, User, UserStateSnapshot
from app.domain.user_state.service import _clamp, compute_user_state
from app.main import app
from tests.helpers import FakeResult, auth_headers_for


class FakeSession:
    def add(self, obj: object) -> None:
        return None

    async def execute(self, statement):
        return FakeResult()

    async def get(self, model: type[object], key: uuid.UUID) -> object | None:
        if model in {RewardState, User, UserStateSnapshot}:
            return None
        return None

    async def flush(self) -> None:
        return None

# ── User state service unit tests (1F.3) ──────────────────────────────────────

def test_clamp_enforces_bounds() -> None:
    assert _clamp(0) == 1
    assert _clamp(6) == 5
    assert _clamp(3) == 3


def test_compute_user_state_all_fields_present() -> None:
    state = compute_user_state(
        xp_by_source={"focus": 100, "calm": 60, "wordgym": 40},
        total_xp=200,
        streak_state="steady",
        comeback_bonus_active=False,
        crash_window="Afternoon",
    )
    required = {
        "energy_level", "recent_focus_quality", "emotional_load",
        "cognitive_freshness", "preferred_modalities",
        "crash_window_local", "current_streak_state", "comeback_bonus_active",
    }
    assert required.issubset(state.keys())


def test_compute_user_state_values_in_range() -> None:
    state = compute_user_state(
        xp_by_source={"focus": 200, "calm": 150, "wordgym": 90},
        total_xp=440,
        streak_state="steady",
        comeback_bonus_active=False,
        crash_window=None,
    )
    for field in ("energy_level", "recent_focus_quality", "emotional_load", "cognitive_freshness"):
        assert 1 <= state[field] <= 5, f"{field}={state[field]} out of range"


def test_compute_user_state_zero_xp_returns_defaults() -> None:
    state = compute_user_state(
        xp_by_source={},
        total_xp=0,
        streak_state="building",
        comeback_bonus_active=False,
        crash_window=None,
    )
    assert state["preferred_modalities"] == ["focus"]
    assert state["energy_level"] == 1


def test_compute_user_state_preferred_modalities_ordered_by_xp() -> None:
    state = compute_user_state(
        xp_by_source={"calm": 200, "focus": 50, "wordgym": 10},
        total_xp=260,
        streak_state="building",
        comeback_bonus_active=False,
        crash_window=None,
    )
    assert state["preferred_modalities"][0] == "calm"


def test_compute_user_state_passes_streak_and_crash_window() -> None:
    state = compute_user_state(
        xp_by_source={},
        total_xp=0,
        streak_state="recovering",
        comeback_bonus_active=True,
        crash_window="Evening",
    )
    assert state["current_streak_state"] == "recovering"
    assert state["comeback_bonus_active"] is True
    assert state["crash_window_local"] == "Evening"


# ── User state HTTP endpoint ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_user_state_without_user_id_returns_defaults() -> None:
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/v1/ai/user-state", headers=auth_headers_for(uuid.uuid4()))
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["current_streak_state"] == "building"
    assert 1 <= data["energy_level"] <= 5


# ── AI Feedback HTTP endpoint (1F.4) ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_ai_feedback_rejects_invalid_helpful_value() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/ai/feedback",
            json={
                "task": "decompose",
                "prompt_id": "decompose@v1",
                "content_hash": "abc123",
                "latency_ms": 800,
                "helpful": 2,  # invalid
            },
            headers=auth_headers_for(uuid.uuid4()),
        )
    assert response.status_code == 422


# ── Pseudonymisation (1F.5) ───────────────────────────────────────────────────

def test_pseudonymise_produces_16_char_hex() -> None:
    uid = uuid.uuid4()
    result = pseudonymise_user_id(uid)
    assert len(result) == 16
    assert all(c in "0123456789abcdef" for c in result)


def test_pseudonymise_is_deterministic() -> None:
    uid = uuid.uuid4()
    assert pseudonymise_user_id(uid) == pseudonymise_user_id(uid)


def test_pseudonymise_different_users_produce_different_tokens() -> None:
    a, b = uuid.uuid4(), uuid.uuid4()
    assert pseudonymise_user_id(a) != pseudonymise_user_id(b)


def test_pseudonymise_does_not_contain_original_uuid() -> None:
    uid = uuid.uuid4()
    token = pseudonymise_user_id(uid)
    assert str(uid).replace("-", "") not in token
