"""BE-9: interactive docs + OpenAPI schema are gated out of production."""

import base64
import os

import pytest
from httpx import ASGITransport, AsyncClient

from app import main
from app.core.config import Settings

_STRONG = "x" * 48
_KEY = base64.b64encode(os.urandom(32)).decode()

_PROD = Settings(
    app_env="production",
    app_debug=False,
    jwt_secret=_STRONG,
    magic_link_secret=_STRONG,
    field_encryption_key=_KEY,
)


async def _get(app, path: str) -> int:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return (await client.get(path)).status_code


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/v1/docs", "/v1/redoc", "/v1/openapi.json"])
async def test_docs_disabled_in_production(monkeypatch, path: str) -> None:
    monkeypatch.setattr(main, "get_settings", lambda: _PROD)
    app = main.create_app()
    assert await _get(app, path) == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/v1/docs", "/v1/openapi.json"])
async def test_docs_enabled_outside_production(path: str) -> None:
    # Default settings are development; the module-level app serves docs.
    assert await _get(main.app, path) == 200
