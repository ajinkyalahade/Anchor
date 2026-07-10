"""Tests for the observability baseline: request-id propagation, structured
logging, error tracking hook, and the global exception handler (OBS-1/2)."""

import json
import logging

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.observability import (
    _JsonFormatter,
    _RequestIdFilter,
    configure_logging,
    init_error_tracking,
    request_id_var,
)
from app.main import app


@pytest.mark.asyncio
async def test_request_id_header_is_returned() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/v1/health")
    assert resp.headers.get("X-Request-Id")


@pytest.mark.asyncio
async def test_inbound_request_id_is_honored() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/v1/health", headers={"X-Request-Id": "trace-abc-123"}
        )
    assert resp.headers.get("X-Request-Id") == "trace-abc-123"


def test_json_formatter_merges_structured_message() -> None:
    formatter = _JsonFormatter()
    record = logging.LogRecord(
        name="anchor.http",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg=json.dumps({"event": "http_request", "path": "/v1/health"}),
        args=(),
        exc_info=None,
    )
    _RequestIdFilter().filter(record)
    out = json.loads(formatter.format(record))
    assert out["event"] == "http_request"
    assert out["path"] == "/v1/health"
    assert out["level"] == "INFO"
    assert "request_id" in out


def test_json_formatter_includes_request_id_from_contextvar() -> None:
    formatter = _JsonFormatter()
    token = request_id_var.set("ctx-req-42")
    try:
        record = logging.LogRecord(
            name="app.thing",
            level=logging.WARNING,
            pathname=__file__,
            lineno=1,
            msg="plain message",
            args=(),
            exc_info=None,
        )
        _RequestIdFilter().filter(record)
        out = json.loads(formatter.format(record))
    finally:
        request_id_var.reset(token)
    assert out["message"] == "plain message"
    assert out["request_id"] == "ctx-req-42"


def test_init_error_tracking_disabled_without_dsn() -> None:
    assert init_error_tracking(dsn="", environment="test") is False


def test_configure_logging_installs_single_handler() -> None:
    configure_logging(level="INFO", json_logs=True)
    root = logging.getLogger()
    assert len(root.handlers) == 1
    # Restore a plain config so other tests' caplog behavior is unaffected.
    logging.getLogger().handlers.clear()


@pytest.mark.asyncio
async def test_unhandled_exception_returns_500_with_request_id() -> None:
    # Register a route that blows up, exercising the global handler.
    @app.get("/v1/_boom_test")
    async def _boom() -> dict[str, str]:  # pragma: no cover - body raises
        raise RuntimeError("kaboom")

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/v1/_boom_test")

    assert resp.status_code == 500
    assert resp.json()["detail"] == "Something went wrong. Please try again."
    assert resp.headers.get("X-Request-Id")
