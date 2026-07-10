from fastapi import APIRouter, Depends

from app.middleware.auth import get_user_id, verify_api_key
from app.schemas.session import SessionMessagesResponse, SessionSummary
from app.services.session_service import get_session_messages, list_sessions_for_user

router = APIRouter()


@router.get(
    "/sessions",
    response_model=list[SessionSummary],
    dependencies=[Depends(verify_api_key)],
)
def get_sessions(user_id: str = Depends(get_user_id)):
    return list_sessions_for_user(user_id)


@router.get(
    "/sessions/{session_id}/messages",
    response_model=SessionMessagesResponse,
    dependencies=[Depends(verify_api_key)],
)
def get_session_messages_route(session_id: str, user_id: str = Depends(get_user_id)):
    return get_session_messages(session_id, user_id)
