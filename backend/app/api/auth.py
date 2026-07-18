from fastapi import APIRouter

from app.schemas.auth import LoginRequest, LoginResponse
from app.services.auth_service import login

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/login",
    response_model=LoginResponse,
)
def login_user(request: LoginRequest):
    return login(
        request.email,
        request.password,
        request.remember,
    )