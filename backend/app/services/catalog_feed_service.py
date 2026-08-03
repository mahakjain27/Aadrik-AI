import csv
import io
from urllib.parse import quote

from app.constants.category_images import CATEGORY_IMAGE_PATHS, DEFAULT_CATEGORY_IMAGE_PATH
from app.core.config import settings
from app.database.connection import get_conn

# Meta only accepts these three availability values for a commerce catalog.
_AVAILABILITY_BY_STOCK_STATUS = {
    "In Stock": "in stock",
    "Low Stock": "in stock",
    "Out of Stock": "out of stock",
}

# Some Meta catalog types require a non-zero price even when the merchant
# doesn't sell at listed prices (customers here request a quote instead of
# checking out) - this placeholder satisfies that validation without
# implying a real transactable price.
_PLACEHOLDER_PRICE = "0.01 INR"

CSV_FIELDS = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "brand",
]


def _split(value: str | None) -> list[str]:
    return [part for part in (value or "").split(",") if part]


def _build_description(row) -> str:
    parts = []
    if row["subcategory"]:
        parts.append(row["subcategory"])
    if row["grade"]:
        parts.append(f"Grade: {row['grade']}")
    sizes = _split(row["sizes"])
    if sizes:
        parts.append(f"Available sizes: {', '.join(sizes)}")
    applications = _split(row["applications"])
    if applications:
        parts.append(f"Applications: {', '.join(applications)}")
    return " | ".join(parts) or row["name"]


def _category_link(category: str | None) -> str:
    if not category:
        return f"{settings.site_base_url}/products"
    return f"{settings.site_base_url}/products?category={quote(category)}"


def _category_image_link(category: str | None) -> str:
    path = CATEGORY_IMAGE_PATHS.get(category, DEFAULT_CATEGORY_IMAGE_PATH)
    return f"{settings.site_base_url}{path}"


def generate_catalog_csv() -> str:
    """Builds a Meta commerce-catalog CSV feed live from the products
    table, one row per active product. Products don't have per-SKU photos
    or individual landing pages yet, so `link`/`image_link` point at the
    product's category page/photo instead (see category_images.py) -
    customers land on a filtered product list and request a quote from
    there rather than checking out, which is why `price` is a fixed
    placeholder rather than a real one."""

    conn = get_conn()

    rows = conn.execute(
        """
        SELECT slug, name, brand, category, subcategory, grade, sizes,
               applications, stock_status
        FROM products
        WHERE is_active = 1
        ORDER BY category, name
        """
    ).fetchall()

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_FIELDS)
    writer.writeheader()

    for row in rows:
        writer.writerow(
            {
                "id": row["slug"],
                "title": row["name"],
                "description": _build_description(row),
                "availability": _AVAILABILITY_BY_STOCK_STATUS.get(
                    row["stock_status"], "out of stock"
                ),
                "condition": "new",
                "price": _PLACEHOLDER_PRICE,
                "link": _category_link(row["category"]),
                "image_link": _category_image_link(row["category"]),
                "brand": row["brand"] or "Aadrik Distributors",
            }
        )

    return buffer.getvalue()
