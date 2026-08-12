from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.core.rate_limit import is_rate_limited, record_attempt
from app.database import queries
from app.database.connection import get_conn, write_lock
from app.middleware.auth import get_current_user, require_roles
from app.models.quotation import (
    QuotationPricingRequest,
    QuotationRejectRequest,
    QuotationRequest,
    QuotationResponse,
)
from app.services.activity_log import log_activity
from app.services.lead_scoring import _parse_quantity
from app.services.quotation_email import send_quotation_email
from app.services.quotation_pdf import generate_quotation_pdf
from app.services.quotation_whatsapp import send_quotation_whatsapp

APPROVAL_ROLES = ("admin", "sales", "manager")

PUBLIC_SUBMIT_MAX_ATTEMPTS = 5
PUBLIC_SUBMIT_WINDOW_SECONDS = 3600


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _get_quotation_or_404(conn, quotation_id: int):
    lead = conn.execute(
        "SELECT * FROM quotations WHERE id = ?",
        (quotation_id,),
    ).fetchone()

    if lead is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")

    return lead


def _insert_quotation(
    request: QuotationRequest,
    created_by: int | None,
    source: str,
) -> int:
    conn = get_conn()

    customer_id = queries.get_or_create_customer(
        phone=request.phone,
        company_name=request.company_name,
        contact_person=request.contact_person,
        email=request.email,
        gst_number=request.gst_number,
        city=request.delivery_city,
    )

    with write_lock:
        cursor = conn.execute(
            """
            INSERT INTO quotations
            (
                company_name,
                contact_person,
                phone,
                email,
                product_name,
                brand,
                size,
                quantity,
                delivery_city,
                pincode,
                gst_number,
                notes,
                created_by,
                source,
                customer_id
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request.company_name,
                request.contact_person,
                request.phone,
                request.email,
                request.product_name,
                request.brand,
                request.size,
                request.quantity,
                request.delivery_city,
                request.pincode,
                request.gst_number,
                request.notes,
                created_by,
                source,
                customer_id,
            ),
        )

        conn.commit()

    return cursor.lastrowid


router = APIRouter(
    prefix="/quotation",
    tags=["Quotation"],
)


# -------------------------------
# Create Quotation
# -------------------------------
@router.post("/", response_model=QuotationResponse)
def create_quotation(
    request: QuotationRequest,
    current_user=Depends(get_current_user),
):
    quotation_id = _insert_quotation(request, current_user["id"], "manual")

    log_activity(
        actor_id=current_user["id"],
        action="lead.created",
        entity_type="quotation",
        entity_id=quotation_id,
        message=f"{current_user['name']} created a lead for {request.company_name}.",
    )

    return QuotationResponse(
        success=True,
        quotation_id=quotation_id,
        message="Quotation request submitted successfully.",
    )


# -------------------------------
# Create Quotation (Public - no auth, used by the WhatsApp quote-request
# page, which anonymous customers reach via a link)
# -------------------------------
@router.post("/public", response_model=QuotationResponse)
def create_quotation_public(request: QuotationRequest):
    rate_key = f"public_quote:{request.phone}"

    if is_rate_limited(rate_key, PUBLIC_SUBMIT_MAX_ATTEMPTS, PUBLIC_SUBMIT_WINDOW_SECONDS):
        raise HTTPException(
            status_code=429,
            detail="Too many quotation requests from this number. Please try again later.",
        )

    record_attempt(rate_key)

    quotation_id = _insert_quotation(request, None, "whatsapp")

    log_activity(
        actor_id=None,
        action="lead.created",
        entity_type="quotation",
        entity_id=quotation_id,
        message=f"WhatsApp customer submitted a quotation request for {request.company_name}.",
    )

    return QuotationResponse(
        success=True,
        quotation_id=quotation_id,
        message="Quotation request submitted successfully.",
    )


# -------------------------------
# Download PDF
# -------------------------------
@router.get("/{quotation_id}/pdf")
def download_pdf(
    quotation_id: int,
    current_user=Depends(require_roles(*APPROVAL_ROLES)),
):
    conn = get_conn()
    lead = _get_quotation_or_404(conn, quotation_id)

    pdf = generate_quotation_pdf(lead)

    quote_no = f"AD-{lead['created_at'][:4]}-{str(lead['id']).zfill(4)}"

    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{quote_no}.pdf"'
        },
    )


# -------------------------------
# Set Pricing
# -------------------------------
@router.put("/{quotation_id}/pricing")
def set_pricing(
    quotation_id: int,
    body: QuotationPricingRequest,
    current_user=Depends(require_roles(*APPROVAL_ROLES)),
):
    conn = get_conn()
    lead = _get_quotation_or_404(conn, quotation_id)

    quantity_number = _parse_quantity(lead["quantity"])

    if not quantity_number:
        raise HTTPException(
            status_code=400,
            detail="Cannot compute pricing: this quotation's quantity has no numeric value.",
        )

    original_subtotal = round(body.unit_price * quantity_number, 2)
    discount_amount = round(original_subtotal * body.discount_percent / 100, 2)
    subtotal = round(original_subtotal - discount_amount, 2)
    gst_amount = round(subtotal * body.gst_percent / 100, 2)
    grand_total = round(subtotal + gst_amount, 2)

    with write_lock:
        conn.execute(
            """
            UPDATE quotations
            SET unit_price = ?, gst_percent = ?, discount_percent = ?, subtotal = ?
            WHERE id = ?
            """,
            (
                body.unit_price,
                body.gst_percent,
                body.discount_percent,
                subtotal,
                quotation_id,
            ),
        )
        conn.commit()

    return {
        "success": True,
        "unit_price": body.unit_price,
        "gst_percent": body.gst_percent,
        "discount_percent": body.discount_percent,
        "original_subtotal": original_subtotal,
        "discount_amount": discount_amount,
        "subtotal": subtotal,
        "gst_amount": gst_amount,
        "grand_total": grand_total,
    }


# -------------------------------
# Submit for Approval
# -------------------------------
@router.post("/{quotation_id}/submit-for-approval")
def submit_for_approval(
    quotation_id: int,
    current_user=Depends(require_roles(*APPROVAL_ROLES)),
):
    conn = get_conn()
    lead = _get_quotation_or_404(conn, quotation_id)

    if lead["unit_price"] is None or lead["subtotal"] is None:
        raise HTTPException(
            status_code=400,
            detail="Set pricing before submitting this quotation for approval.",
        )

    with write_lock:
        conn.execute(
            "UPDATE quotations SET approval_status = 'Pending Approval' WHERE id = ?",
            (quotation_id,),
        )
        conn.commit()

    log_activity(
        actor_id=current_user["id"],
        action="quotation.submitted",
        entity_type="quotation",
        entity_id=quotation_id,
        message=f"{current_user['name']} submitted the quotation for {lead['company_name']} for approval.",
    )

    return {"success": True, "approval_status": "Pending Approval"}


# -------------------------------
# Approve
# -------------------------------
@router.post("/{quotation_id}/approve")
def approve_quotation(
    quotation_id: int,
    current_user=Depends(require_roles("admin", "manager")),
):
    conn = get_conn()
    lead = _get_quotation_or_404(conn, quotation_id)

    if lead["approval_status"] != "Pending Approval":
        raise HTTPException(
            status_code=400,
            detail="Only quotations pending approval can be approved.",
        )

    with write_lock:
        conn.execute(
            """
            UPDATE quotations
            SET approval_status = 'Approved',
                approved_by = ?,
                approved_at = ?,
                rejection_reason = NULL
            WHERE id = ?
            """,
            (current_user["id"], _now(), quotation_id),
        )
        conn.commit()

    log_activity(
        actor_id=current_user["id"],
        action="quotation.approved",
        entity_type="quotation",
        entity_id=quotation_id,
        message=f"{current_user['name']} approved the quotation for {lead['company_name']}.",
    )

    return {"success": True, "approval_status": "Approved"}


# -------------------------------
# Reject
# -------------------------------
@router.post("/{quotation_id}/reject")
def reject_quotation(
    quotation_id: int,
    body: QuotationRejectRequest,
    current_user=Depends(require_roles("admin", "manager")),
):
    conn = get_conn()
    lead = _get_quotation_or_404(conn, quotation_id)

    if lead["approval_status"] != "Pending Approval":
        raise HTTPException(
            status_code=400,
            detail="Only quotations pending approval can be rejected.",
        )

    with write_lock:
        conn.execute(
            """
            UPDATE quotations
            SET approval_status = 'Rejected', rejection_reason = ?
            WHERE id = ?
            """,
            (body.reason, quotation_id),
        )
        conn.commit()

    log_activity(
        actor_id=current_user["id"],
        action="quotation.rejected",
        entity_type="quotation",
        entity_id=quotation_id,
        message=(
            f"{current_user['name']} rejected the quotation for "
            f"{lead['company_name']}: {body.reason}"
        ),
    )

    return {"success": True, "approval_status": "Rejected"}


# -------------------------------
# Send
# -------------------------------
@router.post("/{quotation_id}/send")
def send_quotation(
    quotation_id: int,
    current_user=Depends(require_roles(*APPROVAL_ROLES)),
):
    conn = get_conn()
    lead = _get_quotation_or_404(conn, quotation_id)

    if lead["approval_status"] != "Approved":
        raise HTTPException(
            status_code=400,
            detail="Quotation must be approved before it can be sent.",
        )

    quote_no = f"AD-{lead['created_at'][:4]}-{str(lead['id']).zfill(4)}"
    pdf_bytes = generate_quotation_pdf(lead).getvalue()
    pdf_filename = f"{quote_no}.pdf"

    email_sent = (
        send_quotation_email(
            to_email=lead["email"],
            subject=f"Quotation {quote_no}",
            pdf_bytes=pdf_bytes,
            pdf_filename=pdf_filename,
        )
        if lead["email"]
        else False
    )

    # Only attempt WhatsApp if there's an existing conversation with this
    # phone - that's both how we know it's a real WhatsApp number and what
    # keeps us inside Meta's 24h freeform-reply window.
    whatsapp_session = queries.get_active_session_by_phone(lead["phone"], "whatsapp")
    whatsapp_wamid = None

    if whatsapp_session is not None:
        gst_rate = lead["gst_percent"] if lead["gst_percent"] is not None else 18.0
        subtotal = lead["subtotal"]
        grand_total = (
            round(subtotal * (1 + gst_rate / 100), 2) if subtotal is not None else None
        )

        whatsapp_wamid = send_quotation_whatsapp(
            phone=lead["phone"],
            pdf_bytes=pdf_bytes,
            pdf_filename=pdf_filename,
            quote_no=quote_no,
            contact_person=lead["contact_person"],
            grand_total=grand_total,
        )

        if whatsapp_wamid:
            queries.insert_message(
                whatsapp_session["id"],
                "assistant",
                f"Sent quotation {quote_no} (PDF attached).",
            )
            queries.touch_session(whatsapp_session["id"])

    whatsapp_sent = whatsapp_wamid is not None

    sent_via = ",".join(
        label for label, sent in (("email", email_sent), ("whatsapp", whatsapp_sent)) if sent
    )

    with write_lock:
        conn.execute(
            """
            UPDATE quotations
            SET sent_at = ?,
                status = 'Quotation Sent',
                sent_via = ?,
                whatsapp_wamid = ?,
                whatsapp_delivery_status = ?
            WHERE id = ?
            """,
            (
                _now(),
                sent_via or None,
                whatsapp_wamid,
                "sent" if whatsapp_sent else None,
                quotation_id,
            ),
        )
        conn.commit()

    delivered_via = [
        label for label, sent in (("email", email_sent), ("WhatsApp", whatsapp_sent)) if sent
    ]

    log_activity(
        actor_id=current_user["id"],
        action="quotation.sent",
        entity_type="quotation",
        entity_id=quotation_id,
        message=(
            f"{current_user['name']} sent the quotation for {lead['company_name']} via "
            f"{' and '.join(delivered_via)}."
            if delivered_via
            else f"{current_user['name']} marked the quotation for {lead['company_name']} as sent "
            "(no delivery channel was available - no email on file and no WhatsApp conversation)."
        ),
    )

    if delivered_via:
        message = f"Quotation sent via {' and '.join(delivered_via)}."
    else:
        message = (
            "Marked as sent, but nothing was actually delivered: no email on file, and no "
            "WhatsApp conversation to send the document into."
        )

    return {
        "success": True,
        "email_sent": email_sent,
        "whatsapp_sent": whatsapp_sent,
        "sent_via": sent_via or None,
        "whatsapp_delivery_status": "sent" if whatsapp_sent else None,
        "message": message,
    }


# -------------------------------
# Pending My Approval
# -------------------------------
@router.get("/pending-approval")
def list_pending_approval(
    current_user=Depends(require_roles("admin", "manager")),
):
    conn = get_conn()

    rows = conn.execute(
        """
        SELECT *
        FROM quotations
        WHERE approval_status = 'Pending Approval'
        ORDER BY created_at
        """
    ).fetchall()

    return [dict(row) for row in rows]


# -------------------------------
# Get All Quotations (Admin)
# -------------------------------
@router.get("/all")
def get_all_quotations(
    year: int | None = None,
    include_archived: bool = False,
    current_user=Depends(require_roles("admin", "sales", "manager")),
):
    conn = get_conn()

    clauses = []
    params: list = []

    if not include_archived:
        clauses.append("is_archived = 0")

    if year is not None:
        clauses.append("STRFTIME('%Y', created_at) = ?")
        params.append(str(year))

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    rows = conn.execute(
        f"""
        SELECT *
        FROM quotations
        {where}
        ORDER BY created_at DESC
        """,
        params,
    ).fetchall()

    return [dict(row) for row in rows]


# -------------------------------
# Update Status (Admin)
# -------------------------------
@router.put("/{quotation_id}/status")
def update_status(
    quotation_id: int,
    status: str,
    current_user=Depends(require_roles("admin", "sales", "manager")),
):
    conn = get_conn()

    with write_lock:
        cursor = conn.execute(
            """
            UPDATE quotations
            SET status = ?
            WHERE id = ?
            """,
            (
                status,
                quotation_id,
            ),
        )

        conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    return {
        "success": True,
        "message": "Status updated successfully.",
    }


# -------------------------------
# Delete Quotation (Admin)
# -------------------------------
@router.delete("/{quotation_id}")
def delete_quotation(
    quotation_id: int,
    current_user=Depends(require_roles("admin")),
):
    conn = get_conn()

    with write_lock:
        cursor = conn.execute(
            """
            DELETE FROM quotations
            WHERE id=?
            """,
            (quotation_id,),
        )

        conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    return {
        "success": True,
        "message": "Quotation deleted successfully.",
    }


# -------------------------------
# Archive / Unarchive Quotation
# -------------------------------
def _set_quotation_archived(quotation_id: int, archived: bool) -> dict:
    conn = get_conn()

    with write_lock:
        cursor = conn.execute(
            "UPDATE quotations SET is_archived = ? WHERE id = ?",
            (int(archived), quotation_id),
        )

        conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Quotation not found.")

    return {"success": True}


@router.post("/{quotation_id}/archive")
def archive_quotation(
    quotation_id: int,
    current_user=Depends(require_roles(*APPROVAL_ROLES)),
):
    return _set_quotation_archived(quotation_id, True)


@router.post("/{quotation_id}/unarchive")
def unarchive_quotation(
    quotation_id: int,
    current_user=Depends(require_roles(*APPROVAL_ROLES)),
):
    return _set_quotation_archived(quotation_id, False)

