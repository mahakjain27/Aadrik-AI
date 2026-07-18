from app.core.logging import setup_logger
from app.database.connection import get_conn

logger = setup_logger(__name__)


def _split(value: str | None) -> list[str]:
    return [part for part in (value or "").split(",") if part]


def _to_catalog_product(row) -> dict:
    """Maps a products-table row to the shape whatsapp_menu.py,
    public_quote.py, and the frontend catalog already expect (mirrors
    data/products.json's product shape, with `slug` exposed as `id`)."""

    return {
        "id": row["slug"],
        "category": row["category"],
        "subcategory": row["subcategory"],
        "name": row["name"],
        "brand": row["brand"],
        "grade": row["grade"],
        "sizes": _split(row["sizes"]),
        "packing": _split(row["packaging"]),
        "applications": _split(row["applications"]),
    }


def get_catalog() -> dict:
    """Live read of the products table (not cached - products are editable
    via Product Management, so a stale in-process cache would show sales
    reps and the WhatsApp menu outdated data after every edit)."""

    conn = get_conn()

    rows = conn.execute(
        """
        SELECT slug, category, subcategory, name, brand, grade, sizes, packaging, applications
        FROM products
        WHERE is_active = 1
        ORDER BY category, name
        """
    ).fetchall()

    products = [_to_catalog_product(row) for row in rows]

    categories = sorted({p["category"] for p in products if p["category"]})
    brands = sorted({p["brand"] for p in products if p["brand"]})

    return {
        "categories": categories,
        "brands": brands,
        "products": products,
    }
