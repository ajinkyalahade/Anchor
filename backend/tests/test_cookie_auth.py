"""Cookie-based session auth + token rotation (SEC-5).

The httpOnly anchor_session cookie is the primary session carrier; the
bearer header remains supported and takes precedence. /auth/refresh rotates
the token and revokes the old jti. Real-DB tests.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def _register(client: AsyncClient) -> tuple[str, str]:
    """Returns (access_token, user_id) from a fresh anonymous account."""
    resp = await client.post("/v1/auth/register-anonymous")
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return data["access_token"], data["user_id"]


@pytest.mark.asyncio
async def test_session_cookie_authenticates_without_bearer_header() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token, user_id = await _register(client)

        client.cookies.set("anchor_session", token)
        me = await client.get("/v1/auth/me")
        assert me.status_code == 200, me.text
        assert me.json()["user_id"] == user_id


@pytest.mark.asyncio
async def test_no_credentials_is_401() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/v1/auth/me")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "not_authenticated"


@pytest.mark.asyncio
async def test_bearer_header_takes_precedence_over_cookie() -> None:
    """A garbage header must not silently fall through to a valid cookie."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token, _ = await _register(client)
        client.cookies.set("anchor_session", token)
        resp = await client.get(
            "/v1/auth/me",
            headers={"Authorization": "Bearer not.a.token"},
        )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "token_invalid"


@pytest.mark.asyncio
async def test_refresh_rotates_token_and_revokes_the_old_one() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        old_token, user_id = await _register(client)

        client.cookies.set("anchor_session", old_token)
        refreshed = await client.post("/v1/auth/refresh")
        assert refreshed.status_code == 200, refreshed.text
        body = refreshed.json()
        assert body["status"] == "refreshed"
        assert body["user_id"] == user_id
        new_token = body["access_token"]
        assert new_token != old_token
        # The response re-sets the session cookie with the new token.
        assert "anchor_session" in refreshed.headers.get("set-cookie", "")

        # Old token is dead on both transports…
        stale = await client.get(
            "/v1/auth/me", headers={"Authorization": f"Bearer {old_token}"}
        )
        assert stale.status_code == 401
        assert stale.json()["detail"] == "token_revoked"

        # …and the new one works.
        fresh = await client.get(
            "/v1/auth/me", headers={"Authorization": f"Bearer {new_token}"}
        )
        assert fresh.status_code == 200


@pytest.mark.asyncio
async def test_refresh_without_credentials_is_401() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/v1/auth/refresh")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_rejects_revoked_token() -> None:
    """A token revoked via logout can't be laundered through refresh."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token, _ = await _register(client)
        out = await client.post(
            "/v1/auth/logout", headers={"Authorization": f"Bearer {token}"}
        )
        assert out.status_code == 200

        client.cookies.set("anchor_session", token)
        resp = await client.post("/v1/auth/refresh")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "token_revoked"
