import json
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
    QuotationSendRequest,
)
from app.services.activity_log import log_activity
from app.services.lead_scoring import _parse_quantity
from app.services.quotation_email import send_quotation_email
from app.services.quotation_pdf import generate_quotation_pdf
from app.services.quotation_pricing import aggregate_quotation_totals, compute_quotation_totals
from app.services.quotation_send import InvalidWhatsappSelection, resolve_whatsapp_destination
from app.services.quotation_whatsapp import send_quotation_whatsapp
from app.utils.phone import normalize_indian_phone

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


def _items_summary(request: QuotationRequest) -> str:
    first = request.items[0].product_name
    extra = len(request.items) - 1
    return f"{first} +{extra} more" if extra else first


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

    first = request.items[0]

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
                items_summary,
                delivery_city,
                pincode,
                gst_number,
                notes,
                created_by,
                source,
                source_whatsapp_phone,
                customer_id
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request.company_name,
                request.contact_person,
                request.phone,
                request.email,
                first.product_name,
                first.brand,
                first.size,
                first.quantity,
                _items_summary(request),
                request.delivery_city,
                request.pincode,
                request.gst_number,
                request.notes,
                created_by,
                source,
                request.source_whatsapp_phone,
                customer_id,
            ),
        )

        quotation_id = cursor.lastrowid

        for i, item in enumerate(request.items):
            conn.execute(
                """
                INSERT INTO quotation_items
                (quotation_id, product_name, brand, size, quantity, sort_order)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (quotation_id, item.product_name, item.brand, item.size, item.quantity, i),
            )

        conn.commit()

    return quotation_id


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
    items = queries.get_quotation_items(conn, quotation_id)

    pdf = generate_quotation_pdf(lead, items)

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
def _item_snapshot(row, totals: dict | None = None) -> dict:
    snap = {
        "item_id": row["id"],
        "product_name": row["product_name"],
        "unit_price": row["unit_price"],
        "gst_percent": row["gst_percent"],
        "discount_type": row["discount_type"],
        "discount_percent": row["discount_percent"],
        "discount_amount": row["discount_amount"],
        "special_discount_percent": row["special_discount_percent"],
        "special_discount_amount": row["special_discount_amount"],
        "subtotal": row["subtotal"],
        "grand_total": row["grand_total"],
    }
    if totals is not None:
        snap["subtotal"] = totals["subtotal"]
        snap["grand_total"] = totals["grand_total"]
    return snap


@router.put("/{quotation_id}/pricing")
def set_pricing(
    quotation_id: int,
    body: QuotationPricingRequest,
    current_user=Depends(require_roles(*APPROVAL_ROLES)),
):
    conn = get_conn()
    lead = _get_quotation_or_404(conn, quotation_id)
    existing_items = queries.get_quotation_items(conn, quotation_id)
    existing_by_id = {row["id"]: row for row in existing_items}

    if {i.item_id for i in body.items} != set(existing_by_id.keys()):
        raise HTTPException(
            status_code=400,
            detail="Pricing must be submitted for every product line on this quotation.",
        )

    item_totals = []
    for item_body in body.items:
        existing = existing_by_id[item_body.item_id]
        quantity_number = _parse_quantity(existing["quantity"])

        if not quantity_number:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot compute pricing for '{existing['product_name']}': "
                    "this line's quantity has no numeric value."
                ),
            )

        totals = compute_quotation_totals(
            unit_price=item_body.unit_price,
            quantity=quantity_number,
            gst_percent=item_body.gst_percent,
            discount_type=item_body.discount_type,
            discount_percent=item_body.discount_percent,
            discount_amount=item_body.discount_amount,
            special_discount_percent=item_body.special_discount_percent,
            special_discount_amount=item_body.special_discount_amount,
        )
        item_totals.append((item_body, existing, totals))

    agg = aggregate_quotation_totals([totals for _, _, totals in item_totals])

    # A quotation that's already been approved can still be re-priced (people
    # make mistakes), but the change is significant enough to leave a paper
    # trail - the frontend gates this behind a confirmation dialog, and we
    # record what changed here regardless of how the request got confirmed.
    was_approved = lead["approval_status"] == "Approved"
    old_items_snapshot = [_item_snapshot(row) for row in existing_items] if was_approved else None
    old_grand_total = lead["grand_total"] if was_approved else None

    with write_lock:
        for item_body, existing, totals in item_totals:
            conn.execute(
                """
                UPDATE quotation_items
                SET unit_price = ?,
                    gst_percent = ?,
                    discount_type = ?,
                    discount_percent = ?,
                    discount_amount = ?,
                    special_discount_percent = ?,
                    special_discount_amount = ?,
                    subtotal = ?,
                    grand_total = ?
                WHERE id = ?
                """,
                (
                    item_body.unit_price,
                    item_body.gst_percent,
                    item_body.discount_type,
                    item_body.discount_percent,
                    item_body.discount_amount,
                    item_body.special_discount_percent,
                    item_body.special_discount_amount,
                    totals["subtotal"],
                    totals["grand_total"],
                    item_body.item_id,
                ),
            )

        conn.execute(
            "UPDATE quotations SET subtotal = ?, grand_total = ? WHERE id = ?",
            (agg["subtotal"], agg["grand_total"], quotation_id),
        )

        if was_approved:
            new_items = queries.get_quotation_items(conn, quotation_id)
            conn.execute(
                """
                INSERT INTO quotation_price_history
                (quotation_id, old_items_json, new_items_json, old_grand_total,
                 new_grand_total, changed_by)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    quotation_id,
                    json.dumps(old_items_snapshot),
                    json.dumps([_item_snapshot(row) for row in new_items]),
                    old_grand_total,
                    agg["grand_total"],
                    current_user["id"],
                ),
            )

        conn.commit()

    if was_approved:
        log_activity(
            actor_id=current_user["id"],
            action="quotation.price_changed",
            entity_type="quotation",
            entity_id=quotation_id,
            message=(
                f"{current_user['name']} changed pricing on the already-approved "
                f"quotation for {lead['company_name']} "
                f"(grand total {old_grand_total} -> {agg['grand_total']})."
            ),
        )

    return {
        "success": True,
        "items": [
            {"item_id": item_body.item_id, **totals} for item_body, _, totals in item_totals
        ],
        "price_change_recorded": was_approved,
        **agg,
    }


# -------------------------------
# Price Change History
# -------------------------------
@router.get("/{quotation_id}/price-history")
def get_price_history(
    quotation_id: int,
    current_user=Depends(require_roles(*APPROVAL_ROLES)),
):
    conn = get_conn()
    _get_quotation_or_404(conn, quotation_id)

    rows = conn.execute(
        """
        SELECT
            quotation_price_history.*,
            users.name AS changed_by_name
        FROM quotation_price_history
        LEFT JOIN users ON users.id = quotation_price_history.changed_by
        WHERE quotation_id = ?
        ORDER BY changed_at DESC
        """,
        (quotation_id,),
    ).fetchall()

    return [dict(row) for row in rows]


# -------------------------------
# Confirm Order (no quotation needed)
# -------------------------------
@router.post("/{quotation_id}/confirm-order")
def confirm_order(
    quotation_id: int,
    current_user=Depends(require_roles(*APPROVAL_ROLES)),
):
    """For an existing customer who just wants to place an order with no
    quotation/approval step - called after the order-confirmation WhatsApp
    message has actually been sent (see WhatsAppMessageModal's
    orderConfirmation mode). Marks the lead Won without ever touching the
    Draft -> Pending Approval -> Approved pricing workflow."""

    conn = get_conn()
    lead = _get_quotation_or_404(conn, quotation_id)

    with write_lock:
        conn.execute(
            """
            UPDATE quotations
            SET status = 'Won',
                approval_status = 'Not Required',
                closed_by = ?,
                closed_at = ?
            WHERE id = ?
            """,
            (current_user["id"], _now(), quotation_id),
        )
        conn.commit()

    log_activity(
        actor_id=current_user["id"],
        action="quotation.order_confirmed",
        entity_type="quotation",
        entity_id=quotation_id,
        message=(
            f"{current_user['name']} confirmed the order for {lead['company_name']} "
            "without a quotation - marked Won."
        ),
    )

    return {"success": True, "status": "Won", "approval_status": "Not Required"}


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

    if lead["grand_total"] is None:
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
    body: QuotationSendRequest = QuotationSendRequest(),
    current_user=Depends(require_roles(*APPROVAL_ROLES)),
):
    conn = get_conn()
    lead = _get_quotation_or_404(conn, quotation_id)

    if lead["approval_status"] != "Approved":
        raise HTTPException(
            status_code=400,
            detail="Quotation must be approved before it can be sent.",
        )

    def _has_whatsapp_session(phone: str) -> bool:
        return queries.get_active_session_by_phone(phone, "whatsapp") is not None

    try:
        destination = resolve_whatsapp_destination(
            quotation_phone=lead["phone"],
            source_whatsapp_phone=lead["source_whatsapp_phone"],
            requested_phone=body.whatsapp_phone,
            has_session=_has_whatsapp_session,
        )
    except InvalidWhatsappSelection as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # The contact phone and the WhatsApp number that opened this
    # quotation's /quote link disagree, and more than one of them has a
    # live conversation to send into - don't guess, ask the salesperson
    # which one to use before touching anything (including email, so a
    # retry after the choice can't double-send it).
    if destination["selection_required"]:
        return {
            "success": False,
            "send_required": True,
            "number_mismatch": True,
            "quotation_phone": lead["phone"],
            "whatsapp_phone": lead["source_whatsapp_phone"],
            "available_destinations": destination["available_destinations"],
            "message": (
                "This quotation was requested through WhatsApp using a different number "
                "than the one entered in the form. Choose where to send it."
            ),
        }

    items = queries.get_quotation_items(conn, quotation_id)

    quote_no = f"AD-{lead['created_at'][:4]}-{str(lead['id']).zfill(4)}"
    pdf_bytes = generate_quotation_pdf(lead, items).getvalue()
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

    # Only attempt WhatsApp if there's an existing conversation with the
    # resolved destination - that's both how we know it's a real WhatsApp
    # number and what keeps us inside Meta's 24h freeform-reply window.
    target_phone = destination["target_phone"]
    whatsapp_session = (
        queries.get_active_session_by_phone(target_phone, "whatsapp") if target_phone else None
    )
    whatsapp_wamid = None

    if whatsapp_session is not None:
        whatsapp_wamid = send_quotation_whatsapp(
            phone=target_phone,
            pdf_bytes=pdf_bytes,
            pdf_filename=pdf_filename,
            quote_no=quote_no,
            contact_person=lead["contact_person"],
            grand_total=lead["grand_total"],
        )

        if whatsapp_wamid:
            queries.insert_message(
                whatsapp_session["id"],
                "assistant",
                f"Sent quotation {quote_no} (PDF attached).",
            )
            queries.touch_session(whatsapp_session["id"])

    whatsapp_sent = whatsapp_wamid is not None

    delivered_via = [
        label for label, sent in (("email", email_sent), ("WhatsApp", whatsapp_sent)) if sent
    ]

    # Nothing actually went out - don't claim the quotation was sent. The
    # frontend/CRM should be able to tell this apart from a real send.
    if not delivered_via:
        no_whatsapp_reason = (
            "No WhatsApp conversation is available for either phone number."
            if destination["number_mismatch"]
            else "no WhatsApp conversation to send the document into"
        )

        log_activity(
            actor_id=current_user["id"],
            action="quotation.send_failed",
            entity_type="quotation",
            entity_id=quotation_id,
            message=(
                f"{current_user['name']} tried to send the quotation for {lead['company_name']}, "
                f"but nothing was delivered - no email on file, and {no_whatsapp_reason}"
            ),
        )

        return {
            "success": False,
            "email_sent": False,
            "whatsapp_sent": False,
            "sent_via": None,
            "message": f"Nothing was delivered: no email on file, and {no_whatsapp_reason}",
        }

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

    log_activity(
        actor_id=current_user["id"],
        action="quotation.sent",
        entity_type="quotation",
        entity_id=quotation_id,
        message=(
            f"{current_user['name']} sent the quotation for {lead['company_name']} via "
            f"{' and '.join(delivered_via)}."
        ),
    )

    return {
        "success": True,
        "email_sent": email_sent,
        "whatsapp_sent": whatsapp_sent,
        "sent_via": sent_via or None,
        "whatsapp_delivery_status": "sent" if whatsapp_sent else None,
        "message": f"Quotation sent via {' and '.join(delivered_via)}.",
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

    items_map = queries.get_quotation_items_map(conn, [row["id"] for row in rows])

    return [
        {**dict(row), "items": [dict(i) for i in items_map.get(row["id"], [])]}
        for row in rows
    ]


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

    items_map = queries.get_quotation_items_map(conn, [row["id"] for row in rows])

    return [
        {**dict(row), "items": [dict(i) for i in items_map.get(row["id"], [])]}
        for row in rows
    ]


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

