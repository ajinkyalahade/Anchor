"""Tests for LiveKit-compatible room token issuance."""

import base64
import json
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.helpers import auth_headers_for


def _decode_payload(token: str) -> dict[str, object]:
    _, payload_part, _ = token.split(".")
    padding = "=" * (-len(payload_part) % 4)
    return json.loads(base64.urlsafe_b64decode(f"{payload_part}{padding}"))


@pytest.mark.asyncio
async def test_room_token_returns_503_when_livekit_is_unconfigured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api import rooms
    from app.core.config import Settings

    monkeypatch.setattr(
        rooms,
        "get_settings",
        lambda: Settings(livekit_url="", livekit_api_key="", livekit_api_secret=""),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/rooms/token",
            json={},
            headers=auth_headers_for(uuid.uuid4()),
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "Live rooms are not configured"


@pytest.mark.asyncio
async def test_room_token_returns_livekit_compatible_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api import rooms
    from app.core.config import Settings

    monkeypatch.setattr(
        rooms,
        "get_settings",
        lambda: Settings(
            livekit_url="wss://anchor.livekit.test",
            livekit_api_key="livekit-test-key",
            livekit_api_secret="livekit-test-secret",
        ),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/rooms/token",
            json={
                "room_name": "Deep Focus",
                "participant_name": "Alex Morgan",
                "participant_metadata": '{"commitment":"Inbox reset"}',
                "participant_attributes": {"commitment": "Inbox reset"},
            },
            headers=auth_headers_for(uuid.uuid4()),
        )

    assert response.status_code == 201
    data = response.json()
    assert data["server_url"] == "wss://anchor.livekit.test"
    assert data["room_name"] == "deep-focus"
    assert data["room_policy"]["max_participants"] == 4
    assert data["room_policy"]["chat_enabled"] is False

    claims = _decode_payload(data["participant_token"])
    assert claims["iss"] == "livekit-test-key"
    assert claims["sub"].startswith("alex-")
    assert claims["name"] == "Alex"
    assert claims["metadata"] == '{"commitment":"Inbox reset"}'
    assert claims["attributes"] == {"commitment": "Inbox reset"}
    assert claims["video"] == {
        "room": "deep-focus",
        "roomJoin": True,
        "canPublish": True,
        "canSubscribe": True,
    }
    assert isinstance(claims["nbf"], int)
    assert isinstance(claims["exp"], int)
    assert claims["exp"] > claims["nbf"]


@pytest.mark.asyncio
async def test_room_token_rejects_room_config_until_transport_is_added(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api import rooms
    from app.core.config import Settings

    monkeypatch.setattr(
        rooms,
        "get_settings",
        lambda: Settings(
            livekit_url="wss://anchor.livekit.test",
            livekit_api_key="livekit-test-key",
            livekit_api_secret="livekit-test-secret",
        ),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/rooms/token",
            json={"room_config": {"max_participants": 4}},
            headers=auth_headers_for(uuid.uuid4()),
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "room_config is not supported yet"
