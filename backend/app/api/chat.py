from fastapi import APIRouter, Depends

from app.middleware.auth import get_current_user 
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.ai_service import ask_ai

router = APIRouter()

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
