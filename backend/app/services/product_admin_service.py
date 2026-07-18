import re

from fastapi import HTTPException, status

from app.database.connection import get_conn, write_lock
from app.schemas.product import CreateProductRequest, UpdateProductRequest
from app.services.activity_log import log_activity

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(brand: str | None, name: str) -> str:
    base = f"{brand or ''} {name}".strip().lower()
    base = _SLUG_RE.sub("-", base).strip("-")
    return base or "product"


def _unique_slug(conn, brand: str | None, name: str, exclude_id: int | None = None) -> str:
    base = _slugify(brand, name)
    slug = base
    n = 2

    while True:
        row = conn.execute(
            "SELECT id FROM products WHERE slug = ?",
            (slug,),
        ).fetchone()

        if row is None or row["id"] == exclude_id:
            return slug

        slug = f"{base}-{n}"
        n += 1


def _row_to_record(row) -> dict:
    record = dict(row)
    record["sizes"] = [s for s in (record["sizes"] or "").split(",") if s]
    record["packaging"] = [s for s in (record["packaging"] or "").split(",") if s]
    record["applications"] = [s for s in (record["applications"] or "").split(",") if s]
    record["is_active"] = bool(record["is_active"])
    return record


def list_products(search: str | None = None, category: str | None = None):
    conn = get_conn()

    query = "SELECT * FROM products WHERE 1=1"
    params: list = []

    if search:
        query += " AND (name LIKE ? OR brand LIKE ? OR slug LIKE ?)"
        like = f"%{search}%"
        params += [like, like, like]

    if category:
        query += " AND category = ?"
        params.append(category)

    query += " ORDER BY category, name"

    rows = conn.execute(query, params).fetchall()

    return [_row_to_record(row) for row in rows]


def get_product(product_id: int):
    conn = get_conn()

    row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    return _row_to_record(row)


def create_product(request: CreateProductRequest, current_user):
    conn = get_conn()
    slug = _unique_slug(conn, request.brand, request.name)

    with write_lock:
        cursor = conn.execute(
            """
            INSERT INTO products
            (slug, name, brand, category, subcategory, grade, sizes, packaging,
             applications, mrp, selling_price, gst_percent, stock_status, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                slug,
                request.name,
                request.brand,
                request.category,
                request.subcategory,
                request.grade,
                ",".join(request.sizes),
                ",".join(request.packaging),
                ",".join(request.applications),
                request.mrp,
                request.selling_price,
                request.gst_percent,
                request.stock_status,
                request.description,
            ),
        )

        conn.commit()

    product_id = cursor.lastrowid

    log_activity(
        actor_id=current_user["id"],
        action="product.created",
        entity_type="product",
        entity_id=product_id,
        message=f"{current_user['name']} added product {request.name}.",
    )

    return get_product(product_id)


def update_product(product_id: int, request: UpdateProductRequest, current_user):
    conn = get_conn()

    existing = conn.execute(
        "SELECT id FROM products WHERE id = ?",
        (product_id,),
    ).fetchone()

    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    with write_lock:
        conn.execute(
            """
            UPDATE products
            SET name = ?, brand = ?, category = ?, subcategory = ?, grade = ?,
                sizes = ?, packaging = ?, applications = ?, mrp = ?,
                selling_price = ?, gst_percent = ?, stock_status = ?,
                description = ?, is_active = ?
            WHERE id = ?
            """,
            (
                request.name,
                request.brand,
                request.category,
                request.subcategory,
                request.grade,
                ",".join(request.sizes),
                ",".join(request.packaging),
                ",".join(request.applications),
                request.mrp,
                request.selling_price,
                request.gst_percent,
                request.stock_status,
                request.description,
                int(request.is_active),
                product_id,
            ),
        )

        conn.commit()

    log_activity(
        actor_id=current_user["id"],
        action="product.updated",
        entity_type="product",
        entity_id=product_id,
        message=f"{current_user['name']} updated product {request.name}.",
    )

    return get_product(product_id)


def delete_product(product_id: int, current_user):
    """Soft delete: deactivates rather than removes, since existing
    quotations reference products by free-text name/brand, not a foreign
    key, and shouldn't have their history disturbed."""

    conn = get_conn()

    existing = conn.execute(
        "SELECT name FROM products WHERE id = ?",
        (product_id,),
    ).fetchone()

    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    with write_lock:
        conn.execute(
            "UPDATE products SET is_active = 0 WHERE id = ?",
            (product_id,),
        )

        conn.commit()

    log_activity(
        actor_id=current_user["id"],
        action="product.deleted",
        entity_type="product",
        entity_id=product_id,
        message=f"{current_user['name']} removed product {existing['name']}.",
    )

    return {"success": True, "message": "Product removed."}
