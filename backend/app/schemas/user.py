from typing import Literal

from pydantic import BaseModel, EmailStr

Role = Literal["admin", "sales", "manager", "viewer"]


class CreateUserRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role


class UpdateUserRequest(BaseModel):
    name: str
    role: Role


class UpdateUserStatusRequest(BaseModel):
    is_active: bool


class ResetPasswordRequest(BaseModel):
    password: str


class UpdateProfileRequest(BaseModel):
    name: str
    email: EmailStr


class ChangeOwnPasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    last_login_at: str | None = None
