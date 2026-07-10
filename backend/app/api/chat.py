from fastapi import APIRouter, Depends

from app.middleware.auth import get_user_id, verify_api_key
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.ai_service import ask_ai

router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse,
    dependencies=[Depends(verify_api_key)],
)
def chat(request: ChatRequest, user_id: str = Depends(get_user_id)):
    return ask_ai(
        message=request.message,
        session_id=request.session_id,
        user_id=user_id,
    )
