from typing import Optional

from pydantic import BaseModel


class QuotationRequest(BaseModel):
    company_name: str
    contact_person: str
    phone: str
    email: Optional[str] = None

    product_name: str
    brand: Optional[str] = None
    size: Optional[str] = None

    quantity: str

    delivery_city: str
    pincode: str

    gst_number: Optional[str] = None


class QuotationResponse(BaseModel):
    success: bool
    quotation_id: int
    message: str
