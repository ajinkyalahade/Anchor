import uuid

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_current_user_id
from app.core.rate_limit import RateLimiter, build_rate_limit_dependency


@pytest.mark.asyncio
async def test_rate_limiter_memory_fallback_enforces_limit() -> None:
    limiter = RateLimiter("redis://localhost:6379/99")
    limiter._redis = None
    key = "rate-limit:test:user"

    for _ in range(10):
        assert await limiter.hit(key, max_requests=10, window_seconds=60) is None

    retry_after = await limiter.hit(key, max_requests=10, window_seconds=60)
    assert retry_after is not None
    assert retry_after >= 1


def test_rate_limit_dependency_returns_429_with_retry_after() -> None:
    app = FastAPI()
    app.state.rate_limiter = RateLimiter("redis://localhost:6379/99")
    app.state.rate_limiter._redis = None
    user_id = uuid.uuid4()
    dependency = build_rate_limit_dependency("test", max_requests=1, window_seconds=60)

    @app.get("/limited")
    async def limited(_: None = Depends(dependency)) -> dict[str, str]:
        return {"status": "ok"}

    client = TestClient(app)
    app.dependency_overrides = {}

    def override_dependency():
        return user_id

    app.dependency_overrides[get_current_user_id] = override_dependency

    first = client.get("/limited")
    second = client.get("/limited")

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.headers["Retry-After"]
    assert second.json()["detail"] == "rate_limited"
