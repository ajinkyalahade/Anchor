# SPDX-License-Identifier: MIT
"""Email + password authentication endpoints."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserId
from app.core.auth import (
    ACCESS_TOKEN_TTL_SECONDS,
    build_access_token,
    generate_magic_link_token,
    hash_magic_link_token,
    hash_password,
    password_needs_rehash,
    verify_password,
)
from app.core.config import get_settings
from app.core.email import get_email_sender
from app.core.rate_limit import build_ip_rate_limit_dependency
from app.core.token_revocation import revoke_token
from app.db.database import get_db
from app.db.models import AuthMagicLink, User

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
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        # EmailStr already validated the syntax; lowercase so lookups and the
        # uniqueness check are case-insensitive.
        return value.strip().lower()

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

    # Transparent upgrade: legacy scrypt hashes (and outdated argon2 params)
    # are re-hashed with current argon2id on successful login.
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
        await db.flush()

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


refresh_rate_limit = build_ip_rate_limit_dependency(
    "auth-refresh", max_requests=10, window_seconds=60
)


@router.post(
    "/refresh",
    response_model=AuthResponse,
    dependencies=[Depends(refresh_rate_limit)],
)
async def refresh(request: Request, response: Response) -> AuthResponse:
    """Rotate the session token (SEC-5): validate the presented token,
    revoke its jti, and issue a fresh one. Called by the app on startup so
    active users slide their session forward while a stolen token's
    lifetime is cut short the next time the real user opens the app."""
    response.headers["Cache-Control"] = "no-store"

    token = _bearer_or_cookie_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="not_authenticated"
        )
    try:
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="token_expired"
        ) from err
    except jwt.InvalidTokenError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="token_invalid"
        ) from err

    cache = getattr(request.app.state, "cache", None)
    from app.core.token_revocation import is_token_revoked

    if await is_token_revoked(cache, claims.get("jti")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="token_revoked"
        )

    # Revoke the old token before minting its successor — a replayed old
    # token must die the moment the rotation happens.
    await revoke_token(cache, claims.get("jti"), claims.get("exp"))

    access_token, access_expiry = build_access_token(
        user_id=str(claims["sub"]),
        email=claims.get("email"),
        secret=get_settings().jwt_secret,
    )
    _set_session_cookie(response, access_token)
    return AuthResponse(
        status="refreshed",
        user_id=uuid.UUID(claims["sub"]),
        access_token=access_token,
        expires_at=datetime.fromtimestamp(access_expiry, UTC),
    )


class MeResponse(BaseModel):
    user_id: uuid.UUID
    email: str | None
    first_name: str | None
    last_name: str | None


@router.get("/me", response_model=MeResponse)
async def me(user_id: CurrentUserId, db: DbSession) -> MeResponse:
    """Return the authenticated user's identity — the canonical source for
    the greeting name (FE-2: clients previously relied on localStorage)."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return MeResponse(
        user_id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
    )


def _bearer_or_cookie_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth.removeprefix("Bearer ").strip()
    return request.cookies.get("anchor_session")


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------

PASSWORD_RESET_TTL_SECONDS = 30 * 60

password_reset_rate_limit = build_ip_rate_limit_dependency(
    "auth-password-reset", max_requests=5, window_seconds=60
)


class PasswordResetRequestPayload(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def normalize(cls, value: str) -> str:
        return value.strip().lower()


class PasswordResetConfirmPayload(BaseModel):
    token: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)


@router.post(
    "/password-reset/request",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(password_reset_rate_limit)],
)
async def request_password_reset(
    payload: PasswordResetRequestPayload,
    response: Response,
    db: DbSession,
) -> dict[str, str]:
    """Begin a password reset. Always returns 202 with the same body so the
    endpoint can't be used to discover which emails have accounts."""
    response.headers["Cache-Control"] = "no-store"
    settings = get_settings()

    user = await _get_user_by_email(db, payload.email)
    if user is not None and user.password_hash is not None and user.email:
        raw_token = generate_magic_link_token()
        link = AuthMagicLink(
            user_id=user.id,
            email=user.email,
            token_hash=hash_magic_link_token(raw_token, settings.magic_link_secret),
            expires_at=datetime.now(UTC) + timedelta(seconds=PASSWORD_RESET_TTL_SECONDS),
        )
        db.add(link)
        await db.flush()

        reset_url = f"{settings.public_app_url}/auth/reset?token={raw_token}"
        sender = get_email_sender(settings)
        await sender.send(
            to=user.email,
            subject="Reset your Anchor password",
            body=(
                "You (or someone) asked to reset your Anchor password.\n\n"
                f"Reset it here (expires in 30 minutes):\n{reset_url}\n\n"
                "If this wasn't you, you can ignore this email."
            ),
        )

    return {"status": "if_the_account_exists_an_email_was_sent"}


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
async def confirm_password_reset(
    payload: PasswordResetConfirmPayload,
    response: Response,
    db: DbSession,
) -> dict[str, str]:
    """Complete a password reset using the token from the email."""
    response.headers["Cache-Control"] = "no-store"
    settings = get_settings()
    token_hash = hash_magic_link_token(payload.token, settings.magic_link_secret)

    result = await db.execute(
        select(AuthMagicLink).where(AuthMagicLink.token_hash == token_hash)
    )
    link = result.scalar_one_or_none()

    now = datetime.now(UTC)
    if (
        link is None
        or link.consumed_at is not None
        or _as_utc(link.expires_at) < now
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired.",
        )

    user = await db.get(User, link.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired.",
        )

    user.password_hash = hash_password(payload.new_password)
    link.consumed_at = now
    await db.flush()
    return {"status": "password_reset"}


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


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
