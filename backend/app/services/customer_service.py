from fastapi import HTTPException, status

from app.database.connection import get_conn, write_lock
from app.schemas.customer import UpdateCustomerRequest
from app.services.activity_log import log_activity

# total_quotations comes from quotations linked to this customer; last_contact
# is the more recent of "last quotation activity" (sent_at, falling back to
# created_at) and "last WhatsApp session activity" (sessions.updated_at,
# matched by phone since sessions aren't linked by customer_id). SQLite's
# multi-arg max() returns NULL if either side is NULL, so the CASE spells
# out the one-sided-null cases explicitly instead.
_LIST_QUERY = """
SELECT
    c.*,
    assignee.name AS assigned_to_name,
    COALESCE(q.total_quotations, 0) AS total_quotations,
    CASE
        WHEN q.last_quotation_contact IS NULL THEN s.last_session_contact
        WHEN s.last_session_contact IS NULL THEN q.last_quotation_contact
        ELSE MAX(q.last_quotation_contact, s.last_session_contact)
    END AS last_contact
FROM customers c
LEFT JOIN users assignee ON assignee.id = c.assigned_to
LEFT JOIN (
    SELECT customer_id, COUNT(*) AS total_quotations,
           MAX(IFNULL(sent_at, created_at)) AS last_quotation_contact
    FROM quotations
    WHERE customer_id IS NOT NULL
    GROUP BY customer_id
) q ON q.customer_id = c.id
LEFT JOIN (
    SELECT customer_phone, MAX(updated_at) AS last_session_contact
    FROM sessions
    WHERE customer_phone IS NOT NULL
    GROUP BY customer_phone
) s ON s.customer_phone = c.phone
"""


def list_customers(search: str | None = None):
    conn = get_conn()

    query = _LIST_QUERY
    params: tuple = ()

    if search:
        like = f"%{search}%"
        query += (
            " WHERE c.company_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? "
            "OR c.city LIKE ?"
        )
        params = (like, like, like, like)

    query += " ORDER BY c.company_name"

    rows = conn.execute(query, params).fetchall()

    return [dict(row) for row in rows]


def get_customer(customer_id: int):
    conn = get_conn()

    row = conn.execute(_LIST_QUERY + " WHERE c.id = ?", (customer_id,)).fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    customer = dict(row)

    quotations = conn.execute(
        """
        SELECT id, product_name, items_summary, status, approval_status, sent_at, created_at
        FROM quotations
        WHERE customer_id = ?
        ORDER BY created_at DESC
        """,
        (customer_id,),
    ).fetchall()

    customer["quotations"] = [dict(q) for q in quotations]

    return customer


def update_customer(customer_id: int, request: UpdateCustomerRequest, current_user):
    conn = get_conn()

    existing = conn.execute(
        "SELECT id FROM customers WHERE id = ?",
        (customer_id,),
    ).fetchone()

    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    if request.assigned_to is not None:
        assignee = conn.execute(
            "SELECT id FROM users WHERE id = ? AND is_active = 1",
            (request.assigned_to,),
        ).fetchone()

        if assignee is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee must be an active user.",
            )

    with write_lock:
        conn.execute(
            """
            UPDATE customers
            SET company_name = ?, contact_person = ?, email = ?, gst_number = ?,
                city = ?, assigned_to = ?, notes = ?, tags = ?
            WHERE id = ?
            """,
            (
                request.company_name,
                request.contact_person,
                request.email,
                request.gst_number,
                request.city,
                request.assigned_to,
                request.notes,
                request.tags,
                customer_id,
            ),
        )

        conn.commit()

    log_activity(
        actor_id=current_user["id"],
        action="customer.updated",
        entity_type="customer",
        entity_id=customer_id,
        message=f"{current_user['name']} updated customer {request.company_name}.",
    )

    return get_customer(customer_id)


def delete_customer(customer_id: int, current_user):
    conn = get_conn()

    existing = conn.execute(
        "SELECT id, company_name FROM customers WHERE id = ?",
        (customer_id,),
    ).fetchone()

    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    with write_lock:
        # quotations.customer_id REFERENCES customers(id) with foreign_keys
        # ON and no ON DELETE clause - deleting the customer row directly
        # would fail while quotations still point at it. Unlinking instead
        # of cascading keeps the quotation/lead history intact (each row
        # already carries its own company_name/phone snapshot), just
        # detached from this customer record.
        conn.execute(
            "UPDATE quotations SET customer_id = NULL WHERE customer_id = ?",
            (customer_id,),
        )
        conn.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
        conn.commit()

    log_activity(
        actor_id=current_user["id"],
        action="customer.deleted",
        entity_type="customer",
        entity_id=customer_id,
        message=f"{current_user['name']} deleted customer {existing['company_name']}.",
    )
