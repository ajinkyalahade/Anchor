"""Structured audit logging for sensitive data access events."""

import logging
import time

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.observability import request_id_var

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
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if not any(request.url.path.startswith(p) for p in _SENSITIVE_PREFIXES):
            return await call_next(request)

        # Reuse the per-request id set by RequestLoggingMiddleware so an audit
        # line can be correlated with the full request log.
        request_id = request_id_var.get() or getattr(
            request.state, "request_id", "-"
        )
        user_id = _audit_user_id(request)
        start = time.monotonic()
        response = await call_next(request)
        latency_ms = int((time.monotonic() - start) * 1000)

        # user_id is what makes this an audit trail — "who accessed what".
        logger.info(
            "audit method=%s path=%s status=%d latency_ms=%d user_id=%s request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            latency_ms,
            user_id,
            request_id,
        )
        response.headers.setdefault("X-Request-Id", request_id)
        return response


def _audit_user_id(request: Request) -> str:
    from app.core.request_logging import _extract_user_id

    return _extract_user_id(request) or "anonymous"
