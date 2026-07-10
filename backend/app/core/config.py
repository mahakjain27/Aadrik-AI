import os
from pathlib import Path

from dotenv import load_dotenv

from app.core.logging import setup_logger

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"

load_dotenv(dotenv_path=ENV_PATH)

logger = setup_logger(__name__)


class Settings:
    # --- LM Studio: local, zero-cost inference for both embeddings and
    # chat completions ---
    lm_studio_base_url: str = os.getenv(
        "LM_STUDIO_BASE_URL", "http://127.0.0.1:1234/v1"
    )
    lm_studio_embed_model: str = os.getenv(
        "LM_STUDIO_EMBED_MODEL", "text-embedding-nomic-embed-text-v1.5"
    )
    lm_studio_chat_model: str = os.getenv(
        "LM_STUDIO_CHAT_MODEL", "llama-3.2-3b-instruct"
    )

    # --- API auth ---
    api_key: str = os.getenv("AADRIK_API_KEY", "")

    # --- CORS ---
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    # --- Retrieval ---
    retriever_k: int = int(os.getenv("RETRIEVER_K", "4"))


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


_startup_checks()
