from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.database.connection import get_conn, write_lock
from app.models.quotation import QuotationRequest, QuotationResponse
from app.services.quotation_pdf import generate_quotation_pdf

router = APIRouter(
    prefix="/quotation",
    tags=["Quotation"],
)


# -------------------------------
# Create Quotation
# -------------------------------
@router.post("/", response_model=QuotationResponse)
def create_quotation(request: QuotationRequest):
    conn = get_conn()

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
                gst_number
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            ),
        )

        conn.commit()

    return QuotationResponse(
        success=True,
        quotation_id=cursor.lastrowid,
        message="Quotation request submitted successfully.",
    )


@router.get("/{quotation_id}/pdf")
def download_pdf(quotation_id: int):
    conn = get_conn()

    lead = conn.execute(
        """
        SELECT *
        FROM quotations
        WHERE id=?
        """,
        (quotation_id,),
    ).fetchone()

    if not lead:
        return {"error": "Quotation not found"}

    pdf = generate_quotation_pdf(lead)

    quote_no = f"AD-{lead['created_at'][:4]}-" f"{str(lead['id']).zfill(4)}"

    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{quote_no}.pdf"'},
    )


# -------------------------------
# Get All Leads
# -------------------------------
@router.get("/all")
def get_all_quotations():
    conn = get_conn()

    rows = conn.execute("""
        SELECT *
        FROM quotations
        ORDER BY created_at DESC
        """).fetchall()

    return [dict(row) for row in rows]


# -------------------------------
# Update Lead Status
# -------------------------------
@router.put("/{quotation_id}/status")
def update_status(
    quotation_id: int,
    status: str,
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
            detail="Quotation not found",
        )

    return {
        "success": True,
        "message": "Status updated successfully.",
    }


@router.delete("/{quotation_id}")
def delete_quotation(quotation_id: int):
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
        raise HTTPException(status_code=404, detail="Quotation not found")

    return {"success": True, "message": "Quotation deleted successfully."}


@router.get("/customers")
def get_customers():
    conn = get_conn()

    rows = conn.execute("""
        SELECT
            company_name,
            contact_person,
            phone,
            delivery_city,
            COUNT(*) AS total_quotations,
            MAX(created_at) AS last_quotation
        FROM quotations
        GROUP BY company_name
        ORDER BY company_name
    """).fetchall()

    return [dict(r) for r in rows]
