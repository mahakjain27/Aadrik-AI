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
    pincode: Optional[str] = None

    gst_number: Optional[str] = None
    notes: Optional[str] = None


class QuotationResponse(BaseModel):
    success: bool
    quotation_id: int
    message: str


class QuotationPricingRequest(BaseModel):
    unit_price: float
    gst_percent: float = 18.0


class QuotationRejectRequest(BaseModel):
    reason: str
