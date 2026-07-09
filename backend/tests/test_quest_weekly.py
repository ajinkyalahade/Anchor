"""Tests for weekly quest personalization preview."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.ai.prompts.registry import QUEST_WEEKLY_SPEC, validate_output
from app.main import app
from tests.helpers import auth_headers_for


def test_quest_weekly_spec_validates_expected_shape() -> None:
    payload = {
        "title": "What is actually shifting your state",
        "summary": "Dance break is doing the most work. Keep the reset short and repeatable.",
        "recommendation": "Use Dance break first when activation is stuck.",
    }
    assert validate_output(QUEST_WEEKLY_SPEC, payload) is True


@pytest.mark.asyncio
async def test_quest_weekly_preview_returns_payload_shape() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/ai/quests/weekly-preview",
            json={
                "best_quest_label": "Dance break",
                "best_average_delta": 1.6,
                "total_runs": 4,
            },
            headers=auth_headers_for(uuid.uuid4()),
        )

    assert response.status_code == 200
    data = response.json()
    assert data["title"]
    assert data["summary"]
    assert data["recommendation"]
