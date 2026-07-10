from pydantic import BaseModel


class SessionSummary(BaseModel):
    id: str
    title: str
    updated_at: str


class SessionMessage(BaseModel):
    role: str
    content: str
    sources: list[str] = []


class SessionMessagesResponse(BaseModel):
    session_id: str
    title: str
    messages: list[SessionMessage]
