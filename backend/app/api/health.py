"""Health check endpoints.

OBS-3: three surfaces with distinct contracts so orchestration can read the
status code alone rather than parsing the body:

- ``/health/live``  liveness — is the process up? Always 200 (no dependency
  checks), so a Redis blip never triggers a container restart.
- ``/health/ready`` readiness — can we serve traffic? 503 when the DB (a hard
  dependency) is unreachable so the instance is pulled from rotation; Redis is
  a soft dependency (degrades to per-process limits) and stays 200.
- ``/health``       rich status for humans/dashboards; 200 with a body that
  distinguishes ok / degraded / error.
"""

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import text

from app.db.database import engine

router = APIRouter(tags=["health"])

VERSION = "0.1.0"


class HealthResponse(BaseModel):
    status: str
    version: str
    db: str
    redis: str


async def _check_db() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


async def _check_redis(request: Request) -> str:
    cache = getattr(request.app.state, "cache", None)
    redis_client = getattr(cache, "_redis", None)
    if redis_client is None:
        return "degraded"
    try:
        await redis_client.ping()
        return "ok"
    except Exception:
        return "error"


@router.get("/health/live")
async def liveness() -> dict[str, str]:
    """Liveness probe — the process is running. No dependency checks."""
    return {"status": "ok", "version": VERSION}


@router.get("/health/ready")
async def readiness(request: Request, response: Response) -> dict[str, str]:
    """Readiness probe — 503 when the DB is unreachable (hard dependency);
    Redis being down only degrades rate limiting, so it stays ready."""
    db_ok = await _check_db()
    redis_status = await _check_redis(request)
    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "db": "error", "redis": redis_status}
    return {"status": "ready", "db": "ok", "redis": redis_status}


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """Rich health for humans/dashboards — DB and Redis connectivity."""
    db_status = "ok" if await _check_db() else "error"
    redis_status = await _check_redis(request)
    overall = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
    return HealthResponse(status=overall, version=VERSION, db=db_status, redis=redis_status)


@router.get("/metrics/ai")
async def ai_metrics() -> dict[str, object]:
    """AI call/fallback counters for scraping and alerting (AI-1).

    A rising ``overall_fallback_rate`` means the AI provider is failing or
    returning unparseable output and users are silently getting canned
    responses. Unauthenticated so a metrics collector can scrape it.
    """
    from app.ai.metrics import snapshot

    return snapshot()
