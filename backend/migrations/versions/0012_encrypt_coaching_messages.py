"""Encrypt existing coaching message content at rest (DATA-2).

New writes are encrypted by the application; this backfills rows written
before the boundary changed. Runs exactly once per database (alembic), so
there is no double-encryption risk. Requires FIELD_ENCRYPTION_KEY to be the
same key the app serves with (dev falls back to the zero key, matching the
app's dev behavior).

Downgrade decrypts back to plaintext.

Revision ID: 0012_encrypt_coach_msgs
Revises: 0011_deletion_cascade
"""

import sqlalchemy as sa
from alembic import op

from app.core.encryption import decrypt_text, encrypt_text

revision = "0012_encrypt_coach_msgs"
down_revision = "0011_deletion_cascade"
branch_labels = None
depends_on = None

_messages = sa.table(
    "coaching_messages",
    sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
    sa.column("content", sa.Text),
)


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.select(_messages.c.id, _messages.c.content)).fetchall()
    for row_id, content in rows:
        conn.execute(
            _messages.update()
            .where(_messages.c.id == row_id)
            .values(content=encrypt_text(content))
        )


def downgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.select(_messages.c.id, _messages.c.content)).fetchall()
    for row_id, content in rows:
        conn.execute(
            _messages.update()
            .where(_messages.c.id == row_id)
            .values(content=decrypt_text(content))
        )
