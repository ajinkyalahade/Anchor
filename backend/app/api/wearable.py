"""Wearable integration API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserId
from app.db.database import get_db
from app.db.models import RewardLedger, RewardState, User, UserStateSnapshot
from app.domain.user_state.service import compute_user_state

router = APIRouter(prefix="/wearable", tags=["wearable"])


class HRVDataRequest(BaseModel):
    hrv_score: float = Field(gt=0, description="Heart Rate Variability in ms")
    source: str = Field(default="apple_watch")


class HRVDataResponse(BaseModel):
    message: str
    emotional_load_updated: bool
    new_emotional_load: int


DbSession = Annotated[AsyncSession, Depends(get_db)]



@router.post("/hrv", response_model=HRVDataResponse)
async def ingest_hrv_data(
    data: HRVDataRequest,
    db: DbSession,
    header_user_id: CurrentUserId,
) -> HRVDataResponse:
    """Ingest HRV data from a wearable and update user state (emotional load)."""
    if header_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID header is required",
        )

    user = await db.get(User, header_user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Fetch needed data for full snapshot computation
    total_xp_result = await db.scalar(
        select(func.coalesce(func.sum(RewardLedger.xp), 0))
        .where(RewardLedger.user_id == user.id)
    )
    total_xp = int(total_xp_result or 0)

    rows = await db.execute(
        select(RewardLedger.source, func.sum(RewardLedger.xp).label("total"))
        .where(RewardLedger.user_id == user.id)
        .group_by(RewardLedger.source)
    )
    xp_by_source = {row.source: int(row.total) for row in rows}
    
    reward_state = await db.get(RewardState, user.id)
    streak_state = reward_state.current_streak_state if reward_state else "building"
    comeback_active = reward_state.comeback_bonus_active if reward_state else False

    crash_window = user.profile.crash_window if user.profile else None

    snapshot = compute_user_state(
        xp_by_source=xp_by_source,
        total_xp=total_xp,
        streak_state=streak_state,
        comeback_bonus_active=comeback_active,
        crash_window=crash_window,
        hrv_score=data.hrv_score,
    )

    existing = await db.get(UserStateSnapshot, user.id)
    old_load = existing.snapshot.get("emotional_load", 1) if existing else 1
    
    if existing:
        existing.snapshot = snapshot
    else:
        db.add(UserStateSnapshot(user_id=user.id, snapshot=snapshot))
    
    await db.commit()

    new_load = snapshot.get("emotional_load", 1)
    updated = new_load != old_load

    return HRVDataResponse(
        message="HRV data ingested and user state updated.",
        emotional_load_updated=updated,
        new_emotional_load=new_load,
    )
