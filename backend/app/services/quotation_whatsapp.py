"""Sends quotation PDFs as a WhatsApp document message, reusing the
customer's existing conversation. Only works if there's an open WhatsApp
session for the phone (i.e. the customer messaged us via WhatsApp) and
within Meta's 24h customer service window - see whatsapp_service.py."""

from app.core.logging import setup_logger
from app.services.whatsapp_service import send_whatsapp_document, upload_whatsapp_media

logger = setup_logger(__name__)


def send_quotation_whatsapp(
    phone: str,
    pdf_bytes: bytes,
    pdf_filename: str,
    quote_no: str,
    contact_person: str,
    grand_total: float | None,
) -> str | None:
    """Returns Meta's message id (wamid) if the PDF was actually delivered
    via WhatsApp, None otherwise. The wamid is persisted by the caller so a
    later delivery-status webhook can be matched back to this quotation."""

    media_id = upload_whatsapp_media(pdf_bytes, pdf_filename, "application/pdf")

    if media_id is None:
        return None

    total_line = f"\nTotal: Rs. {grand_total:.2f}" if grand_total is not None else ""

    caption = (
        f"Hello {contact_person},\n\n"
        f"Your quotation {quote_no} has been approved.{total_line}\n\n"
        "Please find it attached. Let us know if you have any questions.\n\n"
        "Thank you,\nAadrik Distributors Pvt. Ltd."
    )

    wamid = send_whatsapp_document(phone, media_id, pdf_filename, caption)

    if wamid is None:
        logger.error(f"WhatsApp document send failed | phone={phone} | quote_no={quote_no}")

    return wamid
