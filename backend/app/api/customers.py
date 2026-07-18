from fastapi import APIRouter, Depends, Query

from app.middleware.auth import require_roles
from app.schemas.customer import CustomerResponse, UpdateCustomerRequest
from app.services import customer_service

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=list[CustomerResponse])
def list_customers(
    search: str | None = Query(None),
    current_user=Depends(require_roles("admin", "sales", "manager")),
):
    return customer_service.list_customers(search)


@router.get("/{customer_id}")
def get_customer(
    customer_id: int,
    current_user=Depends(require_roles("admin", "sales", "manager")),
):
    return customer_service.get_customer(customer_id)


@router.patch("/{customer_id}")
def update_customer(
    customer_id: int,
    request: UpdateCustomerRequest,
    current_user=Depends(require_roles("admin", "sales", "manager")),
):
    return customer_service.update_customer(customer_id, request, current_user)
