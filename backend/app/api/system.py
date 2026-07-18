import time

import httpx
from fastapi import APIRouter, Depends

from app.core.config import settings
from app.core.logging import setup_logger
from app.database.connection import get_conn
from app.middleware.auth import get_current_user
from app.rag.embedder import client as ai_client
from app.services.whatsapp_service import GRAPH_API_VERSION

router = APIRouter(prefix="/system", tags=["System"])

logger = setup_logger(__name__)


def _check_database() -> dict:
    started = time.perf_counter()

    try:
        get_conn().execute("SELECT 1").fetchone()
    except Exception:
        logger.exception("Database health check failed")
        return {"status": "error"}

    return {
        "status": "connected",
        "response_ms": round((time.perf_counter() - started) * 1000),
    }


def _check_ai() -> dict:
    started = time.perf_counter()

    try:
        ai_client.with_options(timeout=3.0).models.list()
    except Exception:
        return {"status": "unreachable"}

    return {
        "status": "running",
        "response_ms": round((time.perf_counter() - started) * 1000),
    }


def _check_whatsapp() -> dict:
    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
        return {"status": "not_configured"}

    url = (
        f"https://graph.facebook.com/{GRAPH_API_VERSION}/"
        f"{settings.whatsapp_phone_number_id}"
    )

    try:
        response = httpx.get(
            url,
            params={"fields": "verified_name"},
            headers={"Authorization": f"Bearer {settings.whatsapp_access_token}"},
            timeout=5.0,
        )
    except httpx.HTTPError:
        return {"status": "unreachable"}

    if response.status_code >= 400:
        return {"status": "unreachable"}

    return {"status": "connected"}


def _check_knowledge_base() -> dict:
    try:
        from app.rag.vector_store import load_vector_store

        count = load_vector_store()._collection.count()
    except Exception:
        logger.exception("Knowledge base health check failed")
        return {"status": "error", "documents": None}

    return {"status": "ready", "documents": count}


@router.get("/health")
def health(current_user=Depends(get_current_user)):
    return {
        "version": settings.app_version,
        "database": _check_database(),
        "ai": _check_ai(),
        "whatsapp": _check_whatsapp(),
        "knowledge_base": _check_knowledge_base(),
    }
