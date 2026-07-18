from fastapi import APIRouter, Depends

from app.middleware.auth import get_current_user, require_roles
from app.schemas.user import (
    ChangeOwnPasswordRequest,
    CreateUserRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    UpdateUserRequest,
    UpdateUserStatusRequest,
    UserResponse,
)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserResponse])
def list_users(
    current_user=Depends(require_roles("admin")),
):
    return user_service.list_users()


@router.get("/me", response_model=UserResponse)
def get_my_profile(
    current_user=Depends(get_current_user),
):
    return dict(current_user)


@router.patch("/me", response_model=UserResponse)
def update_my_profile(
    request: UpdateProfileRequest,
    current_user=Depends(get_current_user),
):
    return user_service.update_own_profile(
        current_user["id"], request.name, request.email
    )


@router.post("/me/change-password")
def change_my_password(
    request: ChangeOwnPasswordRequest,
    current_user=Depends(get_current_user),
):
    return user_service.change_own_password(
        current_user["id"], request.current_password, request.new_password
    )


@router.post("", response_model=UserResponse)
def create_user(
    request: CreateUserRequest,
    current_user=Depends(require_roles("admin")),
):
    return user_service.create_user(
        **request.model_dump(), current_user=current_user
    )


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    request: UpdateUserRequest,
    current_user=Depends(require_roles("admin")),
):
    return user_service.update_user(
        user_id, request.name, request.role, current_user
    )


@router.patch("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    request: UpdateUserStatusRequest,
    current_user=Depends(require_roles("admin")),
):
    return user_service.set_user_status(
        user_id, request.is_active, current_user
    )


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    request: ResetPasswordRequest,
    current_user=Depends(require_roles("admin")),
):
    return user_service.reset_password(user_id, request.password, current_user)


@router.delete("/{user_id}", response_model=UserResponse)
def delete_user(
    user_id: int,
    current_user=Depends(require_roles("admin")),
):
    # Soft delete: deactivate rather than remove, so chat/quotation
    # history tied to this user id stays intact.
    return user_service.set_user_status(user_id, False, current_user)
