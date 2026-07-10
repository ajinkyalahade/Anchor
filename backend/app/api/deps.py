# SPDX-License-Identifier: MIT
import uuid
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.token_revocation import is_token_revoked
from app.db.database import get_db

security = HTTPBearer()


async def get_current_user_id(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> uuid.UUID:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=["HS256"],
        )
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="token_invalid",
            )
    except jwt.ExpiredSignatureError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token_expired",
        ) from err
    except jwt.InvalidTokenError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token_invalid",
        ) from err

    # Reject tokens that have been explicitly revoked (e.g. via logout).
    cache = getattr(request.app.state, "cache", None)
    if await is_token_revoked(cache, payload.get("jti")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token_revoked",
        )
    return uuid.UUID(user_id_str)

CurrentUserId = Annotated[uuid.UUID, Depends(get_current_user_id)]

# For endpoints that render a default response when dependency overrides
# (tests) supply no user. At runtime the dependency itself never yields None.
OptionalUserId = Annotated[uuid.UUID | None, Depends(get_current_user_id)]


async def get_user_engine_pref(
    user_id: CurrentUserId,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> str:
    """Return the user's saved ai_engine preference, or the server default.
    Falls back gracefully when DB is unavailable."""
    try:
        from app.db.models import User
        user = await db.get(User, user_id)
        prefs: dict[str, Any] = (user.prefs or {}) if user else {}
        return str(prefs.get("ai_engine", get_settings().ai_default_engine))
    except Exception:
        return get_settings().ai_default_engine

UserEnginePref = Annotated[str, Depends(get_user_engine_pref)]
