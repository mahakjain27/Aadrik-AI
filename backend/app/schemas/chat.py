from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str | None = None


class PublicChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    visitor_id: str = Field(..., min_length=8, max_length=100)


class ChatResponse(BaseModel):
    reply: str
    sources: list[str]
    session_id: str
