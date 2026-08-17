from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import MessageRole


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    reply: str


class InsightsResponse(BaseModel):
    signals: list[str]
    advice: str


class MessageRead(BaseModel):
    role: MessageRole
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
