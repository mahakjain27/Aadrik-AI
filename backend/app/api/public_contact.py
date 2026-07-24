from fastapi import APIRouter, HTTPException

from app.api.quotation import _insert_quotation
from app.core.rate_limit import is_rate_limited, record_attempt
from app.models.quotation import QuotationRequest
from app.schemas.contact import PublicContactRequest, PublicContactResponse
from app.services.activity_log import log_activity
from app.services.contact_notifications import send_contact_form_confirmation
from app.services.session_service import create_contact_session

router = APIRouter()

CONTACT_MAX_ATTEMPTS = 5
CONTACT_WINDOW_SECONDS = 3600


@router.post("/public/contact", response_model=PublicContactResponse)
def submit_contact_form(request: PublicContactRequest):
    """Unauthenticated contact-form submission from the public website.
    Creates two things staff already know how to work with, same as a
    WhatsApp quotation request does:
    - a Sales Inbox conversation (create_contact_session)
    - a CRM lead (_insert_quotation, reused as-is from quotation.py) so it
      shows up in the Dashboard/Leads table too. The contact form doesn't
      collect quantity/delivery_city, so those are left as "Not specified"
      rather than fabricated - honest placeholders, not guessed data."""

    rate_key = f"public_contact:{request.phone}"

    if is_rate_limited(rate_key, CONTACT_MAX_ATTEMPTS, CONTACT_WINDOW_SECONDS):
        raise HTTPException(
            status_code=429,
            detail="Too many submissions. Please try again in a little while.",
        )

    record_attempt(rate_key)

    create_contact_session(
        name=request.name,
        phone=request.phone,
        company=request.company,
        requirement=request.requirement,
        message=request.message,
    )

    quotation_request = QuotationRequest(
        company_name=request.company or request.name,
        contact_person=request.name,
        phone=request.phone,
        email=None,
        product_name=request.requirement or "General enquiry (see notes)",
        brand=None,
        size=None,
        quantity="Not specified",
        delivery_city="Not specified",
        pincode=None,
        gst_number=None,
        notes=request.message,
    )

    quotation_id = _insert_quotation(quotation_request, None, "website")

    log_activity(
        actor_id=None,
        action="lead.created",
        entity_type="quotation",
        entity_id=quotation_id,
        message=f"Website contact form submitted by {request.name} ({quotation_request.company_name}).",
    )

    send_contact_form_confirmation(request.name, request.phone)

    return PublicContactResponse(
        success=True,
        message="Thanks — we've received your message and will be in touch soon.",
    )
