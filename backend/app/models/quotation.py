from typing import Literal, Optional

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

    # Normal discount: either a percentage or a flat Rs amount, never both -
    # discount_type says which of the two fields below is active.
    discount_type: Literal["percent", "amount"] = "percent"
    discount_percent: float = 0.0
    discount_amount: float = 0.0

    # Special discount: a percentage AND a flat Rs amount, both can apply
    # on top of the normal discount.
    special_discount_percent: float = 0.0
    special_discount_amount: float = 0.0


class QuotationRejectRequest(BaseModel):
    reason: str
