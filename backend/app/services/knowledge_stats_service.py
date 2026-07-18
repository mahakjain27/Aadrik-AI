from app.database.connection import get_conn
from app.rag.pipeline import build_rag
from app.rag.vector_store import load_vector_store

# Existing hand-authored files that predate Knowledge Base Manager - counted
# read-only in the AI Sources breakdown (per the product decision: uploads
# are fully managed through this feature, these stay VS Code + git managed).
EXISTING_FILES_BY_CATEGORY = {
    "Company Information": ["company.md"],
    "Policies": ["policies.md", "dispatch_process.md", "quotation_process.md"],
    "FAQs": ["faq.md"],
}

SOURCE_CATEGORIES = (
    "Policies",
    "Catalogues",
    "Technical Datasheets",
    "FAQs",
    "Company Information",
)


def get_stats() -> dict:
    conn = get_conn()

    uploaded_counts = {
        row["category"]: row["n"]
        for row in conn.execute(
            "SELECT category, COUNT(*) AS n FROM knowledge_documents GROUP BY category"
        ).fetchall()
    }

    total_uploaded = sum(uploaded_counts.values())
    total_existing = sum(len(v) for v in EXISTING_FILES_BY_CATEGORY.values())

    products_count = conn.execute(
        "SELECT COUNT(*) AS n FROM products WHERE is_active = 1"
    ).fetchone()["n"]

    state = conn.execute(
        "SELECT last_rebuilt_at FROM knowledge_base_state WHERE id = 1"
    ).fetchone()

    try:
        chunk_count = load_vector_store()._collection.count()
    except Exception:
        chunk_count = None

    ai_sources = {"Products Database": products_count}

    for category in SOURCE_CATEGORIES:
        existing = len(EXISTING_FILES_BY_CATEGORY.get(category, []))
        ai_sources[category] = existing + uploaded_counts.get(category, 0)

    return {
        "total_documents": total_uploaded + total_existing,
        "uploaded_documents": total_uploaded,
        "chunk_count": chunk_count,
        "last_rebuilt_at": state["last_rebuilt_at"] if state else None,
        "ai_sources": ai_sources,
    }


def rebuild_knowledge_base() -> dict:
    build_rag()
    return get_stats()
