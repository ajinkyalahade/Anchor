"""Push notification subscription and delivery endpoints (1G.1)."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserId
from app.core.config import get_settings
from app.db.database import get_db
from app.db.models import PushSubscription

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])

settings = get_settings()
DbSession = Annotated[AsyncSession, Depends(get_db)]

_CRASH_WINDOW_HOURS: dict[str, int] = {
    "morning": 9,
    "midday": 12,
    "afternoon": 15,
    "evening": 19,
    "late_night": 22,
}


class PushSubscribeRequest(BaseModel):
    subscription: dict
    crash_window: str  # morning|midday|afternoon|evening|late_night


class PushSubscribeResponse(BaseModel):
    registered: bool
    crash_hour: int


@router.post("/subscribe", response_model=PushSubscribeResponse)
async def subscribe_to_push(
    data: PushSubscribeRequest,
    user_id: CurrentUserId,
    db: DbSession,
) -> PushSubscribeResponse:
    """Register a push subscription for crash-time notifications."""
    crash_hour = _CRASH_WINDOW_HOURS.get(data.crash_window, 9)
    sub = PushSubscription(
        user_id=user_id,
        subscription=data.subscription,
        crash_window=data.crash_window,
        crash_hour=crash_hour,
    )
    db.add(sub)
    await db.flush()
    logger.info("push_subscribe user=%s crash_window=%s", user_id, data.crash_window)
    return PushSubscribeResponse(registered=True, crash_hour=crash_hour)


@router.get("/vapid-public-key")
async def get_vapid_public_key() -> dict[str, str]:
    return {"public_key": settings.vapid_public_key}


def send_push_notification(subscription: dict, payload: dict) -> bool:
    """Send a web push to one subscription. Returns True on success."""
    if not settings.vapid_private_key:
        logger.warning("push_skipped no VAPID key configured")
        return False
    try:
        import json

        from pywebpush import webpush  # type: ignore[import-untyped]

        webpush(
            subscription_info=subscription,
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": f"mailto:{settings.vapid_contact_email}"},
        )
        return True
    except Exception as exc:
        logger.warning("push_failed error=%s", str(exc))
        return False
