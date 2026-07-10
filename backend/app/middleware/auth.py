from fastapi import Header, HTTPException, status

from app.core.config import settings


def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """
    Simple shared-secret auth. The frontend (or any client) must send:
        x-api-key: <AADRIK_API_KEY>

    If AADRIK_API_KEY is unset in .env, auth is skipped entirely and a
    warning is printed at startup (see app/core/config.py) - this is
    intentional so local dev isn't blocked, but it means: never deploy
    without setting AADRIK_API_KEY.
    """
    if not settings.api_key:
        return

    if x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )


def get_user_id(x_user_id: str | None = Header(default=None)) -> str:
    """
    Every browser generates its own id (see frontend/src/utils/userId.js) and
    sends it as:
        x-user-id: <uuid>

    Unlike verify_api_key, this is never optional - without it there is no
    way to scope chat sessions to a browser, and silently falling back to a
    shared id would merge every headerless caller's history together.
    """
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing x-user-id header.",
        )

    return x_user_id
