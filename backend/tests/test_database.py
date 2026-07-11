"""DB session behavior (BE-4/BE-5): commit only on writes, anchored env file."""

import uuid
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.database import async_session_factory, get_db
from app.db.models import User


class _CommitSpy:
    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.count = 0
        original = AsyncSession.commit

        async def spy(session: AsyncSession) -> None:
            self.count += 1
            await original(session)

        monkeypatch.setattr(AsyncSession, "commit", spy)


async def _drive_get_db(work) -> None:
    """Run `work(session)` inside the get_db dependency's lifecycle."""
    gen = get_db()
    session = await anext(gen)
    try:
        await work(session)
    finally:
        with pytest.raises(StopAsyncIteration):
            await anext(gen)


@pytest.mark.asyncio
async def test_get_db_does_not_commit_read_only_requests(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression (BE-4): GET-style requests used to COMMIT every time."""
    spy = _CommitSpy(monkeypatch)

    async def work(session: AsyncSession) -> None:
        await session.execute(select(User).limit(1))

    await _drive_get_db(work)
    assert spy.count == 0


@pytest.mark.asyncio
async def test_get_db_commits_pending_unflushed_writes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A handler that only db.add()s (no flush) must still be committed."""
    spy = _CommitSpy(monkeypatch)
    user_id = uuid.uuid4()

    async def work(session: AsyncSession) -> None:
        session.add(User(id=user_id))

    await _drive_get_db(work)
    assert spy.count == 1

    async with async_session_factory() as db:
        persisted = await db.get(User, user_id)
        assert persisted is not None
        await db.delete(persisted)
        await db.commit()


@pytest.mark.asyncio
async def test_get_db_commits_writes_that_were_already_flushed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Flushed changes leave new/dirty/deleted, so the flush marker must
    keep the session recognizable as written-to."""
    spy = _CommitSpy(monkeypatch)
    user_id = uuid.uuid4()

    async def work(session: AsyncSession) -> None:
        session.add(User(id=user_id))
        await session.flush()

    await _drive_get_db(work)
    assert spy.count == 1

    async with async_session_factory() as db:
        persisted = await db.get(User, user_id)
        assert persisted is not None
        await db.delete(persisted)
        await db.commit()


def test_env_file_is_anchored_not_cwd_relative() -> None:
    """Regression (BE-5): '../.env' only resolved when CWD was backend/."""
    env_file = Path(str(Settings.model_config.get("env_file")))
    assert env_file.is_absolute()
    assert env_file.name == ".env"
    # config.py lives at backend/app/core/, the env file at the repo root.
    assert env_file.parent == Path(__file__).resolve().parents[2]


def test_sql_echo_is_opt_in() -> None:
    """SQL echo logs sensitive parameter values; it must not ride app_debug."""
    settings = Settings(app_debug=True)
    assert settings.database_echo is False
