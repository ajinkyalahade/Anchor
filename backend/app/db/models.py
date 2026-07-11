"""Core database models."""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    plan: Mapped[str] = mapped_column(String(50), default="free")
    consent_flags: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    prefs: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    # Relationships
    profile: Mapped["Profile"] = relationship(back_populates="user", uselist=False)
    rewards: Mapped[list["RewardLedger"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    reward_state: Mapped["RewardState"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    state_snapshot: Mapped["UserStateSnapshot"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    # passive_deletes: let the DB's ON DELETE CASCADE remove rows instead of
    # the ORM nulling their user_id first (which would orphan the content).
    time_blocks: Mapped[list["TimeBlock"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    time_estimates: Mapped[list["TimeEstimate"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    deficit_tags: Mapped[list[str]] = mapped_column(
        ARRAY(Text), default=list
    )
    crash_window: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vibe_pref: Mapped[str] = mapped_column(String(20), default="gentle")
    onboarding_completed: Mapped[bool] = mapped_column(default=False)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="profile")


class AuthMagicLink(Base):
    """One-time magic link tokens for passwordless authentication."""

    __tablename__ = "auth_magic_links"
    __table_args__ = (
        Index("ix_auth_magic_links_token_hash", "token_hash"),
        Index("ix_auth_magic_links_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RewardLedger(Base):
    __tablename__ = "rewards_ledger"
    __table_args__ = (
        Index("ix_rewards_ledger_user_ts", "user_id", "ts"),
        Index("ix_rewards_ledger_user_source", "user_id", "source"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    xp: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)

    user: Mapped["User"] = relationship(back_populates="rewards")


class RewardState(Base):
    __tablename__ = "reward_states"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    current_streak_state: Mapped[str] = mapped_column(String(20), default="building")
    last_activity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    comeback_bonus_active: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship(back_populates="reward_state")


class UserStateSnapshot(Base):
    """Latest computed state snapshot for AI personalisation (1F.3)."""

    __tablename__ = "user_state_snapshots"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="state_snapshot")


class AIMessage(Base):
    """Log of AI-generated content with optional user feedback (1F.4)."""

    __tablename__ = "ai_messages"
    __table_args__ = (Index("ix_ai_messages_user_created", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    task: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_id: Mapped[str] = mapped_column(String(64), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    helpful: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AccountDeletionRequest(Base):
    """Deletion requests retained for delayed or immediate account removal."""

    __tablename__ = "account_deletion_requests"
    __table_args__ = (
        Index("ix_account_deletions_target_requested", "target_user_id", "requested_at"),
        Index("ix_account_deletions_status_scheduled", "status", "scheduled_for"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    target_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    deletion_mode: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GameSession(Base):
    """Brain game session summary for adaptive difficulty and insights."""

    __tablename__ = "game_sessions"
    __table_args__ = (Index("ix_game_sessions_user_started", "user_id", "started_at"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    game_key: Mapped[str] = mapped_column(String(32), nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[int] = mapped_column(Integer, default=0)
    rt_mean: Mapped[int] = mapped_column(Integer, default=0)
    rt_var: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed: Mapped[bool] = mapped_column(Boolean, default=False)


class TimeBlock(Base):
    """Scheduled planner block for Structure Hub."""

    __tablename__ = "time_blocks"
    __table_args__ = (Index("ix_time_blocks_user_date", "user_id", "block_date"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    block_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_minute: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    quadrant: Mapped[str] = mapped_column(String(16), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User | None"] = relationship(back_populates="time_blocks")
    estimates: Mapped[list["TimeEstimate"]] = relationship(
        back_populates="time_block",
        cascade="all, delete-orphan",
    )


class TimeEstimate(Base):
    """Estimate vs actual log entries for calibration over time."""

    __tablename__ = "time_estimates"
    __table_args__ = (
        Index("ix_time_estimates_user_logged", "user_id", "logged_at"),
        Index("ix_time_estimates_block_logged", "time_block_id", "logged_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    time_block_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("time_blocks.id", ondelete="CASCADE"),
        nullable=True,
    )
    task_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="planner")
    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User | None"] = relationship(back_populates="time_estimates")
    time_block: Mapped["TimeBlock | None"] = relationship(back_populates="estimates")


class RsdLog(Base):
    """RSD interrupt session log with encrypted trigger text."""

    __tablename__ = "rsd_logs"
    __table_args__ = (Index("ix_rsd_logs_user_created", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    trigger_text_enc: Mapped[str] = mapped_column(Text, nullable=False)
    intensity: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    is_crisis: Mapped[bool] = mapped_column(Boolean, default=False)
    action_chosen: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Quest(Base):
    """Energy quest completion log for mood-delta insights."""

    __tablename__ = "quests"
    __table_args__ = (
        Index("ix_quests_user_completed", "user_id", "completed_at"),
        Index("ix_quests_user_quest", "user_id", "quest_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    quest_key: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    mood_before: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    mood_after: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    xp_awarded: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CoachingSession(Base):
    """A coaching conversation session — groups messages and holds a summary."""

    __tablename__ = "coaching_sessions"
    __table_args__ = (Index("ix_coaching_sessions_user_started", "user_id", "started_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    sentiment_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    topics: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    messages: Mapped[list["CoachingMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class CoachingMessage(Base):
    """Individual message within a coaching session."""

    __tablename__ = "coaching_messages"
    __table_args__ = (Index("ix_coaching_messages_session", "session_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("coaching_sessions.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # 'user' | 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["CoachingSession"] = relationship(back_populates="messages")


class UserMemory(Base):
    """Long-term synthesized memory entries for AI personalization."""

    __tablename__ = "user_memory"
    __table_args__ = (Index("ix_user_memory_user_type", "user_id", "memory_type"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    # pattern|preference|milestone|struggle
    memory_type: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)  # coach|rsd|focus|games|manual
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MoodCheckin(Base):
    """User mood check-in for direct emotional signal to AI."""

    __tablename__ = "mood_checkins"
    __table_args__ = (Index("ix_mood_checkins_user_created", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1–5
    note_enc: Mapped[str | None] = mapped_column(Text, nullable=True)  # encrypted free-text
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FocusSession(Base):
    """Focus timer session with optional task decomposition context."""

    __tablename__ = "focus_sessions"
    __table_args__ = (Index("ix_focus_sessions_user_started", "user_id", "started_at"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    duration_planned: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_actual: Mapped[int | None] = mapped_column(Integer, nullable=True)
    task_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    decomposition_jsonb: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    completed_steps_int: Mapped[int] = mapped_column(Integer, default=0)
    distractions_jsonb: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    mood_before: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    mood_after: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PushSubscription(Base):
    """WebPush subscription per user device."""

    __tablename__ = "push_subscriptions"
    __table_args__ = (Index("ix_push_subscriptions_user", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    subscription: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    crash_window: Mapped[str] = mapped_column(String(20), nullable=False)
    crash_hour: Mapped[int] = mapped_column(Integer, nullable=False)
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
