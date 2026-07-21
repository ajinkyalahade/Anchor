"""Tests for the health check endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import health
from app.main import app


@pytest.mark.asyncio
async def test_health_check():
    """Health check should return 200 with status ok."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/v1/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in {"ok", "degraded"}
    assert data["version"] == "0.1.0"
    assert data["db"] in {"ok", "error"}
    assert data["redis"] in {"ok", "error", "degraded"}
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "same-origin"


@pytest.mark.asyncio
async def test_liveness_is_always_ok():
    """Liveness runs no dependency checks — always 200."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/v1/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "0.1.0"}


@pytest.mark.asyncio
async def test_readiness_ok_when_db_reachable():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/v1/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


@pytest.mark.asyncio
async def test_readiness_503_when_db_down(monkeypatch):
    """OBS-3: DB is a hard dependency — readiness must fail closed so the
    instance is pulled from rotation."""

    async def _db_down() -> bool:
        return False

    monkeypatch.setattr(health, "_check_db", _db_down)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/v1/health/ready")
    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"
    assert response.json()["db"] == "error"


@pytest.mark.asyncio
async def test_readiness_ready_when_redis_soft_down(monkeypatch):
    """Redis is a soft dependency — its absence degrades but stays ready."""

    async def _redis_degraded(request) -> str:
        return "degraded"

    monkeypatch.setattr(health, "_check_redis", _redis_degraded)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/v1/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["redis"] == "degraded"
