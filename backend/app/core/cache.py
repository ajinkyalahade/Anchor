"""Small Redis-backed cache helpers for expensive API endpoints."""

from __future__ import annotations

import json
import time
from typing import Any

from redis.asyncio import Redis


class AppCache:
    """Redis-backed cache with an in-memory fallback for local/test use."""

    def __init__(self, redis_url: str) -> None:
        self._redis: Redis | None = Redis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        self._memory: dict[str, tuple[float, str]] = {}

    async def get_json(self, key: str) -> dict[str, Any] | None:
        raw = await self.get_text(key)
        return json.loads(raw) if raw else None

    async def set_json(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None:
        await self.set_text(key, json.dumps(value), ttl_seconds)

    async def get_text(self, key: str) -> str | None:
        redis_client = self._redis
        if redis_client is not None:
            try:
                value: str | None = await redis_client.get(key)
                return value
            except Exception:
                self._redis = None

        item = self._memory.get(key)
        if item is None:
            return None
        expires_at, raw = item
        if expires_at <= time.time():
            self._memory.pop(key, None)
            return None
        return raw

    async def set_text(self, key: str, value: str, ttl_seconds: int) -> None:
        redis_client = self._redis
        if redis_client is not None:
            try:
                await redis_client.set(key, value, ex=ttl_seconds)
                return
            except Exception:
                self._redis = None

        self._memory[key] = (time.time() + ttl_seconds, value)
