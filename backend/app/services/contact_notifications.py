"""Confirms a website contact-form submission over WhatsApp. Uses a
template (see whatsapp_service.send_whatsapp_template) rather than a
freeform message because the submitter typically has no open WhatsApp
session with the business number."""

from app.core.config import settings
from app.core.logging import setup_logger
from app.services.whatsapp_service import send_whatsapp_template
from app.utils.phone import normalize_indian_phone

logger = setup_logger(__name__)


def send_contact_form_confirmation(name: str, phone: str) -> str | None:
    """Best-effort send - returns the wamid on success, None on any
    failure (missing config, template not yet approved, bad number, etc).
    Never raises, so a WhatsApp outage can't break contact-form submission."""

    wamid = send_whatsapp_template(
        normalize_indian_phone(phone),
        settings.whatsapp_contact_template_name,
        settings.whatsapp_contact_template_lang,
        body_params=[name],
    )

    if wamid is None:
        logger.warning(f"Contact-form WhatsApp confirmation not sent | phone={phone}")

    return wamid
