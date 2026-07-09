"""Shared pytest fixtures.

The FastAPI app is a module-level singleton, so its rate limiter's state
persists across tests. Some tests also build their own app via create_app(),
whose limiter talks to the real Redis. Reset both surfaces before each test
so per-endpoint limits don't bleed between unrelated tests (e.g. the many
register-anonymous calls made by test helpers).
"""

import pytest

from app.core.config import get_settings
from app.core.rate_limit import RateLimiter
from app.main import app


@pytest.fixture(autouse=True)
def _isolate_rate_limiter():
    # Module-level app: swap in a clean in-memory limiter.
    limiter = RateLimiter("redis://localhost:6379/99")
    limiter._redis = None  # force the deterministic in-memory path
    app.state.rate_limiter = limiter

    # Apps built via create_app() use the configured Redis; clear any
    # rate-limit keys it left behind so counts don't accumulate. Best-effort.
    _flush_redis_rate_limit_keys()
    yield


def _flush_redis_rate_limit_keys() -> None:
    # Synchronous client so this never touches the async test event loop.
    from redis import Redis

    try:
        client = Redis.from_url(get_settings().redis_url, decode_responses=True)
        keys = list(client.scan_iter(match="rate-limit:*"))
        if keys:
            client.delete(*keys)
        client.close()
    except Exception:
        pass
