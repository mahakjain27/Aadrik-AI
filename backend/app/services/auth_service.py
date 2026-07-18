from fastapi import HTTPException, status

from app.core.config import settings
from app.core.rate_limit import clear_attempts, is_rate_limited, record_attempt
from app.core.security import create_access_token, verify_password
from app.database import queries

LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCKOUT_SECONDS = 15 * 60


def login(email: str, password: str, remember: bool = False):
    rate_limit_key = f"login:{email.lower()}"

    if is_rate_limited(rate_limit_key, LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_SECONDS):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again in 15 minutes.",
        )

    user = queries.get_user_by_email(email)

    if user is None:
        record_attempt(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user["is_active"]:
        record_attempt(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    if not verify_password(password, user["password_hash"]):
        record_attempt(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    clear_attempts(rate_limit_key)
    queries.update_last_login(user["id"])

    token = create_access_token(
        {
            "sub": str(user["id"]),
            "email": user["email"],
            "role": user["role"],
        },
        expires_minutes=(
            settings.access_token_expire_minutes_remembered
            if remember
            else settings.access_token_expire_minutes
        ),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "id": user["id"],
        "role": user["role"],
        "name": user["name"],
        "email": user["email"],
    }