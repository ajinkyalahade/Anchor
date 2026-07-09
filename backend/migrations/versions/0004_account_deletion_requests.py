"""Add account deletion requests table.

Revision ID: 0004_account_deletion_requests
Revises: 0003_quests_table
Create Date: 2026-05-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_account_deletion_requests"
down_revision: str | None = "0003_quests_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "account_deletion_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deletion_mode", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_account_deletions_target_requested",
        "account_deletion_requests",
        ["target_user_id", "requested_at"],
    )
    op.create_index(
        "ix_account_deletions_status_scheduled",
        "account_deletion_requests",
        ["status", "scheduled_for"],
    )


def downgrade() -> None:
    op.drop_index("ix_account_deletions_status_scheduled", table_name="account_deletion_requests")
    op.drop_index("ix_account_deletions_target_requested", table_name="account_deletion_requests")
    op.drop_table("account_deletion_requests")
