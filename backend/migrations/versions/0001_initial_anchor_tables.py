"""Initial Anchor tables.

Revision ID: 0001_initial_anchor_tables
Revises:
Create Date: 2026-05-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_anchor_tables"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("plan", sa.String(length=50), nullable=False),
        sa.Column("consent_flags", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("prefs", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deficit_tags", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("crash_window", sa.String(length=20), nullable=True),
        sa.Column("vibe_pref", sa.String(length=20), nullable=False),
        sa.Column("onboarding_completed", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_table(
        "rewards_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("xp", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "reward_states",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("current_streak", sa.Integer(), nullable=False),
        sa.Column("current_streak_state", sa.String(length=20), nullable=False),
        sa.Column("last_activity_date", sa.Date(), nullable=True),
        sa.Column("comeback_bonus_active", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index("ix_rewards_ledger_user_source", "rewards_ledger", ["user_id", "source"])
    op.create_index("ix_rewards_ledger_user_ts", "rewards_ledger", ["user_id", "ts"])
    op.create_table(
        "game_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("game_key", sa.String(length=32), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("accuracy", sa.Integer(), nullable=False),
        sa.Column("rt_mean", sa.Integer(), nullable=False),
        sa.Column("rt_var", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_game_sessions_user_started", "game_sessions", ["user_id", "started_at"])


def downgrade() -> None:
    op.drop_index("ix_game_sessions_user_started", table_name="game_sessions")
    op.drop_table("game_sessions")
    op.drop_index("ix_rewards_ledger_user_ts", table_name="rewards_ledger")
    op.drop_index("ix_rewards_ledger_user_source", table_name="rewards_ledger")
    op.drop_table("reward_states")
    op.drop_table("rewards_ledger")
    op.drop_table("profiles")
    op.drop_table("users")
