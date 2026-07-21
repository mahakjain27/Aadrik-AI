from pydantic import BaseModel, Field


class PublicContactRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    phone: str = Field(..., min_length=1, max_length=30)
    company: str | None = None
    requirement: str | None = None
    message: str | None = None


class PublicContactResponse(BaseModel):
    success: bool
    message: str
