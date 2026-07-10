import openai
from fastapi import HTTPException, status
from openai import OpenAI

from app.core.config import settings
from app.core.logging import setup_logger
from app.database import queries
from app.rag.retriever import retrieve
from app.services.session_service import resolve_session

client = OpenAI(
    base_url=settings.lm_studio_base_url,
    api_key="lm-studio",  # LM Studio ignores this value, but the SDK requires something non-empty
)

logger = setup_logger(__name__)

SYSTEM_PROMPT_TEMPLATE = """You are Aadrik AI.

You are the official AI assistant of Aadrik Distributors Pvt. Ltd.

You must answer ONLY from the supplied company knowledge.

Rules:

1. Never invent information.
2. If the answer exists in the company knowledge, answer clearly.
3. If only partial information exists, answer using only those facts.
4. If the answer cannot be found, reply exactly:

I don't have that information in the company knowledge base.

5. Keep answers concise and professional.
6. Use bullet points whenever appropriate.
7. Never mention the internal context or retrieved documents.

Pricing and quotations:

8. You must NEVER state, estimate, calculate, or imply a price, rate, or
   placeholder price (e.g. "₹ [Insert Price]") for any product, even if a
   price appears in the company knowledge.
9. You must NEVER ask the user for quantity, budget, or other pricing
   details in chat, and you must NEVER prepare or simulate a quotation
   yourself.
10. If the user asks for a price, rate, or quotation (e.g. "I want
    quotation", "need quote", "rate for X"), reply exactly with:

I'd be happy to help with your quotation request.

Please click "Request Quotation", or share the following details:
- Company Name
- Contact Person
- Phone Number
- Quantity Required
- Delivery City

Our sales team will prepare and share the quotation with you.

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
                "Knowledge base is unavailable right now. "
                "Make sure LM Studio is running and the vector store has "
                "been built (python build_rag.py)."
            ),
        ) from exc

    company_knowledge = "\n\n".join(doc.page_content for doc in docs)

    sources = []

    for doc in docs:
        source = doc.metadata.get("source", "Unknown")
        source = source.replace("\\", "/").split("/")[-1]

        if source not in sources:
            sources.append(source)

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(company_knowledge=company_knowledge)

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
        logger.info("Sending request to LM Studio")
        response = client.chat.completions.create(
            model=settings.lm_studio_chat_model,
            temperature=0.2,
            messages=messages,
        )
        logger.info("Received response from LM Studio")

    except openai.APITimeoutError as exc:
        logger.exception("LM Studio request timed out")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The AI service timed out. Please try again.",
        ) from exc

    except openai.APIConnectionError as exc:
        logger.exception("LM Studio request timed out")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Could not reach LM Studio. "
                f"Make sure it is running on {settings.lm_studio_base_url} "
                f"with {settings.lm_studio_chat_model} loaded."
            ),
        ) from exc

    except openai.APIStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service returned an error (status {exc.status_code}).",
        ) from exc

    reply_text = response.choices[0].message.content

    queries.insert_message(session_id, "assistant", reply_text, sources)
    queries.touch_session(session_id)

    logger.info(f"AI request completed successfully | session_id={session_id}")

    return {
        "reply": reply_text,
        "sources": sources,
        "session_id": session_id,
    }
