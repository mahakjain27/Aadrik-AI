import json
import sqlite3

from app.database.connection import get_conn, write_lock


def create_session(session_id: str, user_id: str, title: str) -> None:
    conn = get_conn()
    with write_lock:
        conn.execute(
            "INSERT INTO sessions (id, user_id, title) VALUES (?, ?, ?)",
            (session_id, user_id, title),
        )
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
        "SELECT id, title, updated_at FROM sessions "
        "WHERE user_id = ? ORDER BY updated_at DESC",
        (user_id,),
    ).fetchall()


def touch_session(session_id: str) -> None:
    conn = get_conn()
    with write_lock:
        conn.execute(
            "UPDATE sessions SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now') "
            "WHERE id = ?",
            (session_id,),
        )
        conn.commit()


def insert_message(
    session_id: str, role: str, content: str, sources: list[str] | None = None
) -> None:
    conn = get_conn()
    sources_json = json.dumps(sources) if sources else None

    with write_lock:
        conn.execute(
            "INSERT INTO messages (session_id, role, content, sources) "
            "VALUES (?, ?, ?, ?)",
            (session_id, role, content, sources_json),
        )
        conn.commit()


def list_messages(session_id: str) -> list[sqlite3.Row]:
    conn = get_conn()
    return conn.execute(
        "SELECT role, content, sources FROM messages "
        "WHERE session_id = ? ORDER BY created_at",
        (session_id,),
    ).fetchall()
