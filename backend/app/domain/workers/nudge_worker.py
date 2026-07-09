"""Proactive nudge worker — checks user state and fires push notifications.

Designed to be called on a schedule (e.g. every 30 min via RQ or cron).
Triggers a nudge if any of:
  - User is within 30 min of their crash window
  - Streak is active but no activity in 20+ hours (about to break)
  - No focus session in 3+ hours AND it's during waking hours (8am–10pm)
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.ai.router import AITask, route
from app.db.database import async_session_factory
from app.db.models import FocusSession, Profile, PushSubscription, RewardState, User

logger = logging.getLogger(__name__)

_CRASH_WINDOW_HOURS: dict[str, int] = {
    "morning": 9,
    "midday": 12,
    "afternoon": 15,
    "evening": 19,
    "late_night": 22,
}

_NUDGE_FREQ_MIN_GAP_HOURS: dict[str, int] = {
    "none": 99999,
    "gentle": 12,
    "normal": 6,
    "proactive": 3,
}

_NUDGE_SENT_KEY = "anchor_nudge_sent_at"


def _current_hour_utc() -> int:
    return datetime.now(UTC).hour


def _is_waking_hours() -> bool:
    h = _current_hour_utc()
    return 8 <= h <= 22


async def run_nudge_check() -> dict:
    """Main entry point — check all subscribed users and send nudges as needed."""
    if not _is_waking_hours():
        return {"skipped": "outside waking hours"}

    sent = 0
    skipped = 0

    async with async_session_factory() as db:
        # Load all users who have push subscriptions
        result = await db.execute(
            select(PushSubscription).where(PushSubscription.user_id.isnot(None))
        )
        subscriptions = result.scalars().all()

        for sub in subscriptions:
            user_id = sub.user_id
            prefs_result = await db.execute(
                select(User.prefs).where(User.id == user_id)
            )
            row = prefs_result.first()
            prefs = row[0] if row else {}
            nudge_freq = (prefs or {}).get("nudge_frequency", "normal")

            if nudge_freq == "none":
                skipped += 1
                continue

            reason = await _should_nudge(db, user_id, sub, nudge_freq)
            if not reason:
                skipped += 1
                continue

            payload = {"reason": reason, "nudge_frequency": nudge_freq}
            nudge = await route(AITask.NUDGE, payload)

            _send_push(sub.subscription, nudge["title"], nudge["body"])
            logger.info("nudge_sent user=%s reason=%s", user_id, reason)
            sent += 1

    return {"sent": sent, "skipped": skipped}


async def _should_nudge(db, user_id, sub: PushSubscription, nudge_freq: str) -> str | None:
    """Return a reason string if a nudge should fire, else None."""
    now = datetime.now(UTC)
    min_gap = timedelta(hours=_NUDGE_FREQ_MIN_GAP_HOURS.get(nudge_freq, 6))

    # 1. Crash window approaching (within 30 min)
    crash_hour = sub.crash_hour
    current_hour = now.hour
    if abs(current_hour - crash_hour) <= 0 and now.minute >= 30:
        return "crash_window"

    # 2. Streak about to break (active streak, no activity in 20+ hours)
    reward_state = await db.get(RewardState, user_id)
    if reward_state and reward_state.current_streak > 0 and reward_state.last_activity_date:
        last_active = datetime.combine(reward_state.last_activity_date, datetime.min.time()).replace(tzinfo=UTC)
        if now - last_active > timedelta(hours=20):
            return "streak_at_risk"

    # 3. No focus session in 3+ hours
    last_session_row = await db.execute(
        select(FocusSession.started_at)
        .where(FocusSession.user_id == user_id)
        .order_by(FocusSession.started_at.desc())
        .limit(1)
    )
    last_session = last_session_row.scalar_one_or_none()
    if last_session and now - last_session.replace(tzinfo=UTC) > timedelta(hours=3):
        return "idle_focus"

    return None


def _send_push(subscription: dict, title: str, body: str) -> None:
    from app.api.notifications import send_push_notification
    send_push_notification(subscription, {"title": title, "body": body, "icon": "/icon-192.png"})


def run() -> None:
    """Synchronous entry point for RQ or cron."""
    result = asyncio.run(run_nudge_check())
    logger.info("nudge_worker_complete result=%s", result)
