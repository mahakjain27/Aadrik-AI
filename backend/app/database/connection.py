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

    created_by INTEGER REFERENCES users(id),
    closed_by INTEGER REFERENCES users(id),
    closed_at TEXT,
    assigned_to INTEGER REFERENCES users(id),
    source TEXT NOT NULL DEFAULT 'manual',

    created_at TEXT NOT NULL DEFAULT (
        STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
    )
);

CREATE INDEX IF NOT EXISTS idx_quotation_status
ON quotations(status);

CREATE INDEX IF NOT EXISTS idx_quotation_created
ON quotations(created_at DESC);

CREATE TABLE IF NOT EXISTS quotation_price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_id INTEGER NOT NULL REFERENCES quotations(id),

    old_unit_price REAL,
    new_unit_price REAL,

    old_discount_type TEXT,
    new_discount_type TEXT,
    old_discount_percent REAL,
    new_discount_percent REAL,
    old_discount_amount REAL,
    new_discount_amount REAL,

    old_special_discount_percent REAL,
    new_special_discount_percent REAL,
    old_special_discount_amount REAL,
    new_special_discount_amount REAL,

    old_gst_percent REAL,
    new_gst_percent REAL,

    old_grand_total REAL,
    new_grand_total REAL,

    changed_by INTEGER REFERENCES users(id),
    changed_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_quotation_price_history_quotation_id
ON quotation_price_history(quotation_id);

-- One row per product line on a quotation. A quotation always has >= 1
-- item; quotations.product_name/brand/size/quantity mirror the first item
-- (and unit_price/gst_percent/discount fields stop being written) once a
-- quotation has items - see _migrate_backfill_quotation_items.
CREATE TABLE IF NOT EXISTS quotation_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,

    product_name TEXT NOT NULL,
    brand TEXT,
    size TEXT,
    quantity TEXT,

    unit_price REAL,
    gst_percent REAL,
    discount_type TEXT NOT NULL DEFAULT 'percent',
    discount_percent REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    special_discount_percent REAL NOT NULL DEFAULT 0,
    special_discount_amount REAL NOT NULL DEFAULT 0,

    subtotal REAL,
    grand_total REAL,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id
ON quotation_items(quotation_id);

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

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    email TEXT NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    role TEXT NOT NULL CHECK(role IN ('admin', 'sales', 'manager', 'viewer')),

    is_active INTEGER NOT NULL DEFAULT 1,

    created_at TEXT NOT NULL DEFAULT (
        STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
    ),

    updated_at TEXT NOT NULL DEFAULT (
        STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
    )
);

CREATE TRIGGER IF NOT EXISTS trg_users_updated
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
UPDATE users
SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id = OLD.id;
END;

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);

CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    actor_id INTEGER REFERENCES users(id),

    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    message TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT (
        STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
    )
);

CREATE INDEX IF NOT EXISTS idx_activity_created
ON activity_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_entity
ON activity_log(entity_type, created_at DESC);

CREATE TABLE IF NOT EXISTS session_reads (
    session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at    TEXT NOT NULL,

    PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS app_state (
    key     TEXT PRIMARY KEY,
    value   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    phone TEXT NOT NULL UNIQUE,

    company_name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    gst_number TEXT,
    city TEXT,

    assigned_to INTEGER REFERENCES users(id),

    notes TEXT,
    tags TEXT,

    created_at TEXT NOT NULL DEFAULT (
        STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
    ),

    updated_at TEXT NOT NULL DEFAULT (
        STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
    )
);

CREATE TRIGGER IF NOT EXISTS trg_customers_updated
AFTER UPDATE ON customers
FOR EACH ROW
BEGIN
UPDATE customers
SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id = OLD.id;
END;

CREATE INDEX IF NOT EXISTS idx_customers_phone
ON customers(phone);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Stable string id exposed to the product catalog API, the WhatsApp
    -- product menu, and public /quote links (see whatsapp_menu.py) - kept
    -- separate from the integer PK so backfilled products keep the exact
    -- "rasi-e6013"-style ids that may already be referenced in an open
    -- WhatsApp conversation.
    slug TEXT NOT NULL UNIQUE,

    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    subcategory TEXT,
    grade TEXT,
    sizes TEXT,
    packaging TEXT,
    applications TEXT,

    mrp REAL,
    selling_price REAL,
    gst_percent REAL NOT NULL DEFAULT 18,
    stock_status TEXT NOT NULL DEFAULT 'In Stock'
        CHECK(stock_status IN ('In Stock', 'Low Stock', 'Out of Stock')),
    description TEXT,

    is_active INTEGER NOT NULL DEFAULT 1,

    created_at TEXT NOT NULL DEFAULT (
        STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
    ),

    updated_at TEXT NOT NULL DEFAULT (
        STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
    )
);

CREATE TRIGGER IF NOT EXISTS trg_products_updated
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
UPDATE products
SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id = OLD.id;
END;

CREATE INDEX IF NOT EXISTS idx_products_category
ON products(category);

CREATE INDEX IF NOT EXISTS idx_products_brand
ON products(brand);

CREATE INDEX IF NOT EXISTS idx_products_active
ON products(is_active);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    file_type TEXT NOT NULL CHECK(file_type IN ('pdf', 'docx', 'txt', 'md')),
    category TEXT NOT NULL CHECK(category IN (
        'Policies', 'Catalogues', 'Technical Datasheets', 'FAQs',
        'Company Information', 'Other'
    )),
    file_size INTEGER,

    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TEXT NOT NULL DEFAULT (
        STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
    )
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_category
ON knowledge_documents(category);

-- Single-row table (id is always 1) tracking when the vector store was
-- last rebuilt - updated by build_rag() itself, so it's accurate
-- regardless of whether a rebuild was triggered manually from Knowledge
-- Base Manager or automatically after a Product Management save.
CREATE TABLE IF NOT EXISTS knowledge_base_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_rebuilt_at TEXT
);

INSERT OR IGNORE INTO knowledge_base_state (id, last_rebuilt_at) VALUES (1, NULL);

-- Notifications (follow-up alerts, activity feed, pending-approval items)
-- are computed on the fly from other tables rather than stored, so there's
-- nothing to mark "read" - dismissing one just needs to hide it for that
-- user going forward, which is all this table tracks.
CREATE TABLE IF NOT EXISTS dismissed_notifications (
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_key    TEXT NOT NULL,
    dismissed_at        TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),

    PRIMARY KEY (user_id, notification_key)
);
"""


def get_conn() -> sqlite3.Connection:
    return _conn


def _migrate_users_role_constraint() -> None:
    """
    SQLite can't ALTER a CHECK constraint in place, so widen the users.role
    constraint (admin/sales -> admin/sales/manager/viewer) by rebuilding
    the table when an older schema is detected.
    """

    row = _conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
    ).fetchone()

    if row is None or "'manager'" in row["sql"]:
        return

    with write_lock:
        _conn.executescript(
            """
            ALTER TABLE users RENAME TO users_old;

            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'sales', 'manager', 'viewer')),
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
                updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'))
            );

            INSERT INTO users (
                id, name, email, password_hash, role, is_active, created_at, updated_at
            )
            SELECT
                id, name, email, password_hash, role, is_active, created_at, updated_at
            FROM users_old;

            DROP TABLE users_old;

            DROP INDEX IF EXISTS idx_users_email;
            DROP INDEX IF EXISTS idx_users_role;

            CREATE INDEX idx_users_email ON users(email);
            CREATE INDEX idx_users_role ON users(role);

            CREATE TRIGGER IF NOT EXISTS trg_users_updated
            AFTER UPDATE ON users
            FOR EACH ROW
            BEGIN
                UPDATE users
                SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
                WHERE id = OLD.id;
            END;
            """
        )
        _conn.commit()


def _migrate_quotations_columns() -> None:
    columns = {
        row["name"]
        for row in _conn.execute(
            "PRAGMA table_info(quotations)"
        ).fetchall()
    }

    missing = {
        "notes":
            "ALTER TABLE quotations ADD COLUMN notes TEXT",

        "unit_price":
            "ALTER TABLE quotations ADD COLUMN unit_price REAL",

        "gst_percent":
            "ALTER TABLE quotations ADD COLUMN gst_percent REAL",

        "discount_percent":
            "ALTER TABLE quotations ADD COLUMN discount_percent REAL NOT NULL DEFAULT 0",

        "discount_type":
            "ALTER TABLE quotations ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'percent'",

        "discount_amount":
            "ALTER TABLE quotations ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0",

        "special_discount_percent":
            "ALTER TABLE quotations ADD COLUMN special_discount_percent REAL NOT NULL DEFAULT 0",

        "special_discount_amount":
            "ALTER TABLE quotations ADD COLUMN special_discount_amount REAL NOT NULL DEFAULT 0",

        "subtotal":
            "ALTER TABLE quotations ADD COLUMN subtotal REAL",

        "approval_status":
            "ALTER TABLE quotations ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'Draft'",

        "approved_by":
            "ALTER TABLE quotations ADD COLUMN approved_by INTEGER REFERENCES users(id)",

        "approved_at":
            "ALTER TABLE quotations ADD COLUMN approved_at TEXT",

        "rejection_reason":
            "ALTER TABLE quotations ADD COLUMN rejection_reason TEXT",

        "sent_at":
            "ALTER TABLE quotations ADD COLUMN sent_at TEXT",

        "sent_via":
            "ALTER TABLE quotations ADD COLUMN sent_via TEXT",

        "whatsapp_wamid":
            "ALTER TABLE quotations ADD COLUMN whatsapp_wamid TEXT",

        "whatsapp_delivery_status":
            "ALTER TABLE quotations ADD COLUMN whatsapp_delivery_status TEXT",

        "customer_id":
            "ALTER TABLE quotations ADD COLUMN customer_id INTEGER REFERENCES customers(id)",

        "is_archived":
            "ALTER TABLE quotations ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0",

        "grand_total":
            "ALTER TABLE quotations ADD COLUMN grand_total REAL",

        "items_summary":
            "ALTER TABLE quotations ADD COLUMN items_summary TEXT",

        # The WhatsApp number that originally opened this quotation's
        # /quote?product=...&phone=... link - distinct from `phone`, which
        # is whatever the customer typed into the form and may differ.
        # NULL for quotations with no WhatsApp origin (manual/website) and
        # for every quotation that existed before this column was added -
        # never speculatively backfilled from `phone`.
        "source_whatsapp_phone":
            "ALTER TABLE quotations ADD COLUMN source_whatsapp_phone TEXT",
    }

    with write_lock:
        for name, sql in missing.items():
            if name not in columns:
                _conn.execute(sql)

        _conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_quotations_whatsapp_wamid "
            "ON quotations(whatsapp_wamid)"
        )

        _conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_quotations_customer_id "
            "ON quotations(customer_id)"
        )

        _conn.commit()


def _migrate_quotation_price_history_columns() -> None:
    """Adds JSON-snapshot columns used for multi-item price-change audit
    entries going forward. Historical rows (written before line items
    existed) keep using the old per-field old_X/new_X columns untouched -
    these new columns stay NULL on them."""

    columns = {
        row["name"]
        for row in _conn.execute(
            "PRAGMA table_info(quotation_price_history)"
        ).fetchall()
    }

    missing = {
        "old_items_json":
            "ALTER TABLE quotation_price_history ADD COLUMN old_items_json TEXT",

        "new_items_json":
            "ALTER TABLE quotation_price_history ADD COLUMN new_items_json TEXT",
    }

    with write_lock:
        for name, sql in missing.items():
            if name not in columns:
                _conn.execute(sql)

        _conn.commit()


def _migrate_backfill_quotation_items() -> None:
    """One-time backfill: every pre-existing quotations row becomes exactly
    one quotation_items row carrying its legacy singular product+pricing
    fields, and quotations.grand_total/items_summary get computed from it.
    Idempotent - only touches quotations that have zero item rows yet, so
    this is a fast no-op once the backfill has run."""

    orphans = _conn.execute(
        """
        SELECT quotations.*
        FROM quotations
        LEFT JOIN quotation_items ON quotation_items.quotation_id = quotations.id
        WHERE quotation_items.id IS NULL
        """
    ).fetchall()

    if not orphans:
        return

    from app.services.lead_scoring import _parse_quantity
    from app.services.quotation_pricing import compute_quotation_totals

    with write_lock:
        for q in orphans:
            _conn.execute(
                """
                INSERT INTO quotation_items
                (quotation_id, product_name, brand, size, quantity,
                 unit_price, gst_percent, discount_type, discount_percent,
                 discount_amount, special_discount_percent, special_discount_amount,
                 subtotal, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """,
                (
                    q["id"], q["product_name"], q["brand"], q["size"], q["quantity"],
                    q["unit_price"], q["gst_percent"], q["discount_type"] or "percent",
                    q["discount_percent"] or 0, q["discount_amount"] or 0,
                    q["special_discount_percent"] or 0, q["special_discount_amount"] or 0,
                    q["subtotal"],
                ),
            )

            grand_total = None
            if q["unit_price"] is not None:
                qty = _parse_quantity(q["quantity"])
                if qty:
                    totals = compute_quotation_totals(
                        unit_price=q["unit_price"], quantity=qty,
                        gst_percent=q["gst_percent"] or 18,
                        discount_type=q["discount_type"] or "percent",
                        discount_percent=q["discount_percent"] or 0,
                        discount_amount=q["discount_amount"] or 0,
                        special_discount_percent=q["special_discount_percent"] or 0,
                        special_discount_amount=q["special_discount_amount"] or 0,
                    )
                    grand_total = totals["grand_total"]
                    _conn.execute(
                        "UPDATE quotation_items SET grand_total = ? "
                        "WHERE quotation_id = ? AND sort_order = 0",
                        (grand_total, q["id"]),
                    )

            _conn.execute(
                "UPDATE quotations SET grand_total = ?, items_summary = ? WHERE id = ?",
                (grand_total, q["product_name"], q["id"]),
            )

        _conn.commit()


def _migrate_sessions_columns() -> None:
    columns = {
        row["name"]
        for row in _conn.execute(
            "PRAGMA table_info(sessions)"
        ).fetchall()
    }

    missing = {
        "customer_phone":
            "ALTER TABLE sessions ADD COLUMN customer_phone TEXT",

        "channel":
            "ALTER TABLE sessions ADD COLUMN channel TEXT NOT NULL DEFAULT 'internal'",

        "status":
            "ALTER TABLE sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'Open'",

        "assigned_to":
            "ALTER TABLE sessions ADD COLUMN assigned_to INTEGER REFERENCES users(id)",

        "is_archived":
            "ALTER TABLE sessions ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0",

        "customer_name":
            "ALTER TABLE sessions ADD COLUMN customer_name TEXT",
    }

    with write_lock:
        for name, sql in missing.items():
            if name not in columns:
                _conn.execute(sql)

        _conn.commit()


def _migrate_messages_columns() -> None:
    columns = {
        row["name"]
        for row in _conn.execute(
            "PRAGMA table_info(messages)"
        ).fetchall()
    }

    missing = {
        "wamid":
            "ALTER TABLE messages ADD COLUMN wamid TEXT",
    }

    with write_lock:
        for name, sql in missing.items():
            if name not in columns:
                _conn.execute(sql)

        _conn.commit()


def _migrate_users_last_login() -> None:
    columns = {
        row["name"]
        for row in _conn.execute(
            "PRAGMA table_info(users)"
        ).fetchall()
    }

    if "last_login_at" not in columns:
        with write_lock:
            _conn.execute(
                "ALTER TABLE users ADD COLUMN last_login_at TEXT"
            )
            _conn.commit()


def _migrate_backfill_won_approval_status() -> None:
    """One-time fix for leads that were manually marked Won before the
    status/approval invariant existed - a Won lead with no approved (or
    explicitly not-required) quotation is a contradiction the dashboard
    shouldn't display. Idempotent - only touches rows still in that state."""

    with write_lock:
        _conn.execute(
            """
            UPDATE quotations
            SET approval_status = 'Not Required'
            WHERE status = 'Won'
              AND approval_status NOT IN ('Approved', 'Not Required')
            """
        )
        _conn.commit()


def _migrate_backfill_customers() -> None:
    """One-time backfill: derive a customers row per distinct phone from
    existing quotations (seeded from that phone's most recent quotation),
    then link every quotation to it. Idempotent - only touches quotations
    that don't have a customer_id yet, so this is a fast no-op once the
    backfill has run."""

    unlinked_phones = _conn.execute(
        "SELECT DISTINCT phone FROM quotations WHERE customer_id IS NULL"
    ).fetchall()

    if not unlinked_phones:
        return

    with write_lock:
        for row in unlinked_phones:
            phone = row["phone"]

            customer = _conn.execute(
                "SELECT id FROM customers WHERE phone = ?",
                (phone,),
            ).fetchone()

            if customer is None:
                latest = _conn.execute(
                    """
                    SELECT company_name, contact_person, email, gst_number, delivery_city
                    FROM quotations
                    WHERE phone = ?
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (phone,),
                ).fetchone()

                cursor = _conn.execute(
                    """
                    INSERT INTO customers
                    (phone, company_name, contact_person, email, gst_number, city)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        phone,
                        latest["company_name"],
                        latest["contact_person"],
                        latest["email"],
                        latest["gst_number"],
                        latest["delivery_city"],
                    ),
                )
                customer_id = cursor.lastrowid
            else:
                customer_id = customer["id"]

            _conn.execute(
                "UPDATE quotations SET customer_id = ? WHERE phone = ? AND customer_id IS NULL",
                (customer_id, phone),
            )

        _conn.commit()


def _migrate_seed_products() -> None:
    """One-time seed: import data/products.json into the products table on
    first run, keeping each product's original slug id (e.g. "rasi-e6013")
    so existing WhatsApp product links keep resolving. No-ops once the
    table has any rows, so later admin edits/deletes are never touched.

    data/products.json has 39 entries but only 23 unique "id" values - e.g.
    all 4 grades (304/308/309/316) of "Rasi SS TIG Filler Rods" share the
    id "rasi-ss-tig". That's a pre-existing bug (find_product() in
    whatsapp_menu.py can only ever reach the first match for a given id),
    not something to replicate here - every real variant gets its own slug
    (rasi-ss-tig, rasi-ss-tig-2, ...) so none of the 39 are silently lost.
    """

    existing = _conn.execute("SELECT COUNT(*) AS n FROM products").fetchone()

    if existing["n"] > 0:
        return

    json_path = Path(__file__).resolve().parents[3] / "data" / "products.json"

    if not json_path.exists():
        return

    import json

    with open(json_path, encoding="utf-8") as f:
        catalog = json.load(f)

    seen_slugs: dict[str, int] = {}

    with write_lock:
        for product in catalog.get("products", []):
            base_slug = product["id"]
            count = seen_slugs.get(base_slug, 0)
            slug = base_slug if count == 0 else f"{base_slug}-{count + 1}"
            seen_slugs[base_slug] = count + 1

            _conn.execute(
                """
                INSERT INTO products
                (slug, name, brand, category, subcategory, grade, sizes, packaging, applications)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(slug) DO NOTHING
                """,
                (
                    slug,
                    product["name"],
                    product.get("brand"),
                    product.get("category"),
                    product.get("subcategory"),
                    product.get("grade") if isinstance(product.get("grade"), str) else None,
                    ",".join(product.get("sizes") or []),
                    ",".join(product.get("packing") or []),
                    ",".join(product.get("applications") or []),
                ),
            )

        _conn.commit()


def init_db() -> None:
    with write_lock:
        _conn.executescript(SCHEMA)
        _conn.commit()

    _migrate_users_role_constraint()
    _migrate_quotations_columns()
    _migrate_sessions_columns()
    _migrate_messages_role()
    _migrate_messages_columns()
    _migrate_users_last_login()
    _migrate_backfill_customers()
    _migrate_backfill_won_approval_status()
    _migrate_seed_products()
    _migrate_quotation_price_history_columns()
    _migrate_backfill_quotation_items()

def _migrate_messages_role() -> None:
    row = _conn.execute(
        """
        SELECT sql
        FROM sqlite_master
        WHERE type='table'
        AND name='messages'
        """
    ).fetchone()

    if row is None:
        return

    # Already migrated
    if "CHECK" not in row["sql"]:
        return

    with write_lock:
        _conn.executescript(
            """
            ALTER TABLE messages
            RENAME TO messages_old;

            CREATE TABLE messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL
                    REFERENCES sessions(id)
                    ON DELETE CASCADE,

                role TEXT NOT NULL,

                content TEXT NOT NULL,

                sources TEXT,

                created_at TEXT NOT NULL DEFAULT (
                    STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
                )
            );

            INSERT INTO messages
            (
                id,
                session_id,
                role,
                content,
                sources,
                created_at
            )
            SELECT
                id,
                session_id,
                role,
                content,
                sources,
                created_at
            FROM messages_old;

            DROP TABLE messages_old;

            CREATE INDEX idx_messages_session_created
            ON messages(session_id, created_at);
            """
        )

        _conn.commit()