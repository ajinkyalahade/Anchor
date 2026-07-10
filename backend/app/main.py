# SPDX-License-Identifier: MIT
"""Anchor — FastAPI application factory."""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import get_current_user_id
from app.api.health import router as health_router
from app.core.audit import AuditMiddleware
from app.core.cache import AppCache
from app.core.config import get_settings
from app.core.idempotency import IdempotencyKeyMiddleware
from app.core.rate_limit import RateLimiter
from app.core.request_logging import RequestLoggingMiddleware
from app.core.security_headers import SecurityHeadersMiddleware


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    # Observability first, so startup itself is logged/tracked (OBS-1/2).
    from app.core.observability import configure_logging, init_error_tracking

    configure_logging(level=settings.log_level, json_logs=settings.log_json)
    init_error_tracking(dsn=settings.sentry_dsn, environment=settings.app_env)

    app = FastAPI(
        title="Anchor API",
        description=(
            "AI-powered companion for adults with ADHD, anxiety,"
            " and executive-function challenges."
        ),
        version="0.1.0",
        docs_url="/v1/docs",
        openapi_url="/v1/openapi.json",
    )
    app.state.idempotency_store = {}
    app.state.cache = AppCache(settings.redis_url)
    app.state.rate_limiter = RateLimiter(settings.redis_url)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(IdempotencyKeyMiddleware)
    app.add_middleware(AuditMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    # Telemetry (no-op when OTLP_ENDPOINT not set)
    from app.core.telemetry import setup_telemetry
    setup_telemetry(
        app,
        otlp_endpoint=settings.otlp_endpoint,
        service_name=settings.otlp_service_name,
    )

    # Register routers
    from app.api.account import router as account_router
    from app.api.ai import router as ai_router
    from app.api.auth import router as auth_router
    from app.api.calm import router as calm_router
    from app.api.focus import router as focus_router
    from app.api.games import router as games_router
    from app.api.notifications import router as notifications_router
    from app.api.onboarding import router as onboarding_router
    from app.api.rewards import router as rewards_router
    from app.api.rooms import router as rooms_router
    from app.api.wearable import router as wearable_router

    app.include_router(health_router, prefix="/v1")
    app.include_router(auth_router, prefix="/v1")
    app.include_router(onboarding_router, prefix="/v1")

    # Protected routes
    auth_dep = [Depends(get_current_user_id)]
    app.include_router(account_router, prefix="/v1", dependencies=auth_dep)
    app.include_router(focus_router, prefix="/v1", dependencies=auth_dep)
    app.include_router(games_router, prefix="/v1", dependencies=auth_dep)
    app.include_router(calm_router, prefix="/v1", dependencies=auth_dep)
    app.include_router(notifications_router, prefix="/v1", dependencies=auth_dep)
    app.include_router(rooms_router, prefix="/v1", dependencies=auth_dep)
    app.include_router(rewards_router, prefix="/v1", dependencies=auth_dep)
    app.include_router(ai_router, prefix="/v1", dependencies=auth_dep)
    app.include_router(wearable_router, prefix="/v1", dependencies=auth_dep)

    _register_exception_handler(app)

    return app


def _register_exception_handler(app: FastAPI) -> None:
    """Log unhandled exceptions with the request id and forward them to error
    tracking, so a 500 is never silent (OBS-1)."""
    import logging

    from starlette.requests import Request
    from starlette.responses import JSONResponse

    from app.core.observability import capture_exception, request_id_var

    logger = logging.getLogger("anchor.error")

    @app.exception_handler(Exception)
    async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        request_id = request_id_var.get() or "-"
        logger.exception(
            "unhandled_exception method=%s path=%s request_id=%s",
            request.method,
            request.url.path,
            request_id,
        )
        capture_exception(exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Something went wrong. Please try again."},
            headers={"X-Request-Id": request_id},
        )


app = create_app()
