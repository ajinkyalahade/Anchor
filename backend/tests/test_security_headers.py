"""Security header middleware tests (SEC-7)."""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.security_headers import SecurityHeadersMiddleware
from app.main import app as main_app


def _app(*, enable_hsts: bool) -> FastAPI:
    test_app = FastAPI(docs_url="/v1/docs")
    test_app.add_middleware(SecurityHeadersMiddleware, enable_hsts=enable_hsts)

    @test_app.get("/thing")
    async def thing() -> dict[str, str]:
        return {"ok": "yes"}

    return test_app


@pytest.mark.asyncio
async def test_api_responses_carry_full_header_set() -> None:
    transport = ASGITransport(app=main_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/v1/health")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "same-origin"
    assert response.headers["Permissions-Policy"] == "geolocation=(), microphone=(), camera=()"
    assert response.headers["Content-Security-Policy"] == (
        "default-src 'none'; frame-ancestors 'none'"
    )
    # Dev/test environment: HSTS only makes sense behind TLS in production.
    assert "Strict-Transport-Security" not in response.headers


@pytest.mark.asyncio
async def test_docs_page_is_exempt_from_api_csp() -> None:
    """Swagger UI loads CDN assets; the deny-all API CSP would blank it."""
    transport = ASGITransport(app=main_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/v1/docs")

    assert response.status_code == 200
    assert "Content-Security-Policy" not in response.headers


@pytest.mark.asyncio
async def test_hsts_emitted_when_enabled() -> None:
    transport = ASGITransport(app=_app(enable_hsts=True))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/thing")

    assert response.headers["Strict-Transport-Security"] == (
        "max-age=63072000; includeSubDomains"
    )
