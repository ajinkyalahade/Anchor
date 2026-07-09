"""Health check endpoint."""

from fastapi import APIRouter, Request
from pydantic import BaseModel
from sqlalchemy import text

from app.db.database import engine

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    version: str
    db: str
    redis: str


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """Health check — returns service status plus DB and Redis connectivity."""
    db_status = "ok"
    redis_status = "ok"

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    cache = getattr(request.app.state, "cache", None)
    redis_client = getattr(cache, "_redis", None)
    if redis_client is not None:
        try:
            await redis_client.ping()
        except Exception:
            redis_status = "error"
    else:
        redis_status = "degraded"

    overall = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
    return HealthResponse(status=overall, version="0.1.0", db=db_status, redis=redis_status)
