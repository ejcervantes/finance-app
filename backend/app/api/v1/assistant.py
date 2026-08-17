from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models.assistant_message import AssistantMessage
from app.schemas.assistant import (
    ChatRequest,
    ChatResponse,
    InsightsResponse,
    MessageRead,
)
from app.services import advisor

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest, current_user: CurrentUser, db: DbSession
) -> ChatResponse:
    reply = await advisor.chat(db, current_user.id, payload.message)
    return ChatResponse(reply=reply)


@router.get("/insights", response_model=InsightsResponse)
async def insights(current_user: CurrentUser, db: DbSession) -> InsightsResponse:
    result = await advisor.insights(db, current_user.id)
    return InsightsResponse(**result)


@router.get("/history", response_model=list[MessageRead])
async def history(
    current_user: CurrentUser, db: DbSession
) -> list[AssistantMessage]:
    rows = (
        await db.scalars(
            select(AssistantMessage)
            .where(AssistantMessage.user_id == current_user.id)
            .order_by(AssistantMessage.created_at.asc())
        )
    ).all()
    return list(rows)
