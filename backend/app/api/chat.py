from fastapi import APIRouter, Depends, HTTPException

from app.core.rate_limit import is_rate_limited, record_attempt
from app.database import queries
from app.middleware.auth import get_current_user
from app.schemas.chat import ChatRequest, ChatResponse, PublicChatRequest
from app.services.ai_service import ask_ai, generate_ai_reply
from app.services.session_service import resolve_website_session

router = APIRouter()

PUBLIC_CHAT_MAX_ATTEMPTS = 30
PUBLIC_CHAT_WINDOW_SECONDS = 3600

@router.post(
    "/chat",
    response_model=ChatResponse,
)
def chat(
    request: ChatRequest,
    current_user=Depends(get_current_user),
):
    return ask_ai(
        message=request.message,
        session_id=request.session_id,
        user_id=str(current_user["id"]),
    )


@router.post(
    "/public/chat",
    response_model=ChatResponse,
)
def public_chat(request: PublicChatRequest):
    """Unauthenticated chat for the public website's AI Assistant page.
    Mirrors how the WhatsApp webhook handles customer messages with no
    employee login (see resolve_website_session) - these conversations land
    in the same Sales Inbox as WhatsApp/internal ones, tagged channel='website'."""

    rate_key = f"public_chat:{request.visitor_id}"

    if is_rate_limited(rate_key, PUBLIC_CHAT_MAX_ATTEMPTS, PUBLIC_CHAT_WINDOW_SECONDS):
        raise HTTPException(
            status_code=429,
            detail="Too many messages. Please try again in a little while.",
        )

    record_attempt(rate_key)

    session_id = resolve_website_session(request.visitor_id, request.message)
    history = queries.list_messages(session_id)
    queries.insert_message(session_id, "user", request.message)

    return generate_ai_reply(session_id, request.message, history)
