"""Async database engine and session factory."""

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Session as SyncSession

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


@event.listens_for(SyncSession, "before_flush")
def _mark_session_wrote(session: SyncSession, _ctx: Any, _instances: Any) -> None:
    """Record that a session flushed changes, so get_db knows a commit is due.

    Needed because a flush mid-request moves objects out of new/dirty/deleted,
    which would make the request look read-only at commit time.
    """
    if session.new or session.dirty or session.deleted:
        session.info["wrote"] = True


def _session_has_changes(session: AsyncSession) -> bool:
    sync = session.sync_session
    return bool(sync.info.get("wrote") or sync.new or sync.dirty or sync.deleted)


async def get_db() -> AsyncGenerator[AsyncSession]:
    """Dependency: yields an async DB session.

    Commits only when the session actually wrote something (BE-4) — read-only
    requests roll back instead of issuing a needless COMMIT per request. All
    writes in this codebase go through ORM objects, so pending changes plus
    the flush marker cover every mutation path.
    """
    async with async_session_factory() as session:
        try:
            yield session
            if _session_has_changes(session):
                await session.commit()
            else:
                await session.rollback()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
