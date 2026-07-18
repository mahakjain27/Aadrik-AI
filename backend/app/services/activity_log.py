from app.database.connection import get_conn, write_lock


def log_activity(
    actor_id: int | None,
    action: str,
    message: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> None:
    conn = get_conn()

    with write_lock:
        conn.execute(
            """
            INSERT INTO activity_log
            (actor_id, action, entity_type, entity_id, message)
            VALUES (?, ?, ?, ?, ?)
            """,
            (actor_id, action, entity_type, entity_id, message),
        )

        conn.commit()


def list_activity(
    entity_types: list[str] | None = None,
    limit: int = 50,
) -> list[dict]:
    conn = get_conn()

    if entity_types:
        placeholders = ",".join("?" for _ in entity_types)
        rows = conn.execute(
            f"""
            SELECT activity_log.*, users.name AS actor_name
            FROM activity_log
            LEFT JOIN users ON users.id = activity_log.actor_id
            WHERE entity_type IN ({placeholders})
            ORDER BY activity_log.created_at DESC
            LIMIT ?
            """,
            (*entity_types, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT activity_log.*, users.name AS actor_name
            FROM activity_log
            LEFT JOIN users ON users.id = activity_log.actor_id
            ORDER BY activity_log.created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [dict(row) for row in rows]


def delete_activity(older_than_days: int | None = None) -> int:
    """Purges activity log entries. `older_than_days=None` clears the whole
    table; otherwise only rows older than that many days are removed."""

    conn = get_conn()

    with write_lock:
        if older_than_days is None:
            cursor = conn.execute("DELETE FROM activity_log")
        else:
            cursor = conn.execute(
                """
                DELETE FROM activity_log
                WHERE created_at < DATETIME('now', ?)
                """,
                (f"-{older_than_days} days",),
            )

        conn.commit()

    return cursor.rowcount
