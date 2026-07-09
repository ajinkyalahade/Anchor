import pytest

from app.core.cache import AppCache


@pytest.mark.asyncio
async def test_app_cache_memory_fallback_round_trip() -> None:
    cache = AppCache("redis://localhost:6379/99")
    cache._redis = None
    await cache.set_json("cache:test", {"value": 1}, ttl_seconds=60)
    assert await cache.get_json("cache:test") == {"value": 1}


@pytest.mark.asyncio
async def test_app_cache_memory_fallback_expires() -> None:
    cache = AppCache("redis://localhost:6379/99")
    cache._redis = None
    await cache.set_json("cache:short", {"value": 1}, ttl_seconds=0)
    assert await cache.get_json("cache:short") is None
