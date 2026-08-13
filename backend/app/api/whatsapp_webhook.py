from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from app.core.config import settings
from app.core.logging import setup_logger
from app.database import queries
from app.services.ai_service import QUOTATION_PROMPT, generate_ai_reply
from app.services.session_service import resolve_whatsapp_session
from app.services.whatsapp_menu import (
    category_menu,
    find_product,
    products_menu_for_category,
    products_menu_for_subcategory,
)
from app.services.whatsapp_service import send_whatsapp_list_message, send_whatsapp_message

logger = setup_logger(__name__)

router = APIRouter()

# Plain-text shortcuts that jump straight to the product menu, bypassing the
# AI entirely - the whole point is to make requesting a quotation faster
# than typing details out in chat.
MENU_KEYWORDS = {"menu", "catalog", "catalogue", "products", "quote", "quotation"}

# A WhatsApp conversation is one long-running session that's rarely ever
# "new" again once it's been used once, so gate the greeting+menu combo on
# the customer's message looking like a greeting rather than on session
# history being empty - that's the moment they're re-entering the
# conversation and most likely to want the menu.
GREETINGS = {
    "hi", "hii", "hiii", "hello", "helo", "hey", "heyy",
    "good morning", "good afternoon", "good evening",
}

# Small-model replies to the "reply exactly with QUOTATION_PROMPT" rule
# aren't always byte-identical, so detect it by its distinctive phrase
# rather than exact equality.
QUOTATION_PROMPT_MARKER = "Request Quotation"


@router.get("/webhook/whatsapp")
def verify_webhook(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        return PlainTextResponse(hub_challenge)

    raise HTTPException(status_code=403, detail="Verification failed.")


@router.post("/webhook/whatsapp")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    payload = await request.json()

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})

            # Meta sends the sender's own WhatsApp display name alongside
            # the message, keyed by their wa_id (same value as "from" on
            # the message itself) - not the sender's phone number field.
            contact_names = {
                contact["wa_id"]: contact["profile"]["name"]
                for contact in value.get("contacts", [])
                if contact.get("wa_id") and contact.get("profile", {}).get("name")
            }

            for message in value.get("messages", []):
                contact_name = contact_names.get(message.get("from"))
                _handle_incoming_message(message, background_tasks, contact_name)

            for status_update in value.get("statuses", []):
                _handle_status_update(status_update)

    # Always 200: Meta retries the whole delivery on a non-2xx response.
    return {"status": "ok"}


# Meta's terminal delivery states for an outbound message, in the order
# they're expected to arrive (sent -> delivered -> read, or -> failed).
# Only quotation sends are tracked today (see queries.update_quotation_whatsapp_status
# below); statuses for any other outbound message just no-op.
_TRACKED_STATUSES = {"sent", "delivered", "read", "failed"}


def _handle_status_update(status_update: dict) -> None:
    wamid = status_update.get("id")
    status = status_update.get("status")

    if not wamid or status not in _TRACKED_STATUSES:
        return

    queries.update_quotation_whatsapp_status(wamid, status)


def _handle_incoming_message(
    message: dict, background_tasks: BackgroundTasks, contact_name: str | None = None
) -> None:
    wamid = message.get("id")
    phone = message.get("from")
    msg_type = message.get("type")

    if not phone:
        logger.info(f"Skipping WhatsApp message with no sender | wamid={wamid}")
        return

    if wamid and queries.message_exists_by_wamid(wamid):
        logger.info(f"Ignoring duplicate WhatsApp webhook delivery | wamid={wamid}")
        return

    if msg_type == "interactive":
        _handle_interactive_reply(message, phone, wamid, contact_name)
        return

    if msg_type != "text":
        logger.info(f"Skipping unsupported WhatsApp message type '{msg_type}' | wamid={wamid}")
        return

    text = (message.get("text", {}).get("body") or "").strip()

    if not text:
        return

    session_id = resolve_whatsapp_session(phone, text, contact_name)

    if text.lower() in MENU_KEYWORDS:
        queries.insert_message(session_id, "user", text, wamid=wamid)
        _send_category_menu(session_id, phone)
        return

    history = queries.list_messages(session_id)
    queries.insert_message(session_id, "user", text, wamid=wamid)

    # Acknowledge the webhook fast - LM Studio inference plus the outbound
    # send can take several seconds, longer than Meta waits before treating
    # this delivery as failed and retrying it.
    background_tasks.add_task(_reply_and_send, session_id, text, history, phone)


def _handle_interactive_reply(
    message: dict, phone: str, wamid: str | None, contact_name: str | None = None
) -> None:
    interactive = message.get("interactive", {})

    if interactive.get("type") != "list_reply":
        logger.info(f"Skipping unsupported interactive type | wamid={wamid}")
        return

    list_reply = interactive["list_reply"]
    row_id = list_reply["id"]
    row_title = list_reply.get("title", row_id)

    session_id = resolve_whatsapp_session(phone, row_title, contact_name)
    queries.insert_message(session_id, "user", f"Selected: {row_title}", wamid=wamid)

    parts = row_id.split("|")
    kind = parts[0]

    if kind == "cat" and len(parts) == 2:
        _send_products_menu(session_id, phone, category=parts[1])
    elif kind == "subcat" and len(parts) == 3:
        _send_subcategory_products_menu(session_id, phone, category=parts[1], subcategory=parts[2])
    elif kind == "product" and len(parts) == 2:
        _send_product_link(session_id, phone, product_id=parts[1])
    else:
        logger.warning(f"Unrecognized WhatsApp list reply id: {row_id}")


def _send_category_menu(session_id: str, phone: str) -> None:
    _send_menu(session_id, phone, category_menu())


def _send_products_menu(session_id: str, phone: str, category: str) -> None:
    menu = products_menu_for_category(category)

    if menu is None:
        send_whatsapp_message(phone, "Sorry, no products found in that category.")
        return

    _send_menu(session_id, phone, menu)


def _send_subcategory_products_menu(session_id: str, phone: str, category: str, subcategory: str) -> None:
    menu = products_menu_for_subcategory(category, subcategory)

    if menu is None:
        send_whatsapp_message(phone, "Sorry, no products found in that category.")
        return

    _send_menu(session_id, phone, menu)


def _send_menu(session_id: str, phone: str, menu: dict) -> None:
    sent = send_whatsapp_list_message(
        phone,
        menu["header_text"],
        menu["body_text"],
        menu["button_text"],
        menu["sections"],
    )

    if sent:
        queries.insert_message(session_id, "assistant", menu["body_text"])
        queries.touch_session(session_id)


def _send_product_link(session_id: str, phone: str, product_id: str) -> None:
    product = find_product(product_id)

    if product is None:
        send_whatsapp_message(phone, "Sorry, that product could not be found.")
        return

    if not settings.public_base_url:
        logger.warning("PUBLIC_BASE_URL is not set - cannot build a /quote link for WhatsApp.")
        send_whatsapp_message(
            phone,
            "Sorry, quotation requests aren't available right now. Our sales team will reach out shortly.",
        )
        return

    link = f"{settings.public_base_url}/quote?product={product_id}&phone={phone}"
    reply = (
        f'Great choice! To request a quotation for "{product["name"]}", '
        f"please fill out this quick form:\n{link}"
    )

    sent = send_whatsapp_message(phone, reply)

    if sent:
        queries.insert_message(session_id, "assistant", reply)
        queries.touch_session(session_id)


def _reply_and_send(session_id: str, message: str, history: list, phone: str) -> None:
    try:
        result = generate_ai_reply(session_id, message, history)
    except Exception:
        logger.exception(f"AI reply generation failed for WhatsApp session {session_id}")
        return

    if QUOTATION_PROMPT_MARKER in result["reply"]:
        _send_category_menu(session_id, phone)
        return

    if not history or message.strip().lower().rstrip("!.") in GREETINGS:
        # Fresh conversation, or the customer just said "hi" - either way
        # they're re-entering the chat, so pair the AI's reply with the
        # category browser instead of making them type "menu" separately.
        _send_reply_with_menu(phone, result["reply"])
        return

    send_whatsapp_message(phone, result["reply"])


def _send_reply_with_menu(phone: str, reply_text: str) -> None:
    menu = category_menu()

    sent = send_whatsapp_list_message(
        phone,
        menu["header_text"],
        reply_text,
        menu["button_text"],
        menu["sections"],
    )

    if not sent:
        # Body text too long for a list message, or the send otherwise
        # failed - the customer should still get an answer.
        send_whatsapp_message(phone, reply_text)
