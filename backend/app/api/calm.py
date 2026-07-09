"""Calm Zone API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.router import AITask, route
from app.ai.safety.classifier import CRISIS_RESPONSE_PAYLOAD, check_crisis
from app.api.deps import UserEnginePref
from app.core.encryption import encrypt_text
from app.core.input_safety import sanitize_prompt_text
from app.core.rate_limit import build_rate_limit_dependency
from app.db.database import get_db
from app.db.models import RsdLog

router = APIRouter(prefix="/calm", tags=["calm"])
ai_rate_limit = build_rate_limit_dependency("calm-rsd", max_requests=10, window_seconds=60)
DbSession = Annotated[AsyncSession, Depends(get_db)]


class RSDRequest(BaseModel):
    trigger_text: str = Field(min_length=1, max_length=2000)
    intensity: int = Field(ge=1, le=10)  # 1–10

    @field_validator("trigger_text")
    @classmethod
    def _sanitize_trigger_text(cls, value: str) -> str:
        return sanitize_prompt_text(value)


class RSDResponse(BaseModel):
    is_crisis: bool = False
    crisis_message: str | None = None
    resources: list[dict[str, str]] | None = None
    validation: str | None = None
    normalization: str | None = None
    reframe: str | None = None


@router.post("/rsd", response_model=RSDResponse)
async def handle_rsd_interrupt(
    data: RSDRequest,
    engine_pref: UserEnginePref,
    db: DbSession,
    _: None = Depends(ai_rate_limit),
) -> RSDResponse:
    """Handle an RSD event — crisis classifier runs before any LLM call."""
    is_crisis = check_crisis(data.trigger_text)

    log = RsdLog(
        trigger_text_enc=encrypt_text(data.trigger_text),
        intensity=data.intensity,
        is_crisis=is_crisis,
    )
    db.add(log)
    await db.commit()

    if is_crisis:
        return RSDResponse(**CRISIS_RESPONSE_PAYLOAD)

    result = await route(
        AITask.RSD_RESPONSE,
        {"trigger_text": data.trigger_text, "intensity": data.intensity},
        engine_pref=engine_pref,
    )
    return RSDResponse(
        validation=result.get("validation"),
        normalization=result.get("normalization"),
        reframe=result.get("reframe"),
    )
