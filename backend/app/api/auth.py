# SPDX-License-Identifier: MIT
"""Email + password authentication endpoints."""

import uuid
from datetime import UTC, datetime
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    ACCESS_TOKEN_TTL_SECONDS,
    build_access_token,
    hash_password,
    verify_password,
)
from app.core.config import get_settings
from app.core.rate_limit import build_ip_rate_limit_dependency
from app.core.token_revocation import revoke_token
from app.db.database import get_db
from app.db.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

DbSession = Annotated[AsyncSession, Depends(get_db)]

# IP-based limits for unauthenticated endpoints: throttle password guessing
# and unauthenticated row creation (DB-fill DoS).
login_rate_limit = build_ip_rate_limit_dependency(
    "auth-login", max_requests=10, window_seconds=60
)
register_rate_limit = build_ip_rate_limit_dependency(
    "auth-register", max_requests=5, window_seconds=60
)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class RegisterPayload(BaseModel):
    email: str
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("Invalid email address")
        return normalized

    @field_validator("first_name", "last_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name cannot be empty")
        return normalized


class LoginPayload(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return value.strip().lower()


class AuthResponse(BaseModel):
    status: str
    user_id: uuid.UUID
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    first_name: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(register_rate_limit)],
)
async def register(
    payload: RegisterPayload,
    response: Response,
    db: DbSession,
) -> AuthResponse:
    """Create a new account with email + password."""
    response.headers["Cache-Control"] = "no-store"
    # Check if email already exists
    existing = await _get_user_by_email(db, payload.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Try logging in instead.",
        )

    user = User(
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()

    access_token, access_expiry = build_access_token(
        user_id=str(user.id),
        email=user.email,
        secret=get_settings().jwt_secret,
    )

    _set_session_cookie(response, access_token)
    return AuthResponse(
        status="registered",
        user_id=user.id,
        access_token=access_token,
        expires_at=datetime.fromtimestamp(access_expiry, UTC),
        first_name=user.first_name,
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    dependencies=[Depends(login_rate_limit)],
)
async def login(
    payload: LoginPayload,
    response: Response,
    db: DbSession,
) -> AuthResponse:
    """Log in with email + password."""
    response.headers["Cache-Control"] = "no-store"
    user = await _get_user_by_email(db, payload.email)

    if user is None or user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    access_token, access_expiry = build_access_token(
        user_id=str(user.id),
        email=user.email,
        secret=get_settings().jwt_secret,
    )

    _set_session_cookie(response, access_token)
    return AuthResponse(
        status="authenticated",
        user_id=user.id,
        access_token=access_token,
        expires_at=datetime.fromtimestamp(access_expiry, UTC),
        first_name=user.first_name,
    )


@router.post(
    "/register-anonymous",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(register_rate_limit)],
)
async def register_anonymous(
    response: Response,
    db: DbSession,
) -> AuthResponse:
    """Create an anonymous user (for skipped signup during onboarding).
    Returns a JWT so the user can use the app, and can later upgrade to
    a full account by setting email + password on the profile."""
    response.headers["Cache-Control"] = "no-store"
    user = User()
    db.add(user)
    await db.flush()

    access_token, access_expiry = build_access_token(
        user_id=str(user.id),
        email=None,
        secret=get_settings().jwt_secret,
    )

    _set_session_cookie(response, access_token)
    return AuthResponse(
        status="anonymous",
        user_id=user.id,
        access_token=access_token,
        expires_at=datetime.fromtimestamp(access_expiry, UTC),
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(request: Request, response: Response) -> dict[str, str]:
    """Clear the session cookie and revoke the presented access token so it
    cannot be reused (server-side revocation via the token denylist)."""
    response.headers["Cache-Control"] = "no-store"
    response.delete_cookie(key="anchor_session", path="/", samesite="strict")

    token = _bearer_or_cookie_token(request)
    if token:
        try:
            # Decode without verifying expiry so an already-borderline token
            # is still revoked; signature is still checked.
            claims = jwt.decode(
                token,
                get_settings().jwt_secret,
                algorithms=["HS256"],
                options={"verify_exp": False},
            )
            cache = getattr(request.app.state, "cache", None)
            await revoke_token(cache, claims.get("jti"), claims.get("exp"))
        except jwt.InvalidTokenError:
            pass  # nothing to revoke on a bad token

    return {"status": "logged_out"}


def _bearer_or_cookie_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth.removeprefix("Bearer ").strip()
    return request.cookies.get("anchor_session")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="anchor_session",
        value=token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=ACCESS_TOKEN_TTL_SECONDS,
        path="/",
    )

async def _get_user_by_email(db: AsyncSession, normalized_email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == normalized_email))
    return result.scalar_one_or_none()
