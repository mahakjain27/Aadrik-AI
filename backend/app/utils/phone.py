import re


def normalize_indian_phone(raw_phone: str) -> str:
    """Converts a loosely-typed Indian phone number (spaces, dashes, a
    leading +/0, with or without the 91 country code) into the
    digits-only, country-code-prefixed format WhatsApp's Cloud API expects
    (e.g. "919876543210"). Falls back to the digits as typed if the shape
    doesn't match a recognizable Indian number, since a best-effort send
    is safer here than raising on a form submission."""

    digits = re.sub(r"\D", "", raw_phone)

    if digits.startswith("91") and len(digits) == 12:
        return digits

    if len(digits) == 10:
        return f"91{digits}"

    if digits.startswith("0") and len(digits) == 11:
        return f"91{digits[1:]}"

    return digits
