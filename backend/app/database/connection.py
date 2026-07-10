import sqlite3
import threading
from pathlib import Path

# app/database/connection.py -> parents[2] = backend/ -> backend/database/app.db
DB_PATH = Path(__file__).resolve().parents[2] / "database" / "app.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
_conn.execute("PRAGMA journal_mode=WAL")
_conn.execute("PRAGMA foreign_keys=ON")
_conn.row_factory = sqlite3.Row

# SQLite allows only one writer at a time; this serializes writes issued
# from FastAPI's threadpool (sync endpoints run on separate threads).
write_lock = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    company_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,

    product_name TEXT NOT NULL,
    brand TEXT,
    size TEXT,
    quantity TEXT,

    delivery_city TEXT,
    pincode TEXT,
    gst_number TEXT,

    status TEXT NOT NULL DEFAULT 'New',

    created_at TEXT NOT NULL DEFAULT (
        STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
    )
);

CREATE INDEX IF NOT EXISTS idx_quotation_status
ON quotations(status);

CREATE INDEX IF NOT EXISTS idx_quotation_created
ON quotations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user_updated
    ON sessions (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    sources     TEXT,
    created_at  TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_session_created
    ON messages (session_id, created_at);
"""


def get_conn() -> sqlite3.Connection:
    return _conn


def init_db() -> None:
    with write_lock:
        _conn.executescript(SCHEMA)
        _conn.commit()
