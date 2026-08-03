from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from app.services.catalog_feed_service import generate_catalog_csv

router = APIRouter()


@router.get("/catalog.csv")
def get_catalog_csv():
    """Unauthenticated CSV feed for Meta's Commerce Manager scheduled
    catalog upload (WhatsApp catalog). Must stay unauthenticated - Meta's
    feed fetcher can't send our x-api-key header."""

    return PlainTextResponse(generate_catalog_csv(), media_type="text/csv")
