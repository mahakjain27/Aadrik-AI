import os
from pathlib import Path

from dotenv import load_dotenv

from app.core.logging import setup_logger

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=ENV_PATH)

logger = setup_logger(__name__)


class Settings:
    # --- App ---
    app_version: str = "1.0.0"

   
    # --- OpenAI ---
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_base_url: str = os.getenv(
        "OPENAI_BASE_URL",
        "https://api.openai.com/v1",
    )

    chat_model: str = os.getenv(
        "CHAT_MODEL",
        "gpt-4.1-mini",
    )

    embedding_model: str = os.getenv(
        "EMBEDDING_MODEL",
        "text-embedding-3-small",
    )
    # --- API auth ---
    api_key: str = os.getenv("AADRIK_API_KEY", "")

    # --- Authentication ---
    secret_key: str = os.getenv("SECRET_KEY", "")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )
    # "Remember me" logins get a long-lived token instead of the 60-minute
    # default, since without this a browser restart always logs the user
    # out no matter what they checked at login.
    access_token_expire_minutes_remembered: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES_REMEMBERED", str(60 * 24 * 30))
    )

    # --- CORS ---
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    # --- Retrieval ---
    retriever_k: int = int(os.getenv("RETRIEVER_K", "4"))

    # --- WhatsApp Business (Meta Cloud API) ---
    whatsapp_access_token: str = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    whatsapp_phone_number_id: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    whatsapp_business_account_id: str = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
    whatsapp_verify_token: str = os.getenv("WHATSAPP_VERIFY_TOKEN", "")

    # --- Public origin (used to build links sent to WhatsApp customers,
    # e.g. the ngrok tunnel URL during local testing) ---
    public_base_url: str = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")

settings = Settings()


def _startup_checks() -> None:
    """Fail loud, not silent. Printed once at import time so missing
    config shows up immediately in the terminal, not as a mystery 500
    the first time someone sends a chat message."""
    if not settings.api_key:
        logger.warning(
            "AADRIK_API_KEY is not set in backend/app/.env - "
            "the /chat endpoint currently has NO authentication."
        )
    if not settings.secret_key:
        logger.warning(
            "SECRET_KEY is not set. JWT authentication will not work."
        )
    if not settings.whatsapp_access_token or not settings.whatsapp_verify_token:
        logger.warning(
            "WHATSAPP_ACCESS_TOKEN / WHATSAPP_VERIFY_TOKEN are not set in "
            "backend/app/.env - the WhatsApp webhook will reject verification "
            "and outbound sends will fail."
        )
    if not settings.public_base_url:
        logger.warning(
            "PUBLIC_BASE_URL is not set in backend/app/.env - quotation form "
            "links sent to WhatsApp customers will be broken. Set it to the "
            "current ngrok URL (e.g. https://xxxx.ngrok-free.dev)."
        )


_startup_checks()
