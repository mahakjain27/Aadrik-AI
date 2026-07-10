import json
import uuid

from fastapi import HTTPException, status

from app.core.logging import setup_logger
from app.database import queries
from app.schemas.session import SessionMessage, SessionMessagesResponse, SessionSummary

logger = setup_logger(__name__)


def make_title(first_message: str, limit: int = 40) -> str:
    text = " ".join(first_message.strip().split())

    if len(text) <= limit:
        return text

    truncated = text[:limit]
    last_space = truncated.rfind(" ")

    if last_space > 0:
        truncated = truncated[:last_space]

    return truncated.rstrip(",.;:") + "..."


def list_sessions_for_user(user_id: str) -> list[SessionSummary]:
    logger.info(f"Fetching sessions for user: {user_id}")

    rows = queries.list_sessions(user_id)

    logger.info(f"Found {len(rows)} sessions for user: {user_id}")

    return [
        SessionSummary(
            id=row["id"],
            title=row["title"],
            updated_at=row["updated_at"],
        )
        for row in rows
    ]


def get_session_messages(session_id: str, user_id: str) -> SessionMessagesResponse:
    logger.info(f"Loading session: {session_id}")

    session = queries.get_session(session_id, user_id)

    if session is None:
        logger.warning(
            f"Session not found | session_id={session_id} | user_id={user_id}"
        )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    rows = queries.list_messages(session_id)

    logger.info(f"Loaded {len(rows)} messages from session {session_id}")

    messages = [
        SessionMessage(
            role=row["role"],
            content=row["content"],
            sources=json.loads(row["sources"]) if row["sources"] else [],
        )
        for row in rows
    ]

    return SessionMessagesResponse(
        session_id=session_id,
        title=session["title"],
        messages=messages,
    )


def resolve_session(
    session_id: str | None,
    user_id: str,
    first_message: str,
) -> str:
    """Returns a valid session_id owned by user_id,
    creating a new one if needed."""

    if session_id is not None and queries.get_session(session_id, user_id) is not None:
        logger.info(f"Using existing session: {session_id}")
        return session_id

    new_session_id = str(uuid.uuid4())

    queries.create_session(
        new_session_id,
        user_id,
        make_title(first_message),
    )

    logger.info(f"Created new session: {new_session_id}")

    return new_session_id
