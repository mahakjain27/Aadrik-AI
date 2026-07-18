import calendar
from datetime import datetime, timedelta

from app.database.connection import get_conn


def _month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def get_monthly_report_data(year: int, month: int) -> dict:
    """Aggregates every number the monthly report needs. `quotations` rows
    double as the "enquiry" record in this system (there's no separate
    pre-quotation enquiry entity), so "Total Enquiries" / "AI Conversations"
    are read off `sessions` (every chat/WhatsApp conversation, the true
    top of the funnel) while "Quotations Created/Approved/Rejected" are
    read off `quotations` (how many of those conversations became a formal
    quote request)."""

    conn = get_conn()
    month_key = _month_key(year, month)

    def scalar(sql: str, *params) -> int:
        return conn.execute(sql, params).fetchone()[0]

    total_enquiries = scalar(
        "SELECT COUNT(*) FROM sessions WHERE STRFTIME('%Y-%m', created_at) = ?",
        month_key,
    )
    new_customers = scalar(
        "SELECT COUNT(*) FROM customers WHERE STRFTIME('%Y-%m', created_at) = ?",
        month_key,
    )
    quotations_created = scalar(
        "SELECT COUNT(*) FROM quotations WHERE STRFTIME('%Y-%m', created_at) = ?",
        month_key,
    )
    quotations_approved = scalar(
        """
        SELECT COUNT(*) FROM quotations
        WHERE STRFTIME('%Y-%m', created_at) = ? AND approval_status = 'Approved'
        """,
        month_key,
    )
    quotations_rejected = scalar(
        """
        SELECT COUNT(*) FROM quotations
        WHERE STRFTIME('%Y-%m', created_at) = ? AND approval_status = 'Rejected'
        """,
        month_key,
    )
    conversion_rate = (
        round(quotations_approved / quotations_created * 100, 1)
        if quotations_created
        else 0.0
    )

    # Sessions only ever store their *current* status, not a history of
    # transitions - "Human Handoffs" is therefore a snapshot (sessions
    # created this month currently sitting in the sales queue), not a count
    # of every handoff event that happened this month.
    human_handoffs = scalar(
        """
        SELECT COUNT(*) FROM sessions
        WHERE STRFTIME('%Y-%m', created_at) = ? AND status = 'Waiting for Sales'
        """,
        month_key,
    )
    resolved_by_ai = total_enquiries - human_handoffs

    customer_activity = [
        dict(row)
        for row in conn.execute(
            """
            SELECT company_name, created_at, product_name, status
            FROM quotations
            WHERE STRFTIME('%Y-%m', created_at) = ?
            ORDER BY created_at DESC
            LIMIT 30
            """,
            (month_key,),
        ).fetchall()
    ]

    converted_customers = [
        dict(row)
        for row in conn.execute(
            """
            SELECT company_name, product_name, subtotal, closed_at
            FROM quotations
            WHERE STRFTIME('%Y-%m', closed_at) = ? AND status = 'Won'
            ORDER BY closed_at DESC
            """,
            (month_key,),
        ).fetchall()
    ]

    lost_customers = [
        dict(row) | {"reason": "Rejected"}
        for row in conn.execute(
            """
            SELECT company_name, product_name, closed_at
            FROM quotations
            WHERE STRFTIME('%Y-%m', closed_at) = ? AND status = 'Lost'
            ORDER BY closed_at DESC
            """,
            (month_key,),
        ).fetchall()
    ]

    # "Expired" isn't a stored status - it's a computed rule: still open
    # (never won/lost) and untouched for 30+ days as of the end of the
    # reported month.
    days_in_month = calendar.monthrange(year, month)[1]
    stale_cutoff = (
        datetime(year, month, days_in_month) - timedelta(days=30)
    ).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    month_end = f"{year:04d}-{month:02d}-{days_in_month:02d}T23:59:59.999999Z"

    expired_customers = [
        dict(row) | {"reason": "No Response (30+ days)"}
        for row in conn.execute(
            """
            SELECT company_name, product_name, created_at
            FROM quotations
            WHERE status NOT IN ('Won', 'Lost')
              AND created_at <= ?
              AND created_at <= ?
            ORDER BY created_at ASC
            """,
            (stale_cutoff, month_end),
        ).fetchall()
    ]

    top_products = [
        dict(row)
        for row in conn.execute(
            """
            SELECT product_name, COUNT(*) AS enquiries
            FROM quotations
            WHERE STRFTIME('%Y-%m', created_at) = ?
            GROUP BY product_name
            ORDER BY enquiries DESC
            LIMIT 5
            """,
            (month_key,),
        ).fetchall()
    ]

    return {
        "year": year,
        "month": month,
        "summary": {
            "total_enquiries": total_enquiries,
            "new_customers": new_customers,
            "quotations_created": quotations_created,
            "quotations_approved": quotations_approved,
            "quotations_rejected": quotations_rejected,
            "conversion_rate": conversion_rate,
            "ai_conversations": total_enquiries,
            "human_handoffs": human_handoffs,
        },
        "customer_activity": customer_activity,
        "converted_customers": converted_customers,
        "lost_opportunities": lost_customers + expired_customers,
        "top_products": top_products,
        "ai_performance": {
            "total_conversations": total_enquiries,
            "resolved_by_ai": resolved_by_ai,
            "escalated_to_sales": human_handoffs,
        },
    }
