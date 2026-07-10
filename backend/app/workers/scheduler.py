"""Background scheduler loop.

A single long-running process that periodically runs the app's background
jobs: proactive nudges and due account deletions. Runs as its own service
(see the `worker` service in docker-compose) so the API process stays lean
and stateless.

This is intentionally a simple asyncio loop rather than a heavier scheduler
dependency — the cadence is coarse (minutes) and the jobs are idempotent.
"""

from __future__ import annotations

import asyncio
import logging
import os

from app.domain.workers.deletion_worker import run_due_deletions
from app.domain.workers.nudge_worker import run_nudge_check

logger = logging.getLogger("anchor.scheduler")

# How often to wake up and run the jobs, in seconds (default 5 minutes).
TICK_SECONDS = int(os.environ.get("WORKER_TICK_SECONDS", str(5 * 60)))


async def _run_once() -> None:
    """Run every scheduled job once, isolating failures so one bad job
    does not stop the others or crash the loop."""
    for name, job in (
        ("deletions", run_due_deletions),
        ("nudges", run_nudge_check),
    ):
        try:
            await job()
        except Exception:  # noqa: BLE001 — a worker must never die on one job
            logger.exception("scheduler_job_failed job=%s", name)


async def run_forever() -> None:
    logger.info("scheduler_started tick_seconds=%d", TICK_SECONDS)
    while True:
        await _run_once()
        await asyncio.sleep(TICK_SECONDS)


def main() -> None:
    from app.core.config import get_settings
    from app.core.observability import configure_logging

    settings = get_settings()
    configure_logging(level=settings.log_level, json_logs=settings.log_json)
    asyncio.run(run_forever())


if __name__ == "__main__":
    main()
