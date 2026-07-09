"""Tests for the AI router (1F.1) and prompt registry (1F.2)."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.ai.prompts.registry import (
    ALL_SPECS,
    DECOMPOSE_SPEC,
    RSD_SPEC,
    WORDGYM_SPEC,
    validate_output,
)
from app.ai.router import _FALLBACKS, ROUTING_TABLE, AIProvider, AITask, route
from app.db.database import get_db
from app.main import app
from tests.helpers import auth_headers_for


class FakeSession:
    def add(self, obj: object) -> None:
        return None

    async def commit(self) -> None:
        return None


# ── Routing table ─────────────────────────────────────────────────────────────

def test_routing_table_covers_all_tasks() -> None:
    for task in AITask:
        assert task in ROUTING_TABLE, f"{task} missing from ROUTING_TABLE"


def test_decompose_routes_to_claude() -> None:
    assert ROUTING_TABLE[AITask.DECOMPOSE] == AIProvider.CLAUDE


def test_evaluate_word_routes_to_gemini() -> None:
    assert ROUTING_TABLE[AITask.EVALUATE_WORD] == AIProvider.GEMINI


def test_rsd_routes_to_claude() -> None:
    assert ROUTING_TABLE[AITask.RSD_RESPONSE] == AIProvider.CLAUDE


# ── Fallbacks ─────────────────────────────────────────────────────────────────

def test_fallbacks_cover_all_tasks() -> None:
    for task in AITask:
        assert task in _FALLBACKS, f"No fallback defined for {task}"


def test_decompose_fallback_has_required_keys() -> None:
    fb = _FALLBACKS[AITask.DECOMPOSE]
    assert "steps" in fb
    assert "why_first_step_matters" in fb
    assert fb["steps"][0]["first"] is True
    assert fb["steps"][0]["est_minutes"] <= 2


def test_rsd_fallback_has_required_keys() -> None:
    fb = _FALLBACKS[AITask.RSD_RESPONSE]
    assert "validation" in fb
    assert "normalization" in fb


# ── route() returns fallback when no API keys are configured ──────────────────

@pytest.mark.asyncio
async def test_route_decompose_returns_fallback_without_api_key() -> None:
    result = await route(AITask.DECOMPOSE, {"task_text": "Write a report"})
    assert "steps" in result
    assert "why_first_step_matters" in result
    assert isinstance(result["steps"], list)


@pytest.mark.asyncio
async def test_route_evaluate_word_returns_fallback_without_api_key() -> None:
    result = await route(AITask.EVALUATE_WORD, {"base_word": "ocean", "user_word": "wave"})
    assert "valid" in result
    assert "score" in result


@pytest.mark.asyncio
async def test_route_rsd_returns_fallback_without_api_key() -> None:
    result = await route(AITask.RSD_RESPONSE, {"trigger_text": "They ignored me", "intensity": 7})
    assert "validation" in result
    assert "normalization" in result


# ── Prompt registry (1F.2) ────────────────────────────────────────────────────

def test_all_specs_registered() -> None:
    assert "decompose@v1" in ALL_SPECS
    assert "wordgym@v1" in ALL_SPECS
    assert "rsd@v1" in ALL_SPECS


def test_spec_ids_match_keys() -> None:
    for key, spec in ALL_SPECS.items():
        assert spec.id == key


def test_validate_output_passes_with_all_required_keys() -> None:
    valid = {"steps": [], "why_first_step_matters": "It starts movement."}
    assert validate_output(DECOMPOSE_SPEC, valid) is True


def test_validate_output_fails_when_key_missing() -> None:
    incomplete = {"steps": []}
    assert validate_output(DECOMPOSE_SPEC, incomplete) is False


def test_validate_output_wordgym_valid() -> None:
    assert (
        validate_output(
            WORDGYM_SPEC,
            {"valid": True, "score": 5, "reason": "Direct link"},
        )
        is True
    )


def test_validate_output_wordgym_missing_score() -> None:
    assert validate_output(WORDGYM_SPEC, {"valid": True, "reason": "Direct link"}) is False


def test_validate_output_rsd_valid() -> None:
    assert (
        validate_output(
            RSD_SPEC,
            {"validation": "I hear you.", "normalization": "RSD is real."},
        )
        is True
    )


def test_validate_output_rsd_optional_reframe_not_required() -> None:
    # reframe is optional — output without it should still be valid
    assert (
        validate_output(
            RSD_SPEC,
            {"validation": "I hear you.", "normalization": "Real pain."},
        )
        is True
    )


# ── HTTP layer: calm/rsd uses route() ────────────────────────────────────────

@pytest.mark.asyncio
async def test_rsd_endpoint_returns_200_with_fallback() -> None:
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/calm/rsd",
                json={"trigger_text": "They left me on read", "intensity": 6},
                headers=auth_headers_for(uuid.uuid4()),
            )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()
    assert "validation" in data
    assert data["is_crisis"] is False


@pytest.mark.asyncio
async def test_rsd_endpoint_triggers_crisis_classifier() -> None:
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/calm/rsd",
                json={"trigger_text": "I want to kill myself", "intensity": 10},
                headers=auth_headers_for(uuid.uuid4()),
            )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()
    assert data["is_crisis"] is True
    assert data["resources"] is not None
    assert len(data["resources"]) > 0
