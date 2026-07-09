"""Add auth magic links table.

Revision ID: 0005_auth_magic_links
Revises: 0004_account_deletion_requests
Create Date: 2026-05-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_auth_magic_links"
down_revision: str | None = "0004_account_deletion_requests"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "auth_magic_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_auth_magic_links_token_hash",
        "auth_magic_links",
        ["token_hash"],
    )
    op.create_index(
        "ix_auth_magic_links_user_created",
        "auth_magic_links",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_auth_magic_links_user_created", table_name="auth_magic_links")
    op.drop_index("ix_auth_magic_links_token_hash", table_name="auth_magic_links")
    op.drop_table("auth_magic_links")
