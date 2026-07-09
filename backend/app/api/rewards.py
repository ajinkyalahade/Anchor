"""Rewards and progression API endpoints."""

import uuid
from datetime import UTC, date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserId, OptionalUserId
from app.db.database import get_db
from app.db.models import RewardLedger, RewardState, User, UserStateSnapshot
from app.domain.rewards.service import (
    UNLOCK_CATALOG,
    RewardSource,
    RewardSummary,
    StreakSnapshot,
    UnlockItem,
    advance_streak_after_activity,
    calculate_weighted_xp,
    compute_newly_unlocked,
    get_catalog_with_status,
    refresh_streak_for_today,
    summarize_rewards,
)
from app.domain.user_state.service import compute_user_state

router = APIRouter(prefix="/rewards", tags=["rewards"])


class RewardsSummaryResponse(BaseModel):
    total_xp: int
    current_streak: int
    streak_state: str
    comeback_bonus_active: bool
    message: str | None = None


class RewardGrantRequest(BaseModel):
    source: RewardSource
    base_xp: int = Field(gt=0, le=500)
    reason: str = Field(default="showed up", max_length=255)


class RewardGrantResponse(BaseModel):
    xp_granted: int
    total_xp: int
    message: str
    current_streak: int
    streak_state: str
    comeback_bonus_active: bool
    newly_unlocked: list[str] = []


class UnlockCatalogItem(BaseModel):
    id: str
    type: str
    label: str
    xp_required: int
    description: str
    unlocked: bool


class UnlocksResponse(BaseModel):
    total_xp: int
    catalog: list[UnlockCatalogItem]
    active_theme: str | None = None
    active_sound: str | None = None


class ActivateUnlockRequest(BaseModel):
    item_id: str


class ActivateUnlockResponse(BaseModel):
    item_id: str
    activated: bool
    message: str


DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/summary", response_model=RewardsSummaryResponse)
async def get_rewards_summary(
    db: DbSession,
    user_id: OptionalUserId = None,
) -> RewardsSummaryResponse:
    """Get the user's current XP and activity state."""
    if user_id is None:
        return RewardsSummaryResponse(
            total_xp=0,
            current_streak=0,
            streak_state="building",
            comeback_bonus_active=False,
            message=None,
        )

    total_xp = await _total_xp(db, user_id)
    reward_state = await _get_or_create_reward_state(db, user_id)
    snapshot = refresh_streak_for_today(
        reward_state.current_streak,
        reward_state.last_activity_date,
        _today(),
    )
    _apply_snapshot(reward_state, snapshot)
    await db.flush()

    return RewardsSummaryResponse(
        total_xp=total_xp,
        current_streak=snapshot.current_streak,
        streak_state=snapshot.streak_state,
        comeback_bonus_active=snapshot.comeback_bonus_active,
        message=_summary_message(snapshot.comeback_bonus_active),
    )


@router.post(
    "/grant",
    response_model=RewardGrantResponse,
    status_code=status.HTTP_201_CREATED,
)
async def grant_xp(
    data: RewardGrantRequest,
    db: DbSession,
    header_user_id: CurrentUserId,
) -> RewardGrantResponse:
    """Grant XP to the authenticated user and persist the ledger entry."""
    user_id = header_user_id

    from sqlalchemy.orm import selectinload as _sil
    _ur = await db.execute(select(User).where(User.id == user_id).options(_sil(User.profile)))
    user = _ur.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    before_state = await _get_or_create_reward_state(db, user_id)
    before_snapshot = refresh_streak_for_today(
        before_state.current_streak,
        before_state.last_activity_date,
        _today(),
    )
    _apply_snapshot(before_state, before_snapshot)

    xp_granted = calculate_weighted_xp(
        data.source,
        data.base_xp,
        comeback_bonus=before_snapshot.comeback_bonus_active,
    )
    previous_xp = await _total_xp(db, user_id)

    reward = RewardLedger(
        user_id=user_id,
        source=data.source,
        xp=xp_granted,
        reason=data.reason,
    )
    db.add(reward)
    await db.flush()

    after_snapshot = advance_streak_after_activity(
        before_state.current_streak,
        before_state.last_activity_date,
        _today(),
    )
    before_state.last_activity_date = _today()
    _apply_snapshot(before_state, after_snapshot)

    total_xp = await _total_xp(db, user_id)
    newly_unlocked = compute_newly_unlocked(total_xp, previous_xp)
    message = _reward_message(xp_granted, before_snapshot.comeback_bonus_active)
    await _upsert_user_state_snapshot(db, user, before_state, total_xp)

    return RewardGrantResponse(
        xp_granted=xp_granted,
        total_xp=total_xp,
        message=message,
        current_streak=after_snapshot.current_streak,
        streak_state=after_snapshot.streak_state,
        comeback_bonus_active=after_snapshot.comeback_bonus_active,
        newly_unlocked=[item.id for item in newly_unlocked],
    )


@router.get("/unlocks", response_model=UnlocksResponse)
async def get_unlocks(
    db: DbSession,
    user_id: OptionalUserId = None,
) -> UnlocksResponse:
    """Return unlock catalog with locked/unlocked status for the user."""
    if user_id is None:
        return UnlocksResponse(
            total_xp=0,
            catalog=_to_catalog_models(get_catalog_with_status(0)),
        )

    total_xp = await _total_xp(db, user_id)
    user = await db.get(User, user_id)
    prefs: dict[str, Any] = user.prefs if user and user.prefs else {}

    return UnlocksResponse(
        total_xp=total_xp,
        catalog=_to_catalog_models(get_catalog_with_status(total_xp)),
        active_theme=prefs.get("active_theme"),
        active_sound=prefs.get("active_sound"),
    )


@router.post("/unlocks/activate", response_model=ActivateUnlockResponse)
async def activate_unlock(
    data: ActivateUnlockRequest,
    user_id: CurrentUserId,
    db: DbSession,
) -> ActivateUnlockResponse:
    """Set an unlocked theme or sound as active for the authenticated user."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    catalog_index = {item.id: item for item in UNLOCK_CATALOG}
    if data.item_id not in catalog_index:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown item")

    item: UnlockItem = catalog_index[data.item_id]
    total_xp = await _total_xp(db, user_id)
    if total_xp < item.xp_required:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Keep showing up to unlock this — {item.xp_required} XP needed",
        )

    prefs = dict(user.prefs or {})
    prefs["active_theme" if item.type == "theme" else "active_sound"] = data.item_id
    user.prefs = prefs
    await db.flush()

    return ActivateUnlockResponse(
        item_id=data.item_id,
        activated=True,
        message=f"{item.label} is now active.",
    )


def _to_catalog_models(catalog: list[dict[str, Any]]) -> list[UnlockCatalogItem]:
    return [UnlockCatalogItem(**entry) for entry in catalog]


async def _upsert_user_state_snapshot(
    db: AsyncSession,
    user: User,
    reward_state: RewardState,
    total_xp: int,
) -> None:
    rows = await db.execute(
        select(RewardLedger.source, func.sum(RewardLedger.xp).label("total"))
        .where(RewardLedger.user_id == user.id)
        .group_by(RewardLedger.source)
    )
    xp_by_source: dict[str, int] = {row.source: int(row.total) for row in rows}
    from sqlalchemy import select as _sel
    from sqlalchemy.orm import selectinload as _sil
    _ur = await db.execute(_sel(User).where(User.id == user.id).options(_sil(User.profile)))
    user = _ur.scalar_one_or_none() or user
    crash_window = user.profile.crash_window if (user and user.profile) else None
    snapshot = compute_user_state(
        xp_by_source=xp_by_source,
        total_xp=total_xp,
        streak_state=reward_state.current_streak_state,
        comeback_bonus_active=reward_state.comeback_bonus_active,
        crash_window=crash_window,
    )

    existing = await db.get(UserStateSnapshot, user.id)
    if existing:
        existing.snapshot = snapshot
    else:
        db.add(UserStateSnapshot(user_id=user.id, snapshot=snapshot))
    await db.flush()


async def _build_summary(db: AsyncSession, user_id: uuid.UUID) -> RewardSummary:
    total_xp = await db.scalar(
        select(func.coalesce(func.sum(RewardLedger.xp), 0)).where(
            RewardLedger.user_id == user_id,
        )
    )
    timestamp_result = await db.scalars(
        select(RewardLedger.ts)
        .where(RewardLedger.user_id == user_id)
        .order_by(RewardLedger.ts.desc())
    )
    timestamps = [
        ts if isinstance(ts, datetime) else datetime.fromisoformat(str(ts))
        for ts in timestamp_result.all()
    ]

    return summarize_rewards(total_xp=int(total_xp or 0), activity_timestamps=timestamps)


async def _total_xp(db: AsyncSession, user_id: uuid.UUID) -> int:
    total_xp = await db.scalar(
        select(func.coalesce(func.sum(RewardLedger.xp), 0)).where(
            RewardLedger.user_id == user_id,
        )
    )
    return int(total_xp or 0)


async def _get_or_create_reward_state(db: AsyncSession, user_id: uuid.UUID) -> RewardState:
    reward_state = await db.get(RewardState, user_id)
    if reward_state is not None:
        return reward_state

    legacy_summary = await _build_summary(db, user_id)
    legacy_latest_date = await _latest_activity_date(db, user_id)
    reward_state = RewardState(
        user_id=user_id,
        current_streak=legacy_summary.current_streak,
        current_streak_state=legacy_summary.streak_state,
        last_activity_date=legacy_latest_date,
        comeback_bonus_active=legacy_summary.comeback_bonus_active,
    )
    db.add(reward_state)
    await db.flush()
    return reward_state


async def _latest_activity_date(db: AsyncSession, user_id: uuid.UUID) -> date | None:
    latest_ts = await db.scalar(
        select(RewardLedger.ts)
        .where(RewardLedger.user_id == user_id)
        .order_by(RewardLedger.ts.desc())
        .limit(1)
    )
    if latest_ts is None:
        return None
    if isinstance(latest_ts, datetime):
        return latest_ts.astimezone(UTC).date()
    return datetime.fromisoformat(str(latest_ts)).astimezone(UTC).date()


def _apply_snapshot(reward_state: RewardState, snapshot: StreakSnapshot) -> None:
    reward_state.current_streak = snapshot.current_streak
    reward_state.current_streak_state = snapshot.streak_state
    reward_state.comeback_bonus_active = snapshot.comeback_bonus_active


def _today() -> date:
    return datetime.now(UTC).date()


def _summary_message(comeback_bonus_active: bool) -> str | None:
    if comeback_bonus_active:
        return "Comeback bonus is ready for your next session."
    return None


def _reward_message(xp_granted: int, comeback_bonus: bool) -> str:
    if comeback_bonus:
        return f"Welcome back. Comeback bonus: {xp_granted} XP."

    return f"You earned {xp_granted} XP."
