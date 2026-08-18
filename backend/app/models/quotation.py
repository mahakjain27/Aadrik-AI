from typing import Literal, Optional

from pydantic import BaseModel, Field


class QuotationItemRequest(BaseModel):
    product_name: str
    brand: Optional[str] = None
    size: Optional[str] = None
    quantity: str


class QuotationRequest(BaseModel):
    company_name: str
    contact_person: str
    phone: str
    email: Optional[str] = None

    items: list[QuotationItemRequest] = Field(min_length=1)

    delivery_city: str
    pincode: Optional[str] = None

    gst_number: Optional[str] = None
    notes: Optional[str] = None


class QuotationResponse(BaseModel):
    success: bool
    quotation_id: int
    message: str


class QuotationItemPricingRequest(BaseModel):
    item_id: int
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


class QuotationPricingRequest(BaseModel):
    # Every existing item on the quotation must be included in one call -
    # pricing is saved atomically, not per line item.
    items: list[QuotationItemPricingRequest] = Field(min_length=1)


class QuotationRejectRequest(BaseModel):
    reason: str
