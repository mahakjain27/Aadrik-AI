import json
import uuid

from fastapi import HTTPException, status

from app.core.logging import setup_logger
from app.database import queries
from app.schemas.session import SessionMessage, SessionMessagesResponse, SessionSummary
from app.services.activity_log import log_activity

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
        channel=row["channel"],
        status=row["status"],
        customer_phone=row["customer_phone"],
        assigned_to=row["assigned_to"],
    )
    for row in rows
]


def get_session_messages(
    session_id: str,
    user_id: str,
    *,
    bypass_ownership: bool = False,
) -> SessionMessagesResponse:
    logger.info(f"Loading session: {session_id}")

    session = (
        queries.get_session_by_id(session_id)
        if bypass_ownership
        else queries.get_session(session_id, user_id)
    )

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
            created_at=row["created_at"],
        )
        for row in rows
    ]

    if bypass_ownership:
        queries.mark_session_read(session_id, int(user_id))

    return SessionMessagesResponse(
        session_id=session_id,
        title=session["title"],
        channel=session["channel"],
        status=session["status"],
        customer_phone=session["customer_phone"],
        assigned_to=session["assigned_to"],
        assigned_to_name=session["assigned_to_name"] if bypass_ownership else None,
        created_at=session["created_at"],
        updated_at=session["updated_at"],
        is_archived=bool(session["is_archived"]),
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


def resolve_whatsapp_session(phone: str, first_message: str) -> str:
    """Returns a valid session_id for an inbound WhatsApp message from
    `phone`, reusing the customer's existing open conversation if there is
    one, else starting a new one. There's no logged-in internal user_id for
    an external WhatsApp customer, so the phone number doubles as user_id -
    sessions.user_id has no FK constraint, it's just an identity key."""

    existing = queries.get_active_session_by_phone(phone, "whatsapp")

    if existing is not None:
        logger.info(f"Using existing WhatsApp session: {existing['id']}")
        return existing["id"]

    new_session_id = str(uuid.uuid4())

    queries.create_session(
        new_session_id,
        phone,
        make_title(first_message),
        customer_phone=phone,
        channel="whatsapp",
    )

    logger.info(f"Created new WhatsApp session: {new_session_id}")

    return new_session_id


def resolve_website_session(visitor_id: str, first_message: str) -> str:
    """Returns a valid session_id for a message from the public website's AI
    Assistant page, reusing the visitor's existing open conversation if
    there is one, else starting a new one. Mirrors resolve_whatsapp_session:
    there's no logged-in internal user_id for an anonymous visitor, so the
    client-generated visitor_id (persisted in their browser) doubles as
    both user_id and customer_phone - neither column has a real FK/format
    constraint, they're just identity keys."""

    existing = queries.get_active_session_by_phone(visitor_id, "website")

    if existing is not None:
        logger.info(f"Using existing website session: {existing['id']}")
        return existing["id"]

    new_session_id = str(uuid.uuid4())

    queries.create_session(
        new_session_id,
        visitor_id,
        make_title(first_message),
        customer_phone=visitor_id,
        channel="website",
    )

    logger.info(f"Created new website session: {new_session_id}")

    return new_session_id


def create_contact_session(
    name: str,
    phone: str,
    company: str | None,
    requirement: str | None,
    message: str | None,
) -> str:
    """Creates a new Sales Inbox session from a public contact-form
    submission. Always a fresh session, unlike resolve_website_session -
    a contact form isn't an ongoing back-and-forth like chat/WhatsApp, just
    a one-off inquiry that needs a human to see it, so it's dropped straight
    into 'Waiting for Sales' rather than routed through the AI first."""

    lines = [f"New contact form submission from {name}."]

    if company:
        lines.append(f"Company: {company}")

    lines.append(f"Phone: {phone}")

    if requirement:
        lines.append(f"Requirement: {requirement}")

    if message:
        lines.append(f"Message: {message}")

    new_session_id = str(uuid.uuid4())

    queries.create_session(
        new_session_id,
        phone,
        make_title(f"Contact form: {name}"),
        customer_phone=phone,
        channel="website",
        status="Waiting for Sales",
    )

    queries.insert_message(new_session_id, "user", "\n".join(lines))

    logger.info(f"Created new contact-form session: {new_session_id}")

    return new_session_id


def _row_to_summary(row) -> SessionSummary:
    return SessionSummary(
        id=row["id"],
        title=row["title"],
        updated_at=row["updated_at"],
        channel=row["channel"],
        status=row["status"],
        customer_phone=row["customer_phone"],
        assigned_to=row["assigned_to"],
        assigned_to_name=row["assigned_to_name"],
        unread=bool(row["unread"]),
        is_archived=bool(row["is_archived"]),
    )


def list_waiting_sessions(viewer_id: int):
    rows = queries.list_waiting_sessions(viewer_id)
    return [_row_to_summary(row) for row in rows]


def list_archived_sessions(viewer_id: int):
    rows = queries.list_archived_sessions(viewer_id)
    return [_row_to_summary(row) for row in rows]


INBOX_STATUSES = ("Waiting for Sales", "AI Handling", "Open", "Closed")


def list_sessions_by_status(status_filter: str, viewer_id: int, search: str | None = None):
    if search:
        rows = queries.search_sessions(search, viewer_id)
    else:
        if status_filter not in INBOX_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"status must be one of {list(INBOX_STATUSES)}.",
            )

        rows = queries.list_sessions_by_status(status_filter, viewer_id)

    return [_row_to_summary(row) for row in rows]


def list_assigned_unread_sessions(user_id: int):
    rows = queries.list_assigned_unread_sessions(user_id)
    return [_row_to_summary(row) for row in rows]


def sales_reply(session_id: str, message: str) -> None:
    session = queries.get_session_by_id(session_id)

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    queries.insert_sales_reply(session_id, message)

    if session["status"] in ("Waiting for Sales", "AI Handling"):
        queries.update_session_status(session_id, "Open")


def close_session(session_id: str) -> None:
    if queries.get_session_by_id(session_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    queries.update_session_status(session_id, "Closed")


def reopen_session(session_id: str) -> None:
    if queries.get_session_by_id(session_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    queries.update_session_status(session_id, "Open")


def archive_session(session_id: str) -> None:
    if queries.get_session_by_id(session_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    queries.set_session_archived(session_id, True)


def unarchive_session(session_id: str) -> None:
    if queries.get_session_by_id(session_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    queries.set_session_archived(session_id, False)


def delete_session(session_id: str) -> None:
    if queries.delete_session(session_id) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )


def delete_closed_sessions() -> int:
    return queries.delete_closed_sessions()


def mark_session_read(session_id: str, user_id: int) -> None:
    if queries.get_session_by_id(session_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    queries.mark_session_read(session_id, user_id)


def assign_session_to(session_id: str, assigned_to: int | None, actor) -> None:
    session = queries.get_session_by_id(session_id)

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    assignee_name = "Unassigned"

    if assigned_to is not None:
        assignee = queries.get_user_by_id(assigned_to)

        if assignee is None or not assignee["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee must be an active user.",
            )

        assignee_name = assignee["name"]

    queries.assign_session(session_id, assigned_to)

    log_activity(
        actor_id=actor["id"],
        action="session.assigned",
        entity_type="session",
        message=(
            f"{actor['name']} assigned {session['title']!r} to {assignee_name}."
        ),
    )
