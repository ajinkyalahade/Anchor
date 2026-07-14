"""AI utility endpoints — user state (1F.3), feedback (1F.4), consent (1F.5), suggestion (1G.1)."""

import hashlib
import uuid
from datetime import UTC, date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: F401  (used in helper type hints)

from app.ai.router import AITask, PromptContext, route
from app.api.deps import CurrentUserId, UserEnginePref
from app.core.encryption import decrypt_text, encrypt_text
from app.core.input_safety import sanitize_prompt_text
from app.core.rate_limit import build_rate_limit_dependency
from app.db.database import get_db
from app.db.models import (
    AIMessage,
    CoachingMessage,
    CoachingSession,
    MoodCheckin,
    RewardLedger,
    RewardState,
    User,
    UserStateSnapshot,
)
from app.domain.suggestion.service import first_week_label, pick_next_anchor
from app.domain.user_state.service import compute_user_state

router = APIRouter(prefix="/ai", tags=["ai"])
suggestion_rate_limit = build_rate_limit_dependency(
    "ai-suggestion",
    max_requests=10,
    window_seconds=60,
)

DbSession = Annotated[AsyncSession, Depends(get_db)]

# ── User State (1F.3) ─────────────────────────────────────────────────────────

class UserStateResponse(BaseModel):
    energy_level: int
    recent_focus_quality: int
    emotional_load: int
    cognitive_freshness: int
    preferred_modalities: list[str]
    crash_window_local: str | None
    current_streak_state: str
    comeback_bonus_active: bool
    share_ai_context: bool = False


@router.get("/user-state", response_model=UserStateResponse)
async def get_user_state(
    db: DbSession,
    user_id: CurrentUserId,
) -> UserStateResponse:
    """Return the latest computed user state snapshot."""

    # XP by source
    rows = await db.execute(
        select(RewardLedger.source, func.sum(RewardLedger.xp).label("total"))
        .where(RewardLedger.user_id == user_id)
        .group_by(RewardLedger.source)
    )
    xp_by_source: dict[str, int] = {row.source: int(row.total) for row in rows}
    total_xp = sum(xp_by_source.values())

    reward_state = await db.get(RewardState, user_id)
    streak_state = reward_state.current_streak_state if reward_state else "building"
    comeback = reward_state.comeback_bonus_active if reward_state else False

    from sqlalchemy.orm import selectinload
    user_row = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.profile))
    )
    user = user_row.scalar_one_or_none()
    profile = user.profile if user else None
    crash_window = profile.crash_window if profile else None

    snapshot = compute_user_state(
        xp_by_source=xp_by_source,
        total_xp=total_xp,
        streak_state=streak_state,
        comeback_bonus_active=comeback,
        crash_window=crash_window,
    )

    # Persist / update snapshot
    existing = await db.get(UserStateSnapshot, user_id)
    if existing:
        existing.snapshot = snapshot
    else:
        db.add(UserStateSnapshot(user_id=user_id, snapshot=snapshot))
    await db.flush()

    consented = bool(((user.consent_flags if user else None) or {}).get("share_ai_context"))
    return UserStateResponse(**snapshot, share_ai_context=consented)


# ── AI Feedback (1F.4) ────────────────────────────────────────────────────────

class AIFeedbackRequest(BaseModel):
    task: str = Field(description="AI task name, e.g. 'decompose'")
    prompt_id: str = Field(description="Versioned prompt ID, e.g. 'decompose@v1'")
    content_hash: str = Field(description="SHA-256 hex of the AI response text")
    latency_ms: int = Field(ge=0)
    helpful: int = Field(description="1=helpful, 0=neutral, -1=unhelpful")
    model: str = Field(default="unknown")


class AIFeedbackResponse(BaseModel):
    message_id: str
    recorded: bool


@router.post("/feedback", response_model=AIFeedbackResponse, status_code=status.HTTP_201_CREATED)
async def record_ai_feedback(
    data: AIFeedbackRequest,
    user_id: CurrentUserId,
    db: DbSession,
) -> AIFeedbackResponse:
    """Persist a user's helpfulness rating for an AI-generated response."""
    if data.helpful not in (-1, 0, 1):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="helpful must be 1, 0, or -1",
        )

    msg = AIMessage(
        user_id=user_id,
        task=data.task,
        model=data.model,
        prompt_id=data.prompt_id,
        content_hash=data.content_hash,
        latency_ms=data.latency_ms,
        helpful=data.helpful,
    )
    db.add(msg)
    await db.flush()

    return AIFeedbackResponse(message_id=str(msg.id), recorded=True)


# ── Privacy & Consent (1F.5) ──────────────────────────────────────────────────

class ConsentUpdateRequest(BaseModel):
    share_ai_context: bool


class ConsentResponse(BaseModel):
    user_id: str
    share_ai_context: bool


@router.patch("/consent", response_model=ConsentResponse)
async def update_consent(
    data: ConsentUpdateRequest,
    user_id: CurrentUserId,
    db: DbSession,
) -> ConsentResponse:
    """Update a user's AI context-sharing consent flag (default OFF)."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    flags = dict(user.consent_flags or {})
    flags["share_ai_context"] = data.share_ai_context
    user.consent_flags = flags
    await db.flush()

    return ConsentResponse(user_id=str(user_id), share_ai_context=data.share_ai_context)


# ── Pseudonymisation helper (1F.5) ────────────────────────────────────────────

def pseudonymise_user_id(user_id: uuid.UUID) -> str:
    """Return a 16-char hex token for use in AI provider calls — never the real UUID."""
    return hashlib.sha256(str(user_id).encode()).hexdigest()[:16]


# ── Suggestion (1G.1) ─────────────────────────────────────────────────────────

class SuggestionResponse(BaseModel):
    action: str
    label: str
    route: str
    duration: str
    reason: str
    week_label: str | None = None


class CoachRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    session_id: uuid.UUID | None = None

    @field_validator("message")
    @classmethod
    def _sanitize_message(cls, value: str) -> str:
        return sanitize_prompt_text(value)


class CoachResponse(BaseModel):
    session_id: str
    is_crisis: bool = False
    crisis_message: str | None = None
    resources: list[dict[str, str]] | None = None
    opening: str | None = None
    reflection: str | None = None
    next_steps: list[str] | None = None


class WeeklyDigestPreviewRequest(BaseModel):
    sessions_count: int = Field(ge=0)
    morning_focus_score: int = Field(ge=0, le=100)
    best_focus_score: int = Field(ge=0, le=100)
    avg_session_minutes: int = Field(ge=0)
    sleep_hours: float = Field(ge=0, le=24)
    caffeine_label: str = Field(min_length=1, max_length=32)
    delivery_label: str = Field(default="Sunday, 9:00 AM", min_length=1, max_length=64)

    @field_validator("caffeine_label", "delivery_label")
    @classmethod
    def _sanitize_digest_labels(cls, value: str) -> str:
        return sanitize_prompt_text(value)


class WeeklyDigestPreviewResponse(BaseModel):
    title: str
    summary: str
    bullets: list[str]
    delivery_label: str


class QuestWeeklyPreviewRequest(BaseModel):
    best_quest_label: str = Field(min_length=1, max_length=120)
    best_average_delta: float
    total_runs: int = Field(ge=0)

    @field_validator("best_quest_label")
    @classmethod
    def _sanitize_quest_label(cls, value: str) -> str:
        return sanitize_prompt_text(value)


class QuestWeeklyPreviewResponse(BaseModel):
    title: str
    summary: str
    recommendation: str


@router.get("/suggestion", response_model=SuggestionResponse)
async def get_suggestion(
    request: Request,
    db: DbSession,
    user_id: CurrentUserId,
    _: None = Depends(suggestion_rate_limit),
) -> SuggestionResponse:
    """Return the AI-picked next anchor for this user session."""
    cache = getattr(request.app.state, "cache", None)
    cache_key = f"ai-suggestion:{user_id}"
    if cache is not None:
        cached = await cache.get_json(cache_key)
        if cached is not None:
            return SuggestionResponse(**cached)

    # Build state (same logic as user-state endpoint, no DB write here)
    rows = await db.execute(
        select(RewardLedger.source, func.sum(RewardLedger.xp).label("total"))
        .where(RewardLedger.user_id == user_id)
        .group_by(RewardLedger.source)
    )
    xp_by_source: dict[str, int] = {row.source: int(row.total) for row in rows}
    total_xp = sum(xp_by_source.values())

    reward_state = await db.get(RewardState, user_id)
    streak_state = reward_state.current_streak_state if reward_state else "building"
    comeback = reward_state.comeback_bonus_active if reward_state else False

    from sqlalchemy.orm import selectinload as _sil
    _u_row = await db.execute(select(User).where(User.id == user_id).options(_sil(User.profile)))
    user = _u_row.scalar_one_or_none()
    profile = user.profile if user else None
    crash_window = profile.crash_window if profile else None

    state = compute_user_state(
        xp_by_source=xp_by_source,
        total_xp=total_xp,
        streak_state=streak_state,
        comeback_bonus_active=comeback,
        crash_window=crash_window,
    )
    anchor = pick_next_anchor(state)

    # First-week scaffolding
    prefs = user.prefs if user else {}
    first_str: str | None = prefs.get("first_session_at") if prefs else None
    first_date: date | None = date.fromisoformat(first_str) if first_str else None
    week_label = first_week_label(first_date)
    payload = {**anchor, "week_label": week_label}
    if cache is not None:
        await cache.set_json(cache_key, payload, ttl_seconds=300)
    return SuggestionResponse(**payload)


@router.post("/coach", response_model=CoachResponse)
async def talk_to_anchor(
    data: CoachRequest,
    user_id: CurrentUserId,
    engine_pref: UserEnginePref,
    db: DbSession,
) -> CoachResponse:
    """Multi-turn AI coach — stores conversation history per session."""
    from app.ai.safety.classifier import CRISIS_RESPONSE_PAYLOAD, check_crisis

    if check_crisis(data.message):
        # Still create/continue session so crisis is recorded
        session = await _get_or_create_session(db, user_id, data.session_id)
        await _save_message(db, session.id, user_id, "user", data.message)
        await db.flush()
        return CoachResponse(session_id=str(session.id), **CRISIS_RESPONSE_PAYLOAD)

    # Get or create session
    session = await _get_or_create_session(db, user_id, data.session_id)

    # Fetch last 10 messages as history for multi-turn context
    rows = await db.execute(
        select(CoachingMessage)
        .where(CoachingMessage.session_id == session.id)
        .order_by(CoachingMessage.created_at.asc())
        .limit(10)
    )
    prior_messages = rows.scalars().all()
    history = [
        {"role": m.role, "content": _read_message_content(m.content)}
        for m in prior_messages
    ]

    # Save user message
    await _save_message(db, session.id, user_id, "user", data.message)

    # Build prompt context from user state
    ctx = await _build_prompt_context(db, user_id)

    result = await route(
        AITask.COACH, {"message": data.message, "history": history}, ctx, engine_pref=engine_pref
    )

    # Assemble assistant reply text and save it
    assistant_text = " ".join(filter(None, [
        result.get("opening"), result.get("reflection"),
        *( result.get("next_steps") or []),
    ]))
    if assistant_text:
        await _save_message(db, session.id, user_id, "assistant", assistant_text)

    await db.flush()

    return CoachResponse(
        session_id=str(session.id),
        opening=result.get("opening"),
        reflection=result.get("reflection"),
        next_steps=result.get("next_steps"),
    )


# ── Coaching helpers ──────────────────────────────────────────────────────────

async def _get_or_create_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID | None,
) -> CoachingSession:
    if session_id:
        existing = await db.get(CoachingSession, session_id)
        if existing and existing.user_id == user_id:
            return existing
    session = CoachingSession(user_id=user_id)
    db.add(session)
    await db.flush()
    return session


async def _save_message(
    db: AsyncSession,
    session_id: uuid.UUID,
    user_id: uuid.UUID,
    role: str,
    content: str,
) -> CoachingMessage:
    # Conversation content is encrypted at rest (DATA-2) — coach messages
    # are among the most sensitive data this app stores.
    msg = CoachingMessage(
        session_id=session_id, user_id=user_id, role=role, content=encrypt_text(content)
    )
    db.add(msg)
    return msg


def _read_message_content(stored: str) -> str:
    """Decrypt a stored coaching message; tolerate legacy plaintext rows so
    an unmigrated environment degrades to readable history, not a 500."""
    try:
        return decrypt_text(stored)
    except Exception:
        return stored


async def _build_prompt_context(db: AsyncSession, user_id: uuid.UUID) -> PromptContext:
    """Build a PromptContext from current user state and DB history.

    Consent gate (DATA-4): stored context — memories, state, session
    summaries — only flows into AI prompts when the user has opted in via
    consent_flags.share_ai_context (default OFF). The message the user is
    actively sending is unaffected; only enrichment is gated.
    """
    from collections import Counter
    from datetime import datetime

    from sqlalchemy.orm import selectinload

    from app.db.models import FocusSession, GameSession, Quest

    # User + profile (loaded first: the consent flag decides everything else)
    user_row = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.profile))
    )
    user = user_row.scalar_one_or_none()
    if user is None or not (user.consent_flags or {}).get("share_ai_context"):
        return PromptContext()
    profile = user.profile
    crash_window = profile.crash_window if profile else None
    deficit_tags = (profile.deficit_tags or []) if profile else []
    first_name = user.first_name

    # XP + rewards
    rows = await db.execute(
        select(RewardLedger.source, func.sum(RewardLedger.xp).label("total"))
        .where(RewardLedger.user_id == user_id)
        .group_by(RewardLedger.source)
    )
    xp_by_source: dict[str, int] = {row.source: int(row.total) for row in rows}
    total_xp = sum(xp_by_source.values())

    reward_state = await db.get(RewardState, user_id)
    streak = reward_state.current_streak if reward_state else 0
    streak_state = reward_state.current_streak_state if reward_state else "building"
    comeback = reward_state.comeback_bonus_active if reward_state else False

    from app.domain.user_state.service import compute_user_state
    state = compute_user_state(
        xp_by_source=xp_by_source,
        total_xp=total_xp,
        streak_state=streak_state,
        comeback_bonus_active=comeback,
        crash_window=crash_window,
    )

    hour = datetime.now().hour
    if hour < 12:
        time_of_day = "morning"
    elif hour < 17:
        time_of_day = "afternoon"
    elif crash_window and crash_window in state.get("crash_window_local", ""):
        time_of_day = "crash_window"
    else:
        time_of_day = "evening"

    # Recent coaching session summaries
    summary_rows = await db.execute(
        select(CoachingSession.summary)
        .where(CoachingSession.user_id == user_id, CoachingSession.summary.isnot(None))
        .order_by(CoachingSession.started_at.desc())
        .limit(3)
    )
    summaries = [r for (r,) in summary_rows if r]

    # Focus sessions (all-time count + recent)
    focus_count_row = await db.execute(
        select(func.count()).where(FocusSession.user_id == user_id)
    )
    total_focus_sessions = focus_count_row.scalar() or 0

    focus_rows = await db.execute(
        select(FocusSession)
        .where(FocusSession.user_id == user_id)
        .order_by(FocusSession.started_at.desc())
        .limit(10)
    )
    focus_sessions = focus_rows.scalars().all()
    completed_focus = sum(1 for s in focus_sessions if s.duration_actual and s.duration_actual > 0)

    # Game sessions
    game_count_row = await db.execute(
        select(func.count()).where(GameSession.user_id == user_id)
    )
    total_game_sessions = game_count_row.scalar() or 0

    game_rows = await db.execute(
        select(GameSession.game_key)
        .where(GameSession.user_id == user_id)
        .order_by(GameSession.started_at.desc())
        .limit(20)
    )
    game_keys = [r for (r,) in game_rows]
    game_counts = Counter(game_keys)

    # Quest / calm completions (breathing, body scan, etc.)
    quest_rows = await db.execute(
        select(Quest.quest_key, Quest.title, Quest.mood_before, Quest.mood_after)
        .where(Quest.user_id == user_id)
        .order_by(Quest.completed_at.desc())
        .limit(50)
    )
    quests = quest_rows.all()
    quest_counts = Counter(r.quest_key for r in quests)

    # Mood check-ins
    mood_rows = await db.execute(
        select(MoodCheckin.score)
        .where(MoodCheckin.user_id == user_id)
        .order_by(MoodCheckin.created_at.desc())
        .limit(10)
    )
    mood_scores = [s for (s,) in mood_rows]

    # Build natural-language memory snippets the AI can reference
    memories: list[str] = []
    if first_name:
        memories.append(f"User's name: {first_name}")
    memories.append(f"Total XP: {total_xp} | Streak: {streak} days ({streak_state})")
    if deficit_tags:
        memories.append(f"Self-reported ADHD patterns: {', '.join(deficit_tags)}")
    if crash_window:
        memories.append(f"Known energy crash window: {crash_window}")

    # Focus
    memories.append(
        f"Focus sessions: {total_focus_sessions} total, "
        f"{completed_focus}/{len(focus_sessions)} completed in recent history"
    )
    if focus_sessions:
        avg_planned = sum(s.duration_planned for s in focus_sessions) / len(focus_sessions)
        memories.append(f"Avg planned focus block: {int(avg_planned)} minutes")

    # Games
    if total_game_sessions:
        game_summary = ", ".join(f"{k}: {v}" for k, v in game_counts.most_common(3))
        memories.append(
            f"Brain game sessions: {total_game_sessions} total (recent: {game_summary})"
        )

    # Quests / calm activities
    if quests:
        quest_summary = ", ".join(f"{k}: {v}" for k, v in quest_counts.most_common(5))
        memories.append(
            f"Energy quests / calm sessions completed: {len(quests)} total ({quest_summary})"
        )
        mood_delta_quests = [q for q in quests if q.mood_before and q.mood_after]
        if mood_delta_quests:
            avg_delta = sum(
                q.mood_after - q.mood_before for q in mood_delta_quests
            ) / len(mood_delta_quests)
            memories.append(f"Average mood lift from quests: +{avg_delta:.1f} points")

    # Mood check-ins
    if mood_scores:
        avg_mood = sum(mood_scores) / len(mood_scores)
        memories.append(
            f"Recent mood check-ins (1–5): avg {avg_mood:.1f}"
            f" over last {len(mood_scores)} entries"
        )

    return PromptContext(
        user_state=state,
        relevant_memories=memories,
        recent_session_summaries=summaries,
        time_of_day=time_of_day,
        streak_state=streak_state,
    )


@router.post("/weekly-digest/preview", response_model=WeeklyDigestPreviewResponse)
async def preview_weekly_digest(
    data: WeeklyDigestPreviewRequest,
) -> WeeklyDigestPreviewResponse:
    """Generate a weekly insight digest preview from aggregated dashboard stats."""
    result = await route(
        AITask.INSIGHT_WEEKLY,
        {
            "sessions_count": data.sessions_count,
            "morning_focus_score": data.morning_focus_score,
            "best_focus_score": data.best_focus_score,
            "avg_session_minutes": data.avg_session_minutes,
            "sleep_hours": data.sleep_hours,
            "caffeine_label": data.caffeine_label,
            "delivery_label": data.delivery_label,
        },
    )
    return WeeklyDigestPreviewResponse(**result)


@router.post("/quests/weekly-preview", response_model=QuestWeeklyPreviewResponse)
async def preview_quest_weekly(
    data: QuestWeeklyPreviewRequest,
) -> QuestWeeklyPreviewResponse:
    """Generate a weekly quest personalization preview."""
    result = await route(
        AITask.QUEST_WEEKLY,
        {
            "best_quest_label": data.best_quest_label,
            "best_average_delta": data.best_average_delta,
            "total_runs": data.total_runs,
        },
    )
    return QuestWeeklyPreviewResponse(**result)


# ── Mood Check-In ─────────────────────────────────────────────────────────────

class CheckinRequest(BaseModel):
    score: int = Field(ge=1, le=5, description="Mood score 1 (overwhelmed) to 5 (energised)")
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note")
    @classmethod
    def _sanitize_note(cls, value: str | None) -> str | None:
        return sanitize_prompt_text(value) if value else None


class CheckinResponse(BaseModel):
    id: str
    score: int
    recorded: bool


@router.post("/checkin", response_model=CheckinResponse, status_code=status.HTTP_201_CREATED)
async def submit_checkin(
    data: CheckinRequest,
    user_id: CurrentUserId,
    db: DbSession,
) -> CheckinResponse:
    """Record a mood check-in. Note is encrypted at rest."""
    note_enc = encrypt_text(data.note) if data.note else None
    checkin = MoodCheckin(user_id=user_id, score=data.score, note_enc=note_enc)
    db.add(checkin)
    await db.flush()
    return CheckinResponse(id=str(checkin.id), score=checkin.score, recorded=True)


@router.get("/checkin/latest")
async def get_latest_checkin(
    user_id: CurrentUserId,
    db: DbSession,
) -> dict[str, Any]:
    """Return the most recent check-in timestamp so the frontend knows when to prompt again."""
    row = await db.execute(
        select(MoodCheckin.score, MoodCheckin.created_at)
        .where(MoodCheckin.user_id == user_id)
        .order_by(MoodCheckin.created_at.desc())
        .limit(1)
    )
    result = row.first()
    if not result:
        return {"last_checkin_at": None, "last_score": None}
    return {"last_checkin_at": result.created_at.isoformat(), "last_score": result.score}


# ── Daily Briefing ────────────────────────────────────────────────────────────

class BriefingResponse(BaseModel):
    greeting: str
    energy_read: str
    suggested_first_action: str
    affirmation: str
    cached: bool = False


@router.get("/briefing", response_model=BriefingResponse)
async def get_daily_briefing(
    request: Request,
    user_id: CurrentUserId,
    engine_pref: UserEnginePref,
    db: DbSession,
) -> BriefingResponse:
    """Return a personalised daily briefing, cached in Redis for 1h per user per day."""
    from datetime import datetime

    today = datetime.now(UTC).strftime("%Y-%m-%d")
    cache_key = f"briefing:{user_id}:{today}"

    cache = getattr(request.app.state, "cache", None)
    if cache:
        cached = await cache.get_json(cache_key)
        if cached:
            return BriefingResponse(**cached, cached=True)

    ctx = await _build_prompt_context(db, user_id)
    payload = {
        "time_of_day": ctx.time_of_day,
        "energy_level": ctx.user_state.get("energy_level", 3),
        "emotional_load": ctx.user_state.get("emotional_load", 2),
        "cognitive_freshness": ctx.user_state.get("cognitive_freshness", 3),
        "streak_state": ctx.streak_state,
    }

    result = await route(AITask.DAILY_BRIEFING, payload, ctx, engine_pref=engine_pref)

    if cache:
        await cache.set_json(cache_key, result, ttl_seconds=3600)

    return BriefingResponse(**result)


# ── Engine status ─────────────────────────────────────────────────────────────

@router.get("/engines")
async def get_engine_status() -> dict[str, Any]:
    """Return availability and model list for each AI engine."""
    from app.ai.router import get_engines_status
    return await get_engines_status()


def _default_state() -> dict[str, Any]:
    return {
        "energy_level": 3,
        "recent_focus_quality": 3,
        "emotional_load": 2,
        "cognitive_freshness": 3,
        "preferred_modalities": ["focus"],
        "crash_window_local": None,
        "current_streak_state": "building",
        "comeback_bonus_active": False,
    }
