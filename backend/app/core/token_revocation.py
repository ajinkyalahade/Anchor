"""Server-side revocation for stateless access tokens (SEC-5).

Access tokens are stateless JWTs, so logging out or revoking a stolen token
needs an explicit denylist. Each token carries a unique ``jti``; revoking it
writes ``revoked:<jti>`` into the shared cache with a TTL equal to the token's
remaining lifetime (so the entry disappears exactly when the token would have
expired anyway). The auth dependency checks this denylist on every request.

Backed by the app's AppCache (Redis with an in-memory fallback). If the cache
is unavailable the check fails open — availability of the app is not sacrificed
for revocation — but the event is logged.
"""

from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger("anchor.auth")

_PREFIX = "revoked:"


async def revoke_token(cache: Any, jti: str | None, exp: int | None) -> None:
    """Add a token's jti to the denylist until it would have expired."""
    if cache is None or not jti:
        return
    ttl = _remaining_ttl(exp)
    if ttl <= 0:
        return  # already expired — nothing to revoke
    try:
        await cache.set_text(f"{_PREFIX}{jti}", "1", ttl_seconds=ttl)
    except Exception:
        logger.warning("token_revocation_write_failed jti=%s", jti)


async def is_token_revoked(cache: Any, jti: str | None) -> bool:
    """Return True if the token has been revoked. Fails open on cache errors."""
    if cache is None or not jti:
        return False
    try:
        return await cache.get_text(f"{_PREFIX}{jti}") is not None
    except Exception:
        logger.warning("token_revocation_read_failed jti=%s", jti)
        return False


def _remaining_ttl(exp: int | None) -> int:
    if exp is None:
        # No expiry claim: keep the denylist entry for a default week.
        return 7 * 24 * 60 * 60
    return int(exp - time.time())
