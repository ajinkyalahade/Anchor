"""Simple rate limiting for high-cost AI endpoints."""

from __future__ import annotations

import time
import uuid
from collections import deque
from collections.abc import Awaitable, Callable

from fastapi import HTTPException, Request, status
from redis.asyncio import Redis

from app.api.deps import CurrentUserId

RateLimitConfig = tuple[int, int]  # max_requests, window_seconds


class RateLimiter:
    """Redis-backed limiter with an in-memory fallback for local/test use."""

    def __init__(self, redis_url: str) -> None:
        self._redis: Redis | None = Redis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        self._memory: dict[str, deque[float]] = {}

    async def hit(self, key: str, *, max_requests: int, window_seconds: int) -> int | None:
        redis_client = self._redis
        if redis_client is not None:
            try:
                now = time.time()
                pipe = redis_client.pipeline()
                pipe.zremrangebyscore(key, 0, now - window_seconds)
                pipe.zcard(key)
                pipe.zadd(key, {str(now): now})
                pipe.expire(key, window_seconds)
                _, current_count, _, _ = await pipe.execute()
                if int(current_count) >= max_requests:
                    return window_seconds
                return None
            except Exception:
                self._redis = None

        now = time.time()
        bucket = self._memory.setdefault(key, deque())
        while bucket and now - bucket[0] >= window_seconds:
            bucket.popleft()
        if len(bucket) >= max_requests:
            retry_after = max(1, int(window_seconds - (now - bucket[0])))
            return retry_after
        bucket.append(now)
        return None


def build_rate_limit_dependency(
    bucket: str,
    *,
    max_requests: int,
    window_seconds: int,
) -> Callable[[Request, uuid.UUID], Awaitable[None]]:
    async def dependency(
        request: Request,
        user_id: CurrentUserId,
    ) -> None:
        limiter: RateLimiter | None = getattr(request.app.state, "rate_limiter", None)
        if limiter is None:
            return

        retry_after = await limiter.hit(
            f"rate-limit:{bucket}:{user_id}",
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="rate_limited",
                headers={"Retry-After": str(retry_after)},
            )

    return dependency
