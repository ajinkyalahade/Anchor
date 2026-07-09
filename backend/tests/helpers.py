"""Shared backend test helpers."""

import uuid

from app.core.auth import build_access_token
from app.core.config import get_settings


def auth_headers_for(
    user_id: uuid.UUID,
    email: str | None = "tester@example.com",
) -> dict[str, str]:
    token, _ = build_access_token(
        user_id=str(user_id),
        email=email,
        secret=get_settings().jwt_secret,
    )
    return {"Authorization": f"Bearer {token}"}
