"""Account-deletion worker.

Processes scheduled account-deletion requests whose grace period has
elapsed. Designed to be called on a schedule (see app.workers.scheduler).
Without this, "scheduled" deletions are recorded but never executed — a
data-subject-rights problem.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select

from app.db.database import async_session_factory
from app.db.models import AccountDeletionRequest, User

logger = logging.getLogger("anchor.deletion_worker")


async def run_due_deletions() -> dict[str, Any]:
    """Execute every pending scheduled deletion whose time has come.

    Returns a small summary dict for logging/metrics.
    """
    now = datetime.now(UTC)
    processed = 0
    missing = 0

    async with async_session_factory() as db:
        result = await db.execute(
            select(AccountDeletionRequest).where(
                AccountDeletionRequest.status == "pending",
                AccountDeletionRequest.deletion_mode == "scheduled",
                AccountDeletionRequest.scheduled_for.isnot(None),
                AccountDeletionRequest.scheduled_for <= now,
            )
        )
        due_requests = result.scalars().all()

        for request in due_requests:
            user = await db.get(User, request.target_user_id)
            if user is not None:
                await db.delete(user)
                processed += 1
            else:
                # User already gone (manual delete, cascade). Still close out.
                missing += 1
            request.status = "completed"
            request.completed_at = now

        await db.commit()

    summary = {"processed": processed, "already_gone": missing}
    logger.info(
        "deletion_worker_run processed=%d already_gone=%d",
        processed,
        missing,
    )
    return summary


def main() -> None:
    """Synchronous entry point for cron/one-shot invocation."""
    import asyncio

    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_due_deletions())


if __name__ == "__main__":
    main()
