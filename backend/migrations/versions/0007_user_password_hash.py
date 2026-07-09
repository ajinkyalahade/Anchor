"""Add password_hash column to users table.

Revision ID: 0007_user_password_hash
Revises: 0006_rsd_logs
Create Date: 2026-05-11
"""

import sqlalchemy as sa
from alembic import op

revision = "0007_user_password_hash"
down_revision = "0006_rsd_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "password_hash")
