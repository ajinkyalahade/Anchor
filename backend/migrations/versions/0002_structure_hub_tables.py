"""Add Structure Hub tables.

Revision ID: 0002_structure_hub_tables
Revises: 0001_initial_anchor_tables
Create Date: 2026-05-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_structure_hub_tables"
down_revision: str | None = "0001_initial_anchor_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "time_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("block_date", sa.Date(), nullable=False),
        sa.Column("start_minute", sa.Integer(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("actual_duration_minutes", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("quadrant", sa.String(length=16), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_time_blocks_user_date", "time_blocks", ["user_id", "block_date"])

    op.create_table(
        "time_estimates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("time_block_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("task_label", sa.String(length=255), nullable=True),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column("actual_minutes", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("logged_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["time_block_id"], ["time_blocks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_time_estimates_user_logged",
        "time_estimates",
        ["user_id", "logged_at"],
    )
    op.create_index(
        "ix_time_estimates_block_logged",
        "time_estimates",
        ["time_block_id", "logged_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_time_estimates_block_logged", table_name="time_estimates")
    op.drop_index("ix_time_estimates_user_logged", table_name="time_estimates")
    op.drop_table("time_estimates")
    op.drop_index("ix_time_blocks_user_date", table_name="time_blocks")
    op.drop_table("time_blocks")
