"""Delete user content on account deletion (DATA-1).

User-content tables previously used ON DELETE SET NULL, so deleting a user
orphaned their coaching messages, mood check-ins, sessions, quests, etc.
For a mental-health app that is a compliance problem: "delete my account"
must delete the content. Switch every user FK to ON DELETE CASCADE and
purge rows already orphaned by earlier deletions.

rsd_logs is included in the FK change for hygiene, but its rows are written
without a user_id by design (pseudonymous storage) and are not purged here.

Revision ID: 0011_deletion_cascade
Revises: 5ca742ae3863
"""

from alembic import op

revision = "0011_deletion_cascade"
down_revision = "5ca742ae3863"
branch_labels = None
depends_on = None

# Tables whose user_id FK moves SET NULL -> CASCADE.
_TABLES = [
    "ai_messages",
    "game_sessions",
    "time_blocks",
    "time_estimates",
    "rsd_logs",
    "quests",
    "coaching_sessions",
    "coaching_messages",
    "mood_checkins",
    "focus_sessions",
]

# Orphaned rows (user_id IS NULL) in these tables are residue of past
# deletions — purge them. rsd_logs is excluded: its rows are pseudonymous
# (never linked to a user) and NULL user_id there is the normal state.
_PURGE_ORPHANS = [t for t in _TABLES if t != "rsd_logs"]


def upgrade() -> None:
    for table in _PURGE_ORPHANS:
        op.execute(f"DELETE FROM {table} WHERE user_id IS NULL")

    for table in _TABLES:
        op.drop_constraint(f"{table}_user_id_fkey", table, type_="foreignkey")
        op.create_foreign_key(
            f"{table}_user_id_fkey",
            table,
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    for table in _TABLES:
        op.drop_constraint(f"{table}_user_id_fkey", table, type_="foreignkey")
        op.create_foreign_key(
            f"{table}_user_id_fkey",
            table,
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )
