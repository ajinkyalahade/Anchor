"""Add focus_sessions and push_subscriptions tables.

Revision ID: 0009_focus_sessions_push_subscriptions
Revises: 0008_user_names
Create Date: 2026-05-17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009_focus_push_subs"
down_revision: str | None = "0008_user_names"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "focus_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("duration_planned", sa.Integer(), nullable=False),
        sa.Column("duration_actual", sa.Integer(), nullable=True),
        sa.Column("task_text", sa.Text(), nullable=True),
        sa.Column("decomposition_jsonb", postgresql.JSONB(), nullable=True),
        sa.Column("completed_steps_int", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("distractions_jsonb", postgresql.JSONB(), nullable=True),
        sa.Column("mood_before", sa.SmallInteger(), nullable=True),
        sa.Column("mood_after", sa.SmallInteger(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_focus_sessions_user_started", "focus_sessions", ["user_id", "started_at"])

    op.create_table(
        "push_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("subscription", postgresql.JSONB(), nullable=False),
        sa.Column("crash_window", sa.String(20), nullable=False),
        sa.Column("crash_hour", sa.Integer(), nullable=False),
        sa.Column("registered_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_push_subscriptions_user", "push_subscriptions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_push_subscriptions_user", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
    op.drop_index("ix_focus_sessions_user_started", table_name="focus_sessions")
    op.drop_table("focus_sessions")
