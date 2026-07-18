from dataclasses import dataclass
from datetime import datetime


@dataclass
class User:
    id: int | None
    name: str
    email: str
    password_hash: str
    role: str
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None