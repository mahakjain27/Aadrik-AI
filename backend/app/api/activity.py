from fastapi import APIRouter, Depends, Query

from app.middleware.auth import require_roles
from app.services.activity_log import delete_activity, list_activity

router = APIRouter(prefix="/activity", tags=["Activity"])


@router.get("")
def get_activity(
    limit: int = Query(50, le=200),
    current_user=Depends(require_roles("admin", "sales", "manager")),
):
    # Non-admins only ever see lead-related activity - user management
    # events (created/disabled/password reset/role changed) stay admin-only,
    # enforced here rather than just hidden in the UI.
    entity_types = None if current_user["role"] == "admin" else ["quotation"]

    return list_activity(entity_types=entity_types, limit=limit)


@router.delete("")
def clear_activity(
    older_than_days: int | None = Query(None, ge=1),
    current_user=Depends(require_roles("admin")),
):
    deleted = delete_activity(older_than_days=older_than_days)

    return {"deleted": deleted}
