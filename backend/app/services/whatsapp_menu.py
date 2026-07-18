"""
Builds WhatsApp interactive list messages from the product catalog, and
resolves a tapped row's id back to what it refers to.

Row ids are self-describing so no extra session state is needed to know
what stage of the menu a tap belongs to:
    cat|<category>
    subcat|<category>|<subcategory>
    product|<product id>

WhatsApp caps a single list message at 10 rows total across all sections,
and row titles/descriptions have their own length limits - see the
_truncate calls below.
"""

from app.services.product_service import get_catalog

MAX_ROWS = 10
ROW_TITLE_LIMIT = 24
ROW_DESCRIPTION_LIMIT = 72
SECTION_TITLE_LIMIT = 24


def _truncate(text: str, limit: int) -> str:
    text = text or ""
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def category_menu() -> dict:
    catalog = get_catalog()
    categories = catalog["categories"]

    rows = [
        {
            "id": f"cat|{category}",
            "title": _truncate(category, ROW_TITLE_LIMIT),
        }
        for category in categories[:MAX_ROWS]
    ]

    return {
        "header_text": "Aadrik AI",
        "body_text": "Which product category are you interested in?",
        "button_text": "Browse Categories",
        "sections": [{"title": "Categories", "rows": rows}],
    }


def _products_in_category(category: str) -> list[dict]:
    catalog = get_catalog()
    return [p for p in catalog["products"] if p["category"] == category]


def _dedupe_by_name(products: list[dict]) -> list[dict]:
    seen = set()
    result = []

    for p in products:
        if p["name"] in seen:
            continue

        seen.add(p["name"])
        result.append(p)

    return result


def _product_row(product: dict) -> dict:
    description = product.get("brand") or ""

    return {
        "id": f"product|{product['id']}",
        "title": _truncate(product["name"], ROW_TITLE_LIMIT),
        "description": _truncate(description, ROW_DESCRIPTION_LIMIT),
    }


def products_menu_for_category(category: str) -> dict | None:
    """Returns a list-message dict for `category`'s products, or a
    subcategory picker first if there are too many to fit in one list."""

    products = _dedupe_by_name(_products_in_category(category))

    if not products:
        return None

    if len(products) <= MAX_ROWS:
        return {
            "header_text": category,
            "body_text": f"Select a product from {category}:",
            "button_text": "View Products",
            "sections": [
                {
                    "title": _truncate(category, SECTION_TITLE_LIMIT),
                    "rows": [_product_row(p) for p in products],
                }
            ],
        }

    return subcategory_menu(category, products)


def subcategory_menu(category: str, products: list[dict]) -> dict | None:
    subcategories = []

    for p in products:
        sub = p.get("subcategory")
        if sub and sub not in subcategories:
            subcategories.append(sub)

    if not subcategories:
        # No subcategory to split by and still too many rows - show the
        # first MAX_ROWS products rather than nothing.
        return {
            "header_text": category,
            "body_text": f"Select a product from {category}:",
            "button_text": "View Products",
            "sections": [
                {
                    "title": _truncate(category, SECTION_TITLE_LIMIT),
                    "rows": [_product_row(p) for p in products[:MAX_ROWS]],
                }
            ],
        }

    rows = [
        {
            "id": f"subcat|{category}|{sub}",
            "title": _truncate(sub, ROW_TITLE_LIMIT),
        }
        for sub in subcategories[:MAX_ROWS]
    ]

    return {
        "header_text": category,
        "body_text": f"{category} has several types - which one?",
        "button_text": "Browse Types",
        "sections": [{"title": _truncate(category, SECTION_TITLE_LIMIT), "rows": rows}],
    }


def products_menu_for_subcategory(category: str, subcategory: str) -> dict | None:
    products = _dedupe_by_name(
        [p for p in _products_in_category(category) if p.get("subcategory") == subcategory]
    )

    if not products:
        return None

    return {
        "header_text": subcategory,
        "body_text": f"Select a product from {subcategory}:",
        "button_text": "View Products",
        "sections": [
            {
                "title": _truncate(subcategory, SECTION_TITLE_LIMIT),
                "rows": [_product_row(p) for p in products[:MAX_ROWS]],
            }
        ],
    }


def find_product(product_id: str) -> dict | None:
    catalog = get_catalog()

    for p in catalog["products"]:
        if p["id"] == product_id:
            return p

    return None
