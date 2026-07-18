from pydantic import BaseModel


class AssignLeadRequest(BaseModel):
    assigned_to: int | None = None
