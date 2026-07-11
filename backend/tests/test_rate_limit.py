import uuid

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_current_user_id
from app.core.rate_limit import RateLimiter, build_rate_limit_dependency


class _FakePipeline:
    def __init__(self, fail: bool) -> None:
        self._fail = fail

    def zremrangebyscore(self, *args: object) -> None: ...
    def zcard(self, *args: object) -> None: ...
    def zadd(self, *args: object) -> None: ...
    def expire(self, *args: object) -> None: ...

    async def execute(self) -> list[int]:
        if self._fail:
            raise ConnectionError("redis down")
        return [0, 0, 1, 1]


class _FakeRedis:
    def __init__(self) -> None:
        self.fail = True
        self.pipeline_calls = 0

    def pipeline(self) -> _FakePipeline:
        self.pipeline_calls += 1
        return _FakePipeline(self.fail)


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


@pytest.mark.asyncio
async def test_rate_limiter_reconnects_to_redis_after_backoff() -> None:
    """Regression (BE-3): a Redis failure must degrade temporarily, not
    permanently — after the backoff window, Redis is tried again."""
    limiter = RateLimiter("redis://localhost:6379/99")
    fake = _FakeRedis()
    limiter._redis = fake  # type: ignore[assignment]

    # First hit: Redis raises → memory fallback, backoff window opens.
    assert await limiter.hit("k", max_requests=10, window_seconds=60) is None
    assert fake.pipeline_calls == 1
    assert limiter._retry_at > 0

    # Within the backoff window Redis is not retried.
    assert await limiter.hit("k", max_requests=10, window_seconds=60) is None
    assert fake.pipeline_calls == 1

    # Backoff elapsed and Redis is healthy again → used and backoff reset.
    fake.fail = False
    limiter._retry_at = 0.0
    assert await limiter.hit("k", max_requests=10, window_seconds=60) is None
    assert fake.pipeline_calls == 2
    assert limiter._backoff == RateLimiter._INITIAL_BACKOFF_SECONDS


@pytest.mark.asyncio
async def test_rate_limiter_backoff_grows_until_capped() -> None:
    limiter = RateLimiter("redis://localhost:6379/99")
    fake = _FakeRedis()
    limiter._redis = fake  # type: ignore[assignment]

    backoffs = []
    for _ in range(8):
        limiter._retry_at = 0.0  # force a retry each iteration
        await limiter.hit("k", max_requests=10, window_seconds=60)
        backoffs.append(limiter._backoff)

    assert backoffs[0] == 2.0  # doubled after the first failure
    assert backoffs[-1] == RateLimiter._MAX_BACKOFF_SECONDS
    assert all(b <= RateLimiter._MAX_BACKOFF_SECONDS for b in backoffs)


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
