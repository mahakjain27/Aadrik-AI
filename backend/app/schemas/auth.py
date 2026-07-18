from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    id: int
    role: str
    name: str
    email: str