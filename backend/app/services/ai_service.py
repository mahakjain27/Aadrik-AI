import json

import openai
from fastapi import HTTPException, status
from openai import OpenAI

from app.core.config import settings
from app.core.logging import setup_logger
from app.database import queries
from app.database.queries import update_session_status
from app.rag.retriever import retrieve
from app.services.requirement_extraction import handle_requirement_message
from app.services.session_service import resolve_session

from functools import lru_cache

@lru_cache
def get_client():
    return OpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
    )

client = get_client()

logger = setup_logger(__name__)

AI_FALLBACK = "I don't have that information in the company knowledge base."

QUOTATION_PROMPT = (
    "I'd be happy to help with your quotation request.\n\n"
    'Please click "Request Quotation", or share the following details:\n'
    "- Company Name\n"
    "- Contact Person\n"
    "- Phone Number\n"
    "- Quantity Required\n"
    "- Delivery City\n\n"
    "Our sales team will prepare and share the quotation with you."
)

SYSTEM_PROMPT_TEMPLATE = """You are Aadrik AI.

You are the official AI assistant of Aadrik Distributors Pvt. Ltd.

You must answer ONLY from the supplied company knowledge.

Rules:

1. Never invent information.
2. If the answer exists in the company knowledge, answer clearly.
3. If only partial information exists, answer using only those facts.
4. The supplied company knowledge is retrieved by similarity search and
   may include chunks that are only superficially related (e.g. other
   welding products) but do NOT actually name the specific product,
   material, or brand the user asked about. Do not treat a superficially
   similar chunk as confirmation that the exact thing asked about is
   available. If the specific product/material/brand is not explicitly
   named in the company knowledge, that counts as "cannot be found."
5. If the answer cannot be found, reply exactly:

I don't have that information in the company knowledge base.

6. Keep answers concise and professional.
7. Use bullet points whenever appropriate.
8. Never mention the internal context or retrieved documents.

Pricing and quotations:

9. You must NEVER state, estimate, calculate, or imply a price, rate, or
   placeholder price (e.g. "₹ [Insert Price]") for any product, even if a
   price appears in the company knowledge.
10. You must NEVER ask the user for quantity, budget, or other pricing
    details in chat, and you must NEVER prepare or simulate a quotation
    yourself.
11. A question about whether a product exists, is manufactured, is
    carried/stocked, or its specifications (e.g. "do you manufacture
    X", "do you have X", "what sizes does X come in") is a product
    question, NOT a quotation request. Answer it from the company
    knowledge using rules 1-5 above, even if the answer is that the
    product isn't in the catalogue.
12. Only if the user asks for a price, rate, or quotation (e.g. "I want
    quotation", "need quote", "rate for X", "how much does X cost"),
    reply exactly with:

{quotation_prompt}

Company Knowledge:

{company_knowledge}
"""


def ask_ai(message: str, session_id: str | None, user_id: str) -> dict:
    # ---------------- Session + history ----------------
    logger.info(f"AI request received | user_id={user_id} | session_id={session_id}")
    session_id = resolve_session(session_id, user_id, message)
    history = queries.list_messages(session_id)

    # The user already sees their own message appear in the chat window
    # before the reply arrives, so persist it now - if the LLM call below
    # fails, the question isn't lost from the session's history.
    queries.insert_message(session_id, "user", message)

    return generate_ai_reply(session_id, message, history)


def generate_ai_reply(session_id: str, message: str, history: list) -> dict:
    """Generates and persists the assistant's reply for a message that the
    caller has already inserted into `session_id`. `history` must be the
    session's prior messages fetched BEFORE that insert (so it isn't
    duplicated - this function appends `message` itself when building the
    prompt). Shared by the internal AI Chat page and the WhatsApp webhook,
    so channel-specific concerns (session resolution, persisting the
    inbound message with its own metadata) stay with each caller."""

    # ---------------- Product requirement understanding ----------------
    # Shorthand order messages like "3.15 rasi 3 case 2.5 orbit 2 case"
    # never appear verbatim in the knowledge base for RAG's similarity
    # search to retrieve, so they'd otherwise always hit the generic
    # fallback. This deterministically parses + matches such messages
    # against the real product catalog before RAG gets involved at all;
    # it returns None (falls through to RAG below, unchanged) for any
    # message that isn't a product requirement.

    try:
        requirement_reply = handle_requirement_message(message, history)
    except Exception:
        logger.exception("Requirement extraction failed - falling back to RAG")
        requirement_reply = None

    if requirement_reply is not None:
        # A requirement can be mixed with an unrelated knowledge question
        # ("Need 3 cases Rasi 3.15. Also do you deliver to Bangalore?") -
        # best-effort answer that half too, but never let it block or
        # break the requirement reply itself.
        if "?" in message:
            try:
                docs = retrieve(message)
                company_knowledge = "\n\n".join(doc.page_content for doc in docs)
                rag_answer = client.chat.completions.create(
                    model=settings.chat_model,
                    temperature=0.2,
                    messages=[
                        {
                            "role": "system",
                            "content": SYSTEM_PROMPT_TEMPLATE.format(
                                company_knowledge=company_knowledge,
                                quotation_prompt=QUOTATION_PROMPT,
                            ),
                        },
                        {"role": "user", "content": message},
                    ],
                ).choices[0].message.content.strip()

                if rag_answer and rag_answer != AI_FALLBACK:
                    requirement_reply = f"{requirement_reply}\n\n{rag_answer}"
            except Exception:
                logger.exception("Mixed-message knowledge-question augmentation failed")

        queries.insert_message(session_id, "assistant", requirement_reply, [])
        update_session_status(session_id, "AI Handling")
        queries.touch_session(session_id)

        logger.info(f"AI request completed via product-requirement path | session_id={session_id}")

        return {"reply": requirement_reply, "sources": [], "session_id": session_id}

    # ---------------- Retrieval ----------------

    try:
        logger.info("Retrieving knowledge base documents")
        docs = retrieve(message)
        logger.info(f"Retrieved {len(docs)} documents")

    except Exception as exc:
        logger.exception("Knowledge base retrieval failed")

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The knowledge base is unavailable. Please rebuild the vector store and try again."
            ),
        ) from exc

    company_knowledge = "\n\n".join(doc.page_content for doc in docs)

    sources = []

    for doc in docs:
        source = doc.metadata.get("source", "Unknown")
        source = source.replace("\\", "/").split("/")[-1]

        if source not in sources:
            sources.append(source)

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        company_knowledge=company_knowledge,
        quotation_prompt=QUOTATION_PROMPT,
    )

    # ---------------- Conversation Memory ----------------

    messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    for msg in history:
        messages.append(
            {
                "role": msg["role"],
                "content": msg["content"],
            }
        )

    messages.append(
        {
            "role": "user",
            "content": message,
        }
    )

    # ---------------- Chat Completion ----------------

    try:
        logger.info("Sending request to OpenAI")
        response = client.chat.completions.create(
            model=settings.chat_model,
            temperature=0.2,
            messages=messages,
        )
        logger.info("Received response from OpenAI")

    except openai.APITimeoutError as exc:
        logger.exception("OpenAI request timed out")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The AI service timed out. Please try again.",
        ) from exc

    except openai.APIConnectionError as exc:
        logger.exception("LM Studio request timed out")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Could not reach OpenAI. "
                f"please check your OpenAI API key and internet connection."
                
            ),
        ) from exc

    except openai.APIStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service returned an error (status {exc.status_code}).",
        ) from exc

    reply_text = response.choices[0].message.content.strip()

    queries.insert_message(
        session_id,
        "assistant",
        reply_text,
        sources,
    )

    # Update conversation status
    if reply_text == AI_FALLBACK:
        update_session_status(
            session_id,
            "Waiting for Sales",
        )
    else:
        update_session_status(
            session_id,
            "AI Handling",
        )

    queries.touch_session(session_id)

    logger.info(
        f"AI request completed successfully | session_id={session_id}"
    )

    return {
        "reply": reply_text,
        "sources": sources,
        "session_id": session_id,
    }


ASSIST_ROLE_LABELS = {
    "user": "Customer",
    "assistant": "AI",
    "sales": "Sales rep",
}

ASSIST_SYSTEM_PROMPT = """You are a sales-assist copilot for Aadrik Distributors Pvt. Ltd.
staff. You are given a conversation transcript between a customer and the company (AI and/or
a salesperson). Produce:

1. "summary": 2-3 sentences a salesperson can read in a few seconds - who the customer is
   (if known), what they want, and where the conversation currently stands.
2. "suggested_reply": a short, professional draft reply the salesperson could send as-is or
   edit, addressing the customer's most recent message.

Rules:
- Never invent prices, discounts, stock levels, or policies that aren't stated in the
  transcript. If pricing is relevant but not yet discussed, the suggested reply should say
  the team will follow up with pricing rather than inventing a number.
- Base the summary and reply only on what is actually in the transcript.
- Respond with ONLY a JSON object: {"summary": "...", "suggested_reply": "..."}
"""


def generate_session_assist(session_id: str) -> dict:
    """On-demand AI assist for a Sales Inbox conversation: a short internal
    summary plus a draft reply for the rep to send or edit. Unlike
    generate_ai_reply, this is a scratch aid for staff, not the
    customer-facing assistant - nothing here is persisted to `messages`."""

    session = queries.get_session_by_id(session_id)

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    history = queries.list_messages(session_id)

    if not history:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This conversation has no messages yet.",
        )

    transcript = "\n".join(
        f"{ASSIST_ROLE_LABELS.get(msg['role'], msg['role'])}: {msg['content']}"
        for msg in history
    )

    messages = [
        {"role": "system", "content": ASSIST_SYSTEM_PROMPT},
        {"role": "user", "content": f"Conversation transcript:\n\n{transcript}"},
    ]

    try:
        logger.info(f"Requesting AI assist for session {session_id}")
        response = client.chat.completions.create(
            model=settings.chat_model,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=messages,
        )

    except openai.APITimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The AI service timed out. Please try again.",
        ) from exc

    except openai.APIConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the AI service. Please check the connection and try again.",
        ) from exc

    except openai.APIStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service returned an error (status {exc.status_code}).",
        ) from exc

    raw = response.choices[0].message.content

    try:
        parsed = json.loads(raw)
        summary = parsed["summary"]
        suggested_reply = parsed["suggested_reply"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        logger.exception(f"AI assist returned malformed JSON for session {session_id}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI service returned an unexpected response. Please try again.",
        ) from exc

    return {"summary": summary, "suggested_reply": suggested_reply}
