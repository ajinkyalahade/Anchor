"""Live body double room token endpoints."""

import base64
import hashlib
import hmac
import json
import re
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import get_settings

router = APIRouter(prefix="/rooms", tags=["rooms"])

DEFAULT_ROOM_NAME = "anchor-body-double"
TOKEN_TTL_SECONDS = 10 * 60
ROOM_POLICY = {
    "max_participants": 4,
    "chat_enabled": False,
    "recordings_enabled": False,
    "first_names_only": True,
    "mute_default": True,
}


class RoomTokenRequest(BaseModel):
    room_name: str | None = Field(default=None, max_length=64)
    participant_identity: str | None = Field(default=None, max_length=80)
    participant_name: str | None = Field(default=None, max_length=32)
    participant_metadata: str | None = Field(default=None, max_length=280)
    participant_attributes: dict[str, str] = Field(default_factory=dict)
    room_config: dict[str, Any] | None = None


class RoomTokenResponse(BaseModel):
    server_url: str
    participant_token: str
    room_name: str
    room_policy: dict[str, Any]


@router.post(
    "/token",
    response_model=RoomTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_room_token(data: RoomTokenRequest) -> RoomTokenResponse:
    """Issue a LiveKit-compatible participant token for body double rooms."""
    settings = get_settings()
    if not settings.livekit_url or not settings.livekit_api_key or not settings.livekit_api_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Live rooms are not configured",
        )

    if data.room_config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="room_config is not supported yet",
        )

    room_name = _normalize_room_name(data.room_name or DEFAULT_ROOM_NAME)
    participant_name = _normalize_participant_name(data.participant_name or "Anchor guest")
    participant_identity = data.participant_identity or _build_participant_identity(
        participant_name
    )
    participant_metadata = data.participant_metadata or ""
    claims = _build_token_claims(
        api_key=settings.livekit_api_key,
        room_name=room_name,
        participant_identity=participant_identity,
        participant_name=participant_name,
        participant_metadata=participant_metadata,
        participant_attributes=data.participant_attributes,
    )
    token = _encode_jwt(claims, settings.livekit_api_secret)

    return RoomTokenResponse(
        server_url=settings.livekit_url,
        participant_token=token,
        room_name=room_name,
        room_policy=ROOM_POLICY,
    )


def _build_token_claims(
    *,
    api_key: str,
    room_name: str,
    participant_identity: str,
    participant_name: str,
    participant_metadata: str,
    participant_attributes: dict[str, str],
) -> dict[str, Any]:
    now = int(time.time())
    return {
        "iss": api_key,
        "sub": participant_identity,
        "name": participant_name,
        "nbf": now,
        "exp": now + TOKEN_TTL_SECONDS,
        "metadata": participant_metadata,
        "attributes": participant_attributes,
        "video": {
            "room": room_name,
            "roomJoin": True,
            "canPublish": True,
            "canSubscribe": True,
        },
    }


def _encode_jwt(payload: dict[str, Any], secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_part = _base64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_part = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_part}.{payload_part}".encode()
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    signature_part = _base64url_encode(signature)
    return f"{header_part}.{payload_part}.{signature_part}"


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _normalize_room_name(value: str) -> str:
    collapsed = re.sub(r"[^a-z0-9-]+", "-", value.lower()).strip("-")
    return collapsed[:64] or DEFAULT_ROOM_NAME


def _normalize_participant_name(value: str) -> str:
    words = re.findall(r"[A-Za-z0-9']+", value.strip())
    if not words:
        return "Anchor guest"
    return words[0][:32]


def _build_participant_identity(participant_name: str) -> str:
    slug = _normalize_room_name(participant_name).replace("-", "") or "guest"
    return f"{slug}-{uuid.uuid4().hex[:8]}"
