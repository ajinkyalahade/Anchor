"""Structured audit logging for sensitive data access events."""

import logging
import time
import uuid
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("anchor.audit")

_SENSITIVE_PREFIXES = (
    "/v1/calm/rsd",
    "/v1/focus/sessions",
    "/v1/games/sessions",
    "/v1/rewards",
    "/v1/account",
    "/v1/notifications",
)


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not any(request.url.path.startswith(p) for p in _SENSITIVE_PREFIXES):
            return await call_next(request)

        request_id = str(uuid.uuid4())
        start = time.monotonic()
        response = await call_next(request)
        latency_ms = int((time.monotonic() - start) * 1000)

        logger.info(
            "audit method=%s path=%s status=%d latency_ms=%d request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            latency_ms,
            request_id,
        )
        response.headers["X-Request-Id"] = request_id
        return response
