from app.db.models import AccountDeletionRequest, Quest, TimeBlock, TimeEstimate


def test_time_block_model_exposes_structure_hub_columns() -> None:
    columns = TimeBlock.__table__.columns

    assert TimeBlock.__tablename__ == "time_blocks"
    assert columns["block_date"].nullable is False
    assert columns["start_minute"].nullable is False
    assert columns["duration_minutes"].nullable is False
    assert columns["actual_duration_minutes"].nullable is True
    assert columns["quadrant"].type.length == 16
    assert any(index.name == "ix_time_blocks_user_date" for index in TimeBlock.__table__.indexes)


def test_time_estimate_model_links_to_time_blocks() -> None:
    columns = TimeEstimate.__table__.columns

    assert TimeEstimate.__tablename__ == "time_estimates"
    assert columns["estimated_minutes"].nullable is False
    assert columns["actual_minutes"].nullable is True
    assert columns["source"].type.length == 32
    foreign_keys = {fk.target_fullname for fk in columns["time_block_id"].foreign_keys}
    assert foreign_keys == {"time_blocks.id"}
    index_names = {index.name for index in TimeEstimate.__table__.indexes}
    assert "ix_time_estimates_user_logged" in index_names
    assert "ix_time_estimates_block_logged" in index_names


def test_quest_model_tracks_mood_delta_fields() -> None:
    columns = Quest.__table__.columns

    assert Quest.__tablename__ == "quests"
    assert columns["quest_key"].nullable is False
    assert columns["duration_seconds"].nullable is False
    assert columns["mood_before"].nullable is True
    assert columns["mood_after"].nullable is True
    assert columns["xp_awarded"].nullable is False
    index_names = {index.name for index in Quest.__table__.indexes}
    assert "ix_quests_user_completed" in index_names
    assert "ix_quests_user_quest" in index_names


def test_account_deletion_request_model_tracks_modes_and_schedule() -> None:
    columns = AccountDeletionRequest.__table__.columns

    assert AccountDeletionRequest.__tablename__ == "account_deletion_requests"
    assert columns["target_user_id"].nullable is False
    assert columns["deletion_mode"].type.length == 16
    assert columns["status"].type.length == 16
    assert columns["scheduled_for"].nullable is True
    assert columns["completed_at"].nullable is True
    index_names = {index.name for index in AccountDeletionRequest.__table__.indexes}
    assert "ix_account_deletions_target_requested" in index_names
    assert "ix_account_deletions_status_scheduled" in index_names
