"""Observability baseline: structured logging, request-id propagation, and an
error-tracking hook (OBS-1 / OBS-2).

- One logging configuration for the whole process (JSON by default).
- A per-request id stored in a ContextVar so every log line emitted while
  handling a request carries the same `request_id` — traces across the
  request logger, the audit logger, and any application logging.
- An optional Sentry hook, enabled only when SENTRY_DSN is set and the
  sentry-sdk package is installed.
"""

from __future__ import annotations

import json
import logging
from contextvars import ContextVar

# The current request's id. Empty string when outside a request.
request_id_var: ContextVar[str] = ContextVar("request_id", default="")


class _RequestIdFilter(logging.Filter):
    """Attach the current request_id to every record so formatters can use it."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get() or "-"
        return True


class _JsonFormatter(logging.Formatter):
    """Compact JSON log lines. Messages that are already JSON objects are
    merged in so the existing structured request log stays a single object."""

    def format(self, record: logging.LogRecord) -> str:
        message = record.getMessage()
        base: dict[str, object] = {
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", "-"),
        }

        merged = False
        if message.startswith("{") and message.endswith("}"):
            try:
                base.update(json.loads(message))
                merged = True
            except ValueError:
                pass
        if not merged:
            base["message"] = message

        if record.exc_info:
            base["exc_info"] = self.formatException(record.exc_info)

        return json.dumps(base, separators=(",", ":"), default=str)


def configure_logging(*, level: str = "INFO", json_logs: bool = True) -> None:
    """Install a single root logging handler for the process."""
    handler = logging.StreamHandler()
    handler.addFilter(_RequestIdFilter())
    if json_logs:
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)s [%(request_id)s] %(name)s %(message)s"
            )
        )

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())

    # Tame uvicorn's own access log — our request logger already covers it.
    logging.getLogger("uvicorn.access").handlers.clear()


def init_error_tracking(*, dsn: str, environment: str) -> bool:
    """Initialize Sentry error tracking if a DSN is set and the SDK is present.

    Returns True when enabled. No-op (and a log line) otherwise, so the app
    runs identically with or without error tracking configured.
    """
    logger = logging.getLogger("anchor.observability")
    if not dsn:
        logger.info("error tracking disabled — SENTRY_DSN not set")
        return False
    try:
        import sentry_sdk  # type: ignore[import-not-found]
    except ImportError:
        logger.warning(
            "SENTRY_DSN set but sentry-sdk not installed — run `uv add sentry-sdk`"
        )
        return False

    sentry_sdk.init(dsn=dsn, environment=environment, traces_sample_rate=0.0)
    logger.info("error tracking enabled environment=%s", environment)
    return True


def capture_exception(exc: BaseException) -> None:
    """Forward an exception to Sentry if configured; always safe to call."""
    try:
        import sentry_sdk

        sentry_sdk.capture_exception(exc)
    except Exception:
        pass
