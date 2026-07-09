"""Onboarding API endpoints."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import build_access_token, hash_password
from app.core.config import get_settings
from app.db.database import get_db
from app.db.models import Profile, User

router = APIRouter(prefix="/onboarding", tags=["onboarding"])
logger = logging.getLogger(__name__)
DbSession = Annotated[AsyncSession, Depends(get_db)]


class OnboardingRequest(BaseModel):
    deficit_tags: list[str] = Field(default_factory=list)
    crash_window: str | None = None
    vibe_pref: str = "gentle"
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: str | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("Invalid email address")
        return normalized

    @field_validator("first_name", "last_name")
    @classmethod
    def normalize_optional_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class OnboardingResponse(BaseModel):
    user_id: uuid.UUID
    profile_id: uuid.UUID
    access_token: str
    status: str = "success"


@router.post("", response_model=OnboardingResponse, status_code=status.HTTP_201_CREATED)
async def complete_onboarding(
    data: OnboardingRequest,
    db: DbSession,
) -> OnboardingResponse:
    """
    Creates a user and profile from the onboarding flow.
    If email + password are provided, creates a full account.
    Otherwise creates an anonymous user with a JWT so they can use the app.
    """
    # Check if email is taken
    if data.email:
        existing = await db.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists. Try logging in instead.",
            )

    # Create the user
    user = User(
        email=data.email,
        first_name=data.first_name,
        last_name=data.last_name,
        password_hash=hash_password(data.password) if data.password else None,
    )
    db.add(user)
    await db.flush()  # To get user.id

    # Create the profile linked to the user
    profile = Profile(
        user_id=user.id,
        deficit_tags=data.deficit_tags,
        crash_window=data.crash_window,
        vibe_pref=data.vibe_pref,
        onboarding_completed=True,
    )
    db.add(profile)

    await db.commit()
    await db.refresh(user)
    await db.refresh(profile)

    logger.info("metric event=onboarding_completed user_id=%s", str(user.id))

    # Issue a JWT so the user is immediately logged in
    access_token, _ = build_access_token(
        user_id=str(user.id),
        email=user.email,
        secret=get_settings().jwt_secret,
    )

    return OnboardingResponse(
        user_id=user.id,
        profile_id=profile.id,
        access_token=access_token,
    )
