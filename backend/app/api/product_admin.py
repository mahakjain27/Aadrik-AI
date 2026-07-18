from fastapi import APIRouter, BackgroundTasks, Depends, Query

from app.middleware.auth import require_roles
from app.schemas.product import CreateProductRequest, ProductRecord, UpdateProductRequest
from app.services import product_admin_service
from app.services.product_knowledge_sync import sync_products_knowledge

router = APIRouter(prefix="/product-admin", tags=["Product Management"])

MANAGE_ROLES = ("admin", "manager")


@router.get("", response_model=list[ProductRecord])
def list_products(
    search: str | None = Query(None),
    category: str | None = Query(None),
    current_user=Depends(require_roles(*MANAGE_ROLES)),
):
    return product_admin_service.list_products(search, category)


@router.get("/{product_id}", response_model=ProductRecord)
def get_product(
    product_id: int,
    current_user=Depends(require_roles(*MANAGE_ROLES)),
):
    return product_admin_service.get_product(product_id)


@router.post("", response_model=ProductRecord)
def create_product(
    request: CreateProductRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_roles(*MANAGE_ROLES)),
):
    product = product_admin_service.create_product(request, current_user)
    background_tasks.add_task(sync_products_knowledge)
    return product


@router.put("/{product_id}", response_model=ProductRecord)
def update_product(
    product_id: int,
    request: UpdateProductRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_roles(*MANAGE_ROLES)),
):
    product = product_admin_service.update_product(product_id, request, current_user)
    background_tasks.add_task(sync_products_knowledge)
    return product


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_roles(*MANAGE_ROLES)),
):
    result = product_admin_service.delete_product(product_id, current_user)
    background_tasks.add_task(sync_products_knowledge)
    return result
