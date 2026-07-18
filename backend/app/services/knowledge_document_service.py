import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.database.connection import get_conn, write_lock
from app.schemas.knowledge_document import CATEGORIES
from app.services.activity_log import log_activity

BASE_DIR = Path(__file__).resolve().parents[3]
UPLOADS_DIR = BASE_DIR / "knowledge_base" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "md"}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024

MEDIA_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
    "md": "text/markdown",
}


def _row_to_dict(row) -> dict:
    return dict(row)


async def upload_document(file: UploadFile, category: str, current_user) -> dict:
    if category not in CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category must be one of: {', '.join(CATEGORIES)}.",
        )

    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, DOCX, TXT, and Markdown files are supported.",
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty.",
        )

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is larger than the 20 MB limit.",
        )

    # Stored under a random name, never the original filename - avoids path
    # traversal and collisions; the human-readable name lives only in the DB.
    stored_name = f"{uuid.uuid4().hex}.{ext}"
    (UPLOADS_DIR / stored_name).write_bytes(content)

    conn = get_conn()

    with write_lock:
        cursor = conn.execute(
            """
            INSERT INTO knowledge_documents
            (filename, storage_path, file_type, category, file_size, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (filename, stored_name, ext, category, len(content), current_user["id"]),
        )

        conn.commit()

    document_id = cursor.lastrowid

    log_activity(
        actor_id=current_user["id"],
        action="knowledge_document.uploaded",
        entity_type="knowledge_document",
        entity_id=document_id,
        message=f"{current_user['name']} uploaded \"{filename}\" to {category}.",
    )

    return get_document(document_id)


def list_documents(category: str | None = None) -> list[dict]:
    conn = get_conn()

    query = """
        SELECT knowledge_documents.*, users.name AS uploaded_by_name
        FROM knowledge_documents
        LEFT JOIN users ON users.id = knowledge_documents.uploaded_by
    """
    params: list = []

    if category:
        query += " WHERE category = ?"
        params.append(category)

    query += " ORDER BY uploaded_at DESC"

    rows = conn.execute(query, params).fetchall()

    return [_row_to_dict(row) for row in rows]


def get_document(document_id: int) -> dict:
    conn = get_conn()

    row = conn.execute(
        """
        SELECT knowledge_documents.*, users.name AS uploaded_by_name
        FROM knowledge_documents
        LEFT JOIN users ON users.id = knowledge_documents.uploaded_by
        WHERE knowledge_documents.id = ?
        """,
        (document_id,),
    ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    return _row_to_dict(row)


def get_document_path(document_id: int) -> tuple[dict, Path]:
    document = get_document(document_id)
    path = UPLOADS_DIR / document["storage_path"]

    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file is missing on disk.",
        )

    return document, path


def delete_document(document_id: int, current_user) -> dict:
    document, path = get_document_path(document_id)

    conn = get_conn()

    with write_lock:
        conn.execute("DELETE FROM knowledge_documents WHERE id = ?", (document_id,))
        conn.commit()

    path.unlink(missing_ok=True)

    log_activity(
        actor_id=current_user["id"],
        action="knowledge_document.deleted",
        entity_type="knowledge_document",
        entity_id=document_id,
        message=f"{current_user['name']} removed \"{document['filename']}\" from the knowledge base.",
    )

    return {"success": True, "message": "Document removed."}


def extract_preview_text(document_id: int, max_chars: int = 4000) -> str:
    """Plain-text preview for TXT/MD/DOCX. PDFs are previewed by the browser
    natively (see the /file endpoint) rather than through this."""

    document, path = get_document_path(document_id)
    file_type = document["file_type"]

    if file_type in ("txt", "md"):
        text = path.read_text(encoding="utf-8", errors="replace")
    elif file_type == "docx":
        import docx as docx_lib

        doc = docx_lib.Document(str(path))
        text = "\n".join(p.text for p in doc.paragraphs)
    else:
        text = ""

    return text[:max_chars]
