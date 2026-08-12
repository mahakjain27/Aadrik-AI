import json
import sqlite3

from app.database.connection import get_conn, write_lock


def _bump_sessions_version(conn: sqlite3.Connection) -> None:
    """Must be called with write_lock already held."""
    conn.execute(
        """
        INSERT INTO app_state (key, value) VALUES ('sessions_version', 1)
        ON CONFLICT (key) DO UPDATE SET value = value + 1
        """
    )


def get_sessions_version() -> int:
    conn = get_conn()

    row = conn.execute(
        "SELECT value FROM app_state WHERE key = 'sessions_version'"
    ).fetchone()

    return row["value"] if row else 0


def create_session(
    session_id: str,
    user_id: str,
    title: str,
    customer_phone: str | None = None,
    channel: str = "internal",
    status: str = "Open",
    assigned_to: int | None = None,
) -> None:
    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            INSERT INTO sessions
            (
                id,
                user_id,
                title,
                customer_phone,
                channel,
                status,
                assigned_to
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                user_id,
                title,
                customer_phone,
                channel,
                status,
                assigned_to,
            ),
        )

        _bump_sessions_version(conn)
        conn.commit()


def get_session(session_id: str, user_id: str) -> sqlite3.Row | None:
    conn = get_conn()
    return conn.execute(
        "SELECT * FROM sessions WHERE id = ? AND user_id = ?",
        (session_id, user_id),
    ).fetchone()


def list_sessions(user_id: str) -> list[sqlite3.Row]:
    conn = get_conn()

    return conn.execute(
        """
        SELECT
            id,
            title,
            updated_at,
            channel,
            status,
            customer_phone,
            assigned_to
        FROM sessions
        WHERE user_id = ?
        ORDER BY updated_at DESC
        """,
        (user_id,),
    ).fetchall()


def list_sessions_by_status(status: str, viewer_id: int) -> list[sqlite3.Row]:
    conn = get_conn()

    return conn.execute(
        """
        SELECT
            sessions.id,
            sessions.title,
            sessions.updated_at,
            sessions.channel,
            sessions.status,
            sessions.customer_phone,
            sessions.assigned_to,
            sessions.is_archived,
            assignee.name AS assigned_to_name,
            sessions.updated_at > COALESCE(session_reads.last_read_at, '') AS unread
        FROM sessions
        LEFT JOIN users AS assignee ON assignee.id = sessions.assigned_to
        LEFT JOIN session_reads
            ON session_reads.session_id = sessions.id
            AND session_reads.user_id = ?
        WHERE sessions.status = ? AND sessions.is_archived = 0
        ORDER BY sessions.updated_at DESC
        """,
        (viewer_id, status),
    ).fetchall()


def list_waiting_sessions(viewer_id: int) -> list[sqlite3.Row]:
    return list_sessions_by_status("Waiting for Sales", viewer_id)


def list_archived_sessions(viewer_id: int) -> list[sqlite3.Row]:
    conn = get_conn()

    return conn.execute(
        """
        SELECT
            sessions.id,
            sessions.title,
            sessions.updated_at,
            sessions.channel,
            sessions.status,
            sessions.customer_phone,
            sessions.assigned_to,
            sessions.is_archived,
            assignee.name AS assigned_to_name,
            sessions.updated_at > COALESCE(session_reads.last_read_at, '') AS unread
        FROM sessions
        LEFT JOIN users AS assignee ON assignee.id = sessions.assigned_to
        LEFT JOIN session_reads
            ON session_reads.session_id = sessions.id
            AND session_reads.user_id = ?
        WHERE sessions.is_archived = 1
        ORDER BY sessions.updated_at DESC
        """,
        (viewer_id,),
    ).fetchall()


def list_assigned_unread_sessions(user_id: int) -> list[sqlite3.Row]:
    conn = get_conn()

    return conn.execute(
        """
        SELECT
            sessions.id,
            sessions.title,
            sessions.updated_at,
            sessions.channel,
            sessions.status,
            sessions.customer_phone,
            sessions.assigned_to,
            sessions.is_archived,
            assignee.name AS assigned_to_name,
            sessions.updated_at > COALESCE(session_reads.last_read_at, '') AS unread
        FROM sessions
        LEFT JOIN users AS assignee ON assignee.id = sessions.assigned_to
        LEFT JOIN session_reads
            ON session_reads.session_id = sessions.id
            AND session_reads.user_id = ?
        WHERE sessions.assigned_to = ?
          AND sessions.status != 'Closed'
          AND sessions.is_archived = 0
          AND sessions.updated_at > COALESCE(session_reads.last_read_at, '')
        ORDER BY sessions.updated_at DESC
        """,
        (user_id, user_id),
    ).fetchall()


def search_sessions(query: str, viewer_id: int) -> list[sqlite3.Row]:
    conn = get_conn()
    like = f"%{query}%"

    return conn.execute(
        """
        SELECT
            sessions.id,
            sessions.title,
            sessions.updated_at,
            sessions.channel,
            sessions.status,
            sessions.customer_phone,
            sessions.assigned_to,
            sessions.is_archived,
            assignee.name AS assigned_to_name,
            sessions.updated_at > COALESCE(session_reads.last_read_at, '') AS unread
        FROM sessions
        LEFT JOIN users AS assignee ON assignee.id = sessions.assigned_to
        LEFT JOIN session_reads
            ON session_reads.session_id = sessions.id
            AND session_reads.user_id = ?
        WHERE (sessions.title LIKE ? OR sessions.customer_phone LIKE ?)
          AND sessions.is_archived = 0
        ORDER BY sessions.updated_at DESC
        """,
        (viewer_id, like, like),
    ).fetchall()


def touch_session(session_id: str) -> None:
    conn = get_conn()
    with write_lock:
        conn.execute(
            "UPDATE sessions SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now') "
            "WHERE id = ?",
            (session_id,),
        )
        _bump_sessions_version(conn)
        conn.commit()


def insert_message(
    session_id: str,
    role: str,
    content: str,
    sources: list[str] | None = None,
    wamid: str | None = None,
) -> None:
    conn = get_conn()
    sources_json = json.dumps(sources) if sources else None

    with write_lock:
        conn.execute(
            "INSERT INTO messages (session_id, role, content, sources, wamid) "
            "VALUES (?, ?, ?, ?, ?)",
            (session_id, role, content, sources_json, wamid),
        )
        conn.commit()


def message_exists_by_wamid(wamid: str) -> bool:
    conn = get_conn()

    row = conn.execute(
        "SELECT 1 FROM messages WHERE wamid = ?",
        (wamid,),
    ).fetchone()

    return row is not None


def get_active_session_by_phone(phone: str, channel: str) -> sqlite3.Row | None:
    conn = get_conn()

    return conn.execute(
        """
        SELECT *
        FROM sessions
        WHERE customer_phone = ? AND channel = ? AND status != 'Closed'
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (phone, channel),
    ).fetchone()


def get_last_customer_message_at(session_id: str) -> str | None:
    """Latest inbound (role='user') message timestamp for a session - used
    to determine whether Meta's 24h customer-service window is still open
    for a business-initiated reply."""
    conn = get_conn()

    row = conn.execute(
        "SELECT MAX(created_at) AS last_at FROM messages WHERE session_id = ? AND role = 'user'",
        (session_id,),
    ).fetchone()

    return row["last_at"] if row else None


def get_or_create_customer(
    phone: str,
    company_name: str,
    contact_person: str | None,
    email: str | None,
    gst_number: str | None,
    city: str | None,
) -> int:
    """Looks up a customer by phone, or creates one seeded from this
    quotation's details. Never overwrites an existing customer's fields -
    once created, a customer record is curated by sales via Customer
    Management, not silently rewritten by later quotations."""

    conn = get_conn()

    existing = conn.execute(
        "SELECT id FROM customers WHERE phone = ?",
        (phone,),
    ).fetchone()

    if existing is not None:
        return existing["id"]

    with write_lock:
        try:
            cursor = conn.execute(
                """
                INSERT INTO customers
                (phone, company_name, contact_person, email, gst_number, city)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (phone, company_name, contact_person, email, gst_number, city),
            )

            conn.commit()

            return cursor.lastrowid
        except sqlite3.IntegrityError:
            # Another request created this phone's customer between our
            # SELECT and this INSERT - fall back to it instead of erroring.
            conn.rollback()

            return conn.execute(
                "SELECT id FROM customers WHERE phone = ?",
                (phone,),
            ).fetchone()["id"]


def update_quotation_whatsapp_status(wamid: str, status: str) -> None:
    """Applies a Meta delivery-status callback (sent/delivered/read/failed)
    to whichever quotation was sent with this wamid. No-ops if the wamid
    doesn't belong to a quotation send (e.g. a regular chat reply)."""

    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            UPDATE quotations
            SET whatsapp_delivery_status = ?
            WHERE whatsapp_wamid = ?
            """,
            (status, wamid),
        )

        conn.commit()


def list_messages(session_id: str) -> list[sqlite3.Row]:
    conn = get_conn()
    return conn.execute(
        "SELECT role, content, sources, created_at FROM messages "
        "WHERE session_id = ? ORDER BY created_at",
        (session_id,),
    ).fetchall()


def insert_sales_reply(session_id: str, message: str) -> None:
    insert_message(
        session_id=session_id,
        role="sales",
        content=message,
    )

    touch_session(session_id)


def mark_session_read(session_id: str, user_id: int) -> None:
    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            INSERT INTO session_reads (session_id, user_id, last_read_at)
            VALUES (?, ?, STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
            ON CONFLICT (session_id, user_id)
            DO UPDATE SET last_read_at = excluded.last_read_at
            """,
            (session_id, user_id),
        )

        conn.commit()

# ==========================================================
# Users
# ==========================================================

def create_user(
    name: str,
    email: str,
    password_hash: str,
    role: str,
) -> None:
    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            INSERT INTO users
            (name, email, password_hash, role)
            VALUES (?, ?, ?, ?)
            """,
            (
                name,
                email,
                password_hash,
                role,
            ),
        )
        conn.commit()


def get_user_by_email(email: str) -> sqlite3.Row | None:
    conn = get_conn()

    return conn.execute(
        """
        SELECT *
        FROM users
        WHERE email = ?
        """,
        (email,),
    ).fetchone()


def get_user_by_id(user_id: int) -> sqlite3.Row | None:
    conn = get_conn()

    return conn.execute(
        """
        SELECT *
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()


def list_users() -> list[sqlite3.Row]:
    conn = get_conn()

    return conn.execute(
        """
        SELECT
            id,
            name,
            email,
            role,
            is_active,
            created_at
        FROM users
        ORDER BY created_at DESC
        """
    ).fetchall()


def update_user_status(
    user_id: int,
    is_active: bool,
) -> None:
    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            UPDATE users
            SET is_active = ?
            WHERE id = ?
            """,
            (
                int(is_active),
                user_id,
            ),
        )

        conn.commit()


def update_user(
    user_id: int,
    name: str,
    role: str,
) -> None:
    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            UPDATE users
            SET name = ?, role = ?
            WHERE id = ?
            """,
            (
                name,
                role,
                user_id,
            ),
        )

        conn.commit()


def change_password(
    user_id: int,
    password_hash: str,
) -> None:
    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            UPDATE users
            SET password_hash = ?
            WHERE id = ?
            """,
            (
                password_hash,
                user_id,
            ),
        )

        conn.commit()


def update_profile(
    user_id: int,
    name: str,
    email: str,
) -> None:
    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            UPDATE users
            SET name = ?, email = ?
            WHERE id = ?
            """,
            (
                name,
                email,
                user_id,
            ),
        )

        conn.commit()


def update_last_login(user_id: int) -> None:
    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            UPDATE users
            SET last_login_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = ?
            """,
            (user_id,),
        )

        conn.commit()


def update_session_status(session_id: str, status: str) -> None:
    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            UPDATE sessions
            SET status = ?
            WHERE id = ?
            """,
            (status, session_id),
        )
        _bump_sessions_version(conn)
        conn.commit()


def assign_session(session_id: str, user_id: int | None) -> None:
    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            UPDATE sessions
            SET assigned_to = ?
            WHERE id = ?
            """,
            (user_id, session_id),
        )
        _bump_sessions_version(conn)
        conn.commit()


def set_session_archived(session_id: str, archived: bool) -> None:
    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            UPDATE sessions
            SET is_archived = ?
            WHERE id = ?
            """,
            (int(archived), session_id),
        )
        _bump_sessions_version(conn)
        conn.commit()


def delete_session(session_id: str) -> int:
    conn = get_conn()

    with write_lock:
        cursor = conn.execute(
            "DELETE FROM sessions WHERE id = ?",
            (session_id,),
        )
        _bump_sessions_version(conn)
        conn.commit()

    return cursor.rowcount


def delete_closed_sessions() -> int:
    conn = get_conn()

    with write_lock:
        cursor = conn.execute(
            "DELETE FROM sessions WHERE status = 'Closed'"
        )
        _bump_sessions_version(conn)
        conn.commit()

    return cursor.rowcount


def get_session_by_id(session_id: str):
    conn = get_conn()

    return conn.execute(
        """
        SELECT
            sessions.*,
            assignee.name AS assigned_to_name
        FROM sessions
        LEFT JOIN users AS assignee ON assignee.id = sessions.assigned_to
        WHERE sessions.id = ?
        """,
        (session_id,),
    ).fetchone()


def list_dismissed_notification_keys(user_id: int) -> set[str]:
    conn = get_conn()

    rows = conn.execute(
        "SELECT notification_key FROM dismissed_notifications WHERE user_id = ?",
        (user_id,),
    ).fetchall()

    return {row["notification_key"] for row in rows}


def dismiss_notifications(user_id: int, keys: list[str]) -> None:
    conn = get_conn()

    with write_lock:
        conn.executemany(
            """
            INSERT INTO dismissed_notifications (user_id, notification_key)
            VALUES (?, ?)
            ON CONFLICT (user_id, notification_key) DO NOTHING
            """,
            [(user_id, key) for key in keys],
        )
        conn.commit()


def clear_dismissed_notifications(user_id: int) -> None:
    """Resets a user's dismissals - used when clearing/undoing rather than
    dismissing, e.g. an admin resetting the bell to its full state."""

    conn = get_conn()

    with write_lock:
        conn.execute(
            "DELETE FROM dismissed_notifications WHERE user_id = ?",
            (user_id,),
        )
        conn.commit()