"""Decides which WhatsApp number (if any) a quotation should be sent to,
when the quotation's contact phone and the WhatsApp number that originally
opened its /quote link (source_whatsapp_phone) may differ.

Kept as pure decision logic - no DB/HTTP - so every case (same number,
different numbers, only one has a live conversation, neither does) is
unit-testable without mocking WhatsApp/email/the database. The caller
(quotation.py's /send endpoint) supplies a `has_session` callable so this
stays decoupled from how "does a conversation exist" is actually checked.
"""

from app.utils.phone import normalize_indian_phone


class InvalidWhatsappSelection(ValueError):
    """Raised when the frontend posts a whatsapp_phone that isn't one of
    this quotation's own numbers - never send to an arbitrary number."""


def resolve_whatsapp_destination(
    *,
    quotation_phone: str | None,
    source_whatsapp_phone: str | None,
    requested_phone: str | None,
    has_session,
) -> dict:
    """
    Returns a dict describing what to do:

    - target_phone: normalized phone to actually send to, or None if
      nothing should be sent yet (either no valid destination exists, or
      the caller must ask the salesperson to choose one first).
    - selection_required: True means don't send anything - surface
      `available_destinations` to the salesperson and wait for a
      follow-up call with `requested_phone` set.
    - number_mismatch: True when quotation_phone and source_whatsapp_phone
      are both present and genuinely different (after normalization).
    - available_destinations: normalized numbers that actually have a
      live WhatsApp conversation - only meaningful when selection_required.

    Raises InvalidWhatsappSelection if `requested_phone` doesn't match
    either of the quotation's own numbers.
    """

    quotation_norm = normalize_indian_phone(quotation_phone) if quotation_phone else None
    source_norm = normalize_indian_phone(source_whatsapp_phone) if source_whatsapp_phone else None

    candidates = []
    for phone in (quotation_norm, source_norm):
        if phone and phone not in candidates:
            candidates.append(phone)

    number_mismatch = quotation_norm is not None and source_norm is not None and quotation_norm != source_norm

    if requested_phone:
        chosen = normalize_indian_phone(requested_phone)
        if chosen not in candidates:
            raise InvalidWhatsappSelection(
                "Selected number is not associated with this quotation."
            )
        return {
            "target_phone": chosen,
            "selection_required": False,
            "number_mismatch": number_mismatch,
            "available_destinations": [],
        }

    if not number_mismatch:
        return {
            "target_phone": quotation_norm,
            "selection_required": False,
            "number_mismatch": False,
            "available_destinations": [],
        }

    available = [p for p in candidates if has_session(p)]

    if available:
        return {
            "target_phone": None,
            "selection_required": True,
            "number_mismatch": True,
            "available_destinations": available,
        }

    return {
        "target_phone": None,
        "selection_required": False,
        "number_mismatch": True,
        "available_destinations": [],
    }
