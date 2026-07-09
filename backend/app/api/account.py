"""Account lifecycle endpoints."""

from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserId
from app.db.database import get_db
from app.db.models import AccountDeletionRequest, User

router = APIRouter(prefix="/account", tags=["account"])

DELETION_GRACE_PERIOD_DAYS = 30


class AccountDeletionPayload(BaseModel):
    deletion_mode: Literal["scheduled", "immediate"]
    reason: str | None = Field(default=None, max_length=255)


class AccountDeletionResponse(BaseModel):
    status: str
    deletion_mode: Literal["scheduled", "immediate"]
    deleted_now: bool
    scheduled_for: datetime | None = None
    message: str


DbSession = Annotated[AsyncSession, Depends(get_db)]

_VALID_NUDGE_FREQUENCIES = {"none", "gentle", "normal", "proactive"}
_VALID_AI_ENGINES = {"anthropic", "ollama", "auto"}


class PreferencesUpdate(BaseModel):
    nudge_frequency: Literal["none", "gentle", "normal", "proactive"] | None = None
    ai_engine: Literal["anthropic", "ollama", "auto"] | None = None
    ollama_fast_model: str | None = Field(default=None, max_length=64)
    ollama_reasoning_model: str | None = Field(default=None, max_length=64)


@router.patch("/preferences")
async def update_preferences(
    data: PreferencesUpdate,
    user_id: CurrentUserId,
    db: DbSession,
) -> dict:
    """Update user preferences (nudge frequency, AI engine, etc.)."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    prefs = dict(user.prefs or {})
    if data.nudge_frequency is not None:
        prefs["nudge_frequency"] = data.nudge_frequency
    if data.ai_engine is not None:
        prefs["ai_engine"] = data.ai_engine
    if data.ollama_fast_model is not None:
        prefs["ollama_fast_model"] = data.ollama_fast_model
    if data.ollama_reasoning_model is not None:
        prefs["ollama_reasoning_model"] = data.ollama_reasoning_model

    user.prefs = prefs
    await db.flush()
    return {"updated": True, "prefs": prefs}


@router.get("/preferences")
async def get_preferences(
    user_id: CurrentUserId,
    db: DbSession,
) -> dict:
    """Return current user preferences."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user.prefs or {}


@router.post(
    "/deletion",
    response_model=AccountDeletionResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def request_account_deletion(
    payload: AccountDeletionPayload,
    user_id: CurrentUserId,
    db: DbSession,
) -> AccountDeletionResponse:
    # Deletion always targets the authenticated user — the token is the
    # only acceptable proof of who is being deleted.
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    now = datetime.now(UTC)
    if payload.deletion_mode == "scheduled":
        scheduled_for = now + timedelta(days=DELETION_GRACE_PERIOD_DAYS)
        db.add(
            AccountDeletionRequest(
                target_user_id=user_id,
                deletion_mode="scheduled",
                status="pending",
                reason=payload.reason,
                scheduled_for=scheduled_for,
            )
        )
        await db.flush()
        return AccountDeletionResponse(
            status="pending",
            deletion_mode="scheduled",
            deleted_now=False,
            scheduled_for=scheduled_for,
            message="Account deletion scheduled for 30 days from now.",
        )

    db.add(
        AccountDeletionRequest(
            target_user_id=user_id,
            deletion_mode="immediate",
            status="completed",
            reason=payload.reason,
            completed_at=now,
        )
    )
    await db.flush()
    await db.delete(user)

    return AccountDeletionResponse(
        status="completed",
        deletion_mode="immediate",
        deleted_now=True,
        scheduled_for=None,
        message="Account deleted immediately.",
    )
