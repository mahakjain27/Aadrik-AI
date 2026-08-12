from pydantic import BaseModel


class SessionSummary(BaseModel):
    id: str
    title: str
    updated_at: str

    channel: str
    status: str
    customer_phone: str | None = None
    assigned_to: int | None = None
    assigned_to_name: str | None = None
    unread: bool = False
    is_archived: bool = False


class SessionMessage(BaseModel):
    role: str
    content: str
    sources: list[str] = []
    created_at: str | None = None


class SessionMessagesResponse(BaseModel):
    session_id: str
    title: str
    channel: str
    status: str
    customer_phone: str | None = None
    assigned_to: int | None = None
    assigned_to_name: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    is_archived: bool = False
    messages: list[SessionMessage]


class SalesReplyRequest(BaseModel):
    message: str


class AssignSessionRequest(BaseModel):
    assigned_to: int | None = None


class SessionAIAssist(BaseModel):
    summary: str
    suggested_reply: str


class CheckWhatsAppNumberRequest(BaseModel):
    phone: str


class CheckWhatsAppNumberResponse(BaseModel):
    session_id: str | None = None
    customer_phone: str
    window_open: bool
    is_new: bool


class SendWhatsAppTemplateRequest(BaseModel):
    phone: str


class SendWhatsAppTemplateResponse(BaseModel):
    session_id: str