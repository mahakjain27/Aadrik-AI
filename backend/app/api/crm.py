from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.database import queries
from app.database.connection import get_conn, write_lock
from app.middleware.auth import require_roles
from app.schemas.lead import AssignLeadRequest
from app.services.activity_log import log_activity
from app.services.lead_scoring import CLOSED_STATUSES, annotate_leads

router = APIRouter(prefix="/crm", tags=["CRM"])


@router.get("/leads")
def get_leads(
    year: int | None = None,
    include_archived: bool = False,
    current_user=Depends(require_roles("admin", "sales", "manager")),
):
    conn = get_conn()

    clauses = []
    params: list = []

    if not include_archived:
        clauses.append("quotations.is_archived = 0")

    if year is not None:
        clauses.append("STRFTIME('%Y', quotations.created_at) = ?")
        params.append(str(year))

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    rows = conn.execute(
        f"""
        SELECT
            quotations.*,
            creator.name AS created_by_name,
            closer.name AS closed_by_name,
            assignee.name AS assigned_to_name,
            approver.name AS approved_by_name
        FROM quotations
        LEFT JOIN users AS creator ON creator.id = quotations.created_by
        LEFT JOIN users AS closer ON closer.id = quotations.closed_by
        LEFT JOIN users AS assignee ON assignee.id = quotations.assigned_to
        LEFT JOIN users AS approver ON approver.id = quotations.approved_by
        {where}
        ORDER BY quotations.created_at DESC
        """,
        params,
    ).fetchall()

    items_map = queries.get_quotation_items_map(conn, [row["id"] for row in rows])

    leads = [
        {**dict(row), "items": [dict(i) for i in items_map.get(row["id"], [])]}
        for row in rows
    ]

    return annotate_leads(leads)


@router.get("/assignees")
def get_assignees(
    current_user=Depends(require_roles("admin", "sales", "manager")),
):
    conn = get_conn()

    rows = conn.execute(
        """
        SELECT id, name, role
        FROM users
        WHERE is_active = 1 AND role IN ('admin', 'sales', 'manager')
        ORDER BY name
        """
    ).fetchall()

    return [dict(row) for row in rows]


@router.put("/leads/{lead_id}")
def update_lead_status(
    lead_id: int,
    status: str,
    current_user=Depends(require_roles("admin", "sales", "manager")),
):
    conn = get_conn()

    lead = conn.execute(
        "SELECT company_name, status, approval_status FROM quotations WHERE id = ?",
        (lead_id,),
    ).fetchone()

    if lead is None:
        raise HTTPException(
            status_code=404,
            detail="Lead not found.",
        )

    if status in CLOSED_STATUSES:
        closed_by = current_user["id"]
        closed_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    else:
        closed_by = None
        closed_at = None

    # A lead can only be Won on the back of either an approved quotation or
    # a confirmed no-quotation-needed order - "Won" + "Pending Approval" (or
    # "Draft"/"Rejected") is a contradiction, so reaching Won any other way
    # (e.g. the manual status dropdown) implicitly means no quotation was
    # ever required.
    approval_update = ""
    params: list = [status, closed_by, closed_at]

    if status == "Won" and lead["approval_status"] not in ("Approved", "Not Required"):
        approval_update = ", approval_status = 'Not Required'"

    with write_lock:
        conn.execute(
            f"""
            UPDATE quotations
            SET status = ?, closed_by = ?, closed_at = ?{approval_update}
            WHERE id = ?
            """,
            (*params, lead_id),
        )

        conn.commit()

    if lead["status"] != status:
        log_activity(
            actor_id=current_user["id"],
            action="lead.status_changed",
            entity_type="quotation",
            entity_id=lead_id,
            message=(
                f"{current_user['name']} moved {lead['company_name']}'s "
                f"lead from {lead['status']} to {status}."
            ),
        )

    return {
        "success": True,
        "message": "Status updated.",
    }


@router.put("/leads/{lead_id}/assign")
def assign_lead(
    lead_id: int,
    request: AssignLeadRequest,
    current_user=Depends(require_roles("admin", "manager")),
):
    conn = get_conn()

    lead = conn.execute(
        "SELECT company_name FROM quotations WHERE id = ?",
        (lead_id,),
    ).fetchone()

    if lead is None:
        raise HTTPException(
            status_code=404,
            detail="Lead not found.",
        )

    assignee_name = "Unassigned"

    if request.assigned_to is not None:
        assignee = conn.execute(
            "SELECT name FROM users WHERE id = ? AND is_active = 1",
            (request.assigned_to,),
        ).fetchone()

        if assignee is None:
            raise HTTPException(
                status_code=400,
                detail="Assignee must be an active user.",
            )

        assignee_name = assignee["name"]

    with write_lock:
        conn.execute(
            "UPDATE quotations SET assigned_to = ? WHERE id = ?",
            (request.assigned_to, lead_id),
        )

        conn.commit()

    log_activity(
        actor_id=current_user["id"],
        action="lead.assigned",
        entity_type="quotation",
        entity_id=lead_id,
        message=(
            f"{current_user['name']} assigned {lead['company_name']}'s "
            f"lead to {assignee_name}."
        ),
    )

    return {
        "success": True,
        "message": "Lead assigned.",
    }