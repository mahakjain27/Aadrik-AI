import httpx

from app.core.config import settings
from app.core.logging import setup_logger

logger = setup_logger(__name__)

GRAPH_API_VERSION = "v20.0"


def _post_message(payload: dict, to_phone: str) -> str | None:
    """Shared send path for every WhatsApp message type. Returns Meta's
    message id (wamid) if the message was accepted, None otherwise
    (missing config, HTTP error, or an error response body) - callers
    decide whether a failed send should block anything else, it never
    raises. The returned wamid is falsy-compatible with the old bool
    contract (`if sent:` / `if not sent:` still work), but callers that
    need to correlate a later delivery-status webhook (e.g. quotation
    sends) can keep the id itself.

    Note: Meta only allows freeform replies within 24h of the customer's
    last message; outside that window this call will fail and a
    pre-approved template message is required instead (not implemented).
    """

    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
        logger.warning(
            "Cannot send WhatsApp message - WHATSAPP_ACCESS_TOKEN / "
            "WHATSAPP_PHONE_NUMBER_ID are not configured."
        )
        return None

    url = (
        f"https://graph.facebook.com/{GRAPH_API_VERSION}/"
        f"{settings.whatsapp_phone_number_id}/messages"
    )

    try:
        response = httpx.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.whatsapp_access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15.0,
        )
    except httpx.HTTPError:
        logger.exception(f"WhatsApp send request failed | to={to_phone}")
        return None

    if response.status_code >= 400:
        logger.error(
            f"WhatsApp send rejected by Meta | to={to_phone} | "
            f"status={response.status_code} | body={response.text}"
        )
        return None

    wamid = (response.json().get("messages") or [{}])[0].get("id")

    logger.info(f"WhatsApp message sent | to={to_phone} | wamid={wamid}")
    return wamid


def send_whatsapp_message(to_phone: str, message: str) -> str | None:
    """Sends a freeform text message via the WhatsApp Cloud API."""

    return _post_message(
        {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "text",
            "text": {"body": message},
        },
        to_phone,
    )


def upload_whatsapp_media(file_bytes: bytes, filename: str, mime_type: str) -> str | None:
    """Uploads a file to Meta's media endpoint, returning a media id that
    can be referenced when sending a document message. Media ids expire
    after a few minutes, so upload and send should happen back-to-back."""

    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
        logger.warning(
            "Cannot upload WhatsApp media - WHATSAPP_ACCESS_TOKEN / "
            "WHATSAPP_PHONE_NUMBER_ID are not configured."
        )
        return None

    url = (
        f"https://graph.facebook.com/{GRAPH_API_VERSION}/"
        f"{settings.whatsapp_phone_number_id}/media"
    )

    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {settings.whatsapp_access_token}"},
            data={"messaging_product": "whatsapp"},
            files={"file": (filename, file_bytes, mime_type)},
            timeout=30.0,
        )
    except httpx.HTTPError:
        logger.exception("WhatsApp media upload request failed")
        return None

    if response.status_code >= 400:
        logger.error(
            f"WhatsApp media upload rejected by Meta | "
            f"status={response.status_code} | body={response.text}"
        )
        return None

    return response.json().get("id")


def send_whatsapp_document(to_phone: str, media_id: str, filename: str, caption: str) -> str | None:
    """Sends a previously-uploaded document (see upload_whatsapp_media) as
    a WhatsApp message. Only works within Meta's 24h customer service
    window - i.e. the customer needs to have messaged this number
    recently, same as any other freeform reply."""

    return _post_message(
        {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "document",
            "document": {
                "id": media_id,
                "filename": filename,
                "caption": caption,
            },
        },
        to_phone,
    )


def send_whatsapp_list_message(
    to_phone: str,
    header_text: str,
    body_text: str,
    button_text: str,
    sections: list[dict],
) -> str | None:
    """Sends an interactive list message (a native WhatsApp menu).

    `sections` follows Meta's format:
        [{"title": str, "rows": [{"id": str, "title": str, "description": str}]}]
    Meta caps this at 10 sections and 10 rows total across all sections -
    callers are responsible for staying within that (see whatsapp_menu.py).
    """

    return _post_message(
        {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "interactive",
            "interactive": {
                "type": "list",
                "header": {"type": "text", "text": header_text},
                "body": {"text": body_text},
                "action": {
                    "button": button_text,
                    "sections": sections,
                },
            },
        },
        to_phone,
    )
