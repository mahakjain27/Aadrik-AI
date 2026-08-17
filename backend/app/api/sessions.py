from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.middleware.auth import get_current_user, require_roles
from app.schemas.session import (
    AssignSessionRequest,
    CheckWhatsAppNumberRequest,
    CheckWhatsAppNumberResponse,
    SalesReplyRequest,
    SendWhatsAppTemplateRequest,
    SendWhatsAppTemplateResponse,
    SessionAIAssist,
    SessionMessagesResponse,
    SessionSummary,
)
from app.services.ai_service import generate_session_assist
from app.services.session_service import (
    archive_session,
    assign_session_to,
    check_whatsapp_number,
    close_session,
    delete_closed_sessions,
    delete_session,
    get_session_messages,
    list_archived_sessions,
    list_assigned_unread_sessions,
    list_sessions_by_status,
    list_sessions_for_user,
    list_waiting_sessions,
    mark_session_read,
    reopen_session,
    sales_reply,
    send_sales_attachment,
    send_whatsapp_outreach,
    unarchive_session,
)

router = APIRouter()


@router.get(
    "/sessions",
    response_model=list[SessionSummary],
)
def get_sessions(
    current_user=Depends(get_current_user),
):
    return list_sessions_for_user(
        str(current_user["id"])
    )


@router.get(
    "/sessions/{session_id}/messages",
    response_model=SessionMessagesResponse,
)
def get_session_messages_route(
    session_id: str,
    current_user=Depends(get_current_user),
):
    return get_session_messages(
        session_id,
        str(current_user["id"]),
        bypass_ownership=current_user["role"] in ("admin", "manager", "sales"),
    )

@router.get(
    "/sessions/waiting",
    response_model=list[SessionSummary],
)
def waiting_sessions(
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    return list_waiting_sessions(current_user["id"])


@router.get(
    "/sessions/inbox",
    response_model=list[SessionSummary],
)
def inbox_sessions(
    status: str = "Waiting for Sales",
    search: str | None = None,
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    return list_sessions_by_status(status, current_user["id"], search=search)


@router.get(
    "/sessions/notifications",
    response_model=list[SessionSummary],
)
def session_notifications(
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    return list_assigned_unread_sessions(current_user["id"])


@router.get(
    "/sessions/archived",
    response_model=list[SessionSummary],
)
def archived_sessions(
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    return list_archived_sessions(current_user["id"])


@router.delete("/sessions/closed")
def delete_all_closed(
    current_user = Depends(require_roles("admin")),
):
    deleted = delete_closed_sessions()

    return {"deleted": deleted}


@router.put("/sessions/{session_id}/assign")
def assign(
    session_id: str,
    body: AssignSessionRequest,
    current_user = Depends(require_roles(
        "admin",
        "manager",
    )),
):
    assign_session_to(session_id, body.assigned_to, current_user)

    return {"success": True}


@router.post("/sessions/{session_id}/ai-assist", response_model=SessionAIAssist)
def ai_assist(
    session_id: str,
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    return generate_session_assist(session_id)


@router.post("/sessions/{session_id}/reply")
def reply(
    session_id: str,
    body: SalesReplyRequest,
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    sales_reply(session_id, body.message)

    return {"success": True}


@router.post("/sessions/{session_id}/reply-attachment")
async def reply_with_attachment(
    session_id: str,
    file: UploadFile = File(...),
    caption: str | None = Form(None),
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    contents = await file.read()

    send_sales_attachment(
        session_id,
        current_user,
        contents,
        file.filename,
        file.content_type,
        caption,
    )

    return {"success": True}


@router.post("/sessions/whatsapp/check", response_model=CheckWhatsAppNumberResponse)
def check_whatsapp_number_route(
    body: CheckWhatsAppNumberRequest,
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    return check_whatsapp_number(body.phone)


@router.post("/sessions/whatsapp/send-template", response_model=SendWhatsAppTemplateResponse)
def send_whatsapp_template_route(
    body: SendWhatsAppTemplateRequest,
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    return send_whatsapp_outreach(
        body.phone,
        current_user,
        body.template_type,
    )


@router.post("/sessions/{session_id}/close")
def close(
    session_id: str,
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    close_session(session_id)

    return {"success": True}


@router.post("/sessions/{session_id}/reopen")
def reopen(
    session_id: str,
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    reopen_session(session_id)

    return {"success": True}


@router.post("/sessions/{session_id}/mark-read")
def mark_read(
    session_id: str,
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    mark_session_read(session_id, current_user["id"])

    return {"success": True}


@router.post("/sessions/{session_id}/archive")
def archive(
    session_id: str,
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    archive_session(session_id)

    return {"success": True}


@router.post("/sessions/{session_id}/unarchive")
def unarchive(
    session_id: str,
    current_user = Depends(require_roles(
        "admin",
        "manager",
        "sales",
    )),
):
    unarchive_session(session_id)

    return {"success": True}


@router.delete("/sessions/{session_id}")
def delete(
    session_id: str,
    current_user = Depends(require_roles("admin")),
):
    delete_session(session_id)

    return {"success": True}