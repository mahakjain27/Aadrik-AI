from fastapi import APIRouter, Depends

from app.middleware.auth import verify_api_key
from app.schemas.product import ProductCatalog
from app.services.product_service import get_catalog

router = APIRouter()


@router.get(
    "/products",
    response_model=ProductCatalog,
    dependencies=[Depends(verify_api_key)],
)
def get_products():
    return get_catalog()
