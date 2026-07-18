from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.database import queries
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class DismissRequest(BaseModel):
    keys: list[str]


@router.get("/dismissed")
def get_dismissed(current_user=Depends(get_current_user)):
    return {"keys": list(queries.list_dismissed_notification_keys(current_user["id"]))}


@router.post("/dismiss")
def dismiss(body: DismissRequest, current_user=Depends(get_current_user)):
    queries.dismiss_notifications(current_user["id"], body.keys)

    return {"success": True}
