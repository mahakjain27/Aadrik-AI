from pydantic import BaseModel


class UpdateCustomerRequest(BaseModel):
    company_name: str
    contact_person: str | None = None
    email: str | None = None
    gst_number: str | None = None
    city: str | None = None
    assigned_to: int | None = None
    notes: str | None = None
    tags: str | None = None


class CustomerResponse(BaseModel):
    id: int
    phone: str
    company_name: str
    contact_person: str | None = None
    email: str | None = None
    gst_number: str | None = None
    city: str | None = None
    assigned_to: int | None = None
    assigned_to_name: str | None = None
    notes: str | None = None
    tags: str | None = None
    total_quotations: int
    last_contact: str | None = None
    created_at: str
