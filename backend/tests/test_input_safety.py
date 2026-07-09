from app.ai.router import AITask, route
from app.api.ai import CoachRequest, QuestWeeklyPreviewRequest, WeeklyDigestPreviewRequest
from app.api.calm import RSDRequest
from app.api.focus import DecomposeRequest
from app.api.games import WordGymEvaluateRequest
from app.core.input_safety import sanitize_prompt_text


def test_sanitize_prompt_text_strips_control_chars() -> None:
    assert sanitize_prompt_text(" \x00hello\r\nworld\x1f ") == "hello\nworld"


def test_request_models_sanitize_ai_bound_fields() -> None:
    assert DecomposeRequest(task_text="  plan\x00 this ").task_text == "plan this"
    assert (
        RSDRequest(trigger_text="  rejected\rperson ", intensity=5).trigger_text
        == "rejected\nperson"
    )
    assert CoachRequest(message="  stuck\x07 today ").message == "stuck today"
    assert (
        WordGymEvaluateRequest(base_word=" oc\rean ", user_word=" wave\x00 ").base_word
        == "oc\nean"
    )


def test_weekly_preview_fields_have_length_constraints_and_sanitization() -> None:
    weekly = WeeklyDigestPreviewRequest(
        sessions_count=1,
        morning_focus_score=80,
        best_focus_score=90,
        avg_session_minutes=25,
        sleep_hours=7.5,
        caffeine_label=" low\x00 ",
        delivery_label=" Sunday\r9 ",
    )
    quest = QuestWeeklyPreviewRequest(
        best_quest_label=" hydrate\x00 ",
        best_average_delta=1.2,
        total_runs=3,
    )
    assert weekly.caffeine_label == "low"
    assert weekly.delivery_label == "Sunday\n9"
    assert quest.best_quest_label == "hydrate"


async def test_router_sanitizes_payload_before_fallback() -> None:
    result = await route(AITask.DECOMPOSE, {"task_text": "  write\x00 report "})
    assert "steps" in result
