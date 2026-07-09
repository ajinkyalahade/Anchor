"""Idempotency-Key middleware for POST endpoints."""

from __future__ import annotations

import base64
import hashlib
import json
from dataclasses import dataclass
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Message


@dataclass(slots=True)
class StoredIdempotentResponse:
    request_hash: str
    status_code: int
    body: bytes
    headers: dict[str, str]
    media_type: str | None


class IdempotencyKeyMiddleware(BaseHTTPMiddleware):
    """Replay successful POST responses for duplicate Idempotency-Key requests."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        if request.method != "POST":
            return await call_next(request)

        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return await call_next(request)

        body = await request.body()
        request_hash = hashlib.sha256(body).hexdigest()
        store = _get_store(request)
        cache_key = _build_cache_key(request.url.path, idempotency_key)
        existing = store.get(cache_key) or await _load_cached_response(request, cache_key)

        if existing is not None:
            if existing.request_hash != request_hash:
                return JSONResponse(
                    status_code=409,
                    content={
                        "detail": (
                            "Idempotency-Key has already been used "
                            "with a different request body"
                        )
                    },
                )
            replay_headers = dict(existing.headers)
            replay_headers["X-Idempotent-Replayed"] = "true"
            return Response(
                content=existing.body,
                status_code=existing.status_code,
                headers=replay_headers,
                media_type=existing.media_type,
            )

        await _reset_request_body(request, body)
        response = await call_next(request)
        response_body = b"".join([chunk async for chunk in response.body_iterator])

        replayable = Response(
            content=response_body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

        if response.status_code < 500:
            stored_response = StoredIdempotentResponse(
                request_hash=request_hash,
                status_code=response.status_code,
                body=response_body,
                headers=_filter_headers(replayable.headers),
                media_type=replayable.media_type,
            )
            store[cache_key] = stored_response
            await _store_cached_response(request, cache_key, stored_response)

        return replayable


def _get_store(request: Request) -> dict[str, StoredIdempotentResponse]:
    state = request.app.state
    store = getattr(state, "idempotency_store", None)
    if store is None:
        store = {}
        state.idempotency_store = store
    return store


def _filter_headers(headers: dict[str, str] | Any) -> dict[str, str]:
    return {
        key: value
        for key, value in dict(headers).items()
        if key.lower() not in {"content-length"}
    }


def _build_cache_key(path: str, idempotency_key: str) -> str:
    return f"idempotency:{path}:{idempotency_key}"


async def _load_cached_response(
    request: Request,
    cache_key: str,
) -> StoredIdempotentResponse | None:
    cache = getattr(request.app.state, "cache", None)
    if cache is None:
        return None

    raw = await cache.get_text(cache_key)
    if raw is None:
        return None

    try:
        payload = json.loads(raw)
        stored = StoredIdempotentResponse(
            request_hash=payload["request_hash"],
            status_code=int(payload["status_code"]),
            body=base64.b64decode(payload["body"]),
            headers=dict(payload["headers"]),
            media_type=payload.get("media_type"),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None

    _get_store(request)[cache_key] = stored
    return stored


async def _store_cached_response(
    request: Request,
    cache_key: str,
    response: StoredIdempotentResponse,
) -> None:
    cache = getattr(request.app.state, "cache", None)
    if cache is None:
        return

    payload = json.dumps(
        {
            "request_hash": response.request_hash,
            "status_code": response.status_code,
            "body": base64.b64encode(response.body).decode("ascii"),
            "headers": response.headers,
            "media_type": response.media_type,
        }
    )
    await cache.set_text(cache_key, payload, ttl_seconds=60 * 60 * 24)


async def _reset_request_body(request: Request, body: bytes) -> None:
    sent = False

    async def receive() -> Message:
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    request._receive = receive  # type: ignore[attr-defined]
