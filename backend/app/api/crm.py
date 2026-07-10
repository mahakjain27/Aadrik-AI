from fastapi import APIRouter, HTTPException

from app.database.connection import get_conn, write_lock

router = APIRouter(prefix="/crm", tags=["CRM"])


@router.get("/leads")
def get_leads():
    conn = get_conn()

    rows = conn.execute("""
        SELECT *
        FROM quotations
        ORDER BY created_at DESC
        """).fetchall()

    return [dict(row) for row in rows]


@router.put("/leads/{lead_id}")
def update_lead_status(lead_id: int, status: str):
    conn = get_conn()

    with write_lock:
        cursor = conn.execute(
            """
            UPDATE quotations
            SET status = ?
            WHERE id = ?
            """,
            (status, lead_id),
        )

        conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(404, "Lead not found")

    return {"success": True, "message": "Status updated."}
