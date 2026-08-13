import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.logging import setup_logger
from app.database import queries
from app.schemas.session import SessionMessage, SessionMessagesResponse, SessionSummary
from app.services.activity_log import log_activity
from app.services.whatsapp_service import (
    send_whatsapp_document,
    send_whatsapp_message,
    send_whatsapp_template,
    upload_whatsapp_media,
)
from app.utils.phone import normalize_indian_phone

logger = setup_logger(__name__)

# Meta's business-initiated-message window: a freeform reply is only
# allowed within 24h of the customer's last message; outside that, a
# pre-approved template is required instead.
WHATSAPP_WINDOW_HOURS = 24


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
        customer_name=session["customer_name"] if bypass_ownership else None,
        company_name=session["company_name"] if bypass_ownership else None,
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


def resolve_whatsapp_session(
    phone: str, first_message: str, customer_name: str | None = None
) -> str:
    """Returns a valid session_id for an inbound WhatsApp message from
    `phone`, reusing the customer's existing open conversation if there is
    one, else starting a new one. There's no logged-in internal user_id for
    an external WhatsApp customer, so the phone number doubles as user_id -
    sessions.user_id has no FK constraint, it's just an identity key.

    customer_name is the customer's own WhatsApp profile name, sent by Meta
    alongside every inbound message - it's the best name Sales Inbox can
    show when no CRM record exists yet for this phone number."""

    existing = queries.get_active_session_by_phone(phone, "whatsapp")

    if existing is not None:
        if customer_name:
            queries.update_session_customer_name_if_missing(existing["id"], customer_name)

        logger.info(f"Using existing WhatsApp session: {existing['id']}")
        return existing["id"]

    new_session_id = str(uuid.uuid4())

    queries.create_session(
        new_session_id,
        phone,
        make_title(first_message),
        customer_phone=phone,
        channel="whatsapp",
        customer_name=customer_name,
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
        customer_name=name,
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
        customer_name=row["customer_name"],
        company_name=row["company_name"],
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

    # insert_sales_reply above only saves the reply for the Sales Inbox UI -
    # for a real WhatsApp conversation it still has to be pushed to the
    # customer's phone via the Cloud API, or they never actually see it.
    if session["channel"] == "whatsapp" and session["customer_phone"]:
        wamid = send_whatsapp_message(session["customer_phone"], message)

        if wamid is None:
            logger.warning(
                f"Sales reply saved but WhatsApp delivery failed | session={session_id}"
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Reply saved, but WhatsApp delivery failed - the customer may not have received it.",
            )


def _is_window_open(last_customer_message_at: str | None) -> bool:
    if not last_customer_message_at:
        return False

    # created_at is stored as e.g. "2026-08-05T06:59:33.123Z".
    last = datetime.fromisoformat(last_customer_message_at.replace("Z", "+00:00"))

    return datetime.now(timezone.utc) - last < timedelta(hours=WHATSAPP_WINDOW_HOURS)


def check_whatsapp_number(phone: str) -> dict:
    """For Sales Inbox's '+ New Conversation': looks up any existing
    WhatsApp session for `phone` and reports whether Meta's 24h
    customer-service window is still open, so the frontend knows whether to
    show a normal reply box or the approved-template flow. Read-only - no
    session is created here, only when a message actually gets sent (see
    send_whatsapp_outreach), so cancelling out of the dialog doesn't leave
    an empty session behind."""

    normalized = normalize_indian_phone(phone)
    session = queries.get_active_session_by_phone(normalized, "whatsapp")

    if session is None:
        return {
            "session_id": None,
            "customer_phone": normalized,
            "window_open": False,
            "is_new": True,
        }

    last_customer_at = queries.get_last_customer_message_at(session["id"])

    return {
        "session_id": session["id"],
        "customer_phone": normalized,
        "window_open": _is_window_open(last_customer_at),
        "is_new": False,
    }


def send_whatsapp_outreach(phone: str, current_user) -> dict:
    """Business-initiates a WhatsApp conversation with `phone` using the
    approved sales-outreach template (see settings.whatsapp_sales_template_name) -
    used both for a brand-new number and for an existing customer whose 24h
    window has closed. Creates the session on first use if one doesn't
    already exist."""

    normalized = normalize_indian_phone(phone)
    session = queries.get_active_session_by_phone(normalized, "whatsapp")

    if session is None:
        session_id = str(uuid.uuid4())
        queries.create_session(
            session_id,
            normalized,
            f"New conversation ({normalized})",
            customer_phone=normalized,
            channel="whatsapp",
            status="Open",
        )
    else:
        session_id = session["id"]

    wamid = send_whatsapp_template(
        normalized,
        settings.whatsapp_sales_template_name,
        settings.whatsapp_sales_template_lang,
    )

    if wamid is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Could not send the WhatsApp template - check it's approved in "
                "Meta Business Manager and WHATSAPP_SALES_TEMPLATE_NAME matches it."
            ),
        )

    queries.insert_message(
        session_id,
        "sales",
        f"[Sent WhatsApp template: {settings.whatsapp_sales_template_name}]",
    )

    if session is not None and session["status"] in ("Waiting for Sales", "AI Handling", "Closed"):
        queries.update_session_status(session_id, "Open")

    log_activity(
        actor_id=current_user["id"],
        action="session.outreach_sent",
        entity_type="session",
        message=f"{current_user['name']} started a WhatsApp conversation with {normalized}.",
    )

    return {"session_id": session_id}


# Kept to what WhatsApp reliably previews as a document/image and what an
# invoice realistically is - not the full set Meta's Media API accepts.
ALLOWED_ATTACHMENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024


def send_sales_attachment(
    session_id: str,
    current_user,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    caption: str | None = None,
) -> None:
    """Sends a file (e.g. an invoice) as a WhatsApp document message on an
    existing conversation. Same 24h customer-service window rule as any
    other business-initiated message applies - there's no way around it for
    an attachment, so this only ever gets called on a session that's
    already open (see NewConversationModal's window_open branch, or the
    main Sales Inbox reply box)."""

    if content_type not in ALLOWED_ATTACHMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, JPG, or PNG files are supported.",
        )

    if len(file_bytes) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is too large (max 20MB).",
        )

    session = queries.get_session_by_id(session_id)

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    if session["channel"] != "whatsapp" or not session["customer_phone"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attachments can only be sent on a WhatsApp conversation.",
        )

    media_id = upload_whatsapp_media(file_bytes, filename, content_type)

    if media_id is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not upload the attachment to WhatsApp.",
        )

    wamid = send_whatsapp_document(session["customer_phone"], media_id, filename, caption or "")

    if wamid is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Could not send the attachment - the customer's 24h conversation "
                "window may be closed."
            ),
        )

    queries.insert_message(
        session_id, "sales", f"📎 {filename}" + (f"\n{caption}" if caption else "")
    )

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
