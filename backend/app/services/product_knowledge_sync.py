"""Keeps knowledge_base/products.md (what AI chat actually reads) in sync
with the products table (what Product Management actually edits). These
were two disconnected sources before - editing a product here had zero
effect on what the AI told customers unless someone hand-edited the
markdown separately."""

from pathlib import Path

from app.core.logging import setup_logger
from app.database.connection import get_conn
from app.rag.pipeline import build_rag

logger = setup_logger(__name__)

BASE_DIR = Path(__file__).resolve().parents[3]
PRODUCTS_MD_PATH = BASE_DIR / "knowledge_base" / "products.md"


def _format_product(row) -> str:
    lines = [f"### {row['name']}"]

    facts = []
    if row["brand"]:
        facts.append(f"Brand: {row['brand']}")
    if row["grade"]:
        facts.append(f"Grade: {row['grade']}")
    if row["sizes"]:
        facts.append(f"Available sizes: {row['sizes']}")
    if row["packaging"]:
        facts.append(f"Packaging: {row['packaging']}")
    if row["selling_price"] is not None:
        facts.append(
            f"Price: Rs. {row['selling_price']:.2f} (GST {row['gst_percent']:.0f}%)"
        )
    facts.append(f"Stock status: {row['stock_status']}")
    if row["applications"]:
        facts.append(f"Applications: {row['applications']}")

    lines.append("\n".join(facts))

    if row["description"]:
        lines.append(row["description"])

    return "\n\n".join(lines)


def regenerate_products_markdown() -> None:
    conn = get_conn()

    rows = conn.execute(
        """
        SELECT name, brand, category, grade, sizes, packaging, applications,
               selling_price, gst_percent, stock_status, description
        FROM products
        WHERE is_active = 1
        ORDER BY category, name
        """
    ).fetchall()

    by_category: dict[str, list] = {}
    for row in rows:
        by_category.setdefault(row["category"] or "Other", []).append(row)

    sections = ["# Products"]

    for category, items in by_category.items():
        sections.append(f"## {category}")
        sections.extend(_format_product(row) for row in items)

    PRODUCTS_MD_PATH.write_text("\n\n".join(sections) + "\n", encoding="utf-8")


def sync_products_knowledge() -> None:
    """Regenerates products.md and rebuilds the vector store. Meant to run
    as a background task - re-embedding takes several seconds and
    shouldn't block the admin's save request. Swallows its own errors so a
    knowledge-base hiccup never surfaces as a failed product save."""

    try:
        regenerate_products_markdown()
        build_rag()
    except Exception:
        logger.exception("Failed to sync product knowledge base after a product change")
