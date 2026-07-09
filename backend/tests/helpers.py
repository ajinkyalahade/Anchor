"""Shared backend test helpers."""

import uuid
from typing import Any

from httpx import AsyncClient

from app.core.auth import build_access_token
from app.core.config import get_settings


class FakeResult:
    """Minimal stand-in for a SQLAlchemy Result in dependency-override tests."""

    def __init__(self, rows: list[Any] | None = None) -> None:
        self._rows = rows or []

    def scalar_one_or_none(self) -> Any | None:
        return self._rows[0] if self._rows else None

    def scalars(self) -> "FakeResult":
        return self

    def first(self) -> Any | None:
        return self._rows[0] if self._rows else None

    def all(self) -> list[Any]:
        return list(self._rows)

    def __iter__(self) -> Any:
        return iter(self._rows)


async def register_test_user(client: AsyncClient) -> tuple[str, dict[str, str]]:
    """Create a real anonymous user via the API (for tests that hit the DB).

    Returns (user_id, auth_headers)."""
    resp = await client.post("/v1/auth/register-anonymous")
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return data["user_id"], {"Authorization": f"Bearer {data['access_token']}"}


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
