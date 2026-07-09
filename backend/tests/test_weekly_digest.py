"""Tests for weekly insight digest preview."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.ai.prompts.registry import INSIGHT_WEEKLY_SPEC, validate_output
from app.main import app
from tests.helpers import auth_headers_for


def test_insight_weekly_prompt_spec_validates_expected_shape() -> None:
    payload = {
        "title": "Weekly pattern read",
        "summary": "Mornings are cleaner than late-day sessions.",
        "bullets": ["One", "Two", "Three"],
        "delivery_label": "Sunday, 9:00 AM",
    }
    assert validate_output(INSIGHT_WEEKLY_SPEC, payload) is True


@pytest.mark.asyncio
async def test_weekly_digest_preview_returns_fallback_shape() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/ai/weekly-digest/preview",
            json={
                "sessions_count": 15,
                "morning_focus_score": 82,
                "best_focus_score": 91,
                "avg_session_minutes": 21,
                "sleep_hours": 7.5,
                "caffeine_label": "Low",
                "delivery_label": "Sunday, 9:00 AM",
            },
            headers=auth_headers_for(uuid.uuid4()),
        )

    assert response.status_code == 200
    data = response.json()
    assert data["title"]
    assert data["summary"]
    assert len(data["bullets"]) == 3
    assert data["delivery_label"] == "Sunday, 9:00 AM"
