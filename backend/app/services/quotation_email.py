"""
Sends quotation PDFs by email. Not wired to a real SMTP account yet — this is
a stub so the approval workflow can be built and tested end-to-end now.

To go live: add SMTP_HOST/SMTP_PORT/SMTP_USERNAME/SMTP_PASSWORD/SMTP_FROM to
app/core/config.py (read from environment variables, never hardcoded), then
replace the body of send_quotation_email with a real smtplib/aiosmtplib send
using those settings. Nothing else in the approval workflow needs to change.
"""

from app.core.logging import setup_logger

logger = setup_logger(__name__)


def send_quotation_email(
    to_email: str,
    subject: str,
    pdf_bytes: bytes,
    pdf_filename: str,
) -> bool:
    """Returns True if an email was actually sent. Currently always a stub."""

    logger.info(
        f"quotation_email stub: would send '{subject}' to {to_email} "
        f"({len(pdf_bytes)} PDF bytes as {pdf_filename}) — SMTP not configured."
    )

    return False
