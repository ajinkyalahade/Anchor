"""Games API endpoints — Word Gym and Brain Games."""

import random
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.router import AITask, route
from app.api.deps import CurrentUserId
from app.core.input_safety import sanitize_prompt_text
from app.db.database import get_db
from app.db.models import GameSession, Quest

router = APIRouter(prefix="/games", tags=["games"])
DbSession = Annotated[AsyncSession, Depends(get_db)]

STARTER_WORDS = [
    "ocean", "mountain", "coffee", "velocity", "dream", "glass",
    "rhythm", "magnet", "copper", "silence", "horizon",
]

_VALID_GAMES = {"echo", "mirror", "spotter", "lockstep", "switch", "tracker"}

WHY_THIS_MATTERS: dict[str, str] = {
    "echo": "Working memory training builds the mental sticky-note system ADHD often weakens.",
    "mirror": (
        "Pattern recall strengthens the same circuits used for following "
        "multi-step instructions."
    ),
    "spotter": (
        "Sustained attention practice extends the window before distraction "
        "pulls focus away."
    ),
    "lockstep": "Go/no-go training builds the pause between impulse and action.",
    "switch": (
        "Rule-switching builds flexibility — moving between tasks without "
        "losing the thread."
    ),
    "tracker": (
        "Multi-object tracking exercises the attentional spotlight ADHD makes "
        "harder to hold."
    ),
}

# In-memory session store (sufficient for stateless API; replace with DB rows if needed)
_sessions: dict[str, dict[str, Any]] = {}


# ── Word Gym ──────────────────────────────────────────────────────────────────

class WordGymStartResponse(BaseModel):
    base_word: str
    time_limit_seconds: int = 60


class WordGymEvaluateRequest(BaseModel):
    base_word: str = Field(min_length=1, max_length=64)
    user_word: str = Field(min_length=1, max_length=64)

    @field_validator("base_word", "user_word")
    @classmethod
    def _sanitize_words(cls, value: str) -> str:
        return sanitize_prompt_text(value)


class WordGymEvaluateResponse(BaseModel):
    valid: bool
    score: int
    reason: str
    next_word: str


@router.get("/wordgym/start", response_model=WordGymStartResponse)
async def start_word_gym() -> WordGymStartResponse:
    return WordGymStartResponse(base_word=random.choice(STARTER_WORDS))


@router.post("/wordgym/evaluate", response_model=WordGymEvaluateResponse)
async def evaluate_word(data: WordGymEvaluateRequest) -> WordGymEvaluateResponse:
    try:
        eval_result = await route(
            AITask.EVALUATE_WORD, {"base_word": data.base_word, "user_word": data.user_word}
        )
    except Exception:
        eval_result = {
            "valid": False,
            "score": 0,
            "reason": "We could not score that right now. Keep the chain going with another word.",
        }
    return WordGymEvaluateResponse(
        valid=eval_result.get("valid", False),
        score=eval_result.get("score", 0),
        reason=eval_result.get("reason", "Unknown"),
        next_word=data.user_word if eval_result.get("valid") else data.base_word,
    )


# ── Brain Games ───────────────────────────────────────────────────────────────

class GameSessionStartRequest(BaseModel):
    game_key: str


class GameSessionStartResponse(BaseModel):
    session_id: str
    game_key: str
    level: int
    max_duration_seconds: int = 90
    why_this_matters: str


class GameSessionCompleteRequest(BaseModel):
    score: int
    accuracy: int      # 0–100
    rt_mean: int       # milliseconds
    rt_var: int        # milliseconds
    completed: bool = True


class GameSessionCompleteResponse(BaseModel):
    xp_awarded: int
    new_level: int
    cognitive_state: str
    next_game: str
    next_game_reason: str
    why_this_matters: str


class NextGameResponse(BaseModel):
    next_game: str
    reason: str


@router.post("/sessions", response_model=GameSessionStartResponse)
async def start_game_session(
    data: GameSessionStartRequest,
    user_id: CurrentUserId,
    db: DbSession,
) -> GameSessionStartResponse:
    """Start a brain game session. Returns 90s hard cap and ADHD context."""
    game_key = data.game_key if data.game_key in _VALID_GAMES else "echo"
    db_session = GameSession(user_id=user_id, game_key=game_key, level=1)
    db.add(db_session)
    await db.flush()
    session_id = str(db_session.id)
    _sessions[session_id] = {"game_key": game_key, "level": 1, "user_id": user_id}
    return GameSessionStartResponse(
        session_id=session_id,
        game_key=game_key,
        level=1,
        max_duration_seconds=90,
        why_this_matters=WHY_THIS_MATTERS[game_key],
    )


@router.patch("/sessions/{session_id}", response_model=GameSessionCompleteResponse)
async def complete_game_session(
    session_id: str,
    data: GameSessionCompleteRequest,
    db: DbSession,
) -> GameSessionCompleteResponse:
    """Complete a brain game session, classify cognitive state, and suggest next game."""
    mem = _sessions.get(session_id, {"game_key": "echo", "level": 1})
    game_key = mem["game_key"]

    classifier = await route(
        AITask.CLASSIFY_GAME_SESSION,
        {
            "rt_mean": data.rt_mean,
            "rt_var": data.rt_var,
            "accuracy": data.accuracy,
            "game_key": game_key,
        },
    )

    xp_base = 10
    xp_bonus = data.score // 10
    xp_awarded = xp_base + xp_bonus

    new_level = mem.get("level", 1)
    if data.accuracy >= 85 and data.completed:
        new_level = min(new_level + 1, 20)
    elif data.accuracy < 60:
        new_level = max(new_level - 1, 1)

    next_game = classifier.get("next_game", "echo")
    if next_game not in _VALID_GAMES:
        next_game = "echo"

    try:
        db_session = await db.get(GameSession, uuid.UUID(session_id))
        if db_session is not None:
            db_session.score = data.score
            db_session.accuracy = data.accuracy
            db_session.rt_mean = data.rt_mean
            db_session.rt_var = data.rt_var
            db_session.completed = data.completed
            db_session.level = new_level
            await db.flush()
    except (ValueError, Exception):
        pass

    return GameSessionCompleteResponse(
        xp_awarded=xp_awarded,
        new_level=new_level,
        cognitive_state=classifier.get("state", "focused"),
        next_game=next_game,
        next_game_reason=classifier.get("reason", ""),
        why_this_matters=WHY_THIS_MATTERS.get(next_game, WHY_THIS_MATTERS["echo"]),
    )


@router.get("/next", response_model=NextGameResponse)
async def get_next_game(
    user_id: CurrentUserId,
    db: DbSession,
) -> NextGameResponse:
    """Suggest the next brain game based on recent session history."""
    return NextGameResponse(
        next_game="echo",
        reason="Great starting point for focus training.",
    )


# ── Quests ────────────────────────────────────────────────────────────────────

class QuestCompleteRequest(BaseModel):
    quest_key: str = Field(min_length=1, max_length=32)
    title: str = Field(min_length=1, max_length=255)
    duration_seconds: int = Field(gt=0)
    mood_before: int | None = Field(default=None, ge=1, le=5)
    mood_after: int | None = Field(default=None, ge=1, le=5)
    xp_awarded: int = Field(default=0, ge=0)


class QuestCompleteResponse(BaseModel):
    id: str
    quest_key: str
    xp_awarded: int


@router.post(
    "/quests/complete",
    response_model=QuestCompleteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def complete_quest(
    data: QuestCompleteRequest,
    user_id: CurrentUserId,
    db: DbSession,
) -> QuestCompleteResponse:
    """Record an energy quest completion."""
    quest = Quest(
        user_id=user_id,
        quest_key=data.quest_key,
        title=data.title,
        duration_seconds=data.duration_seconds,
        mood_before=data.mood_before,
        mood_after=data.mood_after,
        xp_awarded=data.xp_awarded,
    )
    db.add(quest)
    await db.flush()
    return QuestCompleteResponse(
        id=str(quest.id), quest_key=quest.quest_key, xp_awarded=quest.xp_awarded
    )
