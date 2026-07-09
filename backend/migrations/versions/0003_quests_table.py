"""Add Energy Quests table.

Revision ID: 0003_quests_table
Revises: 0002_structure_hub_tables
Create Date: 2026-05-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_quests_table"
down_revision: str | None = "0002_structure_hub_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "quests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quest_key", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("mood_before", sa.SmallInteger(), nullable=True),
        sa.Column("mood_after", sa.SmallInteger(), nullable=True),
        sa.Column("xp_awarded", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quests_user_completed", "quests", ["user_id", "completed_at"])
    op.create_index("ix_quests_user_quest", "quests", ["user_id", "quest_key"])


def downgrade() -> None:
    op.drop_index("ix_quests_user_quest", table_name="quests")
    op.drop_index("ix_quests_user_completed", table_name="quests")
    op.drop_table("quests")
