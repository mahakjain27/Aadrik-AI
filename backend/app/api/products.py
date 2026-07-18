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