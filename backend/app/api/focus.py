"""Focus Engine API endpoints."""

import json
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompts.decompose import DECOMPOSE_PROMPT_SYSTEM
from app.ai.router import AITask, anthropic_client, route
from app.api.deps import CurrentUserId, UserEnginePref
from app.core.config import get_settings
from app.core.input_safety import sanitize_prompt_text
from app.core.rate_limit import build_rate_limit_dependency
from app.db.database import get_db
from app.db.models import FocusSession

settings = get_settings()
ai_rate_limit = build_rate_limit_dependency("focus-decompose", max_requests=10, window_seconds=60)

router = APIRouter(prefix="/focus", tags=["focus"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


class DecomposeRequest(BaseModel):
    task_text: str = Field(min_length=1, max_length=500)

    @field_validator("task_text")
    @classmethod
    def _sanitize_task_text(cls, value: str) -> str:
        return sanitize_prompt_text(value)


class DecomposeResponse(BaseModel):
    steps: list[dict[str, Any]]
    why_first_step_matters: str


class FocusSessionCreate(BaseModel):
    duration_planned: int # in seconds
    task_text: str | None = Field(default=None, max_length=500)
    decomposition_jsonb: dict[str, Any] | None = None

    @field_validator("task_text")
    @classmethod
    def _sanitize_optional_task_text(cls, value: str | None) -> str | None:
        return sanitize_prompt_text(value) if value is not None else value


class FocusSessionUpdate(BaseModel):
    duration_actual: int
    completed_steps_int: int = 0
    distractions_jsonb: list[str] = []
    mood_before: int | None = None
    mood_after: int | None = None


@router.post("/decompose", response_model=DecomposeResponse)
async def decompose_task(
    data: DecomposeRequest,
    engine_pref: UserEnginePref,
    _: None = Depends(ai_rate_limit),
) -> DecomposeResponse:
    """Decompose a task into micro-steps using the user's preferred AI engine."""
    result = await route(
        AITask.DECOMPOSE,
        {"task_text": data.task_text},
        engine_pref=engine_pref,
    )
    return DecomposeResponse(**result)


@router.post("/decompose/stream")
async def decompose_task_stream(data: DecomposeRequest) -> StreamingResponse:
    """Stream a task decomposition as Server-Sent Events for improved perceived latency."""
    return StreamingResponse(
        _stream_decompose(data.task_text),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _stream_decompose(task_text: str) -> AsyncIterator[str]:
    yield "event: status\ndata: thinking\n\n"

    if not anthropic_client:
        fallback = await route(AITask.DECOMPOSE, {"task_text": task_text})
        yield f"event: result\ndata: {json.dumps(fallback)}\n\n"
        yield "event: done\ndata: \n\n"
        return

    full_text = ""
    async with anthropic_client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        temperature=0.2,
        system=DECOMPOSE_PROMPT_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": f"Task: {task_text}\n\nRespond with strictly valid JSON.",
            }
        ],
    ) as stream:
        async for chunk in stream.text_stream:
            full_text += chunk

    try:
        text = full_text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        result = json.loads(text)
    except (json.JSONDecodeError, IndexError):
        result = await route(AITask.DECOMPOSE, {"task_text": task_text})

    yield f"event: result\ndata: {json.dumps(result)}\n\n"
    yield "event: done\ndata: \n\n"


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    data: FocusSessionCreate,
    user_id: CurrentUserId,
    db: DbSession,
) -> dict[str, str]:
    """Start a new focus session."""
    session = FocusSession(
        user_id=user_id,
        duration_planned=data.duration_planned,
        task_text=data.task_text,
        decomposition_jsonb=data.decomposition_jsonb,
    )
    db.add(session)
    await db.flush()
    return {"id": str(session.id), "status": "started", "user_id": str(user_id)}


@router.patch("/sessions/{session_id}")
async def update_session(
    session_id: uuid.UUID,
    data: FocusSessionUpdate,
    db: DbSession,
) -> dict[str, str]:
    """End or update a focus session."""
    session = await db.get(FocusSession, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session_not_found")
    session.duration_actual = data.duration_actual
    session.completed_steps_int = data.completed_steps_int
    session.distractions_jsonb = data.distractions_jsonb
    session.mood_before = data.mood_before
    session.mood_after = data.mood_after
    session.ended_at = datetime.now(UTC)
    await db.flush()
    return {"id": str(session_id), "status": "updated"}
