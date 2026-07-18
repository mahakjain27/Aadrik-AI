from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.middleware.auth import require_roles
from app.services.monthly_report import get_monthly_report_data
from app.services.monthly_report_pdf import generate_monthly_report_pdf

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/monthly")
def download_monthly_report(
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    current_user=Depends(require_roles("admin", "manager")),
):
    now = datetime.now(timezone.utc)
    year = year or now.year
    month = month or now.month

    data = get_monthly_report_data(year, month)
    pdf = generate_monthly_report_pdf(data)

    filename = f"Aadrik-Monthly-Report-{year:04d}-{month:02d}.pdf"

    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
