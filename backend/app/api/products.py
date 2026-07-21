from fastapi import APIRouter, Depends

from app.middleware.auth import get_current_user
from app.schemas.product import ProductCatalog
from app.services.product_service import get_catalog

router = APIRouter()


@router.get(
    "/products",
    response_model=ProductCatalog,
)
def get_products(
    current_user=Depends(get_current_user),
):
    return get_catalog()


@router.get(
    "/public/products",
    response_model=ProductCatalog,
)
def get_public_products():
    """Unauthenticated catalog read for the public marketing site (mirrors
    /quotation/public's pattern). Same data as /products - get_catalog()
    already excludes pricing/cost fields, so there's nothing sensitive to
    gate behind login here."""

    return get_catalog()