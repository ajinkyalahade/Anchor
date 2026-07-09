"""Add rsd_logs table with encrypted trigger text.

Revision ID: 0006_rsd_logs
Revises: 0005_auth_magic_links
Create Date: 2026-05-09
"""

import sqlalchemy as sa
from alembic import op

revision = "0006_rsd_logs"
down_revision = "0005_auth_magic_links"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rsd_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("trigger_text_enc", sa.Text(), nullable=False),
        sa.Column("intensity", sa.SmallInteger(), nullable=False),
        sa.Column("is_crisis", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("action_chosen", sa.String(32), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rsd_logs_user_created", "rsd_logs", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_rsd_logs_user_created", table_name="rsd_logs")
    op.drop_table("rsd_logs")
