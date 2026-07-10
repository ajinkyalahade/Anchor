"""Structured request logging middleware."""

from __future__ import annotations

import json
import logging
import time
import uuid

import jwt
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.config import get_settings
from app.core.observability import request_id_var

logger = logging.getLogger("anchor.http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Source of truth for the per-request id: honor an inbound
        # X-Request-Id (e.g. from a load balancer) or mint one, and publish
        # it so every log line in this request — and the audit log — shares it.
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        token = request_id_var.set(request_id)
        request.state.request_id = request_id
        start = time.monotonic()
        user_id = _extract_user_id(request)

        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        duration_ms = int((time.monotonic() - start) * 1000)

        payload = {
            "event": "http_request",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
            "user_id": user_id,
        }
        logger.info(json.dumps(payload, separators=(",", ":")))
        response.headers.setdefault("X-Request-Id", request_id)
        return response


def _extract_user_id(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except Exception:
        return None
    subject = payload.get("sub")
    return str(subject) if subject else None
